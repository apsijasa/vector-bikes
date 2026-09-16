# Vector Bikes — Blueprint

> Generado por The Architect el 2026-09-15
> Forma (shape): marketing-site · `knowledge/shapes/marketing-site.md` (capacidad central: `knowledge/capabilities/availability-engine.md`)
> Runtime track: ts-node · `knowledge/runtime-tracks/ts-node.md` (solo respaldo; manda el informe de `stack-researcher`)
> Modo de emisión: bundle
> Versión del blueprint: 1
> Versiones verificadas por última vez: 2026-09-15 — ver §11 para la procedencia por paquete

**Cómo leer este bundle.** Este archivo es la narrativa y las decisiones. `tasks.json` es el grafo de tareas (una tarea = un paso de §9). `epics/01-sitio-y-reservas.md` y `epics/02-operacion-y-lanzamiento.md` son las unidades de ejecución autocontenidas. `workspace/` se copia **completo** a la raíz del proyecto antes del paso 1 (una sola copia, no destructiva — ver §10 Bootstrap y §19). Todo comando se ejecuta desde la **raíz del proyecto** (la raíz de la Replit App), nunca desde `blueprints/vector-bikes/`.

---

## 1. Visión general y No-Objetivos

### Visión
Vector Bikes es el sitio web de un taller de mecánica de bicicletas de precisión en Av. Kennedy 7666, Vitacura, atendido por un solo mecánico que trabaja un máximo de cuatro bicicletas al día. El sitio reemplaza las coordinaciones por WhatsApp y teléfono con una reserva en línea de bloques de 30 minutos: el ciclista elige si deja la bici en el taller (sin recargo, 1 bloque) o si pide retiro y devolución a domicilio en Vitacura o Las Condes ($15.000, 2 bloques consecutivos), describe lo que necesita y recibe un correo de confirmación con archivo de calendario y un enlace para cancelar. No hay pago en línea: se paga en persona al recibir la bici.

El problema que resuelve es de capacidad, no de catálogo: un taller de una persona no puede aceptar más de cuatro bicis diarias ni dejar el local vacío en horario de recepción. Por eso el corazón del sistema es un motor de disponibilidad que respeta horario local de Santiago (con su horario de verano del hemisferio sur), feriados nacionales, bloqueos manuales, antelación mínima de 120 minutos, horizonte de 30 días y un tope diario, y que hace **imposible** a nivel de base de datos que dos personas tomen el mismo bloque. El dueño gestiona la agenda desde un panel `/admin` mínimo, con una sola cuenta.

### Usuarios
| Persona | A qué viene | Frecuencia |
|---|---|---|
| Ciclista de Vitacura / Las Condes (público, sin cuenta) | Reservar un bloque para dejar su bici o pedir retiro, y cancelar si no puede | Una vez cada pocos meses |
| Andrés, dueño y mecánico (único admin) | Ver la agenda del día, llamar al cliente, marcar completada / no-show, cancelar, bloquear días u horas | Diario |
| Motor de recordatorios (Replit Scheduled Deployment) | Enviar el recordatorio del día anterior | Diario, 10:00 America/Santiago |

### Objetivos — alcance v1
1. El sitio presenta el taller (landing prerenderizada fiel a `docs/design-preview.html`) en español de Chile, rápido y accesible (WCAG 2.2 AA).
2. Un visitante reserva un bloque `taller` o `retiro` válido en menos de dos minutos, y el sistema garantiza en la base de datos: 1 bici por bloque, máximo 4 reservas por día, máximo 1 reserva futura confirmada por teléfono.
3. Cada reserva genera correos (confirmación con `.ics` y enlace de cancelación al cliente, aviso al taller, recordatorio el día anterior, aviso de cancelación al taller) sin enviarlos nunca dentro de la transacción.
4. El cliente cancela con un enlace de un solo uso antes del inicio de su reserva, y el bloque se libera.
5. El dueño administra la agenda y los bloqueos desde `/admin`, protegido por sesión propia, y ve una advertencia visible cuando el horizonte de 30 días entra en un año sin feriados cargados.
6. El sitio corre en Replit (Autoscale + Postgres + Scheduled Deployment) con un runbook de lanzamiento que un no-desarrollador puede seguir.

### No-Objetivos — fuera de alcance en v1

| No se construye | Por qué ahora no | Revisar cuando |
|---|---|---|
| Pago en línea | El pago es presencial (efectivo, transferencia, tarjeta con POS); integrar pasarela suma webhooks, reembolsos y conciliación sin demanda validada | Más de 20 % de no-shows en 2 meses seguidos |
| Cuentas de clientes | Una reserva cada pocos meses no justifica login; el correo + enlace de cancelación cubre la necesidad | Clientes piden historial de servicios |
| Lista de precios / catálogo | El diagnóstico se cotiza en el taller; publicar precios obliga a mantenerlos | El dueño define precios fijos para servicios estándar |
| Reprogramación directa | Cancelar + reservar de nuevo cubre el caso con cero código extra | Más de 5 reprogramaciones por semana |
| Sincronización con Google Calendar | El `.ics` adjunto cubre al cliente; el dueño usa `/admin` | El dueño opera desde su calendario y deja de abrir `/admin` |
| Seguimiento del estado de la bici | La devolución se coordina por teléfono; un tracker exige disciplina de actualización | Más de 8 bicis/día o un segundo mecánico |
| WhatsApp automatizado / SMS | Costo por mensaje y aprobación de plantillas; el botón manual de WhatsApp basta | Correos con tasa de apertura baja comprobada |
| Múltiples mecánicos / recursos | Capacidad 1 por bloque es el negocio real hoy | Contratación de un segundo mecánico |
| Sitio en inglés | Audiencia local | Demanda turística comprobada |
| Blog / CMS | Nadie editará contenido semanalmente | El dueño quiere publicar contenido mensual |
| Recuperación de clave admin por correo | Un solo admin con acceso al shell de Replit usa `pnpm admin:set-password` | Aparece un segundo administrador |
| Suite E2E con navegador en las compuertas | Las dependencias de navegador de Playwright no son confiables en el entorno Nix de Replit | El build se mueve a CI con contenedores |
| Feriados 2027 | No están confirmados oficialmente; inventarlos sería peor que bloquear a mano | Publicación oficial de feriados 2027 (antes de diciembre 2026) |

**El builder no implementa nada de esta tabla**, aunque parezca un agregado pequeño mientras trabaja un paso vecino. Si un paso parece requerir un no-objetivo, es un defecto del blueprint: detenerse y reportarlo en vez de ampliar el alcance.

### Métricas de éxito
| Métrica | Meta | Cómo se mide |
|---|---|---|
| Reservas en línea confirmadas | ≥ 40 en los primeros 60 días desde el lanzamiento | `select count(*) from bookings where status <> 'cancelled' and created_at >= '<fecha de lanzamiento>'` |
| Tasa de no-show | ≤ 10 % a 60 días | `select count(*) filter (where status='no_show')::float / nullif(count(*) filter (where status in ('completed','no_show')),0) from bookings` |
| Dobles reservas | 0, siempre | Garantizado por el índice único parcial `uq_booking_blocks_active_slot`; `select service_date, block_start, count(*) from booking_blocks where is_active group by 1,2 having count(*)>1` devuelve 0 filas |
| Correos de confirmación fallidos | < 2 % | Líneas de log `{"event":"email.failed"}` / reservas creadas, en el panel de logs de la deployment |

---

## 2. Stack tecnológico

**Runtime track: ts-node.** Esta tabla nombra *elecciones*, no versiones. Toda versión fijada vive en §11 y en ningún otro lugar de la prosa.

Las versiones vienen del informe de `stack-researcher` de esta sesión (verificado 2026-09-15), que es la autoridad. `knowledge/runtime-tracks/ts-node.md` es solo el respaldo, y sus advertencias no verificadas se trasladan tal cual.

| Capa | Elección | Por qué esto y no lo otro |
|---|---|---|
| Lenguaje / runtime | TypeScript sobre Node.js 24 LTS | Un lenguaje para landing, API, scripts y tests. Node 24 ejecuta los scripts `.ts` con su *type stripping* nativo, así que no hace falta `tsx` (rechazado en §11). Python se rechazó: la UI es el producto. |
| Framework | Astro 7 con `output: "server"` y `@astrojs/node` en modo `standalone` | La landing y `/privacidad` se prerenderizan (cero JS salvo la isla de reserva) y las rutas de API/admin/cancelación se renderizan bajo demanda en el mismo proceso. Next.js se rechazó: hidratación completa y peso innecesario para un sitio de una página. |
| Estilos | Tailwind CSS 4 (CSS-first `@theme`) + CSS propio portado del diseño aprobado | El diseño ya existe como CSS con tokens (`docs/design-preview.html`); portarlo literal es más fiel que reescribirlo en utilidades. Tailwind queda disponible para utilidades puntuales. CSS-in-JS rechazado (conflicto conocido, ver compatibilidad). |
| Capa de componentes | Componentes `.astro` + una isla Preact (`client:visible`) para la reserva | Solo el flujo de reserva es interactivo; Preact pesa ~4 KB frente a React. Sin librería de componentes: los controles son HTML nativo (botones, inputs, `details`). |
| Base de datos | PostgreSQL 16 de Replit (dev "Helium", producción respaldada por Neon) | Relacional con transacciones, bloqueos de fila, índices únicos parciales y advisory locks: exactamente lo que exige la prevención de dobles reservas. Vive en la misma plataforma que el hosting. SQLite rechazado: escrituras concurrentes y sin advisory locks. |
| ORM / acceso a datos | Drizzle ORM (+ drizzle-kit para generar migraciones) con el driver `postgres` | Esquema como código, SQL legible, migraciones generadas y tipos inferidos. Mismo esquema sirve para PGlite en tests. Prisma rechazado: cliente generado más pesado y sin ventaja aquí. |
| Auth | Sesión propia mínima para un solo admin (scrypt + tabla `admin_sessions` + cookie httpOnly) | **Decisión tomada en GENERATE:** Better Auth rechazado porque su CLI generador (`@better-auth/cli` 1.4.21) y la librería (1.7.5) divergieron y 1.7 falla duro ante drift de esquema en producción; no se podía fijar el esquema con confianza. Un admin no necesita OAuth, MFA ni organizaciones. |
| Trabajo en segundo plano | Script `pnpm reminders:send` ejecutado por una Replit Scheduled Deployment diaria; correos transaccionales enviados tras el commit en la misma petición | Un correo por evento y un cron diario no justifican una cola. El envío ocurre después de confirmar la transacción y un fallo de correo se registra sin revertir la reserva. |
| Pagos | NOT APPLICABLE — el pago es presencial (efectivo, transferencia o tarjeta con POS al entregar la bici) | — |
| Almacenamiento de archivos | NOT APPLICABLE — no hay subidas; el logo y el diseño son archivos estáticos del repositorio | — |
| Correo / notificaciones | Resend desde `send.vectorbikes.cl`, con abstracción `EMAIL_TRANSPORT=resend\|console` | API simple, SDK tipado, recomienda subdominio (no choca con el SPF de Microsoft 365 en el apex). El transporte `console` hace que tests y desarrollo local nunca toquen la red. |
| Anti-abuso | Cloudflare Turnstile + rate limit en Postgres + 1 reserva futura por teléfono | Sin CAPTCHA molesto; claves de prueba oficiales para tests; el rate limit en Postgres evita sumar Redis. |
| Hosting | Replit: Autoscale Deployment (web) + Scheduled Deployment (recordatorios) + Postgres de Replit | Decisión del dueño (plan Core ya contratado; el código vive en la Replit App). Un solo proveedor para un operador no técnico. |
| Gestor de paquetes | pnpm 12 vía corepack | `node_modules` estricto detecta dependencias fantasma; la versión se fija en el `build` de `[deployment]` de `.replit` (`corepack pnpm@12.4.2 …`), no en `packageManager`, porque Replit reescribe `package.json` al publicar (§20.3 #19). |

### Chequeo de compatibilidad
Revisado contra `knowledge/stack-compatibility.md` — ninguna de las filas de combinaciones conocidas como problemáticas aplica, **con una fila que el propio track trae y que se neutraliza explícitamente**: *linter que parsea CSS (Biome) + motor CSS-first con at-rules (Tailwind 4)*. `biome.json` (emitido en §19.6) activa `css.parser.tailwindDirectives: true` antes del primer `lint`. Además:

- *Runtime sin sockets TCP + driver TCP*: no aplica — `@astrojs/node` standalone corre en Node completo en Autoscale.
- *Conexiones serverless sin pool*: se mitiga con un único cliente `postgres` por proceso (`max: 5`) y sin conexiones por petición.
- *Dos sistemas de migración*: el panel Database de Replit es **solo lectura** para el esquema; drizzle es el único dueño. Particularidad de la plataforma: al publicar, Replit aplica los cambios de esquema de la base dev a producción (sin datos). Por eso `pnpm db:migrate` corre **solo** contra la base del workspace y la app nunca migra al arrancar (§12, §20.2).
- *Proceso de larga vida + host por petición*: los recordatorios no viven en memoria del servidor; son un proceso separado programado.

Gotchas del track que se trasladan: `corepack enable` con `--install-directory` escribible; aprobación de scripts de build de pnpm (`allowBuilds` en `pnpm-workspace.yaml` — verificado con pnpm 12.4.2 en la prueba de humo; el Bootstrap conserva el respaldo `approve-builds`); Astro 7 rechaza tags no-void sin cerrar; TypeScript debe quedarse en la línea 6.x (el peer de `@astrojs/check` no acepta 7).

---

## 3. Estructura de directorios

```
<raíz de la Replit App>/
├── .replit                    # §19.6 — módulo Node, puerto 4321, [deployment] build/run (Autoscale)
├── .nvmrc                     # §19.6 — "24"
├── .gitignore                 # §19.6 — llega con la copia de workspace/ ANTES del primer commit
├── .env.example               # §19.6 — todas las variables, valores locales/de prueba (commiteado)
├── package.json               # §19.6 — dependencias fijadas y scripts (fuente de los comandos)
├── pnpm-workspace.yaml        # §19.6 — proyecto único, excluye blueprints/, allowBuilds
├── pnpm-lock.yaml             # generado por `pnpm install` en §10 Bootstrap (commiteado en el paso 1)
├── astro.config.mjs           # §19.6 — output server, adapter node standalone, preact, sitemap, tailwind
├── tsconfig.json              # §19.6 — strict, especificadores .ts, erasableSyntaxOnly
├── biome.json                 # §19.6 — formato/lint; excluye blueprints/, docs/, dist/, drizzle/, .claude/
├── vitest.config.ts           # §19.6 — suites unit+integration (por defecto) y build (VITEST_SUITE=build)
├── drizzle.config.ts          # §19.6 — esquema src/server/db/schema.ts → carpeta drizzle/
├── CLAUDE.md                  # §19.1
├── AGENTS.md                  # §19.2
├── README.md                  # paso 12 crea (Scheduled Deployment); paso 14 agrega el runbook de lanzamiento
├── .claude/
│   ├── settings.json          # §19.3 — allowlist de todos los comandos de Verify y §20.1
│   ├── rules/                 # §19.5 — database.md, booking-engine.md, ui-design.md, server-api.md
│   └── skills/                # §19.4 — add-migration/, add-holidays/
├── blueprints/vector-bikes/   # ESTE bundle. Documentación; excluido de biome, tsc, vitest, tailwind y pnpm
├── docs/
│   └── design-preview.html    # diseño APROBADO (prototipo estático, fuente visual de verdad). Excluido de toda herramienta
├── drizzle/                   # migraciones SQL + meta/ generadas por `pnpm db:generate` (paso 2). Nunca se editan a mano
├── public/
│   ├── brand/
│   │   └── vector-bikes-logo.png  # logo oficial 1254×1254 (ya presente en workspace/)
│   └── robots.txt             # paso 13
├── scripts/
│   ├── smoke.sh               # paso 1 crea; paso 14 amplía — levanta dist/server/entry.mjs y prueba HTTP
│   ├── db-migrate.ts          # §19.6 — aplica drizzle/ a DATABASE_URL (se niega a correr en una deployment)
│   ├── db-check.ts            # §19.6 — select 1 + cada tabla creada por drizzle/*.sql existe
│   ├── admin-set-password.ts  # paso 10 — crea/actualiza el admin desde ADMIN_EMAIL/ADMIN_PASSWORD
│   └── reminders-send.ts      # paso 12 — recordatorios del día siguiente, idempotente
├── src/
│   ├── data/
│   │   └── feriados-cl.json   # paso 3 — feriados nacionales 2026 (2027 NO)
│   ├── lib/
│   │   ├── env.ts             # §19.6 — accesores zod por funcionalidad; fallan nombrando la variable
│   │   ├── log.ts             # §19.6 — logger JSON con redacción de PII
│   │   └── site.ts            # paso 6 — datos del taller (dirección, horario, enlaces) + whatsappHref()
│   ├── styles/
│   │   └── global.css         # paso 1 — tokens y CSS portados de docs/design-preview.html
│   ├── layouts/
│   │   └── Base.astro         # paso 1 crea (head/fuentes); paso 6 header/footer/WhatsApp; paso 13 SEO
│   ├── components/
│   │   ├── Landing.astro      # paso 6 — hero, cómo funciona, reservar, retiro, taller, preguntas
│   │   └── islands/
│   │       ├── BookingIsland.tsx   # paso 7 — la ÚNICA isla interactiva (reserva)
│   │       └── booking-state.ts    # paso 7 — reductor puro del flujo de reserva
│   ├── pages/
│   │   ├── index.astro        # paso 1 crea; paso 6 compone la landing (prerender = true)
│   │   ├── privacidad.astro   # paso 13 (prerender = true)
│   │   ├── 404.astro          # paso 13
│   │   ├── api/
│   │   │   ├── health.ts          # paso 1 (db:false); paso 2 (db real)
│   │   │   ├── disponibilidad.ts  # paso 5 — envoltorio delgado
│   │   │   └── reservas.ts        # paso 5; paso 8 conecta los correos post-commit
│   │   ├── reservas/
│   │   │   └── cancelar.astro     # paso 9 — GET confirma, POST cancela
│   │   └── admin/
│   │       ├── login.astro        # paso 10
│   │       ├── logout.ts          # paso 10 (POST)
│   │       ├── index.astro        # paso 11 — agenda por día (?fecha=)
│   │       ├── bloqueos.astro     # paso 11
│   │       └── reservas/
│   │           └── [id].astro     # paso 11 — detalle y acciones
│   └── server/                # lógica de negocio pura y testeable; NO importa nada de astro
│       ├── db/
│       │   ├── schema.ts          # paso 2 — esquema Drizzle (fuente de verdad)
│       │   └── client.ts          # paso 2 — getDb(), tipo AppDb, pingDb()
│       ├── booking/
│       │   ├── rules.ts           # paso 3 — constantes de negocio
│       │   ├── holidays.ts        # paso 3 — lectura de feriados + años faltantes
│       │   ├── slots.ts           # paso 3 — motor de agenda puro (luxon)
│       │   ├── tokens.ts          # paso 4 — token de cancelación y HMAC
│       │   ├── create-booking.ts  # paso 4 — transacción de reserva
│       │   ├── cancel-booking.ts  # paso 4 — cancelación transaccional (libera bloques)
│       │   └── cancel-flow.ts     # paso 9 — flujo por token (GET/POST)
│       ├── api/
│       │   ├── handlers.ts        # paso 5 — handlers HTTP de disponibilidad y reservas
│       │   ├── client-ip.ts       # IP real tras el proxy (rightmost non-trusted)
│       │   └── turnstile.ts       # paso 5 — verificación siteverify (fetch inyectable)
│       ├── email/
│       │   ├── transport.ts       # paso 8 — resend | console
│       │   ├── templates.ts       # paso 8 — 4 plantillas en español
│       │   ├── notifications.ts   # paso 8 — orquesta envíos post-commit (+ .ics)
│       │   └── reminders.ts       # paso 12 — selección y envío idempotente
│       ├── auth/
│       │   └── admin-auth.ts      # paso 10 — scrypt, sesiones, login con rate limit, chequeo Origin
│       └── admin/
│           └── agenda.ts          # paso 11 — consultas y acciones del panel
└── tests/
    ├── setup.ts               # §19.6 — valores de entorno de prueba (sin red)
    ├── helpers/
    │   └── pglite.ts          # paso 2 — Postgres en proceso con las migraciones de drizzle/
    ├── unit/                  # slots (3), booking-state (7), replit-config (12)
    ├── integration/           # foundation (2), create-booking y concurrency (4), api (5), email (8),
    │                          # cancel-flow (9), admin-auth (10), admin-panel (11), reminders (12)
    └── build/                 # landing (6), island (7), seo (13), a11y (14) — leen dist/ tras `pnpm build`
```

**Salidas de build (no se commitean):** `dist/server/entry.mjs` (servidor standalone — el valor sale de §19.6, *Reconciliación de valores entre artefactos*), `dist/client/` (páginas prerenderizadas `index.html`, `privacidad/index.html`, `404.html`, `sitemap-index.xml`, `sitemap-0.xml` y assets en `dist/client/_astro/`), `.astro/` (tipos generados por `astro check`).

**Reglas de frontera**
- `src/server/**` y `src/lib/**` nunca importan `astro`, `astro:*` ni componentes; así Vitest y los scripts de Node los cargan sin Astro.
- `src/pages/**` son envoltorios delgados: parsean la petición, llaman a una función de `src/server/**` y devuelven su `Response`. Ninguna consulta SQL vive en una página.
- `src/server/db/client.ts` es el único lugar que abre una conexión Postgres. Los módulos reciben `db: AppDb` como argumento (inyección), lo que permite pasar PGlite en tests.
- `src/components/**` no importa `src/server/**`; la isla habla con el servidor solo por `fetch` a `/api/*`.
- `process.env` se lee solo en `src/lib/env.ts`; las variables `PUBLIC_*` que llegan al navegador se leen con `import.meta.env` solo en `src/pages/index.astro` y `src/layouts/Base.astro`.
- Nada en `src/server/**`, `src/lib/**` ni `scripts/**` usa `enum`, `namespace` ni *parameter properties* (lo exige `erasableSyntaxOnly`, porque Node ejecuta esos archivos quitando tipos).
- **Convención de resolución:** especificadores relativos con extensión `.ts` explícita (`import { getDb } from "../db/client.ts"`), sin alias. Está reconciliada contra app, tests, scripts y build en la *Matriz de convención de resolución* de §19.6.

---

## 4. Modelo de datos

Convenciones (de `knowledge/capabilities/database.md`): tablas en plural y snake_case, PK `uuid` con `gen_random_uuid()`, `created_at`/`updated_at` `timestamptz` (el `updated_at` lo mantiene Drizzle con `$onUpdate`, porque todas las escrituras pasan por el ORM — decisión técnica, ver §20.3), dinero en **enteros CLP**, instantes en UTC `timestamptz` + zona IANA en columna aparte, reglas de horario como hora local de pared. **Nunca se borran reservas**: se cambia `status`.

### Entidades

**bookings** — una reserva de un cliente; nace `confirmed` y termina `cancelled`, `completed` o `no_show`.

| Campo | Tipo | Restricciones | Notas |
|---|---|---|---|
| id | uuid | PK, default `gen_random_uuid()` | Nunca se expone en URLs públicas (solo en `/admin`) |
| code | text | not null, único `uq_bookings_code` | `VB-AAMMDD-HHMM` de la hora de inicio local (`VB-260916-1630`); si ya existe (una reserva cancelada en el mismo bloque), se agrega `-2`, `-3`… |
| service_date | date | not null | Fecha local (America/Santiago) de la reserva |
| mode | text | not null, check `taller`\|`retiro` | `retiro` = retiro y devolución |
| status | text | not null, default `confirmed`, check 4 valores | `confirmed`, `cancelled`, `completed`, `no_show` |
| starts_at | timestamptz | not null | Instante UTC del inicio del primer bloque |
| ends_at | timestamptz | not null, check `ends_at > starts_at` | +30 min (`taller`) o +60 min (`retiro`) |
| timezone | text | not null, default `America/Santiago` | Zona para mostrar y recordar |
| customer_name | text | not null | 2–80 caracteres |
| phone_e164 | text | not null | Celular chileno normalizado `+569XXXXXXXX` |
| email | text | not null | Correo del cliente (minúsculas) |
| bike | text | not null | Marca y tipo |
| description | text | not null | Qué necesita la bici, 5–1000 caracteres |
| comuna | text | nullable; con `retiro` debe ser `Vitacura` o `Las Condes` | Check `bookings_retiro_address_check` |
| address | text | nullable; not null con `retiro` | Dirección de retiro |
| pickup_fee_clp | integer | not null, default 0; check 0↔taller, 15000↔retiro | Recargo, se paga en persona |
| consent_at | timestamptz | not null | Momento en que marcó el aviso de privacidad (Ley 19.628 / 21.719) |
| cancel_token_hash | text | not null, único | HMAC-SHA-256 hex del token de cancelación; el token plano solo viaja en el correo |
| cancel_token_used_at | timestamptz | nullable | Marca de uso único |
| cancelled_at | timestamptz | nullable | |
| cancelled_by | text | nullable, check `customer`\|`admin` | |
| completed_at | timestamptz | nullable | Se llena al marcar `completed` |
| reminder_sent_at | timestamptz | nullable | Idempotencia del recordatorio |
| ip_hash | text | nullable | HMAC-SHA-256 de la IP con `SESSION_SECRET`; nunca la IP en claro |
| created_at / updated_at | timestamptz | not null, default now() | |

**booking_blocks** — cada bloque de 30 min que ocupa una reserva (1 para `taller`, 2 consecutivos para `retiro`). Es la garantía de "1 bici por bloque".

| Campo | Tipo | Restricciones | Notas |
|---|---|---|---|
| id | uuid | PK | |
| booking_id | uuid | FK → bookings.id, `on delete restrict`, not null | |
| service_date | date | not null | Fecha local |
| block_start | time | not null | Hora local de inicio `HH:MM:00` |
| is_active | boolean | not null, default true | `false` al cancelar (en la misma transacción) |
| created_at / updated_at | timestamptz | not null | |

**booking_days** — una fila por fecha con reservas; se bloquea con `FOR UPDATE` para serializar el conteo del tope diario. Excepción deliberada a la convención de PK uuid: su PK natural *es* la clave de bloqueo.

| Campo | Tipo | Restricciones | Notas |
|---|---|---|---|
| service_date | date | PK | |
| created_at | timestamptz | not null, default now() | |

**blocked_periods** — bloqueos manuales del dueño.

| Campo | Tipo | Restricciones | Notas |
|---|---|---|---|
| id | uuid | PK | |
| service_date | date | not null | |
| start_time | time | nullable | Ambos nulos = día completo |
| end_time | time | nullable; check: ambos nulos o ambos no nulos y `start_time < end_time` | Rango `[start_time, end_time)` |
| reason | text | not null | Motivo visible en `/admin` |
| created_at / updated_at | timestamptz | not null | |

**admin_users** — la(s) cuenta(s) del panel (v1: una).

| Campo | Tipo | Restricciones | Notas |
|---|---|---|---|
| id | uuid | PK | |
| email | text | not null, único | En minúsculas |
| password_hash | text | not null | `scrypt$16384$8$1$<salt base64>$<hash base64>` |
| created_at / updated_at | timestamptz | not null | |

**admin_sessions** — sesiones revocables.

| Campo | Tipo | Restricciones | Notas |
|---|---|---|---|
| id | uuid | PK | |
| admin_user_id | uuid | FK → admin_users.id, `on delete cascade`, not null | |
| token_hash | text | not null, único | SHA-256 hex del token de la cookie |
| expires_at | timestamptz | not null | creación + 7 días |
| revoked_at | timestamptz | nullable | Logout o cambio de clave |
| created_at / updated_at | timestamptz | not null | |

**login_attempts** — intentos fallidos de login (rate limit).

| Campo | Tipo | Restricciones | Notas |
|---|---|---|---|
| id | uuid | PK | |
| ip_hash | text | not null | |
| email | text | not null | En minúsculas |
| created_at | timestamptz | not null, default now() | |

**booking_requests** — cada POST a `/api/reservas` que pasó el límite (rate limit por IP).

| Campo | Tipo | Restricciones | Notas |
|---|---|---|---|
| id | uuid | PK | |
| ip_hash | text | not null | |
| created_at | timestamptz | not null, default now() | |

### Relaciones
- `bookings` —(1:1..2)→ `booking_blocks` vía `booking_id`, `on delete restrict` (las reservas no se borran; si alguien lo intenta, falla).
- `admin_users` —(1:N)→ `admin_sessions`, `on delete cascade` (borrar un admin invalida sus sesiones).
- `booking_days`, `blocked_periods`, `login_attempts` y `booking_requests` no tienen FK: se relacionan por `service_date` o `ip_hash`.

### Índices
| Tabla | Índice | Por qué |
|---|---|---|
| booking_blocks | `uq_booking_blocks_active_slot` único parcial (`service_date`, `block_start`) `WHERE is_active = true` | **La** garantía de 1 bici por bloque; una inserción concurrente perdedora recibe violación única → 409 |
| booking_blocks | `idx_booking_blocks_booking_id` (`booking_id`) | Liberar bloques al cancelar |
| bookings | `uq_bookings_code`, `uq_bookings_cancel_token_hash` | Unicidad de código y búsqueda por token |
| bookings | `idx_bookings_service_date_status` (`service_date`, `status`) | Agenda por día, conteo del tope diario, disponibilidad |
| bookings | `idx_bookings_phone_status_starts_at` (`phone_e164`, `status`, `starts_at`) | Regla de 1 reserva futura por teléfono |
| bookings | `idx_bookings_reminder` (`service_date`, `status`, `reminder_sent_at`) | Selección de recordatorios |
| blocked_periods | `idx_blocked_periods_service_date` | Disponibilidad y panel |
| admin_sessions | `uq_admin_sessions_token_hash` | Validar la cookie |
| login_attempts | `idx_login_attempts_ip_email_created` (`ip_hash`, `email`, `created_at`) | Ventana de 15 min |
| booking_requests | `idx_booking_requests_ip_created` (`ip_hash`, `created_at`) | Ventana de 10 min |

**Prevención de dobles reservas (decisión tomada en GENERATE — sin `btree_gist`):** la documentación de Replit Postgres no confirma soporte de extensiones, así que no se usa una restricción de exclusión por rangos. En su lugar, dentro de **una** transacción: (1) `INSERT INTO booking_days (service_date) VALUES ($1) ON CONFLICT DO NOTHING` y `SELECT … FROM booking_days WHERE service_date = $1 FOR UPDATE` serializan todo lo de ese día; (2) `SELECT pg_advisory_xact_lock(hashtext($phone))` serializa por teléfono; (3) se revalidan horario, feriado, bloqueos, antelación, horizonte, tope de 4 y regla de teléfono con el motor puro de §9 paso 3; (4) se insertan la reserva y sus bloques; el índice único parcial es la red final.

### Esquema
Contenido completo de `src/server/db/schema.ts` (lo escribe el paso 2 tal cual):

```ts
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgTable,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const instant = (name: string) => timestamp(name, { withTimezone: true });
const createdAt = () => instant("created_at").notNull().defaultNow();
const updatedAt = () =>
  instant("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull(),
    serviceDate: date("service_date", { mode: "string" }).notNull(),
    mode: text("mode").notNull(),
    status: text("status").notNull().default("confirmed"),
    startsAt: instant("starts_at").notNull(),
    endsAt: instant("ends_at").notNull(),
    timezone: text("timezone").notNull().default("America/Santiago"),
    customerName: text("customer_name").notNull(),
    phoneE164: text("phone_e164").notNull(),
    email: text("email").notNull(),
    bike: text("bike").notNull(),
    description: text("description").notNull(),
    comuna: text("comuna"),
    address: text("address"),
    pickupFeeClp: integer("pickup_fee_clp").notNull().default(0),
    consentAt: instant("consent_at").notNull(),
    cancelTokenHash: text("cancel_token_hash").notNull(),
    cancelTokenUsedAt: instant("cancel_token_used_at"),
    cancelledAt: instant("cancelled_at"),
    cancelledBy: text("cancelled_by"),
    completedAt: instant("completed_at"),
    reminderSentAt: instant("reminder_sent_at"),
    ipHash: text("ip_hash"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("uq_bookings_code").on(t.code),
    uniqueIndex("uq_bookings_cancel_token_hash").on(t.cancelTokenHash),
    index("idx_bookings_service_date_status").on(t.serviceDate, t.status),
    index("idx_bookings_phone_status_starts_at").on(t.phoneE164, t.status, t.startsAt),
    index("idx_bookings_reminder").on(t.serviceDate, t.status, t.reminderSentAt),
    check("bookings_mode_check", sql`mode in ('taller', 'retiro')`),
    check(
      "bookings_status_check",
      sql`status in ('confirmed', 'cancelled', 'completed', 'no_show')`,
    ),
    check(
      "bookings_cancelled_by_check",
      sql`cancelled_by is null or cancelled_by in ('customer', 'admin')`,
    ),
    check(
      "bookings_fee_check",
      sql`(mode = 'taller' and pickup_fee_clp = 0) or (mode = 'retiro' and pickup_fee_clp = 15000)`,
    ),
    check(
      "bookings_retiro_address_check",
      sql`mode = 'taller' or (comuna in ('Vitacura', 'Las Condes') and address is not null)`,
    ),
    check("bookings_time_order_check", sql`ends_at > starts_at`),
  ],
);

export const bookingBlocks = pgTable(
  "booking_blocks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "restrict" }),
    serviceDate: date("service_date", { mode: "string" }).notNull(),
    blockStart: time("block_start").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("uq_booking_blocks_active_slot")
      .on(t.serviceDate, t.blockStart)
      .where(sql`is_active = true`),
    index("idx_booking_blocks_booking_id").on(t.bookingId),
  ],
);

export const bookingDays = pgTable("booking_days", {
  serviceDate: date("service_date", { mode: "string" }).primaryKey(),
  createdAt: createdAt(),
});

export const blockedPeriods = pgTable(
  "blocked_periods",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    serviceDate: date("service_date", { mode: "string" }).notNull(),
    startTime: time("start_time"),
    endTime: time("end_time"),
    reason: text("reason").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("idx_blocked_periods_service_date").on(t.serviceDate),
    check(
      "blocked_periods_range_check",
      sql`(start_time is null and end_time is null) or (start_time is not null and end_time is not null and start_time < end_time)`,
    ),
  ],
);

export const adminUsers = pgTable(
  "admin_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("uq_admin_users_email").on(t.email)],
);

export const adminSessions = pgTable(
  "admin_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    adminUserId: uuid("admin_user_id")
      .notNull()
      .references(() => adminUsers.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: instant("expires_at").notNull(),
    revokedAt: instant("revoked_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("uq_admin_sessions_token_hash").on(t.tokenHash)],
);

export const loginAttempts = pgTable(
  "login_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ipHash: text("ip_hash").notNull(),
    email: text("email").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("idx_login_attempts_ip_email_created").on(t.ipHash, t.email, t.createdAt)],
);

export const bookingRequests = pgTable(
  "booking_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ipHash: text("ip_hash").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("idx_booking_requests_ip_created").on(t.ipHash, t.createdAt)],
);

export const allTables = [
  bookings,
  bookingBlocks,
  bookingDays,
  blockedPeriods,
  adminUsers,
  adminSessions,
  loginAttempts,
  bookingRequests,
] as const;

export type Booking = typeof bookings.$inferSelect;
export type BlockedPeriod = typeof blockedPeriods.$inferSelect;
export type AdminUser = typeof adminUsers.$inferSelect;
```

### Migraciones
- Herramienta: `drizzle-kit generate` (script `pnpm db:generate`) crea el SQL y `drizzle/meta/` a partir de `schema.ts`. **El nombre del archivo lo elige la herramienta**; en este documento se le llama siempre "la migración que emite `pnpm db:generate`". Nunca se edita a mano; un cambio de esquema = editar `schema.ts` y volver a generar.
- Aplicación: `pnpm db:migrate` (= `node --env-file-if-exists=.env scripts/db-migrate.ts`, emitido en §19.6) usa el migrador de `drizzle-orm/postgres-js` contra `DATABASE_URL`. Es idempotente: una segunda ejecución no aplica nada.
- **Regla de producción (particularidad de Replit):** `pnpm db:migrate` se ejecuta **solo** contra la base del workspace (dev). La app nunca migra al arrancar y nadie ejecuta migraciones contra producción: al publicar, Replit propaga los cambios de esquema de dev a producción (sin copiar datos). `scripts/db-migrate.ts` se niega a correr (exit 2) si `REPLIT_DEPLOYMENT` está definida. Por esa propagación, todo cambio destructivo sigue *expand → migrate → contract* en publicaciones separadas.
- Verificación: `pnpm db:check` confirma `select 1` y que existe cada tabla que crean los `CREATE TABLE` de `drizzle/*.sql` (propiedad, no conteo).

### Datos iniciales (seed)
No hay seed de negocio: una base vacía ya es usable (la landing muestra días abiertos). El único dato inicial es el admin, creado con `pnpm admin:set-password` (paso 10) leyendo `ADMIN_EMAIL` y `ADMIN_PASSWORD`. Los tests crean sus propios datos en PGlite.

---

## 5. Diseño de API

### Convenciones
- Ruta base: `/api` para JSON público; `/reservas/cancelar` y `/admin/**` son páginas HTML con formularios (POST + redirección 303).
- Respuesta exitosa: el objeto de datos plano, sin envoltorio (contrato confirmado por el dueño: `201 {code, service_date, start, end, mode, fee}`).
- Respuesta de error — **una forma, siempre**: `{ "error": "<mensaje en español para mostrar>", "code": "<código estable>", "fields"?: { "<campo>": "<mensaje>" } }` con `content-type: application/json; charset=utf-8` y `cache-control: no-store`.
- Códigos de error:

| code | HTTP | Cuándo |
|---|---|---|
| `validation_error` | 422 | JSON inválido o campos que no pasan zod; `fields` nombra cada campo |
| `turnstile_failed` | 403 | Turnstile responde `success:false` o falta el token |
| `slot_unavailable` | 409 | El bloque (o su siguiente en `retiro`) ya no está libre, el día se llenó, está bloqueado, cerrado, feriado, fuera de antelación u horizonte, o hubo violación única — mensaje `El bloque ya no está disponible` |
| `phone_limit` | 409 | El teléfono ya tiene una reserva futura confirmada — mensaje `Ya tienes una reserva próxima con este teléfono. Cancélala desde tu correo para reservar otra.` |
| `rate_limited` | 429 | Más de 5 POST por IP en 10 minutos; header `Retry-After: 600` |
| `internal_error` | 500 | Excepción no controlada; se registra con `request_id`, sin traza al cliente |

- Validación: zod 4; esquemas en `src/server/api/handlers.ts`, junto al handler que los usa.
- Paginación: NOT APPLICABLE en la API pública (disponibilidad acotada a 31 días); la agenda admin es por día.
- Idempotencia: sin `Idempotency-Key`; la regla "1 reserva futura por teléfono" y el índice único convierten un reintento en 409, nunca en duplicado.
- Rate limits: `POST /api/reservas` 5 por IP / 10 min (tabla `booking_requests`; el límite se revisa antes de zod, pero solo cuentan los intentos que pasan la validación: un 422 no suma); login admin 5 fallidos por IP+correo / 15 min (tabla `login_attempts`). Almacenamiento en Postgres. IP = la dirección más a la derecha de `x-forwarded-for` que no sea de confianza (34/8 y 35/8 de Google/Replit, 10/8, 172.16/12, 192.168/16, 127/8, `::1`, fc00::/7, fe80::/10; si todas lo son, la última), porque el cliente puede anteponer valores falsos; sin `x-forwarded-for`, `x-real-ip`, luego `cf-connecting-ip`, o `clientAddress`. Vive en `src/server/api/client-ip.ts`.

### Rutas

| Método | Ruta | Descripción | Auth | Rate limit |
|---|---|---|---|---|
| GET | `/` | Landing prerenderizada con isla de reserva | pública | — |
| GET | `/privacidad` | Aviso de privacidad (prerenderizada) | pública | — |
| GET | `/api/health` | Salud: `200 {"ok":true,"db":true}` o `503 {"ok":false,"db":false}` | pública | — |
| GET | `/api/disponibilidad?desde=YYYY-MM-DD&dias=1..31&modo=taller\|retiro` | Días y bloques | pública | — |
| POST | `/api/reservas` | Crea una reserva | pública + Turnstile | 5 / IP / 10 min |
| GET | `/reservas/cancelar?token=` | Página de confirmación de cancelación | token | — |
| POST | `/reservas/cancelar` | Cancela (form `token`) | token + Origin | — |
| GET/POST | `/admin/login` | Formulario / inicio de sesión | pública | 5 fallidos / IP+correo / 15 min |
| POST | `/admin/logout` | Revoca la sesión | admin + Origin | — |
| GET | `/admin?fecha=YYYY-MM-DD` | Agenda del día (default: hoy local) | admin | — |
| GET/POST | `/admin/reservas/[id]` | Detalle; POST `accion=cancelar\|completar\|no_show` | admin + Origin | — |
| GET/POST | `/admin/bloqueos` | Lista; POST `accion=crear\|eliminar` | admin + Origin | — |

Las rutas `/admin/**` y `/reservas/cancelar` llevan `<meta name="robots" content="noindex">` y están en `Disallow` de `robots.txt`.

### Endpoints críticos — detalle completo

#### `GET /api/disponibilidad`
Parámetros (zod): `desde` fecha `YYYY-MM-DD` válida y **no anterior a hoy local**; `dias` entero 1–31 (default 14); `modo` `taller` | `retiro` (default `taller`). Error → 422 `validation_error` con `fields`.

Respuesta 200:
```json
{
  "timezone": "America/Santiago",
  "modo": "retiro",
  "capacity": 4,
  "days": [
    {
      "date": "2026-09-16",
      "status": "open",
      "holidayName": null,
      "used": 2,
      "blocks": [
        { "start": "15:00", "state": "free" },
        { "start": "15:30", "state": "taken" },
        { "start": "19:30", "state": "noroom" }
      ]
    }
  ]
}
```
Reglas por día (en este orden, la primera que aplica gana): fuera del horizonte (fecha > hoy local + 30) o domingo → `closed`; feriado de `src/data/feriados-cl.json` → `holiday` con `holidayName`; bloqueo de día completo → `blocked`; `used >= 4` → `full`; si no → `open`. En `closed`/`holiday`/`blocked`/`full`, `blocks` es `[]`. `used` = reservas con `status <> 'cancelled'` de esa fecha.

Estados de bloque (días `open`; grilla fija de 30 min desde la apertura hasta el último bloque que termina al cierre): `taken` si el bloque está ocupado por un bloque activo o cae dentro de un bloqueo por rango; `late` si su inicio es anterior a ahora + 120 min; en `retiro`, `noroom` si el bloque siguiente no existe (pasa el cierre) o está `taken`; si no, `free`. Un día `open` sin ningún bloque `free` sigue siendo `open` (la isla lo muestra sin bloques elegibles).

#### `POST /api/reservas`
Cuerpo JSON (zod, se rechazan claves desconocidas):

| Campo | Regla | Mensaje en `fields` |
|---|---|---|
| `mode` | `taller` \| `retiro` | `Elige cómo nos entregas la bici.` |
| `service_date` | `YYYY-MM-DD` | `Elige un día.` |
| `start` | `HH:MM` con minutos `00` o `30` | `Elige un bloque.` |
| `nombre` | trim, 2–80 | `Escribe tu nombre.` |
| `telefono` | se normaliza quitando todo lo que no sea dígito: `569XXXXXXXX` (11 dígitos) o `9XXXXXXXX` (9 dígitos) → `+569XXXXXXXX`; cualquier otra forma es inválida | `Faltan dígitos: son 8 después del +56 9.` |
| `correo` | email, ≤ 254, se guarda en minúsculas | `Escribe un correo válido, por ejemplo nombre@correo.cl.` |
| `bicicleta` | trim, 2–120 | `Cuéntanos la marca y el tipo de bici.` |
| `descripcion` | trim, 5–1000 | `Cuéntanos qué necesita tu bici.` |
| `comuna` | con `retiro`: `Vitacura` \| `Las Condes`; con `taller`: debe ser `null` o ausente | `Elige Vitacura o Las Condes.` |
| `direccion` | con `retiro`: trim, 5–200; con `taller`: `null` o ausente | `Escribe la dirección de retiro.` |
| `consentimiento` | literal `true` | `Acepta el aviso de privacidad para confirmar.` |
| `turnstile_token` | string no vacío | (sin campo: 403) |

Orden de evaluación: (1) rate limit — si la IP ya tiene ≥ 5 filas en `booking_requests` en los últimos 10 min → 429; si no, se inserta una fila; (2) JSON y zod → 422; (3) Turnstile `POST https://challenges.cloudflare.com/turnstile/v0/siteverify` con `secret`, `response` y `remoteip` (form-urlencoded) → si `success !== true` → 403; (4) transacción de reserva (§4) → 409 o 201; (5) **después del commit**, envío de correos (paso 8): un fallo se registra (`email.failed`) y la respuesta sigue siendo 201.

Respuesta 201:
```json
{ "code": "VB-260916-1630", "service_date": "2026-09-16", "start": "16:30", "end": "17:00", "mode": "taller", "fee": 0 }
```
Efectos: 1 fila en `bookings`, 1 (`taller`) o 2 (`retiro`) filas activas en `booking_blocks`, 1 fila en `booking_days` si no existía, 1 fila en `booking_requests`; correos 1 (cliente, con `reserva-vector-bikes.ics` y enlace `<PUBLIC_SITE_URL>/reservas/cancelar?token=<token>`) y 2 (taller).

#### `GET|POST /reservas/cancelar`
GET con `token`: busca por `cancel_token_hash = HMAC(token)`. Casos, cada uno con su texto en la página: token inexistente → `Este enlace no es válido.`; ya cancelada → `Esta reserva ya fue cancelada.`; `starts_at <= ahora` → `Tu reserva ya comenzó. Si necesitas algo, llámanos o escríbenos a info@vectorbikes.cl.`; confirmada y futura → resumen (código, día, hora, modalidad) y botón `Cancelar reserva` (form POST con `token` oculto). POST: verifica Origin, repite las validaciones y en **una transacción** pone `status='cancelled'`, `cancelled_at`, `cancelled_by='customer'`, `cancel_token_used_at`, y `is_active=false` en sus bloques; después del commit envía el correo 4 al taller. Un segundo POST con el mismo token muestra `Esta reserva ya fue cancelada.` y no cambia filas.

#### `GET /api/health`
Ejecuta `select 1` con el cliente de `src/server/db/client.ts`. `200 {"ok":true,"db":true}` o `503 {"ok":false,"db":false}`; `cache-control: no-store`. (En el paso 1, antes de existir la base, responde `200 {"ok":true,"db":false}`.)

---

## 6. Arquitectura de frontend

**Fuente visual de verdad:** `docs/design-preview.html` (aprobado por el dueño). Layout, tokens, textos y la interfaz de reserva se copian de ahí. Diferencias deliberadas con el prototipo, todas listadas aquí y en ningún otro lado: (1) sin la franja "Vista previa de diseño"; (2) fuentes autoalojadas con `@fontsource` en vez de Google Fonts; (3) datos reales desde `/api/disponibilidad` en vez del arreglo `DAYS` simulado; (4) el enlace "aviso de privacidad" apunta a `/privacidad`; (5) el botón de WhatsApp solo existe si `PUBLIC_WHATSAPP_NUMBER` tiene valor; (6) bordes de controles de formulario con `--field-border` (ver §7, contraste); (7) el recordatorio del prototipo "En esta vista previa no se envió nada" se reemplaza por el texto real de éxito; (8) la duración de las transiciones sale de `--dur-fast`/`--dur` para anularlas con `prefers-reduced-motion` sin `!important`.

### Rutas
| Ruta | Página | Fuente de datos | Auth |
|---|---|---|---|
| `/` | `src/pages/index.astro` → `Base.astro` + `Landing.astro` + isla `BookingIsland` | estática; la isla hace `fetch` a `/api/disponibilidad` y `/api/reservas` | pública |
| `/privacidad` | `src/pages/privacidad.astro` | estática | pública |
| 404 | `src/pages/404.astro` | estática | pública |
| `/reservas/cancelar` | `src/pages/reservas/cancelar.astro` | servidor: `src/server/booking/cancel-flow.ts` | token |
| `/admin/login` | `src/pages/admin/login.astro` | servidor: `src/server/auth/admin-auth.ts` | pública |
| `/admin` | `src/pages/admin/index.astro` | servidor: `src/server/admin/agenda.ts` | admin |
| `/admin/reservas/[id]` | `src/pages/admin/reservas/[id].astro` | servidor: `agenda.ts` | admin |
| `/admin/bloqueos` | `src/pages/admin/bloqueos.astro` | servidor: `agenda.ts` | admin |

### Estrategia de renderizado
- `astro.config.mjs`: `output: "server"`, `adapter: node({ mode: "standalone" })`. Toda ruta se renderiza bajo demanda **salvo** las que exportan `export const prerender = true;`: `src/pages/index.astro` y `src/pages/privacidad.astro` (y `404.astro`, que Astro prerenderiza). Las prerenderizadas quedan en `dist/client/` y el servidor standalone las sirve como estáticas: arranque en frío de Autoscale no afecta a la landing.
- Consecuencia: `PUBLIC_TURNSTILE_SITE_KEY` y `PUBLIC_WHATSAPP_NUMBER` se **hornean en el build**. Cambiarlas exige volver a publicar (anotado en el runbook).
- La isla usa `client:visible`: su HTML se renderiza en el build (formulario y etiquetas presentes sin JS) y se hidrata al entrar en pantalla.
- Admin y cancelación: HTML de servidor sin JavaScript de cliente; formularios POST con redirección 303 (patrón PRG). `cache-control: no-store` en respuestas con sesión.
- Sin caché de CDN propia; Replit sirve los estáticos.

### Jerarquía de componentes
```
index.astro (prerender)
└── Base.astro [servidor/build]  props: title, description, path, noindex=false, chrome="site"
    ├── <head> meta, canonical, OG, JSON-LD LocalBusiness (paso 13), fuentes @fontsource
    ├── header.site-head: .wordmark (recorte del logo) + nav (Cómo funciona, Retiro a domicilio, Taller, Preguntas, .btn Reservar hora)
    ├── <main id="contenido">
    │   └── Landing.astro [build]
    │       ├── section.hero        (h1 "Mecánica de precisión.", escala de horario, dibujo del logo con "Ø 622 MM · RUEDA 700C")
    │       ├── section#como-funciona (3 pasos)
    │       ├── section#reservar
    │       │   └── BookingIsland.tsx [CLIENTE, client:visible]  props: siteKey
    │       │       ├── fieldset 1 modalidad (2 botones aria-pressed)
    │       │       ├── fieldset 2 días (chips; deshabilitados rayados: Feriado/Cerrado/Completo/Bloqueado)
    │       │       ├── fieldset 3 bloque (regla de medir: horas, ticks de 30 min, rayado = reservado)
    │       │       ├── fieldset 4 datos (+ comuna/dirección solo en retiro, consentimiento, widget Turnstile)
    │       │       └── aside.ticket "Orden de reserva" (sticky en escritorio, aria-live="polite")
    │       ├── section#retiro      ($15.000 + lista de especificaciones)
    │       ├── section#taller      (dirección, Google Maps, tabla de horario)
    │       └── section#preguntas   (details/summary)
    ├── footer.foot (wordmark, texto de privacidad, @vector.bikes, info@vectorbikes.cl, "Av. Kennedy 7666, Vitacura")
    └── a.wa (solo si PUBLIC_WHATSAPP_NUMBER no está vacío)

admin/index.astro (servidor)
└── Base.astro chrome="none" noindex
    └── header admin (Agenda · Bloqueos · Salir[form POST /admin/logout]) + selector de fecha + advertencia de feriados + tabla de reservas
```

### Manejo de estado
- **Estado de servidor:** la isla no usa librería de caché; hace `fetch` directo y guarda la respuesta en su estado. La disponibilidad es consultiva: se vuelve a pedir al cambiar la modalidad y después de un 409.
- **Estado de cliente:** un reductor puro `bookingReducer(state, action)` en `src/components/islands/booking-state.ts` (probado con Vitest sin DOM) contiene `mode`, `availability` (`idle|loading|error|ready` + datos), `selectedDate`, `selectedStart`, `form` (valores), `errors` (por campo), `turnstileToken`, `submit` (`idle|submitting|success|failed` + mensaje) y `result` (respuesta 201). La isla es un `useReducer` sobre ese reductor.
- **Formulario:** controlado por el reductor; la validación de cliente replica exactamente los mensajes de §5 (el servidor sigue siendo la autoridad).
- **Nada global:** no hay store compartido, ni contexto, ni `localStorage`.

### Estados de carga, vacío y error
| Superficie | Cargando | Vacío | Error |
|---|---|---|---|
| Días (isla) | `.ruler-note`: `Cargando disponibilidad…`, contenedor con `aria-busy="true"` | Ningún día `open` en 14 días: `No hay días disponibles en las próximas dos semanas. Escríbenos a info@vectorbikes.cl.` | `No pudimos cargar la disponibilidad.` + botón `Reintentar` |
| Bloques (isla) | igual que días | Día `open` sin bloques `free`: `No quedan bloques para este día. Prueba otro día.` | igual que días |
| Envío (isla) | botón deshabilitado con texto `Confirmando…` | — | 422: errores junto a cada campo (`aria-invalid`, `aria-describedby`), foco al primero, resumen en región viva; 409: mensaje del servidor, se limpia el bloque y se recarga la disponibilidad; 403: `No pudimos verificar que eres una persona. Recarga e intenta de nuevo.`; 429: `Demasiados intentos. Espera unos minutos e intenta de nuevo.`; red/500: `No pudimos confirmar tu reserva. Intenta de nuevo en un momento.`. Tras cualquier error se reinicia el widget Turnstile |
| Éxito (isla) | — | — | Panel `.done`: etiqueta `Reserva confirmada`, código en mono, `Te enviamos la confirmación a <correo>.` y `Si necesitas cancelar, usa el enlace del correo.` |
| Agenda admin | render de servidor | `No hay reservas para este día.` | Error de base → página 500 genérica con `request_id` |
| Bloqueos admin | render de servidor | `No hay bloqueos próximos.` | Mensaje de validación sobre el formulario |
| Cancelación | render de servidor | — | Textos de §5 |

---

## 7. Sistema de diseño

Valores copiados literalmente de `docs/design-preview.html` (aprobado). `ui-ux-pro-max` no se ejecutó en esta fase: el diseño ya estaba aprobado; §18 lo recomienda para cualquier componente nuevo.

### Colores
| Token | Claro | Oscuro (`prefers-color-scheme: dark`) | Uso |
|---|---|---|---|
| `--ground` | #F6F6F4 | #0C0D0E | Fondo de página |
| `--surface` | #FFFFFF | #151618 | Controles, ticket, paneles |
| `--ink` | #0C0D0E | #F1F1EE | Texto principal, botón primario, bordes fuertes, foco |
| `--ink-2` | #2A2C2F | #C8C9CB | Texto secundario de párrafos |
| `--steel` | #5A5E63 | #9C9FA4 | Etiquetas mono, ayudas, ticks |
| `--rule` | #D9D9D5 | #2B2D30 | Divisores (decorativos) |
| `--hatch` | #E3E3DF | #1E2022 | Rayado de bloques reservados / días deshabilitados |
| `--on-ink` | #F6F6F4 | #0C0D0E | Texto sobre `--ink` |
| `--field-border` | #5A5E63 (= `--steel`) | #9C9FA4 (= `--steel`) | Bordes de inputs, selects, textarea, chips de día y botones de modalidad |

Logo: `filter: var(--logo-filter)` (`none` claro / `invert(1)` oscuro) y `mix-blend-mode: var(--logo-blend)` (`multiply` claro / `screen` oscuro). No hay colores de éxito ni de error: el diseño es monocromo y los errores se señalan con texto en negrita, borde discontinuo y mensaje, nunca solo con color.

**Contraste (WCAG 2.2 AA):** `--ink` sobre `--ground` ≈ 18.6:1. Los tres pares de mayor riesgo: `--steel` sobre `--surface` claro ≈ 6.5:1; `--steel` sobre `--surface` oscuro ≈ 6.8:1; borde de control: `--rule` sobre `--surface` claro sería ≈ 1.4:1 (**falla** 3:1 de SC 1.4.11), por eso los controles usan `--field-border` (`--steel`, ≈ 6.5:1). `--rule` queda solo para divisores decorativos.

### Tipografía
| Rol | Familia | Tamaño / interlineado | Peso | Tracking |
|---|---|---|---|---|
| Display (H1) | Michroma (`@fontsource/michroma`) | `clamp(2.1rem, 5.2vw, 4.1rem)` / 1.08 | 400 | -0.01em |
| Títulos de sección (H2) | Michroma | `clamp(1.4rem, 2.6vw, 2rem)` / 1.2 | 400 | normal |
| Precio grande | Michroma | `clamp(2rem, 4vw, 2.8rem)` / 1 | 400 | normal |
| H3 / leyendas | Archivo Variable | 1.12rem / 1.55 | 600 | normal |
| Cuerpo | Archivo Variable (`@fontsource-variable/archivo`) | 16px / 1.55; lede 1.12rem | 400 | normal |
| Botones | Archivo Variable | .92rem | 600 | .01em |
| Mono / etiquetas | IBM Plex Mono (`@fontsource/ibm-plex-mono` 400 y 500) | etiquetas .72rem mayúsculas; horas .78rem; precios 1.25rem | 400 / 500 | .14em en etiquetas; `font-variant-numeric: tabular-nums` |

**Carga de fuentes:** autoalojadas; `Base.astro` importa `@fontsource/michroma/400.css`, `@fontsource-variable/archivo/index.css`, `@fontsource/ibm-plex-mono/400.css` y `@fontsource/ibm-plex-mono/500.css` (Vite copia los woff2 a `dist/client/_astro/`). Pilas: `--display: "Michroma", "Eurostile", "Arial Black", sans-serif`; `--body: "Archivo Variable", "Helvetica Neue", Arial, sans-serif`; `--mono: "IBM Plex Mono", ui-monospace, "SFMono-Regular", Menlo, monospace`. Sin peticiones a Google Fonts.

### Espaciado, radio, elevación
- Espaciado: valores del prototipo (base 2px en detalles; rampa usada: 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 28, 32, 36, 40, 44, 48, 56, 72, 88, 104 px) con `clamp()` en paddings de sección (`clamp(48px, 7vw, 88px)`).
- Radio: 2px en botones, controles, chips, bloques y ticket; 999px solo en el botón flotante de WhatsApp.
- Sombras: ninguna. Separación con reglas de 1px (`--rule` o `--ink`). La única "sombra" es `box-shadow: inset 0 0 0 1px var(--ink)` para el estado seleccionado/foco de controles.
- Ancho máximo: 1180px (`.wrap`) con padding `clamp(16px, 4vw, 40px)`. Breakpoints del prototipo: 560, 760, 820, 860, 980 px (móvil primero en la revisión).
- Objetivo táctil mínimo: 44px (botones 46px, bloques 64px de alto, chips ≥ 44px).

### Movimiento
- `--ease: cubic-bezier(.2, .7, .2, 1)`; `--dur-fast: 140ms` (bloques), `--dur: 160ms` (botones, bordes), 180ms en el `+` del FAQ, máximo 250ms. Solo `transform`, `opacity`, `background-color`, `color`, `border-color`.
- `@media (prefers-reduced-motion: reduce) { :root { --dur-fast: 0ms; --dur: 0ms; } }` y ninguna animación en bucle.

### Estilo de componentes
Precisión técnica de taller: monocromo, reglas finas de 1px, tipografía de dibujo técnico (Michroma con moderación, mono en mayúsculas espaciadas para etiquetas y medidas), sin sombras ni degradados, radio de 2px. Elementos firma: la escala de horario del hero (Lun–Vie / Sáb sobre un eje 10:00–20:00 con ticks), la anotación de cota "Ø 622 MM · RUEDA 700C", el selector de bloques dibujado como regla de medir y el ticket "Orden de reserva". **Botón primario:** fondo `--ink`, texto `--on-ink`; **en hover se invierte** (fondo `--surface`, texto `--ink`, borde `--ink`) — pedido del dueño. Botón fantasma: lo inverso. Los enlaces de navegación usan `.nav a:not(.btn)` para no pisar el color del botón. Formularios: etiqueta arriba del control; grilla con `align-items: start` y `.field { align-content: start }` (corrección de desalineación reportada por el dueño). Un componente nuevo pertenece si podría estar en una lámina técnica impresa en blanco y negro.

---

## 8. Autenticación y autorización

### Proveedor y justificación
Sesión propia mínima para un solo administrador, en `src/server/auth/admin-auth.ts`. **Decisión tomada en GENERATE:** Better Auth descartado porque `@better-auth/cli` (1.4.21) y `better-auth` (1.7.5) quedaron en líneas divergentes y 1.7 falla duro ante drift de esquema en producción, lo que impedía fijar el esquema con confianza. Los clientes no tienen cuentas.

### Flujos
- **Alta del admin:** en el shell (Replit o local) con `ADMIN_EMAIL` y `ADMIN_PASSWORD` definidos, `pnpm admin:set-password` hace upsert de `admin_users` (correo en minúsculas, clave ≥ 12 caracteres, hash scrypt con sal aleatoria de 16 bytes, N=16384, r=8, p=1, 64 bytes) y **revoca todas las sesiones** de ese admin. Sale 0 e imprime `{"ok":true,"email":"<correo>","action":"created"|"updated"}`; si falta una variable, sale 1 nombrándola.
- **Login:** `POST /admin/login` (form `email`, `password`). (1) Si hay ≥ 5 filas en `login_attempts` para `ip_hash`+`email` en 15 min → 429 con la página `Demasiados intentos. Espera 15 minutos.`; (2) busca el admin y compara con `crypto.timingSafeEqual` (si el correo no existe, igual se calcula un scrypt contra un hash ficticio para no filtrar tiempos); (3) si falla → inserta en `login_attempts` y responde 401 con `Correo o clave incorrectos.`; (4) si acierta → token aleatorio de 32 bytes (base64url), guarda `sha256(token)` en `admin_sessions` con `expires_at = ahora + 7 días`, setea la cookie y redirige 303 a `/admin`.
- **Reset de clave:** solo por `pnpm admin:set-password` (no hay recuperación por correo — No-Objetivo).
- **Expiración:** una sesión con `expires_at <= ahora` o `revoked_at` no nulo es inválida → redirección 303 a `/admin/login`. Sin renovación deslizante.
- **Logout:** `POST /admin/logout` (con chequeo de Origin) pone `revoked_at`, borra la cookie (`Max-Age=0`) y redirige 303 a `/admin/login`.
- **Borrado de cuenta:** fuera de alcance; se hace desde el panel Database de Replit si alguna vez hiciera falta.

### Protección de rutas
| Superficie | Regla | Dónde se aplica |
|---|---|---|
| `/admin`, `/admin/reservas/[id]`, `/admin/bloqueos` (GET y POST) | sesión válida; si no, 303 a `/admin/login` | primera línea del frontmatter de cada página: `const admin = await requireAdmin(getDb(), Astro.cookies.get(SESSION_COOKIE)?.value, new Date())` |
| Todo POST de admin y `/admin/logout` | sesión válida **y** `isAllowedOrigin(request)`; si Origin no coincide → 403 | cada handler, antes de leer el formulario |
| `/admin/login` POST | `isAllowedOrigin` + rate limit | `login.astro` → `loginAdmin()` |
| `/reservas/cancelar` POST | `isAllowedOrigin` + token válido | `cancelar.astro` → `cancel-flow.ts` |
| `/api/reservas` POST | Turnstile + rate limit (sin sesión) | `handlers.ts` |

**Regla de aplicación:** la autorización se verifica en el servidor en cada petición, dentro de cada handler. No hay middleware como única barrera. Un botón oculto no es un permiso.

### Roles y permisos
| Rol | Puede | No puede |
|---|---|---|
| Visitante | Ver la landing, consultar disponibilidad, crear una reserva, cancelar la suya con su token antes del inicio | Ver reservas ajenas, cancelar después del inicio, entrar a `/admin` |
| Admin | Ver agenda por día y detalle, cancelar (en cualquier momento), marcar `completed` o `no_show` una reserva `confirmed`, crear y eliminar bloqueos | Borrar reservas, cambiar datos del cliente, reprogramar |

### Sesiones
- Token opaco de 32 bytes, cookie `vb_admin_session`, flags `HttpOnly; Secure; SameSite=Lax; Path=/`, `Max-Age=604800`. En `http://localhost`/`127.0.0.1` (smoke local) se omite `Secure` solo si `PUBLIC_SITE_URL` empieza con `http://`.
- En base solo `sha256(token)` hex; revocación inmediata con `revoked_at`.
- CSRF: `SameSite=Lax` + **chequeo de Origin en cada POST**: `isAllowedOrigin(request)` acepta únicamente si el header `Origin` es igual a `new URL(PUBLIC_SITE_URL).origin`. El chequeo nativo de Astro (`security.checkOrigin`) queda **desactivado** en `astro.config.mjs` porque detrás del proxy TLS de Replit compararía `https://` contra la URL interna `http://` y rechazaría todos los formularios; el chequeo propio usa la URL pública configurada. En el workspace de Replit, `PUBLIC_SITE_URL` se configura con la URL `*.replit.dev` para probar `/admin` en desarrollo.

### Multi-tenancy / aislamiento por fila
NOT APPLICABLE — un solo taller y un solo administrador; no hay datos de distintos inquilinos.

---

## 9. ORDEN DE CONSTRUCCIÓN

**Esta es la sección para la que existe todo el blueprint.** Un builder que sigue §9 al pie de la letra y se detiene cuando cada compuerta queda en verde entrega el proyecto.

### Las reglas de un paso

1. **Una sesión por paso.** Máximo 5 archivos escritos a mano y 6 criterios de aceptación (los archivos que genera una herramienta, como la migración de `pnpm db:generate` o el lockfile, no cuentan como escritos a mano).
2. **Cada paso tiene cuatro campos:** `Do`, `Done when`, `Verify`, `Checkpoint`, y se ejecutan en ese orden.
3. **"Done when" es observable y decidible por un script**, en forma EARS: **WHEN** `<disparador>` **THE SYSTEM SHALL** `<respuesta observable>`.
4. **Prohibido "se ve bien"**, "funciona", "está implementado".
5. **`Verify` es shell literal**, con el resultado esperado en un comentario. Se ejecuta desde la raíz del proyecto.
6. **Un paso no está hecho hasta que su `Verify` pasa y los `Verify` de los pasos anteriores siguen pasando.** Por eso casi todos los pasos terminan su `Verify` con `pnpm check` y `pnpm test` completos.
7. **Checkpoint en cada paso:** commit + `git tag step-NN-<slug>`. Si un paso sale mal: `git reset --hard <tag del paso anterior>` y reintentar; nunca depurar hacia adelante.
8. **Nunca adelantarse.** Si el paso 7 se bloquea, se reporta y se detiene.
9. **Ningún paso rompe retroactivamente una compuerta anterior.** La validación de entorno está en accesores por funcionalidad (`src/lib/env.ts`, §19.6) que se evalúan recién cuando esa funcionalidad se usa; una variable es obligatoria solo desde el paso que indica la columna "Requerida desde el paso" de §10.
10. **No se afirman números derivados sin contarlos.** Las compuertas afirman propiedades ("cada tabla que crean las migraciones existe", "exit 0, 0 failed") salvo cuando el número *es* el invariante del negocio (4 cupos, 50 intentos → 1 éxito y 49 conflictos, 14 tags para 14 pasos).
11. **Todo `Verify` sale 0 cuando el paso es correcto.** Un camino de error documentado se afirma con su código o con su salida, nunca suelto.
12. **Cada chequeo es posible en su medio.** Lo que inspecciona HTML lee `dist/client/*.html` (build); lo que inspecciona comportamiento corre en Vitest contra PGlite o contra el servidor construido.
13. **El primer paso que produce el servidor lo ejecuta** (paso 1: `sh scripts/smoke.sh` arranca `dist/server/entry.mjs` y consulta `/api/health`).
14. **Un `Verify` no depende de su propio `Checkpoint`.** Ningún `Verify` consulta estado de git; las afirmaciones sobre archivos commiteados viven en el bloque `Checkpoint`, después del commit, o en §20.1.
15. **Salida esperada escrita antes que su productor se reconcilia dos veces** (contra este blueprint y contra el runtime fijado). Las cadenas ISO de luxon del paso 3 y la línea `DTSTART` del paso 8 están registradas en §19.6, *Reconciliación de artefactos byte a byte*.
16. **Una compuerta falla por la razón correcta.** Ninguna compuerta acepta "cualquier código distinto de 0".

**Antes del `Verify` de cada paso, ejecutar `pnpm format`** (Biome con `--write`) para que los archivos nuevos queden en el formato que exige `biome ci`. Formatear no cambia comportamiento; si `pnpm check` falla por lint (no por formato), se corrige el código.

### Un paso, una unidad — la regla de conteo

> **Un paso de §9 = una tarea en `tasks.json` = un bloque de tarea en un archivo de épica.**

Este blueprint tiene **14 pasos**, por lo tanto **14 tareas** y **2 épicas** (rango legal para 10–14 pasos: exactamente 2): `01-sitio-y-reservas` (pasos 1–7) y `02-operacion-y-lanzamiento` (pasos 8–14).

### Mapa de pasos

| # | Paso | Depende de | Toca | Compuerta |
|---|---|---|---|---|
| 1 | Base del proyecto y servidor de salud | — (§10 Bootstrap) | `src/styles/global.css`, `src/layouts/Base.astro`, `src/pages/index.astro`, `src/pages/api/health.ts`, `scripts/smoke.sh` | `pnpm build && sh scripts/smoke.sh` |
| 2 | Entorno y base de datos | 1 | `src/server/db/schema.ts`, `src/server/db/client.ts`, `tests/helpers/pglite.ts`, `tests/integration/foundation.test.ts`, `src/pages/api/health.ts` + migración generada | `pnpm db:migrate && pnpm db:check` |
| 3 | Motor de agenda (puro) | 2 | `src/data/feriados-cl.json`, `src/server/booking/rules.ts`, `src/server/booking/holidays.ts`, `src/server/booking/slots.ts`, `tests/unit/slots.test.ts` | `pnpm test tests/unit/slots.test.ts` |
| 4 | Escritura de reservas | 3 | `src/server/booking/tokens.ts`, `src/server/booking/create-booking.ts`, `src/server/booking/cancel-booking.ts`, `tests/integration/create-booking.test.ts`, `tests/integration/concurrency.test.ts` | `pnpm test tests/integration/concurrency.test.ts` |
| 5 | API pública | 4 | `src/server/api/turnstile.ts`, `src/server/api/handlers.ts`, `src/pages/api/disponibilidad.ts`, `src/pages/api/reservas.ts`, `tests/integration/api.test.ts` | `pnpm test tests/integration/api.test.ts` |
| 6 | Landing estática | 1 | `src/lib/site.ts`, `src/layouts/Base.astro`, `src/components/Landing.astro`, `src/pages/index.astro`, `tests/build/landing.test.ts` | `pnpm build && pnpm test:build tests/build/landing.test.ts` |
| 7 | Isla de reserva | 5, 6 | `src/components/islands/booking-state.ts`, `src/components/islands/BookingIsland.tsx`, `src/components/Landing.astro`, `tests/unit/booking-state.test.ts`, `tests/build/island.test.ts` | `pnpm test:build tests/build/island.test.ts` |
| 8 | Correos | 5 | `src/server/email/transport.ts`, `src/server/email/templates.ts`, `src/server/email/notifications.ts`, `src/pages/api/reservas.ts`, `tests/integration/email.test.ts` | `pnpm test tests/integration/email.test.ts` |
| 9 | Cancelación | 8 | `src/server/api/handlers.ts`, `src/server/booking/cancel-flow.ts`, `src/pages/reservas/cancelar.astro`, `tests/integration/cancel-flow.test.ts` | `pnpm test tests/integration/cancel-flow.test.ts` |
| 10 | Acceso admin | 9 | `src/server/auth/admin-auth.ts`, `src/pages/admin/login.astro`, `src/pages/admin/logout.ts`, `scripts/admin-set-password.ts`, `tests/integration/admin-auth.test.ts` | `pnpm test tests/integration/admin-auth.test.ts` |
| 11 | Panel admin | 10 | `src/server/admin/agenda.ts`, `src/pages/admin/index.astro`, `src/pages/admin/reservas/[id].astro`, `src/pages/admin/bloqueos.astro`, `tests/integration/admin-panel.test.ts` | `pnpm test tests/integration/admin-panel.test.ts` |
| 12 | Recordatorios y Replit | 8 | `src/server/email/reminders.ts`, `scripts/reminders-send.ts`, `tests/integration/reminders.test.ts`, `tests/unit/replit-config.test.ts`, `README.md` | `pnpm reminders:send` (dos veces) |
| 13 | SEO, privacidad y 404 | 6 | `src/pages/privacidad.astro`, `src/pages/404.astro`, `public/robots.txt`, `src/layouts/Base.astro`, `tests/build/seo.test.ts` | `pnpm test:build tests/build/seo.test.ts` |
| 14 | Compuerta final | 1–13 | `tests/build/a11y.test.ts`, `scripts/smoke.sh`, `README.md` | `pnpm gate` |

Orden: base ejecutable → datos → motor puro → escritura transaccional → API → UI → operación → endurecimiento. El servidor y los contratos `.replit` ↔ `package.json` ↔ salida del build se ejercitan en el paso 1, donde todos los lados ya existen. El paso 10 depende del 9 porque usa `isAllowedOrigin`, que el paso 9 agrega a `handlers.ts`.

---

#### Paso 1 — Base del proyecto y servidor de salud

**Depende de:** §10 Bootstrap completo (workspace copiado, `pnpm install` exit 0, repositorio con primer commit).

**Do**
Crear exactamente estos 5 archivos:
- `src/styles/global.css` — empieza con estas 4 líneas, en este orden:
  ```css
  @import "tailwindcss/theme.css" layer(theme);
  @import "tailwindcss/utilities.css" layer(utilities);
  @source not "../../blueprints";
  @source not "../../docs";
  ```
  (se omite preflight de Tailwind para no alterar el CSS aprobado; las dos líneas `@source not` impiden que Tailwind escanee el bundle y el prototipo). Después, **portar completo el bloque `<style>` de `docs/design-preview.html`** (desde `:root{` hasta la regla de `prefers-reduced-motion`), con estos cambios y ningún otro: (a) quitar las reglas `.preview` y `.preview .wrap`; (b) en `:root` cambiar `--body` a `"Archivo Variable","Helvetica Neue",Arial,sans-serif` y agregar `--field-border: var(--steel); --dur-fast: 140ms; --dur: 160ms;`; (c) reemplazar cada `.16s` por `var(--dur)` y cada `.14s` por `var(--dur-fast)`; (d) en `.field input,.field select,.field textarea`, `.mode` y `.day` usar `border:1px solid var(--field-border)`; (e) `.wordmark` = `display:block;width:176px;height:38px;background-image:url("/brand/vector-bikes-logo.png");background-size:208px 208px;background-position:-16px -144px;background-repeat:no-repeat;filter:var(--logo-filter);mix-blend-mode:var(--logo-blend)` y `.drawing .mark` = `width:100%;aspect-ratio:1/1;background-image:url("/brand/vector-bikes-logo.png");background-size:185.7% auto;background-position:50% 29.2%;background-repeat:no-repeat;filter:var(--logo-filter);mix-blend-mode:var(--logo-blend)` (los mismos recortes del prototipo, apuntando al PNG oficial en vez del base64); (f) reemplazar la regla final por `@media (prefers-reduced-motion:reduce){:root{--dur-fast:0ms;--dur:0ms}}`; (g) agregar `.skip{position:absolute;left:-9999px;top:0}` y `.skip:focus{left:16px;top:16px;z-index:50;background:var(--surface);color:var(--ink);padding:10px 14px;border:1px solid var(--ink)}`; (h) agregar `html{scroll-padding-top:88px}` (WCAG 2.4.11: el header sticky no tapa el foco). Sin `!important` en ningún lugar.
- `src/layouts/Base.astro` — props `title: string`, `description: string`, `path: string`, `noindex?: boolean` (default `false`). Frontmatter importa `@fontsource/michroma/400.css`, `@fontsource-variable/archivo/index.css`, `@fontsource/ibm-plex-mono/400.css`, `@fontsource/ibm-plex-mono/500.css` y `../styles/global.css`. HTML: `<html lang="es-CL">`, `<meta charset="utf-8">`, viewport `width=device-width, initial-scale=1`, `<meta name="color-scheme" content="light dark">`, `<title>{title}</title>`, `<meta name="description" content={description}>`, `<link rel="canonical" href={new URL(path, Astro.site).href}>`, `<meta name="robots" content="noindex">` solo si `noindex`, `<link rel="icon" type="image/png" href="/brand/vector-bikes-logo.png">`; body: `<a class="skip" href="#contenido">Saltar al contenido</a><main id="contenido"><slot /></main>`.
- `src/pages/index.astro` — `export const prerender = true;`; usa `Base` con `title="Vector Bikes — Mecánica de bicicletas en Vitacura"`, `description="Taller de mecánica de bicicletas de precisión en Av. Kennedy 7666, Vitacura. Reserva tu hora en línea: la dejas en el taller o te la vamos a buscar."`, `path="/"`; contenido provisional: `<h1>Mecánica de precisión.</h1>` (el paso 6 lo reemplaza).
- `src/pages/api/health.ts` — `export const prerender = false;` y `GET` que responde `200` con cuerpo exacto `{"ok":true,"db":false}` y headers `content-type: application/json; charset=utf-8`, `cache-control: no-store` (el paso 2 agrega la base).
- `scripts/smoke.sh` — con este contenido exacto:
  ```sh
  #!/bin/sh
  # Arranca el servidor construido (dist/server/entry.mjs) y prueba HTTP. Uso: sh scripts/smoke.sh
  set -eu
  PORT="${SMOKE_PORT:-4399}"
  BASE="http://127.0.0.1:$PORT"
  HOST=127.0.0.1 PORT="$PORT" node --env-file-if-exists=.env dist/server/entry.mjs >.smoke.log 2>&1 &
  PID=$!
  trap 'kill "$PID" 2>/dev/null || true' EXIT
  i=0
  until curl -s -o /dev/null "$BASE/api/health"; do
    i=$((i + 1))
    if [ "$i" -ge 30 ]; then
      cat .smoke.log
      exit 1
    fi
    sleep 1
  done
  HEALTH="$(curl -s "$BASE/api/health")"
  echo "$HEALTH" | grep -q '"ok":true'
  echo "smoke ok: $HEALTH"
  ```

**Done when**
- [ ] WHEN `pnpm check` runs THE SYSTEM SHALL exit 0 with no Biome, `astro check` or `tsc` errors.
- [ ] WHEN `pnpm build` runs THE SYSTEM SHALL exit 0 and write `dist/server/entry.mjs` and `dist/client/index.html`.
- [ ] WHEN `dist/client/index.html` is read THE SYSTEM SHALL contain `lang="es-CL"` and the text `Mecánica de precisión.`
- [ ] WHEN `.replit` and `package.json` are read THE SYSTEM SHALL both run `node dist/server/entry.mjs` with `PORT=4321`, `.replit` SHALL declare `localPort = 4321`, and `package.json` SHALL declare `pnpm@12.4.2`.
- [ ] WHEN `sh scripts/smoke.sh` runs THE SYSTEM SHALL start `dist/server/entry.mjs`, get a `/api/health` body containing `"ok":true`, and exit 0.

**Verify**
```bash
pnpm format                                                  # expect: exit 0
pnpm check                                                   # expect: exit 0
pnpm build                                                   # expect: exit 0
test -f dist/server/entry.mjs                                # expect: exit 0
grep -q 'lang="es-CL"' dist/client/index.html                # expect: exit 0
grep -q 'Mecánica de precisión.' dist/client/index.html      # expect: exit 0
grep -q 'PORT=4321 node dist/server/entry.mjs' .replit       # expect: exit 0 — contrato .replit ↔ build
grep -q 'localPort = 4321' .replit                           # expect: exit 0
grep -q 'PORT=4321 node dist/server/entry.mjs' package.json  # expect: exit 0 — contrato package.json ↔ build
grep -q '^build = .*pnpm@12.4.2 install --frozen-lockfile' .replit   # expect: exit 0 — contrato build de [deployment] ↔ Bootstrap
sh scripts/smoke.sh                                          # expect: exit 0, imprime smoke ok: {"ok":true,"db":false}
```

**Checkpoint**
```bash
git add -A && git commit -m "feat: step 1 base del proyecto y servidor de salud"
git tag step-01-base
git ls-files --error-unmatch pnpm-lock.yaml   # expect: exit 0 — el lockfile quedó commiteado
```

---

#### Paso 2 — Entorno y base de datos

**Depende de:** 1. **Requisito previo (no es compuerta):** la base Postgres del workspace de Replit existe (herramienta *Database* → crear) y `DATABASE_URL` está en el entorno; fuera de Replit, un Postgres 16 accesible en el `DATABASE_URL` de `.env`.

**Do**
- `src/server/db/schema.ts` — el contenido completo del bloque *Esquema* de §4, sin cambios.
- Ejecutar `pnpm db:generate` → drizzle-kit emite la migración inicial y `drizzle/meta/` (nombre elegido por la herramienta). No editarla.
- `src/server/db/client.ts`:
  ```ts
  import { sql } from "drizzle-orm";
  import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
  import { drizzle } from "drizzle-orm/postgres-js";
  import postgres from "postgres";
  import { getDbEnv } from "../../lib/env.ts";

  export type AppDb = PgDatabase<PgQueryResultHKT>;

  let cached: AppDb | undefined;

  export function getDb(): AppDb {
    if (!cached) {
      const { DATABASE_URL } = getDbEnv();
      const client = postgres(DATABASE_URL, { max: 5, idle_timeout: 20 });
      cached = drizzle({ client }) as unknown as AppDb;
    }
    return cached;
  }

  export async function pingDb(db: AppDb): Promise<boolean> {
    try {
      await db.execute(sql`select 1`);
      return true;
    } catch {
      return false;
    }
  }

  export function isUniqueViolation(error: unknown): boolean {
    const seen = new Set<unknown>();
    let current: unknown = error;
    while (current && typeof current === "object" && !seen.has(current)) {
      seen.add(current);
      if ((current as { code?: unknown }).code === "23505") {
        return true;
      }
      current = (current as { cause?: unknown }).cause;
    }
    return false;
  }
  ```
- `tests/helpers/pglite.ts`:
  ```ts
  import { PGlite } from "@electric-sql/pglite";
  import { drizzle } from "drizzle-orm/pglite";
  import { migrate } from "drizzle-orm/pglite/migrator";
  import type { AppDb } from "../../src/server/db/client.ts";

  export type TestDb = { db: AppDb; client: PGlite; close: () => Promise<void> };

  export async function createTestDb(): Promise<TestDb> {
    const client = new PGlite();
    const pgliteDb = drizzle({ client });
    await migrate(pgliteDb, { migrationsFolder: "drizzle" });
    return { db: pgliteDb as unknown as AppDb, client, close: () => client.close() };
  }
  ```
  (El `as unknown as AppDb` es la única conversión de tipos permitida entre drizzle-pglite y drizzle-postgres-js: ambos implementan la misma API de `PgDatabase` que usa este proyecto — solo constructor de consultas, nunca `db.query.*` relacional.)
- `tests/integration/foundation.test.ts` — cuatro tests: (1) `getDbEnv({})` lanza `EnvError` cuyo mensaje contiene `DATABASE_URL`; (2) `getEmailEnv({ EMAIL_TRANSPORT: "resend", EMAIL_FROM: "a <a@b.cl>", EMAIL_REPLY_TO: "a@b.cl", SHOP_NOTIFY_EMAIL: "a@b.cl" })` lanza con `RESEND_API_KEY` en el mensaje; (3) tras `createTestDb()`, para cada tabla de `allTables`, `getTableConfig(tabla).name` aparece en `select table_name from information_schema.tables where table_schema = 'public'`; (4) insertar dos filas `booking_blocks` activas con misma `service_date`/`block_start` (con sus `bookings` válidas) hace que la segunda inserción rechace con un error para el que `isUniqueViolation` devuelve `true`, y una tercera fila con `is_active = false` en el mismo bloque se inserta sin error. Cada test cierra su PGlite.
- `src/pages/api/health.ts` — reemplazar por:
  ```ts
  import type { APIRoute } from "astro";
  import { getDb, pingDb } from "../../server/db/client.ts";

  export const prerender = false;

  export const GET: APIRoute = async () => {
    let db = false;
    try {
      db = await pingDb(getDb());
    } catch {
      db = false;
    }
    return new Response(JSON.stringify({ ok: db, db }), {
      status: db ? 200 : 503,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    });
  };
  ```
- Ejecutar `pnpm db:migrate` contra la base del workspace.

**Done when**
- [ ] WHEN `pnpm test tests/integration/foundation.test.ts` runs THE SYSTEM SHALL exit 0 with 0 failed, proving a missing `DATABASE_URL` is named, every table in `allTables` exists after migrations in PGlite, and a second active block on the same date and start is rejected.
- [ ] WHEN `pnpm db:migrate` runs twice against `DATABASE_URL` THE SYSTEM SHALL exit 0 both times.
- [ ] WHEN `pnpm db:check` runs THE SYSTEM SHALL exit 0 after confirming `select 1` and that every table created by `drizzle/*.sql` exists.
- [ ] WHEN the migration emitted by `pnpm db:generate` is read THE SYSTEM SHALL contain the index name `uq_booking_blocks_active_slot`.
- [ ] WHEN `sh scripts/smoke.sh` runs after `pnpm build` THE SYSTEM SHALL print a `/api/health` body containing `"db":true` and exit 0.

**Verify**
```bash
pnpm format                                               # expect: exit 0
pnpm check                                                # expect: exit 0
pnpm test tests/integration/foundation.test.ts            # expect: exit 0, 0 failed
grep -q 'uq_booking_blocks_active_slot' drizzle/*.sql     # expect: exit 0 — en la migración generada
pnpm db:migrate                                           # expect: exit 0
pnpm db:migrate                                           # expect: exit 0 — segunda vez, sin cambios
pnpm db:check                                             # expect: exit 0, imprime {"ok":true,...}
pnpm build                                                # expect: exit 0
sh scripts/smoke.sh | grep -q '"db":true'                 # expect: exit 0
```

**Checkpoint**
```bash
git add -A && git commit -m "feat: step 2 entorno y base de datos"
git tag step-02-database
git ls-files --error-unmatch drizzle/meta/_journal.json   # expect: exit 0 — migraciones commiteadas
```

---

#### Paso 3 — Motor de agenda (puro)

**Depende de:** 2.

**Do**
- `src/data/feriados-cl.json` — contenido exacto (feriados nacionales 2026 verificados el 2026-09-15 en https://festivos.online/chile/2026/ y contrastados con https://www.feriadoslegales.cl/; **2027 no se incluye**):
  ```json
  [
    { "date": "2026-01-01", "name": "Año Nuevo" },
    { "date": "2026-04-03", "name": "Viernes Santo" },
    { "date": "2026-04-04", "name": "Sábado Santo" },
    { "date": "2026-05-01", "name": "Día del Trabajo" },
    { "date": "2026-05-21", "name": "Día de las Glorias Navales" },
    { "date": "2026-06-21", "name": "Día Nacional de los Pueblos Indígenas" },
    { "date": "2026-06-29", "name": "San Pedro y San Pablo" },
    { "date": "2026-07-16", "name": "Virgen del Carmen" },
    { "date": "2026-08-15", "name": "Asunción de la Virgen" },
    { "date": "2026-09-18", "name": "Independencia Nacional" },
    { "date": "2026-09-19", "name": "Día de las Glorias del Ejército" },
    { "date": "2026-10-12", "name": "Encuentro de Dos Mundos" },
    { "date": "2026-10-31", "name": "Día de las Iglesias Evangélicas y Protestantes" },
    { "date": "2026-11-01", "name": "Día de Todos los Santos" },
    { "date": "2026-12-08", "name": "Inmaculada Concepción" },
    { "date": "2026-12-25", "name": "Navidad" }
  ]
  ```
- `src/server/booking/rules.ts` — constantes exportadas: `TIMEZONE = "America/Santiago"`, `BLOCK_MINUTES = 30`, `DAILY_CAPACITY = 4`, `MIN_NOTICE_MINUTES = 120`, `HORIZON_DAYS = 30`, `PICKUP_FEE_CLP = 15000`, `PICKUP_COMUNAS = ["Vitacura", "Las Condes"] as const`, `BLOCKS_PER_MODE = { taller: 1, retiro: 2 } as const`, `type BookingMode = keyof typeof BLOCKS_PER_MODE`, y `RECEPTION_HOURS: Record<number, { open: string; close: string } | null>` indexado por día ISO de luxon (1 = lunes … 7 = domingo): 1–5 `{ open: "15:00", close: "20:00" }`, 6 `{ open: "10:00", close: "14:00" }`, 7 `null`.
- `src/server/booking/holidays.ts` — `import feriados from "../../data/feriados-cl.json" with { type: "json" };` y exporta `HOLIDAYS: ReadonlyMap<string, string>` (fecha → nombre), `HOLIDAY_YEARS: ReadonlySet<string>` y `missingHolidayYears(fromDate: string, days: number): string[]` — los años (texto `"2027"`) que toca el rango `[fromDate, fromDate + days]` y que no están en `HOLIDAY_YEARS`, ordenados.
- `src/server/booking/slots.ts` — funciones puras con luxon (reloj siempre inyectado como `now: Date`; nada lee la hora del sistema):
  - `localToday(now: Date): string` y `addDays(date: string, days: number): string` (fechas `YYYY-MM-DD` en `TIMEZONE`).
  - `localToInstant(date: string, hhmm: string): Date | null` — `DateTime.fromISO(\`${date}T${hhmm}\`, { zone: TIMEZONE })`; devuelve `null` si el resultado es inválido **o** si `toFormat("HH:mm") !== hhmm` (hora local inexistente por cambio de horario).
  - `gridForDate(date: string): string[]` — inicios `HH:MM` cada 30 min desde `open` mientras `inicio + 30 <= close`; `[]` si el día es domingo; omite horas inexistentes.
  - Tipos: `DayStatus = "open" | "closed" | "holiday" | "full" | "blocked"`, `BlockState = "free" | "taken" | "late" | "noroom"`, `DayInput = { date: string; mode: BookingMode; now: Date; activeBlockStarts: string[]; blocked: { startTime: string | null; endTime: string | null }[]; usedCount: number }` (horas `HH:MM`), `DayAvailability = { date: string; status: DayStatus; holidayName: string | null; used: number; blocks: { start: string; state: BlockState }[] }`.
  - `computeDay(input: DayInput): DayAvailability` — reglas exactas de §5 (*GET /api/disponibilidad*), en su orden: horizonte/domingo → `closed`; `HOLIDAYS` → `holiday`; bloqueo sin horas → `blocked`; `usedCount >= DAILY_CAPACITY` → `full`; si no, `open` con estados por bloque (`taken` si está en `activeBlockStarts` o dentro de un rango `[startTime, endTime)`; `late` si `localToInstant(date, start) < now + 120 min`; `noroom` en `retiro` si el siguiente inicio no está en la grilla o es `taken`; si no, `free`).
  - `checkStart(input: DayInput & { start: string }): { ok: true; blockStarts: string[]; startsAt: Date; endsAt: Date } | { ok: false; reason: "closed" | "holiday" | "blocked" | "full" | "invalid_start" | "late" | "taken" | "noroom" }` — usa `computeDay`; `invalid_start` si `start` no está en la grilla.
- `tests/unit/slots.test.ts` — con `now` fijo `new Date("2026-09-16T19:04:00.000Z")` (16:04 hora local, UTC-3) salvo donde se indique:
  1. `gridForDate("2026-09-16")` (miércoles) empieza en `"15:00"` y termina en `"19:30"`; `gridForDate("2026-09-26")` (sábado) empieza en `"10:00"` y termina en `"13:30"`; `gridForDate("2026-09-20")` (domingo) es `[]`.
  2. Verano: `localToInstant("2026-01-15", "15:00")?.toISOString()` es `"2026-01-15T18:00:00.000Z"`. Invierno: `localToInstant("2026-06-15", "15:00")?.toISOString()` es `"2026-06-15T19:00:00.000Z"`.
  3. Fin de semana del cambio de septiembre: `localToInstant("2026-09-05", "10:00")` → `"2026-09-05T14:00:00.000Z"`; `localToInstant("2026-09-07", "15:00")` → `"2026-09-07T18:00:00.000Z"`; `localToInstant("2026-09-06", "00:00")` → `null`. Fin de semana del cambio de abril: `localToInstant("2026-04-02", "15:00")` → `"2026-04-02T18:00:00.000Z"`; `localToInstant("2026-04-06", "15:00")` → `"2026-04-06T19:00:00.000Z"`.
  4. `computeDay` para `2026-09-18` → `status: "holiday"`, `holidayName: "Independencia Nacional"`, `blocks: []`.
  5. Antelación: `computeDay` para `2026-09-16` `taller` → `15:00`…`18:00` son `late` y `18:30` es `free`.
  6. Horizonte: con `now` de arriba, `2026-10-16` es `open` y `2026-10-17` es `closed`.
  7. Tope: `usedCount: 4` → `status: "full"`, `blocks: []`.
  8. Retiro: `2026-09-17` `retiro` → `19:30` es `noroom`; con `activeBlockStarts: ["16:30"]`, `16:00` es `noroom` y `16:30` es `taken`; en `taller` `19:30` es `free`.
  9. Bloqueos: `blocked: [{ startTime: null, endTime: null }]` → `blocked`; `blocked: [{ startTime: "16:00", endTime: "17:00" }]` → `16:00` y `16:30` `taken`, `17:00` `free`.
  10. `checkStart` `retiro` `2026-09-17` `16:00` → `ok: true`, `blockStarts: ["16:00", "16:30"]`, `endsAt - startsAt` = 3 600 000 ms; `start: "16:15"` → `reason: "invalid_start"`.
  11. `missingHolidayYears("2026-12-10", 30)` → `["2027"]`; `missingHolidayYears("2026-09-16", 30)` → `[]`.

**Done when**
- [ ] WHEN `pnpm test tests/unit/slots.test.ts` runs THE SYSTEM SHALL exit 0 with 0 failed, asserting a 15:00 local booking maps to `2026-01-15T18:00:00.000Z` in summer and `2026-06-15T19:00:00.000Z` in winter.
- [ ] WHEN `localToInstant("2026-09-06", "00:00")` is evaluated THE SYSTEM SHALL return `null`, because that local time does not exist in America/Santiago.
- [ ] WHEN `computeDay` evaluates `2026-09-18` THE SYSTEM SHALL return `status` `holiday` with `holidayName` `Independencia Nacional`.
- [ ] WHEN `computeDay` evaluates a day with `usedCount` 4 THE SYSTEM SHALL return `status` `full` and no blocks.
- [ ] WHEN `computeDay` evaluates `retiro` for a weekday THE SYSTEM SHALL mark `19:30` as `noroom`.
- [ ] WHEN `missingHolidayYears("2026-12-10", 30)` is evaluated THE SYSTEM SHALL return `["2027"]`.

**Verify**
```bash
pnpm format                               # expect: exit 0
pnpm check                                # expect: exit 0
pnpm test tests/unit/slots.test.ts        # expect: exit 0, 0 failed
pnpm test                                 # expect: exit 0, 0 failed (suite completa)
```

**Checkpoint**
```bash
git add -A && git commit -m "feat: step 3 motor de agenda"
git tag step-03-slots
```

---

#### Paso 4 — Escritura de reservas

**Depende de:** 3.

**Do**
- `src/server/booking/tokens.ts` — `newCancelToken(): string` (`randomBytes(32).toString("base64url")`) y `hashCancelToken(token: string, secret: string = getCancelEnv().CANCEL_TOKEN_SECRET): string` (HMAC-SHA-256 hex). `CANCEL_TOKEN_SECRET` pasa a ser obligatoria desde este paso.
- `src/server/booking/create-booking.ts` — `createBooking(db: AppDb, input: CreateBookingInput, now: Date): Promise<CreateBookingResult>` con `CreateBookingInput = { mode: BookingMode; serviceDate: string; start: string; customerName: string; phoneE164: string; email: string; bike: string; description: string; comuna: string | null; address: string | null; ipHash: string | null }` y `CreateBookingResult = { ok: true; booking: Booking; cancelToken: string } | { ok: false; code: "slot_unavailable" | "phone_limit" }`. Dentro de `db.transaction`:
  1. `insert into booking_days (service_date) values ($date) on conflict do nothing` y `select service_date from booking_days where service_date = $date for update`.
  2. `select pg_advisory_xact_lock(hashtext($phone))`.
  3. Si existe una reserva `status = 'confirmed'` con ese `phone_e164` y `starts_at > now` → `{ ok: false, code: "phone_limit" }`.
  4. Leer bloques activos de la fecha, bloqueos de la fecha y `used` (= reservas de la fecha con `status <> 'cancelled'`); `checkStart(...)`; si `ok: false` → `{ ok: false, code: "slot_unavailable" }`.
  5. Código: base `VB-AAMMDD-HHMM` (de `serviceDate` y `start`); `n` = reservas cuyo `code` es la base o empieza con `base-`; código = base si `n = 0`, si no `base-(n+1)`.
  6. `insert` en `bookings` (`status: "confirmed"`, `pickupFeeClp` 0 o `PICKUP_FEE_CLP`, `consentAt: now`, `cancelTokenHash: hashCancelToken(token)`) `returning`, e `insert` de un `booking_blocks` por cada `blockStart` (`HH:MM:00`).
  Una excepción con `isUniqueViolation(error) === true` se captura **fuera** de la transacción y se devuelve `{ ok: false, code: "slot_unavailable" }`; cualquier otra se relanza. Sin correo ni red dentro de la transacción.
- `src/server/booking/cancel-booking.ts` — `cancelBooking(db: AppDb, args: { bookingId: string; by: "customer" | "admin"; now: Date }): Promise<{ ok: true; booking: Booking } | { ok: false; code: "not_found" | "already_cancelled" | "not_cancellable" | "started" }>`. En una transacción: `select … for update` de la reserva; `not_found` si no existe; `already_cancelled` si `status = 'cancelled'`; `not_cancellable` si `completed` o `no_show`; `started` si `by = "customer"` y `starts_at <= now`; si no, `status = 'cancelled'`, `cancelled_at = now`, `cancelled_by = by`, `cancel_token_used_at = now` cuando `by = "customer"`, y `is_active = false` en todos sus `booking_blocks`.
- `tests/integration/create-booking.test.ts` — PGlite nuevo por test (`createTestDb()`), `now = new Date("2026-09-15T15:00:00.000Z")`; cada test crea sus propias reservas previas:
  1. `taller` `2026-09-16` `16:30` → `ok: true`, `code` `VB-260916-1630`, `startsAt.toISOString()` `2026-09-16T19:30:00.000Z`, `pickupFeeClp` 0, 1 bloque activo.
  2. `retiro` `2026-09-16` `16:00` con `comuna: "Vitacura"` → 2 bloques activos (`16:00:00`, `16:30:00`), `pickupFeeClp` 15000.
  3. Tras una reserva `taller` a las `16:30`, un segundo intento al mismo bloque (otro teléfono) → `slot_unavailable`; sigue 1 bloque activo en `16:30:00`.
  4. `retiro` a `19:30` → `slot_unavailable`.
  5. Con 4 reservas creadas en `2026-09-17`, la quinta → `slot_unavailable`.
  6. Mismo teléfono, otro día futuro → `phone_limit`.
  7. `2026-09-18` (feriado) → `slot_unavailable`.
  8. `cancelBooking({ by: "customer" })` de una reserva `taller` a las `16:30` → sus bloques quedan `is_active = false`; una nueva reserva al mismo bloque → `ok: true` con `code` `VB-260916-1630-2`.
  9. `cancelBooking({ by: "customer", now: new Date("2026-09-16T19:31:00.000Z") })` sobre una reserva de las 16:30 → `started`; con `by: "admin"` → `ok: true`.
- `tests/integration/concurrency.test.ts` — un PGlite; 50 llamadas a `createBooking` lanzadas con `Promise.all` al mismo bloque `2026-09-16` `16:30` `taller`, cada una con un teléfono distinto (`"+569" + String(10000000 + i)`, es decir `+56910000000` … `+56910000049`); afirma exactamente 1 `ok: true`, 49 `slot_unavailable`, y `select count(*) from booking_blocks where is_active and service_date = '2026-09-16' and block_start = '16:30:00'` = 1. (PGlite serializa las transacciones en su única conexión; la garantía bajo concurrencia real la da el índice único parcial más los bloqueos de §4, que este mismo código usa contra Postgres de Replit.)

**Done when**
- [ ] WHEN `pnpm test tests/integration/create-booking.test.ts` runs THE SYSTEM SHALL exit 0 with 0 failed.
- [ ] WHEN a `taller` booking is created for `2026-09-16` at `16:30` THE SYSTEM SHALL store code `VB-260916-1630` and exactly 1 active block.
- [ ] WHEN a `retiro` booking is created THE SYSTEM SHALL store 2 consecutive active blocks and `pickup_fee_clp` 15000.
- [ ] WHEN a date already has 4 non-cancelled bookings THE SYSTEM SHALL reject a fifth with `slot_unavailable`.
- [ ] WHEN a booking is cancelled THE SYSTEM SHALL set its blocks `is_active = false` and allow a new booking in that block with code `VB-260916-1630-2`.
- [ ] WHEN 50 concurrent `createBooking` calls target one block THE SYSTEM SHALL return exactly 1 success and 49 `slot_unavailable`, leaving 1 active block row.

**Verify**
```bash
pnpm format                                          # expect: exit 0
pnpm check                                           # expect: exit 0
pnpm test tests/integration/create-booking.test.ts   # expect: exit 0, 0 failed
pnpm test tests/integration/concurrency.test.ts      # expect: exit 0, 0 failed
pnpm test                                            # expect: exit 0, 0 failed
```

**Checkpoint**
```bash
git add -A && git commit -m "feat: step 4 escritura de reservas"
git tag step-04-booking-writes
```

---

#### Paso 5 — API pública

**Depende de:** 4. Desde este paso son obligatorias `TURNSTILE_SECRET_KEY` y `SESSION_SECRET`.

**Do**
- `src/server/api/client-ip.ts` — `clientIp(request: Request, fallback: string | null): string | null`: recorre `x-forwarded-for` de derecha a izquierda (`ipFromForwardedFor`) y devuelve la primera IP válida fuera de los rangos de confianza (34/8, 35/8, 10/8, 172.16/12, 192.168/16, 127/8, `::1`, fc00::/7, fe80::/10, con `node:net` `BlockList`); si todas son de confianza, la última; sin `x-forwarded-for`, `x-real-ip`, `cf-connecting-ip` y `fallback`. Tests en `tests/unit/client-ip.test.ts`.
- `src/server/api/turnstile.ts` — `verifyTurnstile(args: { token: string; ip: string | null; secret: string; fetchFn?: typeof fetch }): Promise<boolean>`: `POST https://challenges.cloudflare.com/turnstile/v0/siteverify` con cuerpo `URLSearchParams` (`secret`, `response`, y `remoteip` si hay IP); devuelve `true` solo si el JSON trae `success === true`; cualquier error de red o JSON → `false` (y log `turnstile.error`).
- `src/server/api/handlers.ts` — sin imports de `astro`:
  - `type HandlerContext = { db: AppDb; now: Date; ip: string | null; fetchFn?: typeof fetch; onCreated?: (booking: Booking, cancelToken: string) => Promise<void> }`.
  - `hashIp(ip: string | null): string | null` (HMAC-SHA-256 hex con `getHashEnv().SESSION_SECRET`).
  - `jsonResponse(status: number, body: unknown, headers?: Record<string, string>): Response` y `errorResponse(status, code, error, fields?)` con la forma de error de §5.
  - `normalizePhone(raw: string): string | null` según §5.
  - `handleAvailability(url: URL, ctx: HandlerContext): Promise<Response>` — zod para `desde`/`dias`/`modo` (§5); una consulta de bloques activos, bloqueos y conteo por fecha para el rango; `computeDay` por día; respuesta 200 con la forma exacta de §5.
  - `handleCreateBooking(request: Request, ctx: HandlerContext): Promise<Response>` — orden y códigos exactos de §5: rate limit en `booking_requests` (≥ 5 en 10 min → 429 con `Retry-After: 600`), JSON + zod (claves desconocidas rechazadas, mensajes de la tabla de §5) → 422, Turnstile (`getTurnstileEnv().TURNSTILE_SECRET_KEY`) → 403, `createBooking` → 409 (`slot_unavailable` o `phone_limit` con sus mensajes) o 201 `{ code, service_date, start, end, mode, fee }`; después del 201 llama `await ctx.onCreated?.(booking, cancelToken)` dentro de `try/catch` que registra `email.failed` y nunca cambia el 201. Excepción inesperada → 500 `internal_error` con log.
- `src/pages/api/disponibilidad.ts` — `export const prerender = false;` `GET: APIRoute = ({ url, request, clientAddress }) => handleAvailability(url, { db: getDb(), now: new Date(), ip: clientIp(request, clientAddress) })`.
- `src/pages/api/reservas.ts` — `export const prerender = false;` `POST: APIRoute = ({ request, clientAddress }) => handleCreateBooking(request, { db: getDb(), now: new Date(), ip: clientIp(request, clientAddress) })`.
- `tests/integration/api.test.ts` — PGlite, `now = new Date("2026-09-15T15:00:00.000Z")`, `fetchFn` falso (nunca red) que devuelve `{ "success": true }` o `{ "success": false }` según el test:
  1. `GET ?desde=2026-09-16&dias=4&modo=taller` → 200; `days` tiene las fechas `2026-09-16`…`2026-09-19`; `2026-09-18` y `2026-09-19` con `status: "holiday"`.
  2. `?dias=40` → 422 con `code: "validation_error"` y `fields.dias`.
  3. POST válido → 201 con cuerpo exacto `{"code":"VB-260916-1630","service_date":"2026-09-16","start":"16:30","end":"17:00","mode":"taller","fee":0}`; `onCreated` falso invocado 1 vez.
  4. POST `retiro` sin `comuna` → 422 con `fields.comuna`; teléfono `12345` → 422 con `fields.telefono`.
  5. Turnstile `success: false` → 403 `turnstile_failed` y 0 filas en `bookings`.
  6. POST al bloque ya tomado → 409 con `{"error":"El bloque ya no está disponible","code":"slot_unavailable"}`.
  7. Seis POST desde la misma IP → el sexto responde 429 con header `Retry-After` `600`.
  8. `onCreated` que lanza un error → la respuesta sigue siendo 201.

**Done when**
- [ ] WHEN `pnpm test tests/integration/api.test.ts` runs THE SYSTEM SHALL exit 0 with 0 failed, with Turnstile mocked and no network access.
- [ ] WHEN `GET /api/disponibilidad` receives `dias=40` THE SYSTEM SHALL return 422 with `code` `validation_error` and a `fields.dias` entry.
- [ ] WHEN `POST /api/reservas` receives a valid `taller` booking for `2026-09-16` at `16:30` THE SYSTEM SHALL return 201 with body `{"code":"VB-260916-1630","service_date":"2026-09-16","start":"16:30","end":"17:00","mode":"taller","fee":0}`.
- [ ] WHEN Turnstile verification returns `success: false` THE SYSTEM SHALL return 403 with `code` `turnstile_failed` and insert no booking.
- [ ] WHEN a sixth POST arrives from one IP within 10 minutes THE SYSTEM SHALL return 429 with header `Retry-After: 600`.
- [ ] WHEN `sh scripts/smoke.sh` runs after `pnpm build` THE SYSTEM SHALL exit 0, proving the new endpoints do not break server startup.

**Verify**
```bash
pnpm format                                  # expect: exit 0
pnpm check                                   # expect: exit 0
pnpm test tests/integration/api.test.ts      # expect: exit 0, 0 failed
pnpm test                                    # expect: exit 0, 0 failed
pnpm build                                   # expect: exit 0
sh scripts/smoke.sh                          # expect: exit 0
```

**Checkpoint**
```bash
git add -A && git commit -m "feat: step 5 api publica"
git tag step-05-public-api
```

---

#### Paso 6 — Landing estática

**Depende de:** 1.

**Do**
- `src/lib/site.ts` — exporta `SITE` con valores literales: `name: "Vector Bikes"`, `streetAddress: "Avenida Kennedy 7666"`, `addressShort: "Av. Kennedy 7666, Vitacura"`, `locality: "Vitacura"`, `region: "Región Metropolitana"`, `country: "CL"`, `email: "info@vectorbikes.cl"`, `instagramUrl: "https://instagram.com/vector.bikes"`, `instagramHandle: "@vector.bikes"`, `mapsUrl: "https://www.google.com/maps/search/?api=1&query=Avenida+Kennedy+7666+Vitacura"`; y `whatsappHref(raw: string | undefined): string | null` → quita todo lo que no sea dígito; `null` si quedan menos de 8 dígitos; si no `https://wa.me/<dígitos>`.
- `src/layouts/Base.astro` — agregar prop `chrome?: "site" | "none"` (default `"site"`). Con `"site"` renderiza, fuera de `<main>`: el `header.site-head` del prototipo (wordmark `<a href="/" class="wordmark" aria-label="Vector Bikes, inicio"></a>` y `nav aria-label="Principal"` con enlaces `/#como-funciona` "Cómo funciona", `/#retiro` "Retiro a domicilio", `/#taller` "Taller", `/#preguntas` "Preguntas" y `/#reservar` con clase `btn` "Reservar hora"); el `footer.foot` del prototipo con el texto de privacidad `Usamos tus datos solo para gestionar tu reserva y contactarte sobre tu bicicleta. Escríbenos a info@vectorbikes.cl para revisarlos o eliminarlos.` más el enlace `<a href="/privacidad">Aviso de privacidad</a>`, y los enlaces `SITE.instagramUrl` (texto `@vector.bikes`), `mailto:info@vectorbikes.cl` (texto `info@vectorbikes.cl`) y `SITE.mapsUrl` con texto exacto `Av. Kennedy 7666, Vitacura` (enlaces externos con `rel="noopener"` y `target="_blank"`, íconos SVG del prototipo con `aria-hidden="true"`); y el `a.wa` **solo si** `whatsappHref(import.meta.env.PUBLIC_WHATSAPP_NUMBER)` no es `null`: `<a class="wa" href={href} rel="noopener" target="_blank" aria-label="Escríbenos por WhatsApp">` con el SVG del prototipo y `<span>WhatsApp</span>`. Si es `null`, no se emite nada (ni oculto).
- `src/components/Landing.astro` — prop `siteKey: string` (la usa el paso 7). Reproduce, en este orden y con el texto exacto de `docs/design-preview.html` (líneas 243–425): `section.hero` (etiqueta `Taller de bicicletas · Vitacura`, `<h1>Mecánica de precisión.</h1>`, lede, botones `Reservar hora` → `#reservar` y `Retiro y devolución · $15.000` → `#retiro`, la escala de horario **renderizada en el servidor** con la misma geometría que `drawScale` del prototipo — eje 10:00–20:00, segmento Lun–Vie 15:00–20:00 y Sáb 10:00–14:00, un tick cada 30 min con `major` en horas en punto, números 10:00/12:00/14:00/16:00/18:00/20:00 — y el `.drawing` con `.mark` y el SVG de cota `Ø 622 MM · RUEDA 700C`, `aria-hidden="true"`); `section#como-funciona` (h2 y 3 pasos con h3); `section#reservar` con su `.sec-head` (h2 `Elige día y bloque.` y el párrafo de horario) y, como marcador hasta el paso 7, `<p class="ruler-note">Cargando reservas…</p>`; `section#retiro` (con su h2); `section#taller` — la etiqueta `Taller` se renderiza como `<h2 class="label">Taller</h2>` para no saltar niveles de encabezado —, dirección, enlace `Abrir en Google Maps ↗` a `SITE.mapsUrl` y tabla de horario; `section#preguntas` con los 5 `details` del prototipo. Todas las etiquetas no-void cerradas (Astro 7 las rechaza abiertas).
- `src/pages/index.astro` — `export const prerender = true;`; `<Base title=… description=… path="/"><Landing siteKey={import.meta.env.PUBLIC_TURNSTILE_SITE_KEY ?? ""} /></Base>` con el mismo `title` y `description` del paso 1.
- `tests/build/landing.test.ts` — lee `dist/client/index.html`:
  1. contiene exactamente una ocurrencia de `<h1`, y el texto `Mecánica de precisión.`;
  2. los `id` `como-funciona`, `reservar`, `retiro`, `taller`, `preguntas` aparecen en ese orden;
  3. contiene `Av. Kennedy 7666, Vitacura`, `https://instagram.com/vector.bikes`, `mailto:info@vectorbikes.cl` y `query=Avenida+Kennedy+7666+Vitacura`;
  4. contiene dos elementos `class="scale"`;
  5. WhatsApp: calcula `raw = process.env.PUBLIC_WHATSAPP_NUMBER ?? parseEnv(readFileSync(".env", "utf8")).PUBLIC_WHATSAPP_NUMBER` (`parseEnv` de `node:util`; `.env` solo si existe), igual que Vite al construir; si `whatsappHref(raw)` es `null` el HTML **no** contiene `class="wa"`, si no contiene `href="<whatsappHref(raw)>"`;
  6. `whatsappHref(undefined)` y `whatsappHref("")` son `null`, y `whatsappHref("+56 9 1234 5678")` es `https://wa.me/56912345678`.

**Done when**
- [ ] WHEN `pnpm test:build tests/build/landing.test.ts` runs after `pnpm build` THE SYSTEM SHALL exit 0 with 0 failed.
- [ ] WHEN `dist/client/index.html` is read THE SYSTEM SHALL contain exactly one `<h1` and the section ids `como-funciona`, `reservar`, `retiro`, `taller`, `preguntas` in that order.
- [ ] WHEN `dist/client/index.html` is read THE SYSTEM SHALL contain the footer text `Av. Kennedy 7666, Vitacura` and the link `https://instagram.com/vector.bikes`.
- [ ] WHEN `PUBLIC_WHATSAPP_NUMBER` is empty at build time THE SYSTEM SHALL emit no element with `class="wa"`.
- [ ] WHEN `whatsappHref("+56 9 1234 5678")` is evaluated THE SYSTEM SHALL return `https://wa.me/56912345678`.

**Verify**
```bash
pnpm format                                       # expect: exit 0
pnpm check                                        # expect: exit 0
pnpm test                                         # expect: exit 0, 0 failed
pnpm build                                        # expect: exit 0
pnpm test:build tests/build/landing.test.ts       # expect: exit 0, 0 failed
sh scripts/smoke.sh                               # expect: exit 0
```

**Checkpoint**
```bash
git add -A && git commit -m "feat: step 6 landing estatica"
git tag step-06-landing
```

---

#### Paso 7 — Isla de reserva (Preact)

**Depende de:** 5, 6.

**Do**
- `src/components/islands/booking-state.ts` — módulo puro (sin DOM, sin `fetch`). Exporta tipos `Mode`, `ApiDay` (forma de `days[]` de §5), `FormValues = { nombre: string; telefono: string; correo: string; bicicleta: string; descripcion: string; comuna: string; direccion: string; consentimiento: boolean }`, `BookingResult` (forma del 201 de §5), `State` y `Action`, y:
  - `initialState: State` (`mode: "taller"`, disponibilidad `idle`, sin selección, formulario vacío, `submit.status: "idle"`).
  - `bookingReducer(state: State, action: Action): State` con acciones `setMode`, `loadStart`, `loadSuccess`, `loadError`, `selectDate`, `selectStart`, `setField`, `setTurnstile`, `submitStart`, `submitSuccess`, `submitFailed` (`{ status: number; body: { error?: string; code?: string; fields?: Record<string, string> } }`). Reglas: `setMode` limpia `selectedStart`; `selectDate` se ignora si el día no está `open` y limpia `selectedStart`; `selectStart` solo acepta bloques `free`; `submitFailed` con 422 copia `fields` a `errors`, con 409 limpia `selectedStart` y guarda el `error` del servidor, con 403/429/otros guarda el mensaje de §6; todo `submitFailed` pone `turnstileToken: null`.
  - `validateForm(state: State): Partial<Record<keyof FormValues | "bloque", string>>` — replica las reglas y mensajes de §5 (`bloque` → `Elige un bloque libre para continuar.`).
  - `selectedBlocks(state: State): string[]` — `[]`, `[start]` o `[start, start+30]` en `retiro`.
  - `ticketCode(date: string, start: string): string` → `VB-AAMMDD-HHMM`; `formatClp(amount: number): string` → `$` + miles con punto implementado con regex (`$15.000`), sin `toLocaleString`.
- `src/components/islands/BookingIsland.tsx` — `export default function BookingIsland({ siteKey }: { siteKey: string })` con `useReducer(bookingReducer, initialState)`. Marcado y clases idénticos al `form.booking` del prototipo (fieldsets 1–4, `.modes`, `.days`, `.ruler` con `.ruler-ticks` y `.slots`, `.legend`, `.ruler-note`, `.fields` con ids `f-nombre`, `f-tel`, `f-mail`, `f-bici`, `f-desc`, `f-comuna`, `f-dir`, `f-ok`, y `aside.ticket` "Orden de reserva"); los campos de retiro se renderizan siempre con `hidden` cuando `mode` es `taller`; el enlace de consentimiento apunta a `/privacidad`. Efectos: al montar y en cada cambio de `mode`, `fetch("/api/disponibilidad?desde=<hoy en America/Santiago vía Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' })>&dias=14&modo=<mode>")`. Chips de día: `Hoy` para hoy, `dd mmm`, subtítulo `used/4 bicis`, o `Feriado`/`Cerrado`/`Completo`/`Bloqueado` con `disabled`. Bloques: `button` con `aria-pressed`, `aria-disabled` y `aria-label` `"HH:MM"`, `"HH:MM, reservado"` o `"HH:MM, fuera de plazo"`. Turnstile: carga una vez `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit`, `window.turnstile.render(contenedor, { sitekey: siteKey, language: "es", callback, "expired-callback" })`, y `window.turnstile.reset()` tras cada `submitFailed`. Envío: `validateForm`; si hay errores, foco al primer campo inválido (`aria-invalid="true"`, mensaje en `<span class="err" id="err-<campo>">` referenciado por `aria-describedby`) y resumen en la región viva del ticket; si no, `POST /api/reservas` con el cuerpo de §5 y despacho `submitSuccess`/`submitFailed`; tras 409 vuelve a pedir disponibilidad. Estados de carga/vacío/error y textos exactos de §6.
- `src/components/Landing.astro` — reemplazar el marcador de `#reservar` por `<BookingIsland client:visible siteKey={siteKey} />` (import `./islands/BookingIsland.tsx`).
- `tests/unit/booking-state.test.ts` — (1) `setMode` a `retiro` deja `selectedStart` en `null`; (2) `selectDate` de un día `holiday` devuelve el estado sin cambios; (3) `selectStart` de un bloque `taken` no cambia el estado y de uno `free` lo selecciona; (4) `selectedBlocks` en `retiro` con `16:00` es `["16:00", "16:30"]`; (5) `validateForm` en `retiro` sin comuna ni consentimiento devuelve `comuna: "Elige Vitacura o Las Condes."` y `consentimiento: "Acepta el aviso de privacidad para confirmar."`; (6) `submitFailed` 409 deja `selectedStart` en `null` y `submit.message` `El bloque ya no está disponible`; (7) `ticketCode("2026-09-16", "16:30")` es `VB-260916-1630` y `formatClp(15000)` es `$15.000`.
- `tests/build/island.test.ts` — lee `dist/client/index.html`: contiene `<astro-island`, un atributo `component-url` que incluye `BookingIsland`, `for="f-nombre"`, `for="f-tel"`, `for="f-mail"`, `for="f-bici"`, `for="f-desc"`, `for="f-comuna"`, `for="f-dir"`, `id="f-ok"`, y los textos `Orden de reserva` y `Confirmar reserva`.

**Done when**
- [ ] WHEN `pnpm test tests/unit/booking-state.test.ts` runs THE SYSTEM SHALL exit 0 with 0 failed.
- [ ] WHEN the reducer receives `submitFailed` with status 409 THE SYSTEM SHALL clear the selected block and set the message `El bloque ya no está disponible`.
- [ ] WHEN `ticketCode("2026-09-16", "16:30")` and `formatClp(15000)` are evaluated THE SYSTEM SHALL return `VB-260916-1630` and `$15.000`.
- [ ] WHEN `pnpm test:build tests/build/island.test.ts` runs after `pnpm build` THE SYSTEM SHALL find an `astro-island` whose `component-url` includes `BookingIsland` in `dist/client/index.html`.
- [ ] WHEN `dist/client/index.html` is read THE SYSTEM SHALL contain labels `for="f-nombre"`, `for="f-tel"`, `for="f-mail"`, `for="f-bici"`, `for="f-desc"`, `for="f-comuna"` and `for="f-dir"`.

**Verify**
```bash
pnpm format                                       # expect: exit 0
pnpm check                                        # expect: exit 0
pnpm test tests/unit/booking-state.test.ts        # expect: exit 0, 0 failed
pnpm test                                         # expect: exit 0, 0 failed
pnpm build                                        # expect: exit 0
pnpm test:build                                   # expect: exit 0, 0 failed (landing + island)
sh scripts/smoke.sh                               # expect: exit 0
```

**Checkpoint**
```bash
git add -A && git commit -m "feat: step 7 isla de reserva"
git tag step-07-booking-island
```

---

#### Paso 8 — Correos

**Depende de:** 5. Desde este paso son obligatorias `EMAIL_TRANSPORT`, `EMAIL_FROM`, `EMAIL_REPLY_TO`, `SHOP_NOTIFY_EMAIL`, `PUBLIC_SITE_URL` (y `RESEND_API_KEY` solo con `EMAIL_TRANSPORT=resend`).

**Do**
- `src/server/email/transport.ts` — tipos `EmailMessage = { to: string; subject: string; text: string; html: string; attachments?: { filename: string; content: string; contentType: string }[] }` y `EmailTransport = { send(message: EmailMessage): Promise<void> }`; `export const consoleOutbox: EmailMessage[] = []`; `createTransport(env = getEmailEnv()): EmailTransport`. `console`: agrega el mensaje a `consoleOutbox` y registra `{"event":"email.console","subject":…}` (sin cuerpo). `resend`: `new Resend(env.RESEND_API_KEY).emails.send({ from: env.EMAIL_FROM, to: message.to, replyTo: env.EMAIL_REPLY_TO, subject, text, html, attachments: [{ filename, content: Buffer.from(content).toString("base64") }] })` y lanza si la respuesta trae `error`.
- `src/server/email/templates.ts` — funciones puras que devuelven `{ subject: string; text: string; html: string }`, todo el contenido de usuario pasado por `escapeHtml` en el HTML; fechas con luxon en `America/Santiago` (hora siempre `HH:mm`):
  1. `confirmationEmail(booking, cancelUrl)` — asunto `Reserva confirmada <code> · Vector Bikes`; incluye código, día, rango horario, modalidad (`La dejo en el taller` / `Retiro y devolución`), `Av. Kennedy 7666, Vitacura` (taller) o `<comuna> — <dirección>` (retiro), recargo (`$0` o `$15.000`), `Pagas al recibir tu bici: efectivo, transferencia o tarjeta.`, `Si encontramos algo extra, te llamamos antes de hacer cualquier trabajo adicional; puede o no tener costo.`, el enlace `cancelUrl` con el texto `Cancelar mi reserva` y el contacto `info@vectorbikes.cl`.
  2. `shopNewBookingEmail(booking)` — asunto `Nueva reserva <code> · <modalidad> · <HH:mm>`; incluye nombre, teléfono, correo, bicicleta, descripción, comuna y dirección.
  3. `reminderEmail(booking)` — asunto `Recordatorio: mañana a las <HH:mm> · Vector Bikes`; incluye código, hora, lugar o retiro y `Si no puedes, cancela con el enlace de tu correo de confirmación.`
  4. `shopCancelledEmail(booking)` — asunto `Reserva cancelada <code> · <HH:mm>`; incluye quién canceló (`cliente` / `taller`).
- `src/server/email/notifications.ts` — `buildIcs(booking): string` con `createEvent` de `ics` (`start`/`end` como arreglos UTC `[año, mes, día, hora, minuto]` con `startInputType: "utc"` y `startOutputType: "utc"`, `title: "Vector Bikes · <modalidad>"`, `location`, `description` con el código, `uid: "<booking.id>@vectorbikes.cl"`); lanza si `createEvent` devuelve `error`. `notifyBookingCreated(booking, cancelToken, deps = defaultDeps())` envía (1) al correo del cliente con adjunto `reserva-vector-bikes.ics` (`text/calendar`) y `cancelUrl = new URL("/reservas/cancelar?token=" + encodeURIComponent(cancelToken), PUBLIC_SITE_URL)`, y (2) a `SHOP_NOTIFY_EMAIL`. `notifyBookingCancelled(booking, deps = defaultDeps())` envía (4) a `SHOP_NOTIFY_EMAIL`. `deps = { transport: EmailTransport; shopEmail: string; siteUrl: string }`. Cada fallo de envío se registra `email.failed` con el código de la reserva y se relanza al llamador.
- `src/pages/api/reservas.ts` — agregar `onCreated: (booking, cancelToken) => notifyBookingCreated(booking, cancelToken)` al contexto (el handler del paso 5 ya lo invoca **después** del commit y absorbe su error).
- `tests/integration/email.test.ts` — vacía `consoleOutbox` antes de cada test; transporte `createTransport()` (el setup fuerza `EMAIL_TRANSPORT=console`):
  1. Con una reserva `taller` `2026-09-16` `16:30` creada en PGlite, `notifyBookingCreated` deja 2 mensajes: el primero al correo del cliente con asunto que contiene `VB-260916-1630`, texto que contiene `/reservas/cancelar?token=`, y adjunto `reserva-vector-bikes.ics` cuyo contenido contiene `BEGIN:VCALENDAR` y `DTSTART:20260916T193000Z`; el segundo a `info@vectorbikes.cl`.
  2. Una reserva `retiro` en `Vitacura` produce un correo al cliente cuyo texto contiene `$15.000` y `Vitacura`.
  3. Una descripción `<script>alert(1)</script>` aparece en el HTML del correo al taller como `&lt;script&gt;`.
  4. `notifyBookingCancelled` deja 1 mensaje a `info@vectorbikes.cl` con asunto que contiene `Reserva cancelada`.
  5. `handleCreateBooking` con `onCreated` = `notifyBookingCreated` responde 201 y deja 2 mensajes en `consoleOutbox`.

**Done when**
- [ ] WHEN `pnpm test tests/integration/email.test.ts` runs THE SYSTEM SHALL exit 0 with 0 failed and no network access.
- [ ] WHEN a booking is created through `handleCreateBooking` THE SYSTEM SHALL return 201 and then queue exactly 2 messages: one to the customer and one to `info@vectorbikes.cl`.
- [ ] WHEN the customer confirmation is built THE SYSTEM SHALL attach `reserva-vector-bikes.ics` containing `BEGIN:VCALENDAR` and include a link containing `/reservas/cancelar?token=`.
- [ ] WHEN customer-provided text contains `<script>` THE SYSTEM SHALL render it escaped as `&lt;script&gt;` in email HTML.
- [ ] WHEN `notifyBookingCancelled` runs THE SYSTEM SHALL queue 1 message to `info@vectorbikes.cl` whose subject contains `Reserva cancelada`.

**Verify**
```bash
pnpm format                                   # expect: exit 0
pnpm check                                    # expect: exit 0
pnpm test tests/integration/email.test.ts     # expect: exit 0, 0 failed
pnpm test                                     # expect: exit 0, 0 failed
pnpm build                                    # expect: exit 0
sh scripts/smoke.sh                           # expect: exit 0
```

**Checkpoint**
```bash
git add -A && git commit -m "feat: step 8 correos"
git tag step-08-emails
```

---

#### Paso 9 — Cancelación

**Depende de:** 8.

**Do**
- `src/server/api/handlers.ts` — agregar `isAllowedOrigin(request: Request, siteUrl: string = getSiteEnv().PUBLIC_SITE_URL): boolean` → `true` solo si el header `Origin` existe y es igual a `new URL(siteUrl).origin`. (Lo usan la cancelación y todo POST de admin.)
- `src/server/booking/cancel-flow.ts` — `type CancelView = { kind: "invalid" } | { kind: "cancelled"; booking: Booking } | { kind: "started"; booking: Booking } | { kind: "confirm"; booking: Booking; token: string } | { kind: "done"; booking: Booking }`.
  - `viewCancellation(db: AppDb, token: string | null, now: Date): Promise<CancelView>` — busca por `cancel_token_hash = hashCancelToken(token)`; `invalid` si falta o no existe; `cancelled` si `status = 'cancelled'`; `started` si `starts_at <= now` o `status` es `completed`/`no_show`; si no, `confirm`.
  - `performCancellation(db: AppDb, token: string | null, now: Date, notify = notifyBookingCancelled): Promise<CancelView>` — mismo lookup; si la vista no es `confirm`, la devuelve sin escribir; si lo es, `cancelBooking(db, { bookingId, by: "customer", now })` y, **después** de que esa transacción terminó, `await notify(booking)` dentro de `try/catch` que registra `email.failed`; devuelve `done`.
- `src/pages/reservas/cancelar.astro` — `export const prerender = false;` `Base` con `noindex` y `title="Cancelar reserva — Vector Bikes"`, `path="/reservas/cancelar"`. GET: `viewCancellation(getDb(), Astro.url.searchParams.get("token"), new Date())`. POST: si `!isAllowedOrigin(Astro.request)` → `Astro.response.status = 403` y texto `Solicitud no válida.`; si no, lee `token` del formulario y `performCancellation`. Render por `kind` con los textos exactos de §5 (`confirm`: resumen + `<form method="post">` con `<input type="hidden" name="token">` y botón `.btn` `Cancelar reserva`; `done`: `Tu reserva <code> fue cancelada. El bloque quedó libre.`); `invalid` responde 404.
- `tests/integration/cancel-flow.test.ts` — PGlite, `consoleOutbox` vacío, reserva `taller` `2026-09-16` `16:30` creada con `now = 2026-09-15T15:00:00.000Z` (su `cancelToken` sale de `createBooking`):
  1. `viewCancellation` con el token → `kind: "confirm"`.
  2. `performCancellation` → `kind: "done"`; en la base `status = 'cancelled'`, `cancelled_by = 'customer'`, `cancel_token_used_at` no nulo, sus bloques `is_active = false`; `consoleOutbox` tiene 1 mensaje a `info@vectorbikes.cl` con asunto que contiene `Reserva cancelada`.
  3. Segundo `performCancellation` con el mismo token → `kind: "cancelled"`, `consoleOutbox` sigue con 1 mensaje y `updated_at` de la reserva no cambia.
  4. Token `no-existe` → `kind: "invalid"`.
  5. Con `now = 2026-09-16T19:31:00.000Z`, `viewCancellation` → `kind: "started"` y `performCancellation` deja `status = 'confirmed'`.
  6. `isAllowedOrigin` con `Origin: https://vectorbikes.cl` y `siteUrl` `https://vectorbikes.cl` → `true`; con `Origin: https://evil.example` → `false`; sin `Origin` → `false`.

**Done when**
- [ ] WHEN `pnpm test tests/integration/cancel-flow.test.ts` runs THE SYSTEM SHALL exit 0 with 0 failed.
- [ ] WHEN a customer confirms cancellation with a valid token before the booking starts THE SYSTEM SHALL set `status` `cancelled`, `cancelled_by` `customer`, set `cancel_token_used_at`, deactivate its blocks, and queue 1 email to `info@vectorbikes.cl`.
- [ ] WHEN the same cancellation token is submitted a second time THE SYSTEM SHALL return the `cancelled` view, write no rows and send no email.
- [ ] WHEN the booking has already started THE SYSTEM SHALL return the `started` view and keep `status` `confirmed`.
- [ ] WHEN a POST carries an `Origin` different from the origin of `PUBLIC_SITE_URL` THE SYSTEM SHALL reject it (`isAllowedOrigin` returns `false`).

**Verify**
```bash
pnpm format                                        # expect: exit 0
pnpm check                                         # expect: exit 0
pnpm test tests/integration/cancel-flow.test.ts    # expect: exit 0, 0 failed
pnpm test                                          # expect: exit 0, 0 failed
pnpm build                                         # expect: exit 0
sh scripts/smoke.sh                                # expect: exit 0
```

**Checkpoint**
```bash
git add -A && git commit -m "feat: step 9 cancelacion"
git tag step-09-cancellation
```

---

#### Paso 10 — Acceso admin

**Depende de:** 9 (usa `isAllowedOrigin` y `hashIp` de `src/server/api/handlers.ts` y `clientIp` de `src/server/api/client-ip.ts`; las tablas `admin_users`, `admin_sessions`, `login_attempts` existen desde el paso 2). `ADMIN_EMAIL` y `ADMIN_PASSWORD` solo las lee el script, cuando el dueño lo ejecuta.

**Do**
- `src/server/auth/admin-auth.ts`:
  - `SESSION_COOKIE = "vb_admin_session"`, `SESSION_DAYS = 7`.
  - `hashPassword(password: string): Promise<string>` — `crypto.scrypt` (promisificado) con sal `randomBytes(16)`, N=16384, r=8, p=1, 64 bytes → `scrypt$16384$8$1$<sal base64>$<hash base64>`. `verifyPassword(password: string, stored: string): Promise<boolean>` — parsea el formato, recalcula y compara con `timingSafeEqual`; formato inválido → `false`.
  - `setAdminPassword(db: AppDb, email: string, password: string, now: Date): Promise<"created" | "updated">` — correo en minúsculas; clave < 12 caracteres → lanza `Error("ADMIN_PASSWORD debe tener al menos 12 caracteres")`; upsert en `admin_users`; revoca (`revoked_at = now`) todas las sesiones activas de ese admin.
  - `loginAdmin(db: AppDb, args: { email: string; password: string; ipHash: string; now: Date }): Promise<{ ok: true; token: string; expiresAt: Date } | { ok: false; code: "invalid" | "rate_limited" }>` — flujo exacto de §8 (≥ 5 fallidos en 15 min por `ip_hash`+correo → `rate_limited` sin evaluar la clave; correo inexistente → igual ejecuta `verifyPassword` contra un hash ficticio; fallo → inserta `login_attempts`; éxito → token de 32 bytes base64url, guarda `sha256` hex con `expires_at = now + 7 días`).
  - `requireAdmin(db: AppDb, token: string | undefined, now: Date): Promise<AdminUser | null>` — `null` si falta token, no existe, `revoked_at` no nulo o `expires_at <= now`.
  - `logoutAdmin(db: AppDb, token: string | undefined, now: Date): Promise<void>` — pone `revoked_at`.
  - `sessionCookieOptions(siteUrl: string): { httpOnly: true; secure: boolean; sameSite: "lax"; path: "/"; maxAge: number }` — `secure` es `siteUrl.startsWith("https://")`; `maxAge` 604800.
- `src/pages/admin/login.astro` — `prerender = false`, `Base` `chrome="none"` `noindex`, `title="Ingresar — Vector Bikes"`. Formulario POST con `<label for="email">Correo</label>` (`type="email"`, `autocomplete="username"`) y `<label for="password">Clave</label>` (`type="password"`, `autocomplete="current-password"`; pegar permitido — WCAG 3.3.8). POST: `isAllowedOrigin` o 403; `loginAdmin` con `ipHash = hashIp(clientIp(request, clientAddress))`; `ok` → `Astro.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(PUBLIC_SITE_URL))` y `return Astro.redirect("/admin", 303)`; `invalid` → status 401 y `Correo o clave incorrectos.`; `rate_limited` → status 429 y `Demasiados intentos. Espera 15 minutos.` (mensajes en `role="alert"`).
- `src/pages/admin/logout.ts` — `POST: APIRoute`: `isAllowedOrigin` o 403; `logoutAdmin`; `cookies.delete(SESSION_COOKIE, { path: "/" })`; `redirect("/admin/login", 303)`.
- `scripts/admin-set-password.ts` — primero `getAdminSetupEnv()` (si falla: `console.error(error.message)` y `process.exit(1)`), luego `setAdminPassword(getDb(), …, new Date())`, imprime `{"ok":true,"email":"<correo>","action":"created"}` (o `"updated"`) y `process.exit(0)`; cualquier otra excepción: mensaje a stderr y `process.exit(1)`.
- `tests/integration/admin-auth.test.ts` — PGlite:
  1. `hashPassword("clave-larga-de-prueba")` empieza con `scrypt$16384$8$1$`; `verifyPassword` con la misma clave → `true`, con otra → `false`.
  2. `setAdminPassword` devuelve `created` la primera vez y `updated` la segunda; un token obtenido con `loginAdmin` antes de la segunda llamada deja de ser válido (`requireAdmin` → `null`).
  3. `loginAdmin` correcto → `ok: true`; `requireAdmin(token, now)` devuelve el admin; `requireAdmin(token, now + 8 días)` → `null`.
  4. Cinco `loginAdmin` con clave incorrecta desde el mismo `ipHash` y correo → el sexto intento, **con la clave correcta**, devuelve `rate_limited`.
  5. `logoutAdmin(token)` → `requireAdmin(token)` → `null`.
  6. `sessionCookieOptions("https://vectorbikes.cl")` → `httpOnly: true`, `secure: true`, `sameSite: "lax"`, `maxAge: 604800`; con `"http://localhost:4321"` → `secure: false`.

**Done when**
- [ ] WHEN `pnpm test tests/integration/admin-auth.test.ts` runs THE SYSTEM SHALL exit 0 with 0 failed.
- [ ] WHEN a stored password hash is created THE SYSTEM SHALL use the format prefix `scrypt$16384$8$1$` and verify only the original password.
- [ ] WHEN 5 failed logins for one IP hash and email occur within 15 minutes THE SYSTEM SHALL return `rate_limited` on the next attempt even with the correct password.
- [ ] WHEN `setAdminPassword` updates an existing admin THE SYSTEM SHALL revoke that admin's existing sessions.
- [ ] WHEN `scripts/admin-set-password.ts` runs without `ADMIN_EMAIL` THE SYSTEM SHALL print `Variable de entorno faltante o inválida: ADMIN_EMAIL` and not touch the database.

**Verify**
```bash
pnpm format                                          # expect: exit 0
pnpm check                                           # expect: exit 0
pnpm test tests/integration/admin-auth.test.ts       # expect: exit 0, 0 failed
env -u ADMIN_EMAIL -u ADMIN_PASSWORD node scripts/admin-set-password.ts 2>&1 | grep -q 'Variable de entorno faltante o inválida: ADMIN_EMAIL'
                                                     # expect: exit 0 — el grep decide; un error de import no imprime ese texto
pnpm test                                            # expect: exit 0, 0 failed
pnpm build                                           # expect: exit 0
sh scripts/smoke.sh                                  # expect: exit 0
```

**Checkpoint**
```bash
git add -A && git commit -m "feat: step 10 acceso admin"
git tag step-10-admin-auth
```

---

#### Paso 11 — Panel admin

**Depende de:** 10 (y, a través de él, de los pasos 4 y 5: `cancelBooking` y `handleAvailability`).

**Do**
- `src/server/admin/agenda.ts`:
  - `agendaForDate(db: AppDb, date: string): Promise<Booking[]>` — todas las reservas de esa `service_date`, cualquier estado, ordenadas por `starts_at`.
  - `bookingDetail(db: AppDb, id: string): Promise<Booking | null>` (un `id` que no es uuid válido → `null` sin consultar).
  - `applyAdminAction(db: AppDb, id: string, action: "cancelar" | "completar" | "no_show", now: Date): Promise<{ ok: true; booking: Booking } | { ok: false; code: "not_found" | "invalid_transition" }>` — `cancelar` → `cancelBooking(db, { bookingId: id, by: "admin", now })` (sin correo: el dueño llama al cliente); `completar` → solo desde `confirmed`: `status = 'completed'`, `completed_at = now`; `no_show` → solo desde `confirmed`: `status = 'no_show'`. Los bloques de `completed`/`no_show` siguen activos (el cupo se consumió).
  - `listUpcomingBlocks(db: AppDb, fromDate: string): Promise<BlockedPeriod[]>`; `createBlock(db: AppDb, input: { serviceDate: string; startTime: string | null; endTime: string | null; reason: string }): Promise<{ ok: true } | { ok: false; errors: Record<string, string> }>` — zod: fecha `YYYY-MM-DD`; horas `HH:MM` ambas o ninguna (`Indica desde y hasta, o deja ambas vacías para bloquear el día.`), `startTime < endTime` (`La hora de término debe ser posterior a la de inicio.`); motivo 2–120 (`Escribe el motivo.`); `deleteBlock(db: AppDb, id: string): Promise<boolean>`.
  - `holidayWarning(now: Date): string | null` — con `missingHolidayYears(localToday(now), HORIZON_DAYS)` no vacío devuelve `Las reservas llegan a <años> y ese año no tiene feriados cargados. Agrégalos en src/data/feriados-cl.json o bloquea esos días desde Bloqueos.`; si no, `null`.
- `src/pages/admin/index.astro` — `prerender = false`; primera línea `requireAdmin` o `Astro.redirect("/admin/login", 303)`; `Base` `chrome="none"` `noindex` `title="Agenda — Vector Bikes"`. Encabezado admin (enlaces `Agenda`, `Bloqueos`, y form POST a `/admin/logout` con botón `Salir`); advertencia `holidayWarning(new Date())` en `<p role="status">` visible si no es `null`; formulario GET con `<label for="fecha">Fecha</label><input type="date" id="fecha" name="fecha">` y enlaces al día anterior/siguiente; tabla con encabezados `Hora`, `Modalidad`, `Nombre`, `Teléfono`, `Bicicleta`, `Qué necesita`, `Comuna / dirección`, `Estado`, y por fila el rango `HH:mm–HH:mm`, `<a href="tel:<phone_e164>">`, y enlace `Detalle` a `/admin/reservas/<id>`. Vacío: `No hay reservas para este día.` Fecha por defecto: `localToday(new Date())`.
- `src/pages/admin/reservas/[id].astro` — misma guarda; detalle completo de la reserva (incluye código, estado, `pickup_fee_clp` formateado, consentimiento). POST: `isAllowedOrigin` o 403; `accion` del formulario → `applyAdminAction`; `ok` → `Astro.redirect("/admin/reservas/<id>?hecho=<accion>", 303)`; `invalid_transition` → status 409 y `Esta acción no aplica al estado actual de la reserva.`; `not_found` → 404. Tres formularios con botones `Cancelar reserva`, `Marcar completada`, `Marcar no-show`, visibles solo si `status = 'confirmed'`.
- `src/pages/admin/bloqueos.astro` — misma guarda; formulario POST `accion=crear` (fecha, desde, hasta, motivo, cada uno con `label`) con errores de `createBlock`; lista de `listUpcomingBlocks(localToday(now))` con `Día completo` o `HH:MM–HH:MM`, motivo y form POST `accion=eliminar` + `id`. Todo POST: `isAllowedOrigin` o 403; éxito → redirección 303 a `/admin/bloqueos`. Vacío: `No hay bloqueos próximos.`
- `tests/integration/admin-panel.test.ts` — PGlite, `now = 2026-09-15T15:00:00.000Z`:
  1. Tres reservas en `2026-09-17` (una luego cancelada) → `agendaForDate` devuelve las tres ordenadas por `starts_at`, con sus estados.
  2. `applyAdminAction(…, "cancelar")` → `status = 'cancelled'`, `cancelled_by = 'admin'`, bloques inactivos.
  3. `completar` sobre `confirmed` → `completed` con `completed_at` no nulo; `completar` sobre la cancelada → `invalid_transition`.
  4. `no_show` sobre `confirmed` → `no_show`.
  5. `createBlock` de día completo en `2026-09-22` → `handleAvailability` para `desde=2026-09-22&dias=1` devuelve `status: "blocked"`; `deleteBlock` → vuelve a `open`.
  6. `createBlock` con `startTime: "17:00"`, `endTime: "16:00"` → `ok: false` con `errors.endTime`.
  7. `holidayWarning(new Date("2026-12-10T15:00:00.000Z"))` contiene `2027`; `holidayWarning(new Date("2026-09-16T15:00:00.000Z"))` es `null`.

**Done when**
- [ ] WHEN `pnpm test tests/integration/admin-panel.test.ts` runs THE SYSTEM SHALL exit 0 with 0 failed.
- [ ] WHEN the admin cancels a confirmed booking THE SYSTEM SHALL set `status` `cancelled`, `cancelled_by` `admin` and deactivate its blocks.
- [ ] WHEN the admin marks a cancelled booking as completed THE SYSTEM SHALL return `invalid_transition` and change nothing.
- [ ] WHEN a full-day block exists for `2026-09-22` THE SYSTEM SHALL report that day as `blocked` in availability, and as `open` again after the block is deleted.
- [ ] WHEN the 30-day horizon from `2026-12-10` reaches 2027 THE SYSTEM SHALL return a holiday warning containing `2027`.

**Verify**
```bash
pnpm format                                          # expect: exit 0
pnpm check                                           # expect: exit 0
pnpm test tests/integration/admin-panel.test.ts      # expect: exit 0, 0 failed
pnpm test                                            # expect: exit 0, 0 failed
pnpm build                                           # expect: exit 0
sh scripts/smoke.sh                                  # expect: exit 0
```

**Checkpoint**
```bash
git add -A && git commit -m "feat: step 11 panel admin"
git tag step-11-admin-panel
```

---

#### Paso 12 — Recordatorios y configuración de Replit

**Depende de:** 8.

**Do**
- `src/server/email/reminders.ts` — `sendReminders(db: AppDb, now: Date, deps: { transport: EmailTransport } = { transport: createTransport() }): Promise<{ sent: number; failed: number }>`: `tomorrow = addDays(localToday(now), 1)`; selecciona reservas `status = 'confirmed'`, `service_date = tomorrow`, `reminder_sent_at is null`, ordenadas por `starts_at`; por cada una envía `reminderEmail(booking)` a `booking.email` y luego `update bookings set reminder_sent_at = now where id = $id and reminder_sent_at is null`; un envío fallido se registra `email.failed`, suma a `failed` y no marca la fila. No importa `notifications.ts` (así el script no carga `ics`).
- `scripts/reminders-send.ts` — `const result = await sendReminders(getDb(), new Date())`; imprime `{"ok":<failed === 0>,"sent":<n>,"failed":<m>}`; `process.exit(result.failed === 0 ? 0 : 1)` (el `exit` explícito cierra el pool de `postgres`); excepción → mensaje a stderr y `process.exit(1)`.
- `tests/integration/reminders.test.ts` — PGlite, `consoleOutbox` vacío, reservas creadas con `now = 2026-09-15T13:00:00.000Z` (10:00 local) y teléfonos distintos: A `taller` `2026-09-16` `15:00`, B `retiro` `2026-09-16` `17:00`, C `taller` `2026-09-16` `18:00` luego cancelada, D `taller` `2026-09-17` `15:00`. Primera `sendReminders(db, now)` → `{ sent: 2, failed: 0 }`, 2 mensajes con asunto que empieza con `Recordatorio:`, y `reminder_sent_at` no nulo en A y B y nulo en C y D. Segunda llamada → `{ sent: 0, failed: 0 }` y `consoleOutbox` sigue con 2 mensajes.
- `tests/unit/replit-config.test.ts` — lee `.replit` y `package.json`: `.replit` contiene `[deployment]`, `deploymentTarget = "cloudrun"`, una línea `build` que contiene `pnpm@12.4.2 install --frozen-lockfile` y `pnpm@12.4.2 build`, una línea `run` que contiene `HOST=0.0.0.0` y `node dist/server/entry.mjs`, y `localPort = 4321`; `package.json` tiene `scripts.start` que contiene `node dist/server/entry.mjs`, y `scripts["reminders:send"]` igual a `node --env-file-if-exists=.env scripts/reminders-send.ts`.
- `README.md` — crear con secciones: `# Vector Bikes`; `## Desarrollo` (Bootstrap de §10 resumido, `pnpm dev` en el puerto 4321, `pnpm gate` como compuerta); `## Base de datos` (crear la base en la herramienta *Database* del workspace; `pnpm db:generate`, `pnpm db:migrate` y `pnpm db:check` solo contra la base del workspace; al publicar, Replit propaga el esquema a producción; la app nunca migra); `## Recordatorios (Scheduled Deployment)` con los pasos exactos: *Deployments → Create → Scheduled*; programación diaria a las 10:00 (cron `0 10 * * *`) eligiendo **America/Santiago** en el selector de zona horaria; comando de build `corepack pnpm@12.4.2 install --frozen-lockfile --config.minimumReleaseAge=0`; comando de ejecución `corepack pnpm@12.4.2 reminders:send`; secretos de esa deployment: `DATABASE_URL` (la de producción), `EMAIL_TRANSPORT=resend`, `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO`, `SHOP_NOTIFY_EMAIL`, `PUBLIC_SITE_URL`; y la nota: *si Replit no permite una segunda deployment en la misma App, crear una segunda Replit App importando el mismo repositorio Git solo para esta tarea programada*.

**Done when**
- [ ] WHEN `pnpm test tests/integration/reminders.test.ts` runs THE SYSTEM SHALL exit 0 with 0 failed.
- [ ] WHEN `sendReminders` runs for the first time with two confirmed bookings for tomorrow, one cancelled one and one for the day after THE SYSTEM SHALL send exactly 2 reminders and set `reminder_sent_at` only on those 2.
- [ ] WHEN `sendReminders` runs a second time THE SYSTEM SHALL send 0 reminders.
- [ ] WHEN `pnpm test tests/unit/replit-config.test.ts` runs THE SYSTEM SHALL confirm `.replit` builds with `pnpm install --frozen-lockfile` and runs `node dist/server/entry.mjs` with `HOST=0.0.0.0` on local port 4321.
- [ ] WHEN `pnpm reminders:send` runs twice against `DATABASE_URL` THE SYSTEM SHALL print `"ok":true` both times and `"sent":0` the second time.

**Verify**
```bash
pnpm format                                             # expect: exit 0
pnpm check                                              # expect: exit 0
pnpm test tests/integration/reminders.test.ts           # expect: exit 0, 0 failed
pnpm test tests/unit/replit-config.test.ts              # expect: exit 0, 0 failed
pnpm reminders:send | grep -q '"ok":true'               # expect: exit 0
pnpm reminders:send | grep -q '"sent":0'                # expect: exit 0 — idempotente
test -f README.md                                       # expect: exit 0
pnpm test                                               # expect: exit 0, 0 failed
```

**Checkpoint**
```bash
git add -A && git commit -m "feat: step 12 recordatorios y replit"
git tag step-12-reminders-replit
```

---

#### Paso 13 — SEO, privacidad y 404

**Depende de:** 6.

**Do**
- `src/pages/privacidad.astro` — `export const prerender = true;` `Base` con `title="Aviso de privacidad — Vector Bikes"`, `description="Cómo Vector Bikes usa los datos de tu reserva y cómo ejercer tus derechos."`, `path="/privacidad"`. Contenido: `<h1>Aviso de privacidad</h1>` y secciones con `h2`: **Responsable** (Vector Bikes, Av. Kennedy 7666, Vitacura; contacto info@vectorbikes.cl); **Qué datos usamos** (nombre, teléfono, correo, bicicleta, descripción, comuna y dirección en retiros, fecha y hora del consentimiento, y un identificador cifrado de tu IP para prevenir abusos); **Para qué** (gestionar tu reserva, contactarte sobre tu bicicleta, enviarte la confirmación y el recordatorio, prevenir reservas falsas); **Base legal** (tu consentimiento al reservar, conforme a la Ley 19.628 y la Ley 21.719); **Con quién se comparten** (Replit — alojamiento y base de datos; Resend — envío de correos; Cloudflare Turnstile — verificación anti-abuso; nunca se venden ni se usan para publicidad); **Cuánto tiempo** (mientras sean necesarios para gestionar tus reservas y el historial de servicio de tu bicicleta, o hasta que pidas su eliminación); **Tus derechos** (acceso, rectificación, supresión, oposición y portabilidad escribiendo a info@vectorbikes.cl). Última línea: `Última actualización: 15 de septiembre de 2026.`
- `src/pages/404.astro` — `Base` con `title="Página no encontrada — Vector Bikes"`, `description="La página que buscas no existe."`, `path="/404"`, `noindex`; `<h1>Página no encontrada</h1>` y `<a class="btn" href="/">Volver al inicio</a>`.
- `public/robots.txt` — contenido exacto:
  ```
  User-agent: *
  Disallow: /admin
  Disallow: /reservas/cancelar
  Sitemap: https://vectorbikes.cl/sitemap-index.xml
  ```
- `src/layouts/Base.astro` — agregar en `<head>`: `og:type` `website`, `og:site_name` `Vector Bikes`, `og:locale` `es_CL`, `og:title` = `title`, `og:description` = `description`, `og:url` = canonical, `og:image` = `new URL("/brand/vector-bikes-logo.png", Astro.site).href`, `twitter:card` `summary`; y **solo cuando `path === "/"`**, `<script type="application/ld+json" set:html={JSON.stringify(localBusiness)} />` con `localBusiness = { "@context": "https://schema.org", "@type": "LocalBusiness", name: SITE.name, url: Astro.site.href, image: <og:image>, email: SITE.email, address: { "@type": "PostalAddress", streetAddress: SITE.streetAddress, addressLocality: SITE.locality, addressRegion: SITE.region, addressCountry: SITE.country }, openingHoursSpecification: [{ "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], opens: "15:00", closes: "20:00" }, { "@type": "OpeningHoursSpecification", dayOfWeek: ["Saturday"], opens: "10:00", closes: "14:00" }], sameAs: [SITE.instagramUrl] }`.
- `tests/build/seo.test.ts` — `site = process.env.PUBLIC_SITE_URL || "https://vectorbikes.cl"` (misma regla que `astro.config.mjs`):
  1. `dist/client/index.html` contiene exactamente un `application/ld+json`; su JSON tiene `@type` `LocalBusiness`, `address.streetAddress` `Avenida Kennedy 7666`, `address.addressLocality` `Vitacura`, `address.addressCountry` `CL`, 2 elementos en `openingHoursSpecification` y `sameAs` con `https://instagram.com/vector.bikes`.
  2. `index.html` contiene `rel="canonical"` con `href` = `new URL("/", site).href`, y `property="og:image"`.
  3. `dist/client/privacidad/index.html` contiene `Aviso de privacidad` y `Ley 21.719`, y no contiene `application/ld+json`.
  4. `dist/client/404.html` contiene `Página no encontrada` y `noindex`.
  5. `dist/client/sitemap-0.xml` contiene `new URL("/", site).href` y `/privacidad`, y no contiene `/admin` ni `/reservas`.
  6. `dist/client/robots.txt` contiene `Disallow: /admin` y `Disallow: /reservas/cancelar`.

**Done when**
- [ ] WHEN `pnpm test:build tests/build/seo.test.ts` runs after `pnpm build` THE SYSTEM SHALL exit 0 with 0 failed.
- [ ] WHEN `dist/client/index.html` is read THE SYSTEM SHALL contain one JSON-LD block of `@type` `LocalBusiness` with address `Avenida Kennedy 7666`, `Vitacura`, `CL` and two opening-hours entries.
- [ ] WHEN the sitemap is generated THE SYSTEM SHALL list `/` and `/privacidad` and exclude `/admin` and `/reservas`.
- [ ] WHEN `dist/client/robots.txt` is read THE SYSTEM SHALL contain `Disallow: /admin` and `Disallow: /reservas/cancelar`.
- [ ] WHEN `dist/client/404.html` is read THE SYSTEM SHALL contain `Página no encontrada` and a `noindex` robots meta.

**Verify**
```bash
pnpm format                                    # expect: exit 0
pnpm check                                     # expect: exit 0
pnpm test                                      # expect: exit 0, 0 failed
pnpm build                                     # expect: exit 0
pnpm test:build tests/build/seo.test.ts        # expect: exit 0, 0 failed
pnpm test:build                                # expect: exit 0, 0 failed (landing + island + seo)
sh scripts/smoke.sh                            # expect: exit 0
```

**Checkpoint**
```bash
git add -A && git commit -m "feat: step 13 seo privacidad 404"
git tag step-13-seo-privacy
```

---

#### Paso 14 — Compuerta final

**Depende de:** 1–13.

**Do**
- `tests/build/a11y.test.ts` — chequeos estáticos por expresiones regulares (sin DOM) sobre `dist/client/index.html`, `dist/client/privacidad/index.html` y `dist/client/404.html`: (1) `<html lang="es-CL"`; (2) exactamente un `<h1`; (3) la secuencia de niveles `h1…h6` en orden de aparición nunca sube más de un nivel respecto del anterior; (4) todo `<img` tiene atributo `alt=`; (5) existen `href="#contenido"` e `id="contenido"`; (6) solo en `index.html`: cada `<input`, `<select>` y `<textarea` con `id` que no sea `type="hidden"` tiene un `<label` con `for="<id>"`; y (7) al menos un archivo `dist/client/_astro/*.css` contiene `:focus-visible` y `prefers-reduced-motion`.
- `scripts/smoke.sh` — reemplazar las dos últimas líneas (`echo "$HEALTH" | grep -q '"ok":true'` y `echo "smoke ok: $HEALTH"`) por:
  ```sh
  echo "$HEALTH" | grep -q '"ok":true'
  echo "$HEALTH" | grep -q '"db":true'
  code() { curl -s -o /dev/null -w '%{http_code}' "$BASE$1"; }
  TODAY="$(node -e 'console.log(new Intl.DateTimeFormat("en-CA",{timeZone:"America/Santiago"}).format(new Date()))')"
  test "$(code /)" = 200
  test "$(code "/api/disponibilidad?desde=$TODAY&dias=1&modo=taller")" = 200
  test "$(code /no-existe)" = 404
  test "$(code /admin)" = 303
  test "$(code '/reservas/cancelar?token=no-existe')" = 404
  test "$(code /robots.txt)" = 200
  echo "smoke ok: $HEALTH"
  ```
- `README.md` — agregar `## Lanzamiento` con el runbook completo (cada punto de lanzamiento de §20.1 con sus pasos concretos): publicar la Autoscale Deployment desde *Deployments* (usa `[deployment]` de `.replit`); secretos de producción en **ambas** deployments (Autoscale y Scheduled) — lista de §10; confirmar el esquema de producción en el panel *Database* tras la primera publicación; `pnpm admin:set-password` en el contexto de producción (con el `DATABASE_URL` de producción exportado en el shell); dominio: en Replit *Deployments → Settings → Link a domain* para `vectorbikes.cl`, crear en cPanel de Bluehosting los registros **A** y **TXT `replit-verify=…`** que entrega Replit y **no borrar nunca el TXT** (renovación SSL); Resend: agregar el dominio `send.vectorbikes.cl` y crear en cPanel exactamente los registros que muestre Resend para ese subdominio, sin tocar MX/SPF/autodiscover de Microsoft 365 del apex; Turnstile: crear el widget para `vectorbikes.cl` y reemplazar las claves de prueba; WhatsApp: definir `PUBLIC_WHATSAPP_NUMBER` y **volver a publicar** (se hornea en el build); supresión de datos: el procedimiento de §14; feriados 2027: agregarlos con la skill `add-holidays` antes de diciembre 2026, `pnpm gate`, commit y publicar.

**Done when**
- [ ] WHEN `pnpm test:build tests/build/a11y.test.ts` runs after `pnpm build` THE SYSTEM SHALL exit 0 with 0 failed.
- [ ] WHEN `sh scripts/smoke.sh` runs THE SYSTEM SHALL get `/api/health` with `"db":true`, HTTP 200 from `/` and `/api/disponibilidad`, 404 from an unknown path and from an unknown cancellation token, and 303 from `/admin` without a session.
- [ ] WHEN `pnpm gate` runs THE SYSTEM SHALL exit 0, running Biome, `astro check`, `tsc --noEmit`, the unit+integration suite, the build, the build suite and the smoke test.
- [ ] WHEN `pnpm install --frozen-lockfile` runs THE SYSTEM SHALL exit 0 without modifying `pnpm-lock.yaml`.
- [ ] WHEN `README.md` is read THE SYSTEM SHALL contain the sections `## Recordatorios (Scheduled Deployment)` and `## Lanzamiento`.

**Verify**
```bash
pnpm format                                                    # expect: exit 0
pnpm install --frozen-lockfile                                 # expect: exit 0
pnpm build                                                     # expect: exit 0
pnpm test:build tests/build/a11y.test.ts                       # expect: exit 0, 0 failed
grep -q '^## Recordatorios (Scheduled Deployment)' README.md   # expect: exit 0
grep -q '^## Lanzamiento' README.md                            # expect: exit 0
pnpm gate                                                      # expect: exit 0 (check, test, build, test:build, smoke)
```

**Checkpoint**
```bash
git add -A && git commit -m "feat: step 14 compuerta final"
git tag step-14-final-gate
test "$(git tag -l 'step-*' | wc -l | tr -d ' ')" = 14   # expect: exit 0 — 14 tags, uno por paso de §9
```

---

### 9.1 Paridad y corte

NOT APPLICABLE — greenfield build, no system is being replaced.

---

## 10. Configuración del entorno

### Prerrequisitos
| Herramienta | Versión | Chequeo |
|---|---|---|
| Node.js | 24.x LTS (mínimo 22.12.0, lo exige Astro 7); `.nvmrc` = `24` | `node -v` |
| corepack | el que trae Node 24 | `corepack --version` |
| pnpm | 12.4.2 (lo activa el Bootstrap vía corepack) | `pnpm --version` |
| git | cualquiera reciente | `git --version` |
| curl | cualquiera (lo usa `scripts/smoke.sh`) | `curl --version` |
| rsync | opcional (si falta, el Bootstrap usa un bucle portable) | `rsync --version` |
| PostgreSQL 16 | la base del workspace de Replit; fuera de Replit, un Postgres local | `pnpm db:check` (desde el paso 2) |

**Replit:** en la Replit App, elegir **Node.js 24** en el selector de lenguaje/módulo. La línea `modules = ["nodejs-24"]` de `.replit` está marcada *verificar antes de instalar* porque el nombre exacto del módulo no está confirmado en la documentación; si Replit la reescribe al elegir el módulo, se acepta su valor (el Bootstrap valida la versión de Node igual).

### Cuentas a crear primero
| Servicio | Para qué | Primer paso que lo necesita |
|---|---|---|
| Replit (plan Core, ya contratado) — https://replit.com | Workspace, Postgres, deployments | Bootstrap |
| Base de datos del workspace (Replit → herramienta *Database* → crear PostgreSQL) | `DATABASE_URL` de desarrollo | Paso 2 |
| Resend — https://resend.com/signup | Correos reales en producción | Lanzamiento (§20.1); el build usa `EMAIL_TRANSPORT=console` |
| Cloudflare Turnstile — https://dash.cloudflare.com/?to=/:account/turnstile | Claves reales para `vectorbikes.cl` | Lanzamiento; el build usa las claves de prueba oficiales |
| cPanel de Bluehosting (DNS de `vectorbikes.cl`, dominio en NIC Chile) | Registros A/TXT de Replit y registros de Resend | Lanzamiento |
| Microsoft 365 (buzón `info@vectorbikes.cl`, ya existe) | Recibe avisos de reservas | Lanzamiento (prueba real) |

### Variables de entorno
| Variable | Propósito | Dónde obtenerla | Requerida desde el paso | ¿Secreta? |
|---|---|---|---|---|
| `DATABASE_URL` | Conexión Postgres (app, `db:migrate`, `db:check`, scripts). Valor local literal: `postgres://postgres:postgres@127.0.0.1:5432/vector_bikes` | Replit la inyecta al crear la base (workspace = dev; deployments = producción) | 2 | sí |
| `CANCEL_TOKEN_SECRET` | Clave HMAC de los tokens de cancelación (≥ 32 caracteres) | Generar: `node -e 'console.log(require("node:crypto").randomBytes(32).toString("base64url"))'` | 4 | sí |
| `TURNSTILE_SECRET_KEY` | Secreto de Turnstile para `siteverify`. Prueba (siempre pasa): `1x0000000000000000000000000000000AA` | Cloudflare → Turnstile → widget → *Secret key* | 5 | sí |
| `SESSION_SECRET` | Clave HMAC para `ip_hash` (rate limits) (≥ 32 caracteres) | Generar igual que `CANCEL_TOKEN_SECRET` | 5 | sí |
| `PUBLIC_WHATSAPP_NUMBER` | Número de WhatsApp del botón flotante; vacío = sin botón. Se hornea en el build | El dueño | 6 (opcional) | no |
| `PUBLIC_TURNSTILE_SITE_KEY` | Sitekey del widget (horneada en el build). Prueba: `1x00000000000000000000AA` | Cloudflare → Turnstile → *Site key* | 7 | no |
| `PUBLIC_SITE_URL` | URL pública (`https://vectorbikes.cl`; en el workspace, la URL `*.replit.dev`): enlaces de correo, chequeo de Origin, `site` de Astro (con respaldo `https://vectorbikes.cl`) | Replit → dominio de la deployment | 8 | no |
| `EMAIL_TRANSPORT` | `console` (tests/local) o `resend` (producción) | Decisión: `console` en dev, `resend` en deployments | 8 | no |
| `RESEND_API_KEY` | API key de Resend; obligatoria solo si `EMAIL_TRANSPORT=resend` | Resend → *API Keys* | 8 (solo con `resend`) | sí |
| `EMAIL_FROM` | `Vector Bikes <reservas@send.vectorbikes.cl>` | Fijo | 8 | no |
| `EMAIL_REPLY_TO` | `info@vectorbikes.cl` | Fijo | 8 | no |
| `SHOP_NOTIFY_EMAIL` | Destino de avisos al taller: `info@vectorbikes.cl` | Fijo | 8 | no |
| `ADMIN_EMAIL` | Correo del admin; solo lo lee `pnpm admin:set-password` | El dueño | 10 (solo al ejecutar el script; ninguna compuerta la exige) | no |
| `ADMIN_PASSWORD` | Clave del admin (≥ 12 caracteres); solo el script | El dueño | 10 (ídem) | sí |
| `HOST`, `PORT` | Interfaz y puerto del servidor standalone (`dist/server/entry.mjs`); los fijan `.replit` (`0.0.0.0`/`4321`), `package.json` `start` y `scripts/smoke.sh` | No se configuran a mano | 1 | no |
| `SMOKE_PORT` | Puerto opcional de `scripts/smoke.sh` (default `4399`) | Opcional | 1 | no |
| `VITEST_SUITE` | `build` selecciona la suite `tests/build/`; lo fija el script `test:build` | No se configura a mano | 6 | no |
| `REPLIT_DEPLOYMENT` | La define Replit dentro de una deployment; `scripts/db-migrate.ts` se niega a correr si existe (comportamiento de la plataforma **no verificado**; es defensa adicional) | Plataforma | 2 | no |
| `COREPACK_BIN`, `COREPACK_ENABLE_DOWNLOAD_PROMPT` | Directorio de shims de corepack y desactivar su pregunta interactiva | Bootstrap | Bootstrap | no |

`.env.example` (emitido en §19.6) se commitea con cada clave y valores locales o de prueba. `.env` y `.env.*` están en `.gitignore` con la excepción `!.env.example`. **En Replit, los valores reales van en *Secrets*** (workspace para dev; cada deployment tiene los suyos): Node da precedencia al entorno sobre `.env`.

**"Requerida desde el paso" es un contrato con §9.** No hay validación global al arrancar: `src/lib/env.ts` expone un accesor por funcionalidad (`getDbEnv`, `getCancelEnv`, `getTurnstileEnv`, `getHashEnv`, `getSiteEnv`, `getEmailEnv`, `getAdminSetupEnv`) que se evalúa recién cuando esa funcionalidad se ejecuta y falla con `Variable de entorno faltante o inválida: <NOMBRE>`. Así el `build` del paso 1 nunca exige secretos de pasos posteriores.

**Cómo se cargan las variables en cada herramienta** (detalle en §19.6):
- Scripts de Node (`db:migrate`, `db:check`, `admin:set-password`, `reminders:send`), el servidor de `scripts/smoke.sh` y `pnpm dev`: flag `node --env-file-if-exists=.env` en el propio comando (escrito en `package.json` y `smoke.sh`).
- `drizzle-kit generate`: `process.loadEnvFile(".env")` protegido por `existsSync` dentro de `drizzle.config.ts` (y el comando no se conecta).
- `astro build`: Vite carga `.env` para `import.meta.env.PUBLIC_*`; `astro.config.mjs` lee `PUBLIC_SITE_URL` de `process.env` con respaldo `https://vectorbikes.cl`.
- Vitest: `tests/setup.ts` fija valores de prueba y fuerza `EMAIL_TRANSPORT=console`.
- Deployments de Replit: variables de *Secrets* de cada deployment.

### Archivos que deben commitearse
| Archivo | Por qué se commitea | Línea de excepción en `.gitignore` |
|---|---|---|
| `.env.example` | Documenta cada variable | `!.env.example` después de `.env.*` |
| `pnpm-lock.yaml` | `--frozen-lockfile` en Replit y en §20.1 | — no coincide con ningún patrón |
| `package.json`, `pnpm-workspace.yaml`, `.nvmrc`, `.replit` | Toolchain y deployment reproducibles | — no coincide con ningún patrón |
| `astro.config.mjs`, `tsconfig.json`, `biome.json`, `vitest.config.ts`, `drizzle.config.ts` | Configs de las compuertas | — no coincide con ningún patrón |
| `drizzle/` (SQL + `meta/`) | Replit propaga el esquema desde dev; el historial de migraciones es la verdad | — no coincide con ningún patrón |
| `CLAUDE.md`, `AGENTS.md`, `.claude/` | Configuración del agente | — no coincide con ningún patrón |
| `docs/design-preview.html`, `public/brand/vector-bikes-logo.png` | Fuente visual y logo oficial | — no coincide con ningún patrón |
| `scripts/`, `src/`, `tests/`, `README.md` | Código y runbook | — no coincide con ningún patrón |
| `blueprints/vector-bikes/` | El bundle (con `tasks.json` y sus estados) | — no coincide con ningún patrón |

### Bootstrap
```bash
# Ejecutar desde la raíz de la Replit App, con este bundle en blueprints/vector-bikes/.
# El orden importa: copia de workspace/ (trae .gitignore con su excepción y las configs de las
# herramientas) → toolchain → repositorio git → primer commit → install → .env → biome ci.
# El .gitignore y biome.json están en disco ANTES del primer commit y del primer lint.
# Todo el bloque es seguro de ejecutar dos veces y cada línea sale 0 en la segunda ejecución.
set -eu

# 1. Copia NO destructiva de workspace/ a la raíz: nunca pisa un archivo existente
#    (package.json, pnpm-lock.yaml y toda config que un paso haya editado se conservan).
#    rsync --ignore-existing sale 0 al saltar; el bucle portable también (cp -Rn sale 1 en macOS).
WS=blueprints/vector-bikes/workspace
# 0. Precondiciones (fallan con mensaje, nunca en silencio):
#    - el bundle está en blueprints/vector-bikes/ (si no, la copia no tendría origen);
#    - la raíz no es otro proyecto (una App creada por el Agente de Replit o una plantilla con su
#      propio package.json): la copia no destructiva conservaría ese package.json y pnpm trabajaría
#      sobre el proyecto equivocado. Solución: una Replit App vacía.
[ -d "$WS" ] || { echo "ERROR: falta $WS. Copia el bundle completo a blueprints/vector-bikes/ antes del Bootstrap." >&2; exit 1; }
if [ -f package.json ] && ! grep -q '"name": "vector-bikes"' package.json; then
  echo "ERROR: la raíz ya tiene un package.json de otro proyecto. Usa una Replit App vacía." >&2; exit 1
fi
# Replit crea .replit y a veces .gitignore al crear la App. Esos dos se reemplazan por los del bundle
# (con respaldo .replit-default.bak) solo si no son ya los del bundle; en la segunda ejecución no hacen nada.
if [ -f .replit ] && ! grep -q 'dist/server/entry.mjs' .replit; then mv .replit .replit-default.bak; fi
if [ -f .gitignore ] && ! grep -q '^!.env.example$' .gitignore; then mv .gitignore .gitignore-default.bak; fi
if command -v rsync >/dev/null 2>&1; then
  rsync -a --ignore-existing "$WS/" ./
else
  FILES="$(cd "$WS" && find . -type f)"   # fuera del pipe: si falla, set -e detiene el bloque
  printf '%s\n' "$FILES" | while IFS= read -r f; do
    [ -e "$f" ] || { mkdir -p "$(dirname "$f")" && cp "$WS/$f" "$f"; }
  done
fi
[ -f package.json ] && [ -f .env.example ] || { echo "ERROR: la copia de workspace/ no dejó package.json y .env.example en la raíz." >&2; exit 1; }

# 2. Node >= 22.12 obligatorio (Astro 7); aviso si no es 24.
node -e 'const [M, m] = process.versions.node.split(".").map(Number); if (M < 22 || (M === 22 && m < 12)) { console.error("Node >=22.12 requerido; tienes " + process.version); process.exit(1); } if (M !== 24) console.warn("AVISO: .nvmrc fija Node 24; tienes " + process.version);'

# 3. pnpm 12.4.2 vía corepack en un directorio escribible (evita EACCES) y sin preguntas.
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
COREPACK_BIN="${COREPACK_BIN:-$HOME/.local/bin}"
mkdir -p "$COREPACK_BIN"
corepack enable --install-directory "$COREPACK_BIN"
export PATH="$COREPACK_BIN:$PATH"
corepack prepare pnpm@12.4.2 --activate
pnpm --version                                   # expect: 12.4.2

# 4. Repositorio (idempotente), identidad para commits, y primer commit solo si no hay ninguno.
git rev-parse --git-dir >/dev/null 2>&1 || git init -b main
git config user.email >/dev/null || git config user.email "builder@vectorbikes.cl"
git config user.name >/dev/null || git config user.name "Vector Bikes Builder"
git rev-parse --verify HEAD >/dev/null 2>&1 || { git add -A && git commit -m "chore: bootstrap workspace"; }

# 5. Dependencias fijadas en package.json. allowBuilds (pnpm-workspace.yaml) aprueba esbuild;
#    si pnpm 12 igual aborta con ERR_PNPM_IGNORED_BUILDS (comportamiento no verificado en 12),
#    se aprueban los scripts listados y se reintenta.
pnpm install || { pnpm approve-builds --all && pnpm install; }

# 6. .env local a partir del ejemplo (no se commitea; en Replit mandan los Secrets).
[ -f .env ] || cp .env.example .env

# 7. Las configs emitidas pasan su propio linter con el bundle presente (biome excluye blueprints/ y docs/).
pnpm exec biome ci .                             # expect: exit 0
```

---

## 11. Dependencias

**Procedencia:** todas las versiones salen del informe de `stack-researcher` de esta sesión (verificado el 2026-09-15 contra el registro npm y nodejs.org). `knowledge/runtime-tracks/ts-node.md` no aportó ningún pin (sus valores eran más antiguos que el informe). **Instalación:** `package.json` (emitido en §19.6) declara cada paquete con su versión, y la línea `pnpm install` de §10 Bootstrap los instala todos; ningún paso agrega dependencias.

### Runtime
| Paquete | Versión | Fuente | Verificado | Instalado por | Propósito |
|---|---|---|---|---|---|
| Node.js | 24.21.0 LTS "Krypton" (`.nvmrc` = `24`, `engines` `>=22.12.0`) | https://nodejs.org/dist/index.json | 2026-09-15 | Prerrequisito (selector de módulo de Replit); validado en §10 Bootstrap | Runtime; ejecuta scripts `.ts` con type stripping |
| pnpm | 12.4.2 (`build` de `[deployment]` en `.replit`) | https://registry.npmjs.org/-/package/pnpm/dist-tags | 2026-09-15 | §10 Bootstrap — `corepack prepare pnpm@12.4.2 --activate` | Gestor de paquetes. pnpm 12 eliminó 18 flags de install (p. ej. `--shamefully-hoist`): no usar ninguno. Aprobación de builds (`allowBuilds`) verificada con pnpm 12.4.2; pnpm 12 también aplica `minimumReleaseAgeExclude` (ya emitido en `pnpm-workspace.yaml`) |
| astro | 7.3.2 | https://registry.npmjs.org/astro | 2026-09-15 | §10 Bootstrap — `pnpm install` | Framework (engines node `>=22.12.0`; rechaza tags no-void sin cerrar) |
| @astrojs/node | 11.1.5 | https://registry.npmjs.org/@astrojs/node | 2026-09-15 | §10 Bootstrap — `pnpm install` | Adapter standalone (peer astro `^7.2.1`) |
| @astrojs/preact | 6.0.5 | https://registry.npmjs.org/@astrojs/preact | 2026-09-15 | §10 Bootstrap — `pnpm install` | Integración de la isla (peer preact `^10.6.5`) |
| preact | 10.29.8 | https://registry.npmjs.org/preact | 2026-09-15 | §10 Bootstrap — `pnpm install` | Isla de reserva |
| @astrojs/sitemap | 3.7.4 | https://registry.npmjs.org/@astrojs/sitemap | 2026-09-15 | §10 Bootstrap — `pnpm install` | `sitemap-index.xml`. **Sin rango de peer publicado: compatibilidad con Astro 7 no verificada** (la prueba el paso 13) |
| tailwindcss | 4.3.3 | https://registry.npmjs.org/tailwindcss | 2026-09-15 | §10 Bootstrap — `pnpm install` | Tema y utilidades CSS-first |
| @tailwindcss/vite | 4.3.3 | https://registry.npmjs.org/@tailwindcss/vite | 2026-09-15 | §10 Bootstrap — `pnpm install` | Plugin Vite de Tailwind |
| drizzle-orm | 0.45.2 | https://registry.npmjs.org/drizzle-orm | 2026-09-15 | §10 Bootstrap — `pnpm install` | ORM (peers `postgres >=3`, `@electric-sql/pglite >=0.2.0`). Pin exacto: v1 es RC |
| postgres | 3.4.9 | https://registry.npmjs.org/postgres | 2026-09-15 | §10 Bootstrap — `pnpm install` | Driver Postgres |
| zod | 4.6.5 | https://registry.npmjs.org/zod | 2026-09-15 | §10 Bootstrap — `pnpm install` | Validación de entorno, API y formularios |
| luxon | 3.7.2 | https://registry.npmjs.org/luxon | 2026-09-15 | §10 Bootstrap — `pnpm install` | Zonas horarias (Temporal no está sin flag en Node 24) |
| ics | 3.12.0 | https://registry.npmjs.org/ics | 2026-09-15 | §10 Bootstrap — `pnpm install` | Adjunto `.ics` |
| resend | 6.28.1 | https://registry.npmjs.org/resend | 2026-09-15 | §10 Bootstrap — `pnpm install` | Envío de correos |
| @fontsource/michroma | 5.3.0 | https://registry.npmjs.org/@fontsource/michroma | 2026-09-15 | §10 Bootstrap — `pnpm install` | Fuente display autoalojada |
| @fontsource-variable/archivo | 5.3.0 | https://registry.npmjs.org/@fontsource-variable/archivo | 2026-09-15 | §10 Bootstrap — `pnpm install` | Fuente de cuerpo autoalojada |
| @fontsource/ibm-plex-mono | 5.3.0 | https://registry.npmjs.org/@fontsource/ibm-plex-mono | 2026-09-15 | §10 Bootstrap — `pnpm install` | Fuente mono 400/500 autoalojada |
| Cloudflare Turnstile / Resend / Replit | servicios alojados, sin versión | — | — | — | Anti-abuso / correo / hosting |

### Desarrollo
| Paquete | Versión | Fuente | Verificado | Instalado por | Propósito |
|---|---|---|---|---|---|
| typescript | ~6.0.3 (la última estable 6.x; `6.0.5` no existe — corregido en la prueba de humo, `pnpm install` lo resolvió a 6.0.3) | https://registry.npmjs.org/typescript | 2026-09-15 | §10 Bootstrap — `pnpm install` | `tsc --noEmit`. No 7.x: el peer de `@astrojs/check@0.9.10` es `^5.0.0 \|\| ^6.0.0` |
| @astrojs/check | 0.9.10 | https://registry.npmjs.org/@astrojs/check | 2026-09-15 | §10 Bootstrap — `pnpm install` | `astro check` |
| @biomejs/biome | 2.5.13 | https://registry.npmjs.org/@biomejs/biome | 2026-09-15 | §10 Bootstrap — `pnpm install` | Lint + formato (requiere `css.parser.tailwindDirectives`) |
| vitest | ^5.0.1 | https://registry.npmjs.org/vitest | 2026-09-15 | §10 Bootstrap — `pnpm install` | Tests (5.x GA; engines `^22.12.0 \|\| ^24 \|\| >=26`) |
| @electric-sql/pglite | 0.5.8 | https://registry.npmjs.org/@electric-sql/pglite | 2026-09-15 | §10 Bootstrap — `pnpm install` | Postgres en proceso para tests |
| drizzle-kit | 0.31.10 | https://registry.npmjs.org/drizzle-kit | 2026-09-15 | §10 Bootstrap — `pnpm install` | `pnpm db:generate` (no `^1`: v1 es RC) |
| @types/luxon | 3.7.5 | https://registry.npmjs.org/@types/luxon | 2026-09-15 | §10 Bootstrap — `pnpm install` | Tipos de luxon |
| @types/node | `^24` (última 24.x publicada: 24.13.5; la prueba de humo resolvió 24.13.4) | https://registry.npmjs.org/@types/node | 2026-09-15 | §10 Bootstrap — `pnpm install` | Tipos de `process`, `node:crypto`, `node:util` |

### Deliberadamente no usados
| Rechazado | En su lugar | Por qué |
|---|---|---|
| better-auth / @better-auth/cli | Sesión propia (§8) | CLI 1.4.21 y librería 1.7.5 divergieron; 1.7 falla ante drift de esquema |
| tsx | `node` con type stripping nativo + `--env-file-if-exists` | Un loader menos; los scripts son TS borrable (`erasableSyntaxOnly`) |
| @playwright/test | Tests de HTML construido en Vitest + QA manual de lanzamiento | Dependencias de navegador poco confiables en el Nix de Replit |
| Extensión `btree_gist` | Índice único parcial + bloqueo de `booking_days` + advisory lock | Replit no confirma soporte de extensiones |
| `astro:assets` / sharp | CSS con el PNG del logo en `public/` | Evita el binario nativo de sharp y su aprobación de build |
| dotenv | `--env-file-if-exists` y `process.loadEnvFile` de Node | Nativo en Node 24 |
| React / Next.js | Preact + Astro | Una isla; menos JS |
| Google Fonts CDN | `@fontsource/*` | Sin peticiones a terceros ni banner de privacidad |
| Prisma | Drizzle | Cliente más liviano y mismo esquema para PGlite |

---

## 12. Estrategia de despliegue

### Hosting
**Replit, todo en la misma cuenta (plan Core del dueño).** Decisión del dueño: el código vive en la Replit App y un operador no técnico gestiona un solo proveedor.

| Pieza | Tipo | Configuración |
|---|---|---|
| Sitio + API + admin | **Autoscale Deployment** (`deploymentTarget = "cloudrun"` en `.replit`) | build: `corepack pnpm@12.4.2 install --frozen-lockfile --config.minimumReleaseAge=0 && corepack pnpm@12.4.2 build`; run: `HOST=0.0.0.0 PORT=4321 node dist/server/entry.mjs`; `[[ports]] localPort = 4321 → externalPort = 80`. El servidor escucha en `0.0.0.0` (nunca solo localhost). Que Replit reenvíe al primer puerto de `[[ports]]` es el comportamiento documentado; que además inyecte `PORT` **no está verificado** en la documentación, por eso el puerto se fija explícitamente en `4321` en ambos lados |
| Recordatorios | **Scheduled Deployment** | diario `0 10 * * *` con zona **America/Santiago** en el selector; build `corepack pnpm@12.4.2 install --frozen-lockfile --config.minimumReleaseAge=0`; run `corepack pnpm@12.4.2 reminders:send`. Si Replit no permitiera una segunda deployment en la misma App (no verificado), se crea una segunda Replit App desde el mismo repositorio Git solo para esta tarea |
| Base de datos | Replit PostgreSQL 16 (dev "Helium"; producción respaldada por Neon) | `DATABASE_URL` inyectada por la plataforma en workspace y deployments |

Salida del build: `dist/server/entry.mjs` (servidor) y `dist/client/` (estáticos y páginas prerenderizadas).

### Entornos
| Entorno | Rama | URL | Base de datos | Modo de terceros |
|---|---|---|---|---|
| Local / workspace | `main` (trabajo en la App) | `https://<app>.replit.dev` (dev server en 4321) o `http://localhost:4321` | Base del workspace (dev) o Postgres local | Turnstile de prueba, `EMAIL_TRANSPORT=console` |
| Preview | NOT APPLICABLE — Replit Core no ofrece previews por PR en este flujo; el workspace cumple ese rol | — | — | — |
| Producción | `main` publicado | `https://vectorbikes.cl` | Base de producción (Neon, gestionada por Replit) | Turnstile real, `EMAIL_TRANSPORT=resend` |

### CI/CD
Nivel 0 (un solo operador): no hay CI externo. **La compuerta es `pnpm gate`** (idéntica a §20.1: `pnpm check && pnpm test && pnpm build && pnpm test:build && pnpm smoke`) y se ejecuta en el shell del workspace antes de cada publicación. Publicar = botón *Publish/Redeploy* en *Deployments*, que ejecuta el `build` de `.replit`.

### Publicación y reversión
- **Migraciones:** se generan y aplican en dev (`pnpm db:generate`, `pnpm db:migrate`); al publicar, Replit propaga el esquema a producción. Cambios destructivos: *expand → migrate → contract* en publicaciones separadas (primero agregar columna/tabla, luego código que la usa, recién después quitar lo viejo). La app nunca migra al arrancar.
- **Reversión de código:** `git reset --hard <último tag bueno>` en el workspace (o `git revert`), `pnpm gate`, y volver a publicar; toma lo que dure un build (minutos). Si el panel *Deployments* ofrece volver a una publicación anterior, se puede usar, pero esa función no está verificada en este blueprint.
- **Reversión de esquema:** no existe; se corrige con una nueva migración.

### Dominio, DNS y TLS
- DNS en cPanel de Bluehosting (dominio registrado en NIC Chile). En Replit *Deployments → Settings → Link a domain*: `vectorbikes.cl` (canónico). Replit entrega un registro **A** y un **TXT `replit-verify=…`**; ambos se crean en cPanel y **el TXT se deja para siempre** (la renovación del certificado lo necesita). TLS lo emite y renueva Replit.
- `www.vectorbikes.cl`: se vincula también como dominio en Replit; el canónico de cada página apunta al apex.
- Correo: los registros de Resend van en el subdominio `send.vectorbikes.cl` (exactamente los que muestre el panel de Resend). Los registros MX, SPF y autodiscover de Microsoft 365 en el apex **no se tocan**.

---

## 13. Estrategia de pruebas

Los tests existen para que cada "Done when" de §9 sea decidible. Nada de red: Turnstile se simula con `fetchFn` y los correos usan el transporte `console`.

| Capa | Framework | Qué cubre | Dónde | Cuándo |
|---|---|---|---|---|
| Estática | Biome + `astro check` + `tsc --noEmit` | Formato, lint, tipos de `.astro`/`.ts`/`.tsx` | todo el repo menos exclusiones | cada paso (`pnpm check`) |
| Unitaria | Vitest | Motor de agenda y zonas horarias, reductor de la isla, config de Replit | `tests/unit/` | cada paso (`pnpm test`) |
| Integración | Vitest + PGlite (migraciones reales de `drizzle/`) | Esquema, transacción de reserva, concurrencia, handlers HTTP, correos, cancelación, auth admin, panel, recordatorios | `tests/integration/` | cada paso (`pnpm test`) |
| Build | Vitest leyendo `dist/client/` | HTML de la landing, isla montada, SEO, accesibilidad estática | `tests/build/` | desde el paso 6 (`pnpm test:build`) |
| Smoke | `scripts/smoke.sh` (curl) contra `dist/server/entry.mjs` | Arranque, salud con base real, códigos HTTP clave | `scripts/smoke.sh` | cada paso desde el 1 |
| E2E con navegador | NOT APPLICABLE en las compuertas — decisión tomada en GENERATE (Playwright poco confiable en el Nix de Replit); reemplazado por QA manual de lanzamiento | — | — | — |

### Flujos críticos
1. Reservar `taller` y `retiro` (API → transacción → 201 → correos post-commit) — `tests/integration/api.test.ts`, `email.test.ts`.
2. Imposibilidad de doble reserva: 50 intentos simultáneos → 1 éxito y 49 conflictos — `tests/integration/concurrency.test.ts`.
3. Cancelación de un solo uso que libera el bloque — `tests/integration/cancel-flow.test.ts`.
4. Acceso admin con rate limit y revocación — `tests/integration/admin-auth.test.ts`.
5. Recordatorio idempotente — `tests/integration/reminders.test.ts`.

### Datos de prueba
Cada test crea su propio PGlite en memoria con `createTestDb()` (aplica las migraciones generadas de `drizzle/`) y lo cierra al terminar: nada compartido, nada dependiente del orden. El reloj siempre se inyecta (`now`). La base real de Replit solo la tocan `pnpm db:migrate`, `pnpm db:check`, `pnpm reminders:send` y el smoke; no requiere Docker ni servicio adicional (§19.6).

### Lo que deliberadamente no se prueba
- Envío real por Resend, validación real de Turnstile y la plataforma Replit (se prueban a mano en el lanzamiento).
- Concurrencia multi-conexión real sobre PGlite: PGlite serializa transacciones en una conexión; la garantía bajo carga real la dan el índice único parcial y los bloqueos de §4, que son SQL estándar de Postgres.
- Píxeles del diseño: se revisa a mano contra `docs/design-preview.html` (claro, oscuro, móvil y escritorio).
- Textos de fecha localizados por ICU ("miércoles 16 de septiembre"): se afirman códigos, horas `HH:mm` y montos, no nombres de días.

---

## 14. Seguridad y secretos

| Preocupación | Control | Implementado en |
|---|---|---|
| Almacenamiento de secretos | Replit *Secrets* por workspace y por deployment; nunca en el repo | Replit; `.gitignore` (`.env`, `.env.*`) |
| Rotación de secretos | `CANCEL_TOKEN_SECRET`: rotar invalida enlaces de cancelación pendientes (aviso a clientes afectados); `SESSION_SECRET`: rota los hashes de IP (ventanas de rate limit se reinician); `RESEND_API_KEY` y Turnstile: regenerar en su panel y republicar. Revisión anual o ante sospecha | README `## Lanzamiento` |
| Validación de entrada | zod en cada borde (query, JSON, formularios admin, env) | `src/server/api/handlers.ts`, `src/server/admin/agenda.ts`, `src/lib/env.ts` |
| Codificación de salida / XSS | Astro escapa por defecto; prohibido `set:html` salvo el JSON-LD generado con `JSON.stringify` de datos propios; correos con `escapeHtml` | `.astro`, `src/server/email/templates.ts` |
| Inyección SQL | Solo constructor de Drizzle y plantillas `sql` parametrizadas; nunca SQL concatenado | `src/server/**` |
| AuthN / AuthZ | §8 — verificación en servidor en cada handler admin | `src/server/auth/admin-auth.ts`, páginas `/admin/**` |
| CSRF | `SameSite=Lax` + chequeo de `Origin` contra `PUBLIC_SITE_URL` en todo POST con efecto | `isAllowedOrigin` en `src/server/api/handlers.ts` |
| Rate limiting / abuso | Turnstile; 5 POST/IP/10 min → 429; 1 reserva futura por teléfono → 409; login 5 fallidos/IP+correo/15 min → 429 | `handlers.ts`, `create-booking.ts`, `admin-auth.ts` |
| Verificación de webhooks | NOT APPLICABLE — no se reciben webhooks | — |
| Auditoría de dependencias | `pnpm audit` mensual en el workspace; quien mantenga actualiza y corre `pnpm gate` | README |
| Cabeceras de seguridad | TLS lo termina Replit. v1 fija `cache-control: no-store` en API y admin. CSP y HSTS **no** se configuran en v1 (el widget de Turnstile y el JSON-LD en línea exigen afinar la CSP); revisitar tras el lanzamiento | `handlers.ts`, páginas admin |
| Datos personales | Se guardan: nombre, celular, correo, bici, descripción, comuna/dirección (solo retiro), `consent_at`, `ip_hash` (nunca la IP). Retención: mientras sirvan al historial de servicio o hasta solicitud. Supresión: a pedido por info@vectorbikes.cl, el dueño anonimiza la reserva desde el panel *Database* de Replit con `update bookings set customer_name = '(eliminado)', phone_e164 = '+56900000000', email = 'eliminado@vectorbikes.cl', bike = '-', description = '-', address = case when mode = 'retiro' then '(eliminado)' else null end, ip_hash = null where id = '<id>';` (la fila no se borra) | Aviso en `/privacidad`; procedimiento en README |
| Higiene de logs | `src/lib/log.ts` reemplaza por `[redactado]` las claves `email`, `correo`, `phone`, `phone_e164`, `phoneE164`, `telefono`, `customer_name`, `customerName`, `nombre`, `address`, `direccion`, `token`, `cancelToken`, `password`; nunca se registran cuerpos de correo | `src/lib/log.ts` |

**Reglas duras**
- Ningún secreto se commitea, se imprime en logs ni llega al navegador. Solo `PUBLIC_TURNSTILE_SITE_KEY`, `PUBLIC_WHATSAPP_NUMBER` y `PUBLIC_SITE_URL` son públicas.
- Toda verificación de autorización corre antes del trabajo.
- Los tokens (cancelación y sesión) solo existen en claro en el correo o la cookie; en base, hash.

**Régimen regulado:** datos personales bajo la Ley 19.628 y la Ley 21.719 de Chile. Obligaciones que crea para este build: consentimiento explícito con enlace al aviso (checkbox obligatorio, `consent_at`), aviso de privacidad accesible (`/privacidad`), minimización (sin RUT, sin fecha de nacimiento), canal para derechos (info@vectorbikes.cl) y procedimiento de supresión (arriba). Una revisión legal del texto del aviso es un ítem de lanzamiento, no una compuerta.

---

## 15. Accesibilidad

**Meta: WCAG 2.2 nivel AA.**

### Requisitos base
| Requisito | Regla |
|---|---|
| HTML semántico | `header`/`nav`/`main`/`footer`; un `h1` por página; niveles sin saltos (`Taller` es `h2`); listas para listas |
| Teclado | Todo control es `button`, `a`, `input`, `select`, `textarea` o `details` nativo; enlace "Saltar al contenido" a `#contenido` |
| Foco visible | `:focus-visible { outline: 2px solid var(--ink); outline-offset: 3px }` (≥ 3:1 sobre ambos fondos) |
| Contraste | Paleta de §7; bordes de controles con `--field-border` |
| Formularios | Etiqueta visible con `for`; errores en texto junto al campo con `aria-invalid` y `aria-describedby`; resumen en región viva `aria-live="polite"` del ticket; `autocomplete` en nombre, teléfono, correo, dirección |
| Imágenes | El logo va como fondo CSS dentro de enlaces con `aria-label`; el dibujo del hero es `aria-hidden="true"`; todo `<img>` lleva `alt` |
| Movimiento | `prefers-reduced-motion: reduce` pone `--dur-fast` y `--dur` en `0ms` |
| Zoom / reflow | Grillas colapsan a 1 columna bajo 560–980 px; la regla de bloques hace scroll horizontal dentro de `.ruler-box`, no la página |
| Regiones vivas | Ticket `aria-live="polite"`; errores de login `role="alert"`; advertencia de feriados `role="status"` |

### Adiciones WCAG 2.2
| SC | Cómo se cumple |
|---|---|
| 2.4.11 Foco no oculto | El header sticky mide ~66px; `html{scroll-padding-top:88px}` (cambio (h) del paso 1 en `global.css`) evita que tape el foco |
| 2.5.7 Arrastre | No hay interacciones de arrastre |
| 2.5.8 Tamaño de objetivo | Botones 46px, bloques 64px de alto, chips ≥ 44px |
| 3.3.7 Entrada redundante | Los datos del formulario se conservan en el estado de la isla tras un 409 o 422 |
| 3.3.8 Autenticación accesible | Login admin permite pegar y gestores de claves (`autocomplete="username"`/`current-password`), sin CAPTCHA; Turnstile es no interactivo en la mayoría de los casos |

### Verificación
```bash
pnpm build && pnpm test:build tests/build/a11y.test.ts   # expect: exit 0, 0 failed
```
Los chequeos automáticos detectan cerca de un tercio de los problemas reales. Antes del lanzamiento (§20.1): recorrido solo con teclado del flujo de reserva, una pasada con VoiceOver en Safari (iOS y macOS) y una pasada a 200 % de zoom en 320 px de ancho.

---

## 16. Observabilidad y costo

### Instrumentación
| Señal | Herramienta | Qué captura | Quién la mira |
|---|---|---|---|
| Errores | Logs JSON de la deployment de Replit (`src/lib/log.ts`, nivel `error`) | Excepciones con ruta y código de reserva; PII redactada | El dueño, ante un aviso |
| Logs | Mismo logger | Eventos `booking.created`, `booking.conflict`, `booking.cancelled`, `email.sent`, `email.failed`, `turnstile.error`, `rate_limited`, `admin.login_failed`, `reminders.run` | El dueño, semanal |
| Métricas | Consultas SQL de §1 en el panel *Database* | Reservas, no-shows, cancelaciones | El dueño, mensual |
| Disponibilidad | Monitor HTTP externo gratuito (p. ej. el plan gratuito de UptimeRobot, creado en el lanzamiento) sobre `https://vectorbikes.cl/api/health` cada 5 min con aviso a info@vectorbikes.cl | 200 con `"db":true` | El dueño |

No se agrega un rastreador de errores de terceros en v1: el volumen (~4 reservas/día) no lo justifica y evita otro proveedor con datos personales.

### Métricas que importan
| Métrica | Meta | Alertar en |
|---|---|---|
| `/api/health` disponible | 99,5 % mensual | 2 fallos consecutivos del monitor |
| Correos `email.failed` | 0 | ≥ 1 por día (revisar Resend) |
| Respuestas 409 `slot_unavailable` / reservas creadas | < 10 % | > 25 % en una semana (disponibilidad desactualizada o abuso) |
| Reservas confirmadas por semana | ≥ 5 tras el mes 1 | < 2 en dos semanas seguidas |

### Health check
`GET /api/health` ejecuta `select 1` contra la base: `200 {"ok":true,"db":true}` o `503 {"ok":false,"db":false}`. Lo consultan `scripts/smoke.sh` y el monitor externo.

### Modelo de costos
| Servicio | Nivel gratuito | Costo a escala v1 (~4 reservas/día, ~400 correos/mes) | Costo a 10× | Umbral a vigilar |
|---|---|---|---|---|
| Replit (Autoscale + Scheduled + Postgres) | Créditos mensuales incluidos en el plan Core (monto según la página de precios vigente) | Esperado dentro de los créditos del plan | Posible uso sobre los créditos | Uso de cómputo de Autoscale y almacenamiento de Postgres en el panel *Usage* |
| Resend | Plan gratuito con cuota mensual de correos (ver https://resend.com/pricing) | Esperado dentro del plan gratuito | ~4.000 correos/mes: revisar la cuota vigente | Cuota diaria/mensual del plan |
| Cloudflare Turnstile | Gratuito | 0 | 0 | — |
| Monitor externo | Gratuito | 0 | 0 | — |

**Costo mensual estimado al lanzar:** sin costo incremental esperado por sobre el plan Core ya pagado, siempre que el uso quede dentro de los créditos; los montos exactos no se verificaron en esta sesión, por eso el primer mes se revisa *Usage* en Replit y el panel de Resend. La partida más grande posible es el cómputo de Autoscale; la palanca más barata es que la landing ya está prerenderizada.

---

## 17. Enrutamiento de modelos

NOT APPLICABLE — this project does not call an LLM at runtime.

---

## 18. Skills para usar durante el build

Nunca dependencias duras: si una skill no está instalada, el builder sigue la guía de este blueprint, lo anota en una línea y continúa. Ninguna de estas es un comando con `/`: se activan por intención y se nombran en prosa.

| Skill | Pasos | Por qué | Instalación |
|---|---|---|---|
| frontend-design | 6, 7, 13 | Traducir el prototipo aprobado a componentes Astro/Preact sin perder precisión visual | `/plugin marketplace add anthropics/skills` y luego `/plugin install example-skills@anthropic-agent-skills` |
| ui-ux-pro-max | 6, 7, 11 | Mantener el sistema de §7 en piezas que el prototipo no dibuja (estados de error, panel admin, página de cancelación) | `/plugin marketplace add nextlevelbuilder/ui-ux-pro-max-skill` y luego `/plugin install ui-ux-pro-max@ui-ux-pro-max-skill` |
| emil-design-eng | 7 | Transiciones de selección de bloque, inversión del botón en hover y estados del ticket dentro de 140–250 ms | `npx skills@latest add emilkowalski/skills` |

---

## 19. Espacio de trabajo del agente

Modo bundle: todo lo de esta sección existe como archivo real bajo `blueprints/vector-bikes/workspace/`, en la misma ruta que ocupará en el proyecto. Los bloques de abajo son **byte a byte** el contenido de esos archivos.

```
blueprints/vector-bikes/workspace/
├── CLAUDE.md                          # §19.1
├── AGENTS.md                          # §19.2
├── .claude/
│   ├── settings.json                  # §19.3
│   ├── skills/add-migration/SKILL.md  # §19.4
│   ├── skills/add-holidays/SKILL.md   # §19.4
│   └── rules/{database,booking-engine,server-api,ui-design}.md   # §19.5
├── .replit .nvmrc .gitignore .env.example package.json pnpm-workspace.yaml   # §19.6
├── astro.config.mjs tsconfig.json biome.json vitest.config.ts drizzle.config.ts   # §19.6
├── src/lib/env.ts src/lib/log.ts tests/setup.ts scripts/db-migrate.ts scripts/db-check.ts   # §19.6
├── docs/design-preview.html           # ya presente (diseño aprobado)
└── public/brand/vector-bikes-logo.png # ya presente (logo oficial)
```

**Por qué `workspace/`:** el builder copia **un solo directorio** a la raíz del proyecto en vez de elegir archivos sueltos. **La copia es no destructiva y re-ejecutable** (§10 Bootstrap, paso 1): `rsync -a --ignore-existing blueprints/vector-bikes/workspace/ ./`, o el bucle portable equivalente, nunca pisa un archivo existente y sale 0 cuando salta — `cp -Rn` se descartó porque sale 1 en macOS al saltar. **Nunca se sobrescriben** en una segunda ejecución: `package.json`, `pnpm-lock.yaml`, `.env` y cualquier config que un paso haya editado. `.claude/commands/` no existe en este bundle ni debe crearse.

**Cumplen las compuertas del propio proyecto:** los `.ts`, `.mjs` y `.json` emitidos siguen el estilo de `biome.json` emitido (espacios, ancho 2, comillas dobles, punto y coma, comas finales, ancho de línea 100). `.claude/` está excluido de Biome (formato de proveedor), igual que `blueprints/`, `docs/`, `dist/`, `.astro/`, `drizzle/` y `node_modules/` — exclusiones escritas en `biome.json`, no en prosa. La última línea del Bootstrap (`pnpm exec biome ci .`) lo demuestra con el bundle presente.

### 19.1 `CLAUDE.md`

```markdown
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
7. Archivos < 400 líneas, funciones < 50 líneas.
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
```

### 19.2 `AGENTS.md`

```markdown
# Vector Bikes — instrucciones para agentes

Sitio y reservas en línea del taller Vector Bikes (Vitacura): Astro 7 + Preact + Postgres (Drizzle) en Replit.

## Comandos

| Tarea | Comando |
|---|---|
| Instalar | `pnpm install --frozen-lockfile` |
| Formatear | `pnpm format` |
| Chequeo estático | `pnpm check` |
| Tests | `pnpm test` · un archivo: `pnpm test <ruta>` |
| Build + tests del build | `pnpm build && pnpm test:build` |
| Smoke | `pnpm smoke` |
| Compuerta completa | `pnpm gate` |
| Migraciones (solo base dev) | `pnpm db:generate` · `pnpm db:migrate` · `pnpm db:check` |

Orden de trabajo: `blueprints/vector-bikes/tasks.json` y `blueprints/vector-bikes/epics/`. Todo comando se ejecuta desde la raíz del proyecto.

## No negociable

1. Nunca más de 1 bici por bloque ni más de 4 reservas por día: la garantía vive en la base (índice único parcial + locks), no solo en la UI.
2. `pnpm db:migrate` solo contra la base del workspace; la app nunca migra al arrancar ni contra producción.
3. Nunca borrar reservas: se cambia `status`.
4. Nunca commitear secretos ni `.env`; nunca registrar correos, teléfonos ni tokens sin redactar.
5. Nunca editar a mano `drizzle/` (se regenera desde `schema.ts`).
6. No construir nada de los No-Objetivos de `blueprint.md` §1.
7. Nunca marcar una tarea como hecha con una compuerta fallando, ni editar un comando de Verify para que pase.

Arquitectura completa, fronteras y tokens de diseño: `CLAUDE.md` en este mismo directorio.
```

### 19.3 `.claude/settings.json`

Incluye cada comando de los `Verify` de §9 y de §20.1 (los comandos compuestos con `|` o `&&` se autorizan por partes: cada parte está en la lista). Quedan sin autorizar a propósito (piden confirmación): `pnpm admin:set-password`, `git reset --hard` y cualquier `drizzle-kit push`/`drop`.

```json
{
  "permissions": {
    "allow": [
      "Bash(pnpm install)",
      "Bash(pnpm install:*)",
      "Bash(pnpm approve-builds:*)",
      "Bash(pnpm --version)",
      "Bash(pnpm format)",
      "Bash(pnpm check)",
      "Bash(pnpm lint)",
      "Bash(pnpm test)",
      "Bash(pnpm test:*)",
      "Bash(pnpm test:build)",
      "Bash(pnpm test:build:*)",
      "Bash(pnpm build)",
      "Bash(pnpm smoke)",
      "Bash(pnpm gate)",
      "Bash(pnpm dev)",
      "Bash(pnpm db:generate)",
      "Bash(pnpm db:migrate)",
      "Bash(pnpm db:check)",
      "Bash(pnpm reminders:send)",
      "Bash(pnpm exec biome:*)",
      "Bash(pnpm exec astro:*)",
      "Bash(pnpm exec tsc:*)",
      "Bash(pnpm exec vitest:*)",
      "Bash(sh scripts/smoke.sh)",
      "Bash(env -u ADMIN_EMAIL -u ADMIN_PASSWORD node scripts/admin-set-password.ts)",
      "Bash(node -v)",
      "Bash(node -e:*)",
      "Bash(corepack --version)",
      "Bash(corepack enable:*)",
      "Bash(corepack prepare:*)",
      "Bash(rsync -a --ignore-existing:*)",
      "Bash(mkdir -p:*)",
      "Bash(cp .env.example .env)",
      "Bash(test:*)",
      "Bash(grep:*)",
      "Bash(wc:*)",
      "Bash(tr:*)",
      "Bash(ls:*)",
      "Bash(cat:*)",
      "Bash(jq:*)",
      "Bash(curl -s:*)",
      "Bash(git --version)",
      "Bash(git init:*)",
      "Bash(git rev-parse:*)",
      "Bash(git config:*)",
      "Bash(git add:*)",
      "Bash(git commit:*)",
      "Bash(git tag:*)",
      "Bash(git status:*)",
      "Bash(git diff:*)",
      "Bash(git log:*)",
      "Bash(git ls-files:*)",
      "Bash(git check-ignore:*)"
    ],
    "deny": [
      "Read(./.env)",
      "Read(./.env.local)",
      "Bash(git push:*)",
      "Bash(rm -rf:*)",
      "Bash(pnpm exec drizzle-kit push:*)",
      "Bash(pnpm exec drizzle-kit drop:*)"
    ]
  }
}
```

### 19.4 Skills del proyecto — `.claude/skills/<nombre>/SKILL.md`

| Skill | Se activa con | Qué automatiza |
|---|---|---|
| `add-migration` | "agregar un campo", "nueva tabla", "cambiar el esquema", "migración" | Cambio de esquema seguro con Drizzle y la particularidad de Replit |
| `add-holidays` | "faltan feriados", "feriados 2027", aviso del panel admin | Carga verificada de feriados de un año nuevo |

`.claude/skills/add-migration/SKILL.md`:

````markdown
---
name: add-migration
description: Cambiar el esquema de Postgres de Vector Bikes (agregar tabla, columna, índice o check). Usar cuando se pide "agregar un campo", "nueva tabla", "cambiar el esquema" o "migración".
---

# Agregar una migración

## Cuándo usar
- Cualquier cambio en `src/server/db/schema.ts`.
- Un campo nuevo en `bookings`, `blocked_periods` u otra tabla de `blueprint.md` §4.

## Pasos
1. Editar solo `src/server/db/schema.ts`. Cambios destructivos (renombrar, borrar, NOT NULL nuevo): primero la parte aditiva y publicar; quitar lo viejo en una publicación posterior.
2. Ejecutar `pnpm db:generate` y leer el SQL que emite (no editarlo a mano).
3. Agregar o ajustar un test en `tests/integration/` que use `createTestDb()` y ejercite la columna o restricción nueva.
4. Ejecutar `pnpm db:migrate` (solo contra la base del workspace).
5. Publicar desde Replit: la plataforma propaga el esquema a producción; confirmarlo en el panel *Database*.

## Verify
```bash
pnpm check        # expect: exit 0
pnpm test         # expect: exit 0, 0 failed
pnpm db:migrate   # expect: exit 0
pnpm db:check     # expect: exit 0
```

## No hacer
- Ejecutar `drizzle-kit push` o migrar contra la base de producción.
- Editar archivos dentro de `drizzle/`.
- Borrar filas de `bookings`.
````

`.claude/skills/add-holidays/SKILL.md`:

````markdown
---
name: add-holidays
description: Cargar los feriados nacionales de Chile de un año nuevo (por ejemplo 2027) en Vector Bikes. Usar cuando el panel admin avisa que faltan feriados o cuando se publican los feriados oficiales del año siguiente.
---

# Agregar feriados de un año

## Cuándo usar
- `/admin` muestra "Las reservas llegan a <año> y ese año no tiene feriados cargados".
- Se publicaron oficialmente los feriados del año siguiente.

## Pasos
1. Obtener la lista oficial del año en dos fuentes (https://www.feriadoslegales.cl/ y https://festivos.online/chile/) y confirmar que coinciden. No inventar fechas.
2. Agregar cada feriado a `src/data/feriados-cl.json` como `{ "date": "AAAA-MM-DD", "name": "…" }`, en orden cronológico.
3. En `tests/unit/slots.test.ts`, agregar una aserción con un feriado del año nuevo (`computeDay` devuelve `status: "holiday"`) y actualizar la aserción de `missingHolidayYears` si ese año dejó de faltar.
4. Ejecutar `pnpm gate`, hacer commit y publicar (los feriados viajan en el build).

## Verify
```bash
pnpm test tests/unit/slots.test.ts   # expect: exit 0, 0 failed
pnpm gate                            # expect: exit 0
```

## No hacer
- Cargar feriados regionales o no confirmados oficialmente.
- Borrar años anteriores del archivo.
````

### 19.5 `.claude/rules/*.md`

| Archivo | Globs `paths` | Cubre |
|---|---|---|
| `.claude/rules/database.md` | `src/server/db/**`, `drizzle/**`, `scripts/db-*.ts` | Esquema, migraciones, Replit |
| `.claude/rules/booking-engine.md` | `src/server/booking/**`, `src/data/**` | Tiempo, reglas de negocio, concurrencia |
| `.claude/rules/server-api.md` | `src/server/api/**`, `src/server/auth/**`, `src/pages/api/**`, `src/pages/admin/**`, `src/pages/reservas/**` | Contratos HTTP, seguridad |
| `.claude/rules/ui-design.md` | `src/components/**`, `src/layouts/**`, `src/styles/**`, `src/pages/*.astro` | Fidelidad al diseño y accesibilidad |

`.claude/rules/database.md`:

```markdown
---
description: Esquema, migraciones y acceso a Postgres de Vector Bikes
paths:
  - "src/server/db/**"
  - "drizzle/**"
  - "scripts/db-*.ts"
---

# Base de datos

- `src/server/db/schema.ts` es la única fuente del esquema; `drizzle/` se regenera con `pnpm db:generate` y nunca se edita.
- Toda tabla nueva: `id uuid` con `defaultRandom()`, `created_at` y `updated_at` `timestamptz` (salvo tablas de bloqueo con PK natural, como `booking_days`).
- Instantes en `timestamptz` UTC; fechas y horas locales de negocio en `date` y `time`.
- Dinero en enteros CLP (`integer`), nunca decimales.
- Checks e índices parciales con SQL literal de columnas (`sql\`is_active = true\``), no referencias calificadas.
- Solo constructor de consultas de Drizzle o `sql\`\`` parametrizado; nunca `db.query.*` relacional (PGlite y postgres-js comparten solo esa API).
- `pnpm db:migrate` solo contra la base del workspace; nunca `drizzle-kit push`; la app nunca migra al arrancar.
- Nunca borrar filas de `bookings`.
- Cambios destructivos: expand → migrate → contract en publicaciones separadas (Replit propaga el esquema al publicar).
```

`.claude/rules/booking-engine.md`:

```markdown
---
description: Motor de agenda, zonas horarias y escritura concurrente de reservas
paths:
  - "src/server/booking/**"
  - "src/data/**"
---

# Motor de reservas

- Zona única: `America/Santiago` (constante `TIMEZONE` de `rules.ts`). Horas de negocio como texto `HH:MM` local; conversión a instantes solo con luxon en `slots.ts`.
- Nunca sumar 24 horas a un instante para "mañana": usar `addDays` sobre fechas locales.
- Una hora local inexistente (cambio de horario) devuelve `null` en `localToInstant` y no genera bloque.
- Funciones puras con `now: Date` inyectado; prohibido `new Date()` o `Date.now()` dentro de la lógica.
- La disponibilidad es consultiva; `createBooking` revalida todas las reglas dentro de la transacción (horario, feriado, bloqueos, antelación 120 min, horizonte 30 días, tope 4, teléfono).
- Orden de locks fijo: `booking_days` (`FOR UPDATE`) → `pg_advisory_xact_lock(hashtext(phone))`. Nunca al revés.
- Nada de red ni correos dentro de la transacción; se notifica después del commit.
- Violación única (`isUniqueViolation`) → `slot_unavailable`, nunca 500.
- `retiro` ocupa 2 bloques consecutivos y cuenta como 1 de las 4 reservas del día.
- Feriados solo desde `src/data/feriados-cl.json`; nunca inventar años no publicados.
```

`.claude/rules/server-api.md`:

```markdown
---
description: Handlers HTTP, páginas de servidor, sesión admin y chequeos de seguridad
paths:
  - "src/server/api/**"
  - "src/server/auth/**"
  - "src/pages/api/**"
  - "src/pages/admin/**"
  - "src/pages/reservas/**"
---

# API y servidor

- Las páginas y endpoints son envoltorios: parsean, llaman a `src/server/**` y devuelven su resultado. Sin SQL en `src/pages/**`.
- Error siempre `{ error, code, fields? }` con los códigos `validation_error` 422, `turnstile_failed` 403, `slot_unavailable`/`phone_limit` 409, `rate_limited` 429 (`Retry-After`), `internal_error` 500.
- Éxito de `POST /api/reservas`: 201 `{ code, service_date, start, end, mode, fee }`, sin envoltorio.
- Orden en `POST /api/reservas`: rate limit → zod → Turnstile → transacción → correos post-commit (un fallo de correo nunca cambia el 201).
- Todo POST con efecto (cancelación y admin) llama `isAllowedOrigin(request)` antes de leer el formulario.
- Toda página admin empieza con `requireAdmin(...)` y redirige 303 a `/admin/login` si devuelve `null`; nunca confiar solo en middleware.
- Respuestas con datos personales o sesión: `cache-control: no-store`; páginas admin y cancelación con `noindex`.
- Tokens (cancelación, sesión) en base solo como hash; comparar claves con `timingSafeEqual`.
- Logs vía `src/lib/log.ts`; nunca `console.log` de objetos con correo, teléfono o tokens.
```

`.claude/rules/ui-design.md`:

```markdown
---
description: Fidelidad al diseño aprobado y accesibilidad de la interfaz
paths:
  - "src/components/**"
  - "src/layouts/**"
  - "src/styles/**"
  - "src/pages/*.astro"
---

# Interfaz

- `docs/design-preview.html` manda: clases, textos y estructura se copian de ahí; las únicas diferencias permitidas están en `blueprint.md` §6.
- Colores solo con variables de `:root` (`--ground`, `--surface`, `--ink`, `--ink-2`, `--steel`, `--rule`, `--hatch`, `--on-ink`, `--field-border`); ningún hex nuevo.
- Radio 2px, reglas de 1px, sin sombras (salvo `inset 0 0 0 1px var(--ink)` de selección).
- Botón primario invierte en hover (fondo `--surface`, texto y borde `--ink`); enlaces de nav con `:not(.btn)`.
- Formularios: `label` visible con `for`, `.fields{align-items:start}`, `.field{align-content:start}`, errores en texto con `aria-invalid` y `aria-describedby`.
- Un solo `h1` por página, niveles sin saltos; controles nativos (`button`, `a`, `details`), nunca `div` clicable.
- Transiciones con `var(--dur-fast)`/`var(--dur)`; sin `!important`.
- Una sola isla (`BookingIsland`, `client:visible`); todo lo demás es HTML estático.
- WhatsApp: si `PUBLIC_WHATSAPP_NUMBER` está vacío, el botón no se renderiza.
- Etiquetas no-void siempre cerradas (Astro 7).
```

### 19.6 Configuración crítica para las compuertas e infraestructura local

Cada archivo que un `Verify` de §9 necesita para ejecutarse existe como archivo real bajo `workspace/`, con contenido completo, y llega a la raíz con la copia del Bootstrap **antes** del primer comando que gobierna. Ninguno importa módulos que cree un paso posterior (por eso `tsc` del paso 1 los acepta).

| Archivo | Ruta en el proyecto | Qué `Verify` lo necesita | Resolución / entorno que resuelve | Exclusión del bundle |
|---|---|---|---|---|
| `.replit` | `.replit` | 1 (grep del entry), 12 (`replit-config.test.ts`) | Node 24, puerto 4321, build/run de la deployment | n/a — Replit no recorre el árbol |
| `.nvmrc` | `.nvmrc` | Bootstrap (validación de Node) | — | n/a — ninguna herramienta recorre el árbol con él |
| `.gitignore` | `.gitignore` | todos los `Checkpoint`; §20.1 | `!.env.example` después de `.env.*` | no se excluye: `blueprints/vector-bikes/` se commitea a propósito |
| `.env.example` | `.env.example` | Bootstrap (`cp .env.example .env`) → 2, 4, 5, 8, 12 | Valores locales/de prueba de cada variable de §10 | n/a — no es config de herramienta |
| `package.json` | `package.json` | todos (`pnpm <script>`) | Scripts con `--env-file-if-exists=.env`; dependencias fijadas | n/a — el workspace de pnpm lo acota `pnpm-workspace.yaml` |
| `pnpm-workspace.yaml` | `pnpm-workspace.yaml` | Bootstrap (`pnpm install`) | `allowBuilds: esbuild: true` | `- "!blueprints/**"` |
| `astro.config.mjs` | `astro.config.mjs` | 1, 5–14 (`pnpm build`, `astro check`) | output server, node standalone, preact, sitemap, Tailwind; `site` = `process.env.PUBLIC_SITE_URL \|\| "https://vectorbikes.cl"`; `checkOrigin: false` (§8) | Astro solo lee `src/` y `public/`; Tailwind excluye con `@source not "../../blueprints";` en `src/styles/global.css` (paso 1) |
| `tsconfig.json` | `tsconfig.json` | 1–14 (`astro check`, `tsc --noEmit`) | `allowImportingTsExtensions`, `erasableSyntaxOnly`, `verbatimModuleSyntax`, JSX Preact, `types: ["node"]` | `"exclude": ["dist", "node_modules", "blueprints", "docs"]` |
| `biome.json` | `biome.json` | 1–14 (`pnpm format`, `biome ci`); Bootstrap | `css.parser.tailwindDirectives: true`; overrides de `.astro` | `"!!**/blueprints"` (y `docs`, `dist`, `.astro`, `drizzle`, `.claude`, `node_modules`) |
| `vitest.config.ts` | `vitest.config.ts` | 2–14 (`pnpm test`, `pnpm test:build`) | Suites por `VITEST_SUITE`; `setupFiles: ["tests/setup.ts"]`; entorno `node` (resuelve `.ts` y JSON con atributos vía Vite) | `exclude: ["node_modules/**", "dist/**", "blueprints/**", "docs/**"]` |
| `drizzle.config.ts` | `drizzle.config.ts` | 2 (`pnpm db:generate`) | Cargador: `process.loadEnvFile(".env")` si existe; respaldo del URL local | n/a — lee solo `./src/server/db/schema.ts` |
| `src/lib/env.ts` | `src/lib/env.ts` | 2 (test de entorno), 4, 5, 8, 10 | Accesores zod por funcionalidad | n/a — no es herramienta |
| `src/lib/log.ts` | `src/lib/log.ts` | 5, 8, 9, 12 (código que registra) | Redacción de PII | n/a — no es herramienta |
| `tests/setup.ts` | `tests/setup.ts` | 2–14 (toda la suite) | Valores de prueba; fuerza `EMAIL_TRANSPORT=console` y la clave Turnstile de prueba | n/a — lo carga Vitest por ruta |
| `scripts/db-migrate.ts` | `scripts/db-migrate.ts` | 2, 12 (`pnpm db:migrate`) | Flag `--env-file-if-exists=.env` en el script de `package.json`; niega correr con `REPLIT_DEPLOYMENT` (exit 2) | n/a — lee solo `drizzle/` |
| `scripts/db-check.ts` | `scripts/db-check.ts` | 2 (`pnpm db:check`) | Mismo flag | n/a — lee solo `drizzle/*.sql` |

**Servicio del que dependen compuertas: Postgres.** `pnpm db:migrate`, `pnpm db:check`, `pnpm reminders:send` y `scripts/smoke.sh` (desde el paso 2) necesitan una base real. Provisión: **la base PostgreSQL del workspace de Replit** (herramienta *Database*, se crea una vez antes del paso 2; Replit no ofrece Docker, así que no se emite `docker-compose.yml`). (1) Lo que la inicia: la plataforma, siempre encendida. (2) La variable: `DATABASE_URL`, en §10 con su valor local literal y en `.env.example`; los tests **no** la usan (PGlite en memoria). (3) Comandos: no hay `up`/`down`; el reinicio de datos de dev es borrar y recrear la base desde el panel (manual, nunca una compuerta). (4) Permisos: `pnpm db:migrate`, `pnpm db:check`, `pnpm reminders:send` y `sh scripts/smoke.sh` están en §19.3. Fuera de Replit: un Postgres 16 local en `postgres://postgres:postgres@127.0.0.1:5432/vector_bikes`.

`.replit`:

```toml
# Vector Bikes — configuración de Replit.
# VERIFICAR ANTES DE INSTALAR: el nombre del módulo de Node 24 no está confirmado en la documentación.
# Si Replit lo cambia al elegir Node 24 en el selector de lenguaje/módulo, se acepta su valor.
modules = ["nodejs-24"]
run = "sh -c 'corepack pnpm@12.4.2 build && corepack pnpm@12.4.2 start'"

[deployment]
deploymentTarget = "cloudrun"
build = ["sh", "-c", "corepack pnpm@12.4.2 install --frozen-lockfile --config.minimumReleaseAge=0 && corepack pnpm@12.4.2 build"]
run = ["sh", "-c", "HOST=0.0.0.0 PORT=4321 node dist/server/entry.mjs"]

[[ports]]
localPort = 4321
externalPort = 80

[packager]
afterInstall = ""

[packager.features]
enabledForHosting = false
guessImports = false
packageSearch = false
```

`.nvmrc`:

```
24
```

`.gitignore`:

```gitignore
# Dependencias y salidas de build
node_modules/
dist/
.astro/
coverage/

# Entorno: nunca se commitean valores reales
.env
.env.*
!.env.example

# Logs y temporales
*.log
.DS_Store

# Estado local de Replit y corepack
.local/
.cache/
.config/
```

`.env.example`:

```dotenv
# Copiar a .env (el Bootstrap lo hace). En Replit, los valores reales van en Secrets y tienen precedencia.
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/vector_bikes
PUBLIC_SITE_URL=https://vectorbikes.cl
PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
SESSION_SECRET=dev-session-secret-change-me-0123456789abcd
CANCEL_TOKEN_SECRET=dev-cancel-secret-change-me-0123456789abcde
EMAIL_TRANSPORT=console
RESEND_API_KEY=
EMAIL_FROM="Vector Bikes <reservas@send.vectorbikes.cl>"
EMAIL_REPLY_TO=info@vectorbikes.cl
SHOP_NOTIFY_EMAIL=info@vectorbikes.cl
PUBLIC_WHATSAPP_NUMBER=
ADMIN_EMAIL=
ADMIN_PASSWORD=
```

`package.json`:

```json
{
  "name": "vector-bikes",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=22.12.0"
  },
  "scripts": {
    "dev": "node --env-file-if-exists=.env node_modules/astro/astro.js dev --host 0.0.0.0 --port 4321",
    "build": "astro build",
    "start": "HOST=0.0.0.0 PORT=4321 node dist/server/entry.mjs",
    "format": "biome check --write .",
    "lint": "biome check .",
    "check": "biome ci . && astro check && tsc --noEmit",
    "test": "vitest run",
    "test:build": "VITEST_SUITE=build vitest run",
    "smoke": "sh scripts/smoke.sh",
    "gate": "pnpm check && pnpm test && pnpm build && pnpm test:build && pnpm smoke",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "node --env-file-if-exists=.env scripts/db-migrate.ts",
    "db:check": "node --env-file-if-exists=.env scripts/db-check.ts",
    "admin:set-password": "node --env-file-if-exists=.env scripts/admin-set-password.ts",
    "reminders:send": "node --env-file-if-exists=.env scripts/reminders-send.ts"
  },
  "dependencies": {
    "@astrojs/node": "11.1.5",
    "@astrojs/preact": "6.0.5",
    "@astrojs/sitemap": "3.7.4",
    "@fontsource-variable/archivo": "5.3.0",
    "@fontsource/ibm-plex-mono": "5.3.0",
    "@fontsource/michroma": "5.3.0",
    "@tailwindcss/vite": "4.3.3",
    "astro": "7.3.2",
    "drizzle-orm": "0.45.2",
    "ics": "3.12.0",
    "luxon": "3.7.2",
    "postgres": "3.4.9",
    "preact": "10.29.8",
    "resend": "6.28.1",
    "tailwindcss": "4.3.3",
    "zod": "4.6.5"
  },
  "devDependencies": {
    "@astrojs/check": "0.9.10",
    "@biomejs/biome": "2.5.13",
    "@electric-sql/pglite": "0.5.8",
    "@types/luxon": "3.7.5",
    "@types/node": "^24",
    "drizzle-kit": "0.31.10",
    "typescript": "~6.0.3",
    "vitest": "^5.0.1"
  }
}
```

La compuerta completa se llama **`gate`** (`pnpm gate`), no `ci`: `pnpm ci` es un comando propio de pnpm y no ejecutaría el script.

`pnpm-workspace.yaml`:

```yaml
# Proyecto único: blueprints/ (el bundle, con su propio workspace/package.json) nunca es un paquete.
packages:
  - "."
  - "!blueprints/**"

# Scripts de instalación permitidos (verificado con pnpm 12.4.2: aprueba el postinstall de esbuild).
allowBuilds:
  esbuild: true

# pnpm 12 exige una antigüedad mínima de publicación; estas versiones fijadas eran recientes el 2026-09-15.
# pnpm las agrega solo en el primer install; se emiten ya presentes para que el archivo no cambie.
minimumReleaseAgeExclude:
  - '@vitest/mocker@5.0.1'
  - '@vitest/spy@5.0.1'
  - resend@6.28.1
  - vitest@5.0.1
```

`astro.config.mjs`:

```js
import node from "@astrojs/node";
import preact from "@astrojs/preact";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: process.env.PUBLIC_SITE_URL || "https://vectorbikes.cl",
  output: "server",
  adapter: node({ mode: "standalone" }),
  integrations: [
    preact(),
    sitemap({
      filter: (page) => !page.includes("/admin") && !page.includes("/reservas"),
    }),
  ],
  security: {
    checkOrigin: false,
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
```

`tsconfig.json`:

```json
{
  "extends": "astro/tsconfigs/strict",
  "include": [".astro/types.d.ts", "**/*"],
  "exclude": ["dist", "node_modules", "blueprints", "docs"],
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "preact",
    "noEmit": true,
    "allowImportingTsExtensions": true,
    "erasableSyntaxOnly": true,
    "verbatimModuleSyntax": true,
    "noUncheckedIndexedAccess": true,
    "types": ["node"]
  }
}
```

`biome.json`:

```json
{
  "$schema": "https://biomejs.dev/schemas/2.5.13/schema.json",
  "vcs": {
    "enabled": true,
    "clientKind": "git",
    "useIgnoreFile": true
  },
  "files": {
    "includes": [
      "**",
      "!!**/blueprints",
      "!!**/docs",
      "!!**/dist",
      "!!**/.astro",
      "!!**/drizzle",
      "!!**/.claude",
      "!!**/node_modules"
    ]
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "double",
      "semicolons": "always",
      "trailingCommas": "all"
    }
  },
  "css": {
    "parser": {
      "tailwindDirectives": true
    }
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true
    }
  },
  "assist": {
    "actions": {
      "source": {
        "organizeImports": "off"
      }
    }
  },
  "overrides": [
    {
      "includes": ["**/*.astro"],
      "linter": {
        "rules": {
          "correctness": {
            "noUnusedVariables": "off",
            "noUnusedImports": "off"
          }
        }
      }
    }
  ]
}
```

`vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

const isBuildSuite = process.env.VITEST_SUITE === "build";

export default defineConfig({
  test: {
    include: isBuildSuite
      ? ["tests/build/**/*.test.ts"]
      : ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    exclude: ["node_modules/**", "dist/**", "blueprints/**", "docs/**"],
    setupFiles: ["tests/setup.ts"],
    environment: "node",
    testTimeout: 60000,
    hookTimeout: 60000,
  },
});
```

`drizzle.config.ts`:

```ts
import { existsSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL || "postgres://postgres:postgres@127.0.0.1:5432/vector_bikes",
  },
  strict: true,
  verbose: true,
});
```

`src/lib/env.ts`:

```ts
import { z } from "zod";

type EnvSource = Record<string, string | undefined>;

export class EnvError extends Error {
  readonly variables: string[];

  constructor(variables: string[]) {
    super(`Variable de entorno faltante o inválida: ${variables.join(", ")}`);
    this.name = "EnvError";
    this.variables = variables;
  }
}

function parseSource<T extends z.ZodType>(schema: T, source: EnvSource): z.infer<T> {
  const result = schema.safeParse(source);
  if (!result.success) {
    const names = result.error.issues.map((issue) => String(issue.path[0] ?? "desconocida"));
    throw new EnvError([...new Set(names)]);
  }
  return result.data;
}

const required = z.string().trim().min(1);
const secret = z.string().min(32);

const dbSchema = z.object({ DATABASE_URL: required });
const cancelSchema = z.object({ CANCEL_TOKEN_SECRET: secret });
const turnstileSchema = z.object({ TURNSTILE_SECRET_KEY: required });
const hashSchema = z.object({ SESSION_SECRET: secret });
const siteSchema = z.object({ PUBLIC_SITE_URL: z.url() });
const emailSchema = z
  .object({
    EMAIL_TRANSPORT: z.enum(["resend", "console"]),
    RESEND_API_KEY: z.string().optional(),
    EMAIL_FROM: required,
    EMAIL_REPLY_TO: z.email(),
    SHOP_NOTIFY_EMAIL: z.email(),
  })
  .superRefine((value, ctx) => {
    if (value.EMAIL_TRANSPORT === "resend" && !value.RESEND_API_KEY) {
      ctx.addIssue({
        code: "custom",
        path: ["RESEND_API_KEY"],
        message: "requerida cuando EMAIL_TRANSPORT=resend",
      });
    }
  });
const adminSetupSchema = z.object({
  ADMIN_EMAIL: z.email(),
  ADMIN_PASSWORD: z.string().min(12),
});

export type EmailEnv = z.infer<typeof emailSchema>;

/** Paso 2 en adelante. */
export function getDbEnv(source: EnvSource = process.env) {
  return parseSource(dbSchema, source);
}

/** Paso 4 en adelante. */
export function getCancelEnv(source: EnvSource = process.env) {
  return parseSource(cancelSchema, source);
}

/** Paso 5 en adelante. */
export function getTurnstileEnv(source: EnvSource = process.env) {
  return parseSource(turnstileSchema, source);
}

/** Paso 5 en adelante. */
export function getHashEnv(source: EnvSource = process.env) {
  return parseSource(hashSchema, source);
}

/** Paso 8 en adelante. */
export function getSiteEnv(source: EnvSource = process.env) {
  return parseSource(siteSchema, source);
}

/** Paso 8 en adelante. */
export function getEmailEnv(source: EnvSource = process.env): EmailEnv {
  return parseSource(emailSchema, source);
}

/** Solo scripts/admin-set-password.ts (paso 10). */
export function getAdminSetupEnv(source: EnvSource = process.env) {
  return parseSource(adminSetupSchema, source);
}
```

`src/lib/log.ts`:

```ts
type LogLevel = "info" | "warn" | "error";
type LogFields = Record<string, unknown>;

const REDACTED_KEYS = new Set([
  "email",
  "correo",
  "phone",
  "phone_e164",
  "phoneE164",
  "telefono",
  "customer_name",
  "customerName",
  "nombre",
  "address",
  "direccion",
  "token",
  "cancelToken",
  "password",
]);

function redact(value: unknown, depth: number): unknown {
  if (depth > 4 || value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redact(item, depth + 1));
  }
  const output: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value)) {
    output[key] = REDACTED_KEYS.has(key) ? "[redactado]" : redact(inner, depth + 1);
  }
  return output;
}

function write(level: LogLevel, event: string, fields: LogFields): void {
  const safe = redact(fields, 0) as LogFields;
  const line = JSON.stringify({ level, event, time: new Date().toISOString(), ...safe });
  if (level === "error") {
    console.error(line);
  } else {
    console.log(line);
  }
}

export const log = {
  info: (event: string, fields: LogFields = {}) => write("info", event, fields),
  warn: (event: string, fields: LogFields = {}) => write("warn", event, fields),
  error: (event: string, fields: LogFields = {}) => write("error", event, fields),
};

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
```

`tests/setup.ts`:

```ts
// Valores de prueba. Los tests nunca usan la red ni secretos reales.
const forced: Record<string, string> = {
  EMAIL_TRANSPORT: "console",
  TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
  SESSION_SECRET: "test-session-secret-0123456789abcdef0123",
  CANCEL_TOKEN_SECRET: "test-cancel-secret-0123456789abcdef01234",
  EMAIL_FROM: "Vector Bikes <reservas@send.vectorbikes.cl>",
  EMAIL_REPLY_TO: "info@vectorbikes.cl",
  SHOP_NOTIFY_EMAIL: "info@vectorbikes.cl",
};

for (const [key, value] of Object.entries(forced)) {
  process.env[key] = value;
}

// Misma regla que astro.config.mjs, para que los tests del build esperen el mismo `site`.
if (!process.env.PUBLIC_SITE_URL) {
  process.env.PUBLIC_SITE_URL = "https://vectorbikes.cl";
}

export {};
```

`scripts/db-migrate.ts`:

```ts
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { getDbEnv } from "../src/lib/env.ts";

if (process.env.REPLIT_DEPLOYMENT) {
  console.error(
    "db:migrate no corre dentro de una deployment: Replit propaga el esquema al publicar.",
  );
  process.exit(2);
}

try {
  const { DATABASE_URL } = getDbEnv();
  const client = postgres(DATABASE_URL, { max: 1 });
  await migrate(drizzle({ client }), { migrationsFolder: "drizzle" });
  await client.end();
  console.log(JSON.stringify({ ok: true, migrationsFolder: "drizzle" }));
  process.exit(0);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
```

`scripts/db-check.ts`:

```ts
import { readdirSync, readFileSync } from "node:fs";
import postgres from "postgres";
import { getDbEnv } from "../src/lib/env.ts";

const CREATE_TABLE = /CREATE TABLE(?: IF NOT EXISTS)? "(?:public"\.")?([a-z_]+)"/g;

function tablesFromMigrations(folder: string): string[] {
  const names = new Set<string>();
  const files = readdirSync(folder).filter((file) => file.endsWith(".sql"));
  for (const file of files) {
    const sqlText = readFileSync(`${folder}/${file}`, "utf8");
    for (const match of sqlText.matchAll(CREATE_TABLE)) {
      if (match[1]) {
        names.add(match[1]);
      }
    }
  }
  return [...names].sort();
}

try {
  const expected = tablesFromMigrations("drizzle");
  if (expected.length === 0) {
    throw new Error("No hay CREATE TABLE en drizzle/*.sql: ejecuta pnpm db:generate");
  }
  const { DATABASE_URL } = getDbEnv();
  const sql = postgres(DATABASE_URL, { max: 1 });
  await sql`select 1`;
  const rows = await sql<{ table_name: string }[]>`
    select table_name from information_schema.tables where table_schema = 'public'
  `;
  await sql.end();
  const present = new Set(rows.map((row) => row.table_name));
  const missing = expected.filter((name) => !present.has(name));
  if (missing.length > 0) {
    console.error(JSON.stringify({ ok: false, missing }));
    process.exit(1);
  }
  console.log(JSON.stringify({ ok: true, tables: expected }));
  process.exit(0);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
```

#### Matriz de convención de resolución

**La convención, una sola vez:** especificadores **relativos con extensión explícita** (`.ts`, `.tsx`, `.json`), sin alias de ruta ni barrels; los JSON se importan con `with { type: "json" }`; las importaciones solo de tipos usan `import type`.

| Contexto | Comando que lo ejercita | Cómo aparece | Config + ajuste literal que lo hace funcionar |
|---|---|---|---|
| Código de la app | `pnpm build` | `import { getDb } from "../../server/db/client.ts";` | Vite resuelve la ruta literal; `tsconfig.json` → `"allowImportingTsExtensions": true` con `"noEmit": true` para que `astro check` lo acepte |
| Tests | `pnpm test` / `pnpm test:build` | `import { computeDay } from "../../src/server/booking/slots.ts";` | Vitest usa el resolvedor de Vite (literal); `vitest.config.ts` sin alias; mismo `tsconfig.json` para `tsc` |
| Scripts standalone | `node --env-file-if-exists=.env scripts/db-migrate.ts` (y `db-check`, `admin-set-password`, `reminders-send`) | `import { getDbEnv } from "../src/lib/env.ts";` | Node 24 quita tipos y resuelve `.ts` **literalmente**; `package.json` → `"type": "module"`; `tsconfig.json` → `"erasableSyntaxOnly": true` y `"verbatimModuleSyntax": true` garantizan que todo archivo alcanzado sea borrable; JSON con `with { type: "json" }` (lo exige Node ESM) |
| Build / bundle | `pnpm build` → `sh scripts/smoke.sh` ejecuta `node dist/server/entry.mjs` | sin `.ts` en la salida | Vite empaqueta y reescribe; el smoke prueba que la salida resuelve |
| Chequeo de tipos | `pnpm check` (`astro check && tsc --noEmit`) | especificadores `.ts`/`.tsx` | `allowImportingTsExtensions` exige `noEmit: true`: ambos en `tsconfig.json`; `tests/setup.ts` termina en `export {};` para ser módulo |
| drizzle-kit | `pnpm db:generate` | `schema: "./src/server/db/schema.ts"` | `schema.ts` solo importa paquetes (`drizzle-orm`), así el cargador de drizzle-kit no resuelve rutas relativas del proyecto |

#### Reconciliación de valores entre artefactos

| Valor compartido | Fuente única | Valor literal | Otros lugares donde aparece | Comparado |
|---|---|---|---|---|
| Entry del servidor | `astro.config.mjs` (`output: "server"` + `node({ mode: "standalone" })`, `outDir` por defecto) | `dist/server/entry.mjs` | `.replit` `[deployment] run` · `package.json` `scripts.start` · `scripts/smoke.sh` · §3 · §12 · paso 1 Verify · `tests/unit/replit-config.test.ts` | yes |
| Puerto de la app | `.replit` `[[ports]] localPort` | `4321` | `.replit` `PORT=4321` · `package.json` `dev` (`--port 4321`) y `start` (`PORT=4321`) · CLAUDE.md · §12 · paso 1 Verify · `replit-config.test.ts` (smoke usa `4399` a propósito, `SMOKE_PORT`) | yes |
| URL del sitio por defecto | `astro.config.mjs` `site` | `https://vectorbikes.cl` | `tests/setup.ts` · `.env.example` · `public/robots.txt` (`Sitemap: https://vectorbikes.cl/sitemap-index.xml`) · `tests/build/seo.test.ts` | yes |
| Carpeta de migraciones | `drizzle.config.ts` `out` | `./drizzle` (= `drizzle`) | `scripts/db-migrate.ts` · `scripts/db-check.ts` · `tests/helpers/pglite.ts` · `biome.json` `!!**/drizzle` · §3 · §4 | yes |
| Ruta del esquema | `drizzle.config.ts` `schema` | `./src/server/db/schema.ts` | §3 · §4 · paso 2 · `.claude/rules/database.md` · CLAUDE.md | yes |
| Setup de tests | `vitest.config.ts` `setupFiles` | `tests/setup.ts` | §3 · §19.6 | yes |
| Gestor de paquetes | `.replit` `[deployment]` `build` | `pnpm@12.4.2` | §10 Bootstrap `corepack prepare pnpm@12.4.2` · CLAUDE.md · §11 · paso 1 Verify · `replit-config.test.ts` | yes |
| URL local de Postgres | `.env.example` `DATABASE_URL` | `postgres://postgres:postgres@127.0.0.1:5432/vector_bikes` | `drizzle.config.ts` respaldo · §10 · §19.6 | yes |
| Ruta del bundle | ubicación del bundle en el proyecto | `blueprints` (`blueprints/vector-bikes/workspace`) | `biome.json` `!!**/blueprints` · `tsconfig.json` `exclude` · `vitest.config.ts` `exclude` · `pnpm-workspace.yaml` `!blueprints/**` · `src/styles/global.css` `@source not "../../blueprints"` · §10 Bootstrap `WS=` | yes |
| Nombre de la compuerta | `package.json` `scripts.gate` | `pnpm gate` | CLAUDE.md · AGENTS.md · `.claude/settings.json` · skill `add-holidays` · paso 14 · §12 · §20.1 · README | yes |
| Claves de prueba Turnstile | informe verificado (Cloudflare) | `1x00000000000000000000AA` / `1x0000000000000000000000000000000AA` | `.env.example` · `tests/setup.ts` (secreto) · §10 | yes |
| Nombres de variables | `.env.example` | 14 claves de §10 | `src/lib/env.ts` · `tests/setup.ts` · §10 · CLAUDE.md | yes |
| Cuerpo de salud | `src/pages/api/health.ts` (paso 2) | `{"ok":true,"db":true}` | §5 · `scripts/smoke.sh` (`grep '"db":true'`) · §16 | yes |
| Logo | `public/brand/vector-bikes-logo.png` | `/brand/vector-bikes-logo.png` | `global.css` (`.wordmark`, `.drawing .mark`) · `Base.astro` (icon, `og:image`) · §7 | yes |

Cada contrato se ejercita en el primer paso donde existen ambos lados: entry, puerto y versión de pnpm (`.replit` ↔ `package.json` ↔ build de `[deployment]`) en el paso 1; carpeta de migraciones ↔ helper y scripts en el paso 2; `site` ↔ tests del build en el paso 6 (landing) y 13 (SEO); `gate` en el paso 14, donde se ejecuta por primera vez.

#### Reconciliación de artefactos byte a byte

| Artefacto byte a byte | Escrito por | Primera comparación | Reglas del blueprint que lo restringen | Llamada de runtime que lo produce, sobre el pin de §11 | Ambos confirmados |
|---|---|---|---|---|---|
| Cadenas ISO UTC de `tests/unit/slots.test.ts` (`2026-01-15T18:00:00.000Z`, `2026-06-15T19:00:00.000Z`, `2026-09-05T14:00:00.000Z`, `2026-09-07T18:00:00.000Z`, `2026-04-02T18:00:00.000Z`, `2026-04-06T19:00:00.000Z`, y `null` para `2026-09-06 00:00`) | paso 3 | paso 3 | §4 (instantes UTC, zona `America/Santiago`), §5 (horario 15:00/10:00), regla de hora inexistente de §9 paso 3 | `DateTime.fromISO("<fecha>T<hora>", { zone: "America/Santiago" }).toUTC().toISO()` con luxon 3.7.2 sobre Node 24.21.0 (tzdata de ICU: horario de verano desde el domingo ≥ 2 de septiembre 04:00 UTC hasta el domingo ≥ 2 de abril 03:00 UTC) | yes — ejecutado el 2026-09-15 con luxon 3.7.2 sobre Node 24: los 6 valores coinciden y `2026-09-06 00:00` formatea `01:00` (hora inexistente → `null`) |
| `DTSTART:20260916T193000Z` en `tests/integration/email.test.ts` | paso 8 | paso 8 | §4 `starts_at` UTC de la reserva `2026-09-16 16:30` local (-03:00) | `createEvent({ start: [2026, 9, 16, 19, 30], startInputType: "utc", startOutputType: "utc", end: [2026, 9, 16, 20, 0], title: "x" }).value` con ics 3.12.0 | yes — ejecutado el 2026-09-15 con ics 3.12.0: imprime `DTSTART:20260916T193000Z` |
| Cuerpo 201 `{"code":"VB-260916-1630","service_date":"2026-09-16","start":"16:30","end":"17:00","mode":"taller","fee":0}` | paso 5 | paso 5 | §5 (campos y orden), §4 (`code`) | `JSON.stringify` conserva el orden de inserción de claves (comportamiento de ECMAScript, no de versión) | yes |
| Cuerpos de salud `{"ok":true,"db":false}` / `{"ok":true,"db":true}` | pasos 1 y 2 | pasos 1 y 2 | §5 | `JSON.stringify({ ok, db })` | yes |
| `$15.000` de `formatClp` | paso 7 | paso 7 | §1 (recargo CLP 15000) | regex propia, sin ICU | yes |
| `public/robots.txt` | paso 13 | paso 13 | §5 (rutas no indexadas), §12 (dominio) | copia literal de `public/` a `dist/client/` | yes |

---

## 20. Compuerta de aceptación, riesgos y registro de decisiones

### 20.1 Compuerta global de aceptación

El proyecto está **terminado** cuando cada comando de abajo sale 0 en un checkout limpio de la Replit App (con la base del workspace creada), y no antes. Es la misma compuerta que `pnpm gate` y la que se corre antes de cada publicación.

```bash
pnpm install --frozen-lockfile                     # expect: exit 0, lockfile sin cambios
pnpm check                                         # expect: exit 0 (biome ci, astro check, tsc --noEmit)
pnpm test                                          # expect: exit 0, 0 failed, 0 skipped
pnpm db:migrate                                    # expect: exit 0 (sin migraciones pendientes)
pnpm db:check                                      # expect: exit 0, {"ok":true,...}
pnpm build                                         # expect: exit 0
pnpm test:build                                    # expect: exit 0, 0 failed (landing, isla, SEO, accesibilidad estática)
sh scripts/smoke.sh                                # expect: exit 0 — ejecuta dist/server/entry.mjs: salud con "db":true,
                                                   #         / y /api/disponibilidad 200, ruta desconocida 404, /admin 303
pnpm reminders:send | grep -q '"ok":true'          # expect: exit 0
pnpm gate                                          # expect: exit 0 — la misma cadena, en un solo comando
```

Todo lo de arriba afirma propiedades, no conteos. Ninguna línea acepta "cualquier código distinto de 0": los códigos esperados (`test "$(code /admin)" = 303`, etc.) están afirmados literalmente dentro de `scripts/smoke.sh`.

**Compuertas manuales, una vez antes del lanzamiento** (cada comando, uno por invocación):

- [ ] Cada paso de §9 tiene su tag: `test "$(git tag -l 'step-*' | wc -l | tr -d ' ')" = 14` sale 0. El repositorio lo crea §10 Bootstrap.
- [ ] Cada archivo de §10 *Archivos que deben commitearse* está en git, **un comando por ruta**: `git ls-files --error-unmatch .env.example`, `git ls-files --error-unmatch pnpm-lock.yaml`, `git ls-files --error-unmatch package.json`, `git ls-files --error-unmatch .replit`, `git ls-files --error-unmatch biome.json`, `git ls-files --error-unmatch drizzle/meta/_journal.json`, `git ls-files --error-unmatch .claude/settings.json`, `git ls-files --error-unmatch docs/design-preview.html`, `git ls-files --error-unmatch public/brand/vector-bikes-logo.png` — cada uno sale 0. Y ninguno está ignorado, afirmando el código: `git check-ignore -q .env.example; test $? -eq 1` (1 = no ignorado; 128 = error de uso, y entonces falla).
- [ ] El `.gitignore` llegó antes de trackear archivos ignorables: `test -z "$(git ls-files node_modules dist .astro .env)"` sale 0, y `git log --diff-filter=A --format=%s -- .gitignore` muestra `chore: bootstrap workspace` (o, si la Replit App ya tenía historial previo, `feat: step 1 base del proyecto y servidor de salud`).
- [ ] Cada fila de §19.6 *Reconciliación de artefactos byte a byte* dice `Ambos confirmados: yes`, (las filas de luxon e `ics` ya se ejecutaron en el runtime fijado el 2026-09-15).
- [ ] §10 Bootstrap se ejecutó una segunda vez sobre el árbol ya construido y **salió 0**; después, `pnpm test` sigue saliendo 0 y `package.json` conserva todas sus dependencias.
- [ ] Cada fila de §19.6 *Reconciliación de valores entre artefactos* dice `Comparado: yes`, y `pnpm check` se corrió desde la raíz **con `blueprints/vector-bikes/` presente**.
- [ ] §9.1 no aplica (greenfield).
- [ ] Ningún No-Objetivo de §1 está construido.
- [ ] **Lanzamiento — Replit:** Autoscale Deployment publicada; *Secrets* de producción cargados en la Autoscale **y** en la Scheduled Deployment (`DATABASE_URL` de producción, `PUBLIC_SITE_URL=https://vectorbikes.cl`, `PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `SESSION_SECRET`, `CANCEL_TOKEN_SECRET`, `EMAIL_TRANSPORT=resend`, `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO`, `SHOP_NOTIFY_EMAIL`, `PUBLIC_WHATSAPP_NUMBER` si existe); ninguno en el repo.
- [ ] **Lanzamiento — esquema:** tras la primera publicación, el panel *Database* de producción muestra las 8 tablas de §4.
- [ ] **Lanzamiento — admin:** `pnpm admin:set-password` ejecutado con el `DATABASE_URL` de producción; un POST a `https://vectorbikes.cl/admin/login` con las credenciales reales responde 303 a `/admin`, y `/admin` muestra la agenda de hoy sin error.
- [ ] **Lanzamiento — Scheduled Deployment:** creada con cron `0 10 * * *`, zona America/Santiago, run `corepack pnpm@12.4.2 reminders:send`; su primer log muestra `"ok":true`.
- [ ] **Lanzamiento — DNS (cPanel de Bluehosting):** registros A y TXT `replit-verify=…` de Replit creados (el TXT se deja permanente); `https://vectorbikes.cl/api/health` responde `{"ok":true,"db":true}` con certificado válido.
- [ ] **Lanzamiento — Resend:** dominio `send.vectorbikes.cl` verificado con los registros que muestra Resend; MX/SPF/autodiscover de Microsoft 365 intactos (un correo externo a info@vectorbikes.cl sigue llegando).
- [ ] **Lanzamiento — Turnstile:** widget real para `vectorbikes.cl`; claves de prueba reemplazadas y sitio republicado.
- [ ] **Lanzamiento — prueba real:** una reserva real de punta a punta llega como confirmación con `.ics` al cliente y como aviso a info@vectorbikes.cl (Microsoft 365), sin caer en spam; cancelarla con el enlace libera el bloque y envía el aviso.
- [ ] **Lanzamiento — QA manual:** flujo de reserva en móvil (iOS Safari) y escritorio, en modo claro y oscuro, comparado con `docs/design-preview.html`; recorrido solo con teclado; una pasada con VoiceOver; zoom 200 % a 320 px.
- [ ] **Lanzamiento — monitor:** monitor externo sobre `/api/health` creado con aviso a info@vectorbikes.cl.
- [ ] **Lanzamiento — reversión ensayada:** una publicación desde un tag anterior se hizo una vez a propósito y se volvió a la actual.
- [ ] **Mantenimiento — feriados 2027** cargados con la skill `add-holidays` antes de diciembre de 2026.
- [ ] **Legal:** texto de `/privacidad` revisado por quien asesore al dueño en Ley 21.719.

**No se ignoran advertencias.** Una advertencia tolerada se vuelve permanente y la siguiente real se esconde dentro.

### 20.2 Registro de riesgos

| Riesgo | Probabilidad | Impacto | Señal temprana | Mitigación |
|---|---|---|---|---|
| Reservas falsas que ocupan los 4 cupos | M | A | Días `full` con teléfonos o nombres extraños en `/admin` | Turnstile + 1 reserva futura por teléfono + 5 POST/IP/10 min + cancelación desde el panel (dueño) |
| Correos en spam o no enviados | M | A | Logs `email.failed`; clientes que llaman sin confirmación | Subdominio `send.vectorbikes.cl` verificado en Resend, reply-to info@, prueba real en §20.1; el panel admin muestra todas las reservas aunque falle el correo (dueño) |
| El retiro deja el taller solo en horario de recepción | M | M | Clientes que llegan al taller mientras el dueño está afuera | `retiro` consume 2 bloques (1 hora) y cuenta en el tope diario; bloqueos manuales si hace falta (dueño) |
| Arranque en frío de Autoscale | A | B | Primera consulta de disponibilidad lenta tras inactividad | Landing prerenderizada; aceptado para v1 (dueño) |
| Replit propaga el esquema de dev a producción al publicar (particularidad parcialmente verificada) | M | A | Tablas faltantes o distintas en producción tras publicar | Nunca migrar producción desde la app ni a mano; `db-migrate.ts` se niega en deployments; verificación en §20.1; cambios destructivos en publicaciones separadas (builder/dueño) |
| Nombre del módulo de Node 24 en `.replit` no verificado | M | M | Replit rechaza `nodejs-24` o arranca otra versión | Selector de módulo de Replit + validación de versión en el Bootstrap (builder) |
| Scheduled Deployment no disponible junto a la Autoscale en la misma App (no verificado) | B | M | Replit impide crear la segunda deployment | Segunda Replit App desde el mismo repositorio Git solo para recordatorios (dueño) |
| Feriados 2027 desconocidos | A | M | Advertencia en `/admin` desde el 2 de diciembre de 2026 | Advertencia visible + bloqueos manuales + skill `add-holidays` (dueño) |
| Datos personales (Ley 21.719) | B | A | Solicitud de acceso/supresión o reclamo | Consentimiento con `consent_at`, aviso de privacidad, campos mínimos, procedimiento de anonimización de §14, contacto info@ (dueño) |
| pnpm 12 cambia la aprobación de scripts de build (no verificado) | M | M | `pnpm install` aborta con `ERR_PNPM_IGNORED_BUILDS` | `allowBuilds` emitido + respaldo `pnpm approve-builds --all` en el Bootstrap (builder) |
| Evasión del límite por IP desde Google Cloud: `clientIp` confía en 34/8 y 35/8 (infraestructura de Google/Replit), así que quien ataque desde una IP de Google Cloud se salta como proxy y puede anteponer una IP falsa a `x-forwarded-for`, o cae en el último salto, que cambia en cada petición | B | M | Muchos 403 de Turnstile o reservas sospechosas sin que salten 429; `booking_requests` con muchos `ip_hash` distintos en pocos minutos | Aceptado: la defensa principal es Turnstile, más el tope de 4 reservas por día y 1 reserva futura por teléfono; el límite por IP es una capa secundaria. Si se abusa, confiar solo en los saltos exactos de Replit en vez de rangos completos (dueño) |

### 20.3 Registro de decisiones

| # | Decisión | Alternativa rechazada | Por qué | Se revierte si |
|---|---|---|---|---|
| 1 | Track TypeScript/Node con Astro 7 | Next.js 16 | Sitio de una página con una isla; cero JS en el resto | El producto crece a una app con cuentas y muchas vistas interactivas |
| 2 | Postgres de Replit + Drizzle | Supabase (Postgres + auth) | Un solo proveedor para un operador no técnico; transacciones y locks necesarios | Replit Postgres muestra límites de conexiones o disponibilidad |
| 3 | Sesión admin propia (scrypt + `admin_sessions`) — **tomada en GENERATE** | Better Auth | CLI 1.4.21 y librería 1.7.5 divergieron y 1.7 falla ante drift de esquema | Aparece un segundo admin o se necesita MFA/recuperación por correo |
| 4 | Sin `btree_gist`: índice único parcial en `booking_blocks` + lock de `booking_days` + advisory lock por teléfono — **tomada en GENERATE** | Restricción de exclusión con rangos | Replit no confirma soporte de extensiones; la grilla fija de 30 min permite clave única | Duraciones variables o varios mecánicos (capacidad > 1) |
| 5 | Tests con PGlite en proceso — **tomada en GENERATE** | Postgres en Docker | Replit no tiene Docker; tests sin servicios | CI externo con contenedores disponible |
| 6 | Sin suite E2E con navegador en las compuertas — **tomada en GENERATE** | Playwright en cada paso | Dependencias de navegador poco confiables en el Nix de Replit | El build se mueve a CI con navegadores |
| 7 | `package.json` y configs escritos por el blueprint, sin scaffolder — **tomada en GENERATE** | `pnpm create astro` | Evita prompts, versiones del scaffolder y configs que luego no se pueden sobrescribir | — (se mantiene) |
| 8 | `pnpm db:migrate` solo en dev; producción recibe el esquema al publicar — **tomada en GENERATE** | Migrar en el arranque de la app | Particularidad de Replit; migrar en arranque compite entre instancias | Replit deja de propagar el esquema al publicar |
| 9 | Carga de entorno con `node --env-file-if-exists=.env` por comando y `process.loadEnvFile` en `drizzle.config.ts` — **tomada en GENERATE** | dotenv / tsx | Nativo en Node 24; un mecanismo por herramienta | Se baja de Node 22.9 |
| 10 | Validación de entorno por accesores por funcionalidad | Validación global al arrancar | Ningún paso rompe la compuerta de uno anterior; el error nombra la variable | — |
| 11 | CSS del prototipo portado + Tailwind sin preflight | Reescribir el diseño en utilidades Tailwind | Fidelidad exacta al diseño aprobado | Se rediseña el sitio |
| 12 | Preact para la isla | React | ~4 KB y la misma API de hooks | Se necesita una librería solo-React |
| 13 | Replit Autoscale + Scheduled Deployment | Vercel/Netlify + Neon | Decisión del dueño (plan Core, código en la App) | Costos o cold starts inaceptables |
| 14 | Resend en subdominio `send.` | Enviar desde el apex con Microsoft 365 | No choca con el SPF de M365; reputación separada | Resend deja de entregar a buzones M365 |
| 15 | `--field-border` = `--steel` para bordes de controles | `--rule` del prototipo | `--rule` sobre blanco da ~1,4:1 y falla WCAG 1.4.11 | — |
| 16 | `security.checkOrigin: false` + chequeo propio contra `PUBLIC_SITE_URL` | Chequeo nativo de Astro | Detrás del proxy TLS de Replit compararía orígenes distintos | Astro confía en cabeceras reenviadas de forma documentada |
| 17 | `updated_at` con `$onUpdate` de Drizzle | Trigger en Postgres | Todas las escrituras pasan por Drizzle; un trigger duplicaría lógica en SQL | Aparecen escrituras fuera del ORM |
| 18 | Script de compuerta llamado `gate` | `ci` | `pnpm ci` es un comando propio de pnpm | — |
| 19 | pnpm 12.4.2 fijado en el `build` de `[deployment]` de `.replit` (`corepack pnpm@12.4.2 install --frozen-lockfile && corepack pnpm@12.4.2 build`); `package.json` sin `packageManager` — **tomada 2026-09-16, tras fallar la publicación** | `packageManager: "pnpm@12.4.2"` en `package.json` | Replit reescribe ese campo en cada publicación y su instalación con pnpm 10, al ver pnpm 12 declarado, intenta autoinstalarlo, entra en bucle y aborta; el comando de build sí lo respeta. `replit-config.test.ts` exige `pnpm@12.4.2` y `--frozen-lockfile` en ese build | Replit deja de reescribir `package.json` o instala con pnpm 12 |
| 20 | `pnpm-lock.yaml` regenerado desde cero con `corepack pnpm@12.4.2 install` como un solo documento YAML — **tomada 2026-09-16, tras fallar la publicación** | Conservar el lockfile de dos documentos (bloque `packageManagerDependencies` + dependencias) que pnpm 12 escribía mientras existía `packageManager` | Replit abortó con "The lockfile is broken: expected a single document in the stream, but found more". Sin `packageManager`, pnpm 12.4.2 escribe un solo documento. La regeneración subió solo dependencias transitivas (`@astrojs/compiler-rs` 0.4.0→0.4.1, `magic-string` 1.3.1→1.4.1, `browserslist` 4.28.9→4.29.0, entre otras); `pnpm install --frozen-lockfile` no lo modifica y `pnpm gate` pasa | Replit acepta lockfiles de varios documentos |
| 21 | `--config.minimumReleaseAge=0` solo en el install del `build` de `[deployment]` de `.replit` y en el build de la Scheduled Deployment (README, §12); la política de antigüedad mínima de pnpm 12 sigue activa en el workspace y en cualquier máquina — **tomada 2026-09-16, tras fallar la publicación** | Desactivarla en `pnpm-workspace.yaml` o ampliar `minimumReleaseAgeExclude` en cada publicación | Replit abortó con `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` (19 paquetes publicados hace menos de 24 horas). En la construcción, el lockfile congelado ya fija versiones e integridades revisadas en local, donde la política sí se aplica al resolver. `replit-config.test.ts` exige el flag en ese install y que aparezca una sola vez en `.replit` | Replit instala solo versiones con más de 24 horas o la política deja de bloquear lockfiles congelados |

### 20.4 Qué construir después

1. **Pago en línea de la señal o el retiro** — cuando los no-shows superen el 20 % dos meses seguidos.
2. **Reprogramación directa** — cuando haya más de 5 reprogramaciones por semana.
3. **Sincronización con Google Calendar** — cuando el dueño deje de abrir `/admin` y opere desde su calendario.
4. **Seguimiento del estado de la bici** — con más de 8 bicis/día o un segundo mecánico.
5. **Múltiples mecánicos** (capacidad > 1 por bloque) — al contratar un segundo mecánico; exige revisar la decisión 4.

---

*Fin del blueprint. El orden de construcción es §9. Detenerse cuando §20.1 esté en verde.*
