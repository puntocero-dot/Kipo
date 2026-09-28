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
-- schema — RLS no pasa por la API HTTP.
--
-- Importante: se preserva el chequeo `status = 'active'` que ya tienen las
-- tres funciones desde 0013_suspender_miembro.sql — no es la versión
-- original de 0005, es la versión vigente hoy en database/schema.sql.

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
  select family_id from users where auth_user_id = auth.uid() and status = 'active';
$$;

create or replace function private.my_admin_family_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select family_id from users where auth_user_id = auth.uid() and role = 'admin' and status = 'active';
$$;

create or replace function private.my_membership_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select id from users where auth_user_id = auth.uid() and status = 'active';
$$;

revoke execute on function private.my_family_ids() from public;
revoke execute on function private.my_admin_family_ids() from public;
revoke execute on function private.my_membership_ids() from public;
grant execute on function private.my_family_ids() to authenticated;
grant execute on function private.my_admin_family_ids() to authenticated;
grant execute on function private.my_membership_ids() to authenticated;
revoke execute on function private.my_family_ids() from anon;
revoke execute on function private.my_admin_family_ids() from anon;
revoke execute on function private.my_membership_ids() from anon;

-- Recrear cada policy que usaba la versión pública, ahora contra private.*.
-- Mismos nombres y misma condición que su última versión en
-- database/schema.sql; solo cambia a qué función apuntan. sms_inbox ya no
-- existe (ver 0020_remove_sms_inbox.sql) así que own_sms_inbox no se recrea.

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

drop policy if exists members_see_own_families on families;
create policy members_see_own_families on families
  for select using (id in (select private.my_family_ids()));

drop policy if exists admins_update_own_family on families;
create policy admins_update_own_family on families
  for update using (id in (select private.my_admin_family_ids()));

drop policy if exists members_see_peers on users;
create policy members_see_peers on users
  for select using (family_id in (select private.my_family_ids()));

-- Categorías: select amplio (incluye catálogo del sistema), escritura solo
-- admin — ver 0021_categories_admin_only.sql para el porqué de admin aquí.
drop policy if exists select_categories on categories;
create policy select_categories on categories
  for select using (family_id is null or family_id in (select private.my_family_ids()));
drop policy if exists insert_own_categories on categories;
create policy insert_own_categories on categories
  for insert with check (family_id in (select private.my_admin_family_ids()));
drop policy if exists update_own_categories on categories;
create policy update_own_categories on categories
  for update using (family_id in (select private.my_admin_family_ids()));
drop policy if exists delete_own_categories on categories;
create policy delete_own_categories on categories
  for delete using (family_id in (select private.my_admin_family_ids()));

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

-- Dos funciones RPC (no policies) también llamaban a la versión pública
-- directo en su cuerpo — se recrean idénticas, solo apuntando a private.*.
create or replace function regenerate_invite_code(target_family_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  new_code text;
begin
  if not exists (select 1 from private.my_admin_family_ids() f where f = target_family_id) then
    raise exception 'Solo un administrador de la familia puede regenerar el código.';
  end if;

  loop
    new_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    exit when not exists (select 1 from families where invite_code = new_code);
  end loop;

  perform set_config('kipo.allow_invite_code_change', 'on', true);
  update families set invite_code = new_code where id = target_family_id;

  return new_code;
end;
$$;

create or replace function set_member_status(target_user_id uuid, new_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_family uuid;
  caller_row uuid;
begin
  if new_status not in ('active', 'suspended') then
    raise exception 'Estado inválido.';
  end if;

  select family_id into target_family from users where id = target_user_id;
  if target_family is null then
    raise exception 'Miembro no encontrado.';
  end if;
  if not exists (select 1 from private.my_admin_family_ids() f where f = target_family) then
    raise exception 'Solo un administrador puede cambiar el estado de un miembro.';
  end if;

  select id into caller_row from users where auth_user_id = auth.uid() and family_id = target_family;
  if caller_row = target_user_id then
    raise exception 'No puedes suspenderte a ti mismo.';
  end if;

  perform set_config('kipo.allow_status_change', 'on', true);
  update users set status = new_status where id = target_user_id;
end;
$$;

-- Dos policies de Storage (family-photos) también llamaban la versión
-- pública directo.
drop policy if exists family_photos_admin_write on storage.objects;
create policy family_photos_admin_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'family-photos' and (storage.foldername(name))[1]::uuid in (select private.my_admin_family_ids()));
drop policy if exists family_photos_admin_update on storage.objects;
create policy family_photos_admin_update on storage.objects
  for update to authenticated
  using (bucket_id = 'family-photos' and (storage.foldername(name))[1]::uuid in (select private.my_admin_family_ids()));

-- Ya sin nada que las referencie, se pueden borrar las versiones públicas.
drop function if exists public.my_family_ids();
drop function if exists public.my_admin_family_ids();
drop function if exists public.my_membership_ids();
