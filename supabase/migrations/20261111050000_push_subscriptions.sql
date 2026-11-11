-- Nexum · Notificaciones push (Web Push)
--
-- Un dispositivo (endpoint) por usuario. Cada usuario gestiona los suyos; el personal
-- (administración y portería) puede leerlos y limpiar los vencidos para poder avisar a
-- los residentes cuando registra un paquete o publica un comunicado.

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

revoke all on public.push_subscriptions from anon;
grant select, insert, update, delete on public.push_subscriptions to authenticated;

alter table public.push_subscriptions enable row level security;

create policy "push: ver propias o personal" on public.push_subscriptions
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_staff()));

create policy "push: registrar propias" on public.push_subscriptions
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "push: actualizar propias" on public.push_subscriptions
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "push: borrar propias o personal" on public.push_subscriptions
  for delete to authenticated
  using (user_id = (select auth.uid()) or (select private.is_staff()));
