-- Nexum · Reservas editables y fotos de paquetes

-- ---------------------------------------------------------------------------
-- 1. Reservas editables (zona, horario y notas). La unidad y el usuario no se
--    pueden cambiar. Las mismas reglas de la zona aplican al editar.
-- ---------------------------------------------------------------------------
grant update (amenity_id, starts_at, ends_at) on public.reservations to authenticated;

create or replace function private.validate_reservation() returns trigger
language plpgsql set search_path = ''
as $$
declare
  a public.amenities;
  local_start timestamp;
  local_end timestamp;
  d date;
  win_start timestamp;
  win_end timestamp;
  fits boolean := false;
begin
  -- Cancelar no requiere validar horario.
  if new.status <> 'confirmada' then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status = 'confirmada' and old.starts_at <= now() then
    raise exception 'No se puede modificar una reserva que ya empezó';
  end if;

  select * into a from public.amenities where id = new.amenity_id and active;
  if not found then
    raise exception 'La zona común no está disponible';
  end if;

  if new.starts_at <= now() then
    raise exception 'La reserva debe ser a futuro';
  end if;

  local_start := new.starts_at at time zone 'America/Bogota';
  local_end := new.ends_at at time zone 'America/Bogota';

  -- La franja de un día termina al día siguiente si close_time <= open_time.
  -- Una reserva que empieza de madrugada pertenece a la franja del día anterior.
  foreach d in array array[local_start::date, local_start::date - 1] loop
    win_start := d + a.open_time;
    win_end := d + a.close_time
      + case when a.close_time <= a.open_time then interval '1 day' else interval '0' end;
    if local_start >= win_start and local_end <= win_end then
      fits := true;
      exit;
    end if;
  end loop;

  if not fits then
    raise exception 'La reserva debe quedar dentro del horario de la zona (% – %)',
      to_char(a.open_time, 'HH24:MI'), to_char(a.close_time, 'HH24:MI');
  end if;

  if new.ends_at - new.starts_at > make_interval(hours => a.max_hours) then
    raise exception 'La duración máxima es de % horas', a.max_hours;
  end if;

  return new;
end;
$$;

-- Reemplaza el trigger para que también valide al editar (sin DROP: Postgres 14+).
create or replace trigger reservations_validate
  before insert or update of amenity_id, starts_at, ends_at, status on public.reservations
  for each row execute function private.validate_reservation();

-- ---------------------------------------------------------------------------
-- 2. Foto del paquete recibido (Supabase Storage, bucket privado).
-- ---------------------------------------------------------------------------
alter table public.packages add column if not exists photo_path text;
create index if not exists packages_photo_path_idx on public.packages (photo_path) where photo_path is not null;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('package-photos', 'package-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Portería y administración suben fotos.
create policy "package-photos: personal sube" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'package-photos' and (select private.is_staff()));

-- El personal ve todas; el residente solo las de paquetes de su unidad.
create policy "package-photos: lectura" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'package-photos'
    and (
      (select private.is_staff())
      or exists (
        select 1 from public.packages p
        where p.photo_path = storage.objects.name
          and p.unit_id = (select private.unit_id())
      )
    )
  );

-- Solo administración elimina.
create policy "package-photos: admin elimina" on storage.objects
  for delete to authenticated
  using (bucket_id = 'package-photos' and (select private.is_admin()));
