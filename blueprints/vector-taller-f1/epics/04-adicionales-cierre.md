# Epic 04: Adicionales, garantía y cierre

> Después de esta épica la orden tiene galería por etapa, garantía vinculada, propuestas de adicional con enlace de un solo uso aprobadas por el cliente desde su teléfono, control de calidad del dueño, pagos (un abono + finales) y entrega con saldo cero y firma.

| | |
|---|---|
| **Epic id** | `04-adicionales-cierre` |
| **Tasks** | `E4-T1` … `E4-T6` (pasos F1-25 … F1-30) |
| **Depends on** | `03-recepcion-orden` |
| **Unlocks** | `05-historial-operacion` |
| **Parallel with** | ninguna (comparte `schema-orders.ts`, `approvals.ts`, `entrega.astro`) |

You do not need any other file to complete this epic. Everything below is repeated here on purpose.

---

## Stack

Astro 7 SSR · TypeScript 6 · Preact (islas `PhotoCapture`, `SignaturePad` ya existentes) · Postgres 16 · Drizzle ORM 0.45 · almacenamiento `ObjectStorage` · Playwright (tablet). `pnpm` 12.4.2; Node 24; versiones en `pnpm-lock.yaml`.

| Task | Command |
|---|---|
| Formatear | `pnpm format` |
| Test (un archivo) | `pnpm test tests/integration/<archivo>.test.ts` |
| Migraciones (solo base dev) | `pnpm db:generate` · `pnpm db:migrate` · `pnpm db:check` |
| Tablet | `pnpm build && pnpm test:tablet e2e/<archivo>.spec.ts` |
| Compuerta | `pnpm gate` |

**Gate:** `pnpm format && pnpm gate`. Servicio: Postgres local (`vector_bikes`, `vector_bikes_e2e`, con el rol que fija `.env`). Reversión (la confirma el operador en la sesión supervisada; el allowlist no la impide técnicamente, porque `node -e:*` permite JS arbitrario): `git reset --hard f1-<anterior>` y, si hace falta, el reinicio de la base dev de `blueprint.md` §9 regla 6.

**Cobertura de tablet de E4-T2, E4-T3 y E4-T5:** E4-T2 y E4-T5 son pantallas de escritorio del personal y su lógica está en tests de integración; E4-T3 es la página pública que el cliente abre en su teléfono, cubierta por `approvals.test.ts`. El viewport de tablet cubre E4-T1 (`galeria.spec.ts`), E4-T4 (`control-calidad.spec.ts`) y E4-T6 (`entrega.spec.ts`, que también registra el pago final de E4-T5).

## Directory subtree

```
src/server/db/schema-orders.ts                 # edit: work_order_approvals (+ items.approval_id), qc_checks, payments
src/server/taller/orders.ts                    # edit (E4-T1): openWarrantyOrder
src/server/taller/share-tokens.ts · approvals.ts · qc.ts · payments.ts · delivery.ts   # NEW
src/server/api/handlers.ts                     # edit mínima (E4-T3): export de checkRateLimit y recordAttempt
src/pages/taller/ordenes/[id]/galeria.astro · adicional.astro · control.astro · entrega.astro   # NEW
src/pages/taller/ordenes/[id]/index.astro      # edit (E4-T1)
src/pages/aprobacion/[token].astro             # NEW (E4-T3)
tests/integration/{warranty,approvals,qc,payments,delivery}.test.ts
e2e/{galeria,control-calidad,entrega}.spec.ts
```

## Data model touched here

**B** = `branch_id` not null → branches restrict · **V** = `voided_at` + `voided_by → users` · **CB** = `created_by uuid not null → users`. Cada tabla se agrega a `orderTables`.

| Entity | Campos | Notas |
|---|---|---|
| `work_order_approvals` (E4-T2) | B, `work_order_id`, `description text not null`, `recommendation text not null`, `price_clp integer not null`, `token_hash text not null`, `decided_at`, `decision text`, `decided_ip_hash text`, V, CB | `uq_work_order_approvals_token_hash`; índice `(work_order_id)`; CHECK `price_clp > 0`, `(decided_at is null and decision is null) or (decided_at is not null and decision in ('aprobado', 'rechazado'))` |
| `work_order_items` (E4-T2) | + `approval_id uuid null → work_order_approvals` | columna nueva, aditiva |
| `qc_checks` (E4-T4) | B, `work_order_id`, `item_key`, `result`, `note`, `actor_user_id uuid not null → users`, `self_check boolean not null default false` | CHECK `item_key in ('frenos', 'cambios', 'ruedas', 'apriete', 'neumaticos', 'prueba_de_rodaje', 'limpieza')`, `result in ('ok', 'falla')`; índice `(work_order_id, created_at)` |
| `payments` (E4-T5) | B, `work_order_id`, `kind`, `method`, `amount_clp integer not null`, `received_by uuid not null → users`, `received_at timestamptz not null`, V | **`uq_payments_one_abono (work_order_id) where kind = 'abono' and voided_at is null`**; índices `(work_order_id)`, `(branch_id, received_at)`; CHECK `kind in ('abono', 'final')`, `method in ('transferencia', 'tarjeta', 'efectivo', 'otro')`, `amount_clp > 0` |
| `work_orders` (lee/escribe) | `warranty_of_order_id`, `status`, `total_clp`, `paid_clp`, `qc_approved_at`, `qc_approved_by`, `qc_self_checked`, `delivered_at` | CHECK de saldo cero al entregar y de control antes de `lista_para_retirar` ya existen |
| `order_photos` (escribe, E4-T1) | etapas `reparacion` y `terminado` | `permanente` |
| `order_signatures` (escribe) | tipo `entrega` | única por (orden, tipo) |

## Contracts

**Consumed:** `SessionUser`, `requireAdmin`, `loginRedirect` · `can`, `forbiddenResponse` · `recordAudit` · `rules.ts` (`QC_CHECK_KEYS`, `PAYMENT_*`, `STATUS_LABELS`, `QC_REQUIRE_SECOND_PERSON`) · `formatOrderNumber`, `allocateOrderNumber`, `recordStatusChange` (`orders.ts`) · `recomputeOrderTotals` (`items.ts`) · `canAccessOrder`, `orderDetail` (`status.ts`) · `listOrderPhotos` (`photos.ts`) · `decodeSignature`, `uploadSignature`, `insertSignatureRow` (`reception.ts`) · `getStorage` · `PhotoCapture`, `SignaturePad` · `isAllowedOrigin`, `originForLog`, `hashIp` (`handlers.ts`) · `clientIp` · `getSiteEnv` · `formatClp`.

**Produced:**

| Export | Signature | Used by |
|---|---|---|
| `orders.ts` → `openWarrantyOrder` | `(db, actor, originalId, { reason }, now)` → `{ ok: true, orderId } \| { ok: false, code }` | 05 |
| `share-tokens.ts` → `newShareToken`, `hashShareToken`, `shareTokenSchema` | `() => string` (43 car.); `(token) => string` (sha256 hex) | 05 (informe) |
| `approvals.ts` → `createApproval`, `approvalLink`, `whatsappShareLink`, `regenerateApprovalLink`, `listApprovals`, `viewApproval`, `decideApproval` | `decideApproval(db, token, decision: "aprobado" \| "rechazado", ipHash: string \| null, now)` → `{ ok: true } \| { ok: false, code: "invalid" \| "already_decided" }` | 05 (historial) |
| `qc.ts` → `submitQc`, `qcFormSchema`, `listQcChecks` | `submitQc(db, actor, orderId, input, now)` → `{ ok: true, result: "approved" \| "rejected" } \| { ok: false, code }` | — |
| `payments.ts` → `recordPayment`, `voidPayment`, `recomputePaid`, `listPayments`, `paymentFormSchema` | `recomputePaid(db, orderId, now)` | 05 |
| `delivery.ts` → `completeDelivery` | `(db, storage, actor, { orderId, signatureDataUrl, signedByName }, now)` | — |

## Conventions that bite in this area

- La página pública `/aprobacion/[token]` no chequea `Origin`: el token es la defensa (igual que `/reservas/cancelar`); registra `originForLog`. `noindex`, `no-store`, `referrer-policy: no-referrer`; solo el primer nombre del cliente.
- Tokens: 32 bytes `base64url` (43 caracteres); en base solo sha256 hex (64); un solo uso con `update … where decided_at is null and voided_at is null returning`.
- Saldo cero y control aprobado los garantiza la base; el servidor también los revisa para devolver un código claro.
- Nunca borrar aprobaciones ni pagos: V. El mecánico nunca fija un precio (propuestas solo `approvals.create`).
- Firma de entrega: subir antes de la transacción; si falla, borrar el objeto.

Full project rules: `CLAUDE.md`. Area rules: `.claude/rules/database.md`, `server-api.md`, `taller-ui.md`, `taller-domain.md`, `e2e.md`.

---

## Tasks

### `E4-T1` — F1-25 Add stage photo gallery and linked warranty

**Depends on:** `E3-T8`, `E3-T7` · **Priority:** p1

1. `orders.ts`: `openWarrantyOrder(db, actor, originalId, { reason }, now)` (`warranty.open`; original de la sucursal en `entregada`, si no `not_delivered`; motivo 3–300; transacción: `allocateOrderNumber`, orden en `reservada` con el mismo `customer_id` y `bike_id`, `warranty_of_order_id = originalId`, `requested_service = "Garantía de OT-xxxxx: <motivo>"`, `recordStatusChange(null → reservada)`, `recordAudit("order.warranty_opened", { originalNumber })`).
2. `src/pages/taller/ordenes/[id]/galeria.astro`: fotos agrupadas por etapa (`listOrderPhotos`) con títulos (`h2`) Recepción, Reparación, Trabajo terminado, cada uno en una `section` con `aria-labelledby`; `PhotoCapture` con `stage="reparacion"` (label "Foto de reparación") y `stage="terminado"` (label "Foto de trabajo terminado") cuando el estado lo admite. Las fotos de recepción son `recepcion_6m` y las de terminado `permanente`; el "antes" del informe usa la **miniatura** de recepción, que nunca se purga.
3. `index.astro`: si `orderDetail(...).warrantyOfNumber`, un `span.status` "Garantía de OT-xxxxx"; con la orden `entregada` y `warranty.open`, formulario "Abrir garantía" (campo "Motivo") → 303 a `/taller/ordenes/<nueva>/recepcion`.
4. `tests/integration/warranty.test.ts`: criterios 1–5 (orden entregada preparada con UPDATE que cumpla los CHECK: `qc_approved_at` no nulo y `paid_clp = total_clp`; fotos insertadas directamente en `order_photos`, una anulada).
5. `e2e/galeria.spec.ts`: `login(page, "mechanic")` → `/taller/ordenes/${SEED.orderControlId}/galeria` → `getByLabel("Foto de trabajo terminado").setInputFiles` con un JPEG generado con sharp (`sharp({ create: { width: 64, height: 48, channels: 3, background: "#808080" } }).jpeg().toBuffer()`) → dentro de `getByRole("region", { name: "Trabajo terminado" })` un `img` cuyo `src` empieza con `/taller/media/`. Usa la etapa `terminado` porque `OT-00002` (asignada al mecánico sembrado) la admite tanto en `control_calidad` como en `lista_para_retirar`: si `control-calidad.spec.ts` corre antes y le cambia el estado, este spec sigue pasando.

**Files**
- `src/server/taller/orders.ts` — edit
- `src/pages/taller/ordenes/[id]/galeria.astro` — new
- `src/pages/taller/ordenes/[id]/index.astro` — edit
- `tests/integration/warranty.test.ts` — new
- `e2e/galeria.spec.ts` — new

**Acceptance**

1. **WHEN** `openWarrantyOrder` corre sobre una orden `entregada` **THE SYSTEM SHALL** crear una orden nueva en `reservada` con el mismo cliente y bicicleta y `warranty_of_order_id` apuntando a la original
2. **WHEN** la orden original no está `entregada` **THE SYSTEM SHALL** devolver `{ ok: false, code: "not_delivered" }` sin crear orden
3. **WHEN** se abre una garantía **THE SYSTEM SHALL** escribir `order.warranty_opened` en `audit_log`
4. **WHEN** `orderDetail` lee una orden de garantía **THE SYSTEM SHALL** incluir el número de la orden original para mostrar `Garantía de OT-…`
5. **WHEN** `listOrderPhotos` lee una orden con fotos de las tres etapas **THE SYSTEM SHALL** agruparlas por `recepcion`, `reparacion` y `terminado` sin incluir las anuladas
6. **WHEN** el mecánico sube en el viewport de tablet una foto de trabajo terminado en la orden sembrada `OT-00002` desde su galería **THE SYSTEM SHALL** mostrar su miniatura en la sección `Trabajo terminado`

**Verify**

```bash
pnpm test tests/integration/warranty.test.ts   # expect: exit 0, 0 failed
pnpm build && pnpm test:tablet e2e/galeria.spec.ts   # expect: exit 0, 0 failed
pnpm format && pnpm gate   # expect: exit 0
```

**Prueba en tablet real (manual — no es compuerta de máquina; no va en `tasks.json`):** el mecánico toma una foto de reparación y una de trabajo terminado con la cámara de la tablet y las ve en la galería. Lo marca el dueño.

**Checkpoint**

```bash
git add -A && git commit -m "feat: f1-25 add stage photo gallery and linked warranty orders" && git tag f1-25
git tag -l f1-25 | grep -qx f1-25   # expect: exit 0
```

### `E4-T2` — F1-26 Add additional work proposal with one-use link

**Depends on:** `E4-T1` · **Priority:** p0

1. `schema-orders.ts`: `workOrderApprovals` y `approvalId` en `workOrderItems`; generate (solo `CREATE TABLE` y `ADD COLUMN`) → migrate.
2. `src/server/taller/share-tokens.ts`: `newShareToken()` = `randomBytes(32).toString("base64url")`; `hashShareToken(token)` = sha256 hex; `shareTokenSchema` = `/^[A-Za-z0-9_-]{43}$/`.
3. `src/server/taller/approvals.ts`: `approvalFormSchema` (problema 5–500, recomendación 5–500, precio 1–10.000.000); `createApproval(db, actor, orderId, input, now)` (`approvals.create`; orden en `diagnostico`, `en_reparacion`, `esperando_repuesto` o `esperando_aprobacion`, si no `invalid_status`; transacción: insert con `token_hash`; si el estado no es `esperando_aprobacion`, update + `recordStatusChange(… → esperando_aprobacion, nota "Propuesta de adicional")`; `recordAudit("approval.created", { approvalId, priceClp })` sin token) → `{ ok: true, approvalId, token }`; `approvalLink(siteUrl, token)` = `<siteUrl>/aprobacion/<token>`; `whatsappShareLink(phoneE164, text)` = `https://wa.me/<dígitos sin +>?text=<encodeURIComponent(text)>`; `regenerateApprovalLink(db, actor, approvalId, now)` (solo pendientes; nuevo token y hash; audit `approval.link_regenerated`); `listApprovals(db, actor, orderId)`.
4. `src/pages/taller/ordenes/[id]/adicional.astro`: lista (problema, precio, estado Pendiente/Aprobado/Rechazado, fecha) y formulario "Problema", "Recomendación", "Precio" → la respuesta del POST (sin redirigir) muestra **una vez** el enlace con "Copia este enlace ahora; no se vuelve a mostrar" y el botón "Enviar por WhatsApp" (`whatsappShareLink` con el texto "Hola <primer nombre>, en Vector Bikes revisamos tu bicicleta y encontramos algo. Revisa y responde aquí: <enlace>"); "Generar nuevo enlace" por propuesta pendiente.
5. `tests/integration/approvals.test.ts`: los seis criterios (buscar el token en claro en todas las columnas de la fila y de `audit_log`: no debe aparecer).

**Files**
- `src/server/db/schema-orders.ts` — edit
- `src/server/taller/share-tokens.ts` — new
- `src/server/taller/approvals.ts` — new
- `src/pages/taller/ordenes/[id]/adicional.astro` — new
- `tests/integration/approvals.test.ts` — new

**Acceptance**

1. **WHEN** el personal crea una propuesta con problema, recomendación y precio sobre una orden en `diagnostico`, `en_reparacion` o `esperando_repuesto` **THE SYSTEM SHALL** insertar `work_order_approvals` y pasar la orden a `esperando_aprobacion` con historial
2. **WHEN** se crea la propuesta **THE SYSTEM SHALL** devolver un token de 43 caracteres base64url y guardar solo su sha256 en hex de 64 caracteres en `token_hash`
3. **WHEN** se arma el enlace para WhatsApp **THE SYSTEM SHALL** devolver `https://wa.me/<dígitos del teléfono>?text=` con el enlace `<PUBLIC_SITE_URL>/aprobacion/<token>` codificado
4. **WHEN** un mecánico crea una propuesta **THE SYSTEM SHALL** devolver `{ ok: false, code: "forbidden" }`
5. **WHEN** se regenera el enlace de una propuesta sin responder **THE SYSTEM SHALL** reemplazar `token_hash`, de modo que el token anterior deja de encontrarla
6. **WHEN** se crea la propuesta **THE SYSTEM SHALL** escribir `approval.created` en `audit_log` sin el token

**Verify**

```bash
pnpm test tests/integration/approvals.test.ts   # expect: exit 0, 0 failed
pnpm db:migrate   # expect: exit 0
pnpm db:check   # expect: exit 0
pnpm format && pnpm gate   # expect: exit 0
```

**Checkpoint**

```bash
git add -A && git commit -m "feat: f1-26 add additional work proposal with single-use link" && git tag f1-26
git tag -l f1-26 | grep -qx f1-26   # expect: exit 0
```

### `E4-T3` — F1-27 Add public approval page for the customer

**Depends on:** `E4-T2` · **Priority:** p0

1. `src/server/api/handlers.ts` — único cambio: anteponer `export` a `checkRateLimit` y `recordAttempt` (sin tocar su cuerpo; siguen usando `booking_requests`, 5 por IP en 10 min).
2. `approvals.ts`: `viewApproval(db, token)` → `{ view: "invalid" }` (forma inválida o sin fila, sin consultar si la forma es inválida) o `{ view: "pending" | "decided", approval: { firstName, bike, description, recommendation, priceClp, decision?, decidedAt? } }` (primer nombre = primera palabra de `customers.name`; nunca teléfono ni correo). `decideApproval(db, token, decision, ipHash, now)`: una transacción cuya primera sentencia es `update work_order_approvals set decided_at = now, decision, decided_ip_hash where token_hash = $hash and decided_at is null and voided_at is null returning *`; sin fila → `already_decided` si el token existe, si no `invalid`; `aprobado` → línea `servicio` origen `adicional` (descripción = problema, cantidad 1, precio = `price_clp`, `approval_id`, `created_by` = autor de la propuesta) + `recomputeOrderTotals`; en ambos casos, si no quedan propuestas pendientes y la orden está en `esperando_aprobacion` → `en_reparacion` con `recordStatusChange` (autor nulo, nota "Respuesta del cliente"); `recordAudit("approval.decided", { decision })` con `actorUserId: null`.
3. `src/pages/aprobacion/[token].astro` (`prerender = false`, `Base` con `noindex`, `cache-control: no-store`, `referrer-policy: no-referrer`): GET → vista; POST → `log.info("approval.origin", { origin: originForLog(request) })`; `checkRateLimit({ db, now, ip })` → si devuelve respuesta, la página responde 429 "Demasiados intentos. Vuelve a intentar en 10 minutos."; `recordAttempt`; zod `decision` en `aprobar|rechazar`; `decideApproval`. Vistas: pendiente (problema, recomendación, precio con `formatClp`, botones "Aprobar" y "Rechazar"), respondida ("Ya respondiste: Aprobado/Rechazado el <fecha>"), inválida (404 "Enlace no válido").
4. `tests/integration/approvals.test.ts`: criterios 1–6 (carrera con `Promise.all` de dos `decideApproval`; el 6 con `recordAttempt` ×5 y luego `checkRateLimit` → `status` 429).

**Files**
- `src/pages/aprobacion/[token].astro` — new
- `src/server/taller/approvals.ts` — edit
- `src/server/api/handlers.ts` — edit (dos `export`)
- `tests/integration/approvals.test.ts` — edit

**Acceptance**

1. **WHEN** el cliente aprueba con un token válido **THE SYSTEM SHALL** marcar `decided_at` y `decision = 'aprobado'`, crear una línea `servicio` de origen `adicional` con el precio de la propuesta, recalcular `total_clp`, devolver la orden a `en_reparacion` si no quedan propuestas pendientes y escribir `approval.decided` con `actor_user_id` nulo
2. **WHEN** el cliente rechaza **THE SYSTEM SHALL** guardar `decision = 'rechazado'` sin crear línea y devolver la orden a `en_reparacion` si no quedan propuestas pendientes
3. **WHEN** dos respuestas llegan a la vez con el mismo token **THE SYSTEM SHALL** aplicar exactamente una y devolver `already_decided` a la otra
4. **WHEN** el token no existe o tiene forma inválida **THE SYSTEM SHALL** devolver `{ view: "invalid" }`
5. **WHEN** `viewApproval` arma la vista **THE SYSTEM SHALL** incluir el primer nombre del cliente, el problema, la recomendación y el precio, sin teléfono ni correo
6. **WHEN** se registran 5 intentos desde la misma IP en 10 minutos **THE SYSTEM SHALL** hacer que `checkRateLimit` devuelva una respuesta 429

**Verify**

```bash
pnpm test tests/integration/approvals.test.ts tests/integration/api.test.ts   # expect: exit 0, 0 failed
pnpm format && pnpm gate   # expect: exit 0
```

**Checkpoint**

```bash
git add -A && git commit -m "feat: f1-27 add public approval page for the customer" && git tag f1-27
git tag -l f1-27 | grep -qx f1-27   # expect: exit 0
```

### `E4-T4` — F1-28 Add quality control approved by the owner

**Depends on:** `E4-T3` · **Priority:** p0

1. `schema-orders.ts`: `qcChecks`; generate → migrate.
2. `src/server/taller/qc.ts`: `qcFormSchema` (7 claves × `ok|falla` + nota ≤ 300); `submitQc(db, actor, orderId, input, now)`: `qc.approve` (solo owner) o `forbidden`; orden en `control_calidad` o `invalid_status`; `selfCheck = assignedMechanicId === null || assignedMechanicId === actor.id`; si `QC_REQUIRE_SECOND_PERSON && selfCheck` → `second_person_required`; transacción: un `qc_checks` por punto (`actor_user_id`, `self_check`); todos `ok` → `qc_approved_at = now`, `qc_approved_by = actor.id`, `qc_self_checked = selfCheck`, `status = 'lista_para_retirar'`, `recordStatusChange`, audit `qc.approved`; algún `falla` → `status = 'en_reparacion'`, `recordStatusChange` (nota "Control rechazado"), audit `qc.rejected`. `listQcChecks`.
3. `src/pages/taller/ordenes/[id]/control.astro`: un `fieldset` por punto (`legend`: Frenos, Cambios, Ruedas, Apriete de componentes, Neumáticos y presión, Prueba de rodaje, Limpieza) con opciones OK / Falla, nota opcional, botón "Aprobar control" solo para el dueño; los demás ven "Solo el dueño aprueba el control de calidad" y el historial de controles.
4. `tests/integration/qc.test.ts`: criterios 1–5 (incluye "dueño aprueba su propia orden" y "orden sin mecánico").
5. `e2e/control-calidad.spec.ts`: `login(page, "owner")` → `/taller/ordenes/${SEED.orderControlId}/control` → tap "OK" en cada grupo → tap "Aprobar control" → texto `Lista para retirar`.

**Files**
- `src/server/db/schema-orders.ts` — edit
- `src/server/taller/qc.ts` — new
- `src/pages/taller/ordenes/[id]/control.astro` — new
- `tests/integration/qc.test.ts` — new
- `e2e/control-calidad.spec.ts` — new

**Acceptance**

1. **WHEN** el dueño aprueba con todos los puntos en `ok` el control de una orden en `control_calidad` asignada a un mecánico **THE SYSTEM SHALL** guardar los puntos en `qc_checks`, fijar `qc_approved_at` y `qc_approved_by`, dejar `qc_self_checked = false` y pasar la orden a `lista_para_retirar`
2. **WHEN** el dueño aprueba una orden asignada a sí mismo o sin mecánico **THE SYSTEM SHALL** marcar `qc_self_checked = true` y `self_check = true` en los puntos
3. **WHEN** un mecánico, un administrador o recepción intentan aprobar **THE SYSTEM SHALL** devolver `{ ok: false, code: "forbidden" }`
4. **WHEN** algún punto queda en `falla` **THE SYSTEM SHALL** guardar los puntos, no fijar `qc_approved_at` y devolver la orden a `en_reparacion`
5. **WHEN** la orden no está en `control_calidad` **THE SYSTEM SHALL** devolver `{ ok: false, code: "invalid_status" }`
6. **WHEN** el dueño toca `OK` en cada punto y `Aprobar control` en la orden sembrada `OT-00002` en el viewport de tablet **THE SYSTEM SHALL** mostrar `Lista para retirar`

**Verify**

```bash
pnpm test tests/integration/qc.test.ts   # expect: exit 0, 0 failed
pnpm db:migrate   # expect: exit 0
pnpm db:check   # expect: exit 0
pnpm build && pnpm test:tablet e2e/control-calidad.spec.ts   # expect: exit 0, 0 failed
pnpm format && pnpm gate   # expect: exit 0
```

**Prueba en tablet real (manual — no es compuerta de máquina; no va en `tasks.json`):** el dueño hace un control de calidad completo en la tablet del taller (FASE1 §14.7). Lo marca el dueño.

**Checkpoint**

```bash
git add -A && git commit -m "feat: f1-28 add quality control approved by the owner" && git tag f1-28
git tag -l f1-28 | grep -qx f1-28   # expect: exit 0
```

### `E4-T5` — F1-29 Record deposit and final payments

**Depends on:** `E4-T4` · **Priority:** p0

1. `schema-orders.ts`: `payments` con el índice único parcial; generate → migrate.
2. `src/server/taller/payments.ts`: `paymentFormSchema` (tipo, método, monto entero > 0); `recomputePaid(db, orderId, now)` (suma de pagos sin `voided_at` → `paid_clp`); `recordPayment(db, actor, orderId, input, now)`: `payments.record`; orden no en `entregada`/`cancelada`/`trabajo_rechazado` (`invalid_status`); monto > 0 y ≤ `total_clp - paid_clp` (si no `invalid_amount`); transacción: insert (violación única → `deposit_exists`), `recomputePaid`, `recordAudit("payment.recorded", { kind, method, amountClp })`. `voidPayment(db, actor, paymentId, now)` (`payments.void`; V; `recomputePaid`; audit `payment.voided`). `listPayments`.
3. `src/pages/taller/ordenes/[id]/entrega.astro`: resumen "Total", "Pagado", "Saldo" (`formatClp`); lista de pagos con "Anular" (solo `payments.void`); formulario: `fieldset` "Tipo de pago" (Abono / Pago final), `fieldset` "Método" (Transferencia, Tarjeta, Efectivo, Otro), "Monto" prellenado con el saldo, "Registrar pago".
4. `tests/integration/payments.test.ts`: los cinco criterios.

**Files**
- `src/server/db/schema-orders.ts` — edit
- `src/server/taller/payments.ts` — new
- `src/pages/taller/ordenes/[id]/entrega.astro` — new
- `tests/integration/payments.test.ts` — new

**Acceptance**

1. **WHEN** se registra un abono con método y monto **THE SYSTEM SHALL** insertarlo en `payments`, recalcular `paid_clp` desde los pagos no anulados en la misma transacción y escribir `payment.recorded` en `audit_log`
2. **WHEN** se registra un segundo abono vigente en la misma orden **THE SYSTEM SHALL** rechazarlo por el índice único parcial y devolver `{ ok: false, code: "deposit_exists" }`
3. **WHEN** el monto supera el saldo (`total_clp - paid_clp`) o no es positivo **THE SYSTEM SHALL** devolver `{ ok: false, code: "invalid_amount" }`
4. **WHEN** se anula un pago **THE SYSTEM SHALL** conservar la fila con `voided_at` y `voided_by`, recalcular `paid_clp` y permitir un nuevo abono
5. **WHEN** un mecánico registra un pago **THE SYSTEM SHALL** devolver `{ ok: false, code: "forbidden" }`

**Verify**

```bash
pnpm test tests/integration/payments.test.ts   # expect: exit 0, 0 failed
pnpm db:migrate   # expect: exit 0
pnpm db:check   # expect: exit 0
pnpm format && pnpm gate   # expect: exit 0
```

**Checkpoint**

```bash
git add -A && git commit -m "feat: f1-29 record deposit and final payments" && git tag f1-29
git tag -l f1-29 | grep -qx f1-29   # expect: exit 0
```

### `E4-T6` — F1-30 Complete delivery with zero balance and signature

**Depends on:** `E4-T5` · **Priority:** p0

1. `src/server/taller/delivery.ts`: `completeDelivery(db, storage, actor, { orderId, signatureDataUrl, signedByName }, now)`: `delivery.complete`; estado `lista_para_retirar` o `invalid_status`; `paid_clp === total_clp` o `balance_pending`; firma vacía → `missing_signature`, inválida → `invalid_signature` (`decodeSignature`); ya firmada `entrega` → `already_signed`; `uploadSignature(storage, orderId, "entrega", bytes)`; transacción: `insertSignatureRow`, `status = 'entregada'`, `delivered_at = now`, `recordStatusChange`, `recordAudit("order.delivered")`; si falla, borrar el objeto y relanzar.
2. `entrega.astro`: con estado `lista_para_retirar`, formulario POST `accion=entregar` con `<SignaturePad client:load name="firma" label="Firma de quien retira" />`, "Nombre de quien retira" (prellenado con el cliente) y botón "Entregar bicicleta"; errores en `role="alert"`: `balance_pending` "Hay saldo pendiente: registra el pago antes de entregar", `missing_signature` "Falta la firma de quien retira". Después: estado `Entregada`.
3. `tests/integration/delivery.test.ts`: criterios 1–3.
4. `e2e/entrega.spec.ts`: `login(page, "owner")` → `/taller/ordenes/${SEED.orderListaId}/entrega` → tap "Pago final" y "Transferencia" → "Monto" `25000` → tap "Registrar pago" → `Saldo` con `$0` → dibujar firma en el `canvas` → tap "Entregar bicicleta" → `Entregada`.

**Files**
- `src/server/taller/delivery.ts` — new
- `src/pages/taller/ordenes/[id]/entrega.astro` — edit
- `tests/integration/delivery.test.ts` — new
- `e2e/entrega.spec.ts` — new

**Acceptance**

1. **WHEN** `completeDelivery` corre sobre una orden `lista_para_retirar` con saldo distinto de cero **THE SYSTEM SHALL** devolver `{ ok: false, code: "balance_pending" }` y dejar la orden sin cambios
2. **WHEN** el saldo es cero y la firma es válida **THE SYSTEM SHALL** guardar la firma de tipo `entrega`, pasar la orden a `entregada` con `delivered_at` y escribir historial y `order.delivered` en `audit_log`
3. **WHEN** la orden no está en `lista_para_retirar` **THE SYSTEM SHALL** devolver `{ ok: false, code: "invalid_status" }`
4. **WHEN** el dueño registra en el viewport de tablet el pago final de la orden sembrada `OT-00003`, dibuja la firma y toca `Entregar bicicleta` **THE SYSTEM SHALL** mostrar `Entregada`

**Verify**

```bash
pnpm test tests/integration/delivery.test.ts tests/integration/payments.test.ts   # expect: exit 0, 0 failed
pnpm build && pnpm test:tablet e2e/entrega.spec.ts   # expect: exit 0, 0 failed
pnpm format && pnpm gate   # expect: exit 0
```

**Prueba en tablet real (manual — no es compuerta de máquina):** registrar un pago y hacer firmar la entrega con el dedo en la tablet. Lo marca el dueño.

**Checkpoint**

```bash
git add -A && git commit -m "feat: f1-30 complete delivery with zero balance and signature" && git tag f1-30
git tag -l f1-30 | grep -qx f1-30   # expect: exit 0
```

---

## Epic acceptance

1. **WHEN** un adicional se propone y el cliente lo aprueba con el enlace **THE SYSTEM SHALL** detener el trabajo y luego sumar el monto a la orden (FASE1 §14.5; `approvals.test.ts`).
2. **WHEN** se intenta entregar con saldo o pasar a `lista_para_retirar` sin control **THE SYSTEM SHALL** impedirlo (FASE1 §14.7–8; `qc.test.ts`, `delivery.test.ts`).

```bash
pnpm test tests/integration/approvals.test.ts tests/integration/qc.test.ts tests/integration/delivery.test.ts   # expect: exit 0
pnpm build && pnpm test:tablet e2e/galeria.spec.ts e2e/control-calidad.spec.ts e2e/entrega.spec.ts   # expect: exit 0
pnpm format && pnpm gate   # expect: exit 0
```

## Pitfalls

- **Chequear `Origin` en `/aprobacion`** — WhatsApp abre el enlace en otro contexto y el POST llegaría sin `Origin` válido; el token es la defensa.
- **Leer y luego actualizar la decisión** — carrera; la única forma correcta es el `update … where decided_at is null returning`.
- **Mostrar el token después de recargar** — no existe en claro; para reenviar se regenera.
- **Calcular `paid_clp` sumando en la página** — siempre `recomputePaid` en la transacción.
- **Un segundo abono "corrigiendo" el primero** — se anula el primero (V) y se registra otro.
- **`galeria.spec.ts` con la etapa `reparacion`** — `OT-00002` deja de admitirla cuando `control-calidad.spec.ts` la pasa a `lista_para_retirar`; el spec usa `terminado`.

## Before moving on

- [ ] Every task in this epic is `done` in `tasks.json`.
- [ ] Every `verify` command passed; none edited or skipped.
- [ ] Tags `f1-25` … `f1-30` existen.
- [ ] Gate passes from the project root.
- [ ] Every "Produced" contract exists with the stated signature.
- [ ] No file outside the subtree was modified.
- [ ] Esta épica no agrega variables de entorno.
- [ ] One commit per task, each followed by its checkpoint tag.
