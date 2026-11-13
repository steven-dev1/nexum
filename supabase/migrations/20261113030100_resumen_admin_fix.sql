-- Nexum · Corrección de admin_summary: la variable `result` chocaba con la columna `vehicle_access_log.result`.
-- (Resumen para la administración)
--
-- `admin_summary(p_days)` devuelve en una sola consulta los indicadores del panel de resumen. Solo la
-- administración puede llamarla (si no, devuelve null). Las fechas se calculan en hora de Colombia.

create or replace function public.admin_summary(p_days int default 7) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  days int := least(greatest(coalesce(p_days, 7), 1), 90);
  today date := (now() at time zone 'America/Bogota')::date;
  since date := (now() at time zone 'America/Bogota')::date - (least(greatest(coalesce(p_days, 7), 1), 90) - 1);
  residents_total int;
  units_with_residents int;
  summary jsonb;
begin
  if not (select private.is_admin()) then return null; end if;

  select count(*) into residents_total from public.profiles where role = 'residente';
  select count(distinct unit_id) into units_with_residents from public.profiles where role = 'residente' and unit_id is not null;

  select jsonb_build_object(
    'days', days,
    'users', jsonb_build_object(
      'residents', residents_total,
      'staff', (select count(*) from public.profiles where role in ('porteria', 'admin')),
      'without_unit', (select count(*) from public.profiles where role = 'residente' and unit_id is null),
      'units', (select count(*) from public.units),
      'units_with_residents', units_with_residents,
      'active_invitations', (select count(*) from public.invitations where revoked_at is null and expires_at > now() and uses < max_uses)
    ),
    'packages', jsonb_build_object(
      'pending', (select count(*) from public.packages where status = 'recibido'),
      'received', (select count(*) from public.packages where (received_at at time zone 'America/Bogota')::date >= since),
      'delivered', (select count(*) from public.packages where status = 'entregado' and (delivered_at at time zone 'America/Bogota')::date >= since)
    ),
    'announcements', jsonb_build_object(
      'published', (select count(*) from public.announcements where not draft and published_at <= now() and (published_at at time zone 'America/Bogota')::date >= since),
      'scheduled', (select count(*) from public.announcements where not draft and published_at > now()),
      'drafts', (select count(*) from public.announcements where draft),
      -- Lectura media de los últimos 10 publicados: lectores / destinatarios (0 a 1).
      'read_rate', (
        select coalesce(avg(rate), 0) from (
          select (select count(*) from public.announcement_reads r where r.announcement_id = a.id)::numeric
                 / nullif((
                     select count(*) from public.profiles p
                     left join public.units u on u.id = p.unit_id
                     where p.role = 'residente' and (a.audience = 'todos' or u.tower = a.tower)
                   ), 0) as rate
          from public.announcements a
          where not a.draft and a.published_at <= now()
          order by a.published_at desc limit 10
        ) x
      )
    ),
    'reservations', jsonb_build_object(
      'today', (select count(*) from public.reservations where status = 'confirmada' and (starts_at at time zone 'America/Bogota')::date = today),
      'upcoming', (select count(*) from public.reservations where status = 'confirmada' and starts_at > now())
    ),
    'polls', jsonb_build_object(
      'open', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', p.id, 'question', p.question, 'closes_at', p.closes_at,
          'voted', (select count(*) from public.poll_votes v where v.poll_id = p.id),
          'total', units_with_residents
        ) order by p.created_at desc)
        from public.polls p
        where p.status = 'abierta' and (p.closes_at is null or p.closes_at > now())
      ), '[]'::jsonb)
    ),
    'access', jsonb_build_object(
      'vehicles_inside', (
        select count(*) from (
          select distinct on (plate) direction from public.vehicle_access_log
          where result = 'autorizado' and voided_at is null
          order by plate, at desc
        ) t where direction = 'ingreso'
      ),
      'movements_today', (select count(*) from public.vehicle_access_log where voided_at is null and (at at time zone 'America/Bogota')::date = today),
      'denied', (select count(*) from public.vehicle_access_log where result <> 'autorizado' and (at at time zone 'America/Bogota')::date >= since)
    ),
    'visits', jsonb_build_object(
      'inside', (select count(*) from public.visits where status = 'dentro'),
      'waiting', (select count(*) from public.visits where status = 'por_autorizar' and valid_until > now()),
      'authorized', (select count(*) from public.visits where status = 'autorizada' and valid_until > now()),
      'period', (select count(*) from public.visits where (created_at at time zone 'America/Bogota')::date >= since)
    ),
    'series', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'day', to_char(d, 'YYYY-MM-DD'),
        'packages', (select count(*) from public.packages where (received_at at time zone 'America/Bogota')::date = d),
        'access', (select count(*) from public.vehicle_access_log where voided_at is null and result = 'autorizado' and (at at time zone 'America/Bogota')::date = d),
        'visits', (select count(*) from public.visits where (created_at at time zone 'America/Bogota')::date = d)
      ) order by d), '[]'::jsonb)
      from generate_series(since, today, interval '1 day') as d
    )
  ) into summary;

  return summary;
end;
$$;

revoke execute on function public.admin_summary(int) from public, anon;
grant execute on function public.admin_summary(int) to authenticated;
