-- Nexum · Corregir registros de paquetería
--
-- Portería registra los paquetes y también los comete mal: hasta ahora solo la
-- administración podía borrar una fila (y su foto). Se amplía a personal
-- (admin y portería), igual que para registrar y entregar.
--
-- Los comunicados no necesitan cambios: la política "announcements: admin
-- escribe" es FOR ALL, así que el DELETE ya estaba permitido a administración
-- (y las lecturas se caen con ON DELETE CASCADE).

drop policy if exists "packages: admin elimina" on public.packages;
create policy "packages: personal elimina" on public.packages
  for delete to authenticated using ((select private.is_staff()));

drop policy if exists "package-photos: admin elimina" on storage.objects;
create policy "package-photos: personal elimina" on storage.objects
  for delete to authenticated
  using (bucket_id = 'package-photos' and (select private.is_staff()));
