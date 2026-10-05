import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import {
  defaultLanding,
  hashPassword,
  loginAdmin,
  loginRedirect,
  logoutAdmin,
  requireAdmin,
  revokeUserSessions,
  safeNextPath,
  sessionCookieOptions,
  setAdminPassword,
  verifyPassword,
} from "../../src/server/auth/admin-auth.ts";
import {
  adminSessions,
  adminUsers,
  branches,
  loginAttempts,
  users,
} from "../../src/server/db/schema.ts";
import type { TestDb } from "../helpers/pglite.ts";
import { createTestDb } from "../helpers/pglite.ts";

const NOW = new Date("2026-09-15T15:00:00.000Z");
const EMAIL = "andres@vectorbikes.cl";
const PASSWORD = "clave-larga-de-prueba";
const IP_HASH = "a".repeat(64);
const DAY_MS = 24 * 60 * 60 * 1000;

function later(ms: number): Date {
  return new Date(NOW.getTime() + ms);
}

async function login(test: TestDb, password = PASSWORD, now = NOW) {
  return loginAdmin(test.db, { email: EMAIL, password, ipHash: IP_HASH, now });
}

async function tokenOf(test: TestDb): Promise<string> {
  const result = await login(test);
  if (!result.ok) {
    throw new Error(`login falló: ${result.code}`);
  }
  return result.token;
}

function firstRow<T>(rows: T[]): T {
  const row = rows[0];
  if (!row) {
    throw new Error("Falta la fila de prueba");
  }
  return row;
}

async function seedLegacy(test: TestDb) {
  const admin = firstRow(
    await test.db
      .insert(adminUsers)
      .values({
        email: EMAIL,
        passwordHash: await hashPassword(PASSWORD),
        createdAt: NOW,
        updatedAt: NOW,
      })
      .returning(),
  );
  const token = "legacy-session-token".padEnd(43, "x");
  await test.db.insert(adminSessions).values({
    adminUserId: admin.id,
    tokenHash: createHash("sha256").update(token).digest("hex"),
    expiresAt: later(7 * DAY_MS),
    createdAt: NOW,
    updatedAt: NOW,
  });
  return { admin, token };
}

describe("hash de claves", () => {
  it("usa scrypt con el formato fijo y verifica solo la clave original", async () => {
    const stored = await hashPassword(PASSWORD);

    expect(stored.startsWith("scrypt$16384$8$1$")).toBe(true);
    expect(await verifyPassword(PASSWORD, stored)).toBe(true);
    expect(await verifyPassword("otra-clave-cualquiera", stored)).toBe(false);
    expect(await verifyPassword(PASSWORD, "scrypt$16384$8$1$roto")).toBe(false);
  });
});

describe("acceso admin", () => {
  let test: TestDb;

  beforeEach(async () => {
    test = await createTestDb();
    return () => test.close();
  });

  it("crea, actualiza y revoca las sesiones abiertas al cambiar la clave", async () => {
    expect(await setAdminPassword(test.db, EMAIL.toUpperCase(), PASSWORD, NOW)).toBe("created");
    const token = await tokenOf(test);
    expect(await requireAdmin(test.db, token, NOW)).not.toBeNull();

    expect(await setAdminPassword(test.db, EMAIL, "otra-clave-muy-larga", later(1000))).toBe(
      "updated",
    );

    expect(await requireAdmin(test.db, token, later(2000))).toBeNull();
  });

  it("rechaza claves de menos de 12 caracteres", async () => {
    await expect(setAdminPassword(test.db, EMAIL, "corta", NOW)).rejects.toThrow(
      "ADMIN_PASSWORD debe tener al menos 12 caracteres",
    );
  });

  it("inicia sesión por 7 días y guarda solo el hash del token", async () => {
    await setAdminPassword(test.db, EMAIL, PASSWORD, NOW);

    const result = await login(test);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.expiresAt.toISOString()).toBe(later(7 * DAY_MS).toISOString());
    const admin = await requireAdmin(test.db, result.token, NOW);
    expect(admin?.email).toBe(EMAIL);
    expect(await requireAdmin(test.db, result.token, later(8 * DAY_MS))).toBeNull();
    const [session] = await test.db.select().from(adminSessions);
    expect(session?.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(session?.tokenHash).not.toBe(result.token);
  });

  it("registra el fallo de un correo inexistente sin crear sesión", async () => {
    const result = await login(test);

    expect(result).toEqual({ ok: false, code: "invalid" });
    expect(await test.db.select().from(loginAttempts)).toHaveLength(1);
    expect(await test.db.select().from(adminSessions)).toHaveLength(0);
  });

  it("bloquea el sexto intento tras 5 fallos aunque la clave sea correcta", async () => {
    await setAdminPassword(test.db, EMAIL, PASSWORD, NOW);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(await login(test, "clave-equivocada", later(attempt * 1000))).toEqual({
        ok: false,
        code: "invalid",
      });
    }

    expect(await login(test, PASSWORD, later(10_000))).toEqual({
      ok: false,
      code: "rate_limited",
    });
    expect((await login(test, PASSWORD, later(16 * 60_000))).ok).toBe(true);
  });

  it("revoca la sesión al cerrar sesión", async () => {
    await setAdminPassword(test.db, EMAIL, PASSWORD, NOW);
    const token = await tokenOf(test);

    await logoutAdmin(test.db, token, later(1000));

    expect(await requireAdmin(test.db, token, later(2000))).toBeNull();
  });

  it("rechaza tokens ausentes o con forma inválida", async () => {
    expect(await requireAdmin(test.db, undefined, NOW)).toBeNull();
    expect(await requireAdmin(test.db, "no válido", NOW)).toBeNull();
  });

  it("copia al dueño legado con el mismo id y reemplaza la sesión legada en el primer login", async () => {
    const { admin, token } = await seedLegacy(test);
    expect(await requireAdmin(test.db, token, NOW)).toBeNull();

    const result = await login(test);

    expect(result.ok && result.role).toBe("owner");
    const branch = firstRow(await test.db.select().from(branches));
    expect(branch.name).toBe("Vitacura");
    const [user] = await test.db.select().from(users);
    expect(user).toMatchObject({
      id: admin.id,
      email: EMAIL,
      passwordHash: admin.passwordHash,
      role: "owner",
      name: "andres",
      branchId: branch.id,
    });
    expect(await test.db.select().from(adminUsers)).toEqual([admin]);
    const sessions = await test.db.select().from(adminSessions);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({ userId: admin.id, adminUserId: null });
    expect(await requireAdmin(test.db, token, NOW)).toBeNull();
    if (result.ok) {
      expect(await requireAdmin(test.db, result.token, NOW)).toEqual({
        id: admin.id,
        email: EMAIL,
        name: "andres",
        role: "owner",
        branchId: branch.id,
      });
    }
  });

  it("autentica los siguientes ingresos contra users sin volver a copiar al legado", async () => {
    await seedLegacy(test);
    await tokenOf(test);
    const before = await test.db.select().from(users);
    await test.db.update(adminUsers).set({ passwordHash: await hashPassword("otra-clave-legada") });

    expect((await login(test)).ok).toBe(true);

    expect(await test.db.select().from(users)).toEqual(before);
    expect(await test.db.select().from(branches)).toHaveLength(1);
    expect(await test.db.select().from(adminSessions)).toHaveLength(2);
    expect(await login(test, "otra-clave-legada")).toEqual({ ok: false, code: "invalid" });
    expect(await test.db.select().from(loginAttempts)).toHaveLength(1);
  });

  it("reutiliza la primera sucursal al copiar al dueño legado", async () => {
    const branch = firstRow(
      await test.db.insert(branches).values({ name: "Sucursal existente" }).returning(),
    );
    await seedLegacy(test);

    await tokenOf(test);

    const user = firstRow(await test.db.select().from(users));
    expect(user.branchId).toBe(branch.id);
    expect(await test.db.select().from(branches)).toEqual([branch]);
  });

  it("una clave legada incorrecta registra el fallo sin copiar ni borrar sesiones", async () => {
    await seedLegacy(test);
    const sessions = await test.db.select().from(adminSessions);

    expect(await login(test, "clave-equivocada")).toEqual({ ok: false, code: "invalid" });

    expect(await test.db.select().from(loginAttempts)).toHaveLength(1);
    expect(await test.db.select().from(branches)).toHaveLength(0);
    expect(await test.db.select().from(users)).toHaveLength(0);
    expect(await test.db.select().from(adminSessions)).toEqual(sessions);
  });

  it("rechaza la sesión exactamente al expirar y cuando se desactiva al usuario", async () => {
    await seedLegacy(test);
    const token = await tokenOf(test);
    expect(await requireAdmin(test.db, token, later(7 * DAY_MS))).toBeNull();
    await test.db.update(users).set({ isActive: false });

    expect(await requireAdmin(test.db, token, NOW)).toBeNull();
    expect(await login(test)).toEqual({ ok: false, code: "invalid" });
    expect(await test.db.select().from(loginAttempts)).toHaveLength(1);
    expect(await test.db.select().from(adminSessions)).toHaveLength(1);
  });

  it("un hash mal formado registra invalid sin lanzar ni crear sesión", async () => {
    await setAdminPassword(test.db, EMAIL, PASSWORD, NOW);
    await test.db.update(users).set({ passwordHash: "scrypt$16384$8$1$roto" });

    expect(await login(test)).toEqual({ ok: false, code: "invalid" });

    expect(await test.db.select().from(loginAttempts)).toHaveLength(1);
    expect(await test.db.select().from(adminSessions)).toHaveLength(0);
  });

  it("setAdminPassword crea un owner y limpia sesiones legadas conservando admin_users", async () => {
    const { admin, token } = await seedLegacy(test);

    expect(await setAdminPassword(test.db, "nuevo@vectorbikes.cl", PASSWORD, NOW)).toBe("created");

    const branch = firstRow(await test.db.select().from(branches));
    expect(branch.name).toBe("Vitacura");
    const user = firstRow(await test.db.select().from(users));
    expect(user).toMatchObject({
      email: "nuevo@vectorbikes.cl",
      name: "nuevo",
      role: "owner",
      branchId: branch.id,
    });
    expect(await verifyPassword(PASSWORD, user.passwordHash)).toBe(true);
    expect(await test.db.select().from(adminUsers)).toEqual([admin]);
    expect(await test.db.select().from(adminSessions)).toHaveLength(0);
    expect(await requireAdmin(test.db, token, NOW)).toBeNull();
  });

  it("al cambiar la clave limpia las sesiones legadas y conserva el rol y otras sesiones", async () => {
    const { admin } = await seedLegacy(test);
    await tokenOf(test);
    await test.db.update(users).set({ role: "mechanic" }).where(eq(users.id, admin.id));
    const firstToken = await tokenOf(test);
    const secondToken = await tokenOf(test);
    await test.db.insert(adminSessions).values({
      adminUserId: admin.id,
      tokenHash: "b".repeat(64),
      expiresAt: later(DAY_MS),
    });
    await setAdminPassword(test.db, "otro@vectorbikes.cl", PASSWORD, NOW);
    const other = await loginAdmin(test.db, {
      email: "otro@vectorbikes.cl",
      password: PASSWORD,
      ipHash: IP_HASH,
      now: NOW,
    });
    await test.db.insert(adminSessions).values({
      adminUserId: admin.id,
      tokenHash: "c".repeat(64),
      expiresAt: later(DAY_MS),
    });

    expect(await setAdminPassword(test.db, EMAIL, "otra-clave-muy-larga", later(1000))).toBe(
      "updated",
    );

    expect(await requireAdmin(test.db, firstToken, later(2000))).toBeNull();
    expect(await requireAdmin(test.db, secondToken, later(2000))).toBeNull();
    expect(other.ok).toBe(true);
    if (other.ok) expect(await requireAdmin(test.db, other.token, later(2000))).not.toBeNull();
    const user = firstRow(await test.db.select().from(users).where(eq(users.id, admin.id)));
    expect(user.role).toBe("mechanic");
    expect(await verifyPassword("otra-clave-muy-larga", user.passwordHash)).toBe(true);
    expect(
      (await test.db.select().from(adminSessions)).every((session) => session.userId !== null),
    ).toBe(true);
    expect((await login(test, "otra-clave-muy-larga")).ok).toBe(true);
    expect(await login(test)).toEqual({ ok: false, code: "invalid" });
  });

  it("revokeUserSessions revoca todas las sesiones vigentes solo del usuario indicado", async () => {
    await setAdminPassword(test.db, EMAIL, PASSWORD, NOW);
    const firstToken = await tokenOf(test);
    const secondToken = await tokenOf(test);
    const user = firstRow(await test.db.select().from(users));
    await logoutAdmin(test.db, firstToken, later(1000));

    await revokeUserSessions(test.db, user.id, later(2000));

    expect(await requireAdmin(test.db, secondToken, later(3000))).toBeNull();
    const sessions = await test.db.select().from(adminSessions);
    expect(sessions.map((session) => session.revokedAt)).toEqual([later(1000), later(2000)]);
  });
});

describe("destinos de login", () => {
  it("acepta solo rutas bajo admin o taller con sus límites de nombre y longitud", () => {
    for (const path of [
      "/admin",
      "/taller",
      "/taller/ordenes?x=1",
      "/admin?x=1",
      "/taller#recepcion",
      `/admin/${"x".repeat(505)}`,
    ]) {
      expect(safeNextPath(path)).toBe(path);
    }
    for (const path of [
      undefined,
      null,
      42,
      {},
      "",
      "//evil.com",
      "https://evil.com",
      "/otra",
      "/administrator",
      "/admin\n",
      "/tallerista",
      "/taller//evil.com",
      `/admin/${"x".repeat(506)}`,
    ]) {
      expect(safeNextPath(path)).toBeNull();
    }
  });

  it("codifica el destino y elige la portada según el permiso del rol", () => {
    expect(loginRedirect("/taller/ordenes?x=1#fotos")).toBe(
      "/admin/login?next=%2Ftaller%2Fordenes%3Fx%3D1%23fotos",
    );
    for (const role of ["owner", "admin", "reception"] as const) {
      expect(defaultLanding(role)).toBe("/admin");
    }
    expect(defaultLanding("mechanic")).toBe("/taller");
  });
});

describe("cookie de sesión", () => {
  it("es Secure solo cuando el sitio es https", () => {
    expect(sessionCookieOptions("https://vectorbikes.cl")).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 604800,
    });
    expect(sessionCookieOptions("http://localhost:4321").secure).toBe(false);
  });
});
