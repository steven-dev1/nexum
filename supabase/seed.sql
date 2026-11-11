-- Datos de ejemplo para desarrollo. No ejecutar en producción.

insert into public.units (tower, number)
select t, n
from unnest(array['1', '2']) as t,
     unnest(array['101', '102', '201', '202', '301', '302']) as n
on conflict do nothing;

insert into public.amenities (name, description, capacity, deposit_cop, open_time, close_time, max_hours)
values
  ('Salón social', 'Salón para eventos con cocineta y baños.', 40, 200000, '09:00', '23:00', 6),
  ('Zona BBQ', 'Zona de asados con mesas y parrilleras.', 20, 100000, '10:00', '22:00', 5),
  ('Cancha múltiple', 'Cancha de fútbol sala y baloncesto.', 12, 0, '06:00', '21:00', 2),
  ('Gimnasio', 'Gimnasio con pesas y máquinas cardiovasculares.', 10, 0, '05:00', '21:00', 2)
on conflict do nothing;
