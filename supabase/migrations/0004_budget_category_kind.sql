-- budgets.category_id apuntaba a UNA fila de `categories` (una subcategoría
-- puntual, ej. "en_pareja"), pero un presupuesto como "Salidas y
-- Convivencia" necesita sumar TODO el grupo (En Familia + En Pareja +
-- Amigos), no una sola subcategoría — ya quedaba anotado como pendiente en
-- docs/DATABASE_SCHEMA.md. Se reemplaza por `category_kind`, que referencia
-- el grupo completo (categories.kind), igual que el `groupSlug` que ya usa
-- la app — sin necesidad de join para saber a qué grupo pertenece un gasto.

alter table budgets add column category_kind text
  check (category_kind in ('fijo', 'necesario', 'transporte', 'alimentacion_fuera', 'salidas_convivencia'));

alter table budgets drop column if exists category_id;
