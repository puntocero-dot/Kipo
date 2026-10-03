-- Permite a un administrador borrar un espacio de trabajo completo.
--
-- No había forma de hacerlo: `families` no tiene policy de DELETE (a propósito,
-- para que un borrado accidental no pase por la API REST directa). Se expone
-- como RPC con chequeo explícito de rol admin; el `on delete cascade` de las
-- tablas hijas (users, transactions, budgets, etc.) limpia todo lo demás.

create or replace function delete_family(target_family_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión';
  end if;

  if not exists (
    select 1 from users
    where family_id = target_family_id
      and auth_user_id = auth.uid()
      and role = 'admin'
      and status = 'active'
  ) then
    raise exception 'Solo un administrador puede borrar el espacio';
  end if;

  delete from families where id = target_family_id;
end;
$$;

revoke execute on function delete_family(uuid) from public;
revoke execute on function delete_family(uuid) from anon;
grant execute on function delete_family(uuid) to authenticated;
