-- Categorías de ingreso: hasta ahora un ingreso no tenía categoría en el
-- esquema (categoryDictionary.mjs solo tenía grupos de gasto) — todo se
-- mostraba como "Ingreso" genérico. Se pidió poder distinguir salario,
-- aguinaldo, bono vacacional, remesas familiares y reembolsos igual que
-- se distinguen los gastos — ver src/parsing/categoryDictionary.mjs
-- (grupo `ingresos`, kind: 'ingreso').

alter table categories drop constraint categories_kind_check;
alter table categories add constraint categories_kind_check
  check (kind in ('fijo', 'necesario', 'transporte', 'alimentacion_fuera', 'salidas_convivencia', 'ingreso'));

insert into categories (family_id, parent_id, slug, name, kind, is_system, sort_order)
values
  (null, null, 'salario', 'Salario', 'ingreso', true, 19),
  (null, null, 'aguinaldo', 'Aguinaldo', 'ingreso', true, 20),
  (null, null, 'bono_vacacional', 'Bono vacacional', 'ingreso', true, 21),
  (null, null, 'remesas_familiares', 'Remesas familiares', 'ingreso', true, 22),
  (null, null, 'reembolso', 'Reembolso', 'ingreso', true, 23),
  (null, null, 'otros_ingresos', 'Otros ingresos', 'ingreso', true, 24);
