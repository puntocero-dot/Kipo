-- Multi-tenant real: una misma persona (auth.users) puede pertenecer a más
-- de una familia/espacio de trabajo (ej. su familia y, aparte, sus finanzas
-- personales, o llevar la contabilidad de dos negocios). Antes,
-- `auth_user_id` era `unique` en `users`, lo que limitaba a una sola
-- membresía por persona — ese era el único obstáculo real, porque `users`
-- ya modelaba "membresía en una familia" separado de la identidad global
-- (`auth_user_id`), así que agregar una segunda fila con el mismo
-- `auth_user_id` y otro `family_id` ya es, conceptualmente, un segundo
-- espacio de trabajo. Las políticas RLS de más abajo (y las ya existentes en
-- database/schema.sql) usan `family_id in (select ... where auth_user_id =
-- auth.uid())`, que ya funciona igual de bien devolviendo 1 o varias filas.

alter table users drop constraint if exists users_auth_user_id_key;
create index if not exists idx_users_auth_user_id on users (auth_user_id);

-- ---------------------------------------------------------------------------
-- RLS que faltaba: `families`, `users`, `categories`, `accounts`,
-- `categorization_rules`, `devices`, `budget_alerts_log`, `sync_log`.
-- La migración inicial solo protegía transactions/budgets/reminders/
-- sms_inbox — sin esto, cualquier usuario autenticado podía leer o escribir
-- las demás tablas de cualquier familia vía la API de Supabase.
-- ---------------------------------------------------------------------------

alter table families enable row level security;
alter table users enable row level security;
alter table categories enable row level security;
alter table accounts enable row level security;
alter table categorization_rules enable row level security;
alter table devices enable row level security;
alter table budget_alerts_log enable row level security;
alter table sync_log enable row level security;

create policy members_see_own_families on families
  for select using (id in (select family_id from users where auth_user_id = auth.uid()));

create policy admins_update_own_family on families
  for update using (id in (select family_id from users where auth_user_id = auth.uid() and role = 'admin'));

-- Ver a los compañeros de cualquier espacio al que pertenezcas. Sin policy de
-- insert/update/delete a propósito: alta de membresía solo vía las funciones
-- de abajo (security definer), para no permitir que alguien se autoasigne a
-- una familia ajena escribiendo family_id a mano.
create policy members_see_peers on users
  for select using (family_id in (select u.family_id from users u where u.auth_user_id = auth.uid()));

create policy users_update_own_row on users
  for update using (auth_user_id = auth.uid());

create policy visible_categories on categories
  for select using (family_id is null or family_id in (select family_id from users where auth_user_id = auth.uid()));

create policy family_isolation_accounts on accounts
  using (family_id in (select family_id from users where auth_user_id = auth.uid()));

create policy family_isolation_categorization_rules on categorization_rules
  using (family_id is null or family_id in (select family_id from users where auth_user_id = auth.uid()));

create policy own_devices on devices
  using (user_id in (select id from users where auth_user_id = auth.uid()));

create policy family_isolation_budget_alerts on budget_alerts_log
  using (budget_id in (
    select b.id from budgets b
    where b.family_id in (select family_id from users where auth_user_id = auth.uid())
  ));

create policy family_isolation_sync_log on sync_log
  using (family_id in (select family_id from users where auth_user_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- Alta de membresía: solo a través de estas dos funciones (security definer),
-- nunca insertando directo en `families`/`users` desde el cliente. Así el
-- código de invitación se valida en el servidor y nadie puede unirse a una
-- familia ajena adivinando o filtrando su family_id.
-- ---------------------------------------------------------------------------

create or replace function create_family_and_join(family_name text, currency text default 'USD')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_family_id uuid;
  new_invite_code text;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión';
  end if;

  new_invite_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  insert into families (name, base_currency, invite_code)
  values (family_name, currency, new_invite_code)
  returning id into new_family_id;

  insert into users (family_id, auth_user_id, display_name, role, email)
  values (new_family_id, auth.uid(), coalesce(auth.jwt() ->> 'email', 'Yo'), 'admin', auth.jwt() ->> 'email');

  return new_family_id;
end;
$$;

create or replace function join_family_by_invite(code text, member_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_family_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión';
  end if;

  select id into target_family_id from families where invite_code = upper(code);
  if target_family_id is null then
    raise exception 'Código de invitación inválido';
  end if;

  if exists (select 1 from users where family_id = target_family_id and auth_user_id = auth.uid()) then
    raise exception 'Ya perteneces a esta familia';
  end if;

  insert into users (family_id, auth_user_id, display_name, role, email)
  values (target_family_id, auth.uid(), member_name, 'member', auth.jwt() ->> 'email');

  return target_family_id;
end;
$$;

grant execute on function create_family_and_join(text, text) to authenticated;
grant execute on function join_family_by_invite(text, text) to authenticated;
