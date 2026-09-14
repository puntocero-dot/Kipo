-- Corrige "infinite recursion detected in policy for relation users".
--
-- `members_see_peers` (en users) y varias otras políticas de la migración
-- 0003 filtraban con `family_id in (select family_id from users where
-- auth_user_id = auth.uid())` — un subselect directo a `users` desde dentro
-- de una política sobre esa misma tabla (o desde políticas de otras tablas
-- que también terminan consultando `users`). Para decidir si una fila de
-- `users` es visible, Postgres tiene que volver a evaluar esa misma política
-- sobre `users`, que a su vez... entra en bucle. Eso es lo que causaba el
-- 500 al cargar las membresías después de iniciar sesión.
--
-- El arreglo estándar: mover ese lookup a una función `security definer`
-- (corre como dueña de las tablas, sin RLS de por medio) y hacer que las
-- políticas llamen a la función en vez de consultar `users` directo. La
-- función sigue devolviendo exactamente lo mismo — nada cambia para el
-- usuario, solo se rompe el ciclo.

create or replace function my_family_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select family_id from users where auth_user_id = auth.uid();
$$;

create or replace function my_admin_family_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select family_id from users where auth_user_id = auth.uid() and role = 'admin';
$$;

create or replace function my_membership_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select id from users where auth_user_id = auth.uid();
$$;

grant execute on function my_family_ids() to authenticated;
grant execute on function my_admin_family_ids() to authenticated;
grant execute on function my_membership_ids() to authenticated;

drop policy if exists family_isolation_transactions on transactions;
create policy family_isolation_transactions on transactions
  using (family_id in (select my_family_ids()));

drop policy if exists family_isolation_budgets on budgets;
create policy family_isolation_budgets on budgets
  using (family_id in (select my_family_ids()));

drop policy if exists family_isolation_reminders on reminders;
create policy family_isolation_reminders on reminders
  using (family_id in (select my_family_ids()));

drop policy if exists own_sms_inbox on sms_inbox;
create policy own_sms_inbox on sms_inbox
  using (user_id in (select my_membership_ids()));

drop policy if exists members_see_own_families on families;
create policy members_see_own_families on families
  for select using (id in (select my_family_ids()));

drop policy if exists admins_update_own_family on families;
create policy admins_update_own_family on families
  for update using (id in (select my_admin_family_ids()));

-- Esta es la que de verdad se auto-referenciaba (policy de `users` que
-- consultaba `users`).
drop policy if exists members_see_peers on users;
create policy members_see_peers on users
  for select using (family_id in (select my_family_ids()));

drop policy if exists visible_categories on categories;
create policy visible_categories on categories
  for select using (family_id is null or family_id in (select my_family_ids()));

drop policy if exists family_isolation_accounts on accounts;
create policy family_isolation_accounts on accounts
  using (family_id in (select my_family_ids()));

drop policy if exists family_isolation_categorization_rules on categorization_rules;
create policy family_isolation_categorization_rules on categorization_rules
  using (family_id is null or family_id in (select my_family_ids()));

drop policy if exists own_devices on devices;
create policy own_devices on devices
  using (user_id in (select my_membership_ids()));

drop policy if exists family_isolation_budget_alerts on budget_alerts_log;
create policy family_isolation_budget_alerts on budget_alerts_log
  using (budget_id in (select id from budgets where family_id in (select my_family_ids())));

drop policy if exists family_isolation_sync_log on sync_log;
create policy family_isolation_sync_log on sync_log
  using (family_id in (select my_family_ids()));
