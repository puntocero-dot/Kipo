-- Cierra los hallazgos WARN del Database Linter de Supabase (Advisors →
-- Security). Ninguno es explotable hoy — cada función ya valida auth.uid()
-- internamente — pero se cierran por la misma disciplina de defensa en
-- profundidad que ya sigue este proyecto (ver docs/SECURITY_AUDIT.md).

-- (1) search_path mutable: los 2 triggers que no lo tenían (todas las
-- funciones security definer ya lo tenían desde que se escribieron).
create or replace function prevent_direct_invite_code_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.invite_code is distinct from old.invite_code
     and coalesce(current_setting('kipo.allow_invite_code_change', true), '') <> 'on' then
    raise exception 'El código de invitación solo se puede cambiar con regenerate_invite_code().';
  end if;
  return new;
end;
$$;

create or replace function prevent_users_privilege_escalation()
returns trigger
language plpgsql
set search_path = public
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

-- (2) Postgres otorga EXECUTE a PUBLIC (incluye `anon`) por defecto al
-- crear una función — nunca se revocó, solo se agregó `grant ... to
-- authenticated` encima. Cada función ya se protege sola con auth.uid(),
-- pero un usuario sin sesión no debería ni poder intentar llamarlas.
revoke execute on function my_family_ids() from public;
revoke execute on function my_admin_family_ids() from public;
revoke execute on function my_membership_ids() from public;
revoke execute on function create_family_and_join(text, text) from public;
revoke execute on function join_family_by_invite(text, text) from public;
revoke execute on function regenerate_invite_code(uuid) from public;
revoke execute on function is_app_owner() from public;
revoke execute on function save_login_branding(text, text[], numeric[]) from public;
revoke execute on function set_member_status(uuid, text) from public;
-- is_app_owner() también se había otorgado a `anon` explícitamente — la app
-- solo la llama con sesión ya iniciada (mobile/src/domain/ownerStore.ts).
revoke execute on function is_app_owner() from anon;

-- (3) Los buckets ya son públicos (la lectura por URL no pasa por RLS) —
-- estas policies solo habilitaban listar todos los archivos del bucket, no
-- hace falta: la app siempre lee por getPublicUrl(), nunca por .list().
drop policy branding_public_read on storage.objects;
drop policy family_photos_public_read on storage.objects;
