-- Color de acento de la vista propia de cada usuario (por fila de
-- membresía, igual que display_name/role) — null = usa el verde de marca
-- por defecto. users_update_own_row (0003) ya permite este UPDATE y
-- prevent_users_privilege_escalation (0006) no toca esta columna, así que
-- no hace falta ninguna función nueva.
alter table users add column accent_color text;
