-- Nexum · Visitantes y vehículos con permiso temporal
--
-- Una «visita» con `plate` nulo es un visitante a pie; con `plate` es un vehículo con permiso temporal
-- (válido solo dentro de su ventana de fechas). Los cambios de estado se hacen por funciones
-- (`decide_visit`, `check_in_visit`, `check_out_visit`, `cancel_visit`, `register_walkin`) que validan
-- quién puede hacerlos; nadie actualiza la tabla directamente.
--
-- El documento del visitante vive aparte (`visit_private`): solo lo ve el personal, y se borra a los 90 días
-- (Ley 1581 de 2012, tratamiento mínimo de datos personales).

-- Código corto de 6 caracteres sin letras ambiguas (sin 0/O, 1/I).
create function private.new_visit_code() returns text
language plpgsql volatile set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  raw bytea := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
  result text := '';
begin
  for i in 0..5 loop
    result := result || substr(alphabet, (get_byte(raw, i) % 32) + 1, 1);
  end loop;
  return result;
end;
$$;
revoke execute on function private.new_visit_code() from public, anon;
grant execute on function private.new_visit_code() to authenticated;

create table public.visits (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units (id) on delete cascade,
  visitor_name text not null check (char_length(visitor_name) between 1 and 120),
  kind text not null default 'visita'
    check (kind in ('visita', 'domiciliario', 'proveedor', 'mudanza', 'otro')),
  plate text check (plate ~ '^[A-Z]{3}[0-9]{3}$' or plate ~ '^[A-Z]{3}[0-9]{2}[A-Z]$'),
  valid_from timestamptz not null default now(),
  valid_until timestamptz not null,
  status text not null default 'autorizada'
    check (status in ('por_autorizar', 'autorizada', 'rechazada', 'dentro', 'salio', 'cancelada')),
  code text not null unique default private.new_visit_code(),
  source text not null default 'residente' check (source in ('residente', 'porteria')),
  notes text check (char_length(notes) <= 300),
  created_by uuid default auth.uid() references auth.users (id),
  checked_in_at timestamptz,
  checked_in_by uuid references auth.users (id),
  checked_out_at timestamptz,
  checked_out_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  check (valid_until > valid_from)
);
create index visits_unit_idx on public.visits (unit_id, valid_until desc);
create index visits_status_idx on public.visits (status, valid_until);
create index visits_plate_idx on public.visits (plate) where plate is not null;
create index visits_created_by_idx on public.visits (created_by);
create index visits_checked_in_by_idx on public.visits (checked_in_by);
create index visits_checked_out_by_idx on public.visits (checked_out_by);

create table public.visit_private (
  visit_id uuid primary key references public.visits (id) on delete cascade,
  document text not null check (char_length(document) between 1 and 30),
  created_at timestamptz not null default now()
);

alter table public.vehicle_access_log
  add column if not exists visit_id uuid references public.visits (id) on delete set null;
create index if not exists vehicle_access_log_visit_idx on public.vehicle_access_log (visit_id) where visit_id is not null;

revoke all on public.visits, public.visit_private from anon;
revoke all on public.visits, public.visit_private from authenticated;
grant select on public.visits to authenticated;
grant insert on public.visits to authenticated;   -- el residente autoriza a sus visitas; el resto va por funciones
grant select on public.visit_private to authenticated;

alter table public.visits enable row level security;
alter table public.visit_private enable row level security;

create policy "visits: lectura" on public.visits
  for select to authenticated
  using ((select private.is_staff()) or unit_id = (select private.unit_id()));

-- El residente solo crea visitas autorizadas para su propia unidad.
create policy "visits: residente autoriza" on public.visits
  for insert to authenticated
  with check (
    (select private.app_role()) = 'residente'
    and unit_id = (select private.unit_id())
    and source = 'residente'
    and status = 'autorizada'
    and checked_in_at is null
    and checked_out_at is null
  );

create policy "visit_private: solo personal" on public.visit_private
  for select to authenticated using ((select private.is_staff()));

-- ---------------------------------------------------------------------------
-- Funciones de cambio de estado
-- ---------------------------------------------------------------------------

-- Portería registra a quien llega sin aviso. `p_direct` = ingreso directo (el residente ya avisó);
-- si no, queda «por autorizar» hasta que el residente decida.
create function public.register_walkin(
  p_unit uuid, p_name text, p_document text, p_kind text, p_plate text, p_notes text, p_direct boolean
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v public.visits;
begin
  if not (select private.is_staff()) then return jsonb_build_object('result', 'no_permitido'); end if;
  if not exists (select 1 from public.units where id = p_unit) then return jsonb_build_object('result', 'unidad_invalida'); end if;

  insert into public.visits (unit_id, visitor_name, kind, plate, valid_from, valid_until, status, source, notes,
                             checked_in_at, checked_in_by)
  values (
    p_unit, left(trim(p_name), 120), coalesce(nullif(p_kind, ''), 'visita'), nullif(upper(trim(p_plate)), ''),
    now(), now() + case when p_direct then interval '12 hours' else interval '2 hours' end,
    case when p_direct then 'dentro' else 'por_autorizar' end, 'porteria', nullif(left(trim(p_notes), 300), ''),
    case when p_direct then now() end, case when p_direct then (select auth.uid()) end
  )
  returning * into v;

  if nullif(trim(p_document), '') is not null then
    insert into public.visit_private (visit_id, document) values (v.id, left(trim(p_document), 30));
  end if;
  return jsonb_build_object('result', 'ok', 'id', v.id, 'status', v.status, 'code', v.code);
end;
$$;

-- El residente de la unidad aprueba o rechaza una visita que portería le solicitó.
create function public.decide_visit(p_id uuid, p_approve boolean) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v public.visits;
begin
  select * into v from public.visits where id = p_id;
  if not found then return jsonb_build_object('result', 'no_existe'); end if;
  if v.unit_id is distinct from (select private.unit_id()) or (select private.app_role()) <> 'residente' then
    return jsonb_build_object('result', 'no_permitido');
  end if;
  if v.status <> 'por_autorizar' then return jsonb_build_object('result', 'estado_invalido'); end if;
  if v.valid_until <= now() then return jsonb_build_object('result', 'vencida'); end if;

  update public.visits set status = case when p_approve then 'autorizada' else 'rechazada' end where id = p_id;
  return jsonb_build_object('result', 'ok', 'status', case when p_approve then 'autorizada' else 'rechazada' end,
                            'visitor_name', v.visitor_name, 'unit_id', v.unit_id);
end;
$$;

-- Portería registra el ingreso con el código o el id de la visita (QR o teclado).
create function public.check_in_visit(p_ref text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v public.visits;
  ref text := upper(trim(p_ref));
begin
  if not (select private.is_staff()) then return jsonb_build_object('result', 'no_permitido'); end if;

  if ref ~ '^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$' then
    select * into v from public.visits where id = ref::uuid;
  else
    select * into v from public.visits where code = ref;
  end if;
  if not found then return jsonb_build_object('result', 'no_existe'); end if;

  if v.status = 'dentro' then return jsonb_build_object('result', 'ya_dentro', 'id', v.id, 'visitor_name', v.visitor_name, 'unit_id', v.unit_id, 'plate', v.plate); end if;
  if v.status = 'por_autorizar' then return jsonb_build_object('result', 'sin_autorizar', 'id', v.id, 'visitor_name', v.visitor_name, 'unit_id', v.unit_id); end if;
  if v.status <> 'autorizada' then return jsonb_build_object('result', 'estado_invalido', 'status', v.status, 'visitor_name', v.visitor_name, 'unit_id', v.unit_id); end if;
  if v.valid_until <= now() then return jsonb_build_object('result', 'vencida', 'visitor_name', v.visitor_name, 'unit_id', v.unit_id, 'valid_until', v.valid_until); end if;
  if v.valid_from > now() then return jsonb_build_object('result', 'aun_no', 'visitor_name', v.visitor_name, 'unit_id', v.unit_id, 'valid_from', v.valid_from); end if;

  update public.visits set status = 'dentro', checked_in_at = now(), checked_in_by = (select auth.uid()) where id = v.id;
  return jsonb_build_object('result', 'ok', 'id', v.id, 'visitor_name', v.visitor_name, 'unit_id', v.unit_id,
                            'plate', v.plate, 'kind', v.kind, 'valid_until', v.valid_until);
end;
$$;

create function public.check_out_visit(p_id uuid) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v public.visits;
begin
  if not (select private.is_staff()) then return jsonb_build_object('result', 'no_permitido'); end if;
  select * into v from public.visits where id = p_id;
  if not found then return jsonb_build_object('result', 'no_existe'); end if;
  if v.status <> 'dentro' then return jsonb_build_object('result', 'estado_invalido', 'status', v.status); end if;

  update public.visits set status = 'salio', checked_out_at = now(), checked_out_by = (select auth.uid()) where id = p_id;
  return jsonb_build_object('result', 'ok', 'visitor_name', v.visitor_name, 'unit_id', v.unit_id, 'plate', v.plate);
end;
$$;

-- El residente cancela una visita de su unidad (o la administración cualquiera) antes de que ingrese.
create function public.cancel_visit(p_id uuid) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v public.visits;
begin
  select * into v from public.visits where id = p_id;
  if not found then return jsonb_build_object('result', 'no_existe'); end if;
  if not ((select private.is_admin()) or (v.unit_id = (select private.unit_id()) and (select private.app_role()) = 'residente')) then
    return jsonb_build_object('result', 'no_permitido');
  end if;
  if v.status not in ('por_autorizar', 'autorizada') then return jsonb_build_object('result', 'estado_invalido'); end if;

  update public.visits set status = 'cancelada' where id = p_id;
  return jsonb_build_object('result', 'ok');
end;
$$;

revoke execute on function
  public.register_walkin(uuid, text, text, text, text, text, boolean),
  public.decide_visit(uuid, boolean), public.check_in_visit(text),
  public.check_out_visit(uuid), public.cancel_visit(uuid)
  from public, anon;
grant execute on function
  public.register_walkin(uuid, text, text, text, text, text, boolean),
  public.decide_visit(uuid, boolean), public.check_in_visit(text),
  public.check_out_visit(uuid), public.cancel_visit(uuid)
  to authenticated;
