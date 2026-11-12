-- Comunicados enriquecidos: contenido estructurado (JSON de Tiptap), marca de edición e imágenes.
--
-- `body` se conserva como texto plano (resumen para notificaciones y respaldo); `content` guarda el
-- documento con formato. Los comunicados antiguos tienen `content` nulo y se muestran con `body`.

alter table public.announcements
  add column if not exists content jsonb,
  add column if not exists edited_at timestamptz;

-- Imágenes pegadas en los comunicados (bucket privado; se sirven con URL firmada de corta duración).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('announcement-images', 'announcement-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "announcement-images: admin sube" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'announcement-images' and (select private.is_admin()));

-- La administración ve todas; el resto solo las imágenes de comunicados que ya puede leer
-- (la RLS de `announcements` aplica dentro de la subconsulta, así que respeta la segmentación por torre).
create policy "announcement-images: lectura" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'announcement-images'
    and (
      (select private.is_admin())
      or exists (
        select 1 from public.announcements a
        where position(storage.objects.name in a.content::text) > 0
      )
    )
  );

create policy "announcement-images: admin elimina" on storage.objects
  for delete to authenticated
  using (bucket_id = 'announcement-images' and (select private.is_admin()));
