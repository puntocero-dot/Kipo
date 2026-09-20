-- Las políticas de insert/update/delete de `categories` solo revisaban
-- family_id (cualquier miembro de la familia podía agregar, editar o borrar
-- categorías personalizadas), aunque la UI (CategoryPickerModal.tsx) solo le
-- ofrece el botón "+ Agregar categoría" a un admin. Sin este chequeo, un
-- miembro no-admin con su propia sesión válida podía llamar el insert
-- directo (curl/devtools) saltándose la restricción de la UI. Mismo patrón
-- ya usado por families/regenerate_invite_code/set_member_status:
-- my_admin_family_ids() en vez de my_family_ids().
drop policy if exists insert_own_categories on categories;
drop policy if exists update_own_categories on categories;
drop policy if exists delete_own_categories on categories;

create policy insert_own_categories on categories
  for insert with check (family_id in (select my_admin_family_ids()));
create policy update_own_categories on categories
  for update using (family_id in (select my_admin_family_ids()));
create policy delete_own_categories on categories
  for delete using (family_id in (select my_admin_family_ids()));
