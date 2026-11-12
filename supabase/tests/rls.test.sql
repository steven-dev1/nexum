-- Nexum · Pruebas de RLS (pgTAP)
--
-- Se ejecuta en el SQL Editor de Supabase. Todo ocurre dentro de una transacción
-- que se revierte al final: no deja usuarios, datos ni permisos.
-- Requiere que todas las migraciones de supabase/migrations/ ya estén aplicadas
-- y la extensión pgtap habilitada (Dashboard → Database → Extensions).
--
-- Patrón: se fijan los claims JWT con set_config, se baja el rol con
-- `set local role authenticated` a nivel de script y cada prueba deja su
-- resultado en la tabla temporal `m`.
--
-- Esperado: "16 tests, 16 passed".

begin;

create extension if not exists pgtap with schema extensions;

select plan(16);

-- ---------------------------------------------------------------------------
-- Datos de prueba (el trigger on_auth_user_created crea los perfiles)
-- ---------------------------------------------------------------------------
insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
   raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111',
   'authenticated', 'authenticated', 'rls-resi1@test.test', 'x', now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Residente 1"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222',
   'authenticated', 'authenticated', 'rls-resi2@test.test', 'x', now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Residente 2"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333333',
   'authenticated', 'authenticated', 'rls-portero@test.test', 'x', now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Portero"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '44444444-4444-4444-4444-444444444444',
   'authenticated', 'authenticated', 'rls-admin@test.test', 'x', now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Admin"}', now(), now());

insert into public.units (id, tower, number) values
  ('a0000001-0000-0000-0000-000000000001', '1', '101'),
  ('a0000002-0000-0000-0000-000000000002', '2', '201');

update public.profiles set role = 'residente', unit_id = 'a0000001-0000-0000-0000-000000000001'
  where id = '11111111-1111-1111-1111-111111111111';
update public.profiles set role = 'residente', unit_id = 'a0000002-0000-0000-0000-000000000002'
  where id = '22222222-2222-2222-2222-222222222222';
update public.profiles set role = 'porteria', unit_id = null
  where id = '33333333-3333-3333-3333-333333333333';
update public.profiles set role = 'admin', unit_id = null
  where id = '44444444-4444-4444-4444-444444444444';

insert into public.packages (id, unit_id, carrier, recipient_name) values
  ('b0000001-0000-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000001', 'Mensajero 1', 'Uno'),
  ('b0000002-0000-0000-0000-000000000002', 'a0000002-0000-0000-0000-000000000002', 'Mensajero 2', 'Dos');

insert into public.amenities (id, name, open_time, close_time, max_hours) values
  ('c0000001-0000-0000-0000-000000000001', 'Salón social', '08:00', '22:00', 4);

-- 10:00–12:00 hora de Colombia, dos días adelante (dentro del horario de la zona).
insert into public.reservations (id, amenity_id, unit_id, user_id, starts_at, ends_at) values
  ('d0000001-0000-0000-0000-000000000001',
   'c0000001-0000-0000-0000-000000000001',
   'a0000001-0000-0000-0000-000000000001',
   '11111111-1111-1111-1111-111111111111',
   (date_trunc('day', now() at time zone 'America/Bogota') + interval '2 days' + interval '10 hours')
     at time zone 'America/Bogota',
   (date_trunc('day', now() at time zone 'America/Bogota') + interval '2 days' + interval '12 hours')
     at time zone 'America/Bogota');

insert into public.announcements (id, title, body, audience, tower) values
  ('e0000001-0000-0000-0000-000000000001', 'Aviso general', 'x', 'todos', null),
  ('e0000002-0000-0000-0000-000000000002', 'Aviso torre 1', 'x', 'torre', '1'),
  ('e0000003-0000-0000-0000-000000000003', 'Aviso torre 2', 'x', 'torre', '2');

insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values
  ('22222222-2222-2222-2222-222222222222', 'https://push.example/2', 'k', 'a');

-- Tabla de resultados: cada prueba deja ahí su conteo o su SQLSTATE.
create temp table m (label text primary key, n int);
grant all on m to authenticated;

-- Claims JWT del usuario dado (el rol se baja aparte, a nivel de script).
create or replace function pg_temp.who(uid uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. Visibilidad
-- ---------------------------------------------------------------------------
select pg_temp.who('11111111-1111-1111-1111-111111111111');
set local role authenticated;
insert into m (label, n) select 'resi1.pkg', count(*)::int from public.packages;
reset role;

select pg_temp.who('22222222-2222-2222-2222-222222222222');
set local role authenticated;
insert into m (label, n) select 'resi2.pkg', count(*)::int from public.packages;
reset role;

select pg_temp.who('33333333-3333-3333-3333-333333333333');
set local role authenticated;
insert into m (label, n) select 'staff.pkg', count(*)::int from public.packages;
insert into m (label, n) select 'staff.ann', count(*)::int from public.announcements;
reset role;

select pg_temp.who('11111111-1111-1111-1111-111111111111');
set local role authenticated;
insert into m (label, n) select 'resi1.ann', count(*)::int from public.announcements;
insert into m (label, n) select 'resi1.profiles', count(*)::int from public.profiles;
insert into m (label, n) select 'resi1.push', count(*)::int from public.push_subscriptions;
reset role;

select is((select n from m where label = 'resi1.pkg'), 1,
  'residente 1 solo ve los paquetes de su unidad');
select is((select n from m where label = 'resi2.pkg'), 1,
  'residente 2 solo ve los paquetes de su unidad');
select is((select n from m where label = 'staff.pkg'), 2,
  'portería ve todos los paquetes');
select is((select n from m where label = 'resi1.ann'), 2,
  'residente 1 ve los avisos de todos y de su torre, no de otra torre');
select is((select n from m where label = 'staff.ann'), 3,
  'portería ve todos los comunicados');
select is((select n from m where label = 'resi1.profiles'), 1,
  'residente 1 solo ve su propio perfil');
select is((select n from m where label = 'resi1.push'), 0,
  'residente 1 no ve las suscripciones push de otros');

-- ---------------------------------------------------------------------------
-- 2. Escrituras rechazadas con error (RLS o permisos de columna)
-- ---------------------------------------------------------------------------
select pg_temp.who('11111111-1111-1111-1111-111111111111');
set local role authenticated;

do $$
declare code text := '0';
begin
  begin
    insert into public.packages (unit_id, carrier)
    values ('a0000002-0000-0000-0000-000000000002', 'x');
  exception when others then
    get stacked diagnostics code = returned_sqlstate;
  end;
  insert into m values ('resi1.ins_pkg',
    case when code ~ '^[0-9]+$' then code::int else -1 end);
end $$;

do $$
declare code text := '0';
begin
  begin
    insert into public.announcements (title, body, audience)
    values ('x', 'x', 'todos');
  exception when others then
    get stacked diagnostics code = returned_sqlstate;
  end;
  insert into m values ('resi1.ins_ann',
    case when code ~ '^[0-9]+$' then code::int else -1 end);
end $$;

do $$
declare code text := '0';
begin
  begin
    insert into public.units (tower, number) values ('9', '901');
  exception when others then
    get stacked diagnostics code = returned_sqlstate;
  end;
  insert into m values ('resi1.ins_unit',
    case when code ~ '^[0-9]+$' then code::int else -1 end);
end $$;

do $$
declare code text := '0';
begin
  begin
    update public.reservations
      set unit_id = 'a0000002-0000-0000-0000-000000000002'
      where id = 'd0000001-0000-0000-0000-000000000001';
  exception when others then
    get stacked diagnostics code = returned_sqlstate;
  end;
  insert into m values ('resi1.upd_resv',
    case when code ~ '^[0-9]+$' then code::int else -1 end);
end $$;

reset role;

select is((select n from m where label = 'resi1.ins_pkg'), 42501,
  'residente 1 no puede registrar paquetes');
select is((select n from m where label = 'resi1.ins_ann'), 42501,
  'residente 1 no puede publicar comunicados');
select is((select n from m where label = 'resi1.ins_unit'), 42501,
  'residente 1 no puede crear unidades');
select is((select n from m where label = 'resi1.upd_resv'), 42501,
  'residente 1 no puede mover su reserva a otra unidad (columnas protegidas)');

-- ---------------------------------------------------------------------------
-- 3. Sin error pero 0 filas: el rol no cambia y el borrado no hace nada
-- ---------------------------------------------------------------------------
select pg_temp.who('11111111-1111-1111-1111-111111111111');
set local role authenticated;

update public.profiles
  set role = 'admin'
  where id = '11111111-1111-1111-1111-111111111111';

delete from public.packages where id = 'b0000002-0000-0000-0000-000000000002';
delete from public.announcements where id = 'e0000003-0000-0000-0000-000000000003';

insert into m (label, n)
  select 'resi1.role', count(*)::int from public.profiles
  where id = '11111111-1111-1111-1111-111111111111' and role = 'residente';
insert into m (label, n) select 'resi1.pkg_left', count(*)::int from public.packages;
insert into m (label, n) select 'resi1.ann_left', count(*)::int from public.announcements;

reset role;

select is((select n from m where label = 'resi1.role'), 1,
  'residente 1 no puede auto-promoverse a administrador');
select is((select n from m where label = 'resi1.pkg_left'), 1,
  'residente 1 no puede borrar paquetes (siguen 1)');
select is((select n from m where label = 'resi1.ann_left'), 3,
  'residente 1 no puede borrar comunicados (siguen 3)');

-- ---------------------------------------------------------------------------
-- 4. Lo que sí se permite (portería borra paquetes, admin borra comunicados)
-- ---------------------------------------------------------------------------
select pg_temp.who('33333333-3333-3333-3333-333333333333');
set local role authenticated;
delete from public.packages where id = 'b0000002-0000-0000-0000-000000000002';
insert into m (label, n) select 'staff.pkg_left', count(*)::int from public.packages;
reset role;

select pg_temp.who('44444444-4444-4444-4444-444444444444');
set local role authenticated;
delete from public.announcements where id = 'e0000003-0000-0000-0000-000000000003';
insert into m (label, n) select 'admin.ann_left', count(*)::int from public.announcements;
reset role;

select is((select n from m where label = 'staff.pkg_left'), 1,
  'portería puede borrar un paquete registrado por error (queda 1)');
select is((select n from m where label = 'admin.ann_left'), 2,
  'administración puede borrar un comunicado (quedan 2)');

select * from finish();
rollback;
