-- Nexum · Permisos por columna en reservas
--
-- Supabase otorga por defecto todos los privilegios de las tablas nuevas a
-- `authenticated`, así que el GRANT por columna de migraciones anteriores no
-- restringía nada. Se quita el UPDATE de tabla completa y se deja solo lo editable:
-- zona, horario, estado (cancelar) y notas. La unidad y el usuario no se pueden cambiar.
revoke update on public.reservations from authenticated;
grant update (status, notes, amenity_id, starts_at, ends_at) on public.reservations to authenticated;
