# Epic 05: Historial y operación

> Después de esta épica existen componentes instalados y reemplazados, el informe final (interno y público por token), el historial de bicicleta y de cliente, los dashboards por rol, las tareas de alertas de atraso y retención de fotos, y la contracción de `admin_users` con el runbook y la compuerta de la fase.

| | |
|---|---|
| **Epic id** | `05-historial-operacion` |
| **Tasks** | `E5-T1` … `E5-T7` (pasos F1-31 … F1-37) |
| **Depends on** | `04-adicionales-cierre` |
| **Unlocks** | nada — es la última |
| **Parallel with** | ninguna |

You do not need any other file to complete this epic. Everything below is repeated here on purpose.

---

## Stack

Astro 7 SSR · TypeScript 6 · Preact · Postgres 16 · Drizzle ORM 0.45 · almacenamiento `ObjectStorage` · Resend (transporte `console` en dev/tests) · luxon · Playwright (tablet). `pnpm` 12.4.2; Node 24; versiones en `pnpm-lock.yaml`.

| Task | Command |
|---|---|
| Formatear | `pnpm format` |
| Test (un archivo) | `pnpm test tests/integration/<archivo>.test.ts` |
| Migraciones (solo base dev) | `pnpm db:generate` · `pnpm db:migrate` · `pnpm db:check` |
| Tablet | `pnpm build && pnpm test:tablet e2e/<archivo>.spec.ts` |
| Compuerta | `pnpm gate` |

**Gate:** `pnpm format && pnpm gate`. Servicio: Postgres local (`vector_bikes`, `vector_bikes_e2e`, con el rol que fija `.env`). Reversión (la confirma el operador en la sesión supervisada; el allowlist no la impide técnicamente, porque `node -e:*` permite JS arbitrario): `git reset --hard f1-<anterior>` y, si hace falta, el reinicio de la base dev de `blueprint.md` §9 regla 6.

**Cobertura de tablet:** E5-T5 tiene `e2e/dashboard-mecanico.spec.ts`. E5-T1 a E5-T4 son pantallas de escritorio del personal o la página pública del informe que el cliente abre en su teléfono; su lógica está en tests de integración. E5-T6 y E5-T7 no tienen pantalla.

## Directory subtree

```
src/server/db/schema-orders.ts             # edit: bike_components
src/server/db/schema-reports.ts            # NEW (E5-T2): service_reports, reportTables
src/server/db/schema.ts                     # edit (E5-T7): contracción
src/server/taller/components.ts · reports.ts · history.ts · dashboard.ts · maintenance.ts   # NEW
src/server/api/task-handlers.ts             # edit (E5-T6)
src/server/auth/admin-auth.ts               # edit (E5-T7): quitar la copia
src/components/taller/ReportView.astro      # NEW (E5-T2)
src/pages/taller/ordenes/[id]/componentes.astro · informe.astro   # NEW
src/pages/informe/[token].astro             # NEW (E5-T3)
src/pages/taller/bicicletas/[id].astro · clientes/[id].astro   # edit (E5-T4)
src/pages/taller/index.astro                # edit (E5-T5)
src/pages/api/tareas/alertas.ts · retencion.ts  # NEW (E5-T6)
scripts/db-check.ts · README.md             # edit
tests/integration/{components,reports,history,dashboard,tasks-maintenance,admin-auth}.test.ts
e2e/dashboard-mecanico.spec.ts              # NEW
```

## Data model touched here

**B** = `branch_id` not null → branches restrict · **V** = `voided_at` + `voided_by → users` · **CB** = `created_by uuid not null → users`. Cada tabla nueva se agrega a `orderTables`.

| Entity | Campos | Notas |
|---|---|---|
| `bike_components` (E5-T1) | B, `bike_id → bikes`, `work_order_id → work_orders`, `work_order_item_id → work_order_items` (null), `component_type`, `brand`, `model` (text not null), `serial_number`, `installed_at date not null`, `price_clp integer not null default 0`, `replaced_at date`, `replaced_by_component_id → bike_components` (`(): AnyPgColumn =>`), V, CB | índices `(bike_id, installed_at)`, `(work_order_id)`; CHECK `price_clp >= 0`, `replaced_at is null or replaced_at >= installed_at`. Sin kilómetros (decisión 12) |
| `service_reports` (E5-T2) | B, `work_order_id` (único), `generated_at timestamptz not null`, `generated_by → users not null`, `snapshot jsonb not null`, `share_token_hash text not null` (único) | |
| `admin_users` (E5-T7) | **se elimina** | |
| `admin_sessions` (E5-T7) | **se elimina** `admin_user_id`; `user_id` pasa a NOT NULL | |
| `order_photos` (E5-T6) | escribe `full_purged_at` | solo `recepcion_6m` |

**Snapshot del informe (versión 1):** `{ version: 1, orderNumber, customerFirstName, bike: { brand, model, year, type, size, color, serialNumber, kmNoted }, receivedAt, deliveredAt, diagnosis, workDone: [{ description, quantity }], problemsFound: [{ item, result, note }], componentsReplaced: [{ componentType, brand, model, replaces }], photosBefore: [{ photoId, thumbKey }], photosAfter: [{ photoId, thumbKey }], recommendations, nextChecks, rejectedWork: [{ description, recommendation, decidedAt }], totalClp }` — fechas ISO; nunca teléfono, correo ni RUT.

## Contracts

**Consumed:** `SessionUser`, `requireAdmin`, `loginRedirect` · `can`, `forbiddenResponse` · `recordAudit` · `rules.ts` · `formatOrderNumber`, `recordStatusChange` · `canAccessOrder`, `listOrders` · `listOrderPhotos` · `newShareToken`, `hashShareToken`, `shareTokenSchema` · `listApprovals` · `listPayments` · `getStorage`, `ObjectStorage` · `isAuthorizedTask` y el guardia de `task-handlers.ts` · `createTransport`, `consoleOutbox` (`email/transport.ts`) · `getEmailEnv`, `getSiteEnv` · `localToday`, `addDays` · `formatClp`.

**Produced:**

| Export | Signature |
|---|---|
| `components.ts` → `installComponent`, `voidComponent`, `listComponentsOfBike` | `installComponent(db, actor, orderId, input, now)` → `{ ok: true, id } \| { ok: false, code }` |
| `reports.ts` → `buildReportSnapshot`, `generateReport`, `getReportForStaff`, `viewReportByToken`, `ReportSnapshot` | `viewReportByToken(db, storage, token)` → `{ snapshot, photos: Record<string, string> } \| null` |
| `history.ts` → `bikeTimeline`, `customerTimeline`, `sortTimeline`, `TimelineEvent` | `TimelineEvent = { at: string; kind: "order_opened" \| "service_done" \| "component_installed" \| "component_replaced" \| "approval_rejected" \| "report_generated" \| "payment" \| "warranty_opened" \| "order_delivered"; orderId?: string; orderNumber?: string; title: string; detail?: string }` |
| `dashboard.ts` → `adminDashboard`, `mechanicDashboard` | `(db, actor, now)` |
| `maintenance.ts` → `overdueOrders`, `sendOverdueDigest`, `purgeReceptionPhotos` | `purgeReceptionPhotos(db, storage, now)` → `{ purged, failed }` |
| `task-handlers.ts` → `handleAlertsTask`, `handleRetentionTask` | `(request, db, now, deps?)` |

## Conventions that bite in this area

- El informe es un **snapshot**: editar la orden después no lo cambia; regenerar reemplaza snapshot y token.
- `/informe/[token]` es pública: `noindex`, `no-store`, `referrer-policy: no-referrer`, fotos incrustadas como `data:` (nunca una URL del almacenamiento).
- Retención: borrar el objeto fuera de cualquier transacción y luego marcar `full_purged_at`; la miniatura nunca se borra.
- `alertas` no es idempotente por diseño (un correo por llamada; Make.com la llama una vez al día). `retencion` sí lo es.
- La contracción (E5-T7) es solo de borrado: nada aditivo en esa misma generación, para que drizzle-kit no pregunte.
- Ningún comando de esta épica lleva credenciales: la limpieza de sesiones legadas de E5-T7 es una sentencia `delete` que no toca claves.
- Lo que ve el mecánico sin asignar es lo mismo en todas partes: órdenes sin asignar en `reservada`, `recibida` o `diagnostico` (`canAccessOrder`, `listOrders`, `mechanicDashboard.unassigned`).

Full project rules: `CLAUDE.md`. Area rules: `.claude/rules/database.md`, `server-api.md`, `taller-ui.md`, `taller-domain.md`, `e2e.md`.

---

## Tasks

### `E5-T1` — F1-31 Record installed and replaced components

**Depends on:** `E4-T6` · **Priority:** p1

1. `schema-orders.ts`: `bikeComponents`; generate → migrate.
2. `src/server/taller/components.ts`: `componentFormSchema` (tipo 2–60, marca 1–60, modelo 1–80, serie ≤ 80 opcional, `workOrderItemId` uuid opcional, `replacesComponentId` uuid opcional, `installedAt` fecha opcional = hoy local); `installComponent(db, actor, orderId, input, now)`: `components.manage` + `canAccessOrder`; si hay `workOrderItemId`, debe ser una línea `repuesto` no anulada de esa orden (si no `invalid_item`) y su `unit_price_clp` es el precio; sin línea, precio 0 (nadie escribe el precio del componente); si reemplaza, el anterior debe ser de la misma bici, vigente y sin reemplazar → se le fija `replaced_at` y `replaced_by_component_id`; audit `component.installed`. `voidComponent` (`items.void`; V; audit `component.voided`). `listComponentsOfBike(db, actor, bikeId)` incluye reemplazados.
3. `src/pages/taller/ordenes/[id]/componentes.astro`: componentes de la bici (vigentes y reemplazados con su fecha) y formulario "Instalar componente" (`select` de líneas de repuesto opcional, `select` "Reemplaza a" opcional).
4. `tests/integration/components.test.ts`: los cinco criterios.

**Files**
- `src/server/db/schema-orders.ts` — edit
- `src/server/taller/components.ts` — new
- `src/pages/taller/ordenes/[id]/componentes.astro` — new
- `tests/integration/components.test.ts` — new

**Acceptance**

1. **WHEN** se instala un componente ligado a una línea `repuesto` de la orden **THE SYSTEM SHALL** guardar tipo, marca, modelo, número de serie, fecha de instalación y el precio de esa línea, con la bicicleta y la orden
2. **WHEN** se instala un componente que reemplaza a otro **THE SYSTEM SHALL** fijar en el anterior `replaced_at` y `replaced_by_component_id` sin borrarlo
3. **WHEN** se anula un componente **THE SYSTEM SHALL** conservar la fila con `voided_at` y `voided_by`
4. **WHEN** `listComponentsOfBike` corre **THE SYSTEM SHALL** incluir los componentes reemplazados con su fecha de reemplazo
5. **WHEN** la línea indicada no es un `repuesto` de esa orden **THE SYSTEM SHALL** devolver `{ ok: false, code: "invalid_item" }`

**Verify**

```bash
pnpm test tests/integration/components.test.ts   # expect: exit 0, 0 failed
pnpm db:migrate   # expect: exit 0
pnpm db:check   # expect: exit 0
pnpm format && pnpm gate   # expect: exit 0
```

**Checkpoint**

```bash
git add -A && git commit -m "feat: f1-31 record installed and replaced components" && git tag f1-31
git tag -l f1-31 | grep -qx f1-31   # expect: exit 0
```

### `E5-T2` — F1-32 Generate the final service report

**Depends on:** `E5-T1` · **Priority:** p1

1. `schema-reports.ts` (nuevo, importa de `schema-orders.ts`; `schema-orders.ts` ya está en 397 líneas, §20.3 #32): `serviceReports` y `export const reportTables = [serviceReports] as const`; generate → migrate.
2. `src/server/taller/reports.ts`: `type ReportSnapshot` (forma de arriba); `buildReportSnapshot(db, orderId, { recommendations, nextChecks })`: bici, primer nombre del cliente, `workDone` (líneas no anuladas: descripción y cantidad; sin precios), `problemsFound` (puntos del checklist en `revisar`/`malo` con nota), `diagnosis`, `componentsReplaced` (instalados en esta orden; `replaces` = descripción del reemplazado o `null`), `photosBefore` (fotos `recepcion` no anuladas: id y `thumb_key`), `photosAfter` (`terminado`), `rejectedWork` (propuestas `rechazado` de la orden), `totalClp`, `kmNoted`; `generateReport(db, actor, orderId, input, now)`: `reports.generate`; orden en `lista_para_retirar` o `entregada` (si no `invalid_status`); recomendaciones y próximas revisiones ≤ 2000; `newShareToken()`; upsert por `work_order_id` (`onConflictDoUpdate` reemplaza snapshot, hash, `generated_at`, `generated_by`); audit `report.generated` → `{ ok: true, token }`. `getReportForStaff(db, actor, orderId)`; `loadReportPhotos(storage, snapshot)` → `Record<photoId, "data:image/jpeg;base64,…">` leyendo miniaturas.
3. `src/components/taller/ReportView.astro`: props `{ snapshot; photos: Record<string, string> }` con tipos propios (no importa `src/server/**`); secciones Bicicleta, Trabajo realizado, Problemas encontrados, Componentes reemplazados, Antes y después, Recomendaciones, Próximas revisiones, Trabajos rechazados, Total; imprimible.
4. `src/pages/taller/ordenes/[id]/informe.astro`: formulario "Recomendaciones" (por defecto, los `aftercare` de los servicios de la orden) y "Próximas revisiones" → "Generar informe" → respuesta con el enlace `<PUBLIC_SITE_URL>/informe/<token>` mostrado una vez + "Enviar por WhatsApp"; si existe, `ReportView` con las fotos.
5. `tests/integration/reports.test.ts`: criterios 1–5 (orden armada con dos fotos por etapa, una propuesta rechazada, un componente que reemplaza a otro).

**Files**
- `src/server/db/schema-reports.ts` — new
- `src/server/taller/reports.ts` — new
- `src/components/taller/ReportView.astro` — new
- `src/pages/taller/ordenes/[id]/informe.astro` — new
- `tests/integration/reports.test.ts` — new

**Acceptance**

1. **WHEN** se genera el informe de una orden **THE SYSTEM SHALL** guardar en `service_reports.snapshot` datos de la bicicleta, trabajo realizado, problemas encontrados, componentes reemplazados, fotos de antes (`recepcion`) y después (`terminado`), kilometraje anotado, recomendaciones, próximas revisiones, trabajos rechazados y un único total
2. **WHEN** el informe se genera **THE SYSTEM SHALL** devolver un token de 43 caracteres y guardar solo su sha256 en `share_token_hash`
3. **WHEN** se regenera **THE SYSTEM SHALL** reemplazar el snapshot y el hash, de modo que el token anterior deja de servir
4. **WHEN** el snapshot se arma **THE SYSTEM SHALL** incluir solo el primer nombre del cliente y ningún teléfono, correo ni RUT
5. **WHEN** un mecánico genera el informe **THE SYSTEM SHALL** devolver `{ ok: false, code: "forbidden" }`

**Verify**

```bash
pnpm test tests/integration/reports.test.ts   # expect: exit 0, 0 failed
pnpm db:migrate   # expect: exit 0
pnpm db:check   # expect: exit 0
pnpm format && pnpm gate   # expect: exit 0
```

**Checkpoint**

```bash
git add -A && git commit -m "feat: f1-32 generate the final service report" && git tag f1-32
git tag -l f1-32 | grep -qx f1-32   # expect: exit 0
```

### `E5-T3` — F1-33 Add public read-only report page

**Depends on:** `E5-T2` · **Priority:** p1

Sigue §20.3 #33, que aplica a `/informe` la regla de #31: un enlace no válido nunca revela si el token existió.

1. `reports.ts`: `viewReportByToken(db, storage, token)`: `shareTokenSchema` (forma inválida → `null` sin consultar); busca por `hashShareToken(token)`; sin fila → `null`; devuelve `{ snapshot, photos: await loadReportPhotos(storage, snapshot) }`. Las miniaturas existen aunque la copia completa se haya purgado.
2. `src/pages/informe/[token].astro`: `prerender = false`; `Base` con `noindex` y `chrome="none"`; en toda respuesta `cache-control: no-store`, `referrer-policy: no-referrer` y `x-robots-tag: noindex`; registra `originForLog` (nunca el token). Orden: `checkRateLimit` → si corresponde, 429 "Demasiados intentos. Vuelve a intentar en 10 minutos." con `Retry-After`, sin consultar el informe → `viewReportByToken` → `null` → `recordAttempt` y 404 "Enlace no válido", una respuesta fija igual para token inexistente, de forma inválida o reemplazado → si no, 200 con `ReportView`. Solo los enlaces no válidos cuentan como intento: el cliente que abre su informe varias veces no gasta el límite.
3. `ReportView.astro`: edición mínima para que las fotos no desborden fuera de `/taller` (ancho máximo del contenedor); nada más cambia.
4. `tests/integration/report-view.test.ts`: criterios 1–4 (purga simulada: `full_purged_at` fijado y el objeto completo borrado del almacenamiento local). `reports.test.ts` no se toca: ya está en 397 líneas.
5. `tests/integration/report-page.test.ts` (con `AstroContainer`, como `approval-page.test.ts`): criterios 5–6; las tres respuestas 404 se comparan byte a byte (estado, cabeceras y cuerpo).

**Files**
- `src/pages/informe/[token].astro` — new
- `src/server/taller/reports.ts` — edit
- `src/components/taller/ReportView.astro` — edit
- `tests/integration/report-view.test.ts` — new
- `tests/integration/report-page.test.ts` — new

**Acceptance**

1. **WHEN** `viewReportByToken` recibe el token vigente **THE SYSTEM SHALL** devolver el snapshot y las miniaturas de antes y después como `data:image/jpeg;base64,`
2. **WHEN** recibe un token anterior a una regeneración, inexistente o con forma inválida **THE SYSTEM SHALL** devolver `null`
3. **WHEN** la copia completa de una foto de recepción fue purgada por retención **THE SYSTEM SHALL** seguir devolviendo su miniatura
4. **WHEN** arma la vista pública **THE SYSTEM SHALL** no incluir teléfono, correo ni RUT del cliente
5. **WHEN** `/informe/[token]` recibe un token inexistente, de forma inválida o reemplazado al regenerar **THE SYSTEM SHALL** devolver la misma respuesta 404 "Enlace no válido", idéntica byte a byte en estado, cabeceras y cuerpo
6. **WHEN** una misma IP acumula 5 enlaces no válidos en 10 minutos **THE SYSTEM SHALL** responder 429 con `Retry-After` a toda petición de esa IP, también con un token vigente, sin consultar el informe

**Verify**

```bash
pnpm test tests/integration/report-view.test.ts tests/integration/report-page.test.ts   # expect: exit 0, 0 failed
pnpm format && pnpm gate   # expect: exit 0
```

**Checkpoint**

```bash
git add -A && git commit -m "feat: f1-33 add public read-only report page" && git tag f1-33
git tag -l f1-33 | grep -qx f1-33   # expect: exit 0
```

### `E5-T4` — F1-34 Add bike and customer timelines

**Depends on:** `E5-T3` · **Priority:** p1

1. `src/server/taller/history.ts`: `TimelineEvent` (arriba); `KIND_ORDER` fijo (`order_opened`, `service_done`, `component_installed`, `component_replaced`, `approval_rejected`, `payment`, `order_delivered`, `report_generated`, `warranty_opened`); `sortTimeline(events)` puro: por `at` ascendente, a igualdad por índice en `KIND_ORDER`, estable. `bikeTimeline(db, actor, bikeId)`: por cada orden de la bici (`received_at` o `created_at`) un `order_opened`; sus líneas no anuladas como `service_done`; componentes como `component_installed` (`installed_at`) y, si tienen `replaced_at`, `component_replaced`; propuestas `rechazado` como `approval_rejected` (`decided_at`); informes como `report_generated`. `customerTimeline(db, actor, customerId)`: órdenes (visitas), pagos no anulados, garantías (`warranty_opened`), entregas.
2. `src/pages/taller/bicicletas/[id].astro` y `src/pages/taller/clientes/[id].astro`: sección "Historial" (lista cronológica con fecha local, número de orden enlazado y título).
3. `tests/integration/history.test.ts`: bici con dos visitas (orden 1 entregada con un componente luego reemplazado en la orden 2 y un adicional rechazado; orden 2 con informe) → criterios 1–5.

**Files**
- `src/server/taller/history.ts` — new
- `src/pages/taller/bicicletas/[id].astro` — edit
- `src/pages/taller/clientes/[id].astro` — edit
- `tests/integration/history.test.ts` — new

**Acceptance**

1. **WHEN** `bikeTimeline` corre para una bicicleta con dos visitas **THE SYSTEM SHALL** devolver ambas órdenes en orden cronológico con sus servicios, componentes instalados y reemplazados, adicionales rechazados e informes
2. **WHEN** un componente fue reemplazado **THE SYSTEM SHALL** incluir en la línea de tiempo tanto su instalación como su reemplazo
3. **WHEN** un adicional fue rechazado **THE SYSTEM SHALL** incluirlo como evento `approval_rejected` con su descripción y fecha
4. **WHEN** `customerTimeline` corre **THE SYSTEM SHALL** devolver visitas, órdenes, pagos no anulados y garantías del cliente en orden cronológico
5. **WHEN** `sortTimeline` recibe eventos desordenados con el mismo instante **THE SYSTEM SHALL** ordenarlos por instante y, a igualdad, por tipo en forma estable

**Verify**

```bash
pnpm test tests/integration/history.test.ts   # expect: exit 0, 0 failed
pnpm format && pnpm gate   # expect: exit 0
```

**Checkpoint**

```bash
git add -A && git commit -m "feat: f1-34 add bike and customer timelines" && git tag f1-34
git tag -l f1-34 | grep -qx f1-34   # expect: exit 0
```

### `E5-T5` — F1-35 Add role dashboards for admin and mechanic

**Depends on:** `E5-T4` · **Priority:** p1

1. `src/server/taller/dashboard.ts`: `adminDashboard(db, actor, now)` → `{ bookingsToday, incomeTodayClp, inWorkshop, waitingApproval, waitingParts, inRepair, qcPending, readyForPickup, overdue, upcomingDeliveries, loadByMechanic, pendingPayments }` (listas de órdenes con número, cliente, bici, estado, mecánico, fecha; `inWorkshop` = estados entre `recibida` y `lista_para_retirar`; `overdue` = `estimated_delivery_date` < hoy local y estado fuera de `entregada`, `cancelada`, `trabajo_rechazado`; `upcomingDeliveries` = hoy a hoy+2; `loadByMechanic` = órdenes abiertas y minutos por mecánico; `pendingPayments` = `lista_para_retirar` con saldo > 0; `incomeTodayClp` = pagos no anulados con `received_at` en el día local). `mechanicDashboard(db, actor, now)` → `{ upcomingIntakes (reservas de hoy a hoy+2, sin teléfono ni correo), assigned, pending, overdue, waitingApproval, waitingParts, dueSoon, qcPending, unassigned }`, solo órdenes asignadas al actor salvo `unassigned` (sin asignar en `reservada`, `recibida` o `diagnostico`, el mismo conjunto que `canAccessOrder` y `listOrders` le dejan ver).
2. `src/pages/taller/index.astro`: conserva `<h1>Taller</h1>` y `Hola, <nombre> · <rol>` (los afirma `e2e/login.spec.ts`); con `dashboard.admin` las secciones Reservas de hoy, Ingresos de hoy, Bicicletas en taller, Esperando aprobación, Esperando repuesto, En reparación, Control de calidad pendiente, Listas para retiro, Atrasadas, Próximas entregas, Carga por mecánico, Pagos pendientes; con `dashboard.mechanic` las secciones Próximos ingresos, Bicicletas asignadas, Trabajos pendientes, Atrasados, Esperando aprobación, Esperando repuesto, Próximos a entrega, Control de calidad pendiente, Sin asignar. Cada sección con `h2`, lista o texto vacío, números de orden enlazados.
3. `tests/integration/dashboard.test.ts`: órdenes sembradas en cada estado y fechas; se afirma pertenencia por id a cada grupo nombrado (nunca totales mágicos); `unassigned` incluye una sin asignar en `reservada`, otra en `recibida` y otra en `diagnostico`, y excluye una sin asignar en `en_reparacion`.
4. `e2e/dashboard-mecanico.spec.ts`: `login(page, "mechanic")` → heading `Bicicletas asignadas` visible y texto `OT-00001` en esa sección (`OT-00001` está asignada al mecánico sembrado).

**Files**
- `src/server/taller/dashboard.ts` — new
- `src/pages/taller/index.astro` — edit
- `tests/integration/dashboard.test.ts` — new
- `e2e/dashboard-mecanico.spec.ts` — new

**Acceptance**

1. **WHEN** `adminDashboard` corre con órdenes sembradas en cada estado **THE SYSTEM SHALL** poner cada orden en su grupo nombrado (`waitingApproval`, `waitingParts`, `inRepair`, `qcPending`, `readyForPickup`) según su estado
2. **WHEN** una orden abierta tiene `estimated_delivery_date` anterior a hoy **THE SYSTEM SHALL** incluirla en `overdue`, y una `entregada` con fecha pasada SHALL quedar fuera
3. **WHEN** hay pagos recibidos hoy **THE SYSTEM SHALL** sumar en `incomeTodayClp` solo los no anulados de hoy
4. **WHEN** `mechanicDashboard` corre para un mecánico **THE SYSTEM SHALL** incluir solo sus órdenes asignadas en los grupos y las sin asignar en `reservada`, `recibida` o `diagnostico` en `unassigned`
5. **WHEN** el mecánico entra en el viewport de tablet **THE SYSTEM SHALL** mostrar en `/taller` el encabezado `Bicicletas asignadas` con `OT-00001`

**Verify**

```bash
pnpm test tests/integration/dashboard.test.ts   # expect: exit 0, 0 failed
pnpm build && pnpm test:tablet e2e/dashboard-mecanico.spec.ts e2e/login.spec.ts   # expect: exit 0, 0 failed
pnpm format && pnpm gate   # expect: exit 0
```

**Checkpoint**

```bash
git add -A && git commit -m "feat: f1-35 add role dashboards for admin and mechanic" && git tag f1-35
git tag -l f1-35 | grep -qx f1-35   # expect: exit 0
```

### `E5-T6` — F1-36 Add overdue alerts and photo retention tasks

**Depends on:** `E5-T5` · **Priority:** p1

Seis archivos, permitido por la regla "≤ 5 archivos, máximo 6 cuando el sexto es una página o un endpoint delgado": `retencion.ts` es un envoltorio de tres líneas igual a `alertas.ts`.

1. `src/server/taller/maintenance.ts`: `overdueOrders(db, now)` (fecha estimada < hoy en `America/Santiago`, estado fuera de `entregada`, `cancelada`, `trabajo_rechazado`; con número, cliente, bici, fecha y días de atraso); `sendOverdueDigest(db, now, deps = {})`: sin atrasadas → `{ overdue: 0, sent: false }` sin correo; si hay, un correo a `getEmailEnv().SHOP_NOTIFY_EMAIL` con asunto `Órdenes atrasadas: <n> · Vector Bikes` y una línea por orden `OT-xxxxx · <cliente> · <marca modelo> · prometida <dd-MM-yyyy> (<n> días)` (transporte `deps.transport ?? createTransport()`) → `{ overdue, sent: true }`. `purgeReceptionPhotos(db, storage, now)`: corte = `DateTime.fromJSDate(now).setZone("America/Santiago").minus({ months: 6 })`; fotos `stage = 'recepcion'`, `retention_class = 'recepcion_6m'`, `full_purged_at is null`, `created_at < corte`; por cada una, `storage.delete(full_key)` y después `update … set full_purged_at = now` (sentencias separadas, sin transacción con E/S); errores contados en `failed`.
2. `src/server/api/task-handlers.ts`: `handleAlertsTask(request, db, now, deps?: { secret?; transport? })` → 200 `{"ok":true,"overdue":n,"sent":true|false}` o 500 `{"ok":false,"overdue":n,"sent":false}` si el envío falla; `handleRetentionTask(request, db, now, deps?: { secret?; storage? })` → 200 `{"ok":true,"purged":n}` o 500 `{"ok":false,"purged":n,"failed":m}`. Mismo guardia que recordatorios (405/401, log `tasks.unauthorized`).
3. `src/pages/api/tareas/alertas.ts` y `src/pages/api/tareas/retencion.ts`: envoltorios `prerender = false` (retención con `await getStorage()`).
4. `README.md`, en `## Recordatorios por correo (cron externo)`: "El mismo escenario de Make.com encadena, después del primero, `POST https://vectorbikes.cl/api/tareas/alertas` (correo diario al taller con las órdenes atrasadas; cada llamada envía un resumen, por eso se llama una sola vez al día) y `POST https://vectorbikes.cl/api/tareas/retencion` (borra las copias completas de fotos de recepción con más de 6 meses y conserva las miniaturas; repetirla no hace nada), con la misma cabecera."
5. `tests/integration/tasks-maintenance.test.ts`: 401 en ambos; resumen con dos atrasadas (y una `entregada` con fecha pasada que no aparece) leído de `consoleOutbox`; sin atrasadas sin correo; retención con fotos de recepción de 7 meses y de 1 mes y una `terminado` de 7 meses (solo la primera se purga; su miniatura sigue en el almacenamiento); segunda corrida `purged: 0`.

**Files**
- `src/server/api/task-handlers.ts` — edit
- `src/pages/api/tareas/alertas.ts` — new
- `src/pages/api/tareas/retencion.ts` — new (endpoint delgado)
- `src/server/taller/maintenance.ts` — new
- `tests/integration/tasks-maintenance.test.ts` — new
- `README.md` — edit

**Acceptance**

1. **WHEN** `POST /api/tareas/alertas` o `POST /api/tareas/retencion` llegan sin el bearer de `TASKS_SECRET` **THE SYSTEM SHALL** responder 401 con `{"ok":false,"error":"unauthorized"}`
2. **WHEN** hay órdenes con fecha estimada anterior a hoy en Santiago en estados distintos de `entregada`, `cancelada` y `trabajo_rechazado` **THE SYSTEM SHALL** enviar un correo a `SHOP_NOTIFY_EMAIL` que lista sus números y responder 200 con `{"ok":true,"overdue":n,"sent":true}`
3. **WHEN** no hay órdenes atrasadas **THE SYSTEM SHALL** responder `{"ok":true,"overdue":0,"sent":false}` sin enviar correo
4. **WHEN** corre la retención **THE SYSTEM SHALL** borrar del almacenamiento solo las copias completas de fotos `recepcion_6m` con más de 6 meses, conservar sus miniaturas, fijar `full_purged_at` y responder `{"ok":true,"purged":n}`
5. **WHEN** la retención corre por segunda vez **THE SYSTEM SHALL** responder `{"ok":true,"purged":0}`
6. **WHEN** se lee `README.md` **THE SYSTEM SHALL** listar `POST https://vectorbikes.cl/api/tareas/alertas` y `POST https://vectorbikes.cl/api/tareas/retencion`

**Verify**

```bash
pnpm test tests/integration/tasks-maintenance.test.ts tests/integration/tasks.test.ts   # expect: exit 0, 0 failed
grep -qF 'POST https://vectorbikes.cl/api/tareas/alertas' README.md   # expect: exit 0
grep -qF 'POST https://vectorbikes.cl/api/tareas/retencion' README.md   # expect: exit 0
pnpm format && pnpm gate   # expect: exit 0
```

**Checkpoint**

```bash
git add -A && git commit -m "feat: f1-36 add overdue alerts and photo retention tasks" && git tag f1-36
git tag -l f1-36 | grep -qx f1-36   # expect: exit 0
```

### `E5-T7` — F1-37 Contract legacy admin tables, close phase gate

**Depends on:** `E5-T6` · **Priority:** p1

**Precondición de publicación (checklist §20.1, no es compuerta de build):** producción corre una publicación ≥ `f1-07`, el dueño ingresó una vez y `/taller/usuarios` de producción lo muestra como Dueño. Solo entonces se publica algo que contenga `f1-37`. Si se publicara antes: con sesiones legadas en producción la propagación de esquema falla por `SET NOT NULL` y no se publica; sin ninguna sesión, `admin_users` desaparece y el dueño recupera acceso con `pnpm admin:set-password` contra producción.

1. Primero, solo base dev, borrar las sesiones legadas para que el `SET NOT NULL` aplique, sin tocar ninguna clave. El comando sale 2 sin hacer nada si `REPLIT_DEPLOYMENT` está definida; esa guarda y que el operador lo ve en la sesión supervisada son su resguardo (tiene su propia entrada en el allowlist, pero `node -e:*` permite JS arbitrario, así que el allowlist no es una barrera técnica):
   ```bash
   node --env-file-if-exists=.env --input-type=module -e "if (process.env.REPLIT_DEPLOYMENT) process.exit(2); const { default: postgres } = await import('postgres'); const sql = postgres(process.env.DATABASE_URL, { max: 1 }); await sql\`delete from admin_sessions where user_id is null\`; await sql.end();"
   ```
2. `src/server/db/schema.ts`: eliminar `adminUsers`, el tipo `AdminUser` y su entrada en `allTables`; en `adminSessions` eliminar `adminUserId` y agregar `.notNull()` a `userId`. Nada aditivo en este cambio.
3. `pnpm db:generate` y leer el SQL de la migración que emite (el archivo más nuevo en `drizzle/`): solo `DROP CONSTRAINT`, `DROP COLUMN admin_user_id`, `SET NOT NULL` y `DROP TABLE "admin_users"`. Si drizzle-kit pregunta algo, detenerse. Luego `pnpm db:migrate`.
4. `src/server/auth/admin-auth.ts`: quitar el fallback y la copia (y sus imports); `loginAdmin` solo lee `users`.
5. `scripts/db-check.ts`: además de `CREATE TABLE`, leer `DROP TABLE(?: IF EXISTS)? "(?:public"\.")?([a-z_]+)"` y restar esas tablas de las esperadas; revisar columnas de `allTables`, `tallerTables` (de `schema-taller.ts`) `orderTables` (de `schema-orders.ts`) y `reportTables` (de `schema-reports.ts`).
6. `tests/integration/admin-auth.test.ts`: quitar los casos de copia; conservar login, sesión, cambio de clave, límite de intentos, logout y cookie; agregar que `information_schema.columns` no tiene `admin_sessions.admin_user_id`.
7. `README.md`: nueva sección `## Operación del taller` (entrar por `/admin/login` → `/taller`; crear y desactivar usuarios en `/taller/usuarios`; recepción paso a paso en la tablet, la puede hacer cualquier rol; etiqueta e impresora de 62 mm; adicional por WhatsApp; control de calidad; pagos y entrega; informe; garantía; si falla una foto; el escenario de Make.com; respaldos); en "Configuración de producción → 3. Esquema" reemplazar la lista fija de 9 tablas por "confirma que `pnpm db:check` sale `{"ok":true,…}` en desarrollo y que esas tablas aparecen en producción"; en "Cambiar la clave del panel" agregar que el dueño también puede resetear claves en `/taller/usuarios`.

**Criterios FASE1 §14 → prueba:** 1 `users-admin.test.ts` + `order-status.test.ts` + `e2e/dashboard-mecanico.spec.ts` · 2 `e2e/recepcion-inicio.spec.ts` + `work-orders.test.ts` · 3 `e2e/recepcion-completa.spec.ts` (+ tablet real) · 4 `label.test.ts` + `e2e/etiqueta.spec.ts` (+ impresión real) · 5 `approvals.test.ts` · 6 `history.test.ts` · 7 `work-orders.test.ts` + `qc.test.ts` + `e2e/control-calidad.spec.ts` · 8 `work-orders.test.ts` + `delivery.test.ts` + `e2e/entrega.spec.ts` · 9 `reports.test.ts` · 10 `history.test.ts` · 11 `warranty.test.ts` · 12 `catalog.test.ts` + `order-items.test.ts` · 13 `pnpm gate` · 14 checklist de lanzamiento.

**Files**
- `src/server/db/schema.ts` — edit
- `src/server/auth/admin-auth.ts` — edit
- `scripts/db-check.ts` — edit
- `tests/integration/admin-auth.test.ts` — edit
- `README.md` — edit

**Acceptance**

1. **WHEN** `pnpm db:migrate` aplica la migración que emite `pnpm db:generate` **THE SYSTEM SHALL** eliminar `admin_users` y `admin_sessions.admin_user_id` y dejar `admin_sessions.user_id` NOT NULL
2. **WHEN** se busca `adminUsers` en `src/` y `scripts/` **THE SYSTEM SHALL** no encontrar ninguna referencia
3. **WHEN** `pnpm db:check` corre **THE SYSTEM SHALL** restar las tablas eliminadas por `DROP TABLE` en `drizzle/*.sql`, no esperar `admin_users` y verificar las columnas de `allTables`, `tallerTables` y `orderTables`
4. **WHEN** corre `pnpm test tests/integration/admin-auth.test.ts` **THE SYSTEM SHALL** pasar con login, sesión, cambio de clave y límite de intentos sobre `users`
5. **WHEN** se lee `README.md` **THE SYSTEM SHALL** contener la sección `## Operación del taller`
6. **WHEN** corre `pnpm gate` **THE SYSTEM SHALL** salir 0 con todos los tests y specs de la tabla de criterios de FASE1 §14 en verde

**Verify**

```bash
pnpm test tests/integration/admin-auth.test.ts   # expect: exit 0, 0 failed
grep -rq 'adminUsers' src scripts; test $? -eq 1   # expect: 1 = sin referencias → la línea sale 0
pnpm db:migrate   # expect: exit 0
pnpm db:check   # expect: exit 0, {"ok":true,...}
grep -qF '## Operación del taller' README.md   # expect: exit 0
pnpm format && pnpm gate   # expect: exit 0
```

**Checkpoint**

```bash
git add -A && git commit -m "refactor: f1-37 contract legacy admin tables and close phase gate" && git tag f1-37
git tag -l f1-37 | grep -qx f1-37   # expect: exit 0
```

---

## Epic acceptance

1. **WHEN** una bicicleta con dos visitas se consulta **THE SYSTEM SHALL** mostrar ambas en orden con sus componentes y el adicional rechazado (FASE1 §14.6, §14.10; `history.test.ts`).
2. **WHEN** el informe se abre por su token **THE SYSTEM SHALL** mostrar antes y después, lo realizado, lo reemplazado y lo rechazado (FASE1 §14.9; `reports.test.ts`).

```bash
pnpm test tests/integration/history.test.ts tests/integration/reports.test.ts   # expect: exit 0
pnpm build && pnpm test:tablet   # expect: exit 0, todos los specs
pnpm format && pnpm gate   # expect: exit 0
test "$(git tag -l 'f1-*' | wc -l | tr -d ' ')" = 37   # expect: exit 0 — un tag por paso (corre después del último checkpoint)
```

## Pitfalls

- **Mezclar la contracción con un cambio aditivo** — drizzle-kit preguntaría si `admin_users` se renombra; la generación de E5-T7 solo borra.
- **Migrar la base dev con sesiones legadas** — el `SET NOT NULL` falla; corre primero el `delete` del paso 1.
- **Escribir una clave en un comando** — la limpieza no necesita credenciales; nunca uses `admin:set-password` con valores fijos para esto.
- **Publicar `f1-37` antes de que el dueño ingrese en producción** — es la precondición de lanzamiento, no un detalle.
- **Purgar dentro de una transacción** — borrar el objeto y marcar la fila son pasos separados; si el borrado falla, la fila no se marca y la próxima corrida lo reintenta.
- **URLs del almacenamiento en el informe público** — las fotos van incrustadas; nunca exponer claves ni rutas de `/taller/media/`.
- **`unassigned` sin `reservada`** — dejaría fuera las recepciones sin asignar que el mecánico sí puede abrir; el conjunto es el de `canAccessOrder`.

## Before moving on

- [ ] Every task in this epic is `done` in `tasks.json`.
- [ ] Every `verify` command passed; none edited or skipped.
- [ ] Tags `f1-31` … `f1-37` existen; en total 37 (`git tag -l 'f1-*'`).
- [ ] Gate passes from the project root.
- [ ] Every "Produced" contract exists with the stated signature.
- [ ] No file outside the subtree was modified.
- [ ] Esta épica no agrega variables de entorno.
- [ ] One commit per task, each followed by its checkpoint tag.
