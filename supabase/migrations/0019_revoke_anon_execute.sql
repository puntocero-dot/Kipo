-- Sigue del hallazgo `anon_security_definer_function_executable` de
-- 0018_lint_hardening.sql: revocar EXECUTE de `public` no bastó para 8 de
-- las 9 funciones — solo desapareció para `is_app_owner()`, la única a la
-- que también se le revocó de `anon` explícitamente. Causa real: el setup
-- por defecto de un proyecto Supabase corre algo como
-- `alter default privileges in schema public grant execute on functions
-- to anon, authenticated` al crearlo, así que cada función nueva recibe
-- EXECUTE otorgado DIRECTO a `anon`/`authenticated`, no vía el rol PUBLIC
-- — revocar de `public` no toca esos grants directos. Se revoca `anon`
-- explícitamente en las 8 funciones que faltaban.
--
-- El hallazgo hermano (`authenticated_security_definer_function_executable`)
-- se queda tal cual para las 9 — es intencional que un usuario con sesión
-- pueda llamarlas, es justamente para eso que existen.
revoke execute on function my_family_ids() from anon;
revoke execute on function my_admin_family_ids() from anon;
revoke execute on function my_membership_ids() from anon;
revoke execute on function create_family_and_join(text, text) from anon;
revoke execute on function join_family_by_invite(text, text) from anon;
revoke execute on function regenerate_invite_code(uuid) from anon;
revoke execute on function save_login_branding(text, text[], numeric[]) from anon;
revoke execute on function set_member_status(uuid, text) from anon;
