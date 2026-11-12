-- Nexum · Acceso por invitación, membresía y pisos explícitos
--
-- 1. Ya no basta con crear una cuenta: para ver los datos del conjunto hay que ser
--    «miembro» (personal, o residente con unidad). Se llega a serlo canjeando un
--    enlace de invitación que genera la administración, con vigencia y usos limitados.
-- 2. Las unidades guardan su piso de forma explícita (antes se deducía del número).

-- ---------------------------------------------------------------------------
-- 1. Membresía
-- ---------------------------------------------------------------------------
create function private.is_member() returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select role in ('admin', 'porteria') or unit_id is not null
       from public.profiles where id = (select auth.uid())),
    false)
$$;
revoke execute on function private.is_member() from public, anon;
grant execute on function private.is_member() to authenticated;

-- La lectura general (calendario, asambleas, zonas, unidades, comunicados) ahora exige ser miembro.
alter policy "units: lectura" on public.units using ((select private.is_member()));
alter policy "amenities: lectura" on public.amenities using ((select private.is_member()));
alter policy "assemblies: lectura" on public.assemblies using ((select private.is_member()));
alter policy "assembly_reminders: lectura" on public.assembly_reminders using ((select private.is_member()));
alter policy "reservations: lectura" on public.reservations using ((select private.is_member()));
alter policy "announcements: lectura segmentada" on public.announcements
  using (
    (select private.is_staff())
    or (
      (select private.is_member())
      and (audience = 'todos' or (audience = 'torre' and tower = (select private.tower())))
    )
  );

-- ---------------------------------------------------------------------------
-- 2. Pisos explícitos
-- ---------------------------------------------------------------------------
alter table public.units add column if not exists floor int check (floor between -10 and 200);

-- Una sola vez: para las unidades ya creadas se toma el piso de la centena (302 → 3).
-- Desde aquí el piso es un dato que se edita, no una suposición.
update public.units
set floor = number::int / 100
where floor is null and number ~ '^[0-9]{3,5}$';

-- ---------------------------------------------------------------------------
-- 3. Invitaciones
-- ---------------------------------------------------------------------------
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  -- Solo se guarda el hash: el enlace completo se muestra una vez al crearlo.
  token_hash text not null unique,
  role text not null default 'residente' check (role in ('residente', 'porteria')),
  unit_id uuid references public.units (id) on delete cascade,
  label text,
  expires_at timestamptz not null,
  max_uses int not null default 1 check (max_uses between 1 and 500),
  uses int not null default 0 check (uses >= 0),
  revoked_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  -- Un residente entra a una unidad; el personal no tiene unidad.
  check ((role = 'residente') = (unit_id is not null))
);
create index invitations_unit_idx on public.invitations (unit_id);
create index invitations_created_by_idx on public.invitations (created_by);
create index invitations_created_at_idx on public.invitations (created_at desc);

create table public.invitation_redemptions (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  unique (invitation_id, user_id)
);
create index invitation_redemptions_user_idx on public.invitation_redemptions (user_id);

revoke all on public.invitations, public.invitation_redemptions from anon;
grant select, insert, update, delete on public.invitations to authenticated;
grant select on public.invitation_redemptions to authenticated;

alter table public.invitations enable row level security;
alter table public.invitation_redemptions enable row level security;

create policy "invitations: admin gestiona" on public.invitations
  for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "invitation_redemptions: admin ve" on public.invitation_redemptions
  for select to authenticated using ((select private.is_admin()));

-- ---------------------------------------------------------------------------
-- 4. Funciones públicas (RPC). SECURITY DEFINER es necesario: quien canjea aún no tiene
--    permiso para leer `invitations`. Solo exponen lo mínimo y validan todo adentro.
-- ---------------------------------------------------------------------------

-- Datos mínimos de un enlace, para mostrar la pantalla de registro (se puede llamar sin sesión).
create function public.invitation_info(p_token text)
returns table (valid boolean, reason text, role text, unit_label text, expires_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
declare
  inv public.invitations;
  u public.units;
begin
  select * into inv from public.invitations
  where token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'utf8')), 'hex');

  if not found then
    return query select false, 'no_existe', null::text, null::text, null::timestamptz;
    return;
  end if;

  if inv.unit_id is not null then
    select * into u from public.units where id = inv.unit_id;
  end if;

  return query select
    (inv.revoked_at is null and inv.expires_at > now() and inv.uses < inv.max_uses),
    case
      when inv.revoked_at is not null then 'revocada'
      when inv.expires_at <= now() then 'vencida'
      when inv.uses >= inv.max_uses then 'agotada'
      else 'ok'
    end,
    inv.role,
    case when u.id is null then null
         when u.tower <> '' then u.tower || ' · ' || u.number
         else u.number end,
    inv.expires_at;
end;
$$;
revoke execute on function public.invitation_info(text) from public;
grant execute on function public.invitation_info(text) to anon, authenticated;

-- Canjea el enlace para el usuario con sesión: le asigna la unidad (o el rol de portería).
create function public.redeem_invitation(p_token text) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  inv public.invitations;
begin
  if uid is null then
    return 'sin_sesion';
  end if;

  select * into inv from public.invitations
  where token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'utf8')), 'hex')
  for update;

  if not found then return 'no_existe'; end if;
  if inv.revoked_at is not null then return 'revocada'; end if;
  if inv.expires_at <= now() then return 'vencida'; end if;
  if inv.uses >= inv.max_uses then return 'agotada'; end if;

  -- Quien ya tiene acceso no cambia de unidad ni de rol con un enlace.
  if exists (
    select 1 from public.profiles
    where id = uid and (unit_id is not null or role <> 'residente')
  ) then
    return 'ya_tiene_acceso';
  end if;

  update public.profiles
  set role = inv.role, unit_id = inv.unit_id
  where id = uid;
  if not found then return 'sin_perfil'; end if;

  insert into public.invitation_redemptions (invitation_id, user_id) values (inv.id, uid);
  update public.invitations set uses = uses + 1 where id = inv.id;
  return 'ok';
end;
$$;
revoke execute on function public.redeem_invitation(text) from public, anon;
grant execute on function public.redeem_invitation(text) to authenticated;
