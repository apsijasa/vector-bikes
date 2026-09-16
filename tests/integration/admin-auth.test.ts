import { beforeEach, describe, expect, it } from "vitest";
import {
  hashPassword,
  loginAdmin,
  logoutAdmin,
  requireAdmin,
  sessionCookieOptions,
  setAdminPassword,
  verifyPassword,
} from "../../src/server/auth/admin-auth.ts";
import { adminSessions, loginAttempts } from "../../src/server/db/schema.ts";
import { type TestDb, createTestDb } from "../helpers/pglite.ts";

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
