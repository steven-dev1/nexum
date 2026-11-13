-- Nexum · Centro de ayuda
--
-- Solicitudes de ayuda, problemas o sugerencias de cualquier persona con cuenta. Cada una es un hilo
-- (`support_tickets` + `support_messages`). Quien la crea ve solo las suyas; la administración ve todas y responde.
-- Las capturas se guardan en un bucket privado (`support-files`), en una carpeta con el id de quien las sube.

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null default 'ayuda' check (kind in ('problema', 'ayuda', 'sugerencia')),
  target text not null default 'administracion' check (target in ('administracion', 'soporte_tecnico')),
  subject text not null check (char_length(subject) between 3 and 140),
  status text not null default 'abierta' check (status in ('abierta', 'en_curso', 'resuelta')),
  -- Datos útiles para quien atiende: sección, dispositivo, versión. Nunca contraseñas ni contenido del formulario.
  context jsonb not null default '{}'::jsonb,
  photo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index support_tickets_user_idx on public.support_tickets (user_id, updated_at desc);
create index support_tickets_status_idx on public.support_tickets (status, updated_at desc);

create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  author_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  from_staff boolean not null default false,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index support_messages_ticket_idx on public.support_messages (ticket_id, created_at);
create index support_messages_author_idx on public.support_messages (author_id);

revoke all on public.support_tickets, public.support_messages from anon;
revoke all on public.support_tickets, public.support_messages from authenticated;
grant select, insert on public.support_tickets, public.support_messages to authenticated;
grant update (status) on public.support_tickets to authenticated;

alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;

create policy "support_tickets: lectura" on public.support_tickets
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy "support_tickets: crea la persona" on public.support_tickets
  for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'abierta');
create policy "support_tickets: admin cambia el estado" on public.support_tickets
  for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- La RLS de support_tickets aplica dentro de la subconsulta: solo se ven/escriben mensajes de hilos propios (o todos, si es admin).
create policy "support_messages: lectura" on public.support_messages
  for select to authenticated
  using (exists (select 1 from public.support_tickets t where t.id = ticket_id));
create policy "support_messages: escribe quien ve el hilo" on public.support_messages
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and from_staff = (select private.is_admin())
    and exists (select 1 from public.support_tickets t where t.id = ticket_id)
  );

-- Al llegar un mensaje: se actualiza el hilo. Si responde la administración, pasa a «en curso»; si la persona
-- escribe en un hilo resuelto, se reabre.
create function private.on_support_message() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.support_tickets
  set updated_at = now(),
      status = case
        when new.from_staff and status = 'abierta' then 'en_curso'
        when not new.from_staff and status = 'resuelta' then 'abierta'
        else status
      end
  where id = new.ticket_id;
  return new;
end;
$$;
revoke execute on function private.on_support_message() from public, anon, authenticated;

create trigger support_messages_after_insert
  after insert on public.support_messages
  for each row execute function private.on_support_message();

-- Capturas (bucket privado): cada persona sube y ve las suyas; la administración ve todas.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('support-files', 'support-files', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "support-files: sube la persona" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'support-files' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "support-files: lectura" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'support-files'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select private.is_admin()))
  );

create policy "support-files: borra admin" on storage.objects
  for delete to authenticated
  using (bucket_id = 'support-files' and (select private.is_admin()));

alter publication supabase_realtime add table public.support_tickets, public.support_messages;
