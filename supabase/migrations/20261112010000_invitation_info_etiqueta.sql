-- Nexum · Etiqueta de unidad flexible en el enlace de invitación
--
-- Regla (la misma que usa la app): el número que empieza por dígito es un «Apto N»;
-- si empieza por letra («Casa 12», «Local 3», «A-12») se muestra tal cual. El grupo
-- («Torre») se antepone solo si es corto (1, 2, A, B); si ya es descriptivo
-- («Manzana B», «Bloque Norte») se muestra como se escribió.

create or replace function public.invitation_info(p_token text)
returns table (valid boolean, reason text, role text, unit_label text, expires_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
declare
  inv public.invitations;
  u public.units;
  num text;
  grp text;
begin
  select * into inv from public.invitations
  where token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'utf8')), 'hex');

  if not found then
    return query select false, 'no_existe', null::text, null::text, null::timestamptz;
    return;
  end if;

  if inv.unit_id is not null then
    select * into u from public.units where id = inv.unit_id;
    num := case when u.number ~ '^[0-9]' then 'Apto ' || u.number else u.number end;
    grp := case
      when u.tower = '' then ''
      when u.tower ~ '^[0-9A-Za-z]{1,3}$' then 'Torre ' || u.tower || ' · '
      else u.tower || ' · '
    end;
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
    case when u.id is null then null else grp || num end,
    inv.expires_at;
end;
$$;
