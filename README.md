# Vector Bikes

Sitio y reservas en línea del taller de bicicletas Vector Bikes (Av. Kennedy 7666, Vitacura): landing, reserva de horas, cancelación por enlace, panel `/admin` y recordatorios por correo. Corre en Replit con Astro 7 y Postgres 16.

## Desarrollo

Requisitos: Node 24 (`.nvmrc`; mínimo 22.12) y pnpm 12.4.2 activado con corepack.

1. En la Replit App elige **Node.js 24** en el selector de lenguaje/módulo.
2. Activa pnpm: `corepack enable` (con `COREPACK_ENABLE_DOWNLOAD_PROMPT=0`) y comprueba `pnpm --version` → `12.4.2`.
3. Instala: `pnpm install --frozen-lockfile`.
4. Copia `.env.example` a `.env`. En Replit los valores reales van en *Secrets* y tienen precedencia sobre `.env`. En desarrollo usa `EMAIL_TRANSPORT=console` y las claves de prueba de Turnstile.
5. Levanta el servidor: `pnpm dev` → http://localhost:4321.
6. Crea la cuenta del panel: `ADMIN_EMAIL=… ADMIN_PASSWORD=… pnpm admin:set-password` (clave de 12 caracteres o más; volver a ejecutarlo cambia la clave y cierra las sesiones abiertas).

Antes de publicar o de dar una tarea por terminada, la compuerta debe pasar:

```bash
pnpm gate   # check + test + build + test:build + smoke
```

`pnpm ci` no sirve: es un comando propio de pnpm.

## Base de datos

- Crea la base en la herramienta *Database* del workspace de Replit; Replit define `DATABASE_URL`.
- El esquema vive en `src/server/db/schema.ts`. Después de cambiarlo:
  - `pnpm db:generate` genera la migración en `drizzle/` (nunca se edita a mano).
  - `pnpm db:migrate` la aplica. **Solo contra la base del workspace.**
  - `pnpm db:check` confirma que están todas las tablas.
- Al publicar, Replit propaga el esquema a la base de producción. La app nunca migra al arrancar y `db:migrate` jamás se ejecuta contra producción.
- Las reservas nunca se borran: se cambia su `status`.

## Recordatorios (Scheduled Deployment)

`pnpm reminders:send` envía el recordatorio a las reservas confirmadas de mañana (hora de Santiago) que aún no lo recibieron. Es idempotente: una segunda ejecución el mismo día envía 0. Imprime `{"ok":true,"sent":N,"failed":0}` y sale 1 si algún envío falló.

Configúralo así en Replit:

1. *Deployments → Create → Scheduled*.
2. Programación diaria a las 10:00: cron `0 10 * * *`, eligiendo **America/Santiago** en el selector de zona horaria.
3. Comando de build: `corepack pnpm install --frozen-lockfile`.
4. Comando de ejecución: `corepack pnpm reminders:send`.
5. Secretos de esa deployment (cada deployment tiene los suyos):
   - `DATABASE_URL` (la de producción)
   - `EMAIL_TRANSPORT=resend`
   - `RESEND_API_KEY`
   - `EMAIL_FROM`
   - `EMAIL_REPLY_TO`
   - `SHOP_NOTIFY_EMAIL`
   - `PUBLIC_SITE_URL`

Si Replit no permite una segunda deployment en la misma App, crea una segunda Replit App importando el mismo repositorio Git solo para esta tarea programada.
