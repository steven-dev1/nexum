# Nexum

Plataforma para conjuntos residenciales (propiedad horizontal en Colombia).
Primera fase: **servicios al residente** — paquetería, reserva de zonas comunes,
asambleas y recordatorios, y comunicados. Seguridad y acceso viene después.

- **Web:** Next.js 16 (App Router, Cache Components) + Tailwind CSS 4
- **Backend:** Supabase (Auth, Postgres con RLS)
- **Diseño:** azul eléctrico `#1D4ED8` + amarillo `#FACC15`, fondo `#F8FAFC`, con modo oscuro
- **Después:** app móvil en React Native

## Puesta en marcha

```bash
npm install
cp .env.example .env.local   # completa URL y publishable key de Supabase
npm run dev
```

### Base de datos

1. Aplica todas las migraciones de `supabase/migrations/` en orden
   (SQL Editor de Supabase, o `supabase db push` con la CLI enlazada al proyecto).
2. Opcional, solo desarrollo: `supabase/seed.sql` (unidades y zonas de ejemplo).
3. Regístrate en la app y promociona tu usuario a administrador:

```sql
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'tu@correo.com');
```

Roles: `admin` (administración), `porteria`, `residente`. Los residentes necesitan una
`unit_id` asignada en `profiles` para reservar y ver sus paquetes.

### Acceso por invitación

Nadie entra al conjunto solo por crear una cuenta. Un usuario es **miembro** (ve paquetes,
reservas, comunicados, asambleas…) cuando es personal o es residente con unidad; se llega a serlo
canjeando un enlace que genera la administración en **Administración → Invitaciones**:

- elige la unidad (o «Portería»), **cuánto vale** (1 h, 6 h, 24 h, 3, 7, 15, 30 días o fecha y hora
  exactas, hasta 90 días) y para **cuántas personas** sirve;
- el enlace se muestra una sola vez (en la base solo queda su hash) con botones de copiar y WhatsApp;
- se puede cancelar en cualquier momento y se ve quién lo canjeó;
- quien ya tiene cuenta pero no acceso entra a **/acceso** y pega el enlace.

La seguridad no depende de la pantalla: la RLS exige `private.is_member()` para leer, así que una
cuenta creada por fuera de la app no ve nada. Con la confirmación de correo desactivada en Supabase
(Authentication → Sign In / Providers → Email → Confirm email) quien llega con un enlace entra
enseguida; si sigue activada, se le pide confirmar y volver a abrir el enlace.

### Recordatorios de asamblea automáticos

La migración `20261111070000_recordatorios_cron.sql` llama a
`/api/push/reminders` cada 5 minutos con `pg_cron` + `pg_net`. Falta declarar
la URL y el secreto del despliegue (una sola vez):

```sql
insert into private.cron_config (key, value) values
  ('site_url',    'https://tu-app.vercel.app'),
  ('cron_secret', 'el-mismo-valor-de-CRON_SECRET')
on conflict (key) do update set value = excluded.value;
```

`CRON_SECRET` es el valor que ya usa la ruta; sin esas filas el job no hace nada.
Para verlo correr: `select * from cron.job;` y
`select * from cron.job_run_details order by start_time desc limit 5;`.

### Pruebas de RLS

`supabase/tests/rls.test.sql` comprueba con pgTAP que un residente solo ve sus
paquetes y su perfil, que no escribe en paquetes/comunicados/unidades ni cambia
su rol, y que portería sí borra paquetes y administración borra comunicados.
Se ejecuta en el SQL Editor de Supabase; corre en una transacción que se
revierte al final (no deja datos ni usuarios de prueba). Esperado:

```
16 tests, 16 passed
```

## Módulos

| Ruta | Residente | Portería | Admin |
| --- | --- | --- | --- |
| `/paqueteria` | ve los de su unidad | registra y entrega | igual que portería |
| `/reservas` | reserva y cancela las suyas | cancela cualquiera | cancela cualquiera |
| `/asambleas` | consulta, descarga adjuntos y vota (un voto por unidad) | consulta | convoca, adjunta PDF, crea y cierra votaciones |
| `/comunicados` | lee y marca leído (segmentado por torre) | lee | publica, programa, guarda borradores, adjunta PDF |
| `/vehiculos` | registra los vehículos de su unidad | — | administra todos |
| `/accesos` | — | registra ingresos y salidas de vehículos (por voz) | igual que portería |
| `/visitas` | autoriza visitas y vehículos temporales (código y QR), aprueba o rechaza las que portería solicita | — | ve y cancela todas |
| `/accesos` → Visitantes | — | valida por código o QR, registra llegadas sin aviso, marca salidas | igual que portería |
| `/directorio` | consulta teléfonos | consulta | administra los contactos |
| `/admin/invitaciones` | — | — | crea, ve y cancela enlaces de invitación |

## Acceso de vehículos por voz

En **Accesos** (portería y administración) el portero toca el micrófono (o la barra espaciadora) y dice
«**ingresa placa ABC123**» o «**sale placa ABC123**». El sistema interpreta la placa (letras sueltas, nombres de
letra como «a be ce», alfabeto fonético y números hablados), la busca entre los **vehículos registrados**
(`/vehiculos`) y registra el movimiento en la bitácora con voz de confirmación:

- Registrada y activa → **autorizado** (unidad, tipo, marca y color), con «Deshacer».
- No registrada o inactiva → se rechaza, queda el intento en la bitácora y se sugieren placas parecidas
  (error típico de dictado) para confirmar con un toque. Nunca se autoriza una coincidencia aproximada sola.
- Ya figura dentro (o no figura dentro al salir) → pide confirmar antes de registrar.

Cada vehículo puede tener una **foto** (bucket privado `vehicle-photos`, carpeta por unidad): el residente la sube al
registrarlo y, cuando portería valida una placa, la ve junto al resultado para compararla con el vehículo que está en la
entrada.

Siempre hay un campo de placa manual como respaldo. Requisitos: HTTPS, permiso de micrófono y un navegador con
reconocimiento de voz (Chrome, Edge o Safari; no Firefox). En Chrome el audio lo procesan los servidores de
Google. La bitácora no se edita: solo se puede anular un movimiento. No abre talanquera; eso sería una fase
posterior (webhook o relé).

## Visitantes y permisos temporales

Una **visita** sin placa es un visitante a pie; con placa es un **vehículo con permiso temporal** (solo vale dentro de su
horario, máx. 72 h).

- El residente la autoriza en **Visitas** (nombre, tipo, horario y, si llega en vehículo, la placa) y comparte el
  **código de 6 caracteres o el QR**.
- Portería, en **Accesos → Visitantes**, valida el código (escrito o con la cámara), registra la llegada de quien aparece
  sin aviso (pide autorización al residente, que recibe un aviso, o ingreso directo) y marca la salida. Si la visita llega
  en vehículo, también sirve decir «ingreso» y la placa en la pestaña Vehículos.
- Los cambios de estado pasan por funciones de la base (no por `update` directo) que validan quién puede hacerlos.
- El **documento** del visitante se guarda aparte (`visit_private`), solo lo ve el personal y debe borrarse a los 90 días
  (Ley 1581 de 2012). Para escanear el QR se necesita permiso de cámara y HTTPS.

## Rendimiento

- **Región**: cada pantalla hace varias consultas a Supabase. Si la función de Vercel y el proyecto de Supabase están en
  regiones lejanas (p. ej. Vercel en Washington y Supabase en São Paulo), cada consulta suma 100–200 ms. Revisa la región del
  proyecto en *Supabase → Settings → General* y pon la misma (o la más cercana) en *Vercel → Settings → Functions →
  Function Region*. Es la mejora más grande y no requiere código.
- **Navegación**: caché del navegador de 3 min, actualización en segundo plano a los 5 s y tiempo real (ver arriba).
- **Primera visita a cada sección**: sigue mostrando el esqueleto mientras llegan los datos. Guardarlos con
  `'use cache: private'` (por usuario, con `cacheLife` y etiquetas que las acciones invalidan) permitiría adelantarlos, pero
  cambia cómo se leen los datos en cada página; conviene hacerlo por etapas y midiendo en producción.

## Centro de ayuda

El botón **Ayuda** (menú lateral y «Más» en el celular) abre un formulario para **pedir ayuda, reportar un problema o enviar
una sugerencia**, dirigida a la *Administración del conjunto* o a *Soporte técnico de Nexum*, con una captura opcional. La
solicitud lleva sola la sección, el tipo de dispositivo y la versión (nunca contraseñas ni lo escrito en otros formularios).

- La persona ve sus solicitudes y las respuestas en **Mis solicitudes** (`/ayuda`); la administración las atiende en
  **Administración → Soporte** (estados *abierta / en curso / resuelta*; responder pasa a «en curso» y si la persona vuelve a
  escribir en una resuelta, se reabre). Todo llega por notificación push (y WhatsApp si lo activó).
- Las de *Soporte técnico* se reenvían además a un canal externo si defines `SUPPORT_WEBHOOK_URL` (Slack, Discord, correo por
  webhook…). Con `NEXT_PUBLIC_SUPPORT_WHATSAPP` (solo dígitos, con indicativo) aparece un enlace directo a WhatsApp.
- Requiere `SUPABASE_SECRET_KEY` para avisar a los administradores cuando llega una solicitud.

## Resumen y reportes (administración)

- **Resumen** (`/admin`): indicadores del conjunto en una sola consulta (`admin_summary`, solo administración): paquetes por
  entregar, reservas, vehículos y visitantes dentro, visitas esperando al residente, comunicados y su lectura media,
  votaciones abiertas con su participación, gráficas por día (7 o 30 días) y una lista «Para revisar».
- **Reportes** (`/admin/reportes`): exporta a **Excel o PDF** usuarios, paquetes, reservas, bitácora de vehículos, visitas,
  resultados de votaciones y lectura de comunicados, con rango de fechas (máx. 366 días y 10 000 filas). El servidor
  usa la sesión de quien descarga (la RLS sigue aplicando) y la bitácora de vehículos también la exporta portería
  (`GET /api/export/<reporte>?format=xlsx|pdf&desde=AAAA-MM-DD&hasta=AAAA-MM-DD`). Los documentos de visitantes nunca
  se exportan.

## Tiempo real y modo sin conexión

- **Tiempo real**: la pantalla se actualiza sola cuando alguien crea o cambia algo que puedes ver (paquetes, comunicados,
  asambleas y votos, reservas, accesos y visitas). Usa Supabase Realtime, que respeta la RLS: solo llegan los cambios de
  filas que esa persona puede leer. `BackgroundRefresh` queda de respaldo.
- **Sin conexión**: el service worker (`public/sw.js`) guarda los recursos estáticos y las últimas 12 páginas que viste
  (24 h) para abrirlas si se cae la red; aparece una franja «Sin conexión» y los formularios no se pueden enviar.
  Las copias tienen datos personales: no se guardan `/api`, `/login` ni `/invitacion`, y **se borran al llegar a /login**
  (cerrar sesión o sesión vencida). No hay escritura sin conexión.

## Comunicados programados

Al crear un comunicado se elige **Publicar ahora**, **Programar** (fecha y hora) o **Guardar como borrador**.
Los residentes solo ven lo ya publicado (lo exige la RLS, no solo la pantalla). El aviso de un comunicado
programado lo envía el mismo cron de recordatorios (`/api/push/reminders`) cuando llega su hora, así que
**ese cron debe estar activo** y correr cada 5–15 minutos.

## Avisos por WhatsApp

Es opcional y usa la **API de WhatsApp Business (Cloud API de Meta)**. Sin las variables de abajo, el envío se
omite y el botón no aparece.

| Variable | Descripción |
| --- | --- |
| `WHATSAPP_TOKEN` | Token de acceso permanente (usuario del sistema de Meta) |
| `WHATSAPP_PHONE_ID` | Id del número de WhatsApp Business |
| `WHATSAPP_TEMPLATE` | Nombre de la plantilla aprobada (por defecto `nexum_aviso`) |
| `WHATSAPP_LANG` | Idioma de la plantilla (por defecto `es`) |

Meta exige que los mensajes iniciados por la empresa usen una **plantilla aprobada**. Crea una de categoría
*Utilidad* con dos variables, por ejemplo: `Nexum: *{{1}}*. {{2}}` ({{1}} = título, {{2}} = mensaje). Cada
persona activa el aviso desde «Recibir avisos por WhatsApp» (celular + consentimiento); solo a ellas se escribe.
Los avisos son los mismos que las notificaciones push: paquetes, comunicados, asambleas y votaciones.

## Operación

- **CI** (`.github/workflows/ci.yml`): lint, tipos, pruebas y build en cada push y pull request.
  Dependabot propone actualizaciones semanales.
- **Pruebas** (`npm test`, Vitest): lógica pura (texto enriquecido y su saneamiento, números de WhatsApp,
  nombres y generador de unidades, invitaciones). Las reglas de acceso de la base se prueban con
  `supabase/tests/rls.test.sql`.
- **Estado del servicio**: `GET /api/health` responde 200 si la app y Supabase están arriba (503 si no).
  Úsalo con UptimeRobot o Better Stack.
- **Errores**: cada sección tiene su pantalla de error con «Reintentar» y un código (`digest`) para buscarlo
  en Vercel → Logs. Para alertas y trazas más completas se puede sumar Sentry.

## Pendiente

- Seguridad y acceso: visitantes con QR, domiciliarios, placas.
- Quórum y coeficientes de copropiedad en las votaciones; poderes.
- PQRS, cartera, correo electrónico.
