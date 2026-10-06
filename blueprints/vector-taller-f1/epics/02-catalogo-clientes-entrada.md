# Epic 02: Catálogo, clientes y entrada

> Después de esta épica existen el catálogo con precios por tipo de bici, clientes con RUT y detección de duplicados (servidor y pantallas), bicicletas, la búsqueda única, las reservas manuales, la orden de trabajo con número `OT-00001` y el inicio de la recepción en tablet, que puede hacer cualquier rol.

| | |
|---|---|
| **Epic id** | `02-catalogo-clientes-entrada` |
| **Tasks** | `E2-T1` … `E2-T8` (pasos F1-09 … F1-16) |
| **Depends on** | `01-fundaciones` |
| **Unlocks** | `03-recepcion-orden` |
| **Parallel with** | ninguna (comparte `schema-taller.ts`, `rules.ts`, páginas de clientes) |

You do not need any other file to complete this epic. Everything below is repeated here on purpose.

---

## Stack

Astro 7 SSR · TypeScript 6 · Preact · Postgres 16 · Drizzle ORM 0.45 · sesión propia sobre `users` con roles · Replit Autoscale. `pnpm` 12.4.2; Node 24 (`.nvmrc`); versiones en `pnpm-lock.yaml`.

| Task | Command |
|---|---|
| Formatear | `pnpm format` |
| Test (un archivo) | `pnpm test tests/integration/<archivo>.test.ts` |
| Migraciones (solo base dev) | `pnpm db:generate` · `pnpm db:migrate` · `pnpm db:check` |
| Tablet | `pnpm build && pnpm test:tablet e2e/<archivo>.spec.ts` |
| Compuerta | `pnpm gate` (check + test + build + test:build + test:tablet + smoke) |

**Gate:** `pnpm format && pnpm gate` antes de marcar una tarea. Servicio: Postgres local `127.0.0.1:5432` (bases `vector_bikes` y `vector_bikes_e2e`, con el rol que fija `.env`). Reversión (la confirma el operador en la sesión supervisada; el allowlist no la impide técnicamente, porque `node -e:*` permite JS arbitrario): `git reset --hard f1-<anterior>` y, si hace falta, el reinicio de la base dev de `blueprint.md` §9 regla 6.

## Directory subtree

```
src/server/db/schema-taller.ts        # edit: services, service_prices, customers, bikes
src/server/db/schema-orders.ts        # NEW (E2-T7): work_orders, work_order_status_history
src/server/taller/rules.ts            # NEW (E2-T1), edit (E2-T7)
src/server/taller/catalog.ts · customers.ts · bikes.ts · search.ts · manual-booking.ts · orders.ts  # NEW
src/lib/rut.ts                        # NEW
src/server/booking/create-booking.ts  # edit mínima (E2-T6): source opcional
src/pages/taller/catalogo/index.astro · [id].astro
src/pages/taller/clientes/index.astro · nuevo.astro · [id].astro
src/pages/taller/bicicletas/[id].astro · buscar.astro · reservas/index.astro · reservas/nueva.astro · recepcion/nueva.astro
src/pages/taller/ordenes/[id]/recepcion.astro   # NEW (E2-T8)
tests/integration/{catalog,customers,bikes,search,manual-booking,work-orders}.test.ts
e2e/clientes.spec.ts · e2e/recepcion-inicio.spec.ts
src/server/auth/** · audit.ts · TallerLayout.astro · e2e/fixtures.ts · e2e/global-setup.ts   # read-only
```

## Data model touched here

**B** = `branch_id uuid not null → branches.id` restrict. Timestamps con `createdAt()`/`updatedAt()`. Cada tabla se agrega a `tallerTables` u `orderTables`.

| Entity | Campos | Notas |
|---|---|---|
| `services` (E2-T1) | B, `name text not null`, `description text not null default ''`, `estimated_minutes integer not null`, `usual_materials`, `aftercare` (text null), `is_active boolean not null default true` | `uq_services_branch_name (branch_id, name)`; CHECK `estimated_minutes > 0` |
| `service_prices` (E2-T1) | B, `service_id → services`, `bike_type text not null`, `price_clp integer not null` | `uq_service_prices_service_bike_type`; CHECK `bike_type in ('mtb', 'ruta', 'gravel', 'urbana', 'ebike')`, `price_clp >= 0` |
| `customers` (E2-T2) | B, `name text not null`, `rut text`, `phone_e164 text not null`, `email`, `discovery_channel`, `notes` | `uq_customers_rut` único global `.where(sql\`rut is not null\`)`; índices `(branch_id, phone_e164)`, `(branch_id, name)`; CHECK `discovery_channel is null or discovery_channel in ('instagram', 'google', 'recomendacion', 'sitio_web', 'paso_por_el_taller', 'otro')` |
| `bikes` (E2-T4) | B, `customer_id → customers`, `brand`, `model` (not null), `year integer`, `bike_type text not null`, `size`, `color`, `serial_number`, `km_noted integer`, `notes` | índices `(customer_id)`, `(branch_id, serial_number)`; CHECK tipo, `year is null or (year >= 1980 and year <= 2100)`, `km_noted is null or km_noted >= 0` |
| `work_orders` (E2-T7, `schema-orders.ts`) | B, `number`, `customer_id`, `bike_id`, `booking_id uuid null → bookings`, `status text not null default 'reservada'`, `requested_service not null`, `diagnosis`, `observations`, `notes`, `assigned_mechanic_id → users`, `estimated_delivery_date date`, `delivery_date_confirmed_at`, `estimated_minutes`/`total_clp`/`paid_clp integer not null default 0`, `qc_approved_at`, `qc_approved_by → users`, `qc_self_checked boolean not null default false`, `warranty_of_order_id → work_orders` (`(): AnyPgColumn =>`), `tax_doc_type`, `tax_doc_number`, `tax_doc_date date`, `received_at`, `delivered_at`, `voided_at`, `voided_by`, `created_by not null` | `uq_work_orders_branch_number (branch_id, number)`, `uq_work_orders_booking`; índices `(branch_id, status)`, `(assigned_mechanic_id, status)`, `(bike_id)`, `(customer_id)`, `(branch_id, estimated_delivery_date)`; CHECK de los 11 estados, `number >= 1`, `total_clp >= 0 and paid_clp >= 0 and estimated_minutes >= 0`, **`status <> 'entregada' or paid_clp = total_clp`**, **`status not in ('lista_para_retirar', 'entregada') or qc_approved_at is not null`**, `tax_doc_type is null or tax_doc_type in ('boleta', 'factura')` |
| `work_order_status_history` (E2-T7) | B, `work_order_id`, `from_status`, `to_status not null`, `actor_user_id` (nulo = cliente), `note` | índice `(work_order_id, created_at)` |

`bookings`: solo se lee; nunca se borra ni cambia de estado al recibirla.

## Contracts

**Consumed:** `SessionUser`, `requireAdmin`, `loginRedirect`, `SESSION_COOKIE` · `can`, `forbiddenResponse`, `ROLE_LABELS` · `recordAudit` · `TallerLayout` · `normalizePhone`, `isAllowedOrigin` · `createBooking`, `readRange`, `computeDay`, `calendarClosure`, `localToday`, `addDays` · `notifyBookingCreated` · `formatClp` · `isUniqueViolation`.

**Produced:**

| Export | Signature | Used by |
|---|---|---|
| `rules.ts` constantes | ver E2-T1 | 03–05 |
| `catalog.ts` → `priceFor` | `(db, actor, serviceId, bikeType) => Promise<number \| null>` (filtra por `actor.branchId`; servicio de otra sucursal → `null`) | 03 |
| `rut.ts` → `normalizeRut`, `formatRut` | `(raw: string) => string \| null`; `(normalized) => string` | 03 |
| `customers.ts` → `createCustomer`, `insertCustomer`, `findCustomerByPhone`, `customerFormSchema` | `createCustomer(db, actor, input, now, opts?)` (exige `customers.manage`); `insertCustomer(db, branchId, input, now, opts?)` (sin permiso; lo usa `startReception`) → `{ ok: true, customer } \| { ok: false, code: "duplicate", existing }` | E2-T7, 05 |
| `bikes.ts` → `createBike`, `insertBike`, `listBikesOfCustomer`, `bikeFormSchema` | igual patrón que clientes | E2-T7, 05 |
| `search.ts` → `searchTaller` | `(db, actor, q) => Promise<{ customers: CustomerHit[]; orders: OrderHit[] }>` | E2-T8, 03 |
| `orders.ts` → `formatOrderNumber`, `allocateOrderNumber`, `recordStatusChange`, `prefillFromBooking`, `startReceptionSchema`, `startReception`, `getOrderHeader` | `recordStatusChange(db, { branchId, orderId, from, to, actorUserId, note? }, now)`; `startReception(db, actor, input, now)` → `{ ok: true, orderId, number } \| { ok: false, code }` | 03–05 |

## Conventions that bite in this area

- Toda función recibe `actor: SessionUser`, filtra por `actor.branchId` y revisa el permiso al comienzo.
- **La recepción la hace cualquier rol (decisión 5):** `startReception` exige solo `reception.perform`; crea cliente y bici con `insertCustomer`/`insertBike` (sin `customers.manage`); si el actor es mecánico, la orden nace asignada a él.
- zod exportado por el módulo; la página parsea con ese esquema.
- Páginas: `requireAdmin` → `can` → POST con `isAllowedOrigin` → 303 `?hecho=` o 4xx. Objetivos ≥ 48px; `fieldset`/`legend` en grupos de opciones.
- Esquema solo aditivo; nunca `--custom`.

Full project rules: `CLAUDE.md`. Area rules: `.claude/rules/database.md`, `server-api.md`, `taller-ui.md`, `taller-domain.md`, `booking-engine.md`, `e2e.md`.

---

## Tasks

### `E2-T1` — F1-09 Add service catalog with prices per bike type

**Depends on:** `E1-T7` · **Priority:** p0

Seis archivos: el sexto es una página delgada (`catalogo/[id].astro`), dentro de la regla de `blueprint.md` §9.

1. `src/server/taller/rules.ts` (nuevo) con **todas** las constantes del taller: `BIKE_TYPES` (`mtb`, `ruta`, `gravel`, `urbana`, `ebike`) y `BIKE_TYPE_LABELS` (MTB, Ruta, Gravel, Urbana, E-bike); `DISCOVERY_CHANNELS` con etiquetas; `ORDER_STATUSES` (los 11) y `STATUS_LABELS` (Reservada, Recibida, Diagnóstico, Esperando aprobación, Esperando repuesto, En reparación, Control de calidad, Lista para retirar, Entregada, Cancelada, Trabajo rechazado); `TERMINAL_STATUSES` (`entregada`, `cancelada`, `trabajo_rechazado`); `LOAD_EXCLUDED_STATUSES` (`lista_para_retirar` + terminales); `ORDER_TRANSITIONS` (reservada → recibida, cancelada · recibida → diagnostico, cancelada · diagnostico → esperando_aprobacion, esperando_repuesto, en_reparacion, trabajo_rechazado, cancelada · esperando_aprobacion → en_reparacion, trabajo_rechazado, cancelada · esperando_repuesto → en_reparacion, esperando_aprobacion, cancelada · en_reparacion → esperando_repuesto, esperando_aprobacion, control_calidad, cancelada · control_calidad → en_reparacion, lista_para_retirar · lista_para_retirar → entregada · terminales vacíos); `MANUAL_TRANSITIONS` = las mismas **sin** reservada→recibida, *→esperando_aprobacion, esperando_aprobacion→en_reparacion, control_calidad→lista_para_retirar, lista_para_retirar→entregada; `INTAKE_CHECK_KEYS` con etiquetas Frenos, Cadena, Transmisión, Ruedas, Neumáticos, Estado general, Problemas visibles; `INTAKE_RESULTS` (`ok` OK, `revisar` Revisar, `malo` Malo); `QC_CHECK_KEYS` (Frenos, Cambios, Ruedas, Apriete de componentes, Neumáticos y presión, Prueba de rodaje, Limpieza); `QC_RESULTS` (`ok` OK, `falla` Falla); `PHOTO_STAGES` (`recepcion` Recepción, `reparacion` Reparación, `terminado` Trabajo terminado); `PAYMENT_KINDS` (Abono, Pago final); `PAYMENT_METHODS` (Transferencia, Tarjeta, Efectivo, Otro); `TAX_DOC_TYPES`; `WORKSHOP_MINUTES_PER_DAY = 360`; `LABEL_WIDTH_MM = 62`; `QC_REQUIRE_SECOND_PERSON = false`.
2. `schema-taller.ts`: `services`, `servicePrices`; `tallerTables` += ambas; generate → migrate.
3. `src/server/taller/catalog.ts`: `serviceFormSchema` (nombre 2–80, descripción ≤ 1000, minutos 5–1440, materiales y recomendaciones ≤ 1000), `priceFormSchema`; `listCatalog`, `getService`, `createService`, `updateService` (`catalog.edit`; audit `catalog.service_created`/`catalog.service_updated`), `setServicePrice(db, actor, { serviceId, bikeType, priceClp }, now)` (`catalog.edit`; upsert con `onConflictDoUpdate`; audit `catalog.price_changed` con `{ serviceId, bikeType, before: number | null, after }` en la misma transacción), `priceFor`.
4. `catalogo/index.astro` (tabla servicio × 5 precios; "Nuevo servicio" con `catalog.edit`) y `catalogo/[id].astro` (edición; sin `catalog.edit`, solo lectura; un POST sin permiso → `forbiddenResponse()`).
5. `tests/integration/catalog.test.ts`: los cuatro criterios.

**Files**
- `src/server/db/schema-taller.ts` — edit
- `src/server/taller/rules.ts` — new
- `src/server/taller/catalog.ts` — new
- `src/pages/taller/catalogo/index.astro` — new
- `src/pages/taller/catalogo/[id].astro` — new
- `tests/integration/catalog.test.ts` — new

**Acceptance**

1. **WHEN** el dueño o un administrador crea un servicio con nombre, descripción, duración estimada, materiales habituales y recomendaciones **THE SYSTEM SHALL** guardarlo en `services` con el `branch_id` de su sucursal
2. **WHEN** se fija el precio de un servicio para un tipo `mtb`, `ruta`, `gravel`, `urbana` o `ebike` **THE SYSTEM SHALL** mantener una sola fila por (`service_id`, `bike_type`) en `service_prices`
3. **WHEN** un mecánico llama `setServicePrice` **THE SYSTEM SHALL** devolver `{ ok: false, code: "forbidden" }` y dejar `service_prices` sin cambios
4. **WHEN** el dueño cambia un precio **THE SYSTEM SHALL** escribir en `audit_log` una fila `catalog.price_changed` con su `actor_user_id`, `created_at` y `details` con `before` y `after`

**Verify**

```bash
pnpm test tests/integration/catalog.test.ts   # expect: exit 0, 0 failed
pnpm db:migrate   # expect: exit 0
pnpm db:check   # expect: exit 0
pnpm format && pnpm gate   # expect: exit 0
```

**Checkpoint**

```bash
git add -A && git commit -m "feat: f1-09 add service catalog with prices per bike type" && git tag f1-09
git tag -l f1-09 | grep -qx f1-09   # expect: exit 0
```

### `E2-T2` — F1-10 Add customers schema, RUT validation and server

**Depends on:** `E2-T1` · **Priority:** p0

1. `src/lib/rut.ts`: `normalizeRut(raw)` quita puntos, espacios y guion; último carácter = DV (mayúscula), cuerpo de 7 u 8 dígitos; módulo 11 (dígitos de derecha a izquierda × 2, 3, 4, 5, 6, 7, 2, 3…; `11 - suma % 11`; 11 → `0`, 10 → `K`) → `"<cuerpo>-<DV>"` o `null`. `formatRut` agrega puntos. Control: 12345678→5, 10000013→K, 12345675→0.
2. `schema-taller.ts`: `customers`; `tallerTables` += `customers`; generate → migrate.
3. `src/server/taller/customers.ts`: `customerFormSchema` (nombre 2–120; teléfono que `normalizePhone` acepta; RUT opcional que `normalizeRut` acepta; correo opcional; canal opcional; notas ≤ 2000); `findDuplicates(db, branchId, { phoneE164, rut })`; `insertCustomer(db, branchId, input, now, { allowPhoneDuplicate })` (sin chequeo de permiso; RUT repetido → siempre `duplicate`; teléfono repetido → `duplicate` salvo `allowPhoneDuplicate`; violación de `uq_customers_rut` → `duplicate`); `createCustomer(db, actor, …)` = `customers.manage` + `insertCustomer`; `updateCustomer`, `getCustomer`, `listCustomers(db, actor, limit = 50)`, `findCustomerByPhone`.
4. `tests/integration/customers.test.ts`: tabla de RUT y criterios 3–5.

**Files**
- `src/server/db/schema-taller.ts` — edit
- `src/lib/rut.ts` — new
- `src/server/taller/customers.ts` — new
- `tests/integration/customers.test.ts` — new

**Acceptance**

1. **WHEN** `normalizeRut` recibe `12.345.678-5`, `123456785`, `10.000.013-k` o `12.345.675-0` **THE SYSTEM SHALL** devolver `12345678-5`, `12345678-5`, `10000013-K` y `12345675-0`
2. **WHEN** `normalizeRut` recibe `12.345.678-4`, `12345678`, `abc` o una cadena vacía **THE SYSTEM SHALL** devolver `null`
3. **WHEN** se crea un cliente con un teléfono o un RUT que ya existe en la sucursal **THE SYSTEM SHALL** devolver `{ ok: false, code: "duplicate", existing }` con el `id` y el nombre de la ficha existente, sin insertar
4. **WHEN** se reintenta con el mismo teléfono y `allowPhoneDuplicate: true` **THE SYSTEM SHALL** crear la ficha, y con un RUT repetido seguir devolviendo `duplicate`
5. **WHEN** se crea un cliente con RUT con puntos y teléfono `9 1234 5678` **THE SYSTEM SHALL** guardar el RUT normalizado y el teléfono `+56912345678`

**Verify**

```bash
pnpm test tests/integration/customers.test.ts   # expect: exit 0, 0 failed
pnpm db:migrate   # expect: exit 0
pnpm db:check   # expect: exit 0
pnpm format && pnpm gate   # expect: exit 0
```

**Checkpoint**

```bash
git add -A && git commit -m "feat: f1-10 add customers with rut validation and duplicate detection" && git tag f1-10
git tag -l f1-10 | grep -qx f1-10   # expect: exit 0
```

### `E2-T3` — F1-11 Add customer screens

**Depends on:** `E2-T2` · **Priority:** p0

1. `clientes/index.astro`: recientes (`listCustomers`), botón "Nuevo cliente" y campo de búsqueda que envía a `/taller/buscar`. Solo `customers.manage` (si no, `forbiddenResponse()`).
2. `clientes/nuevo.astro`: campos "Nombre", "Teléfono", "Correo", "RUT", `fieldset` "Canal", "Notas"; botón "Crear cliente" → `createCustomer` → 303 `/taller/clientes/<id>`. Ante `duplicate`: `role="alert"` con `Ya existe: <nombre>`, enlace "Usar ficha existente" a `/taller/clientes/<id>` y, solo si es por teléfono, botón "Crear de todas formas" (`allow_phone_duplicate=1` oculto).
3. `clientes/[id].astro`: detalle con `h1` = nombre y formulario de edición (`updateCustomer`).
4. `e2e/clientes.spec.ts`: `login(page, "owner")` → `/taller/clientes/nuevo` → "Nombre" `Laura Prueba`, "Teléfono" `9 5555 6666` → tap "Crear cliente" → heading `Laura Prueba`; volver a `/taller/clientes/nuevo` con otro nombre y el mismo teléfono → `Ya existe: Laura Prueba` y enlace `Usar ficha existente`; con otra página, `login(page, "mechanic")` y `(await page.goto("/taller/clientes"))?.status()` = 403.

**Files**
- `src/pages/taller/clientes/index.astro` — new
- `src/pages/taller/clientes/nuevo.astro` — new
- `src/pages/taller/clientes/[id].astro` — new
- `e2e/clientes.spec.ts` — new

**Acceptance**

1. **WHEN** el dueño completa `Nuevo cliente` con nombre `Laura Prueba` y teléfono `9 5555 6666` en el viewport de tablet **THE SYSTEM SHALL** mostrar la ficha con el nombre `Laura Prueba`
2. **WHEN** intenta crear otro cliente con el mismo teléfono **THE SYSTEM SHALL** mostrar `Ya existe: Laura Prueba` con el enlace `Usar ficha existente`
3. **WHEN** el mecánico pide `/taller/clientes` **THE SYSTEM SHALL** responder 403

**Verify**

```bash
pnpm build && pnpm test:tablet e2e/clientes.spec.ts   # expect: exit 0, 0 failed
pnpm format && pnpm gate   # expect: exit 0
```

**Checkpoint**

```bash
git add -A && git commit -m "feat: f1-11 add customer screens" && git tag f1-11
git tag -l f1-11 | grep -qx f1-11   # expect: exit 0
```

### `E2-T4` — F1-12 Add bikes under customers

**Depends on:** `E2-T3` · **Priority:** p0

1. `schema-taller.ts`: `bikes`; `tallerTables` += `bikes`; generate → migrate.
2. `src/server/taller/bikes.ts`: `bikeFormSchema` (marca 1–60, modelo 1–80, año opcional 1980–2100, tipo `z.enum(BIKE_TYPES)`, talla ≤ 20, color ≤ 40, serie ≤ 80, km entero ≥ 0 opcional, notas ≤ 1000); `insertBike(db, branchId, customerId, input, now)` (sin permiso; lo usa `startReception`), `createBike(db, actor, customerId, input, now)` (`customers.manage` + `insertBike`; el cliente debe ser de la sucursal), `updateBike`, `getBike`, `listBikesOfCustomer`.
3. `clientes/[id].astro`: sección "Bicicletas" (lista con enlace a `/taller/bicicletas/<id>` + "Agregar bicicleta" con `fieldset` "Tipo de bicicleta"). `bicicletas/[id].astro`: detalle y edición. Solo `customers.manage`.
4. `tests/integration/bikes.test.ts`: los cuatro criterios.

**Files**
- `src/server/db/schema-taller.ts` — edit
- `src/server/taller/bikes.ts` — new
- `src/pages/taller/clientes/[id].astro` — edit
- `src/pages/taller/bicicletas/[id].astro` — new
- `tests/integration/bikes.test.ts` — new

**Acceptance**

1. **WHEN** se crea una bicicleta para un cliente con marca, modelo, tipo y datos opcionales (año, talla, color, número de serie, kilometraje anotado) **THE SYSTEM SHALL** guardarla con el `customer_id` y el `branch_id` del cliente
2. **WHEN** el tipo no es `mtb`, `ruta`, `gravel`, `urbana` ni `ebike` **THE SYSTEM SHALL** rechazarlo como error de validación sin insertar
3. **WHEN** `listBikesOfCustomer` corre para un cliente con dos bicicletas **THE SYSTEM SHALL** devolver ambas
4. **WHEN** se guarda un kilometraje anotado negativo **THE SYSTEM SHALL** rechazarlo sin cambiar la fila

**Verify**

```bash
pnpm test tests/integration/bikes.test.ts   # expect: exit 0, 0 failed
pnpm db:migrate   # expect: exit 0
pnpm db:check   # expect: exit 0
pnpm format && pnpm gate   # expect: exit 0
```

**Checkpoint**

```bash
git add -A && git commit -m "feat: f1-12 add bikes under customers" && git tag f1-12
git tag -l f1-12 | grep -qx f1-12   # expect: exit 0
```

### `E2-T5` — F1-13 Add unified search by name, phone or RUT

**Depends on:** `E2-T4` · **Priority:** p1

1. `src/server/taller/search.ts`: `searchTaller(db, actor, q)` con `q` recortado de 1–80; orden de clasificación: RUT (`normalizeRut`) → `rut`; teléfono (`normalizePhone`) → `phone_e164`; si no, nombre con `ilike` y `%`, `_`, `\` escapados con `\`. Clientes solo si `can(actor.role, "customers.manage") || can(actor.role, "reception.perform")` (el mecánico los necesita para recibir), filtrados por `actor.branchId`, máximo 20. Devuelve `{ customers, orders: [] }`; `orders` lo llena F1-23 (dejar `// F1-23: búsqueda por número de orden`).
2. `src/pages/taller/buscar.astro`: un campo GET con etiqueta "Nombre, teléfono, RUT o número de orden"; resultados enlazados; vacío "Sin resultados.".
3. `tests/integration/search.test.ts`: los cinco criterios.

**Files**
- `src/server/taller/search.ts` — new
- `src/pages/taller/buscar.astro` — new
- `tests/integration/search.test.ts` — new

**Acceptance**

1. **WHEN** `searchTaller` recibe parte de un nombre en minúsculas **THE SYSTEM SHALL** devolver los clientes de la sucursal cuyo nombre la contiene sin distinguir mayúsculas
2. **WHEN** recibe un teléfono como `9 1111 2222` o `+56911112222` **THE SYSTEM SHALL** devolver el cliente con `phone_e164` `+56911112222`
3. **WHEN** recibe un RUT con o sin puntos **THE SYSTEM SHALL** devolver el cliente con ese RUT normalizado
4. **WHEN** recibe `%` o `_` **THE SYSTEM SHALL** tratarlos como texto literal y no como comodín
5. **WHEN** el actor pertenece a otra sucursal **THE SYSTEM SHALL** devolver una lista vacía de clientes

**Verify**

```bash
pnpm test tests/integration/search.test.ts   # expect: exit 0, 0 failed
pnpm format && pnpm gate   # expect: exit 0
```

**Checkpoint**

```bash
git add -A && git commit -m "feat: f1-13 add unified search by name, phone or rut" && git tag f1-13
git tag -l f1-13 | grep -qx f1-13   # expect: exit 0
```

### `E2-T6` — F1-14 Add manual bookings for staff

**Depends on:** `E1-T6` · **Priority:** p1

1. `src/server/booking/create-booking.ts` — único cambio: `export type BookingSource = "web" | "telefono" | "whatsapp" | "presencial";`, `source?: BookingSource` en el input y `source: input.source ?? "web"` en el insert. Locks y reglas idénticos (lee `booking-engine.md`).
2. `src/server/taller/manual-booking.ts`: `manualBookingSchema` (estricto: `mode`, `service_date`, `start`, `nombre`, `telefono`, `correo` **obligatorio**, `bicicleta`, `descripcion`, `comuna`/`direccion` para retiro, `source` en `telefono|whatsapp|presencial`, `consentimiento` literal `true` = "El cliente aceptó el aviso de privacidad"); `createManualBooking(db, actor, input, now, deps = {})`: `bookings.manage` o `forbidden`; `createBooking(db, { …, ipHash: null, whatsappConsent: false, source }, now)`; si `ok`, **después del commit** `(deps.notify ?? notifyBookingCreated)(booking, cancelToken)` en `try` (falla → `log.error("email.failed", …)`). Sin Turnstile ni rate limit. `listUpcomingBookings(db, today, days = 14)`; `freeBlocks(db, date, mode, now)` con `readRange` + `computeDay`.
3. `reservas/index.astro` (día, hora, nombre, teléfono, bicicleta, origen Sitio/Teléfono/WhatsApp/Presencial, botón-enlace "Recibir" a `/taller/recepcion/nueva?reserva=<id>`) y `reservas/nueva.astro` (fecha y modalidad → bloques libres → datos → "Crear reserva" → 303 `/taller/reservas?hecho=creada`). Solo `bookings.manage`.
4. `tests/integration/manual-booking.test.ts` (estilo `concurrency.test.ts`): criterios 1–6; el 5 con el `notify` por defecto y `consoleOutbox`.

**Files**
- `src/server/booking/create-booking.ts` — edit mínima
- `src/server/taller/manual-booking.ts` — new
- `src/pages/taller/reservas/index.astro` — new
- `src/pages/taller/reservas/nueva.astro` — new
- `tests/integration/manual-booking.test.ts` — new

**Acceptance**

1. **WHEN** el personal crea una reserva manual con `source` `telefono` **THE SYSTEM SHALL** guardarla con `source = 'telefono'` mediante `createBooking`, y una reserva del sitio SHALL seguir guardándose con `source = 'web'`
2. **WHEN** se piden cinco reservas manuales para el mismo día en bloques distintos **THE SYSTEM SHALL** aceptar cuatro y rechazar la quinta con `slot_unavailable`
3. **WHEN** 20 reservas manuales concurrentes piden el mismo bloque **THE SYSTEM SHALL** aceptar exactamente una
4. **WHEN** el teléfono ya tiene una reserva futura **THE SYSTEM SHALL** rechazar la manual con `phone_limit`
5. **WHEN** la reserva manual se confirma **THE SYSTEM SHALL** enviar después del commit el correo `Reserva confirmada` al cliente, igual que una reserva del sitio
6. **WHEN** un mecánico llama `createManualBooking` **THE SYSTEM SHALL** devolver `{ ok: false, code: "forbidden" }`

**Verify**

```bash
pnpm test tests/integration/manual-booking.test.ts tests/integration/create-booking.test.ts tests/integration/concurrency.test.ts tests/integration/api.test.ts   # expect: exit 0, 0 failed
pnpm format && pnpm gate   # expect: exit 0
```

**Checkpoint**

```bash
git add -A && git commit -m "feat: f1-14 add manual bookings for staff" && git tag f1-14
git tag -l f1-14 | grep -qx f1-14   # expect: exit 0
```

### `E2-T7` — F1-15 Add work orders schema, statuses and numbering

**Depends on:** `E2-T5` · **Priority:** p0

1. `src/server/db/schema-orders.ts` (nuevo; importa de `./schema.ts` y `./schema-taller.ts`; nunca al revés): `workOrders`, `workOrderStatusHistory`; `export const orderTables = [workOrders, workOrderStatusHistory] as const`; tipo `WorkOrder`. Generate → migrate.
2. `rules.ts`: `isAllowedTransition(from, to)` e `isManualTransition(from, to)`.
3. `src/server/taller/orders.ts`: `formatOrderNumber(n)` = `OT-` + `String(n).padStart(5, "0")`; `allocateOrderNumber(db, branchId)` = `update branches set next_order_number = next_order_number + 1 where id = $1 returning next_order_number - 1`; `recordStatusChange` (valida `isAllowedTransition` si `from` no es nulo; inserta historial); `prefillFromBooking(db, actor, bookingId)` → `{ booking, existingCustomer: { id, name, bikes } | null, prefill: { name, phoneE164, email, brand, model, requestedService } }` (marca = primera palabra de `bookings.bike`, modelo = el resto); `startReceptionSchema`; `startReception(db, actor, input, now)`: `reception.perform`; una transacción: reserva válida y sin orden (si no `booking_taken`), cliente existente o `insertCustomer` (duplicado → `duplicate` con `existing`), bici existente o `insertBike`, número, orden en `reservada` con `createdBy: actor.id` y `assignedMechanicId: actor.role === "mechanic" ? actor.id : null`, `recordStatusChange(null → reservada)`, `recordAudit("order.created", { number })`. `getOrderHeader(db, actor, id)`.
4. `tests/integration/work-orders.test.ts`: `Promise.all` de 10 `startReception`; formato; prefill con y sin ficha; historial, auditoría y asignación cuando el actor es mecánico; los dos UPDATE crudos esperando `code === "23514"`.

**Files**
- `src/server/db/schema-orders.ts` — new
- `src/server/taller/rules.ts` — edit
- `src/server/taller/orders.ts` — new
- `tests/integration/work-orders.test.ts` — new

**Acceptance**

1. **WHEN** `startReception` crea 10 órdenes concurrentes en la misma sucursal **THE SYSTEM SHALL** asignar los números 1 a 10 sin repetir y dejar `branches.next_order_number` en 11
2. **WHEN** `formatOrderNumber` recibe 1 y 12345 **THE SYSTEM SHALL** devolver `OT-00001` y `OT-12345`
3. **WHEN** `prefillFromBooking` lee una reserva cuyo teléfono ya tiene ficha **THE SYSTEM SHALL** devolver esa ficha en `existingCustomer`, y si no la tiene SHALL devolver nombre, teléfono y correo de la reserva en `prefill`
4. **WHEN** se crea una orden **THE SYSTEM SHALL** dejarla en `reservada` con una fila de historial (`from_status` nulo → `reservada`, con autor) y una fila `order.created` en `audit_log`, asignada al actor si es mecánico
5. **WHEN** un UPDATE directo en SQL pone `entregada` con `paid_clp` distinto de `total_clp` **THE SYSTEM SHALL** rechazarlo con código `23514`
6. **WHEN** un UPDATE directo en SQL pone `lista_para_retirar` con `qc_approved_at` nulo **THE SYSTEM SHALL** rechazarlo con código `23514`

**Verify**

```bash
pnpm test tests/integration/work-orders.test.ts   # expect: exit 0, 0 failed
pnpm db:migrate   # expect: exit 0
pnpm db:check   # expect: exit 0
pnpm format && pnpm gate   # expect: exit 0
```

**Checkpoint**

```bash
git add -A && git commit -m "feat: f1-15 add work orders schema, statuses and numbering" && git tag f1-15
git tag -l f1-15 | grep -qx f1-15   # expect: exit 0
```

### `E2-T8` — F1-16 Start reception on tablet from booking or walk-in

**Depends on:** `E2-T6`, `E2-T7` · **Priority:** p0

1. `manual-booking.ts`: `listUpcomingBookings` hace left join con `work_orders.booking_id` y devuelve `orderId` y `orderNumber`.
2. `reservas/index.astro`: con orden, muestra `formatOrderNumber(orderNumber)` enlazado a `/taller/ordenes/<orderId>/recepcion` en vez de "Recibir".
3. `src/pages/taller/recepcion/nueva.astro` (`reception.perform`: los cuatro roles): `?reserva=<id>` (resumen + `prefillFromBooking`: con ficha, cliente preseleccionado y sus bicis; sin ficha, "Nombre", "Teléfono", "Correo", "RUT" ya escritos), `?q=` (resultados de `searchTaller` → `?cliente=<id>`), `?cliente=<id>` (bicis como opciones + "Bicicleta nueva"). Bici nueva: "Marca", "Modelo" y `fieldset` "Tipo de bicicleta" (MTB, Ruta, Gravel, Urbana, E-bike). "Servicio solicitado". "Crear orden" → `startReception` → 303 `/taller/ordenes/<id>/recepcion`; duplicado → aviso con "Usar ficha existente".
4. `src/pages/taller/ordenes/[id]/recepcion.astro` (`reception.perform` + acceso a la orden): cabecera con número, `span.status`, cliente, bici y servicio solicitado. F1-17 a F1-21 agregan secciones.
5. `e2e/recepcion-inicio.spec.ts`: `login(page, "owner")`; `/taller/reservas`; tap "Recibir" en la fila de "Carla Reserva"; `getByLabel("Nombre")` = `Carla Reserva` y teléfono/correo no vacíos; tap "MTB" y "Crear orden"; URL `/taller/ordenes/<uuid>/recepcion` con `/OT-\d{5}/` y `Carla Reserva`; `/taller/reservas` muestra ese número en la fila; con otra página, `login(page, "mechanic")` y `(await page.goto("/taller/reservas"))?.status()` = 403.

**Files**
- `src/pages/taller/recepcion/nueva.astro` — new
- `src/pages/taller/ordenes/[id]/recepcion.astro` — new
- `src/server/taller/manual-booking.ts` — edit
- `src/pages/taller/reservas/index.astro` — edit
- `e2e/recepcion-inicio.spec.ts` — new

**Acceptance**

1. **WHEN** el dueño toca `Recibir` en la reserva sembrada de `Carla Reserva` **THE SYSTEM SHALL** mostrar el formulario con nombre, teléfono y correo de la reserva ya escritos
2. **WHEN** toca el tipo `MTB` y `Crear orden` **THE SYSTEM SHALL** crear la orden en `reservada` y mostrar en `/taller/ordenes/<id>/recepcion` un número `OT-` de cinco dígitos y el nombre `Carla Reserva`
3. **WHEN** la reserva ya tiene una orden **THE SYSTEM SHALL** mostrar en `/taller/reservas` el número de esa orden en lugar de `Recibir`
4. **WHEN** el mecánico pide `/taller/reservas` **THE SYSTEM SHALL** responder 403

**Verify**

```bash
pnpm build && pnpm test:tablet e2e/recepcion-inicio.spec.ts   # expect: exit 0, 0 failed
pnpm format && pnpm gate   # expect: exit 0
```

**Prueba en tablet real (manual — no es compuerta de máquina; no va en `tasks.json`):** el dueño o el mecánico inicia una recepción en la tablet del taller con el dedo, sin zoom. Lo marca el dueño; no lo reemplaza Playwright.

**Checkpoint**

```bash
git add -A && git commit -m "feat: f1-16 start reception on tablet from booking or walk-in" && git tag f1-16
git tag -l f1-16 | grep -qx f1-16   # expect: exit 0
```

---

## Epic acceptance

1. **WHEN** una reserva del sitio se recibe en tablet **THE SYSTEM SHALL** crear la orden sin volver a escribir los datos del cliente (FASE1 §14.2; `e2e/recepcion-inicio.spec.ts`).
2. **WHEN** se fuerza `entregada` con saldo o `lista_para_retirar` sin control **THE SYSTEM SHALL** rechazarlo en la base (`work-orders.test.ts`).

```bash
pnpm test tests/integration/work-orders.test.ts tests/integration/manual-booking.test.ts   # expect: exit 0
pnpm build && pnpm test:tablet e2e/recepcion-inicio.spec.ts e2e/clientes.spec.ts   # expect: exit 0
pnpm format && pnpm gate   # expect: exit 0
```

## Pitfalls

- **Importar `schema-orders.ts` desde `schema.ts`** — ciclo con uso inmediato; las importaciones van solo hacia abajo.
- **Exigir `customers.manage` en `startReception`** — bloquearía al mecánico (decisión 5); usa `insertCustomer`/`insertBike`.
- **Cambiar el estado de la reserva al recibirla** — `bookings` es interfaz congelada.
- **Números de orden con `max()+1`** — choca en concurrencia; usa `update … returning`.
- **Afirmar `OT-00004` en un spec** — otros specs crean órdenes; usa `/OT-\d{5}/`.

## Before moving on

- [ ] Every task in this epic is `done` in `tasks.json`.
- [ ] Every `verify` command passed; none edited or skipped.
- [ ] Tags `f1-09` … `f1-16` existen.
- [ ] Gate passes from the project root.
- [ ] Every "Produced" contract exists with the stated signature.
- [ ] No file outside the subtree was modified.
- [ ] Esta épica no agrega variables de entorno.
- [ ] One commit per task, each followed by its checkpoint tag.
