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
