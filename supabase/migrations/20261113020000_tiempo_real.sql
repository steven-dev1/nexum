-- Nexum · Tiempo real
--
-- Se publican los cambios de las tablas que la interfaz muestra en vivo. Supabase Realtime aplica la RLS
-- de cada tabla: cada persona solo recibe los cambios de las filas que puede leer. El navegador no usa el
-- contenido del evento (solo sabe que «algo cambió» y vuelve a pedir la pantalla), así que no se expone nada
-- más de lo que ya puede ver.

alter publication supabase_realtime add table
  public.packages,
  public.announcements,
  public.assemblies,
  public.polls,
  public.poll_votes,
  public.reservations,
  public.vehicle_access_log,
  public.visits;
