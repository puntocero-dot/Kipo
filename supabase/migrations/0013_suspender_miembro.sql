-- Suspender/quitar a un miembro desde la app, sin tocar el dashboard de
-- Supabase ni necesitar una Edge Function con service_role (ver
-- docs/SECURITY_AUDIT.md §4). Insight: my_family_ids()/my_admin_family_ids()/
-- my_membership_ids() (0003) ya son el único punto por donde pasa TODO el
-- acceso RLS de un usuario a los datos de su familia — si se les exige
-- status='active' sobre la fila propia del llamante, suspender a alguien le
-- corta el acceso a los datos de la familia en la siguiente consulta, sin
-- borrar nada.
alter table users add column status text not null default 'active' check (status in ('active', 'suspended'));

create or replace function my_family_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select family_id from users where auth_user_id = auth.uid() and status = 'active';
$$;

create or replace function my_admin_family_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select family_id from users where auth_user_id = auth.uid() and role = 'admin' and status = 'active';
$$;

create or replace function my_membership_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select id from users where auth_user_id = auth.uid() and status = 'active';
$$;

-- El status solo debe cambiar vía set_member_status() de abajo — mismo
-- mecanismo de escape (set_config) que ya usa este trigger para
-- family_id/role/auth_user_id (ver 0006_security_hardening.sql).
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
  if new.status is distinct from old.status
     and coalesce(current_setting('kipo.allow_status_change', true), '') <> 'on' then
    raise exception 'El estado de la membresía solo se puede cambiar con set_member_status().';
  end if;
  return new;
end;
$$;

-- Deliberadamente sin borrado físico: transactions.user_id references
-- users(id) on delete cascade — borrar la fila de un miembro borraría todo
-- su historial de gastos. "Quitar" a alguien es suspenderlo: revoca acceso
-- al instante, sin perder datos.
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
  if not exists (select 1 from my_admin_family_ids() f where f = target_family) then
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

grant execute on function set_member_status(uuid, text) to authenticated;
