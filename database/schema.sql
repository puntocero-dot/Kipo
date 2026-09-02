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
  auth_user_id  uuid unique, -- vínculo a supabase.auth.users, null para perfiles "hijos" sin login propio
  display_name  text not null,
  email         text,
  role          text not null default 'member' check (role in ('admin', 'member', 'child')),
  created_at    timestamptz not null default now()
);

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
  category_id     uuid references categories(id) on delete cascade, -- null = presupuesto general del mes
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
-- Row Level Security (Supabase): cada usuario solo ve datos de su familia
-- ---------------------------------------------------------------------------

alter table transactions enable row level security;
alter table budgets enable row level security;
alter table reminders enable row level security;
alter table sms_inbox enable row level security;

create policy family_isolation_transactions on transactions
  using (family_id in (select family_id from users where auth_user_id = auth.uid()));

create policy family_isolation_budgets on budgets
  using (family_id in (select family_id from users where auth_user_id = auth.uid()));

create policy family_isolation_reminders on reminders
  using (family_id in (select family_id from users where auth_user_id = auth.uid()));

create policy own_sms_inbox on sms_inbox
  using (user_id in (select id from users where auth_user_id = auth.uid()));
