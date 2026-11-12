-- Nexum · Recordatorios de asamblea automáticos (pg_cron + pg_net)
--
-- /api/push/reminders ya sabe reclamar y enviar los recordatorios pendientes;
-- lo que faltaba era alguien que la llamara. Esta migración la llama cada
-- 5 minutos desde la propia base de datos. No se usa Vercel Cron porque en el
-- plan Hobby solo admite un disparo por día (el recordatorio de "1 hora antes"
-- saldría tarde).
--
-- Configuración (una sola vez, con la URL y el secreto del despliegue):
--
--   insert into private.cron_config (key, value) values
--     ('site_url',    'https://tu-app.vercel.app'),
--     ('cron_secret', 'el-mismo-valor-de-CRON_SECRET')
--   on conflict (key) do update set value = excluded.value;
--
-- Comprobación:
--   select * from cron.job;
--   select * from cron.job_run_details order by start_time desc limit 5;
--   select status_code, content from net._http_response order by created desc limit 5;

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

grant usage on schema cron to postgres;
grant usage on schema net to postgres;

-- ---------------------------------------------------------------------------
-- Parámetros del job. Sin filas el job no hace nada (no falla cada 5 min).
-- ---------------------------------------------------------------------------
create table if not exists private.cron_config (
  key text primary key,
  value text not null
);

alter table private.cron_config enable row level security;
revoke all on private.cron_config from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Llamada a la ruta de recordatorios. SECURITY DEFINER + search_path vacío:
-- solo toca private.cron_config y la cola de pg_net.
-- ---------------------------------------------------------------------------
create or replace function private.run_reminder_job()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  site text;
  secret text;
begin
  select value into site from private.cron_config where key = 'site_url';
  select value into secret from private.cron_config where key = 'cron_secret';
  if site is null or secret is null then
    return;
  end if;

  perform net.http_get(
    url := site || '/api/push/reminders',
    headers := jsonb_build_object('authorization', 'Bearer ' || secret),
    timeout_milliseconds := 20000
  );
end;
$$;

revoke execute on function private.run_reminder_job() from public, anon, authenticated;

-- Cada 5 minutos. Reemplaza el job si la migración se vuelve a aplicar.
select cron.unschedule('nexum-reminders')
where exists (select 1 from cron.job where jobname = 'nexum-reminders');

select cron.schedule(
  'nexum-reminders',
  '*/5 * * * *',
  'select private.run_reminder_job()'
);
