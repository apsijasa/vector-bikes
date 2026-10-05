# Vector Bikes

Sitio y reservas en línea del taller de bicicletas Vector Bikes (Av. Kennedy 7666, Vitacura): landing Astro, isla Preact de reserva, API, panel `/admin` y recordatorios, en Replit.

## Comandos

| Tarea | Comando |
|---|---|
| Instalar | `pnpm install --frozen-lockfile` |
| Dev | `pnpm dev` — http://localhost:4321 |
| Formatear | `pnpm format` |
| Chequeo estático | `pnpm check` (biome ci + astro check + tsc --noEmit) |
| Tests unit + integración | `pnpm test` · un archivo: `pnpm test tests/unit/slots.test.ts` |
| Build | `pnpm build` |
| Tests sobre el build | `pnpm test:build` (requiere `pnpm build` antes) |
| Smoke del servidor | `pnpm smoke` (= `sh scripts/smoke.sh`) |
| Compuerta completa | `pnpm gate` (nunca `pnpm ci`: es un comando propio de pnpm) |
| Generar migración | `pnpm db:generate` |
| Aplicar migraciones (solo base dev) | `pnpm db:migrate` |
| Verificar base | `pnpm db:check` |
| Clave admin | `ADMIN_EMAIL=… ADMIN_PASSWORD=… pnpm admin:set-password` |
| Recordatorios | `pnpm reminders:send` |

**Compuerta:** `pnpm gate` pasa antes de marcar cualquier tarea como hecha y antes de publicar. Antes de cada Verify, `pnpm format`.

Node 24 (`.nvmrc`), pnpm 12.4.2. La versión de pnpm se fija en el `build` de `[deployment]` en `.replit` (`corepack pnpm@12.4.2 …`), no en `packageManager`: Replit reescribe `package.json` al publicar y, si el campo existe, su instalación con pnpm 10 intenta autoinstalar pnpm 12 y aborta. No agregues `packageManager` a `package.json`. Las versiones exactas están en `pnpm-lock.yaml`: léelo, no adivines.

## Estado del build

Orden de construcción: `blueprints/vector-bikes/tasks.json` (una tarea = un paso) y `blueprints/vector-bikes/epics/`. Decisiones: `blueprints/vector-bikes/blueprint.md`. Diseño visual aprobado: `docs/design-preview.html`.

## Stack

Astro 7 (output server, @astrojs/node standalone) · TypeScript 6 · Preact (1 isla) · Tailwind 4 + CSS portado del prototipo · Postgres 16 de Replit · Drizzle ORM · sesión admin propia · Resend · Cloudflare Turnstile · Replit Autoscale + Scheduled Deployment.

## Arquitectura

**Camino de una reserva.** navegador → `src/components/islands/BookingIsland.tsx` → `POST /api/reservas` (`src/pages/api/reservas.ts`, envoltorio) → `handleCreateBooking` en `src/server/api/handlers.ts` (rate limit → zod → Turnstile) → `createBooking` en `src/server/booking/create-booking.ts` (transacción: lock de `booking_days`, advisory lock por teléfono, revalidación con `src/server/booking/slots.ts`, insert de `bookings` + `booking_blocks`) → commit → `notifyBookingCreated` en `src/server/email/notifications.ts` → 201.

**Fronteras.**

| Capa | Puede importar | Nunca |
|---|---|---|
| `src/pages/**` | `server`, `lib`, `components`, `layouts` | SQL propio o lógica de negocio |
| `src/components/**` | otros componentes, `booking-state.ts` | `src/server/**` (habla por `fetch` a `/api/*`) |
| `src/server/**` | `src/server/**`, `src/lib/**`, `src/data/**` | `astro`, `astro:*`, componentes |
| `src/lib/**` | paquetes npm | `src/server/**`, `astro` |
| `scripts/**` | `src/server/**`, `src/lib/**` | `astro` |
| `tests/**` | todo lo anterior | red real |

**Dónde vive cada cosa.**

| Tema | Única fuente de verdad |
|---|---|
| Esquema | `src/server/db/schema.ts` → `pnpm db:generate` → `pnpm db:migrate` |
| Conexión | `src/server/db/client.ts` (`getDb()`, tipo `AppDb`); los módulos reciben `db` como argumento |
| Entorno | `src/lib/env.ts` (accesores por funcionalidad); nunca `process.env` en otro lado |
| Reglas del negocio | `src/server/booking/rules.ts` |
| Feriados | `src/data/feriados-cl.json` |
| Datos del taller | `src/lib/site.ts` |
| Tokens de diseño | `src/styles/global.css` (`:root`) |
| Logs | `src/lib/log.ts` |

## Reglas de código

1. Importaciones relativas con extensión `.ts`/`.tsx` explícita (`../db/client.ts`). Sin alias, sin barrels.
2. Nada de `enum`, `namespace` ni parameter properties (`erasableSyntaxOnly`): Node ejecuta `scripts/` quitando tipos.
3. Importaciones solo de tipos con `import type` (`verbatimModuleSyntax`).
4. La lógica de `src/server/**` recibe `db: AppDb` y `now: Date`; nunca `new Date()` dentro de la lógica.
5. Toda entrada externa pasa por zod antes de tocar `src/server/**`.
6. Ningún correo, `fetch` ni espera larga dentro de una transacción.
7. Archivos < 400 líneas, funciones < 50 líneas. **Única excepción: `src/styles/global.css`** — es el diseño aprobado portado desde `docs/design-preview.html` y partirlo fragmentaría el sistema visual; su tamaño lo fija el prototipo, no el autor.
8. Textos para el usuario en español de Chile; identificadores en inglés.
9. Todo elemento no-void cerrado en `.astro` (Astro 7 falla si no).
10. `set:html` solo para el JSON-LD de `Base.astro`.

## Sistema de diseño

Fuente: `docs/design-preview.html`. Monocromo, reglas de 1px, radio 2px, sin sombras.

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `--ground` | #F6F6F4 | #0C0D0E | Fondo |
| `--surface` | #FFFFFF | #151618 | Controles, ticket |
| `--ink` | #0C0D0E | #F1F1EE | Texto, botón primario, foco |
| `--ink-2` | #2A2C2F | #C8C9CB | Texto secundario |
| `--steel` | #5A5E63 | #9C9FA4 | Etiquetas, ayudas |
| `--rule` | #D9D9D5 | #2B2D30 | Divisores (solo decorativos) |
| `--hatch` | #E3E3DF | #1E2022 | Rayado reservado/deshabilitado |
| `--on-ink` | #F6F6F4 | #0C0D0E | Texto sobre `--ink` |
| `--field-border` | = `--steel` | = `--steel` | Bordes de controles |

- **Tipos:** Michroma 400 (h1/h2, con moderación) · Archivo Variable 400/600, cuerpo 16px/1.55 · IBM Plex Mono 400/500, etiquetas .72rem mayúsculas tracking .14em, `tabular-nums`.
- **Botón primario:** `--ink` + `--on-ink`; **hover invierte** (fondo `--surface`, texto y borde `--ink`). Nav: `.nav a:not(.btn)`.
- **Formularios:** etiqueta arriba; `.fields{align-items:start}`, `.field{align-content:start}`.
- **Movimiento:** `--dur-fast` 140ms, `--dur` 160ms, máx. 250ms, `--ease: cubic-bezier(.2,.7,.2,1)`; `prefers-reduced-motion` → 0ms.
- **Layout:** `.wrap` máx. 1180px; objetivos táctiles ≥ 44px.

## Entorno

| Variable | Requerida desde | Usada por |
|---|---|---|
| `DATABASE_URL` | paso 2 | `client.ts`, scripts |
| `CANCEL_TOKEN_SECRET` | paso 4 | `tokens.ts` |
| `TURNSTILE_SECRET_KEY`, `SESSION_SECRET` | paso 5 | `handlers.ts` |
| `PUBLIC_WHATSAPP_NUMBER` (opcional) | paso 6 | `Base.astro` (build) |
| `PUBLIC_TURNSTILE_SITE_KEY` | paso 7 | `index.astro` (build) |
| `PUBLIC_SITE_URL`, `EMAIL_TRANSPORT`, `EMAIL_FROM`, `EMAIL_REPLY_TO`, `SHOP_NOTIFY_EMAIL` | paso 8 | correos, chequeo de Origin |
| `RESEND_API_KEY` | paso 8, solo con `resend` | `transport.ts` |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | solo el script | `admin-set-password.ts` |

`.env.example` se commitea y se mantiene al día. En Replit, los valores reales van en *Secrets*.

## Reglas diferidas

| Archivo | Aplica a |
|---|---|
| `.claude/rules/database.md` | `src/server/db/**`, `drizzle/**`, `scripts/db-*.ts` |
| `.claude/rules/booking-engine.md` | `src/server/booking/**`, `src/data/**` |
| `.claude/rules/server-api.md` | `src/server/api/**`, `src/server/auth/**`, `src/pages/api/**`, `src/pages/admin/**`, `src/pages/reservas/**` |
| `.claude/rules/ui-design.md` | `src/components/**`, `src/layouts/**`, `src/styles/**`, `src/pages/*.astro` |

## No negociable

1. Nunca más de 1 bici por bloque ni más de 4 reservas por día: la garantía vive en la base (índice único parcial + locks), no solo en la UI.
2. `pnpm db:migrate` solo contra la base del workspace; la app nunca migra al arrancar ni contra producción.
3. Nunca borrar reservas: se cambia `status`.
4. Nunca commitear secretos ni `.env`; nunca registrar correos, teléfonos ni tokens sin redactar.
5. Nunca editar a mano `drizzle/` (se regenera desde `schema.ts`).
6. No construir nada de los No-Objetivos de `blueprint.md` §1 (pago en línea, cuentas de clientes, reprogramación, E2E con navegador, feriados 2027 inventados).
7. Nunca marcar una tarea como hecha con una compuerta fallando, ni editar un comando de Verify para que pase.

## Reparto con Codex

Me quedo con entender el problema, planear, decidir la arquitectura y revisar lo que vuelve. Esa parte no se delega.

La construcción repetitiva, los refactors grandes y los errores atorados se le pasan a Codex con el subagente `codex-rescue`, por mi cuenta, sin esperar que me lo pidan. Una tarea de `tasks.json` = un pase a Codex. Nunca dos pases a la vez: espero el resultado, lo leo y recién entonces sigo.

Codex lee `AGENTS.md`, no este archivo ni `.claude/rules/`. Por eso cada encargo incluye:

- La tarea de `tasks.json` y los archivos exactos que toca.
- La regla de `.claude/rules/` que aplica a esos archivos, nombrada por ruta para que la lea antes de empezar.
- Los puntos de "No negociable" que tocan esa tarea (siempre: no editar `drizzle/`, no migrar fuera de la base dev, no commitear secretos ni `.env`).
- Qué NO debe cambiar (firmas exportadas, otros módulos, el diseño aprobado).
- El cierre: `pnpm format`, el Verify de la tarea y `pnpm gate` en verde.

Antes de cada pase el árbol de git está limpio (commiteado). Si lo que vuelve está mal, se revierte con `git checkout .` y no se parcha encima.

Nada de lo que vuelve de Codex se da por bueno sin que yo lo revise y sin `pnpm gate` en verde. En cada pase cuento qué le pedí y qué volvió, en dos líneas.

Si Codex falla dos veces en la misma tarea, esa tarea vuelve a mí. No hay tercer intento: cuando algo se atora dos veces, lo que está mal es el encargo, no quién lo ejecuta.
