# Vector Bikes

Sitio y reservas en línea del taller de bicicletas Vector Bikes (Av. Kennedy 7666, Vitacura): landing, reserva de horas, cancelación por enlace, panel `/admin` y recordatorios por correo. Corre en Replit con Astro 7 y Postgres 16.

## Desarrollo

Requisitos: Node 24 (`.nvmrc`; mínimo 22.12) y pnpm 12.4.2 activado con corepack.

`package.json` no lleva el campo `packageManager`: Replit lo reescribe al publicar y, si existe, su instalación con pnpm 10 intenta autoinstalar pnpm 12 y aborta. La versión se fija donde manda, en el `build` de `[deployment]` en `.replit` (`corepack pnpm@12.4.2 …`); no vuelvas a agregar el campo.

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
3. Comando de build: `corepack pnpm@12.4.2 install --frozen-lockfile`.
4. Comando de ejecución: `corepack pnpm@12.4.2 reminders:send`.
5. Secretos de esa deployment (cada deployment tiene los suyos):
   - `DATABASE_URL` (la de producción)
   - `EMAIL_TRANSPORT=resend`
   - `RESEND_API_KEY`
   - `EMAIL_FROM`
   - `EMAIL_REPLY_TO`
   - `SHOP_NOTIFY_EMAIL`
   - `PUBLIC_SITE_URL`

Si Replit no permite una segunda deployment en la misma App, crea una segunda Replit App importando el mismo repositorio Git solo para esta tarea programada.

## Lanzamiento

Pasos para salir a producción, en orden. Ninguno es parte de la compuerta automática: cada uno se hace una vez y se marca a mano.

### 1. Publicar la Autoscale Deployment

1. Corre `pnpm gate` en el workspace y confirma que sale 0.
2. *Deployments → Autoscale → Publish*. Replit usa el bloque `[deployment]` de `.replit`: build `corepack pnpm@12.4.2 install --frozen-lockfile && corepack pnpm@12.4.2 build` y run `HOST=0.0.0.0 PORT=4321 node dist/server/entry.mjs`.

### 2. Secretos de producción

Cárgalos en **ambas** deployments (Autoscale y Scheduled); cada una tiene los suyos y ninguno va al repositorio:

- `DATABASE_URL` (la de producción)
- `PUBLIC_SITE_URL=https://vectorbikes.cl`
- `PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`
- `SESSION_SECRET`, `CANCEL_TOKEN_SECRET` (≥ 32 caracteres; genera cada una con `node -e 'console.log(require("node:crypto").randomBytes(32).toString("base64url"))'`)
- `EMAIL_TRANSPORT=resend`, `RESEND_API_KEY`
- `EMAIL_FROM=Vector Bikes <reservas@send.vectorbikes.cl>`, `EMAIL_REPLY_TO=info@vectorbikes.cl`, `SHOP_NOTIFY_EMAIL=info@vectorbikes.cl`
- `PUBLIC_WHATSAPP_NUMBER` si existe

Las variables `PUBLIC_*` se hornean en el build: después de cambiarlas hay que volver a publicar.

### 3. Esquema de producción

Tras la primera publicación, abre el panel *Database* de producción y confirma que están las 8 tablas: `bookings`, `booking_blocks`, `booking_days`, `blocked_periods`, `admin_users`, `admin_sessions`, `login_attempts` y `booking_requests`. La app nunca migra ni se corre `pnpm db:migrate` contra producción.

### 4. Cuenta admin en producción

En el shell, con el `DATABASE_URL` de producción exportado solo para ese comando:

```bash
DATABASE_URL='<url de producción>' ADMIN_EMAIL='…' ADMIN_PASSWORD='…' pnpm admin:set-password
```

Luego entra en `https://vectorbikes.cl/admin/login` y confirma que `/admin` muestra la agenda de hoy.

### 5. Dominio (cPanel de Bluehosting)

1. En Replit: *Deployments → Settings → Link a domain* → `vectorbikes.cl`.
2. En cPanel → *Zone Editor*, crea exactamente los registros **A** y **TXT `replit-verify=…`** que entrega Replit.
3. **No borres nunca el TXT `replit-verify`**: Replit lo usa para renovar el certificado SSL.
4. Comprueba que `https://vectorbikes.cl/api/health` responde `{"ok":true,"db":true}` con certificado válido.

### 6. Correo con Resend

1. En Resend, agrega el dominio `send.vectorbikes.cl`.
2. En cPanel crea exactamente los registros que muestre Resend para ese subdominio.
3. **No toques los registros MX, SPF ni autodiscover de Microsoft 365** del dominio principal: `info@vectorbikes.cl` debe seguir recibiendo correo. Compruébalo enviando un correo externo a ese buzón.
4. Haz una reserva real: el cliente debe recibir la confirmación con el `.ics` y el taller el aviso, sin caer en spam. Cancélala con el enlace y confirma que llega el aviso de cancelación.

### 7. Turnstile real

1. En Cloudflare → *Turnstile*, crea el widget para `vectorbikes.cl`.
2. Reemplaza las claves de prueba por `PUBLIC_TURNSTILE_SITE_KEY` y `TURNSTILE_SECRET_KEY` reales y vuelve a publicar.

### 8. WhatsApp

Define `PUBLIC_WHATSAPP_NUMBER` en los secretos de la Autoscale Deployment y **vuelve a publicar** (el número se hornea en el build). Si queda vacío, el botón no aparece.

### 9. Supresión de datos

Cuando alguien pida eliminar sus datos a info@vectorbikes.cl, anonimiza su reserva desde el panel *Database* de producción. La fila no se borra:

```sql
update bookings
set customer_name = '(eliminado)',
    phone_e164 = '+56900000000',
    email = 'eliminado@vectorbikes.cl',
    bike = '-',
    description = '-',
    address = case when mode = 'retiro' then '(eliminado)' else null end,
    ip_hash = null
where id = '<id>';
```

### 10. Feriados 2027

Antes de diciembre de 2026 (el panel lo advierte cuando el horizonte de 30 días llega a 2027), carga los feriados oficiales de 2027 con la skill `add-holidays`, corre `pnpm gate`, haz commit y vuelve a publicar. Nunca inventes fechas: usa solo las oficiales.
