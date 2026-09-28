-- family_id se filtra constantemente (consultas del cliente + subqueries de
-- RLS vía my_family_ids()/my_admin_family_ids()) en estas 5 tablas, pero
-- ninguna tenía índice — Postgres dependía de un escaneo completo filtrado
-- por RLS en cada consulta. categories es la más urgente: acumula filas del
-- sistema + de TODAS las familias en una sola tabla global, y
-- fetchCategoryMaps() (mobile/src/domain/categoriesRemote.ts) la trae sin
-- filtrar del lado del cliente, dependiendo 100% de RLS + este índice para
-- acotar la búsqueda.
create index if not exists idx_users_family on users (family_id);
create index if not exists idx_categories_family on categories (family_id);
create index if not exists idx_categorization_rules_family on categorization_rules (family_id);
create index if not exists idx_accounts_family on accounts (family_id);
create index if not exists idx_budgets_family on budgets (family_id);
