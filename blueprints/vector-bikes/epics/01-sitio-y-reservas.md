# Epic 01: Sitio y reservas

> Después de esta épica existe el sitio de Vector Bikes corriendo en Replit: servidor Astro ejecutable, base Postgres migrada, motor de agenda con zonas horarias, reservas transaccionales sin dobles reservas, API pública y la landing con la isla de reserva.

| | |
|---|---|
| **Epic id** | `01-sitio-y-reservas` |
| **Tasks** | `E1-T1` … `E1-T7` (pasos 1–7 de `blueprint.md` §9) |
| **Depends on** | nothing — start here (después de §10 Bootstrap) |
| **Unlocks** | `02-operacion-y-lanzamiento` |
| **Parallel with** | ninguna (la épica 02 consume sus contratos) |

No necesitas otro archivo para ejecutar el orden y las compuertas de esta épica. **Excepción deliberada:** cuando una tarea dice "contenido exacto", el texto literal del archivo (esquema, `client.ts`, helper de PGlite, `smoke.sh`, feriados) está en el paso correspondiente de `blueprints/vector-bikes/blueprint.md` §9 y se copia de ahí sin cambios — es la única lectura de `blueprint.md` permitida, y solo de ese paso.

---

## Stack

Astro 7 (`output: "server"`, `@astrojs/node` standalone) · TypeScript 6 · Preact (una isla) · Tailwind 4 + CSS portado de `docs/design-preview.html` · Postgres 16 de Replit · Drizzle ORM (`postgres` en la app, PGlite en tests) · zod 4 · luxon · Cloudflare Turnstile · Replit Autoscale.
Package manager: `pnpm` 12.4.2 (corepack). Runtime fijado en `.nvmrc` (`24`). Las versiones están en `pnpm-lock.yaml`: léelo, no adivines.

| Task | Command |
|---|---|
| Formatear | `pnpm format` |
| Chequeo estático | `pnpm check` |
| Test (un archivo) | `pnpm test <ruta>` |
| Tests del build | `pnpm build && pnpm test:build <ruta>` |
| Smoke del servidor | `sh scripts/smoke.sh` |
| Migraciones | `pnpm db:generate` · `pnpm db:migrate` · `pnpm db:check` |
| Servicio local | Postgres del workspace de Replit (herramienta *Database*); sin `up`/`down` |

**Gate:** `pnpm check && pnpm test` pasa antes de marcar cualquier tarea como hecha (desde E1-T2; E1-T1 aún no tiene tests).

La base real la provee Replit (`DATABASE_URL` en el entorno). Los tests nunca la usan: usan PGlite con las migraciones de `drizzle/`. Nunca sustituyas la base real en `pnpm db:migrate`/`db:check`.

## Directory subtree

```
src/
  styles/global.css                 # NEW E1-T1 — tokens y CSS del prototipo
  layouts/Base.astro                # NEW E1-T1; edit E1-T6 (header/footer/WhatsApp)
  components/Landing.astro          # NEW E1-T6; edit E1-T7 (monta la isla)
  components/islands/booking-state.ts   # NEW E1-T7
  components/islands/BookingIsland.tsx  # NEW E1-T7
  pages/index.astro                 # NEW E1-T1; edit E1-T6
  pages/api/health.ts               # NEW E1-T1; edit E1-T2
  pages/api/disponibilidad.ts       # NEW E1-T5
  pages/api/reservas.ts             # NEW E1-T5
  data/feriados-cl.json             # NEW E1-T3
  lib/env.ts                        # exists (workspace) — read-only
  lib/log.ts                        # exists (workspace) — read-only
  lib/site.ts                       # NEW E1-T6
  server/db/schema.ts, client.ts    # NEW E1-T2
  server/booking/rules.ts, holidays.ts, slots.ts          # NEW E1-T3
  server/booking/tokens.ts, create-booking.ts, cancel-booking.ts   # NEW E1-T4
  server/api/turnstile.ts, handlers.ts                    # NEW E1-T5
scripts/smoke.sh                    # NEW E1-T1
drizzle/                            # generado por pnpm db:generate (E1-T2)
tests/helpers/pglite.ts             # NEW E1-T2
tests/integration/foundation.test.ts, create-booking.test.ts, concurrency.test.ts, api.test.ts
tests/unit/slots.test.ts, booking-state.test.ts
tests/build/landing.test.ts, island.test.ts
```

Todo lo que está fuera de este árbol queda fuera de alcance. Si una tarea parece requerir editar otro archivo, detente y repórtalo.

## Data model touched here

| Entity | Fields this epic adds or reads | Notes |
|---|---|---|
| `bookings` | todas las columnas de §4 | `code` único `VB-AAMMDD-HHMM` (+`-2`…); `status` confirmed/cancelled/completed/no_show; nunca se borra |
| `booking_blocks` | `booking_id`, `service_date`, `block_start`, `is_active` | índice único parcial `uq_booking_blocks_active_slot` WHERE `is_active = true` |
| `booking_days` | `service_date` (PK) | se bloquea `FOR UPDATE` en cada reserva |
| `blocked_periods` | `service_date`, `start_time`, `end_time`, `reason` | ambos tiempos nulos = día completo |
| `booking_requests` | `ip_hash`, `created_at` | rate limit de POST (5 / 10 min) |
| `admin_users`, `admin_sessions`, `login_attempts` | se crean aquí, se usan en la épica 02 | |

## Contracts

**Consumed** — ya existen, no reconstruir:

| From | Interface | Guarantee |
|---|---|---|
| workspace | `src/lib/env.ts` → `getDbEnv`, `getCancelEnv`, `getTurnstileEnv`, `getHashEnv`, `getSiteEnv`, `getEmailEnv`, `getAdminSetupEnv`, `EnvError` | Lanza `Variable de entorno faltante o inválida: <NOMBRE>` |
| workspace | `src/lib/log.ts` → `log.info/warn/error(event, fields)`, `errorMessage(e)` | JSON por línea con PII redactada |
| workspace | `tests/setup.ts` | `EMAIL_TRANSPORT=console`, secretos de prueba, `PUBLIC_SITE_URL` por defecto |

**Produced** — la épica 02 depende de estas firmas:

| Export | Signature | Used by |
|---|---|---|
| `src/server/db/client.ts` → `getDb`, `AppDb`, `pingDb`, `isUniqueViolation` | `getDb(): AppDb` | 02 |
| `src/server/db/schema.ts` → tablas, `allTables`, `Booking`, `BlockedPeriod`, `AdminUser` | Drizzle `pgTable` | 02 |
| `tests/helpers/pglite.ts` → `createTestDb` | `(): Promise<{ db: AppDb; client: PGlite; close }>` | 02 |
| `src/server/booking/slots.ts` → `localToday`, `addDays`, `localToInstant`, `gridForDate`, `computeDay`, `checkStart` | puras, `now: Date` inyectado | 02 |
| `src/server/booking/holidays.ts` → `HOLIDAYS`, `missingHolidayYears` | `(fromDate: string, days: number): string[]` | 02 |
| `src/server/booking/tokens.ts` → `newCancelToken`, `hashCancelToken` | HMAC-SHA-256 hex | 02 |
| `src/server/booking/create-booking.ts` → `createBooking` | `(db, input, now) => { ok: true; booking; cancelToken } \| { ok: false; code: "slot_unavailable" \| "phone_limit" }` | 02 |
| `src/server/booking/cancel-booking.ts` → `cancelBooking` | `(db, { bookingId, by, now }) => { ok: true; booking } \| { ok: false; code: "not_found" \| "already_cancelled" \| "not_cancellable" \| "started" }` | 02 |
| `src/server/api/handlers.ts` → `handleAvailability`, `handleCreateBooking`, `clientIp`, `hashIp`, `jsonResponse`, `errorResponse`, `normalizePhone` | `HandlerContext = { db; now; ip; fetchFn?; onCreated? }` | 02 |
| `src/lib/site.ts` → `SITE`, `whatsappHref` | datos del taller | 02 (SEO) |

## Conventions that bite in this area

- Importaciones relativas **con extensión `.ts`**; JSON con `with { type: "json" }`; tipos con `import type`. Nada de `enum`, `namespace` ni parameter properties.
- Nunca `new Date()` dentro de `src/server/**`: el reloj llega como `now`.
- La transacción de reserva: `booking_days` `FOR UPDATE` → `pg_advisory_xact_lock(hashtext(phone))` → revalidación con `checkStart` → inserts. Nada de red dentro.
- Solo constructor de consultas de Drizzle (nunca `db.query.*`): PGlite y postgres-js comparten esa API.
- Astro 7 rechaza etiquetas no-void sin cerrar. `PUBLIC_*` se hornean en el build.
- Sin `!important`; colores solo con variables de `:root`; el botón primario invierte en hover.

Reglas completas: `CLAUDE.md`. Reglas por área: `.claude/rules/database.md`, `.claude/rules/booking-engine.md`, `.claude/rules/server-api.md`, `.claude/rules/ui-design.md`.

---

## Tasks

En el mismo orden que `tasks.json`. Ese orden es el orden de construcción.

### `E1-T1` — Base del proyecto y servidor de salud

**Depends on:** nothing (§10 Bootstrap completo) · **Priority:** p0 — metadata for scope cuts, not a running order

Portar el `<style>` de `docs/design-preview.html` a `src/styles/global.css` con los cambios (a)–(h) de §9 paso 1 (sin preflight de Tailwind, `@source not` para `blueprints` y `docs`, logo como fondo desde `/brand/vector-bikes-logo.png`, `--field-border`, duraciones por variable, `scroll-padding-top`). `Base.astro` con `lang="es-CL"`, meta, canonical, fuentes `@fontsource`, enlace de salto; `index.astro` prerenderizado con el `h1` provisional; `/api/health` devolviendo `{"ok":true,"db":false}`; `scripts/smoke.sh` con el contenido exacto de §9 paso 1. No agregues dependencias.

**Files**
- `src/styles/global.css` — new
- `src/layouts/Base.astro` — new
- `src/pages/index.astro` — new
- `src/pages/api/health.ts` — new
- `scripts/smoke.sh` — new

**Acceptance**

1. **WHEN** `pnpm check` runs **THE SYSTEM SHALL** exit 0 with no Biome, `astro check` or `tsc` errors.
2. **WHEN** `pnpm build` runs **THE SYSTEM SHALL** exit 0 and write `dist/server/entry.mjs` and `dist/client/index.html`.
3. **WHEN** `dist/client/index.html` is read **THE SYSTEM SHALL** contain `lang="es-CL"` and the text `Mecánica de precisión.`
4. **WHEN** `.replit` and `package.json` are read **THE SYSTEM SHALL** both run `node dist/server/entry.mjs` with `PORT=4321`, `.replit` SHALL declare `localPort = 4321`, and `package.json` SHALL declare `pnpm@12.4.2`.
5. **WHEN** `sh scripts/smoke.sh` runs **THE SYSTEM SHALL** start `dist/server/entry.mjs`, get a `/api/health` body containing `"ok":true`, and exit 0.

**Verify**

```bash
pnpm format
pnpm check
pnpm build
test -f dist/server/entry.mjs
grep -q 'lang="es-CL"' dist/client/index.html
grep -q 'Mecánica de precisión.' dist/client/index.html
grep -q 'PORT=4321 node dist/server/entry.mjs' .replit
grep -q 'localPort = 4321' .replit
grep -q 'PORT=4321 node dist/server/entry.mjs' package.json
grep -q '^build = .*pnpm@12.4.2 install --frozen-lockfile' .replit
sh scripts/smoke.sh
```

**Checkpoint**

```bash
git add -A && git commit -m "E1-T1: base del proyecto y servidor de salud"
git tag step-01-base
git ls-files --error-unmatch pnpm-lock.yaml
```

### `E1-T2` — Entorno y base de datos

**Depends on:** E1-T1 · **Priority:** p0 — metadata for scope cuts, not a running order

Requisito previo: la base del workspace existe en la herramienta *Database* de Replit. Copiar `schema.ts` (bloque *Esquema* de §4), generar la migración con `pnpm db:generate` (no la edites ni la nombres), escribir `client.ts` y `tests/helpers/pglite.ts` con el contenido exacto de §9 paso 2, los cuatro tests de `foundation.test.ts` y el `health.ts` con `select 1`. Aplicar `pnpm db:migrate`.

**Files**
- `src/server/db/schema.ts` — new
- `src/server/db/client.ts` — new
- `tests/helpers/pglite.ts` — new
- `tests/integration/foundation.test.ts` — new
- `src/pages/api/health.ts` — edit: consulta real a la base (200/503)
- `drizzle/**` — generado por `pnpm db:generate`

**Acceptance**

1. **WHEN** `pnpm test tests/integration/foundation.test.ts` runs **THE SYSTEM SHALL** exit 0 with 0 failed, proving a missing `DATABASE_URL` is named, every table in `allTables` exists after migrations in PGlite, and a second active block on the same date and start is rejected.
2. **WHEN** `pnpm db:migrate` runs twice against `DATABASE_URL` **THE SYSTEM SHALL** exit 0 both times.
3. **WHEN** `pnpm db:check` runs **THE SYSTEM SHALL** exit 0 after confirming `select 1` and that every table created by `drizzle/*.sql` exists.
4. **WHEN** the migration emitted by `pnpm db:generate` is read **THE SYSTEM SHALL** contain the index name `uq_booking_blocks_active_slot`.
5. **WHEN** `sh scripts/smoke.sh` runs after `pnpm build` **THE SYSTEM SHALL** print a `/api/health` body containing `"db":true` and exit 0.

**Verify**

```bash
pnpm format
pnpm check
pnpm test tests/integration/foundation.test.ts
grep -q 'uq_booking_blocks_active_slot' drizzle/*.sql
pnpm db:migrate
pnpm db:migrate
pnpm db:check
pnpm build
sh scripts/smoke.sh | grep -q '"db":true'
```

**Checkpoint**

```bash
git add -A && git commit -m "E1-T2: entorno y base de datos"
git tag step-02-database
git ls-files --error-unmatch drizzle/meta/_journal.json
```

### `E1-T3` — Motor de agenda puro con zonas horarias

**Depends on:** E1-T2 · **Priority:** p0 — metadata for scope cuts, not a running order

Feriados 2026 exactos de §9 paso 3 (nunca 2027). `rules.ts` con las constantes (30 min, 4 por día, 120 min de antelación, 30 días, $15.000, horario Lun–Vie 15–20 y Sáb 10–14). `slots.ts` puro con luxon en `America/Santiago`: `localToInstant` devuelve `null` para horas locales inexistentes; `computeDay` aplica en orden closed/holiday/blocked/full/open y estados free/taken/late/noroom; `checkStart` valida un inicio. Escribe los 11 casos de `slots.test.ts` listados en §9 paso 3.

**Files**
- `src/data/feriados-cl.json` — new
- `src/server/booking/rules.ts` — new
- `src/server/booking/holidays.ts` — new
- `src/server/booking/slots.ts` — new
- `tests/unit/slots.test.ts` — new

**Acceptance**

1. **WHEN** `pnpm test tests/unit/slots.test.ts` runs **THE SYSTEM SHALL** exit 0 with 0 failed, asserting a 15:00 local booking maps to `2026-01-15T18:00:00.000Z` in summer and `2026-06-15T19:00:00.000Z` in winter.
2. **WHEN** `localToInstant("2026-09-06", "00:00")` is evaluated **THE SYSTEM SHALL** return `null`, because that local time does not exist in America/Santiago.
3. **WHEN** `computeDay` evaluates `2026-09-18` **THE SYSTEM SHALL** return `status` `holiday` with `holidayName` `Independencia Nacional`.
4. **WHEN** `computeDay` evaluates a day with `usedCount` 4 **THE SYSTEM SHALL** return `status` `full` and no blocks.
5. **WHEN** `computeDay` evaluates `retiro` for a weekday **THE SYSTEM SHALL** mark `19:30` as `noroom`.
6. **WHEN** `missingHolidayYears("2026-12-10", 30)` is evaluated **THE SYSTEM SHALL** return `["2027"]`.

**Verify**

```bash
pnpm format
pnpm check
pnpm test tests/unit/slots.test.ts
pnpm test
```

**Checkpoint**

```bash
git add -A && git commit -m "E1-T3: motor de agenda"
git tag step-03-slots
```

### `E1-T4` — Escritura transaccional de reservas

**Depends on:** E1-T3 · **Priority:** p0 — metadata for scope cuts, not a running order

`createBooking` en una transacción: upsert + `FOR UPDATE` de `booking_days`, advisory lock por teléfono, regla de 1 reserva futura por teléfono, revalidación con `checkStart`, código `VB-AAMMDD-HHMM` con sufijo `-n` si ya existe, inserts de reserva y bloques; violación única capturada fuera → `slot_unavailable`. `cancelBooking` con `FOR UPDATE`, reglas `started`/`already_cancelled`/`not_cancellable` y bloques a `is_active = false`. Tests de §9 paso 4, incluido el de 50 intentos concurrentes con teléfonos distintos.

**Files**
- `src/server/booking/tokens.ts` — new
- `src/server/booking/create-booking.ts` — new
- `src/server/booking/cancel-booking.ts` — new
- `tests/integration/create-booking.test.ts` — new
- `tests/integration/concurrency.test.ts` — new

**Acceptance**

1. **WHEN** `pnpm test tests/integration/create-booking.test.ts` runs **THE SYSTEM SHALL** exit 0 with 0 failed.
2. **WHEN** a `taller` booking is created for `2026-09-16` at `16:30` **THE SYSTEM SHALL** store code `VB-260916-1630` and exactly 1 active block.
3. **WHEN** a `retiro` booking is created **THE SYSTEM SHALL** store 2 consecutive active blocks and `pickup_fee_clp` 15000.
4. **WHEN** a date already has 4 non-cancelled bookings **THE SYSTEM SHALL** reject a fifth with `slot_unavailable`.
5. **WHEN** a booking is cancelled **THE SYSTEM SHALL** set its blocks `is_active = false` and allow a new booking in that block with code `VB-260916-1630-2`.
6. **WHEN** 50 concurrent `createBooking` calls target one block **THE SYSTEM SHALL** return exactly 1 success and 49 `slot_unavailable`, leaving 1 active block row.

**Verify**

```bash
pnpm format
pnpm check
pnpm test tests/integration/create-booking.test.ts
pnpm test tests/integration/concurrency.test.ts
pnpm test
```

**Checkpoint**

```bash
git add -A && git commit -m "E1-T4: escritura de reservas"
git tag step-04-booking-writes
```

### `E1-T5` — API pública de disponibilidad y reservas

**Depends on:** E1-T4 · **Priority:** p0 — metadata for scope cuts, not a running order

Handlers sin imports de Astro en `handlers.ts`; endpoints como envoltorios de una línea. Orden en POST: rate limit (≥ 5 en 10 min → 429 `Retry-After: 600`) → JSON + zod estricto con los mensajes en español (422 con `fields`) → Turnstile con `fetchFn` inyectable (403) → `createBooking` (409 `slot_unavailable` o `phone_limit`, o 201 con cuerpo `{code, service_date, start, end, mode, fee}`) → `onCreated` post-commit en `try/catch`. Error siempre `{ error, code, fields? }`. Teléfono normalizado a `+569XXXXXXXX`.

**Files**
- `src/server/api/turnstile.ts` — new
- `src/server/api/handlers.ts` — new
- `src/pages/api/disponibilidad.ts` — new
- `src/pages/api/reservas.ts` — new
- `tests/integration/api.test.ts` — new

**Acceptance**

1. **WHEN** `pnpm test tests/integration/api.test.ts` runs **THE SYSTEM SHALL** exit 0 with 0 failed, with Turnstile mocked and no network access.
2. **WHEN** `GET /api/disponibilidad` receives `dias=40` **THE SYSTEM SHALL** return 422 with `code` `validation_error` and a `fields.dias` entry.
3. **WHEN** `POST /api/reservas` receives a valid `taller` booking for `2026-09-16` at `16:30` **THE SYSTEM SHALL** return 201 with body `{"code":"VB-260916-1630","service_date":"2026-09-16","start":"16:30","end":"17:00","mode":"taller","fee":0}`.
4. **WHEN** Turnstile verification returns `success: false` **THE SYSTEM SHALL** return 403 with `code` `turnstile_failed` and insert no booking.
5. **WHEN** a sixth POST arrives from one IP within 10 minutes **THE SYSTEM SHALL** return 429 with header `Retry-After: 600`.
6. **WHEN** `sh scripts/smoke.sh` runs after `pnpm build` **THE SYSTEM SHALL** exit 0, proving the new endpoints do not break server startup.

**Verify**

```bash
pnpm format
pnpm check
pnpm test tests/integration/api.test.ts
pnpm test
pnpm build
sh scripts/smoke.sh
```

**Checkpoint**

```bash
git add -A && git commit -m "E1-T5: api publica"
git tag step-05-public-api
```

### `E1-T6` — Landing estática fiel al diseño aprobado

**Depends on:** E1-T1 · **Priority:** p0 — metadata for scope cuts, not a running order

Copiar estructura, clases y textos de `docs/design-preview.html` (líneas 229–445) a `Base.astro` (header, footer con enlace a `/privacidad`, WhatsApp solo si `whatsappHref(import.meta.env.PUBLIC_WHATSAPP_NUMBER)` no es `null`) y `Landing.astro` (hero con la escala de horario renderizada en servidor, cómo funciona, sección reservar con marcador `Cargando reservas…`, retiro, taller con `<h2 class="label">Taller</h2>`, preguntas). `site.ts` con los datos del taller. El test de WhatsApp calcula el número igual que Vite (`process.env` primero, luego `.env` con `parseEnv`).

**Files**
- `src/lib/site.ts` — new
- `src/layouts/Base.astro` — edit: prop `chrome`, header, footer, WhatsApp condicional
- `src/components/Landing.astro` — new
- `src/pages/index.astro` — edit: compone `Base` + `Landing`
- `tests/build/landing.test.ts` — new

**Acceptance**

1. **WHEN** `pnpm test:build tests/build/landing.test.ts` runs after `pnpm build` **THE SYSTEM SHALL** exit 0 with 0 failed.
2. **WHEN** `dist/client/index.html` is read **THE SYSTEM SHALL** contain exactly one `<h1` and the section ids `como-funciona`, `reservar`, `retiro`, `taller`, `preguntas` in that order.
3. **WHEN** `dist/client/index.html` is read **THE SYSTEM SHALL** contain the footer text `Av. Kennedy 7666, Vitacura` and the link `https://instagram.com/vector.bikes`.
4. **WHEN** `PUBLIC_WHATSAPP_NUMBER` is empty at build time **THE SYSTEM SHALL** emit no element with `class="wa"`.
5. **WHEN** `whatsappHref("+56 9 1234 5678")` is evaluated **THE SYSTEM SHALL** return `https://wa.me/56912345678`.

**Verify**

```bash
pnpm format
pnpm check
pnpm test
pnpm build
pnpm test:build tests/build/landing.test.ts
sh scripts/smoke.sh
```

**Checkpoint**

```bash
git add -A && git commit -m "E1-T6: landing estatica"
git tag step-06-landing
```

### `E1-T7` — Isla de reserva en Preact

**Depends on:** E1-T5, E1-T6 · **Priority:** p0 — metadata for scope cuts, not a running order

Reductor puro en `booking-state.ts` (sin DOM ni fetch) y componente `BookingIsland.tsx` con el marcado y los ids del formulario del prototipo (`f-nombre` … `f-ok`, campos de retiro con `hidden` en modo taller), `fetch` a `/api/disponibilidad` (14 días desde hoy en America/Santiago) y a `/api/reservas`, Turnstile explícito con reset tras cada error, errores accesibles (`aria-invalid`, `aria-describedby`, foco al primero, región viva) y los textos de carga/vacío/error de §6. `Landing.astro` monta `<BookingIsland client:visible siteKey={siteKey} />`. `formatClp` sin `toLocaleString`.

**Files**
- `src/components/islands/booking-state.ts` — new
- `src/components/islands/BookingIsland.tsx` — new
- `src/components/Landing.astro` — edit: reemplaza el marcador por la isla
- `tests/unit/booking-state.test.ts` — new
- `tests/build/island.test.ts` — new

**Acceptance**

1. **WHEN** `pnpm test tests/unit/booking-state.test.ts` runs **THE SYSTEM SHALL** exit 0 with 0 failed.
2. **WHEN** the reducer receives `submitFailed` with status 409 **THE SYSTEM SHALL** clear the selected block and set the message `El bloque ya no está disponible`.
3. **WHEN** `ticketCode("2026-09-16", "16:30")` and `formatClp(15000)` are evaluated **THE SYSTEM SHALL** return `VB-260916-1630` and `$15.000`.
4. **WHEN** `pnpm test:build tests/build/island.test.ts` runs after `pnpm build` **THE SYSTEM SHALL** find an `astro-island` whose `component-url` includes `BookingIsland` in `dist/client/index.html`.
5. **WHEN** `dist/client/index.html` is read **THE SYSTEM SHALL** contain labels `for="f-nombre"`, `for="f-tel"`, `for="f-mail"`, `for="f-bici"`, `for="f-desc"`, `for="f-comuna"` and `for="f-dir"`.

**Verify**

```bash
pnpm format
pnpm check
pnpm test tests/unit/booking-state.test.ts
pnpm test
pnpm build
pnpm test:build
sh scripts/smoke.sh
```

**Checkpoint**

```bash
git add -A && git commit -m "E1-T7: isla de reserva"
git tag step-07-booking-island
```

---

## Epic acceptance

La épica está hecha cuando cada tarea está `done` **y**:

1. **WHEN** the full unit+integration suite, the build and the build suite run **THE SYSTEM SHALL** exit 0 with 0 failed.
2. **WHEN** the built server is started by `sh scripts/smoke.sh` **THE SYSTEM SHALL** report `/api/health` with `"db":true`.

```bash
pnpm check && pnpm test && pnpm build && pnpm test:build
sh scripts/smoke.sh | grep -q '"db":true'
```

## Pitfalls

- **Nombrar la migración** — drizzle-kit elige el nombre; refiérete a "la migración que emite `pnpm db:generate`".
- **Probar concurrencia confiando en la UI** — el índice único parcial es la garantía; no quites el `try/catch` de `isUniqueViolation`.
- **Sumar 24 h a un instante** — usa `addDays` sobre fechas locales; Chile cambia de hora en abril y septiembre.
- **Leer `.env` en tests del build con `process.env` solamente** — Vite lee `.env`; replica esa precedencia en el test de WhatsApp.
- **Tailwind preflight** — no lo importes; rompe el CSS aprobado.

## Before moving on

- [ ] Every task in this epic is `done` in `tasks.json` — no task left `in_progress`.
- [ ] Every `verify` command of every task in this epic passed, not just the first one.
- [ ] No `verify` command was edited, and none was skipped because a file it names did not exist.
- [ ] **Every task in this epic has its `checkpoint` tag** — `git tag -l 'step-*'` lists `step-01-base` … `step-07-booking-island`.
- [ ] Gate command passes clean, run from the project root.
- [ ] Every "Produced" contract above exists with the stated signature.
- [ ] No file outside the subtree was modified.
- [ ] `.env.example` sin cambios (esta épica no agrega variables).
- [ ] One commit per task, each prefixed with its task id, each followed by its checkpoint tag.
