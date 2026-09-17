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
- Todo POST de admin (login, logout, acciones del panel) llama `isAllowedOrigin(request)` antes de leer el formulario: ahí protege una sesión con cookie.
- El POST de `/reservas/cancelar` **no** chequea `Origin`: el token del correo es la defensa contra CSRF (no es adivinable, vive como HMAC en base, deja de servir al empezar la reserva y al usarse). Exigir `Origin` rompía la cancelación desde visores de correo, que mandan otro origen o ninguno. Registra el origen recibido con `originForLog(request)` para tener visibilidad, nunca para decidir.
- Toda página admin empieza con `requireAdmin(...)` y redirige 303 a `/admin/login` si devuelve `null`; nunca confiar solo en middleware.
- Respuestas con datos personales o sesión: `cache-control: no-store`; páginas admin y cancelación con `noindex`.
- Tokens (cancelación, sesión) en base solo como hash; comparar claves con `timingSafeEqual`.
- Logs vía `src/lib/log.ts`; nunca `console.log` de objetos con correo, teléfono o tokens.
