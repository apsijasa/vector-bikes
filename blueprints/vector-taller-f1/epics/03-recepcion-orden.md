# Epic 03: Recepción y orden de trabajo

> Después de esta épica una bicicleta se recibe entera en tablet, por cualquier rol (checklist, accesorios, servicio, fecha sugerida, fotos, firma → `Recibida`), y la orden tiene detalle con estados e historial, asignación de mecánico, etiqueta con QR, líneas con precio y documento tributario.

| | |
|---|---|
| **Epic id** | `03-recepcion-orden` |
| **Tasks** | `E3-T1` … `E3-T8` (pasos F1-17 … F1-24) |
| **Depends on** | `01-fundaciones`, `02-catalogo-clientes-entrada` |
| **Unlocks** | `04-adicionales-cierre` |
| **Parallel with** | ninguna (comparte `schema-orders.ts` y `recepcion.astro`) |

You do not need any other file to complete this epic. Everything below is repeated here on purpose.

---

## Stack

Astro 7 SSR · TypeScript 6 · Preact (islas `PhotoCapture`, `SignaturePad`) · Postgres 16 · Drizzle ORM 0.45 · sharp · `ObjectStorage` (local en el Mac) · qrcode · signature_pad · Playwright (tablet). `pnpm` 12.4.2; Node 24; versiones en `pnpm-lock.yaml`.

| Task | Command |
|---|---|
| Formatear | `pnpm format` |
| Test (un archivo) | `pnpm test tests/integration/<archivo>.test.ts` |
| Migraciones (solo base dev) | `pnpm db:generate` · `pnpm db:migrate` · `pnpm db:check` |
| Tablet | `pnpm build && pnpm test:tablet e2e/<archivo>.spec.ts` |
| Smoke | `pnpm build && sh scripts/smoke.sh` |
| Compuerta | `pnpm gate` |

**Gate:** `pnpm format && pnpm gate`. Servicio: Postgres local (`vector_bikes`, `vector_bikes_e2e`, con el rol que fija `.env`). El almacenamiento local escribe en `.storage/` (dev) y `.storage-e2e/` (Playwright), ambos ignorados. Reversión (la confirma el operador en la sesión supervisada; el allowlist no la impide técnicamente, porque `node -e:*` permite JS arbitrario): `git reset --hard f1-<anterior>` y, si hace falta, el reinicio de la base dev de `blueprint.md` §9 regla 6.

**Cobertura de tablet de E3-T3 y E3-T4:** son solo servidor y no tienen pantalla; su cobertura de tablet es `e2e/recepcion-completa.spec.ts` de E3-T5, que sube cuatro fotos por el endpoint de E3-T3 y finaliza con la firma de E3-T4 en el viewport táctil.

## Directory subtree

```
src/server/db/schema-orders.ts                # edit: intake_*, work_order_items, order_photos, order_signatures
src/server/taller/intake.ts · items.ts · delivery-date.ts · photos.ts · reception.ts · status.ts · label.ts  # NEW
src/server/taller/search.ts · orders.ts        # edit (E3-T7, E3-T8)
src/components/taller/PhotoCapture.tsx · SignaturePad.tsx   # NEW (E3-T5)
src/pages/taller/ordenes/index.astro           # NEW (E3-T6)
src/pages/taller/ordenes/[id]/recepcion.astro  # edit (E3-T1, T2, T5)
src/pages/taller/ordenes/[id]/cierre.astro · index.astro · fotos.ts · etiqueta.ts · lineas.astro  # NEW
src/pages/taller/media/[...key].ts             # NEW (E3-T3)
scripts/smoke.sh                               # edit (E3-T3): una línea
tests/integration/{intake,items,photos,reception,order-status,label,order-items}.test.ts
e2e/{recepcion-checklist,recepcion-completa,orden-mecanico,etiqueta}.spec.ts
```

## Data model touched here

**B** = `branch_id` not null → branches restrict · **V** = `voided_at` + `voided_by → users` · **CB** = `created_by uuid not null → users`. Cada tabla se agrega a `orderTables`.

| Entity | Campos | Notas |
|---|---|---|
| `intake_checks` (E3-T1) | B, `work_order_id`, `item_key`, `result`, `note`, CB | único `(work_order_id, item_key)`; CHECK `item_key in ('frenos', 'cadena', 'transmision', 'ruedas', 'neumaticos', 'estado_general', 'problemas_visibles')`, `result in ('ok', 'revisar', 'malo')` |
| `intake_accessories` (E3-T1) | B, `work_order_id`, `description`, V, CB | índice `(work_order_id)` |
| `work_order_items` (E3-T2) | B, `work_order_id`, `kind`, `origin`, `service_id` (null), `description`, `quantity integer not null default 1`, `unit_price_clp integer not null`, `estimated_minutes integer not null default 0`, V, CB | CHECK `kind in ('servicio', 'repuesto')`, `origin in ('inicial', 'adicional')`, `quantity > 0`, `unit_price_clp >= 0 and estimated_minutes >= 0` |
| `order_photos` (E3-T3) | B, `work_order_id`, `stage`, `retention_class`, `full_key`, `thumb_key` (únicos), `width`, `height`, `full_purged_at`, V, CB | CHECK `stage in ('recepcion', 'reparacion', 'terminado')`, `(stage = 'recepcion' and retention_class = 'recepcion_6m') or (stage <> 'recepcion' and retention_class = 'permanente')`; índices `(work_order_id, stage)`, `(retention_class, created_at)` |
| `order_signatures` (E3-T4) | B, `work_order_id`, `kind`, `storage_key` (único), `signed_by_name`, `signed_at`, CB | único `(work_order_id, kind)`; CHECK `kind in ('recepcion', 'entrega')` |
| `work_orders` (lee/escribe) | `observations`, `requested_service`, `total_clp`, `estimated_minutes`, `estimated_delivery_date`, `delivery_date_confirmed_at`, `status`, `received_at`, `assigned_mechanic_id`, `diagnosis`, `notes`, `tax_doc_*` | CHECK de saldo y control ya existen |

## Contracts

**Consumed:** `SessionUser`, `requireAdmin`, `loginRedirect`, `SESSION_COOKIE` · `can`, `forbiddenResponse` · `recordAudit` · `rules.ts` · `formatOrderNumber`, `recordStatusChange`, `getOrderHeader` · `priceFor` · `getStorage`, `createLocalStorage` · `processPhoto`, `InvalidImageError` · `calendarClosure`, `localToday`, `addDays` · `isAllowedOrigin`, `jsonResponse`, `errorResponse` · `getSiteEnv` · `searchTaller`.

**Produced:**

| Export | Signature | Used by |
|---|---|---|
| `items.ts` → `recomputeOrderTotals`, `addCatalogItem`, `voidItem` (E3-T2), `addPartItem`, `overrideItemPrice` (E3-T8), `listItems` | `recomputeOrderTotals(db, orderId, now)`; `addCatalogItem(db, actor, orderId, { serviceId, quantity, origin }, now)`; `voidItem(db, actor, itemId, now)` | 04, 05 |
| `delivery-date.ts` → `suggestDeliveryDate`, `loadByDate`, `confirmDeliveryDate` | `suggestDeliveryDate({ now: Date; orderMinutes: number; loadByDate: ReadonlyMap<string, number>; capacityMinutes?: number; isBusinessDay?: (date: string) => boolean; horizonDays?: number }): string` | 05 |
| `photos.ts` → `uploadOrderPhoto`, `handlePhotoUpload`, `listOrderPhotos`, `handleMediaRequest`, `photoKeys` | `handleMediaRequest(db, storage, actor, key): Promise<Response>` | 04, 05 |
| `reception.ts` → `decodeSignature`, `uploadSignature`, `insertSignatureRow`, `receptionReadiness`, `finalizeReception` | `decodeSignature(dataUrl: string): Buffer \| null` | 04 |
| `status.ts` → `canAccessOrder`, `orderDetail`, `listOrders`, `changeOrderStatus`, `assignMechanic`, `takeOrder`, `updateOrderNotes`, `listMechanics` | `canAccessOrder(user, { assignedMechanicId, status }): boolean` | 04, 05 |
| `label.ts` → `qrPayload`, `renderLabelHtml`, `buildLabel`, `escapeHtml` | `buildLabel(db, actor, orderId, siteUrl, deps?: { toSvg?: (text: string) => Promise<string> })` | — |
| `PhotoCapture.tsx` | props `{ uploadUrl: string; stage: "recepcion" \| "reparacion" \| "terminado"; label?: string }` | 04 |
| `SignaturePad.tsx` | props `{ name: string; label: string }` | 04 |

## Conventions that bite in this area

- **La recepción la hace cualquier rol (decisión 5).** Las acciones de recepción exigen `reception.perform` y acceso a la orden; el mecánico tiene acceso a las órdenes que creó (nacen asignadas a él) y a las sin asignar en `reservada`, `recibida` o `diagnostico`.
- Nada de E/S de almacenamiento dentro de una transacción: subir → fila; si la fila falla, borrar el objeto.
- Totales recalculados desde filas no anuladas en la misma transacción.
- Claves de almacenamiento armadas por el servidor con `randomUUID()`: `orders/<orderId>/<photoId>-full.jpg`, `-thumb.jpg`, `orders/<orderId>/signature-<recepcion|entrega>-<id>.png`.
- Tablet: opciones como `label` + `input type=radio` dentro de `fieldset`/`legend`; botones ≥ 48px; specs con `.tap()`.
- Las islas no importan `src/server/**`.

Full project rules: `CLAUDE.md`. Area rules: `.claude/rules/database.md`, `server-api.md`, `taller-ui.md`, `taller-domain.md`, `e2e.md`.

---

## Tasks

### `E3-T1` — F1-17 Add intake checklist and accessories

**Depends on:** `E2-T8` · **Priority:** p0

1. `schema-orders.ts`: `intakeChecks`, `intakeAccessories`; generate → migrate.
2. `src/server/taller/intake.ts`: `checklistFormSchema` (7 claves × `ok|revisar|malo` + nota ≤ 300, `observaciones` ≤ 2000, `servicio_solicitado` 3–500); `saveChecklist(db, actor, orderId, input, now)` (`reception.perform` + acceso; orden en `reservada` o `recibida`; upsert con `onConflictDoUpdate`; actualiza `observations` y `requested_service`); `listIntakeChecks`, `isChecklistComplete(db, orderId)`, `addAccessory`, `voidAccessory` (V), `listAccessories`.
3. `recepcion.astro`: "Checklist" con un `fieldset` por punto (`legend`: Frenos, Cadena, Transmisión, Ruedas, Neumáticos, Estado general, Problemas visibles), opciones OK/Revisar/Malo, nota opcional; "Observaciones"; "Guardar checklist" (POST `accion=checklist` → 303 `?hecho=checklist`); `role="status"`: `Checklist completo` o `Faltan N puntos`. "Accesorios": lista, campo "Accesorio", "Agregar accesorio", "Quitar".
4. `tests/integration/intake.test.ts`: criterios 1–4.
5. `e2e/recepcion-checklist.spec.ts` (**como mecánico**): `login(page, "mechanic")` → `/taller/recepcion/nueva?q=Cliente Taller` → elegir "Cliente Taller E2E" → bici "Specialized Rockhopper" → "Servicio solicitado" `Revisión general` → "Crear orden" → en cada `getByRole("group", { name: <punto> })` tap "OK" → tap "Guardar checklist" → `Checklist completo`.

**Files**
- `src/server/db/schema-orders.ts` — edit
- `src/server/taller/intake.ts` — new
- `src/pages/taller/ordenes/[id]/recepcion.astro` — edit
- `tests/integration/intake.test.ts` — new
- `e2e/recepcion-checklist.spec.ts` — new

**Acceptance**

1. **WHEN** se guardan los siete puntos del checklist (`frenos`, `cadena`, `transmision`, `ruedas`, `neumaticos`, `estado_general`, `problemas_visibles`) con resultado `ok`, `revisar` o `malo` **THE SYSTEM SHALL** guardar una fila por punto en `intake_checks` y `isChecklistComplete` SHALL devolver `true`
2. **WHEN** se vuelve a guardar un punto **THE SYSTEM SHALL** actualizar su fila sin duplicarla
3. **WHEN** se agrega un accesorio y luego se quita **THE SYSTEM SHALL** conservar la fila con `voided_at` y `voided_by` y dejar de listarlo
4. **WHEN** se guardan las observaciones **THE SYSTEM SHALL** dejarlas en `work_orders.observations`
5. **WHEN** el mecánico inicia una recepción sin reserva para el cliente sembrado y toca `OK` en los siete puntos y `Guardar checklist` en el viewport de tablet **THE SYSTEM SHALL** mostrar `Checklist completo`

**Verify**

```bash
pnpm test tests/integration/intake.test.ts   # expect: exit 0, 0 failed
pnpm db:migrate   # expect: exit 0
pnpm db:check   # expect: exit 0
pnpm build && pnpm test:tablet e2e/recepcion-checklist.spec.ts e2e/recepcion-inicio.spec.ts   # expect: exit 0, 0 failed
pnpm format && pnpm gate   # expect: exit 0
```

**Prueba en tablet real (manual — no es compuerta de máquina; no va en `tasks.json`):** el mecánico completa el checklist con el dedo en la tablet real, sin zoom. Lo marca el dueño.

**Checkpoint**

```bash
git add -A && git commit -m "feat: f1-17 add intake checklist and accessories" && git tag f1-17
git tag -l f1-17 | grep -qx f1-17   # expect: exit 0
```

### `E3-T2` — F1-18 Add order lines, totals and delivery date

**Depends on:** `E3-T1` · **Priority:** p0

1. `schema-orders.ts`: `workOrderItems`; generate → migrate.
2. `src/server/taller/items.ts`: `recomputeOrderTotals(db, orderId, now)` (sumas de líneas sin `voided_at` → `total_clp`, `estimated_minutes`); `addCatalogItem(db, actor, orderId, { serviceId, quantity, origin = "inicial" }, now)`: `items.add_catalog` + acceso; precio = `priceFor(serviceId, bike.bike_type)` (nulo → `no_price`); minutos del servicio; transacción: insert + recompute + `recordAudit("item.added")`. `voidItem(db, actor, itemId, now)`: `items.void` (owner, admin) o `forbidden`; marca `voided_at`/`voided_by`, recalcula y audita `item.voided`. `listItems`. E3-T8 agrega `addPartItem`, `overrideItemPrice` y la pantalla de líneas.
3. `src/server/taller/delivery-date.ts`: `suggestDeliveryDate({ now, orderMinutes, loadByDate, capacityMinutes = WORKSHOP_MINUTES_PER_DAY, isBusinessDay = (d) => calendarClosure(d, []) === null, horizonDays = 60 })` — **pura**: candidatos desde `addDays(localToday(now), 1)`; primer día hábil con `load + orderMinutes <= capacity`, o con `load === 0` si `orderMinutes > capacity`; si ninguno, el último revisado. `loadByDate(db, branchId, from, to, excludeOrderId)` (órdenes fuera de `LOAD_EXCLUDED_STATUSES`). `confirmDeliveryDate(db, actor, orderId, date, now)` (`reception.perform` + acceso; fecha ≥ hoy local; guarda ambos campos; audit `order.delivery_date_confirmed`).
4. `recepcion.astro`: "Servicios" (`select` "Servicio del catálogo" con precio, "Agregar servicio", líneas con `formatClp`, "Total"); "Fecha de entrega" ("Sugerida: <fecha>", `input type=date` "Fecha de entrega", "Confirmar fecha" → `Fecha confirmada: <fecha>`).
5. `tests/integration/items.test.ts`: criterios 1–3 y 6 (el 2 agrega dos líneas, anula una con `voidItem` y compara con la suma desde las filas), la tabla del criterio 4 con `isBusinessDay: () => true` y el caso real del 5.

**Files**
- `src/server/db/schema-orders.ts` — edit
- `src/server/taller/items.ts` — new
- `src/server/taller/delivery-date.ts` — new
- `src/pages/taller/ordenes/[id]/recepcion.astro` — edit
- `tests/integration/items.test.ts` — new

**Acceptance**

1. **WHEN** se agrega desde el catálogo un servicio a una orden de una bicicleta tipo `mtb` **THE SYSTEM SHALL** crear una línea `servicio` de origen `inicial` con el precio de `service_prices` para `mtb` y la duración estimada del servicio
2. **WHEN** se agregan o anulan líneas **THE SYSTEM SHALL** dejar `total_clp` y `estimated_minutes` iguales a la suma recalculada desde las filas no anuladas
3. **WHEN** el servicio no tiene precio para el tipo de la bicicleta **THE SYSTEM SHALL** devolver `{ ok: false, code: "no_price" }` sin insertar
4. **WHEN** `suggestDeliveryDate` corre con `now` `2026-10-05T15:00:00.000Z` y todos los días hábiles **THE SYSTEM SHALL** devolver `2026-10-06` sin carga, `2026-10-07` con 300 minutos el 06 y una orden de 90, `2026-10-06` con 270 minutos el 06 y una orden de 90, y `2026-10-07` para una orden de 400 minutos con 30 minutos el 06
5. **WHEN** `suggestDeliveryDate` corre con el calendario real y `now` `2026-10-10T15:00:00.000Z` sin carga **THE SYSTEM SHALL** saltar el domingo 11 y el feriado del 12 y devolver `2026-10-13`
6. **WHEN** la persona confirma una fecha **THE SYSTEM SHALL** guardar `estimated_delivery_date` y `delivery_date_confirmed_at`

**Verify**

```bash
pnpm test tests/integration/items.test.ts   # expect: exit 0, 0 failed
pnpm db:migrate   # expect: exit 0
pnpm db:check   # expect: exit 0
pnpm build && pnpm test:tablet e2e/recepcion-checklist.spec.ts   # expect: exit 0, 0 failed
pnpm format && pnpm gate   # expect: exit 0
```

**Prueba en tablet real (manual — no es compuerta de máquina):** agregar un servicio y confirmar la fecha sugerida con el dedo. Lo marca el dueño.

**Checkpoint**

```bash
git add -A && git commit -m "feat: f1-18 add order lines, totals and suggested delivery date" && git tag f1-18
git tag -l f1-18 | grep -qx f1-18   # expect: exit 0
```

### `E3-T3` — F1-19 Add photo upload and authenticated media route

**Depends on:** `E3-T2`, `E1-T8` · **Priority:** p0

Seis archivos: el sexto es una sola línea agregada a `scripts/smoke.sh`, dentro de la regla de `blueprint.md` §9.

1. `schema-orders.ts`: `orderPhotos`; generate → migrate.
2. `src/server/taller/photos.ts`: `MAX_PHOTO_BYTES = 15 * 1024 * 1024`; estados por etapa (`recepcion`: reservada, recibida · `reparacion`: diagnostico, esperando_aprobacion, esperando_repuesto, en_reparacion, control_calidad · `terminado`: control_calidad, lista_para_retirar); `photoKeys`; `uploadOrderPhoto(db, storage, actor, { orderId, stage, bytes }, now)`: permiso (`recepcion` → `reception.perform`; otras → `photos.upload`) + acceso (mecánico: asignada a él o, para `recepcion`, sin asignar en `reservada`/`recibida`), orden de la sucursal (`not_found`), estado (`invalid_status`), `processPhoto` (`invalid_image`), `put` de copia y miniatura, transacción con la fila; si la fila falla, borrar ambos objetos y relanzar. `handlePhotoUpload(request, { db, storage, actor, orderId, now })`: sin actor 401 (primera comprobación, antes de Origin y del id); `!isAllowedOrigin` 403; `content-length` > 16 MiB 413; `formData` (`foto`, `etapa`) con zod (422); > 15 MiB 413 `too_large`; no `image/*` 415; dominio → 403/404/409/415; éxito 201 `{ id, thumbUrl: "/taller/media/<thumb_key>" }`. `listOrderPhotos(db, actor, orderId)` por etapa, sin anuladas, con `thumbUrl` y `fullUrl` (nulo si purgada). `handleMediaRequest(db, storage, actor, key)`: sin actor 401; clave que no calza `orders/<uuid>/<uuid>-(full|thumb).jpg` → 404; fila no anulada (full purgada → 404); acceso; `get` nulo → 404; 200 `image/jpeg`, `cache-control: private, max-age=300`, `nosniff`.
3. `src/pages/taller/ordenes/[id]/fotos.ts`: `POST` que arma `{ db: getDb(), storage: await getStorage(), actor: await requireAdmin(…), orderId: params.id ?? "", now: new Date() }` y llama `handlePhotoUpload`; `prerender = false`. Sin cookie de sesión `requireAdmin` devuelve `null` y la respuesta es 401 (nunca un 303: es un endpoint, no una página).
4. `src/pages/taller/media/[...key].ts`: `GET` análogo con `handleMediaRequest`.
5. `tests/integration/photos.test.ts`: `createLocalStorage(mkdtempSync(…))`; `Request` con `FormData` y `origin: https://vectorbikes.cl`; JPEG generado con sharp; > 15 MB con `Buffer.alloc(15 * 1024 * 1024 + 1)` como `image/jpeg`; `text/plain`; limpieza con un `db` que delega en PGlite pero cuyo `transaction` rechaza (directorio vacío después); mecánico no asignado, etapa `reparacion` → 403.
6. `scripts/smoke.sh`: tras la línea de `/api/tareas/recordatorios`, en el mismo estilo `curl`:
   ```sh
   test "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/taller/ordenes/x/fotos")" = 401
   ```

**Files**
- `src/server/db/schema-orders.ts` — edit
- `src/server/taller/photos.ts` — new
- `src/pages/taller/ordenes/[id]/fotos.ts` — new
- `src/pages/taller/media/[...key].ts` — new
- `tests/integration/photos.test.ts` — new
- `scripts/smoke.sh` — edit (una línea)

**Acceptance**

1. **WHEN** `handlePhotoUpload` recibe un `multipart/form-data` con un JPEG y `etapa=recepcion` de un usuario con permiso **THE SYSTEM SHALL** guardar la copia completa y la miniatura en el almacenamiento, insertar una fila en `order_photos` con `retention_class = 'recepcion_6m'` y responder 201 con `{ id, thumbUrl }`, y con `etapa=terminado` SHALL guardar `retention_class = 'permanente'`
2. **WHEN** el archivo supera 15 MB o no es una imagen **THE SYSTEM SHALL** responder 413 o 415 respectivamente, sin filas ni objetos nuevos
3. **WHEN** la inserción de la fila falla después de subir los objetos **THE SYSTEM SHALL** borrar ambos objetos del almacenamiento
4. **WHEN** `handleMediaRequest` recibe la clave de la miniatura de una orden accesible **THE SYSTEM SHALL** responder 200 con `content-type: image/jpeg` y `cache-control: private, max-age=300`, y 404 para una clave inexistente o con forma inválida
5. **WHEN** un mecánico sube una foto de etapa `reparacion` a una orden que no tiene asignada **THE SYSTEM SHALL** responder 403
6. **WHEN** `sh scripts/smoke.sh` corre contra el build **THE SYSTEM SHALL** obtener 401 de `POST /taller/ordenes/x/fotos` sin sesión

**Verify**

```bash
pnpm test tests/integration/photos.test.ts   # expect: exit 0, 0 failed
pnpm db:migrate   # expect: exit 0
pnpm db:check   # expect: exit 0
pnpm build && sh scripts/smoke.sh   # expect: exit 0 — incluye 401 de POST /taller/ordenes/x/fotos sin sesión
pnpm format && pnpm gate   # expect: exit 0
```

**Checkpoint**

```bash
git add -A && git commit -m "feat: f1-19 add photo upload and authenticated media route" && git tag f1-19
git tag -l f1-19 | grep -qx f1-19   # expect: exit 0
```

### `E3-T4` — F1-20 Add reception signature and finalization

**Depends on:** `E3-T3` · **Priority:** p0

1. `schema-orders.ts`: `orderSignatures`; generate → migrate.
2. `src/server/taller/reception.ts`: `MAX_SIGNATURE_BYTES = 2 * 1024 * 1024`; `decodeSignature(dataUrl)` (prefijo `data:image/png;base64,`, base64 válido, ≤ 2 MB, firma PNG `89 50 4E 47 0D 0A 1A 0A`; si no, `null`); `uploadSignature(storage, orderId, kind, bytes)` → `orders/<orderId>/signature-<kind>-<uuid>.png`; `insertSignatureRow`; `receptionReadiness(db, orderId)`; `finalizeReception(db, storage, actor, { orderId, signatureDataUrl, signedByName }, now)`: `reception.perform` + acceso; `reservada` (si no `invalid_status`); `missing` en orden `["checklist", "fotos", "fecha", "firma"]` (firma = cadena vacía) → `incomplete`; firma no vacía e inválida → `invalid_signature` sin subir; ya firmada → `already_signed`; subir; transacción: fila de firma, `recibida`, `received_at`, `recordStatusChange`, `recordAudit("order.status_changed")`; si falla, borrar el objeto y relanzar. Nombre 2–80.
3. `photos.ts`: `handleMediaRequest` también sirve `orders/<uuid>/signature-(recepcion|entrega)-<uuid>.png` (`order_signatures`, `image/png`).
4. `tests/integration/reception.test.ts`: criterios 1–6 (PNG válido = `sharp({ create: { width: 10, height: 10, channels: 4, background: "#000000" } }).png().toBuffer()` en base64).

**Files**
- `src/server/db/schema-orders.ts` — edit
- `src/server/taller/reception.ts` — new
- `src/server/taller/photos.ts` — edit
- `tests/integration/reception.test.ts` — new

**Acceptance**

1. **WHEN** `finalizeReception` corre sin checklist completo, sin fotos de recepción, sin fecha confirmada o sin firma **THE SYSTEM SHALL** devolver `{ ok: false, code: "incomplete", missing }` nombrando cada faltante con `checklist`, `fotos`, `fecha` o `firma` y dejar la orden en `reservada`
2. **WHEN** corre con todo completo y una firma PNG válida **THE SYSTEM SHALL** guardar la firma en el almacenamiento, insertar `order_signatures` tipo `recepcion` con el nombre de quien firma, pasar la orden a `recibida` con `received_at` y escribir historial y auditoría
3. **WHEN** la firma no es un `data:image/png;base64,` válido o supera 2 MB **THE SYSTEM SHALL** devolver `{ ok: false, code: "invalid_signature" }` sin subir nada
4. **WHEN** la transacción falla después de subir la firma **THE SYSTEM SHALL** borrar el objeto subido
5. **WHEN** la orden ya tiene firma de recepción **THE SYSTEM SHALL** devolver `{ ok: false, code: "already_signed" }`
6. **WHEN** `handleMediaRequest` recibe la clave de una firma de una orden accesible **THE SYSTEM SHALL** responder 200 con `content-type: image/png`

**Verify**

```bash
pnpm test tests/integration/reception.test.ts tests/integration/photos.test.ts   # expect: exit 0, 0 failed
pnpm db:migrate   # expect: exit 0
pnpm db:check   # expect: exit 0
pnpm format && pnpm gate   # expect: exit 0
```

**Checkpoint**

```bash
git add -A && git commit -m "feat: f1-20 add reception signature and finalization" && git tag f1-20
git tag -l f1-20 | grep -qx f1-20   # expect: exit 0
```

### `E3-T5` — F1-21 Complete reception on tablet: photos, signature

**Depends on:** `E3-T4` · **Priority:** p0

1. `PhotoCapture.tsx`: `<label class="btn tap">{label ?? "Tomar foto"}<input type="file" accept="image/*" capture="environment" multiple hidden /></label>`, `<progress>` y `<p role="status" aria-live="polite">`; sube de a uno con `XMLHttpRequest` (`foto`, `etapa`; `upload.onprogress`); rechaza > 15 MB en el cliente; mensajes 413 "La foto pesa más de 15 MB", 415 "Ese archivo no es una foto", otros "No se pudo subir la foto. Intenta de nuevo."; al terminar, `window.location.reload()`.
2. `SignaturePad.tsx`: `fieldset`/`legend` = `label`, `canvas` (240px de alto, 100 % de ancho), `<input type="hidden" name={name}>` por ref y botón "Borrar"; `useEffect`: `new SignaturePad(canvas)`, escala por `devicePixelRatio` al montar y en `resize` (limpia); `endStroke` → `input.value = pad.isEmpty() ? "" : pad.toDataURL("image/png")`; "Borrar" → `pad.clear()` y `""`; limpieza con `pad.off()`.
3. `cierre.astro` (`reception.perform` + acceso): cabecera; preparación (Checklist, Fotos de recepción (n), Fecha de entrega, Firma del cliente); miniaturas `<img src={thumbUrl} alt="Foto de recepción N">`; `<PhotoCapture client:load uploadUrl={`/taller/ordenes/${id}/fotos`} stage="recepcion" />`; formulario con `<SignaturePad client:load name="firma" label="Firma del cliente" />`, "Nombre de quien firma" y "Finalizar recepción". POST: Origin → `finalizeReception` → 303 `/taller/ordenes/<id>/recepcion?hecho=recibida`; `incomplete` → 422 con `role="alert"` (Falta completar el checklist · Falta al menos una foto de recepción · Falta confirmar la fecha de entrega · Falta la firma del cliente); `invalid_signature` "La firma no es válida; vuelve a firmar.".
4. `recepcion.astro`: "Continuar a fotos y firma" → `cierre`; con `recibida`, `Recepción finalizada` y estado `Recibida`.
5. `e2e/recepcion-completa.spec.ts`: dueño → reservas → "Recibir" en "Pedro Reserva" → "Ruta" → "Crear orden" → 7 × "OK" + "Guardar checklist" → `selectOption` "Ajuste de frenos" + "Agregar servicio" → "Confirmar fecha" → "Continuar a fotos y firma" → `getByLabel("Tomar foto").setInputFiles` con 4 JPEG generados con sharp → 4 `img` con `src` que empieza con `/taller/media/` → "Finalizar recepción" sin firma → `Falta la firma del cliente` y `Reservada` → dibujar en el `canvas` (`page.mouse` sobre `boundingBox()`), "Borrar" → `input[name="firma"]` vacío → dibujar → "Finalizar recepción" → `Recibida`.

**Files**
- `src/components/taller/PhotoCapture.tsx` — new
- `src/components/taller/SignaturePad.tsx` — new
- `src/pages/taller/ordenes/[id]/cierre.astro` — new
- `src/pages/taller/ordenes/[id]/recepcion.astro` — edit
- `e2e/recepcion-completa.spec.ts` — new

**Acceptance**

1. **WHEN** el dueño hace en el viewport de tablet una recepción completa desde la reserva de `Pedro Reserva` (checklist con toques, servicio, fecha confirmada, cuatro fotos y firma dibujada) **THE SYSTEM SHALL** mostrar el estado `Recibida`
2. **WHEN** se suben las cuatro fotos **THE SYSTEM SHALL** mostrar cuatro miniaturas servidas desde `/taller/media/`
3. **WHEN** se toca `Finalizar recepción` sin firma **THE SYSTEM SHALL** mostrar `Falta la firma del cliente` y mantener el estado `Reservada`
4. **WHEN** se toca `Borrar` en el panel de firma **THE SYSTEM SHALL** dejar vacío el campo oculto `firma`

**Verify**

```bash
pnpm build && pnpm test:tablet e2e/recepcion-completa.spec.ts e2e/recepcion-checklist.spec.ts e2e/recepcion-inicio.spec.ts   # expect: exit 0, 0 failed
pnpm format && pnpm gate   # expect: exit 0
```

**Prueba en tablet real (manual — no es compuerta de máquina):** recepción completa en la tablet del taller con cuatro fotos de la cámara trasera y una firma con el dedo (FASE1 §14.3). Lo marca el dueño.

**Checkpoint**

```bash
git add -A && git commit -m "feat: f1-21 complete reception on tablet with photos and signature" && git tag f1-21
git tag -l f1-21 | grep -qx f1-21   # expect: exit 0
```

### `E3-T6` — F1-22 Add order detail, status changes and assignment

**Depends on:** `E3-T5` · **Priority:** p0

1. `src/server/taller/status.ts`: `canAccessOrder(user, order)` (no mecánico → `true`; mecánico → asignada a él, o sin asignar en `reservada`, `recibida` o `diagnostico`); `orderDetail(db, actor, id)` (`not_found`/`forbidden`; contacto solo con `customers.manage`; historial con autor; `warrantyOfNumber`); `listOrders(db, actor, { scope })`; `changeOrderStatus(db, actor, id, to, note, now)` (`isManualTransition` o `invalid_transition`; `cancelada`/`trabajo_rechazado` exigen `orders.cancel`; el resto `orders.edit` + acceso; transacción con `recordStatusChange` y `recordAudit("order.status_changed")`); `assignMechanic` (`orders.assign`; audit `order.assigned`); `takeOrder` (solo mecánico; sin asignar en recibida/diagnostico; audit `order.assigned`); `updateOrderNotes` (audit `order.updated`); `listMechanics`.
2. `ordenes/index.astro`: tabla densa de órdenes abiertas; vacío "No hay órdenes abiertas.".
3. `ordenes/[id]/index.astro`: `h1` con el número; estado; cliente y bici; navegación a `recepcion`, `cierre`, `lineas`, `galeria`, `adicional`, `control`, `entrega`, `componentes`, `informe`, `etiqueta` (las de pasos posteriores responden 404 hasta su paso); un botón "Pasar a <etiqueta>" por destino manual permitido; asignación o "Tomar orden"; "Diagnóstico", "Observaciones", "Notas"; historial. `forbidden` → `forbiddenResponse()`.
4. `tests/integration/order-status.test.ts`: criterios 1–5.
5. `e2e/orden-mecanico.spec.ts`: `login(page, "mechanic")` → `/taller/ordenes/${SEED.orderRecibidaId}` → tap "Pasar a Diagnóstico" → `Diagnóstico`.

**Files**
- `src/server/taller/status.ts` — new
- `src/pages/taller/ordenes/index.astro` — new
- `src/pages/taller/ordenes/[id]/index.astro` — new
- `tests/integration/order-status.test.ts` — new
- `e2e/orden-mecanico.spec.ts` — new

**Acceptance**

1. **WHEN** `changeOrderStatus` pide una transición que no está en `MANUAL_TRANSITIONS`, como `recibida` → `lista_para_retirar` **THE SYSTEM SHALL** devolver `{ ok: false, code: "invalid_transition" }` sin cambiar la orden
2. **WHEN** una transición manual válida se aplica **THE SYSTEM SHALL** escribir una fila en `work_order_status_history` con `from_status`, `to_status`, autor y nota, y una fila `order.status_changed` en `audit_log`
3. **WHEN** un mecánico abre una orden asignada a otro mecánico **THE SYSTEM SHALL** devolver `{ ok: false, code: "forbidden" }`
4. **WHEN** un mecánico toma una orden sin asignar en `recibida` o `diagnostico` **THE SYSTEM SHALL** asignársela y escribir `order.assigned` en `audit_log`
5. **WHEN** `listOrders` corre para un mecánico **THE SYSTEM SHALL** devolver solo sus órdenes asignadas y las sin asignar en `reservada`, `recibida` o `diagnostico`
6. **WHEN** el mecánico toca `Pasar a Diagnóstico` en la orden sembrada `OT-00001` en el viewport de tablet **THE SYSTEM SHALL** mostrar el estado `Diagnóstico`

**Verify**

```bash
pnpm test tests/integration/order-status.test.ts   # expect: exit 0, 0 failed
pnpm build && pnpm test:tablet e2e/orden-mecanico.spec.ts   # expect: exit 0, 0 failed
pnpm format && pnpm gate   # expect: exit 0
```

**Checkpoint**

```bash
git add -A && git commit -m "feat: f1-22 add order detail, status changes and assignment" && git tag f1-22
git tag -l f1-22 | grep -qx f1-22   # expect: exit 0
```

### `E3-T7` — F1-23 Add printable QR label and order number search

**Depends on:** `E3-T6` · **Priority:** p1

**Verificado el 2026-10-05 por el hilo principal:** `qrcode` 1.5.4 con `import QRCode from "qrcode"` funciona y `QRCode.toString(text, { type: "svg" })` empieza con `<svg`.

1. `src/server/taller/label.ts`: `qrPayload(siteUrl, orderId)` = URL sin `/` final + `/taller/ordenes/<id>`; `escapeHtml` (`& < > " '`); `renderLabelHtml({ number, customerName, estimatedDate, qrUrl, svg }, widthMm = LABEL_WIDTH_MM)` → documento HTML (`lang="es-CL"`, `<style>@page { size: ${widthMm}mm auto; margin: 0; } …</style>`, número en mono, nombre escapado, "Entrega estimada: <dd-MM-yyyy o 'sin fecha'>", `<div class="qr" data-qr-url="<qrUrl escapada>">` + svg, botón "Imprimir" con `onclick="window.print()"` oculto al imprimir); `buildLabel(db, actor, orderId, siteUrl, deps = {})` con `canAccessOrder` y `deps.toSvg ?? ((text) => QRCode.toString(text, { type: "svg", margin: 1, errorCorrectionLevel: "M" }))`.
2. `ordenes/[id]/etiqueta.ts`: `GET` → sin sesión 303 `loginRedirect`; `buildLabel(…, getSiteEnv().PUBLIC_SITE_URL)` → `text/html; charset=utf-8`, `no-store`; `forbidden` → `forbiddenResponse()`.
3. `search.ts`: antes de RUT/teléfono, `/^(?:ot-?)?0*(\d{1,6})$/i` → orden por (`branch_id`, `number`) filtrada con `canAccessOrder`.
4. `tests/integration/label.test.ts`: criterios 1–4 (`toSvg` falso que guarda el texto; cliente `<b>Ana</b>`).
5. `e2e/etiqueta.spec.ts`: dueño → `/taller/ordenes/${SEED.orderRecibidaId}/etiqueta` → `OT-00001` y `svg` visible → `page.goto(<data-qr-url>)` → heading con `OT-00001`.

**Files**
- `src/server/taller/label.ts` — new
- `src/pages/taller/ordenes/[id]/etiqueta.ts` — new
- `src/server/taller/search.ts` — edit
- `tests/integration/label.test.ts` — new
- `e2e/etiqueta.spec.ts` — new

**Acceptance**

1. **WHEN** `qrPayload` recibe `https://vectorbikes.cl` y el id de una orden **THE SYSTEM SHALL** devolver `https://vectorbikes.cl/taller/ordenes/<id>`, y `buildLabel` SHALL pasar exactamente ese texto al generador de QR inyectado
2. **WHEN** se genera la etiqueta de una orden **THE SYSTEM SHALL** devolver HTML con el número `OT-`, el nombre del cliente, la fecha estimada, un `<svg`, `size: 62mm` y el atributo `data-qr-url` con la URL codificada
3. **WHEN** el nombre del cliente contiene `<b>` **THE SYSTEM SHALL** escaparlo como `&lt;b&gt;`
4. **WHEN** `searchTaller` recibe `OT-00001`, `ot1` o `1` **THE SYSTEM SHALL** devolver la orden número 1 de la sucursal si el usuario puede verla
5. **WHEN** el dueño abre la etiqueta de `OT-00001` y luego la URL de su `data-qr-url` en el viewport de tablet **THE SYSTEM SHALL** mostrar `OT-00001` en ambas

**Verify**

```bash
pnpm test tests/integration/label.test.ts tests/integration/search.test.ts   # expect: exit 0, 0 failed
pnpm build && pnpm test:tablet e2e/etiqueta.spec.ts   # expect: exit 0, 0 failed
pnpm format && pnpm gate   # expect: exit 0
```

**Checkpoint**

```bash
git add -A && git commit -m "feat: f1-23 add printable qr label and order number search" && git tag f1-23
git tag -l f1-23 | grep -qx f1-23   # expect: exit 0
```

### `E3-T8` — F1-24 Add line editing, price override and tax doc

**Depends on:** `E3-T6` · **Priority:** p0

1. `items.ts`: `partItemSchema` (descripción 2–200, cantidad 1–100, precio 0–10.000.000), `priceOverrideSchema`; `addPartItem` (`items.add_part`; línea `repuesto` origen `inicial`; audit `item.added`) y `overrideItemPrice` (`items.override_price`; audit `item.price_changed` con `{ itemId, before, after }`), ambas con `recomputeOrderTotals` en la misma transacción. `voidItem` ya existe desde E3-T2. El mecánico recibe `forbidden` en las nuevas sin tocar filas.
2. `orders.ts`: `taxDocSchema` (tipo `boleta|factura`, folio 1–30, fecha), `updateTaxDocument` (`tax_doc.edit`; audit `order.tax_document`).
3. `ordenes/[id]/lineas.astro`: tabla densa (descripción, cantidad, precio unitario, subtotal, origen, acciones), "Agregar servicio", "Agregar repuesto" (`items.add_part`), "Cambiar precio" (`items.override_price`), "Anular" (`items.void`); "Total para el cliente: $X"; "Documento tributario". POST sin permiso → `forbiddenResponse()`.
4. `tests/integration/order-items.test.ts`: los cinco criterios.

**Files**
- `src/server/taller/items.ts` — edit
- `src/server/taller/orders.ts` — edit
- `src/pages/taller/ordenes/[id]/lineas.astro` — new
- `tests/integration/order-items.test.ts` — new

**Acceptance**

1. **WHEN** un mecánico intenta cambiar el precio de una línea o agregar un repuesto con precio **THE SYSTEM SHALL** devolver `{ ok: false, code: "forbidden" }` sin cambiar ninguna fila
2. **WHEN** el dueño o un administrador cambia el precio de una línea **THE SYSTEM SHALL** guardar el nuevo `unit_price_clp`, recalcular `total_clp` y escribir `item.price_changed` en `audit_log` con `before` y `after`
3. **WHEN** se anula una línea **THE SYSTEM SHALL** conservar la fila con `voided_at` y `voided_by` y excluirla de `total_clp`
4. **WHEN** se agrega un repuesto con descripción, cantidad y precio **THE SYSTEM SHALL** crear una línea `repuesto` y sumar su subtotal al total
5. **WHEN** se guardan tipo, folio y fecha del documento tributario **THE SYSTEM SHALL** dejarlos en `tax_doc_type`, `tax_doc_number` y `tax_doc_date` y escribir `order.tax_document` en `audit_log`

**Verify**

```bash
pnpm test tests/integration/order-items.test.ts tests/integration/items.test.ts   # expect: exit 0, 0 failed
pnpm format && pnpm gate   # expect: exit 0
```

**Checkpoint**

```bash
git add -A && git commit -m "feat: f1-24 add line editing, price override and tax document" && git tag f1-24
git tag -l f1-24 | grep -qx f1-24   # expect: exit 0
```

---

## Epic acceptance

1. **WHEN** el dueño hace una recepción completa en el viewport de tablet **THE SYSTEM SHALL** terminar en `Recibida` con cuatro fotos y firma (FASE1 §14.3; `e2e/recepcion-completa.spec.ts`).
2. **WHEN** un mecánico intenta cambiar un precio **THE SYSTEM SHALL** responder `forbidden` sin cambiar filas (`order-items.test.ts`).

```bash
pnpm test tests/integration/reception.test.ts tests/integration/order-items.test.ts   # expect: exit 0
pnpm build && pnpm test:tablet e2e/recepcion-completa.spec.ts e2e/etiqueta.spec.ts   # expect: exit 0
pnpm format && pnpm gate   # expect: exit 0
```

## Pitfalls

- **Subir dentro de la transacción** — subir antes y limpiar si falla.
- **Bloquear al mecánico en la recepción** — `reception.perform` lo incluye; el acceso a la orden lo da que nació asignada a él.
- **`recepcion.astro` > 400 líneas** — el cierre vive en `cierre.astro`; la lógica de los POST va al dominio.
- **`hidden` en el input de archivo** — `setInputFiles` funciona igual y el `label` abre la cámara.
- **QR con `set:html`** — prohibido; la etiqueta es un endpoint `.ts` que escapa todo lo del usuario.
- **Revisar Origin o el id antes de la sesión en `fotos.ts`** — el smoke espera 401 sin sesión; la sesión es la primera comprobación.

## Before moving on

- [ ] Every task in this epic is `done` in `tasks.json`.
- [ ] Every `verify` command passed; none edited or skipped.
- [ ] Tags `f1-17` … `f1-24` existen.
- [ ] Gate passes from the project root.
- [ ] Every "Produced" contract exists with the stated signature.
- [ ] No file outside the subtree was modified.
- [ ] Esta épica no agrega variables de entorno.
- [ ] One commit per task, each followed by its checkpoint tag.
