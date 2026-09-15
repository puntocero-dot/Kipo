-- Resuelve los warnings del linter de Supabase:
--   anon_security_definer_function_executable /
--   authenticated_security_definer_function_executable
-- sobre my_family_ids/my_admin_family_ids/my_membership_ids.
--
-- Estas tres son funciones de apoyo para las policies (0005) — nunca las
-- llama el cliente directo, solo las usan las policies para no recursionar
-- sobre `users`. El problema: por vivir en `public` (el schema expuesto por
-- PostgREST) y tener `security definer`, quedan publicadas como endpoints
-- `/rest/v1/rpc/...` que cualquiera con la anon key puede invocar — no
-- filtran datos de otra familia porque hacen auth.uid() = null → 0 filas,
-- pero no tienen por qué ser un endpoint público.
--
-- Arreglo recomendado por Supabase para "función interna de RLS, no debería
-- ser invocable por RPC": moverla a un schema que PostgREST no expone (acá,
-- `private`). Las policies pueden seguir llamándola igual, calificada por
-- schema — RLS no pasa por la API HTTP. Se recrean las policies afectadas
-- apuntando a `private.*` y se borran las funciones viejas en `public`.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.my_family_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select family_id from users where auth_user_id = auth.uid();
$$;

create or replace function private.my_admin_family_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select family_id from users where auth_user_id = auth.uid() and role = 'admin';
$$;

create or replace function private.my_membership_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select id from users where auth_user_id = auth.uid();
$$;

revoke execute on function private.my_family_ids() from public;
revoke execute on function private.my_admin_family_ids() from public;
revoke execute on function private.my_membership_ids() from public;
grant execute on function private.my_family_ids() to authenticated;
grant execute on function private.my_admin_family_ids() to authenticated;
grant execute on function private.my_membership_ids() to authenticated;

-- Recrear cada policy que usaba la versión pública, ahora contra private.*.
-- Mismos nombres y misma condición que su última versión (0005/0006/0007);
-- solo cambia a qué función apuntan.

drop policy if exists family_isolation_transactions on transactions;
create policy family_isolation_transactions on transactions
  using (family_id in (select private.my_family_ids()));

drop policy if exists family_isolation_budgets on budgets;
create policy family_isolation_budgets on budgets
  using (family_id in (select private.my_family_ids()));

drop policy if exists family_isolation_savings_goals on savings_goals;
create policy family_isolation_savings_goals on savings_goals
  using (family_id in (select private.my_family_ids()));

drop policy if exists family_isolation_reminders on reminders;
create policy family_isolation_reminders on reminders
  using (family_id in (select private.my_family_ids()));

drop policy if exists own_sms_inbox on sms_inbox;
create policy own_sms_inbox on sms_inbox
  using (user_id in (select private.my_membership_ids()));

drop policy if exists members_see_own_families on families;
create policy members_see_own_families on families
  for select using (id in (select private.my_family_ids()));

drop policy if exists admins_update_own_family on families;
create policy admins_update_own_family on families
  for update using (id in (select private.my_admin_family_ids()));

drop policy if exists members_see_peers on users;
create policy members_see_peers on users
  for select using (family_id in (select private.my_family_ids()));

drop policy if exists select_categories on categories;
create policy select_categories on categories
  for select using (family_id is null or family_id in (select private.my_family_ids()));
drop policy if exists insert_own_categories on categories;
create policy insert_own_categories on categories
  for insert with check (family_id in (select private.my_family_ids()));
drop policy if exists update_own_categories on categories;
create policy update_own_categories on categories
  for update using (family_id in (select private.my_family_ids()));
drop policy if exists delete_own_categories on categories;
create policy delete_own_categories on categories
  for delete using (family_id in (select private.my_family_ids()));

drop policy if exists family_isolation_accounts on accounts;
create policy family_isolation_accounts on accounts
  using (family_id in (select private.my_family_ids()));

drop policy if exists select_categorization_rules on categorization_rules;
create policy select_categorization_rules on categorization_rules
  for select using (family_id is null or family_id in (select private.my_family_ids()));
drop policy if exists insert_own_categorization_rules on categorization_rules;
create policy insert_own_categorization_rules on categorization_rules
  for insert with check (family_id in (select private.my_family_ids()));
drop policy if exists update_own_categorization_rules on categorization_rules;
create policy update_own_categorization_rules on categorization_rules
  for update using (family_id in (select private.my_family_ids()));
drop policy if exists delete_own_categorization_rules on categorization_rules;
create policy delete_own_categorization_rules on categorization_rules
  for delete using (family_id in (select private.my_family_ids()));

drop policy if exists own_devices on devices;
create policy own_devices on devices
  using (user_id in (select private.my_membership_ids()));

drop policy if exists family_isolation_budget_alerts on budget_alerts_log;
create policy family_isolation_budget_alerts on budget_alerts_log
  using (budget_id in (select id from budgets where family_id in (select private.my_family_ids())));

drop policy if exists family_isolation_sync_log on sync_log;
create policy family_isolation_sync_log on sync_log
  using (family_id in (select private.my_family_ids()));

-- Ya sin policies que las referencien, se pueden borrar las versiones
-- públicas (0005_fix_rls_recursion.sql).
drop function if exists public.my_family_ids();
drop function if exists public.my_admin_family_ids();
drop function if exists public.my_membership_ids();

-- create_family_and_join/join_family_by_invite sí deben seguir siendo
-- RPC público — el cliente los llama directo para crear/unirse a una
-- familia — pero solo para usuarios logueados. Ya validan `auth.uid() is
-- null` adentro (0003), esto es defensa en profundidad: sin el grant de
-- `execute` no llegan ni a correr para `anon`. El grant explícito a
-- `authenticated` (0003) no se toca.
revoke execute on function create_family_and_join(text, text) from public;
revoke execute on function join_family_by_invite(text, text) from public;
