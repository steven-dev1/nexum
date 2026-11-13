-- Nexum · Fotos de vehículos
--
-- Cada vehículo puede tener una foto (bucket privado). El archivo vive en una carpeta con el id de la
-- unidad (`<unit_id>/<uuid>.<ext>`), lo que permite que cada residente solo suba y vea las de su unidad.
-- Portería y administración ven todas (para comparar el vehículo que llega con su foto).

alter table public.vehicles add column if not exists photo_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vehicle-photos', 'vehicle-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "vehicle-photos: sube la unidad o admin" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'vehicle-photos'
    and (
      (select private.is_admin())
      or (
        (select private.app_role()) = 'residente'
        and (storage.foldername(name))[1] = (select private.unit_id())::text
      )
    )
  );

create policy "vehicle-photos: lectura" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'vehicle-photos'
    and (
      (select private.is_staff())
      or (storage.foldername(name))[1] = (select private.unit_id())::text
    )
  );

create policy "vehicle-photos: borra la unidad o admin" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'vehicle-photos'
    and (
      (select private.is_admin())
      or (storage.foldername(name))[1] = (select private.unit_id())::text
    )
  );
