# Epic 02: Operación y lanzamiento

> Después de esta épica Vector Bikes opera solo: correos de confirmación y aviso, cancelación por enlace, panel `/admin` con sesión, recordatorios diarios, SEO y privacidad, y una compuerta final (`pnpm gate`) con runbook de lanzamiento en Replit.

| | |
|---|---|
| **Epic id** | `02-operacion-y-lanzamiento` |
| **Tasks** | `E2-T1` … `E2-T7` (pasos 8–14 de `blueprint.md` §9) |
| **Depends on** | `01-sitio-y-reservas` |
| **Unlocks** | nada — es la última épica |
| **Parallel with** | ninguna |

No necesitas otro archivo para ejecutar el orden y las compuertas de esta épica. **Excepción deliberada:** los textos legales, el `robots.txt` y el bloque que reemplaza el final de `scripts/smoke.sh` están literalmente en el paso correspondiente de `blueprints/vector-bikes/blueprint.md` §9 (pasos 13 y 14) y se copian de ahí sin cambios — única lectura permitida de `blueprint.md`, y solo de ese paso.

---

## Stack

Astro 7 (`output: "server"`, `@astrojs/node` standalone) · TypeScript 6 · Preact · Postgres 16 de Replit · Drizzle ORM (PGlite en tests) · Resend (`EMAIL_TRANSPORT=resend|console`) · `ics` · luxon · Replit Autoscale + Scheduled Deployment.
Package manager: `pnpm` 12.4.2. Runtime fijado en `.nvmrc` (`24`). Las versiones están en `pnpm-lock.yaml`: léelo, no adivines.

| Task | Command |
|---|---|
| Formatear | `pnpm format` |
| Chequeo estático | `pnpm check` |
| Test (un archivo) | `pnpm test <ruta>` |
| Tests del build | `pnpm build && pnpm test:build <ruta>` |
| Smoke | `sh scripts/smoke.sh` |
| Recordatorios | `pnpm reminders:send` |
| Compuerta completa | `pnpm gate` (nunca `pnpm ci`) |
| Servicio local | Postgres del workspace de Replit (herramienta *Database*); sin `up`/`down` |

**Gate:** `pnpm check && pnpm test` pasa antes de marcar cualquier tarea como hecha.

Los correos en tests siempre van a `consoleOutbox` (`tests/setup.ts` fuerza `EMAIL_TRANSPORT=console`). Nunca uses Resend real ni la red en una compuerta.

## Directory subtree

```
src/
  server/email/transport.ts, templates.ts, notifications.ts   # NEW E2-T1
  server/email/reminders.ts          # NEW E2-T5
  server/booking/cancel-flow.ts      # NEW E2-T2
  server/api/handlers.ts             # exists (E1-T5); edit E2-T2: isAllowedOrigin
  server/auth/admin-auth.ts          # NEW E2-T3
  server/admin/agenda.ts             # NEW E2-T4
  pages/api/reservas.ts              # exists; edit E2-T1: onCreated
  pages/reservas/cancelar.astro      # NEW E2-T2
  pages/admin/login.astro, logout.ts # NEW E2-T3
  pages/admin/index.astro, bloqueos.astro, reservas/[id].astro   # NEW E2-T4
  pages/privacidad.astro, 404.astro  # NEW E2-T6
  layouts/Base.astro                 # exists; edit E2-T6: OG + JSON-LD
  server/db/schema.ts, booking/*.ts  # exist — read-only
public/robots.txt                    # NEW E2-T6
scripts/admin-set-password.ts        # NEW E2-T3
scripts/reminders-send.ts            # NEW E2-T5
scripts/smoke.sh                     # exists; edit E2-T7
README.md                            # NEW E2-T5; edit E2-T7
tests/integration/email.test.ts, cancel-flow.test.ts, admin-auth.test.ts, admin-panel.test.ts, reminders.test.ts
tests/unit/replit-config.test.ts
tests/build/seo.test.ts, a11y.test.ts
```

Todo lo que está fuera de este árbol queda fuera de alcance. Si una tarea parece requerir editar otro archivo, detente y repórtalo.

## Data model touched here

| Entity | Fields this epic adds or reads | Notes |
|---|---|---|
| `bookings` | `status`, `cancelled_at`, `cancelled_by`, `cancel_token_hash`, `cancel_token_used_at`, `completed_at`, `reminder_sent_at` | sin columnas nuevas; nunca se borra |
| `booking_blocks` | `is_active` | `false` al cancelar |
| `blocked_periods` | todas | crear y eliminar desde `/admin/bloqueos` |
| `admin_users` | `email`, `password_hash` | scrypt `scrypt$16384$8$1$…` |
| `admin_sessions` | `token_hash`, `expires_at`, `revoked_at` | 7 días |
| `login_attempts` | `ip_hash`, `email`, `created_at` | 5 fallidos / 15 min |

## Contracts

**Consumed** — ya existen, no reconstruir:

| From | Interface | Guarantee |
|---|---|---|
| `01-sitio-y-reservas` | `createBooking(db, input, now)` | `{ ok: true; booking; cancelToken }` o `slot_unavailable`/`phone_limit` |
| `01-sitio-y-reservas` | `cancelBooking(db, { bookingId, by, now })` | libera bloques en la misma transacción |
| `01-sitio-y-reservas` | `handleAvailability(url, ctx)`, `handleCreateBooking(request, ctx)`, `clientIp`, `hashIp` | respuestas con la forma de error `{ error, code, fields? }`; `ctx.onCreated` se llama post-commit |
| `01-sitio-y-reservas` | `hashCancelToken(token)`, `localToday`, `addDays`, `missingHolidayYears`, `HORIZON_DAYS` | puras |
| `01-sitio-y-reservas` | `createTestDb()`, `getDb()`, `AppDb`, `SITE` | PGlite con migraciones; datos del taller |
| workspace | `getEmailEnv`, `getSiteEnv`, `getAdminSetupEnv`, `log` | fallan nombrando la variable |

**Produced** — contratos finales del producto:

| Export | Signature | Used by |
|---|---|---|
| `src/server/email/transport.ts` → `createTransport`, `consoleOutbox`, `EmailMessage` | `(env?) => EmailTransport` | notificaciones, recordatorios, tests |
| `src/server/email/notifications.ts` → `notifyBookingCreated`, `notifyBookingCancelled`, `buildIcs` | `(booking, cancelToken, deps?)` / `(booking, deps?)` | `/api/reservas`, cancelación |
| `src/server/api/handlers.ts` → `isAllowedOrigin` | `(request, siteUrl?) => boolean` | cancelación y todo POST admin |
| `src/server/auth/admin-auth.ts` → `requireAdmin`, `loginAdmin`, `logoutAdmin`, `setAdminPassword`, `SESSION_COOKIE` | ver E2-T3 | páginas admin, script |
| `src/server/email/reminders.ts` → `sendReminders` | `(db, now, deps?) => { sent; failed }` | Scheduled Deployment |
| `scripts/smoke.sh` | salida 0 con salud, 200/404/303 | `pnpm gate` |

## Conventions that bite in this area

- Ningún correo dentro de una transacción; un fallo de correo se registra (`email.failed`) y nunca cambia el 201 ni revierte la cancelación.
- Todo POST con efecto llama `isAllowedOrigin(request)` antes de leer el formulario; toda página admin empieza con `requireAdmin` y redirige 303.
- Fechas en correos con luxon en `America/Santiago`; en tests se afirman horas `HH:mm`, códigos y montos, nunca nombres de días (dependen de ICU).
- `PUBLIC_*` se hornean en el build: cambiar WhatsApp o Turnstile exige republicar.
- `pnpm db:migrate` jamás contra producción; la app nunca migra.

Reglas completas: `CLAUDE.md`. Reglas por área: `.claude/rules/server-api.md`, `.claude/rules/booking-engine.md`, `.claude/rules/database.md`, `.claude/rules/ui-design.md`.

---

## Tasks

En el mismo orden que `tasks.json`. Ese orden es el orden de construcción.

### `E2-T1` — Correos transaccionales con transporte intercambiable

**Depends on:** E1-T5 · **Priority:** p0 — metadata for scope cuts, not a running order

Transporte `console` (a `consoleOutbox`) y `resend` (SDK, `replyTo`, adjunto base64). Cuatro plantillas en español con `escapeHtml` (confirmación con enlace `Cancelar mi reserva` y texto de trabajos extra; aviso al taller; recordatorio; cancelación al taller). `notifyBookingCreated` adjunta `reserva-vector-bikes.ics` generado con `ics` en UTC y arma `cancelUrl` desde `PUBLIC_SITE_URL`. `reservas.ts` pasa `onCreated`. `reminders.ts` (E2-T5) no debe importar `notifications.ts`.

**Files**
- `src/server/email/transport.ts` — new
- `src/server/email/templates.ts` — new
- `src/server/email/notifications.ts` — new
- `src/pages/api/reservas.ts` — edit: `onCreated: notifyBookingCreated`
- `tests/integration/email.test.ts` — new

**Acceptance**

1. **WHEN** `pnpm test tests/integration/email.test.ts` runs **THE SYSTEM SHALL** exit 0 with 0 failed and no network access.
2. **WHEN** a booking is created through `handleCreateBooking` **THE SYSTEM SHALL** return 201 and then queue exactly 2 messages: one to the customer and one to `info@vectorbikes.cl`.
3. **WHEN** the customer confirmation is built **THE SYSTEM SHALL** attach `reserva-vector-bikes.ics` containing `BEGIN:VCALENDAR` and include a link containing `/reservas/cancelar?token=`.
4. **WHEN** customer-provided text contains `<script>` **THE SYSTEM SHALL** render it escaped as `&lt;script&gt;` in email HTML.
5. **WHEN** `notifyBookingCancelled` runs **THE SYSTEM SHALL** queue 1 message to `info@vectorbikes.cl` whose subject contains `Reserva cancelada`.

**Verify**

```bash
pnpm format
pnpm check
pnpm test tests/integration/email.test.ts
pnpm test
pnpm build
sh scripts/smoke.sh
```

**Checkpoint**

```bash
git add -A && git commit -m "E2-T1: correos"
git tag step-08-emails
```

### `E2-T2` — Cancelación con token de un solo uso

**Depends on:** E2-T1 · **Priority:** p0 — metadata for scope cuts, not a running order

`isAllowedOrigin` en `handlers.ts` (Origin == origin de `PUBLIC_SITE_URL`). `viewCancellation` y `performCancellation` buscan por HMAC del token; vistas `invalid`/`cancelled`/`started`/`confirm`/`done`; la cancelación llama `cancelBooking` con `by: "customer"` y después notifica al taller. `cancelar.astro` (noindex): GET muestra resumen y formulario POST con token oculto; POST verifica Origin (403) y cancela; token inexistente responde 404.

**Files**
- `src/server/api/handlers.ts` — edit: `isAllowedOrigin`
- `src/server/booking/cancel-flow.ts` — new
- `src/pages/reservas/cancelar.astro` — new
- `tests/integration/cancel-flow.test.ts` — new

**Acceptance**

1. **WHEN** `pnpm test tests/integration/cancel-flow.test.ts` runs **THE SYSTEM SHALL** exit 0 with 0 failed.
2. **WHEN** a customer confirms cancellation with a valid token before the booking starts **THE SYSTEM SHALL** set `status` `cancelled`, `cancelled_by` `customer`, set `cancel_token_used_at`, deactivate its blocks, and queue 1 email to `info@vectorbikes.cl`.
3. **WHEN** the same cancellation token is submitted a second time **THE SYSTEM SHALL** return the `cancelled` view, write no rows and send no email.
4. **WHEN** the booking has already started **THE SYSTEM SHALL** return the `started` view and keep `status` `confirmed`.
5. **WHEN** a POST carries an `Origin` different from the origin of `PUBLIC_SITE_URL` **THE SYSTEM SHALL** reject it (`isAllowedOrigin` returns `false`).

**Verify**

```bash
pnpm format
pnpm check
pnpm test tests/integration/cancel-flow.test.ts
pnpm test
pnpm build
sh scripts/smoke.sh
```

**Checkpoint**

```bash
git add -A && git commit -m "E2-T2: cancelacion"
git tag step-09-cancellation
```

### `E2-T3` — Acceso admin con sesión propia

**Depends on:** E2-T2 · **Priority:** p0 — metadata for scope cuts, not a running order

scrypt (N=16384, r=8, p=1, 64 bytes, sal 16 bytes) con `timingSafeEqual`; sesiones de 7 días con token de 32 bytes guardado como sha256; login con rate limit 5 fallidos por `ip_hash`+correo en 15 min (evaluado antes de la clave) y hash ficticio para correos inexistentes; cookie `vb_admin_session` httpOnly, SameSite Lax, `Secure` si el sitio es https. Páginas `login.astro` (401/429 con `role="alert"`, pegar permitido) y `logout.ts` (POST con Origin). El script lee `ADMIN_EMAIL`/`ADMIN_PASSWORD` antes de tocar la base y revoca sesiones al actualizar.

**Files**
- `src/server/auth/admin-auth.ts` — new
- `src/pages/admin/login.astro` — new
- `src/pages/admin/logout.ts` — new
- `scripts/admin-set-password.ts` — new
- `tests/integration/admin-auth.test.ts` — new

**Acceptance**

1. **WHEN** `pnpm test tests/integration/admin-auth.test.ts` runs **THE SYSTEM SHALL** exit 0 with 0 failed.
2. **WHEN** a stored password hash is created **THE SYSTEM SHALL** use the format prefix `scrypt$16384$8$1$` and verify only the original password.
3. **WHEN** 5 failed logins for one IP hash and email occur within 15 minutes **THE SYSTEM SHALL** return `rate_limited` on the next attempt even with the correct password.
4. **WHEN** `setAdminPassword` updates an existing admin **THE SYSTEM SHALL** revoke that admin's existing sessions.
5. **WHEN** `scripts/admin-set-password.ts` runs without `ADMIN_EMAIL` **THE SYSTEM SHALL** print `Variable de entorno faltante o inválida: ADMIN_EMAIL` and not touch the database.

**Verify**

```bash
pnpm format
pnpm check
pnpm test tests/integration/admin-auth.test.ts
env -u ADMIN_EMAIL -u ADMIN_PASSWORD node scripts/admin-set-password.ts 2>&1 | grep -q 'Variable de entorno faltante o inválida: ADMIN_EMAIL'
pnpm test
pnpm build
sh scripts/smoke.sh
```

**Checkpoint**

```bash
git add -A && git commit -m "E2-T3: acceso admin"
git tag step-10-admin-auth
```

### `E2-T4` — Panel admin: agenda, acciones y bloqueos

**Depends on:** E2-T3 · **Priority:** p0 — metadata for scope cuts, not a running order

`agenda.ts`: agenda por fecha (todas las reservas ordenadas por `starts_at`), detalle, acciones `cancelar` (vía `cancelBooking` con `by: "admin"`, sin correo), `completar` y `no_show` solo desde `confirmed`, crear/eliminar bloqueos con validación zod, y `holidayWarning` cuando el horizonte de 30 días entra en un año sin feriados. Tres páginas server-rendered, noindex, que empiezan con `requireAdmin` (303 a `/admin/login`) y validan Origin en cada POST (patrón PRG con 303). Teléfono como enlace `tel:`.

**Files**
- `src/server/admin/agenda.ts` — new
- `src/pages/admin/index.astro` — new
- `src/pages/admin/reservas/[id].astro` — new
- `src/pages/admin/bloqueos.astro` — new
- `tests/integration/admin-panel.test.ts` — new

**Acceptance**

1. **WHEN** `pnpm test tests/integration/admin-panel.test.ts` runs **THE SYSTEM SHALL** exit 0 with 0 failed.
2. **WHEN** the admin cancels a confirmed booking **THE SYSTEM SHALL** set `status` `cancelled`, `cancelled_by` `admin` and deactivate its blocks.
3. **WHEN** the admin marks a cancelled booking as completed **THE SYSTEM SHALL** return `invalid_transition` and change nothing.
4. **WHEN** a full-day block exists for `2026-09-22` **THE SYSTEM SHALL** report that day as `blocked` in availability, and as `open` again after the block is deleted.
5. **WHEN** the 30-day horizon from `2026-12-10` reaches 2027 **THE SYSTEM SHALL** return a holiday warning containing `2027`.

**Verify**

```bash
pnpm format
pnpm check
pnpm test tests/integration/admin-panel.test.ts
pnpm test
pnpm build
sh scripts/smoke.sh
```

**Checkpoint**

```bash
git add -A && git commit -m "E2-T4: panel admin"
git tag step-11-admin-panel
```

### `E2-T5` — Recordatorios idempotentes y configuración Replit

**Depends on:** E2-T1 · **Priority:** p1 — metadata for scope cuts, not a running order

`sendReminders` selecciona reservas confirmadas de mañana (fecha local) sin `reminder_sent_at`, envía y marca con `update … where reminder_sent_at is null`; una segunda corrida envía 0. El script imprime `{"ok":…,"sent":…,"failed":…}` y termina con `process.exit`. `replit-config.test.ts` verifica `.replit` y `package.json`. `README.md` documenta desarrollo, base de datos y la Scheduled Deployment (cron `0 10 * * *`, zona America/Santiago, run `corepack pnpm reminders:send`, secretos propios, alternativa de segunda Replit App).

**Files**
- `src/server/email/reminders.ts` — new
- `scripts/reminders-send.ts` — new
- `tests/integration/reminders.test.ts` — new
- `tests/unit/replit-config.test.ts` — new
- `README.md` — new

**Acceptance**

1. **WHEN** `pnpm test tests/integration/reminders.test.ts` runs **THE SYSTEM SHALL** exit 0 with 0 failed.
2. **WHEN** `sendReminders` runs for the first time with two confirmed bookings for tomorrow, one cancelled one and one for the day after **THE SYSTEM SHALL** send exactly 2 reminders and set `reminder_sent_at` only on those 2.
3. **WHEN** `sendReminders` runs a second time **THE SYSTEM SHALL** send 0 reminders.
4. **WHEN** `pnpm test tests/unit/replit-config.test.ts` runs **THE SYSTEM SHALL** confirm `.replit` builds with `pnpm install --frozen-lockfile` and runs `node dist/server/entry.mjs` with `HOST=0.0.0.0` on local port 4321.
5. **WHEN** `pnpm reminders:send` runs twice against `DATABASE_URL` **THE SYSTEM SHALL** print `"ok":true` both times and `"sent":0` the second time.

**Verify**

```bash
pnpm format
pnpm check
pnpm test tests/integration/reminders.test.ts
pnpm test tests/unit/replit-config.test.ts
pnpm reminders:send | grep -q '"ok":true'
pnpm reminders:send | grep -q '"sent":0'
test -f README.md
pnpm test
```

**Checkpoint**

```bash
git add -A && git commit -m "E2-T5: recordatorios y replit"
git tag step-12-reminders-replit
```

### `E2-T6` — SEO, aviso de privacidad y página 404

**Depends on:** E1-T6 · **Priority:** p1 — metadata for scope cuts, not a running order

`/privacidad` prerenderizada con las secciones de §9 paso 13 (Ley 19.628 y 21.719); `404.astro` con noindex; `public/robots.txt` exacto; `Base.astro` agrega Open Graph y, solo en `/`, JSON-LD `LocalBusiness` con dirección, horarios (Lun–Vie 15:00–20:00, Sáb 10:00–14:00), correo e Instagram. El test del build usa `site = process.env.PUBLIC_SITE_URL || "https://vectorbikes.cl"`, la misma regla que `astro.config.mjs`.

**Files**
- `src/pages/privacidad.astro` — new
- `src/pages/404.astro` — new
- `public/robots.txt` — new
- `src/layouts/Base.astro` — edit: Open Graph y JSON-LD
- `tests/build/seo.test.ts` — new

**Acceptance**

1. **WHEN** `pnpm test:build tests/build/seo.test.ts` runs after `pnpm build` **THE SYSTEM SHALL** exit 0 with 0 failed.
2. **WHEN** `dist/client/index.html` is read **THE SYSTEM SHALL** contain one JSON-LD block of `@type` `LocalBusiness` with address `Avenida Kennedy 7666`, `Vitacura`, `CL` and two opening-hours entries.
3. **WHEN** the sitemap is generated **THE SYSTEM SHALL** list `/` and `/privacidad` and exclude `/admin` and `/reservas`.
4. **WHEN** `dist/client/robots.txt` is read **THE SYSTEM SHALL** contain `Disallow: /admin` and `Disallow: /reservas/cancelar`.
5. **WHEN** `dist/client/404.html` is read **THE SYSTEM SHALL** contain `Página no encontrada` and a `noindex` robots meta.

**Verify**

```bash
pnpm format
pnpm check
pnpm test
pnpm build
pnpm test:build tests/build/seo.test.ts
pnpm test:build
sh scripts/smoke.sh
```

**Checkpoint**

```bash
git add -A && git commit -m "E2-T6: seo privacidad 404"
git tag step-13-seo-privacy
```

### `E2-T7` — Compuerta final, smoke ampliado y runbook

**Depends on:** E1-T7, E2-T4, E2-T5, E2-T6 · **Priority:** p0 — metadata for scope cuts, not a running order

`a11y.test.ts` con los 7 chequeos estáticos por regex sobre el HTML y el CSS construidos (lang, un `h1`, niveles sin saltos, `alt`, enlace de salto, `label for` en el formulario, `:focus-visible` y `prefers-reduced-motion`). Reemplazar el final de `scripts/smoke.sh` por el bloque exacto de §9 paso 14 (salud con `"db":true`, 200/404/303 con `test` de códigos). `README.md` gana `## Lanzamiento` con el runbook de Replit, DNS en cPanel (A + TXT permanente), Resend en `send.vectorbikes.cl`, Microsoft 365 intacto, Turnstile real, WhatsApp, supresión de datos y feriados 2027.

**Files**
- `tests/build/a11y.test.ts` — new
- `scripts/smoke.sh` — edit: chequeos HTTP ampliados
- `README.md` — edit: `## Lanzamiento`

**Acceptance**

1. **WHEN** `pnpm test:build tests/build/a11y.test.ts` runs after `pnpm build` **THE SYSTEM SHALL** exit 0 with 0 failed.
2. **WHEN** `sh scripts/smoke.sh` runs **THE SYSTEM SHALL** get `/api/health` with `"db":true`, HTTP 200 from `/` and `/api/disponibilidad`, 404 from an unknown path and from an unknown cancellation token, and 303 from `/admin` without a session.
3. **WHEN** `pnpm gate` runs **THE SYSTEM SHALL** exit 0, running Biome, `astro check`, `tsc --noEmit`, the unit+integration suite, the build, the build suite and the smoke test.
4. **WHEN** `pnpm install --frozen-lockfile` runs **THE SYSTEM SHALL** exit 0 without modifying `pnpm-lock.yaml`.
5. **WHEN** `README.md` is read **THE SYSTEM SHALL** contain the sections `## Recordatorios (Scheduled Deployment)` and `## Lanzamiento`.

**Verify**

```bash
pnpm format
pnpm install --frozen-lockfile
pnpm build
pnpm test:build tests/build/a11y.test.ts
grep -q '^## Recordatorios (Scheduled Deployment)' README.md
grep -q '^## Lanzamiento' README.md
pnpm gate
```

**Checkpoint**

```bash
git add -A && git commit -m "E2-T7: compuerta final"
git tag step-14-final-gate
test "$(git tag -l 'step-*' | wc -l | tr -d ' ')" = 14
```

---

## Epic acceptance

La épica está hecha cuando cada tarea está `done` **y**:

1. **WHEN** `pnpm gate` runs from the project root with `blueprints/vector-bikes/` present **THE SYSTEM SHALL** exit 0.
2. **WHEN** `pnpm reminders:send` runs a second time on the same day **THE SYSTEM SHALL** print `"sent":0`.

```bash
pnpm gate
pnpm reminders:send | grep -q '"sent":0'
```

## Pitfalls

- **Enviar correo dentro de la transacción** — deja reservas bloqueadas esperando a Resend; notifica después del commit.
- **Confiar en `security.checkOrigin` de Astro** — está desactivado a propósito (proxy de Replit); usa `isAllowedOrigin`.
- **Olvidar `process.exit` en scripts** — el pool de `postgres` mantiene vivo el proceso y la Scheduled Deployment no termina.
- **Afirmar nombres de días en correos** — dependen de ICU; afirma `HH:mm`, código y monto.
- **`pnpm ci`** — es un comando de pnpm; la compuerta es `pnpm gate`.

## Before moving on

- [ ] Every task in this epic is `done` in `tasks.json` — no task left `in_progress`.
- [ ] Every `verify` command of every task in this epic passed, not just the first one.
- [ ] No `verify` command was edited, and none was skipped because a file it names did not exist.
- [ ] **Every task in this epic has its `checkpoint` tag** — `git tag -l 'step-*'` lists `step-08-emails` … `step-14-final-gate`.
- [ ] Gate command passes clean, run from the project root.
- [ ] Every "Produced" contract above exists with the stated signature.
- [ ] No file outside the subtree was modified.
- [ ] `.env.example` sin cambios (todas las variables ya estaban declaradas desde el Bootstrap).
- [ ] One commit per task, each prefixed with its task id, each followed by its checkpoint tag.
