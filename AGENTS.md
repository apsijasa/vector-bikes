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
