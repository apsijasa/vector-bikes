# Epic 01: Fundaciones

> Después de esta épica los recordatorios vuelven a funcionar por cron externo, existen `branches` y `users` con roles, la sesión vive en `users`, `/admin` filtra por rol, hay un área `/taller` probada en tablet, una pantalla de usuarios con auditoría y una capa de almacenamiento de imágenes.

| | |
|---|---|
| **Epic id** | `01-fundaciones` |
| **Tasks** | `E1-T1` … `E1-T8` (pasos F1-01 … F1-08) |
| **Depends on** | nothing — start here (después del Bootstrap de `blueprint.md` §10) |
| **Unlocks** | `02-catalogo-clientes-entrada`, `03-recepcion-orden` |
| **Parallel with** | nada: comparte `src/lib/env.ts` y `.env.example` entre tareas |

You do not need any other file to complete this epic. Everything below is repeated here on purpose.

---

## Stack

Astro 7 SSR (`@astrojs/node` standalone) · TypeScript 6 · Preact · Postgres 16 · Drizzle ORM 0.45 (query builder) · sesión propia scrypt · Resend · Replit Autoscale. Package manager: `pnpm` 12.4.2 (`pnpm --version` debe imprimir `12.4.2`; si no, `corepack enable` y `corepack prepare pnpm@12.4.2 --activate`). Runtime en `.nvmrc` (Node 24). Versiones en `pnpm-lock.yaml`: léelo, no adivines. Paquetes nuevos (ya instalados por el Bootstrap con `pnpm add -w …`): `sharp`, `@replit/object-storage`, `qrcode`, `signature_pad`, `@playwright/test`, `@types/qrcode`.

| Task | Command |
|---|---|
| Formatear | `pnpm format` |
| Chequeo estático | `pnpm check` |
| Test (un archivo) | `pnpm test tests/integration/<archivo>.test.ts` |
| Migraciones (solo base dev) | `pnpm db:generate` · `pnpm db:migrate` · `pnpm db:check` |
| Tablet (desde E1-T6) | `pnpm build && pnpm test:tablet e2e/<archivo>.spec.ts` |
| Compuerta | `pnpm gate` (`test:tablet` entra desde E1-T6) |

**Gate:** `pnpm format && pnpm gate` pasa antes de marcar cualquier tarea como hecha. Servicio requerido: Postgres local en `127.0.0.1:5432` (`pg_isready -h 127.0.0.1 -p 5432`), con un rol que pueda crear bases, el que fija `DATABASE_URL` en `.env`; base `vector_bikes`. La base E2E `vector_bikes_e2e` la crea `e2e/global-setup.ts` con el rol de `E2E_DATABASE_URL`, que en `.env` usa ese mismo rol.

**Reversión de una tarea** (la confirma el operador en la sesión supervisada; el allowlist no la impide técnicamente, porque `node -e:*` permite JS arbitrario): `git reset --hard f1-<anterior>` y, si la base dev ya tiene migraciones de la tarea revertida, `test -z "$REPLIT_DEPLOYMENT" && psql "$(node --env-file-if-exists=.env -p 'process.env.DATABASE_URL')" -v ON_ERROR_STOP=1 -c 'drop schema public cascade; create schema public; drop schema if exists drizzle cascade;' && pnpm db:migrate`.

## Directory subtree

```
src/lib/env.ts                         # edit (E1-T1, E1-T8)
src/server/api/task-handlers.ts        # NEW (E1-T1)
src/pages/api/tareas/recordatorios.ts  # NEW (E1-T1)
src/server/whatsapp/cron.ts            # edit mínima (E1-T2)
src/server/db/schema.ts                # edit (E1-T3)
src/server/db/schema-taller.ts         # NEW (E1-T7)
src/server/auth/permissions.ts         # NEW (E1-T3)
src/server/auth/admin-auth.ts          # edit (E1-T4)
src/pages/admin/login.astro · index.astro · bloqueos.astro · reservas/[id].astro   # edit (E1-T5)
src/layouts/TallerLayout.astro · src/pages/taller/index.astro   # NEW (E1-T6)
src/server/taller/audit.ts · users.ts · src/pages/taller/usuarios.astro   # NEW (E1-T7)
src/server/storage/storage.ts · images.ts   # NEW (E1-T8)
scripts/smoke.sh · scripts/admin-set-password.ts · .env.example · README.md · package.json   # edit
blueprints/vector-bikes/blueprint.md   # UNA edición (E1-T2)
tests/integration/{tasks,users-schema,admin-auth,users-admin,storage}.test.ts · tests/unit/permissions.test.ts · e2e/login.spec.ts
e2e/fixtures.ts · e2e/global-setup.ts · playwright.config.ts · drizzle.config.ts   # read-only (los entregó workspace/)
```

## Data model touched here

Helpers `instant`, `createdAt`, `updatedAt` de `schema.ts` (se exportan en E1-T3). **B** = `branch_id uuid not null → branches.id` `onDelete: "restrict"`.

| Entity | Campos | Notas |
|---|---|---|
| `branches` (E1-T3) | `id`, `name text not null`, `next_order_number integer not null default 1`, timestamps | `uq_branches_name`; CHECK `next_order_number >= 1` |
| `users` (E1-T3) | `id`, B, `email`, `password_hash`, `name`, `role`, `is_active boolean not null default true`, `created_by uuid null → users` (`(): AnyPgColumn => users.id`, restrict), timestamps | `uq_users_email`; `idx_users_branch_role`; CHECK `users_role_check`: `role in ('owner', 'admin', 'reception', 'mechanic')` |
| `admin_sessions` (E1-T3) | + `user_id uuid null → users` `onDelete: "cascade"`; `admin_user_id` deja de ser NOT NULL | `idx_admin_sessions_user_id` |
| `bookings` (E1-T3) | + `source text not null default 'web'` | CHECK `bookings_source_check`: `source in ('web', 'telefono', 'whatsapp', 'presencial')` |
| `audit_log` (E1-T7, `schema-taller.ts`) | `id`, B, `actor_user_id uuid null → users`, `action`, `entity` (text not null), `entity_id uuid null`, `details jsonb not null default '{}'::jsonb` (`.$type<Record<string, unknown>>()`, default `sql\`'{}'::jsonb\``), timestamps | índices `(branch_id, created_at)`, `(entity, entity_id)`; `export const tallerTables = [auditLog] as const` |

`allTables` += `branches`, `users`. Tipos `Branch`, `User`. `admin_users` intacta (la elimina F1-37).

## Contracts

**Consumed:** `sendReminders(db, now, deps?)` (sin cambios); `jsonResponse`, `isAllowedOrigin`, `hashIp`, `normalizePhone` (`handlers.ts`); `hashPassword`, `verifyPassword`, `SESSION_COOKIE`, `sessionCookieOptions`, `logoutAdmin` (`admin-auth.ts`); `log`, `errorMessage`; `createTestDb()`.

**Produced:**

| Export | Signature | Used by |
|---|---|---|
| `env.ts` → `getTasksEnv`, `getCronEnv`, `getStorageEnv` | `(source?) => { TASKS_SECRET } / { CRON_SECRET?: string } / { STORAGE_DRIVER: "local" \| "replit"; STORAGE_LOCAL_DIR: string; STORAGE_BUCKET_ID?: string }` | 05 |
| `task-handlers.ts` → `isAuthorizedTask`, `handleRemindersTask` | `(header: string \| null, secret: string \| undefined) => boolean`; `(request, db, now, deps?: { secret?: string; send?: typeof sendReminders }) => Promise<Response>` | 05 |
| `permissions.ts` → `ROLES`, `Role`, `ROLE_LABELS`, `ACTIONS`, `Action`, `can`, `isRole`, `forbiddenResponse` | `can(role: Role, action: Action): boolean`; `forbiddenResponse(): Response` (403, `No tienes permiso para ver esta página.`, `no-store`) | todas |
| `admin-auth.ts` → `SessionUser`, `requireAdmin`, `loginRedirect`, `safeNextPath`, `defaultLanding`, `revokeUserSessions` | `SessionUser = { id; email; name; role: Role; branchId }`; `requireAdmin(db, token, now): Promise<SessionUser \| null>`; `loginRedirect(pathWithSearch: string): string`; `revokeUserSessions(db, userId, now): Promise<void>` | todas |
| `TallerLayout.astro` | props `{ title: string; user: { name: string; role: Role }; current?: string }` | todas las páginas `/taller` |
| `audit.ts` → `recordAudit`, `redactDetails`, `listAudit`, `AuditAction` | `recordAudit(db, { branchId, actorUserId: string \| null, action: AuditAction, entity: string, entityId: string \| null, details?: Record<string, unknown> }, now): Promise<void>` | 02–05 |
| `storage.ts` → `ObjectStorage`, `StorageError`, `isStorageKey`, `createLocalStorage`, `createReplitStorage`, `ReplitClientLike`, `createStorage`, `getStorage` | `ObjectStorage = { put(key, body: Buffer, contentType: string): Promise<void>; get(key): Promise<Buffer \| null>; delete(key): Promise<void>; exists(key): Promise<boolean> }` | 03, 05 |
| `images.ts` → `processPhoto`, `InvalidImageError` | `processPhoto(input: Buffer): Promise<{ full: Buffer; thumb: Buffer; width: number; height: number }>` | 03 |

## Conventions that bite in this area

- Importaciones relativas con `.ts`; `import type` para tipos; nada de `enum`/`namespace`/parameter properties.
- Entorno solo por `src/lib/env.ts`, con accesores; nunca validación global al arrancar.
- Toda función de dominio recibe `now: Date`.
- `drizzle/` nunca se edita; si `pnpm db:generate` pregunta algo, detenerse.
- Logs sin correos, teléfonos, tokens ni secretos.
- Biome: 2 espacios, comillas dobles, punto y coma, comas finales, ancho 100.

Full project rules: `CLAUDE.md`. Area rules: `.claude/rules/database.md`, `server-api.md`, `taller-ui.md`, `taller-domain.md`, `e2e.md` — copiados a la raíz desde `workspace/` antes de la primera tarea.

---

## Tasks

Listed in the same order as `tasks.json`. That order is the build order — work top to bottom.

### `E1-T1` — F1-01 Add authenticated reminders task endpoint

**Depends on:** nothing · **Priority:** p0

1. `src/lib/env.ts`: agregar `getTasksEnv(source = process.env)` con `z.object({ TASKS_SECRET: secret })` (el `secret` existente, `min(32)`) y `getCronEnv(source = process.env)` con `z.object({ CRON_SECRET: z.string().optional() })` — **sin** largo mínimo: un `CRON_SECRET=` vacío debe seguir dando 401 en `cron.ts`, no lanzar.
2. `src/server/api/task-handlers.ts`: `isAuthorizedTask(header, secret)` con la lógica de `authorized()` de `cron.ts` (secreto ≥ 32, `Bearer `, mismos largos, `timingSafeEqual`). Guardia común: método ≠ POST → 405 `{"ok":false,"error":"method_not_allowed"}`; secreto = `deps.secret` o `getTasksEnv().TASKS_SECRET` dentro de `try` (si lanza: `log.error("tasks.not_configured", { task })`, secreto ausente); no autorizado → `log.warn("tasks.unauthorized", { task })` y 401 `{"ok":false,"error":"unauthorized"}`. Nunca se registra IP, cabecera ni secreto. `handleRemindersTask(request, db, now, deps = {})` llama `(deps.send ?? sendReminders)(db, now)`; `failed === 0` → 200 `{"ok":true,"sent":n}`; si no → 500 `{"ok":false,"sent":n,"failed":m}`; excepción → `log.error("tasks.reminders_failed", { message })` y 500 `{"ok":false,"error":"internal_error"}`. Respuestas con `jsonResponse` (`no-store`).
3. `src/pages/api/tareas/recordatorios.ts`: `prerender = false`; `export const POST: APIRoute = ({ request }) => handleRemindersTask(request, getDb(), new Date());`.
4. `tests/integration/tasks.test.ts` (PGlite, estilo `reminders.test.ts`, secreto `"test-tasks-secret-0123456789abcdef0123"`): sin cabecera → 401 y `send` espía sin llamadas; bearer erróneo → 401; sin secreto en deps ni entorno → 401; reserva confirmada de mañana → 200 `{ ok: true, sent: 1 }` y `reminder_sent_at` no nulo; segunda llamada → `{ ok: true, sent: 0 }`; `send` con `{ sent: 1, failed: 2 }` → 500 `{ ok: false, sent: 1, failed: 2 }`; con `vi.spyOn(console, "log")`/`console.error`, ninguna línea contiene un correo, el teléfono de la reserva ni el secreto.
5. `scripts/smoke.sh`: tras la línea de `/robots.txt`, `test "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/tareas/recordatorios")" = 401`.

**Files**
- `src/lib/env.ts` — edit
- `src/server/api/task-handlers.ts` — new
- `src/pages/api/tareas/recordatorios.ts` — new
- `tests/integration/tasks.test.ts` — new
- `scripts/smoke.sh` — edit

**Acceptance**

1. **WHEN** `handleRemindersTask` recibe un POST sin cabecera `Authorization`, con un bearer distinto de `TASKS_SECRET` o sin `TASKS_SECRET` configurado **THE SYSTEM SHALL** responder 401 con `{"ok":false,"error":"unauthorized"}` sin llamar a `sendReminders`
2. **WHEN** recibe un POST con `Authorization: Bearer <TASKS_SECRET>` y hay una reserva confirmada para mañana sin recordatorio **THE SYSTEM SHALL** responder 200 con `{"ok":true,"sent":1}` y marcar `reminder_sent_at`
3. **WHEN** el mismo POST se repite el mismo día **THE SYSTEM SHALL** responder 200 con `{"ok":true,"sent":0}` sin enviar un segundo correo
4. **WHEN** algún envío falla **THE SYSTEM SHALL** responder 500 con `{"ok":false,"sent":n,"failed":m}`
5. **WHEN** se rechaza un intento **THE SYSTEM SHALL** registrar `tasks.unauthorized` sin correos, teléfonos ni el secreto en los logs
6. **WHEN** `sh scripts/smoke.sh` corre contra el build **THE SYSTEM SHALL** obtener 401 de `POST /api/tareas/recordatorios` sin cabecera

**Verify**

```bash
pnpm test tests/integration/tasks.test.ts tests/integration/reminders.test.ts tests/integration/whatsapp.test.ts   # expect: exit 0, 0 failed
pnpm format && pnpm gate   # expect: exit 0
```

**Checkpoint**

```bash
git add -A && git commit -m "feat: f1-01 add authenticated reminders task endpoint" && git tag f1-01
git tag -l f1-01 | grep -qx f1-01   # expect: exit 0
```

### `E1-T2` — F1-02 Read CRON_SECRET via env and document cutover

**Depends on:** `E1-T1` · **Priority:** p0

1. `src/server/whatsapp/cron.ts`: cambiar **solo** el valor por defecto de `secret` de `process.env.CRON_SECRET` a `getCronEnv().CRON_SECRET` (import de `../../lib/env.ts`). Nada más de `src/server/whatsapp/**` cambia.
2. `.env.example`, después de `CRON_SECRET=`:
   ```text
   # Secreto de las tareas programadas /api/tareas/* (mínimo 32 caracteres). El mismo valor va en Make.com.
   TASKS_SECRET=dev-tasks-secret-change-me-0123456789ab
   ```
3. `README.md`: en *Estado de producción* agregar `| Recordatorios por correo | Cron externo de **Make.com** → \`POST /api/tareas/recordatorios\` (ver *Recordatorios por correo (cron externo)*). |`. Insertar **antes** de `## Recordatorios`:
   ```markdown
   ## Recordatorios por correo (cron externo)

   El recordatorio del día anterior a cada reserva lo dispara un escenario de **Make.com**, no una Scheduled Deployment (Replit no permitió una segunda publicación en la misma App).

   - Programación: diaria a las **10:00**, zona **America/Santiago**.
   - Llamada: módulo HTTP, `POST https://vectorbikes.cl/api/tareas/recordatorios`, cabecera `Authorization: Bearer <TASKS_SECRET>`, sin cuerpo, timeout de 120 segundos.
   - `TASKS_SECRET` (mínimo 32 caracteres; genéralo con `node -e 'console.log(require("node:crypto").randomBytes(32).toString("base64url"))'`) va en los *Secrets* de la Autoscale Deployment y en Make.com, nunca en el repositorio.
   - Respuesta esperada: HTTP 200 con `{"ok":true,"sent":n}`. Cualquier otra (401, 500 o `"ok":false`) debe disparar el aviso por correo al dueño que se configura en el mismo escenario.
   - Llamarlo dos veces el mismo día no duplica correos: cada reserva queda marcada con `reminder_sent_at`.
   - Respaldo manual: `pnpm reminders:send` sigue existiendo y hace lo mismo desde el Shell de Replit con el `DATABASE_URL` de producción.
   ```
4. `blueprints/vector-bikes/blueprint.md` — la **única** edición permitida (FASE1 §3.0):
   - En §20.1 reemplazar la línea completa que empieza con `- [ ] **Lanzamiento — Scheduled Deployment:**` por:
     ```text
     - [ ] **Lanzamiento — cron externo de recordatorios** (reemplaza a la Scheduled Deployment; ver §20.3 #25): escenario de Make.com con programación diaria 10:00 America/Santiago que hace `POST https://vectorbikes.cl/api/tareas/recordatorios` con la cabecera `Authorization: Bearer <TASKS_SECRET>` y `TASKS_SECRET` cargado en *Secrets* de la Autoscale; su primera ejecución recibe HTTP 200 con `"ok":true` y el escenario avisa al dueño por correo si la respuesta no es 200 con `"ok":true`.
     ```
   - En §20.3, después de la fila `| 24 | …`, agregar:
     ```text
     | 25 | Recordatorios por correo disparados por un cron externo de Make.com que llama `POST /api/tareas/recordatorios` con `Authorization: Bearer <TASKS_SECRET>`; `pnpm reminders:send` se conserva como respaldo manual — **tomada 2026-10-05, tarea 0 de la fase 1 (`blueprints/vector-taller-f1`)** | Replit Scheduled Deployment diaria que corre `pnpm reminders:send` | Replit no permitió una segunda publicación en la misma App, así que la Scheduled Deployment nunca operó y los recordatorios estaban caídos en producción. El endpoint reutiliza `sendReminders` sin cambios y `reminder_sent_at` hace segura una doble llamada | Replit permite una Scheduled Deployment en la misma App |
     ```
   - Nada más de ese archivo cambia.

**Files**
- `src/server/whatsapp/cron.ts` — edit
- `.env.example` — edit
- `README.md` — edit
- `blueprints/vector-bikes/blueprint.md` — edit (una línea reemplazada, una fila agregada)

**Acceptance**

1. **WHEN** `handleWhatsAppCron` se llama sin el argumento `secret` **THE SYSTEM SHALL** leer `CRON_SECRET` con `getCronEnv()` de `src/lib/env.ts`, sin `process.env` en `src/server/whatsapp/cron.ts`
2. **WHEN** corre `pnpm test tests/integration/whatsapp.test.ts` **THE SYSTEM SHALL** pasar sin cambios en ese archivo
3. **WHEN** se lee `.env.example` **THE SYSTEM SHALL** contener una línea `TASKS_SECRET=` con un valor de al menos 32 caracteres
4. **WHEN** se lee `README.md` **THE SYSTEM SHALL** contener la sección `## Recordatorios por correo (cron externo)` con `POST https://vectorbikes.cl/api/tareas/recordatorios`
5. **WHEN** se lee `blueprints/vector-bikes/blueprint.md` **THE SYSTEM SHALL** contener la fila `| 25 | Recordatorios por correo disparados por un cron externo de Make.com` y el punto `**Lanzamiento — cron externo de recordatorios**`, y ninguna línea con `Lanzamiento — Scheduled Deployment`

**Verify**

```bash
pnpm test tests/integration/whatsapp.test.ts tests/integration/tasks.test.ts   # expect: exit 0, 0 failed
grep -q 'getCronEnv' src/server/whatsapp/cron.ts   # expect: exit 0
grep -q 'process.env' src/server/whatsapp/cron.ts; test $? -eq 1   # expect: 1 = sin coincidencias → la línea sale 0
grep -Eq '^TASKS_SECRET=.{32,}$' .env.example   # expect: exit 0
grep -qF '## Recordatorios por correo (cron externo)' README.md   # expect: exit 0
grep -qF 'POST https://vectorbikes.cl/api/tareas/recordatorios' README.md   # expect: exit 0
grep -qF '| 25 | Recordatorios por correo disparados por un cron externo de Make.com' blueprints/vector-bikes/blueprint.md   # expect: exit 0
grep -qF -- '- [ ] **Lanzamiento — cron externo de recordatorios**' blueprints/vector-bikes/blueprint.md   # expect: exit 0
grep -qF 'Lanzamiento — Scheduled Deployment' blueprints/vector-bikes/blueprint.md; test $? -eq 1   # expect: 1 = el punto viejo ya no está
pnpm format && pnpm gate   # expect: exit 0
```

**Checkpoint**

```bash
git add -A && git commit -m "docs: f1-02 document reminders cutover and read CRON_SECRET via env" && git tag f1-02
git tag -l f1-02 | grep -qx f1-02   # expect: exit 0
```

### `E1-T3` — F1-03 Expand schema: branches, users, booking source

**Depends on:** `E1-T2` · **Priority:** p0

**Confirmación previa del operador (no es compuerta de máquina):** antes de delegar esta tarea, el operador confirma con el dueño que los respaldos programados de la base de Replit están activos (FASE1 §12.1). Es el prerrequisito explícito que pidió el dueño; la construcción es supervisada (`/architect-next` con el dueño presente).

1. `schema.ts`: `export` en `instant`, `createdAt`, `updatedAt`; importar `type AnyPgColumn`; `branches`, `users` según la tabla; en `adminSessions`, `adminUserId` sin `.notNull()`, `userId` con `references(() => users.id, { onDelete: "cascade" })` e `index("idx_admin_sessions_user_id")`; `bookings.source` y su CHECK; `allTables` += `branches`, `users`; tipos `Branch`, `User`.
2. `pnpm db:generate` y leer el SQL (solo `CREATE TABLE`, `ADD COLUMN`, `DROP NOT NULL`, CHECK, FKs, índices; si drizzle-kit pregunta, detenerse) → `pnpm db:migrate`.
3. `src/server/auth/permissions.ts` (puro): `ROLES = ["owner", "admin", "reception", "mechanic"] as const`; `ROLE_LABELS` (Dueño, Administrador, Recepción, Mecánico); `ACTIONS` y la matriz:
   - owner, admin, reception: `admin.panel`, `customers.manage`, `bookings.manage`, `orders.view_all`, `orders.assign`, `orders.cancel`, `items.add_part`, `tax_doc.edit`, `warranty.open`, `approvals.create`, `payments.record`, `delivery.complete`, `reports.generate`, `dashboard.admin`
   - owner, admin: `catalog.edit`, `items.override_price`, `items.void`, `payments.void`
   - solo owner: `users.manage`, `audit.view`, `qc.approve`
   - los cuatro: `reception.perform` (FASE1 decisión 5: el mecánico también recibe), `catalog.view`, `orders.edit`, `items.add_catalog`, `photos.upload`, `components.manage`
   - solo mechanic: `dashboard.mechanic`
   `can`, `isRole`, `forbiddenResponse()`.
4. `tests/integration/users-schema.test.ts` (consultas crudas con `test.client.query`; el código se lee de `error.code` recorriendo `cause`): criterios 1–5. `tests/unit/permissions.test.ts`: criterio 6 recorriendo la matriz.

**Files**
- `src/server/db/schema.ts` — edit
- `src/server/auth/permissions.ts` — new
- `tests/integration/users-schema.test.ts` — new
- `tests/unit/permissions.test.ts` — new
- (la migración generada en `drizzle/` no cuenta)

**Acceptance**

1. **WHEN** `pnpm db:migrate` aplica la migración que emite `pnpm db:generate` **THE SYSTEM SHALL** crear `branches` y `users`, agregar `admin_sessions.user_id` y `bookings.source` y dejar `admin_users` intacta
2. **WHEN** se inserta en `users` un `role` fuera de `owner`, `admin`, `reception` y `mechanic` **THE SYSTEM SHALL** rechazarlo con código `23514`
3. **WHEN** se inserta una reserva sin `source` **THE SYSTEM SHALL** guardar `web`
4. **WHEN** se inserta `bookings.source` fuera de `web`, `telefono`, `whatsapp` y `presencial` **THE SYSTEM SHALL** rechazarlo con código `23514`
5. **WHEN** se inserta una sesión en `admin_sessions` sin `admin_user_id` **THE SYSTEM SHALL** aceptarla
6. **WHEN** `can(role, action)` se evalúa **THE SYSTEM SHALL** devolver `true` para `owner` en toda acción salvo `dashboard.mechanic`, `true` para `mechanic` en `reception.perform`, `false` para `mechanic` en `admin.panel`, `catalog.edit`, `items.override_price` y `qc.approve`, y `false` para `admin` en `users.manage`

**Verify**

```bash
pnpm test tests/integration/users-schema.test.ts tests/unit/permissions.test.ts tests/integration/foundation.test.ts   # expect: exit 0, 0 failed
pnpm db:migrate   # expect: exit 0
pnpm db:check   # expect: exit 0, {"ok":true,...}
pnpm format && pnpm gate   # expect: exit 0
```

**Checkpoint**

```bash
git add -A && git commit -m "feat: f1-03 expand schema with branches, users and booking source" && git tag f1-03
git tag -l f1-03 | grep -qx f1-03   # expect: exit 0
```

### `E1-T4` — F1-04 Move sessions to users with copy-on-login

**Depends on:** `E1-T3` · **Priority:** p0

1. `src/server/auth/admin-auth.ts` (mismo `SESSION_COOKIE`, `SESSION_DAYS`, scrypt y límites):
   - `export type SessionUser = { id: string; email: string; name: string; role: Role; branchId: string }`.
   - `loginAdmin` (misma firma; `LoginResult` ok agrega `role`): rate limit → `users` por correo → si existe, `verifyPassword`; activo y correcto → sesión con `userId`. Si no existe en `users`: buscar en `admin_users` (fallback que elimina F1-37); clave correcta → en **una** transacción: primera fila de `branches` o insertar `{ name: "Vitacura" }`; insertar `users` `{ id: admin.id, branchId, email, passwordHash: admin.passwordHash, name: <parte local del correo>, role: "owner" }`; `delete from admin_sessions where user_id is null`; insertar la sesión con `userId`. Cualquier otro caso → `login_attempts` + `invalid`, pagando siempre un scrypt.
   - `requireAdmin(db, token, now): Promise<SessionUser | null>` (join por `user_id`, usuario activo, sin revocar, sin expirar).
   - `setAdminPassword(db, email, password, now)` sobre `users`: nuevo → sucursal si falta + `owner`; existente → nuevo hash + revocar sus sesiones; siempre `delete from admin_sessions where user_id is null`.
   - `safeNextPath(raw: unknown): string | null` (string ≤ 512 que empieza con `/taller` o `/admin` seguido de fin, `/`, `?` o `#`, sin `//`), `loginRedirect(path)` = `/admin/login?next=${encodeURIComponent(path)}`, `defaultLanding(role)` = `can(role, "admin.panel") ? "/admin" : "/taller"`, `revokeUserSessions(db, userId, now)`.
   - Las páginas `/admin` siguen compilando sin cambios (solo prueban si `requireAdmin` devuelve algo); su filtro por rol llega en E1-T5.
2. `scripts/admin-set-password.ts`: la salida agrega `"role":"owner"`; las variables se siguen validando **antes** de abrir la base.
3. `tests/integration/admin-auth.test.ts`: conservar todos los tests existentes; agregar los casos de los criterios 1–5 (sesión legada insertada con `adminUserId` y `tokenHash` = sha256 hex de un token conocido).

**Files**
- `src/server/auth/admin-auth.ts` — edit
- `scripts/admin-set-password.ts` — edit
- `tests/integration/admin-auth.test.ts` — edit

**Acceptance**

1. **WHEN** un correo existe solo en `admin_users` e inicia sesión con su clave correcta **THE SYSTEM SHALL**, en una transacción, crear la sucursal `Vitacura` si no hay ninguna, insertar en `users` una fila con el mismo `id`, rol `owner` y el nombre de la parte local del correo, borrar las filas de `admin_sessions` con `user_id` nulo y crear la sesión con `user_id`
2. **WHEN** ese usuario vuelve a iniciar sesión **THE SYSTEM SHALL** autenticarlo contra `users` sin crear otra fila en `users`
3. **WHEN** `requireAdmin` recibe el token de una sesión con `user_id` nulo, revocada, expirada o de un usuario con `is_active = false` **THE SYSTEM SHALL** devolver `null`
4. **WHEN** `setAdminPassword` corre **THE SYSTEM SHALL** crear en `users` un usuario `owner` para un correo nuevo (y la sucursal si falta) o cambiar el `password_hash` y revocar las sesiones de uno existente, y borrar las sesiones con `user_id` nulo
5. **WHEN** `safeNextPath` evalúa un `next` **THE SYSTEM SHALL** aceptar solo rutas relativas bajo `/taller` o `/admin` (`/taller/ordenes?x=1` sí; `//evil.com`, `https://evil.com` y `/otra` → `null`)
6. **WHEN** `scripts/admin-set-password.ts` corre sin `ADMIN_EMAIL` ni `ADMIN_PASSWORD` y con un `DATABASE_URL` inalcanzable **THE SYSTEM SHALL** salir con código 1 y un mensaje que nombra `ADMIN_EMAIL`, sin intentar conectarse a la base

**Verify**

```bash
pnpm test tests/integration/admin-auth.test.ts tests/integration/admin-panel.test.ts   # expect: exit 0, 0 failed
out="$(DATABASE_URL=postgres://127.0.0.1:1/x env -u ADMIN_EMAIL -u ADMIN_PASSWORD node scripts/admin-set-password.ts 2>&1)"; test $? -eq 1 && printf '%s' "$out" | grep -q ADMIN_EMAIL   # expect: exit 0 — código 1 y error de configuración, no de conexión
pnpm format && pnpm gate   # expect: exit 0
```

**Checkpoint**

```bash
git add -A && git commit -m "feat: f1-04 move sessions to users with copy-on-login" && git tag f1-04
git tag -l f1-04 | grep -qx f1-04   # expect: exit 0
```

### `E1-T5` — F1-05 Add login next param and role gate on /admin

**Depends on:** `E1-T4` · **Priority:** p0

1. `src/pages/admin/login.astro`: `next` del query en `<input type="hidden" name="next">`; tras el POST exitoso, 303 a `safeNextPath(form.get("next")) ?? defaultLanding(result.role)`.
2. `index.astro`, `bloqueos.astro`, `reservas/[id].astro`: sin sesión → `Astro.redirect(loginRedirect(Astro.url.pathname + Astro.url.search), 303)`; con sesión sin `can(admin.role, "admin.panel")` → `return forbiddenResponse()`; en la `nav`, `<a href="/taller">Taller</a>` antes de `Salir`. Nada más cambia (el smoke sigue esperando 303 en `/admin`).
3. Esta tarea se verifica por el código fuente y las pruebas existentes; el comportamiento en el navegador (403 del mecánico, aterrizaje en `/taller`) lo afirma `e2e/login.spec.ts` en E1-T6, la primera tarea con navegador.

**Files**
- `src/pages/admin/login.astro` — edit
- `src/pages/admin/index.astro` — edit
- `src/pages/admin/bloqueos.astro` — edit
- `src/pages/admin/reservas/[id].astro` — edit

**Acceptance**

1. **WHEN** un grep recorre `src/pages/admin/index.astro`, `src/pages/admin/bloqueos.astro` y `src/pages/admin/reservas/[id].astro` **THE SYSTEM SHALL** encontrar en cada una `"admin.panel"`, `forbiddenResponse()` y `href="/taller"`
2. **WHEN** un grep recorre `src/pages/admin/login.astro` **THE SYSTEM SHALL** encontrar `name="next"` y `safeNextPath`
3. **WHEN** `sh scripts/smoke.sh` corre **THE SYSTEM SHALL** seguir obteniendo 303 en `/admin` sin sesión
4. **WHEN** corren `tests/integration/admin-panel.test.ts` y `tests/integration/admin-month.test.ts` **THE SYSTEM SHALL** pasar sin cambios en esos archivos

**Verify**

```bash
grep -q '"admin.panel"' src/pages/admin/index.astro && grep -q 'forbiddenResponse()' src/pages/admin/index.astro && grep -q 'href="/taller"' src/pages/admin/index.astro   # expect: exit 0
grep -q '"admin.panel"' src/pages/admin/bloqueos.astro && grep -q 'forbiddenResponse()' src/pages/admin/bloqueos.astro && grep -q 'href="/taller"' src/pages/admin/bloqueos.astro   # expect: exit 0
grep -q '"admin.panel"' 'src/pages/admin/reservas/[id].astro' && grep -q 'forbiddenResponse()' 'src/pages/admin/reservas/[id].astro' && grep -q 'href="/taller"' 'src/pages/admin/reservas/[id].astro'   # expect: exit 0
grep -q 'name="next"' src/pages/admin/login.astro && grep -q 'safeNextPath' src/pages/admin/login.astro   # expect: exit 0
pnpm test tests/integration/admin-panel.test.ts tests/integration/admin-month.test.ts   # expect: exit 0, 0 failed
pnpm format && pnpm gate   # expect: exit 0 (el smoke afirma /admin 303)
```

**Checkpoint**

```bash
git add -A && git commit -m "feat: f1-05 add login next param and role gate on admin pages" && git tag f1-05
git tag -l f1-05 | grep -qx f1-05   # expect: exit 0
```

### `E1-T6` — F1-06 Add /taller area and tablet test harness

**Depends on:** `E1-T5` · **Priority:** p0

1. Scripts (las únicas ediciones de `package.json` de la fase, además del Bootstrap):
   ```bash
   pnpm pkg set scripts.test:tablet="playwright test"
   pnpm pkg set scripts.gate="pnpm check && pnpm test && pnpm build && pnpm test:build && pnpm test:tablet && pnpm smoke"
   ```
2. `.env.example`, al final:
   ```text
   # Base solo para las pruebas de tablet (Playwright). Debe terminar en _e2e; global-setup la crea si falta.
   E2E_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/vector_bikes_e2e
   ```
   El literal de `.env.example` no cambia; en `.env` local, `E2E_DATABASE_URL` usa el mismo rol que `DATABASE_URL`.
3. `src/layouts/TallerLayout.astro`: envuelve `Base` (`chrome="none"`, `noindex`) en `<div class="taller">`; cabecera "Vector Bikes · Taller", `user.name` y `ROLE_LABELS[user.role]` en un elemento propio (`<span class="role">`); `nav` filtrada con `can`: Inicio `/taller`, Buscar `/taller/buscar`, Órdenes `/taller/ordenes`, Recepción `/taller/recepcion/nueva` (todos los roles), Reservas `/taller/reservas` (`bookings.manage`), Clientes `/taller/clientes` (`customers.manage`), Catálogo `/taller/catalogo` (`catalog.view`), Usuarios `/taller/usuarios` (`users.manage`), Agenda `/admin` (`admin.panel`) y el formulario POST `/admin/logout` "Salir". Los enlaces a pantallas de pasos posteriores responden 404 hasta su paso. `<style is:global>` bajo `.taller`, solo con tokens existentes: controles con `min-height: 48px`; `.options` (labels de radio como botones segmentados que invierten con `:has(input:checked)`); `.status` y `.status--<estado>` para los 11 estados; `table.dense` con `tabular-nums`; `.grid-photos`; `:focus-visible` 2px `--ink`.
4. `src/pages/taller/index.astro`: `prerender = false`; sin sesión → 303 `loginRedirect(...)`; `no-store`; `<h1>Taller</h1>` y `<p>Hola, {name} · {ROLE_LABELS[role]}</p>`. F1-35 lo reemplaza conservando ambas cosas.
5. `e2e/login.spec.ts` (`test`, `expect` de `@playwright/test`; `login` de `./fixtures.ts`): sin sesión `page.goto("/taller")` → `toHaveURL(/\/admin\/login\?next=%2Ftaller$/)`; `login(page, "owner")` → heading nivel 1 `Taller` y `page.getByText("Dueño", { exact: true })` visible; `login(page, "mechanic")` → `(await page.goto("/admin"))?.status()` es 403.

**Files**
- `src/layouts/TallerLayout.astro` — new
- `src/pages/taller/index.astro` — new
- `e2e/login.spec.ts` — new
- `package.json` — edit (con `pnpm pkg set`)
- `.env.example` — edit

**Acceptance**

1. **WHEN** se pide `/taller` sin sesión **THE SYSTEM SHALL** redirigir a `/admin/login?next=%2Ftaller`
2. **WHEN** el dueño inicia sesión con toques en el viewport de tablet **THE SYSTEM SHALL** llevarlo a `/taller` con el `h1` `Taller` y el texto exacto `Dueño` visible
3. **WHEN** el mecánico con sesión pide `/admin` **THE SYSTEM SHALL** responder 403
4. **WHEN** `node -p` lee `scripts['test:tablet']` y `scripts.gate` de `package.json` **THE SYSTEM SHALL** obtener `playwright test` y `pnpm check && pnpm test && pnpm build && pnpm test:build && pnpm test:tablet && pnpm smoke`
5. **WHEN** se lee `.env.example` **THE SYSTEM SHALL** contener la línea `E2E_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/vector_bikes_e2e`

**Verify**

```bash
test "$(node -p "require('./package.json').scripts['test:tablet']")" = "playwright test"   # expect: exit 0
test "$(node -p "require('./package.json').scripts.gate")" = "pnpm check && pnpm test && pnpm build && pnpm test:build && pnpm test:tablet && pnpm smoke"   # expect: exit 0
grep -qx 'E2E_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/vector_bikes_e2e' .env.example   # expect: exit 0
pnpm build && pnpm test:tablet e2e/login.spec.ts   # expect: exit 0, 0 failed
pnpm format && pnpm gate   # expect: exit 0
```

**Checkpoint**

```bash
git add -A && git commit -m "feat: f1-06 add taller area and tablet test harness" && git tag f1-06
git tag -l f1-06 | grep -qx f1-06   # expect: exit 0
```

### `E1-T7` — F1-07 Add user management and audit log

**Depends on:** `E1-T6` · **Priority:** p0

1. `src/server/db/schema-taller.ts` (nuevo; importa `branches`, `users`, `createdAt`, `updatedAt` de `./schema.ts`): `auditLog` y `export const tallerTables = [auditLog] as const`. Generate (solo `CREATE TABLE audit_log`) → migrate.
2. `src/server/taller/audit.ts`: `type AuditAction` con la lista completa de la fase (ninguna épica edita este archivo): `user.created`, `user.deactivated`, `user.activated`, `user.role_changed`, `user.password_reset`, `catalog.service_created`, `catalog.service_updated`, `catalog.price_changed`, `order.created`, `order.updated`, `order.status_changed`, `order.assigned`, `order.tax_document`, `order.delivery_date_confirmed`, `order.warranty_opened`, `order.delivered`, `item.added`, `item.price_changed`, `item.voided`, `approval.created`, `approval.link_regenerated`, `approval.decided`, `qc.approved`, `qc.rejected`, `payment.recorded`, `payment.voided`, `component.installed`, `component.voided`, `report.generated`. `redactDetails` reemplaza por `"[redactado]"` (recursivo) toda clave que coincida con `/email|correo|phone|telefono|rut|token|password|clave/i`. `recordAudit(db, entry, now)`; `listAudit(db, branchId, limit = 100)` con el nombre del actor.
3. `src/server/taller/users.ts`: `userCreateSchema` (nombre 2–80, correo, rol `z.enum(ROLES)`, clave 12–1024); `listUsers`, `createUser`, `setUserActive`, `changeUserRole`, `resetUserPassword`. Cada una: `users.manage` o `forbidden`; sobre sí mismo → `self_change`; correo repetido → `email_taken`; sin ningún owner activo → `last_owner`. Transacción con `recordAudit` (entity `users`, `details` `{ role, previousRole }`); desactivar y resetear llaman `revokeUserSessions` en la misma transacción.
4. `src/pages/taller/usuarios.astro`: solo `users.manage`; POST con `isAllowedOrigin` y `accion` (`crear`, `rol`, `desactivar`, `activar`, `clave`); tabla densa con formularios por fila; abajo "Registro de auditoría" (`listAudit`).
5. `tests/integration/users-admin.test.ts`: los cinco criterios.

**Files**
- `src/server/db/schema-taller.ts` — new
- `src/server/taller/audit.ts` — new
- `src/server/taller/users.ts` — new
- `src/pages/taller/usuarios.astro` — new
- `tests/integration/users-admin.test.ts` — new

**Acceptance**

1. **WHEN** el dueño crea un usuario rol `mechanic` con clave de al menos 12 caracteres **THE SYSTEM SHALL** insertarlo activo en la sucursal del dueño, de modo que `loginAdmin` con esas credenciales devuelve `ok: true`
2. **WHEN** un usuario `admin` llama `createUser` **THE SYSTEM SHALL** devolver `{ ok: false, code: "forbidden" }` sin insertar filas
3. **WHEN** el dueño desactiva un usuario o le resetea la clave **THE SYSTEM SHALL** revocar todas las sesiones abiertas de ese usuario
4. **WHEN** el dueño intenta desactivarse o cambiar su propio rol **THE SYSTEM SHALL** devolver `{ ok: false, code: "self_change" }`
5. **WHEN** se crea, desactiva, cambia de rol o resetea la clave de un usuario **THE SYSTEM SHALL** escribir una fila en `audit_log` con `actor_user_id`, `action`, `entity = 'users'` y `details` sin correos ni claves

**Verify**

```bash
pnpm test tests/integration/users-admin.test.ts   # expect: exit 0, 0 failed
pnpm db:migrate   # expect: exit 0
pnpm db:check   # expect: exit 0
pnpm format && pnpm gate   # expect: exit 0
```

**Checkpoint**

```bash
git add -A && git commit -m "feat: f1-07 add user management and audit log" && git tag f1-07
git tag -l f1-07 | grep -qx f1-07   # expect: exit 0
```

### `E1-T8` — F1-08 Add image storage layer (local and Replit)

**Depends on:** `E1-T2` · **Priority:** p0

**Verificado el 2026-10-05 por el hilo principal:** los tipos de `@replit/object-storage@1.0.0` encajan en `ReplitClientLike` (`Result` = `{ ok: true, value } | { ok: false, error }`; `uploadFromBytes` y `delete` → `Result<null>`, `downloadAsBytes` → `Result<[Buffer]>`, `exists` → `Result<boolean>`; `ClientOptions.bucketId` opcional) y sharp 0.35.5 conserva la orientación 6 con `withMetadata({ orientation: 6 })`. También verificado: bajo pnpm 12.4.2, `pnpm add -w …` del Bootstrap deja `@img/sharp-linux-x64` y `@img/sharp-libvips-linux-x64` en `pnpm-lock.yaml`.

1. `src/lib/env.ts` → `getStorageEnv(source = process.env)`: cadenas vacías como ausentes (`z.preprocess`); `STORAGE_DRIVER` `z.enum(["local", "replit"]).default("local")`, `STORAGE_LOCAL_DIR` default `.storage`, `STORAGE_BUCKET_ID` opcional; `superRefine`: con `REPLIT_DEPLOYMENT` definida y driver ≠ `replit` → issue en `STORAGE_DRIVER`.
2. `.env.example`, al final:
   ```text
   # Almacenamiento de fotos y firmas: local (disco, desarrollo) o replit (App Storage, producción).
   STORAGE_DRIVER=local
   STORAGE_LOCAL_DIR=.storage
   STORAGE_BUCKET_ID=
   ```
3. `src/server/storage/storage.ts`: `ObjectStorage`; `class StorageError extends Error`; `isStorageKey(key)` (`/^[a-z0-9][a-z0-9/_-]*\.(?:jpg|png)$/`, sin `..`); `createLocalStorage(dir)` (escribe a un temporal y renombra; `get` → `null` en `ENOENT`; `delete` ignora `ENOENT`); `type ReplitResult<T> = { ok: true; value: T } | { ok: false; error: unknown }` y `ReplitClientLike = { uploadFromBytes(name: string, contents: Buffer): Promise<ReplitResult<unknown>>; downloadAsBytes(name: string): Promise<ReplitResult<[Buffer]>>; delete(name: string): Promise<ReplitResult<unknown>>; exists(name: string): Promise<ReplitResult<boolean>> }`; `createReplitStorage(client)` (`get`: `exists` falso → `null`, si no `value[0]`; `ok: false` → `StorageError`); `createStorage(env = getStorageEnv())`: `local` → disco; `replit` → `const { Client } = await import("@replit/object-storage")`, `new Client(env.STORAGE_BUCKET_ID ? { bucketId: env.STORAGE_BUCKET_ID } : undefined)` y un adaptador con funciones flecha por método. `getStorage()` cachea la promesa.
4. `src/server/storage/images.ts`: `class InvalidImageError extends Error`; `PHOTO_FULL_MAX_PX = 2000`, `PHOTO_THUMB_MAX_PX = 400`; `processPhoto(input)`: `await sharp(input).metadata()` en `try` (sin formato → `InvalidImageError`); copia `sharp(input, { failOn: "error" }).rotate().resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer({ resolveWithObject: true })` (sin `withMetadata`: quita EXIF); miniatura con 400 y `quality: 70`.
5. `tests/integration/storage.test.ts`: directorio con `mkdtempSync(join(tmpdir(), "vb-storage-"))`; cliente falso en memoria; JPEG 3000×2000 con `sharp({ create: { width: 3000, height: 2000, channels: 3, background: { r: 120, g: 120, b: 120 } } }).jpeg().toBuffer()`; EXIF con `.jpeg().withMetadata({ orientation: 6 })` sobre 300×100; `Buffer.from("no es imagen")`; `getStorageEnv({ REPLIT_DEPLOYMENT: "1" })` lanza `EnvError` con `STORAGE_DRIVER` en `variables`. La prueba del driver Replit real es del checklist de lanzamiento.

**Files**
- `src/server/storage/storage.ts` — new
- `src/server/storage/images.ts` — new
- `src/lib/env.ts` — edit
- `.env.example` — edit
- `tests/integration/storage.test.ts` — new

**Acceptance**

1. **WHEN** el driver `local` guarda, lee, consulta y borra una clave en un directorio temporal **THE SYSTEM SHALL** devolver los mismos bytes y `exists` verdadero antes del borrado y `get` nulo y `exists` falso después
2. **WHEN** el driver `replit` corre con un cliente falso inyectado **THE SYSTEM SHALL** traducir `uploadFromBytes`, `downloadAsBytes`, `exists` y `delete` a la misma interfaz y lanzar `StorageError` ante un resultado `ok: false`
3. **WHEN** `processPhoto` recibe un JPEG de 3000×2000 generado con sharp **THE SYSTEM SHALL** devolver una copia completa JPEG con lado mayor ≤ 2000 px y una miniatura con lado mayor ≤ 400 px
4. **WHEN** `processPhoto` recibe un JPEG de 300×100 con orientación EXIF 6 **THE SYSTEM SHALL** devolver una copia de 100×300 sin orientación EXIF
5. **WHEN** `processPhoto` recibe bytes que no son imagen **THE SYSTEM SHALL** lanzar `InvalidImageError`
6. **WHEN** `getStorageEnv` corre con `REPLIT_DEPLOYMENT` definida y `STORAGE_DRIVER` distinto de `replit` **THE SYSTEM SHALL** lanzar `EnvError` que nombra `STORAGE_DRIVER`

**Verify**

```bash
pnpm test tests/integration/storage.test.ts   # expect: exit 0, 0 failed
grep -qx 'STORAGE_DRIVER=local' .env.example   # expect: exit 0
grep -q '@img/sharp-linux-x64' pnpm-lock.yaml   # expect: exit 0 — binario de sharp para Replit
grep -q '@img/sharp-libvips-linux-x64' pnpm-lock.yaml   # expect: exit 0
pnpm format && pnpm gate   # expect: exit 0
```

**Checkpoint**

```bash
git add -A && git commit -m "feat: f1-08 add image storage layer with local and replit drivers" && git tag f1-08
git tag -l f1-08 | grep -qx f1-08   # expect: exit 0
```

---

## Epic acceptance

1. **WHEN** el dueño legado inicia sesión por primera vez después de E1-T4 **THE SYSTEM SHALL** quedar en `users` con rol `owner` y entrar a `/taller` en el viewport de tablet (`admin-auth.test.ts`, `e2e/login.spec.ts`).
2. **WHEN** `POST /api/tareas/recordatorios` llega sin el secreto **THE SYSTEM SHALL** responder 401 (smoke).

```bash
pnpm test tests/integration/admin-auth.test.ts tests/integration/tasks.test.ts   # expect: exit 0
pnpm build && pnpm test:tablet e2e/login.spec.ts   # expect: exit 0
pnpm format && pnpm gate   # expect: exit 0
```

## Pitfalls

- **`CRON_SECRET` con mínimo en `getCronEnv`** — haría lanzar a `handleWhatsAppCron` con `CRON_SECRET=` vacío; sin mínimo.
- **Validar `TASKS_SECRET` al arrancar** — rompería el smoke y todo gate sin ese secreto.
- **Renombrar `admin_users`** — drizzle-kit preguntaría; por eso expand → copia → contract.
- **Olvidar `delete from admin_sessions where user_id is null`** en la copia o en `setAdminPassword` — el `SET NOT NULL` de F1-37 fallaría.
- **`getByText("Dueño")` sin `exact`** — también calza "Dueño E2E"; usa `{ exact: true }` sobre el elemento del rol.
- **Editar `e2e/*.ts`, `playwright.config.ts` o `drizzle.config.ts`** — los entrega `workspace/`; ninguna tarea los toca.
- **Suponer el rol `postgres`** — es el ejemplo de `.env.example`; la base usa el rol que fija `.env`.

## Before moving on

- [ ] Every task in this epic is `done` in `tasks.json`.
- [ ] Every `verify` command passed; none edited or skipped.
- [ ] Tags `f1-01` … `f1-08` existen.
- [ ] Gate passes from the project root.
- [ ] Every "Produced" contract exists with the stated signature.
- [ ] No file outside the subtree was modified.
- [ ] `.env.example` tiene `TASKS_SECRET`, `E2E_DATABASE_URL` y `STORAGE_*`.
- [ ] One commit per task, each followed by its checkpoint tag.
