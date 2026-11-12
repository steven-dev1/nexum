-- Nexum · Vehículos y bitácora de acceso (acceso por voz en portería)
--
-- `vehicles`: vehículos autorizados de cada unidad (los registran los residentes y la administración).
-- `vehicle_access_log`: cada ingreso/salida (o intento) que registra portería, por voz o a mano.

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  -- Placa normalizada: mayúsculas, sin espacios. Carro: ABC123 · Moto: ABC12D.
  plate text not null unique check (plate ~ '^[A-Z]{3}[0-9]{3}$' or plate ~ '^[A-Z]{3}[0-9]{2}[A-Z]$'),
  kind text not null default 'carro' check (kind in ('carro', 'moto', 'otro')),
  brand text check (char_length(brand) <= 60),
  color text check (char_length(color) <= 40),
  unit_id uuid not null references public.units (id) on delete cascade,
  active boolean not null default true,
  created_by uuid default auth.uid() references auth.users (id),
  created_at timestamptz not null default now()
);
create index vehicles_unit_idx on public.vehicles (unit_id);
create index vehicles_created_by_idx on public.vehicles (created_by);

create table public.vehicle_access_log (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid references public.vehicles (id) on delete set null,
  plate text not null,
  unit_id uuid references public.units (id) on delete set null,
  direction text not null check (direction in ('ingreso', 'salida')),
  result text not null check (result in ('autorizado', 'no_registrada', 'inactivo')),
  method text not null default 'manual' check (method in ('voz', 'manual')),
  transcript text check (char_length(transcript) <= 200),
  voided_at timestamptz,
  recorded_by uuid default auth.uid() references auth.users (id),
  at timestamptz not null default now()
);
create index vehicle_access_log_at_idx on public.vehicle_access_log (at desc);
create index vehicle_access_log_plate_idx on public.vehicle_access_log (plate, at desc);
create index vehicle_access_log_unit_idx on public.vehicle_access_log (unit_id);
create index vehicle_access_log_vehicle_idx on public.vehicle_access_log (vehicle_id);
create index vehicle_access_log_recorded_by_idx on public.vehicle_access_log (recorded_by);

revoke all on public.vehicles, public.vehicle_access_log from anon;
grant select, insert, update, delete on public.vehicles to authenticated;
-- La bitácora no se edita ni se borra: solo se puede anular un movimiento (voided_at).
revoke all on public.vehicle_access_log from authenticated;
grant select, insert on public.vehicle_access_log to authenticated;
grant update (voided_at) on public.vehicle_access_log to authenticated;

alter table public.vehicles enable row level security;
alter table public.vehicle_access_log enable row level security;

-- Vehículos: el personal ve todos; el residente solo los de su unidad.
create policy "vehicles: lectura" on public.vehicles
  for select to authenticated
  using ((select private.is_staff()) or unit_id = (select private.unit_id()));
create policy "vehicles: residente agrega los suyos" on public.vehicles
  for insert to authenticated
  with check (
    (select private.is_admin())
    or (unit_id = (select private.unit_id()) and (select private.app_role()) = 'residente')
  );
create policy "vehicles: residente edita los suyos" on public.vehicles
  for update to authenticated
  using ((select private.is_admin()) or unit_id = (select private.unit_id()))
  with check ((select private.is_admin()) or unit_id = (select private.unit_id()));
create policy "vehicles: residente quita los suyos" on public.vehicles
  for delete to authenticated
  using ((select private.is_admin()) or unit_id = (select private.unit_id()));

-- Bitácora: la escribe el personal; el residente lee solo los movimientos de su unidad.
create policy "vehicle_access_log: lectura" on public.vehicle_access_log
  for select to authenticated
  using ((select private.is_staff()) or unit_id = (select private.unit_id()));
create policy "vehicle_access_log: personal registra" on public.vehicle_access_log
  for insert to authenticated with check ((select private.is_staff()));
create policy "vehicle_access_log: personal anula" on public.vehicle_access_log
  for update to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
