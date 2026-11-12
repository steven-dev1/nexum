-- Nexum · Comunicados programados/borradores, directorio y avisos por WhatsApp
--
-- 1. Comunicados: `draft` (borrador) y programación con `published_at` a futuro. Los residentes solo ven
--    lo ya publicado; la administración ve todo. `notified_at` marca cuándo salió el aviso (push/WhatsApp).
-- 2. Directorio de teléfonos útiles y proveedores.
-- 3. WhatsApp: el residente indica su celular y acepta recibir avisos (consentimiento explícito).

-- ---------------------------------------------------------------------------
-- 1. Comunicados programados
-- ---------------------------------------------------------------------------
alter table public.announcements
  add column if not exists draft boolean not null default false,
  add column if not exists notified_at timestamptz;

-- Los comunicados que ya existían se publicaron (y avisaron) en su fecha.
update public.announcements set notified_at = published_at where notified_at is null;

alter policy "announcements: lectura segmentada" on public.announcements
  using (
    (select private.is_admin())
    or (
      not draft
      and published_at <= now()
      and (
        (select private.is_staff())
        or (
          (select private.is_member())
          and (audience = 'todos' or (audience = 'torre' and tower = (select private.tower())))
        )
      )
    )
  );

-- Para encontrar rápido los que ya toca avisar.
create index if not exists announcements_pending_notice_idx
  on public.announcements (published_at) where notified_at is null and not draft;

-- ---------------------------------------------------------------------------
-- 2. Directorio
-- ---------------------------------------------------------------------------
create table public.directory_entries (
  id uuid primary key default gen_random_uuid(),
  category text not null default 'otro'
    check (category in ('emergencia', 'administracion', 'proveedor', 'servicio', 'otro')),
  name text not null check (char_length(name) between 1 and 120),
  phone text check (char_length(phone) <= 40),
  has_whatsapp boolean not null default false,
  description text check (char_length(description) <= 500),
  schedule text check (char_length(schedule) <= 120),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index directory_entries_category_idx on public.directory_entries (category, sort_order, name);

revoke all on public.directory_entries from anon;
grant select, insert, update, delete on public.directory_entries to authenticated;
alter table public.directory_entries enable row level security;

create policy "directory_entries: lectura" on public.directory_entries
  for select to authenticated using ((select private.is_member()));
create policy "directory_entries: admin escribe" on public.directory_entries
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

-- Líneas de emergencia de Colombia (editables por la administración).
insert into public.directory_entries (category, name, phone, description, sort_order) values
  ('emergencia', 'Línea de emergencias', '123', 'Policía, ambulancia y bomberos: línea única nacional.', 1),
  ('emergencia', 'Bomberos', '119', null, 2),
  ('emergencia', 'Cruz Roja', '132', null, 3),
  ('emergencia', 'Defensa Civil', '144', null, 4),
  ('emergencia', 'Gaula (secuestro y extorsión)', '165', null, 5);

-- ---------------------------------------------------------------------------
-- 3. WhatsApp
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists whatsapp_opt_in boolean not null default false;

-- Cada persona edita solo su celular y su consentimiento (la edición de perfiles es de la administración).
create function public.update_my_contact(p_phone text, p_whatsapp boolean) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_digits text := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
begin
  if (select auth.uid()) is null then return 'sin_sesion'; end if;
  if p_whatsapp and length(v_digits) not between 10 and 15 then return 'celular_invalido'; end if;

  update public.profiles
  set phone = nullif(trim(p_phone), ''), whatsapp_opt_in = coalesce(p_whatsapp, false) and v_digits <> ''
  where id = (select auth.uid());
  return 'ok';
end;
$$;
revoke execute on function public.update_my_contact(text, boolean) from public, anon;
grant execute on function public.update_my_contact(text, boolean) to authenticated;
