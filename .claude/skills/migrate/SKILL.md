---
name: migrate
description: Scaffolds la siguiente migración SQL numerada para Kipo con el formato correcto y recuerda sincronizar database/schema.sql. Úsalo cuando el usuario pida agregar/cambiar una tabla, política RLS, índice, función o cualquier cambio de esquema de base de datos.
---

# /migrate — scaffolding de migraciones para Kipo

Las migraciones viven en `database/migrations/NNNN_descripcion_corta.sql`, numeradas secuencialmente sin huecos (`0001_init.sql` … `0021_missing_family_indexes.sql` al momento de escribir esto). Nunca se editan una vez creadas y fusionadas — un hook de este mismo proyecto bloquea `Edit` sobre archivos existentes en `database/migrations/*.sql` precisamente por esto. Un cambio posterior siempre es una migración nueva.

## Pasos

1. **Determina el siguiente número.** Lista `database/migrations/` y toma el número más alto + 1, con padding a 4 dígitos (`0022`, no `22`).

2. **Nombra el archivo descriptivamente.** `NNNN_snake_case_corto.sql` — el nombre debe decir qué hace, no repetir "migration" o la fecha.

3. **Escribe el SQL.** Convenciones observadas en este repo:
   - Un comentario al inicio del archivo explicando el *por qué* del cambio cuando no es obvio (ver `0021_missing_family_indexes.sql` como ejemplo) — no hace falta si el cambio es autoexplicativo.
   - `create index if not exists` / `create table if not exists` / `drop policy if exists` — siempre idempotente, nunca asumas que la migración corre exactamente una vez en un estado limpio (el usuario la aplica a mano en el dashboard de Supabase).
   - Si agregas una tabla nueva con `family_id`: incluye `alter table ... enable row level security;`, las políticas de `select`/`insert`/`update`/`delete` usando `my_family_ids()` o `my_admin_family_ids()` según corresponda (ver el subagente `supabase-rls-reviewer` para el criterio de cuál usar), y el índice `create index if not exists idx_<tabla>_family on <tabla>(family_id);` en la misma migración — no lo dejes para después.
   - Grants: si agregas una función `SECURITY DEFINER` o RPC nueva, agrega el `grant execute` explícito solo al rol que la necesita.

4. **Sincroniza `database/schema.sql`.** Este archivo es la foto acumulada del esquema completo — aplica el mismo cambio ahí, en la sección correspondiente (no lo dejes como un diff pendiente). Esto es obligatorio, no opcional: `schema.sql` es la referencia que se lee para entender el estado actual sin tener que sumar 20+ migraciones mentalmente.

5. **Recuerda el paso manual.** Las migraciones no se auto-aplican — no hay CI/CD que las corra contra el proyecto Supabase real. Al terminar, dile al usuario explícitamente qué migración(es) nueva(s) debe aplicar a mano en el SQL Editor del dashboard de Supabase, en orden si son varias.

6. Si la migración toca RLS o roles, considera invocar el subagente `supabase-rls-reviewer` antes de darla por terminada.
