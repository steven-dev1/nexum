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

1. Aplica `supabase/migrations/20261111000000_servicios_residente.sql`
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

## Módulos

| Ruta | Residente | Portería | Admin |
| --- | --- | --- | --- |
| `/paqueteria` | ve los de su unidad | registra y entrega | igual que portería |
| `/reservas` | reserva y cancela las suyas | cancela cualquiera | cancela cualquiera |
| `/asambleas` | consulta | consulta | convoca, cancela, programa recordatorios |
| `/comunicados` | lee y marca leído (segmentado por torre) | lee | publica |

## Pendiente

- Envío real de recordatorios y notificaciones de paquetes (Edge Function + `pg_cron`,
  WhatsApp/correo/push). Hoy los recordatorios se guardan en `assembly_reminders`.
- Pantalla de administración de usuarios, unidades y zonas comunes.
- Verificación de quórum y votación en asambleas.
- Seguridad y acceso: visitantes con QR, domiciliarios, placas.
