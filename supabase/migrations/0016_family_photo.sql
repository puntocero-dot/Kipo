-- Foto de familia, editable por un admin — mismo mecanismo que el nombre:
-- admins_update_own_family (0003) ya permite el UPDATE directo, sin RPC
-- nueva.
alter table families add column photo_url text;
