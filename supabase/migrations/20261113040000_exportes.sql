-- Nexum · Datos para exportar
--
-- `export_announcement_reads` entrega, por comunicado publicado en un rango, cuántos destinatarios tenía y
-- cuántos lo leyeron. Se calcula en la base porque PostgREST limita las respuestas a 1000 filas y contar lecturas
-- desde la aplicación sería lento. Solo la administración recibe filas.

create function public.export_announcement_reads(p_from timestamptz, p_to timestamptz)
returns table (
  title text, audience text, tower text, published_at timestamptz, edited_at timestamptz,
  recipients bigint, readers bigint
)
language sql stable security definer set search_path = ''
as $$
  select
    a.title, a.audience, a.tower, a.published_at, a.edited_at,
    (select count(*) from public.profiles p
       left join public.units u on u.id = p.unit_id
      where p.role = 'residente' and (a.audience = 'todos' or u.tower = a.tower)) as recipients,
    (select count(*) from public.announcement_reads r where r.announcement_id = a.id) as readers
  from public.announcements a
  where (select private.is_admin())
    and not a.draft and a.published_at <= now()
    and a.published_at >= p_from and a.published_at < p_to
  order by a.published_at
  limit 5000
$$;

revoke execute on function public.export_announcement_reads(timestamptz, timestamptz) from public, anon;
grant execute on function public.export_announcement_reads(timestamptz, timestamptz) to authenticated;
