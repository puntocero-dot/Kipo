-- Regenerar el código de invitación desde la app (antes solo se podía con un
-- UPDATE manual en el SQL Editor — ver docs/SECURITY_AUDIT.md §4). Un admin
-- de familia ahora puede invalidar el código actual y generar uno nuevo con
-- un botón, sin salir de la app.

-- El código solo debe cambiar vía regenerate_invite_code() de abajo —
-- admins_update_own_family (0003) sigue permitiendo que un admin edite
-- directo `name`/`base_currency`, pero este trigger bloquea que también
-- ponga a mano cualquier valor en `invite_code`, para que siempre pase por
-- la generación aleatoria + chequeo de colisión de la función. Mismo
-- mecanismo de "set_config como escape hatch" que ya usa el proyecto (ver
-- prevent_users_privilege_escalation, 0006).
create or replace function prevent_direct_invite_code_change()
returns trigger
language plpgsql
as $$
begin
  if new.invite_code is distinct from old.invite_code
     and coalesce(current_setting('kipo.allow_invite_code_change', true), '') <> 'on' then
    raise exception 'El código de invitación solo se puede cambiar con regenerate_invite_code().';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_direct_invite_code_change on families;
create trigger trg_prevent_direct_invite_code_change
  before update on families
  for each row execute function prevent_direct_invite_code_change();

create or replace function regenerate_invite_code(target_family_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  new_code text;
begin
  if not exists (select 1 from my_admin_family_ids() f where f = target_family_id) then
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

grant execute on function regenerate_invite_code(uuid) to authenticated;
