-- Nexum · Adjuntos PDF y votaciones en asambleas
--
-- 1. `attachments`: PDF adjuntos a comunicados y asambleas (bucket privado `attachments`).
-- 2. Votaciones: `polls` (una pregunta dentro de una asamblea), `poll_options` y `poll_votes`.
--    Un voto por unidad; se vota solo con la función `cast_vote`; los resultados de una votación
--    abierta solo los ve la administración; en las secretas nadie puede ver quién votó qué.

-- ---------------------------------------------------------------------------
-- 1. Adjuntos
-- ---------------------------------------------------------------------------
create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid references public.announcements (id) on delete cascade,
  assembly_id uuid references public.assemblies (id) on delete cascade,
  file_path text not null unique,
  name text not null check (char_length(name) between 1 and 200),
  size_bytes int not null check (size_bytes between 1 and 10485760),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id),
  check (num_nonnulls(announcement_id, assembly_id) = 1)
);
create index attachments_announcement_idx on public.attachments (announcement_id) where announcement_id is not null;
create index attachments_assembly_idx on public.attachments (assembly_id) where assembly_id is not null;
create index attachments_created_by_idx on public.attachments (created_by);

revoke all on public.attachments from anon;
grant select, insert, delete on public.attachments to authenticated;
alter table public.attachments enable row level security;

-- La RLS de comunicados y asambleas aplica dentro de la subconsulta: se ve el adjunto si se ve el padre.
create policy "attachments: lectura" on public.attachments
  for select to authenticated
  using (
    exists (select 1 from public.announcements a where a.id = announcement_id)
    or exists (select 1 from public.assemblies s where s.id = assembly_id)
  );
create policy "attachments: admin agrega" on public.attachments
  for insert to authenticated with check ((select private.is_admin()));
create policy "attachments: admin elimina" on public.attachments
  for delete to authenticated using ((select private.is_admin()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('attachments', 'attachments', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

create policy "attachments: admin sube" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'attachments' and (select private.is_admin()));

create policy "attachments: lectura" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'attachments'
    and ((select private.is_admin()) or exists (select 1 from public.attachments t where t.file_path = storage.objects.name))
  );

create policy "attachments: admin elimina archivo" on storage.objects
  for delete to authenticated
  using (bucket_id = 'attachments' and (select private.is_admin()));

-- ---------------------------------------------------------------------------
-- 2. Votaciones
-- ---------------------------------------------------------------------------
create table public.polls (
  id uuid primary key default gen_random_uuid(),
  assembly_id uuid not null references public.assemblies (id) on delete cascade,
  question text not null check (char_length(question) between 3 and 300),
  description text check (char_length(description) <= 2000),
  -- secreta: nadie ve quién votó qué; nominal: la administración ve el voto de cada unidad.
  mode text not null default 'secreta' check (mode in ('secreta', 'nominal')),
  status text not null default 'abierta' check (status in ('abierta', 'cerrada')),
  closes_at timestamptz,
  closed_at timestamptz,
  reminder_sent_at timestamptz,
  results_sent_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id),
  created_at timestamptz not null default now()
);
create index polls_assembly_idx on public.polls (assembly_id);
create index polls_created_by_idx on public.polls (created_by);

create table public.poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 120),
  position int not null default 0
);
create index poll_options_poll_idx on public.poll_options (poll_id, position);

create table public.poll_votes (
  poll_id uuid not null references public.polls (id) on delete cascade,
  unit_id uuid not null references public.units (id) on delete cascade,
  option_id uuid not null references public.poll_options (id) on delete cascade,
  voted_by uuid default auth.uid() references auth.users (id),
  voted_at timestamptz not null default now(),
  primary key (poll_id, unit_id)
);
create index poll_votes_option_idx on public.poll_votes (option_id);
create index poll_votes_unit_idx on public.poll_votes (unit_id);
create index poll_votes_voted_by_idx on public.poll_votes (voted_by);

revoke all on public.polls, public.poll_options, public.poll_votes from anon;
grant select, insert, update, delete on public.polls, public.poll_options to authenticated;
grant select on public.poll_votes to authenticated;  -- los votos se escriben solo con cast_vote()

alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes enable row level security;

create policy "polls: lectura" on public.polls
  for select to authenticated using ((select private.is_member()));
create policy "polls: admin escribe" on public.polls
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "poll_options: lectura" on public.poll_options
  for select to authenticated using ((select private.is_member()));
create policy "poll_options: admin escribe" on public.poll_options
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

-- Cada unidad ve su propio voto; la administración ve el detalle solo en votaciones nominales.
create policy "poll_votes: lectura" on public.poll_votes
  for select to authenticated
  using (
    unit_id = (select private.unit_id())
    or (
      (select private.is_admin())
      and exists (select 1 from public.polls p where p.id = poll_id and p.mode = 'nominal')
    )
  );

-- Vota (o cambia el voto) por la unidad de quien llama, mientras la votación esté abierta.
create function public.cast_vote(p_poll uuid, p_option uuid) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_unit uuid;
  v_poll public.polls;
begin
  if (select auth.uid()) is null then return 'sin_sesion'; end if;

  select unit_id into v_unit from public.profiles
    where id = (select auth.uid()) and role = 'residente';
  if v_unit is null then return 'sin_unidad'; end if;

  select * into v_poll from public.polls where id = p_poll;
  if not found then return 'no_existe'; end if;
  if v_poll.status <> 'abierta' or (v_poll.closes_at is not null and v_poll.closes_at <= now()) then
    return 'cerrada';
  end if;

  if not exists (select 1 from public.poll_options where id = p_option and poll_id = p_poll) then
    return 'opcion_invalida';
  end if;

  insert into public.poll_votes (poll_id, unit_id, option_id, voted_by, voted_at)
  values (p_poll, v_unit, p_option, (select auth.uid()), now())
  on conflict (poll_id, unit_id)
  do update set option_id = excluded.option_id, voted_by = excluded.voted_by, voted_at = now();
  return 'ok';
end;
$$;

-- Votos por opción. Mientras la votación está abierta solo la administración los ve.
create function public.poll_results(p_poll uuid)
returns table (option_id uuid, votes bigint)
language sql stable security definer set search_path = ''
as $$
  select o.id, count(v.unit_id)
  from public.poll_options o
  join public.polls p on p.id = o.poll_id
  left join public.poll_votes v on v.option_id = o.id
  where o.poll_id = p_poll
    and (select private.is_member())
    and (
      (select private.is_admin())
      or p.status = 'cerrada'
      or (p.closes_at is not null and p.closes_at <= now())
    )
  group by o.id
$$;

-- Participación: unidades con residentes y cuántas ya votaron (no revela el sentido del voto).
create function public.poll_participation(p_poll uuid)
returns table (voted bigint, total bigint)
language sql stable security definer set search_path = ''
as $$
  select
    (select count(*) from public.poll_votes where poll_id = p_poll),
    (select count(distinct unit_id) from public.profiles where role = 'residente' and unit_id is not null)
  where (select private.is_member())
$$;

revoke execute on function public.cast_vote(uuid, uuid), public.poll_results(uuid), public.poll_participation(uuid)
  from public, anon;
grant execute on function public.cast_vote(uuid, uuid), public.poll_results(uuid), public.poll_participation(uuid)
  to authenticated;
