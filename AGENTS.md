# Vector Bikes — instrucciones para agentes

Sitio y reservas en línea del taller Vector Bikes (Vitacura): Astro 7 + Preact + Postgres (Drizzle) en Replit.

**Antes de terminar cualquier tarea:** `pnpm format` y después `pnpm gate` en verde. Nunca se marca una tarea como hecha con la compuerta fallando ni se edita un comando de Verify para que pase.

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

## Reglas de código

1. Importaciones relativas con extensión `.ts`/`.tsx` explícita (`../db/client.ts`). Sin alias, sin barrels.
2. Nada de `enum`, `namespace` ni parameter properties (`erasableSyntaxOnly`): Node ejecuta `scripts/` quitando tipos.
3. Importaciones solo de tipos con `import type` (`verbatimModuleSyntax`).
4. La lógica de `src/server/**` recibe `db: AppDb` y `now: Date`; nunca `new Date()` dentro de la lógica.
5. Toda entrada externa pasa por zod antes de tocar `src/server/**`.
6. Ningún correo, `fetch` ni espera larga dentro de una transacción.
7. Archivos < 400 líneas, funciones < 50 líneas. Única excepción: `src/styles/global.css` (diseño aprobado; no partirlo).
8. Textos para el usuario en español de Chile; identificadores en inglés.
9. Todo elemento no-void cerrado en `.astro` (Astro 7 falla si no).
10. `set:html` solo para el JSON-LD de `Base.astro`.
11. Entorno solo por `src/lib/env.ts`; nunca `process.env` en otro lado. Logs por `src/lib/log.ts`.

## Fronteras de importación

| Capa | Puede importar | Nunca |
|---|---|---|
| `src/pages/**` | `server`, `lib`, `components`, `layouts` | SQL propio o lógica de negocio |
| `src/components/**` | otros componentes, `booking-state.ts` | `src/server/**` (habla por `fetch` a `/api/*`) |
| `src/server/**` | `src/server/**`, `src/lib/**`, `src/data/**` | `astro`, `astro:*`, componentes |
| `src/lib/**` | paquetes npm | `src/server/**`, `astro` |
| `scripts/**` | `src/server/**`, `src/lib/**` | `astro` |
| `tests/**` | todo lo anterior | red real |

## Reglas por carpeta

Antes de tocar archivos en estas rutas, leer el archivo de reglas correspondiente. No son opcionales.

| Archivo | Aplica a |
|---|---|
| `.claude/rules/database.md` | `src/server/db/**`, `drizzle/**`, `scripts/db-*.ts` |
| `.claude/rules/booking-engine.md` | `src/server/booking/**`, `src/data/**` |
| `.claude/rules/server-api.md` | `src/server/api/**`, `src/server/auth/**`, `src/pages/api/**`, `src/pages/admin/**`, `src/pages/reservas/**` |
| `.claude/rules/ui-design.md` | `src/components/**`, `src/layouts/**`, `src/styles/**`, `src/pages/*.astro` |

## Al recibir un encargo delegado

- Trabajar solo en los archivos que nombra el encargo. Si hace falta tocar otro, detenerse y reportarlo en vez de ampliarlo.
- No cambiar firmas exportadas ni comportamiento fuera del alcance pedido.
- No agregar dependencias nuevas sin que el encargo lo autorice.
- Si una prueba existente se rompe, detenerse y reportarlo: no borrarla ni ajustarla para que pase.
- Terminar con un resumen archivo por archivo: qué cambió, qué se verificó y qué quedó pendiente.

## No negociable

1. Nunca más de 1 bici por bloque ni más de 4 reservas por día: la garantía vive en la base (índice único parcial + locks), no solo en la UI.
2. `pnpm db:migrate` solo contra la base del workspace; la app nunca migra al arrancar ni contra producción.
3. Nunca borrar reservas: se cambia `status`.
4. Nunca commitear secretos ni `.env`; nunca registrar correos, teléfonos ni tokens sin redactar.
5. Nunca editar a mano `drizzle/` (se regenera desde `schema.ts`).
6. No construir nada de los No-Objetivos de `blueprint.md` §1.
7. Nunca marcar una tarea como hecha con una compuerta fallando, ni editar un comando de Verify para que pase.

Arquitectura completa, fronteras y tokens de diseño: `CLAUDE.md` en este mismo directorio.
