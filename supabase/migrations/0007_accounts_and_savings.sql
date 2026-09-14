-- Feature: declarar medio de pago (banco/tarjeta) por cuenta, y metas de
-- ahorro ligadas a una cuenta. `accounts` ya existía (0001) pero sin UI ni
-- columnas para identificar banco/tarjeta; `savings_goals` es nueva.

alter table accounts add column if not exists bank_name text;
alter table accounts add column if not exists last_four text;

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

alter table savings_goals enable row level security;

-- Mismo patrón que budgets/reminders: visibilidad y escritura por
-- pertenencia a la familia, no por "dueño" de la fila — no aplica aquí el
-- problema de 0006 (ese era sobre una policy de "esta fila es tuya" que no
-- restringía qué columnas cambiar; acá la condición es "tu familia", y
-- cambiarla solo te saca de ver tu propia meta, no te mete a otra).
create policy family_isolation_savings_goals on savings_goals
  using (family_id in (select my_family_ids()));

create index idx_savings_goals_family on savings_goals (family_id) where is_active;
