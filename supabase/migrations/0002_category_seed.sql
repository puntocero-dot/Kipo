-- GENERADO por database/generate-category-seed.mjs — no editar a mano.
-- Vuelve a correr el script si cambias src/parsing/categoryDictionary.mjs.

insert into categories (family_id, parent_id, slug, name, kind, is_system, sort_order)
values
  (null, null, 'en_familia', 'En Familia', 'salidas_convivencia', true, 0),
  (null, null, 'en_pareja', 'En Pareja', 'salidas_convivencia', true, 1),
  (null, null, 'personal_amigos', 'Personales / Amigos', 'salidas_convivencia', true, 2),
  (null, null, 'gasolina', 'Gasolina', 'transporte', true, 3),
  (null, null, 'parqueo', 'Parqueos', 'transporte', true, 4),
  (null, null, 'mantenimiento_auto', 'Mantenimiento de auto', 'transporte', true, 5),
  (null, null, 'comida_rapida', 'Comida rápida', 'alimentacion_fuera', true, 6),
  (null, null, 'cafeteria', 'Cafeterías', 'alimentacion_fuera', true, 7),
  (null, null, 'domicilio', 'Pedidos a domicilio', 'alimentacion_fuera', true, 8),
  (null, null, 'restaurante', 'Restaurante', 'alimentacion_fuera', true, 9),
  (null, null, 'helados_snacks', 'Helados y snacks', 'alimentacion_fuera', true, 10),
  (null, null, 'supermercado', 'Supermercado', 'necesario', true, 11),
  (null, null, 'farmacia', 'Farmacia', 'necesario', true, 12),
  (null, null, 'mantenimiento_hogar', 'Mantenimiento del hogar', 'necesario', true, 13),
  (null, null, 'vivienda', 'Vivienda', 'fijo', true, 14),
  (null, null, 'servicios', 'Servicios', 'fijo', true, 15),
  (null, null, 'colegiaturas', 'Colegiaturas', 'fijo', true, 16),
  (null, null, 'seguros', 'Seguros', 'fijo', true, 17),
  (null, null, 'cuota_vehicular', 'Cuota vehicular', 'fijo', true, 18);

