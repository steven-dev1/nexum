-- Nexum · Horarios que cruzan la medianoche y personal sin unidad
--
-- 1. Administración y portería no pertenecen a una unidad: no reciben paquetes
--    ni reservan a título propio (gestionan los de todos).
-- 2. Una zona común puede abrir a las 18:00 y cerrar a las 02:00 del día siguiente.

update public.profiles set unit_id = null where role <> 'residente' and unit_id is not null;

alter table public.profiles
  add constraint profiles_staff_without_unit check (role = 'residente' or unit_id is null);

-- Apertura = cierre no tiene sentido (sería una franja de 0 o 24 horas ambigua).
alter table public.amenities
  add constraint amenities_open_close_distinct check (open_time <> close_time);

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
  select * into a from public.amenities where id = new.amenity_id and active;
  if not found then
    raise exception 'La zona común no está disponible';
  end if;

  if new.status = 'confirmada' and new.starts_at <= now() then
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
