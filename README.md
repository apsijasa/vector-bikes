# Vector Bikes

Sitio y reservas en línea del taller de bicicletas Vector Bikes (Av. Kennedy 7666, Vitacura): landing, reserva de horas, cancelación por enlace y panel `/admin`. Corre en Replit con Astro 7 y Postgres 16.

## Estado de producción

| Pieza | Estado |
|---|---|
| Sitio | En producción en **https://vectorbikes.cl**, publicado como Replit **Autoscale** Deployment. |
| Dominio | Registrado en **NIC Chile**; DNS administrado en el **cPanel de Bluehosting** (*Zone Editor*). |
| Conexión con Replit | Registro **A** `vectorbikes.cl → 34.111.179.208` y registro **TXT** `replit-verify=…`. El TXT es **permanente**: si se borra, falla la renovación del certificado SSL. |
| Correos automáticos | **Resend**, enviando desde `send.vectorbikes.cl` (registro DKIM y los CNAME `rsend.send` y `send.send` en cPanel). |
| Casilla del taller | `info@vectorbikes.cl` en **Microsoft 365**. Recibe los avisos de reservas nuevas y cancelaciones. |
| Antispam | **Cloudflare Turnstile** con claves reales, verificado en producción. |
| Panel admin | Operativo en `https://vectorbikes.cl/admin`, con agenda del día y vista de mes. Cuenta `info@vectorbikes.cl` creada en la base de producción. |
| Recordatorios | **No activos** (ver *Pendientes*). |

## Operación diaria

Esta sección es para quien atiende el taller; no hace falta saber programar.

### Entrar al panel

1. Abre **https://vectorbikes.cl/admin/login**.
2. Ingresa con el correo `info@vectorbikes.cl` y la clave del panel.
3. Verás la agenda de hoy; desde ahí cambias a la vista de mes, revisas reservas, cambias su estado y bloqueas días u horarios.
4. Las reservas nunca se borran: si una no va, se cambia su estado (por ejemplo, a cancelada).

Si olvidas la clave, no hay botón de "recuperar": hay que cambiarla como se explica abajo.

### Cambiar la clave del panel

Se hace desde el workspace de la App en Replit (el editor, no el sitio publicado):

1. En Replit, abre la herramienta **Database**, cambia a la base de **producción** y copia su URL de conexión (empieza con `postgresql://`). Esa URL es secreta: no la pegues en correos, chats ni en el repositorio.
2. Abre la pestaña **Shell** y escribe, en una sola línea, reemplazando lo que está entre comillas:

   ```bash
   DATABASE_URL='<url de producción>' ADMIN_EMAIL='info@vectorbikes.cl' ADMIN_PASSWORD='<clave nueva>' pnpm admin:set-password
   ```

3. La clave debe tener 12 caracteres o más. Si todo sale bien, aparece `{"ok":true,…}`.
4. Cambiar la clave cierra todas las sesiones abiertas: vuelve a entrar en `/admin/login` con la nueva.

Sin el `DATABASE_URL` de producción delante, el comando cambia la clave de la base de **desarrollo**, no la del sitio real.

### Si el sitio deja de cargar

Revisa en este orden:

1. **Registro A en cPanel.** Entra al cPanel de Bluehosting → *Zone Editor* → `vectorbikes.cl` y confirma que existen:
   - **A** `vectorbikes.cl` → `34.111.179.208`
   - **TXT** `replit-verify=…`

   Es lo primero porque ya pasó: al configurar Microsoft 365, Bluehosting reescribió la zona y se perdieron el A de Replit y los CNAME de Resend. Si faltan, créalos de nuevo con los valores que muestra Replit en *Deployments → Settings → dominio*. Los cambios de DNS pueden tardar hasta unas horas en verse.
2. **Correos que no llegan.** En la misma zona, confirma el DKIM de Resend y los CNAME `rsend.send` y `send.send`; en Resend el dominio `send.vectorbikes.cl` debe aparecer *Verified*.
3. **Estado del servidor.** Abre `https://vectorbikes.cl/api/health`. Debe responder `{"ok":true,"db":true}`. Si responde pero `db` es `false`, el problema es la base; si no responde, revisa en Replit *Deployments* que la publicación esté activa y mira sus *Logs*.
4. **Aviso del navegador sobre el certificado.** Casi siempre es el TXT `replit-verify` borrado. Vuelve a crearlo.

Nunca toques los registros MX, SPF ni autodiscover de Microsoft 365: son los que hacen que `info@vectorbikes.cl` reciba correo.

## Publicar

1. Corre `pnpm gate` en el workspace y confirma que sale 0.
2. **Borra `node_modules` antes de cada Publish:** `rm -rf node_modules`. El instalador de Replit falla si la carpeta existe.
3. *Deployments → Autoscale → Publish*.
4. Al terminar, comprueba `https://vectorbikes.cl/api/health`.

Para seguir trabajando en el workspace después de publicar, reinstala con `pnpm install --frozen-lockfile`.

## Pendientes

- **Recordatorios.** `pnpm reminders:send` existe y funciona, pero no se ejecuta en producción: Replit no permite una segunda publicación (Scheduled Deployment) en esta App. La alternativa elegida es exponer un endpoint protegido que llame un cron externo en **Make.com** una vez al día; **WhatsApp Business** queda como paso posterior. Mientras tanto, los clientes no reciben recordatorio.
- **Rotar la credencial de la base de producción.** La contraseña de la base de producción no ha sido rotada desde el lanzamiento. Tras rotarla hay que actualizar el `DATABASE_URL` en los secretos de la deployment y volver a publicar.
- **Feriados 2027.** Ver *Configuración de producción → Feriados 2027*.

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

## Recordatorios

`pnpm reminders:send` envía el recordatorio a las reservas confirmadas de mañana (hora de Santiago) que aún no lo recibieron. Es idempotente: una segunda ejecución el mismo día envía 0. Imprime `{"ok":true,"sent":N,"failed":0}` y sale 1 si algún envío falló. En producción no está programado (ver *Pendientes*).

## Configuración de producción (referencia)

Registro de cómo se montó producción. Ya está hecho; sirve para rehacerlo si algo se pierde.

### 1. Publicar la Autoscale Deployment

1. Corre `pnpm gate` en el workspace y confirma que sale 0, y borra `node_modules`.
2. *Deployments → Autoscale → Publish*. Replit usa el bloque `[deployment]` de `.replit`: build `corepack pnpm@12.4.2 install --frozen-lockfile --config.minimumReleaseAge=0 && corepack pnpm@12.4.2 build` y run `HOST=0.0.0.0 PORT=4321 node dist/server/entry.mjs`.

### 2. Secretos de producción

Se cargan en los secretos de la Autoscale Deployment; ninguno va al repositorio:

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
2. En cPanel crea exactamente los registros que muestre Resend para ese subdominio (DKIM y los CNAME `rsend.send` y `send.send`).
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
