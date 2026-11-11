-- Nexum · Servicios al residente
-- Paquetería, reserva de zonas comunes, asambleas y recordatorios, comunicados.
-- Un solo conjunto por proyecto de Supabase (sin multi-tenant por ahora).

create extension if not exists btree_gist with schema extensions;

-- ---------------------------------------------------------------------------
-- Funciones auxiliares (schema privado, no expuesto por la Data API)
-- SECURITY DEFINER es intencional: leen `profiles` sin disparar la RLS de
-- `profiles` (evita recursión infinita en las políticas). search_path vacío.
-- ---------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table public.units (
  id uuid primary key default gen_random_uuid(),
  tower text not null default '',
  number text not null,
  unique (tower, number)
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  phone text,
  role text not null default 'residente'
    check (role in ('admin', 'porteria', 'residente')),
  unit_id uuid references public.units (id) on delete set null,
  created_at timestamptz not null default now()
);
create index profiles_unit_id_idx on public.profiles (unit_id);

create function private.app_role() returns text
language sql stable security definer set search_path = ''
as $$ select role from public.profiles where id = (select auth.uid()) $$;

create function private.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce((select role from public.profiles where id = (select auth.uid())) = 'admin', false) $$;

create function private.is_staff() returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce((select role from public.profiles where id = (select auth.uid())) in ('admin', 'porteria'), false) $$;

create function private.unit_id() returns uuid
language sql stable security definer set search_path = ''
as $$ select unit_id from public.profiles where id = (select auth.uid()) $$;

create function private.tower() returns text
language sql stable security definer set search_path = ''
as $$
  select u.tower
  from public.profiles p
  join public.units u on u.id = p.unit_id
  where p.id = (select auth.uid())
$$;

revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;

-- Crea el perfil al registrarse. El rol siempre arranca como 'residente';
-- un administrador asigna rol y unidad después.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Paquetería
-- ---------------------------------------------------------------------------
create table public.packages (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units (id),
  recipient_name text,
  carrier text,
  description text,
  status text not null default 'recibido'
    check (status in ('recibido', 'entregado', 'devuelto')),
  received_by uuid default auth.uid() references auth.users (id),
  received_at timestamptz not null default now(),
  delivered_at timestamptz,
  delivered_to text,
  notes text
);
create index packages_unit_status_idx on public.packages (unit_id, status);
create index packages_received_by_idx on public.packages (received_by);

-- ---------------------------------------------------------------------------
-- Zonas comunes y reservas
-- ---------------------------------------------------------------------------
create table public.amenities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  capacity int,
  deposit_cop int not null default 0 check (deposit_cop >= 0),
  open_time time not null default '08:00',
  close_time time not null default '22:00',
  max_hours int not null default 4 check (max_hours > 0),
  active boolean not null default true
);

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  amenity_id uuid not null references public.amenities (id) on delete cascade,
  unit_id uuid not null references public.units (id),
  user_id uuid not null default auth.uid() references auth.users (id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'confirmada'
    check (status in ('confirmada', 'cancelada')),
  notes text,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  -- Una zona no puede tener dos reservas confirmadas que se crucen.
  constraint reservations_no_overlap exclude using gist (
    amenity_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (status = 'confirmada')
);
create index reservations_unit_idx on public.reservations (unit_id);
create index reservations_user_idx on public.reservations (user_id);
create index reservations_amenity_starts_idx on public.reservations (amenity_id, starts_at);

-- Reglas de la zona: activa, dentro del horario (hora de Colombia) y duración máxima.
create function private.validate_reservation() returns trigger
language plpgsql set search_path = ''
as $$
declare
  a public.amenities;
  local_start timestamp;
  local_end timestamp;
begin
  select * into a from public.amenities where id = new.amenity_id and active;
  if not found then
    raise exception 'La zona común no está disponible';
  end if;

  if new.status = 'confirmada' and new.starts_at <= now() then
    raise exception 'La reserva debe ser a futuro';
  end if;

  local_start := new.starts_at at time zone 'America/Bogota';
  local_end := new.ends_at at time zone 'America/Bogota';

  if local_start::date <> local_end::date
     or local_start::time < a.open_time
     or local_end::time > a.close_time then
    raise exception 'La reserva debe quedar dentro del horario de la zona (% - %)', a.open_time, a.close_time;
  end if;

  if new.ends_at - new.starts_at > make_interval(hours => a.max_hours) then
    raise exception 'La duración máxima es de % horas', a.max_hours;
  end if;

  return new;
end;
$$;

create trigger reservations_validate
  before insert on public.reservations
  for each row execute function private.validate_reservation();

-- ---------------------------------------------------------------------------
-- Asambleas y recordatorios
-- ---------------------------------------------------------------------------
create table public.assemblies (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  kind text not null default 'ordinaria'
    check (kind in ('ordinaria', 'extraordinaria')),
  scheduled_at timestamptz not null,
  location text,
  meeting_url text,
  status text not null default 'programada'
    check (status in ('programada', 'en_curso', 'finalizada', 'cancelada')),
  created_by uuid default auth.uid() references auth.users (id),
  created_at timestamptz not null default now()
);
create index assemblies_scheduled_idx on public.assemblies (scheduled_at);
create index assemblies_created_by_idx on public.assemblies (created_by);

create table public.assembly_reminders (
  id uuid primary key default gen_random_uuid(),
  assembly_id uuid not null references public.assemblies (id) on delete cascade,
  remind_at timestamptz not null,
  message text,
  sent_at timestamptz
);
create index assembly_reminders_assembly_idx on public.assembly_reminders (assembly_id);
create index assembly_reminders_pending_idx on public.assembly_reminders (remind_at) where sent_at is null;

-- ---------------------------------------------------------------------------
-- Comunicados
-- ---------------------------------------------------------------------------
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  audience text not null default 'todos' check (audience in ('todos', 'torre')),
  tower text,
  pinned boolean not null default false,
  author_id uuid default auth.uid() references auth.users (id),
  published_at timestamptz not null default now(),
  check (audience = 'todos' or tower is not null)
);
create index announcements_published_idx on public.announcements (published_at desc);
create index announcements_author_idx on public.announcements (author_id);

create table public.announcement_reads (
  announcement_id uuid not null references public.announcements (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (announcement_id, user_id)
);
create index announcement_reads_user_idx on public.announcement_reads (user_id);

-- ---------------------------------------------------------------------------
-- Permisos de la Data API + RLS
-- ---------------------------------------------------------------------------
revoke all on public.units, public.profiles, public.packages, public.amenities,
  public.reservations, public.assemblies, public.assembly_reminders,
  public.announcements, public.announcement_reads from anon;

grant select, insert, update, delete on public.units, public.packages,
  public.amenities, public.assemblies, public.assembly_reminders,
  public.announcements to authenticated;
grant select, update on public.profiles to authenticated;
-- Reservas: nadie edita fechas ni zona; solo estado y notas (cancelar).
grant select, insert on public.reservations to authenticated;
grant update (status, notes) on public.reservations to authenticated;
grant select, insert on public.announcement_reads to authenticated;

alter table public.units enable row level security;
alter table public.profiles enable row level security;
alter table public.packages enable row level security;
alter table public.amenities enable row level security;
alter table public.reservations enable row level security;
alter table public.assemblies enable row level security;
alter table public.assembly_reminders enable row level security;
alter table public.announcements enable row level security;
alter table public.announcement_reads enable row level security;

-- units
create policy "units: lectura" on public.units for select to authenticated using (true);
create policy "units: admin escribe" on public.units for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- profiles (el rol solo lo cambia un administrador)
create policy "profiles: propio o personal" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.is_staff()));
create policy "profiles: admin actualiza" on public.profiles for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- packages
create policy "packages: residente ve los de su unidad, personal ve todos" on public.packages
  for select to authenticated
  using ((select private.is_staff()) or unit_id = (select private.unit_id()));
create policy "packages: personal registra" on public.packages
  for insert to authenticated with check ((select private.is_staff()));
create policy "packages: personal actualiza" on public.packages
  for update to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
create policy "packages: admin elimina" on public.packages
  for delete to authenticated using ((select private.is_admin()));

-- amenities
create policy "amenities: lectura" on public.amenities for select to authenticated using (true);
create policy "amenities: admin escribe" on public.amenities for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- reservations (calendario visible para todos; cada quien cancela las suyas)
create policy "reservations: lectura" on public.reservations
  for select to authenticated using (true);
create policy "reservations: crear la propia" on public.reservations
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (unit_id = (select private.unit_id()) or (select private.is_staff()))
  );
create policy "reservations: cancelar la propia o personal" on public.reservations
  for update to authenticated
  using (user_id = (select auth.uid()) or (select private.is_staff()))
  with check (user_id = (select auth.uid()) or (select private.is_staff()));

-- assemblies
create policy "assemblies: lectura" on public.assemblies
  for select to authenticated using (true);
create policy "assemblies: admin escribe" on public.assemblies for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- assembly_reminders
create policy "assembly_reminders: lectura" on public.assembly_reminders
  for select to authenticated using (true);
create policy "assembly_reminders: admin escribe" on public.assembly_reminders for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- announcements (segmentados por torre)
create policy "announcements: lectura segmentada" on public.announcements
  for select to authenticated
  using (
    (select private.is_staff())
    or audience = 'todos'
    or (audience = 'torre' and tower = (select private.tower()))
  );
create policy "announcements: admin escribe" on public.announcements for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- announcement_reads
create policy "announcement_reads: propias o admin" on public.announcement_reads
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy "announcement_reads: marcar leído" on public.announcement_reads
  for insert to authenticated with check (user_id = (select auth.uid()));
