-- Auditoría de seguridad — cierra tres huecos reales encontrados en las
-- políticas RLS existentes (0003/0005). Ninguno requiere cambios en la app:
-- son puramente del lado de la base de datos.
--
-- HALLAZGO CRÍTICO (el que importa de verdad):
-- `users_update_own_row` (0003) es `using (auth_user_id = auth.uid())` sin
-- `with check` propio — Postgres reutiliza el mismo `using` como check, y
-- ese check no restringe QUÉ columnas se pueden cambiar. Como la fila
-- resultante sigue teniendo `auth_user_id = auth.uid()` (nunca lo tocan),
-- cualquier usuario autenticado puede hacer UPDATE sobre su propia fila en
-- `users` y:
--   a) cambiar su `role` a 'admin' dentro de su familia actual, o
--   b) cambiar su `family_id` a CUALQUIER family_id que exista — sin
--      código de invitación — y quedar viendo las transacciones, miembros
--      y presupuestos de una familia ajena.
-- Ambos casos son consecuencia directa de que la policy no distingue "esta
-- fila es tuya" (correcto) de "puedes convertirla en lo que quieras"
-- (nunca fue la intención). El fix es un trigger — RLS por sí solo no
-- puede comparar la fila vieja contra la nueva en una sola expresión de
-- forma limpia, y un trigger corre siempre, incluso para las funciones
-- security definer (que de cualquier forma solo hacen INSERT, nunca
-- UPDATE, sobre esta tabla).
create or replace function prevent_users_privilege_escalation()
returns trigger
language plpgsql
as $$
begin
  if new.family_id is distinct from old.family_id then
    raise exception 'No se puede cambiar de familia editando el perfil directamente.';
  end if;
  if new.role is distinct from old.role then
    raise exception 'El rol no se puede cambiar desde el cliente.';
  end if;
  if new.auth_user_id is distinct from old.auth_user_id then
    raise exception 'No se puede reasignar la identidad de esta fila.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_users_privilege_escalation on users;
create trigger trg_prevent_users_privilege_escalation
  before update on users
  for each row execute function prevent_users_privilege_escalation();

-- HALLAZGO MEDIO: `visible_categories` y
-- `family_isolation_categorization_rules` (0003) también son policies sin
-- `for`, aplicando el mismo `using` a INSERT/UPDATE/DELETE. Como esa
-- condición es "family_id is null OR ... my_family_ids()", CUALQUIER
-- usuario autenticado puede insertar/editar/borrar las categorías y reglas
-- DEL SISTEMA (family_id null, compartidas por todas las familias) — no es
-- fuga de datos de otra familia, pero sí vandalismo posible del catálogo
-- global. Se separan en policies de SELECT (amplia, como antes) y de
-- escritura (solo sus propias filas, nunca family_id null).
drop policy if exists visible_categories on categories;
create policy select_categories on categories
  for select using (family_id is null or family_id in (select my_family_ids()));
create policy insert_own_categories on categories
  for insert with check (family_id in (select my_family_ids()));
create policy update_own_categories on categories
  for update using (family_id in (select my_family_ids()));
create policy delete_own_categories on categories
  for delete using (family_id in (select my_family_ids()));

drop policy if exists family_isolation_categorization_rules on categorization_rules;
create policy select_categorization_rules on categorization_rules
  for select using (family_id is null or family_id in (select my_family_ids()));
create policy insert_own_categorization_rules on categorization_rules
  for insert with check (family_id in (select my_family_ids()));
create policy update_own_categorization_rules on categorization_rules
  for update using (family_id in (select my_family_ids()));
create policy delete_own_categorization_rules on categorization_rules
  for delete using (family_id in (select my_family_ids()));
