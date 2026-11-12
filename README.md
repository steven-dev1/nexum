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

### Registro sin confirmación de correo

Para que quien se registre entre enseguida (sin abrir el correo), desactiva la
confirmación en **Supabase Dashboard → Authentication → Sign In / Providers →
Email → Confirm email**. La app ya entra sola en cuanto se crea la cuenta; si
la confirmación sigue activada, muestra el mensaje de "revisa tu correo".

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
| `/asambleas` | consulta | consulta | convoca, cancela, programa recordatorios |
| `/comunicados` | lee y marca leído (segmentado por torre) | lee | publica |

## Pendiente

- Correo o WhatsApp además de push (hoy solo Web Push).
- Verificación de quórum y votación en asambleas.
- Seguridad y acceso: visitantes con QR, domiciliarios, placas.
- CI (lint + typecheck + build) en cada push.
