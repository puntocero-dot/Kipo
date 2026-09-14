-- Kipo — Esquema de base de datos (PostgreSQL, ej. Supabase)
-- Diseñado para: cuentas familiares multiusuario, offline-first con
-- sincronización, categorización jerárquica con contexto social, entrada por
-- SMS/chat/voz, presupuestos y recordatorios.
--
-- Notas de portabilidad a SQLite (cliente offline):
--   - uuid            -> TEXT (uuid generado en el cliente)
--   - timestamptz     -> TEXT (ISO 8601) o INTEGER (epoch ms)
--   - jsonb           -> TEXT (JSON serializado)
--   - CHECK / enums    se mantienen igual
--   - Cada tabla de negocio lleva updated_at + una tabla `sync_log` (al final)
--     para resolución de conflictos "last-write-wins" por campo.

create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ---------------------------------------------------------------------------
-- Familias y usuarios
-- ---------------------------------------------------------------------------

create table families (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  base_currency text not null default 'USD',
  invite_code   text unique not null,
  created_at    timestamptz not null default now()
);

create table users (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references families(id) on delete cascade,
  -- Vínculo a supabase.auth.users; null para perfiles "hijos" sin login
  -- propio. Sin `unique`: una misma persona puede tener varias filas (una
  -- por family_id) para pertenecer a más de un espacio de trabajo — ej. su
  -- familia y, aparte, sus finanzas personales o un segundo negocio.
  auth_user_id  uuid,
  display_name  text not null,
  email         text,
  role          text not null default 'member' check (role in ('admin', 'member', 'child')),
  created_at    timestamptz not null default now()
);

create index idx_users_auth_user_id on users (auth_user_id);

create table devices (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id) on delete cascade,
  platform      text not null check (platform in ('android', 'ios')),
  push_token    text,
  sms_reader_enabled boolean not null default false, -- solo aplica/tiene efecto en android
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Categorías (2 niveles: grupo -> subcategoría). Semilla en categorySeed.sql,
-- generada desde src/parsing/categoryDictionary.mjs para que ambas listas
-- nunca queden desincronizadas.
-- ---------------------------------------------------------------------------

create table categories (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid references families(id) on delete cascade, -- null = categoría del sistema (compartida)
  parent_id     uuid references categories(id) on delete cascade,
  slug          text not null,
  name          text not null,
  kind          text not null check (kind in ('fijo', 'necesario', 'transporte', 'alimentacion_fuera', 'salidas_convivencia')),
  icon          text,
  color         text,
  is_system     boolean not null default true,
  sort_order    int not null default 0,
  unique (family_id, slug)
);

-- Palabras clave que alimentan el parser de texto/SMS. Las del sistema tienen
-- family_id null; una familia puede agregar sinónimos propios (p. ej. el
-- nombre de su restaurante favorito) sin tocar el código.
create table categorization_rules (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid references families(id) on delete cascade,
  category_id   uuid not null references categories(id) on delete cascade,
  keyword       text not null,
  priority      int not null default 100, -- menor = se evalúa antes
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Cuentas (opcional, para saber de dónde sale el dinero) y transacciones
-- ---------------------------------------------------------------------------

create table accounts (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references families(id) on delete cascade,
  owner_id      uuid references users(id) on delete set null,
  name          text not null,
  type          text not null check (type in ('efectivo', 'debito', 'credito', 'ahorros')),
  bank_name     text, -- solo aplica a debito/credito; null en efectivo
  last_four     text, -- últimos 4 dígitos de la tarjeta, si aplica
  currency      text not null default 'USD',
  created_at    timestamptz not null default now()
);

create table transactions (
  id              uuid primary key default gen_random_uuid(),
  family_id       uuid not null references families(id) on delete cascade,
  user_id         uuid not null references users(id) on delete cascade, -- quién lo registró
  account_id      uuid references accounts(id) on delete set null,
  category_id     uuid references categories(id) on delete set null,
  type            text not null default 'gasto' check (type in ('gasto', 'ingreso')),
  amount          numeric(12,2) not null check (amount >= 0),
  currency        text not null default 'USD',
  merchant         text,
  description     text,
  raw_text        text, -- mensaje original tal como lo escribió/dictó el usuario
  source          text not null check (source in ('chat', 'voz', 'sms', 'manual', 'recurrente')),
  status          text not null default 'confirmado' check (status in ('confirmado', 'pendiente')),
  occurred_at     timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  metadata        jsonb not null default '{}'::jsonb -- ej. confidence del parser, sms_inbox_id de origen
);

create index idx_transactions_family_month on transactions (family_id, occurred_at desc);
create index idx_transactions_category on transactions (category_id);

-- ---------------------------------------------------------------------------
-- Bandeja de SMS bancarios detectados (Android). Cada fila es una sugerencia
-- pendiente de confirmar; al confirmarla se crea/vincula un registro en
-- `transactions` con source = 'sms'.
-- ---------------------------------------------------------------------------

create table sms_inbox (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references users(id) on delete cascade,
  device_id             uuid references devices(id) on delete set null,
  raw_sms               text not null,
  bank_pattern_id       text, -- id de la regla usada en smsParser.mjs, null = fallback genérico
  parsed_amount         numeric(12,2),
  parsed_merchant       text,
  parsed_transaction_type text check (parsed_transaction_type in ('compra', 'retiro', 'pago')),
  confidence            text not null check (confidence in ('high', 'medium', 'low', 'none')),
  status                text not null default 'pendiente' check (status in ('pendiente', 'confirmado', 'descartado', 'duplicado')),
  matched_transaction_id uuid references transactions(id) on delete set null,
  received_at           timestamptz not null default now(),
  created_at            timestamptz not null default now()
);

create index idx_sms_inbox_pending on sms_inbox (user_id, status) where status = 'pendiente';

-- ---------------------------------------------------------------------------
-- Presupuestos y alertas
-- ---------------------------------------------------------------------------

create table budgets (
  id              uuid primary key default gen_random_uuid(),
  family_id       uuid not null references families(id) on delete cascade,
  -- Referencia un GRUPO completo (todas sus subcategorías), no una fila
  -- puntual de `categories` — un presupuesto de "Salidas y Convivencia"
  -- debe sumar En Familia + En Pareja + Amigos, no una sola subcategoría.
  -- null = presupuesto general del mes.
  category_kind   text check (category_kind in ('fijo', 'necesario', 'transporte', 'alimentacion_fuera', 'salidas_convivencia')),
  name            text not null, -- ej. "Salidas y comida fuera"
  period          text not null default 'mensual' check (period in ('mensual')),
  amount_limit    numeric(12,2) not null,
  alert_threshold_pct int not null default 80 check (alert_threshold_pct between 1 and 100),
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);

-- Evita reenviar la misma alerta dos veces dentro del mismo período.
create table budget_alerts_log (
  id            uuid primary key default gen_random_uuid(),
  budget_id     uuid not null references budgets(id) on delete cascade,
  period_start  date not null,
  triggered_at  timestamptz not null default now(),
  message       text not null,
  unique (budget_id, period_start)
);

-- ---------------------------------------------------------------------------
-- Recordatorios de pagos fijos recurrentes
-- ---------------------------------------------------------------------------

create table reminders (
  id                uuid primary key default gen_random_uuid(),
  family_id         uuid not null references families(id) on delete cascade,
  category_id       uuid references categories(id) on delete set null,
  name              text not null, -- ej. "Internet", "Colegiatura", "Tarjeta de crédito"
  amount            numeric(12,2),
  recurrence        text not null default 'mensual' check (recurrence in ('mensual', 'semanal', 'anual', 'unico')),
  due_day_of_month  int check (due_day_of_month between 1 and 31),
  next_due_date     date not null,
  notify_days_before int not null default 3,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now()
);

create index idx_reminders_upcoming on reminders (family_id, next_due_date) where is_active;

-- ---------------------------------------------------------------------------
-- Metas de ahorro (ej. "Viaje a Guatemala"): monto meta, cuánto se lleva
-- ahorrado, y en qué cuenta está guardado ese dinero. saved_amount se
-- actualiza directo (no se deriva de transacciones) — cada aporte es una
-- acción explícita del usuario, no un gasto/ingreso más.
-- ---------------------------------------------------------------------------

create table savings_goals (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references families(id) on delete cascade,
  account_id    uuid references accounts(id) on delete set null,
  name          text not null,
  target_amount numeric(12,2) not null check (target_amount > 0),
  saved_amount  numeric(12,2) not null default 0 check (saved_amount >= 0),
  target_date   date,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

create index idx_savings_goals_family on savings_goals (family_id) where is_active;

-- ---------------------------------------------------------------------------
-- Sincronización offline-first (cliente SQLite -> Postgres)
-- Cada escritura local se encola aquí; un worker la sube cuando hay red.
-- Conflictos: last-write-wins comparando updated_at por fila.
-- ---------------------------------------------------------------------------

create table sync_log (
  id            bigserial primary key,
  family_id     uuid not null references families(id) on delete cascade,
  table_name    text not null,
  row_id        uuid not null,
  operation     text not null check (operation in ('insert', 'update', 'delete')),
  payload       jsonb not null,
  client_id     text not null, -- identifica el dispositivo que originó el cambio
  synced_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row Level Security (Supabase): cada usuario solo ve datos de su(s)
-- familia(s) — el subselect puede devolver varias filas (varios espacios de
-- trabajo) sin que estas políticas cambien.
--
-- Las funciones de abajo existen por una sola razón: evitar consultar
-- `users` directo desde dentro de una política (sea de `users` mismo o de
-- cualquier otra tabla). Si una política sobre `users` necesita volver a
-- evaluarse a sí misma para decidir si una fila es visible, Postgres entra
-- en "infinite recursion detected in policy for relation users". Al ser
-- `security definer`, estas funciones corren como dueñas de la tabla (sin
-- RLS de por medio) — mismo resultado, sin el ciclo.
-- ---------------------------------------------------------------------------

create or replace function my_family_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select family_id from users where auth_user_id = auth.uid();
$$;

create or replace function my_admin_family_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select family_id from users where auth_user_id = auth.uid() and role = 'admin';
$$;

create or replace function my_membership_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select id from users where auth_user_id = auth.uid();
$$;

grant execute on function my_family_ids() to authenticated;
grant execute on function my_admin_family_ids() to authenticated;
grant execute on function my_membership_ids() to authenticated;

alter table transactions enable row level security;
alter table budgets enable row level security;
alter table reminders enable row level security;
alter table sms_inbox enable row level security;
alter table families enable row level security;
alter table users enable row level security;
alter table categories enable row level security;
alter table accounts enable row level security;
alter table categorization_rules enable row level security;
alter table devices enable row level security;
alter table budget_alerts_log enable row level security;
alter table sync_log enable row level security;
alter table savings_goals enable row level security;

create policy family_isolation_transactions on transactions
  using (family_id in (select my_family_ids()));

create policy family_isolation_budgets on budgets
  using (family_id in (select my_family_ids()));

create policy family_isolation_savings_goals on savings_goals
  using (family_id in (select my_family_ids()));

create policy family_isolation_reminders on reminders
  using (family_id in (select my_family_ids()));

create policy own_sms_inbox on sms_inbox
  using (user_id in (select my_membership_ids()));

create policy members_see_own_families on families
  for select using (id in (select my_family_ids()));

create policy admins_update_own_family on families
  for update using (id in (select my_admin_family_ids()));

-- Sin policy de insert/update/delete a propósito: alta de membresía solo vía
-- create_family_and_join/join_family_by_invite (security definer), nunca
-- insertando family_id a mano desde el cliente.
create policy members_see_peers on users
  for select using (family_id in (select my_family_ids()));

create policy users_update_own_row on users
  for update using (auth_user_id = auth.uid());

-- Sin `with check` propio, Postgres reutiliza el `using` de arriba también
-- como check — y ese check no restringe qué columnas cambian. Sin este
-- trigger, cualquiera podría hacer UPDATE sobre su propia fila y ponerse
-- role='admin', o cambiar su family_id a una familia ajena sin invitación
-- (ver migración 0006_security_hardening.sql).
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
  return new;
end;
$$;

create trigger trg_prevent_users_privilege_escalation
  before update on users
  for each row execute function prevent_users_privilege_escalation();

-- Separado en SELECT (amplio, incluye family_id null = catálogo del
-- sistema) y escritura (solo tus propias filas, nunca family_id null) —
-- una sola policy sin `for` dejaba que cualquiera escribiera sobre el
-- catálogo global compartido (ver migración 0006_security_hardening.sql).
create policy select_categories on categories
  for select using (family_id is null or family_id in (select my_family_ids()));
create policy insert_own_categories on categories
  for insert with check (family_id in (select my_family_ids()));
create policy update_own_categories on categories
  for update using (family_id in (select my_family_ids()));
create policy delete_own_categories on categories
  for delete using (family_id in (select my_family_ids()));

create policy family_isolation_accounts on accounts
  using (family_id in (select my_family_ids()));

create policy select_categorization_rules on categorization_rules
  for select using (family_id is null or family_id in (select my_family_ids()));
create policy insert_own_categorization_rules on categorization_rules
  for insert with check (family_id in (select my_family_ids()));
create policy update_own_categorization_rules on categorization_rules
  for update using (family_id in (select my_family_ids()));
create policy delete_own_categorization_rules on categorization_rules
  for delete using (family_id in (select my_family_ids()));

create policy own_devices on devices
  using (user_id in (select my_membership_ids()));

create policy family_isolation_budget_alerts on budget_alerts_log
  using (budget_id in (select id from budgets where family_id in (select my_family_ids())));

create policy family_isolation_sync_log on sync_log
  using (family_id in (select my_family_ids()));

-- ---------------------------------------------------------------------------
-- Alta de membresía (crear familia / unirse por código de invitación).
-- security definer: pueden insertar en families/users aunque el cliente no
-- tenga policy de insert en esas tablas — el código de invitación se valida
-- aquí, en el servidor, nunca confiando en lo que mande el cliente.
-- ---------------------------------------------------------------------------

create or replace function create_family_and_join(family_name text, currency text default 'USD')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_family_id uuid;
  new_invite_code text;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión';
  end if;

  new_invite_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  insert into families (name, base_currency, invite_code)
  values (family_name, currency, new_invite_code)
  returning id into new_family_id;

  insert into users (family_id, auth_user_id, display_name, role, email)
  values (new_family_id, auth.uid(), coalesce(auth.jwt() ->> 'email', 'Yo'), 'admin', auth.jwt() ->> 'email');

  return new_family_id;
end;
$$;

create or replace function join_family_by_invite(code text, member_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_family_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión';
  end if;

  select id into target_family_id from families where invite_code = upper(code);
  if target_family_id is null then
    raise exception 'Código de invitación inválido';
  end if;

  if exists (select 1 from users where family_id = target_family_id and auth_user_id = auth.uid()) then
    raise exception 'Ya perteneces a esta familia';
  end if;

  insert into users (family_id, auth_user_id, display_name, role, email)
  values (target_family_id, auth.uid(), member_name, 'member', auth.jwt() ->> 'email');

  return target_family_id;
end;
$$;

grant execute on function create_family_and_join(text, text) to authenticated;
grant execute on function join_family_by_invite(text, text) to authenticated;
