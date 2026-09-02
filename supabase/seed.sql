-- Datos de prueba para el ambiente de staging/QA (Familia Pérez). NO usar en
-- producción. Se aplica automáticamente con `supabase db reset` (local), o
-- manualmente contra un proyecto de staging con:
--   psql "$STAGING_DB_URL" -f supabase/seed.sql
-- Requiere que las migraciones 0001_init.sql y 0002_category_seed.sql ya se
-- hayan aplicado (traen el esquema y el catálogo de categorías del sistema).
--
-- Es la contraparte en SQL de mobile/src/domain/seed.ts (misma familia,
-- mismos montos) — así el ambiente local de la app y la base de datos de
-- staging compartida cuentan la misma historia si más adelante conectas la
-- app a Supabase en vez de a AsyncStorage.

insert into families (id, name, base_currency, invite_code)
values ('11111111-1111-1111-1111-111111111111', 'Familia Pérez', 'USD', 'PEREZ2026')
on conflict do nothing;

insert into users (id, family_id, display_name, role)
values
  ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Ana Pérez', 'admin'),
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Carlos Pérez', 'member')
on conflict do nothing;

-- Ingresos del mes en curso.
insert into transactions (family_id, user_id, type, amount, merchant, description, source, status, occurred_at)
values
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'ingreso', 1500, null, 'Salario de Ana', 'manual', 'confirmado', date_trunc('month', now())),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'ingreso', 1400, null, 'Salario de Carlos', 'manual', 'confirmado', date_trunc('month', now()));

-- Gastos de ejemplo cubriendo las 5 categorías y ambos miembros. occurred_at
-- se reparte en los últimos 20 días para que el dashboard tenga movimiento
-- sin importar qué día del mes corras este seed.
insert into transactions (family_id, user_id, category_id, type, amount, merchant, description, raw_text, source, status, occurred_at)
values
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', (select id from categories where slug = 'vivienda'), 'gasto', 650, null, 'Renta del apartamento', 'Renta del apartamento $650', 'chat', 'confirmado', now() - interval '20 days'),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', (select id from categories where slug = 'servicios'), 'gasto', 45, null, 'Internet de la casa', 'Internet de la casa $45', 'chat', 'confirmado', now() - interval '19 days'),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', (select id from categories where slug = 'colegiaturas'), 'gasto', 300, null, 'Colegiatura de los niños', 'Colegiatura de los niños $300', 'chat', 'confirmado', now() - interval '17 days'),
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', (select id from categories where slug = 'seguros'), 'gasto', 60, null, 'Seguro del carro', 'Seguro del carro $60', 'chat', 'confirmado', now() - interval '16 days'),
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', (select id from categories where slug = 'supermercado'), 'gasto', 120, null, 'Supermercado de la semana', 'Supermercado de la semana $120', 'chat', 'confirmado', now() - interval '15 days'),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', (select id from categories where slug = 'gasolina'), 'gasto', 40, null, 'Gasolina carro', 'Gasolina carro $40', 'chat', 'confirmado', now() - interval '13 days'),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', (select id from categories where slug = 'en_pareja'), 'gasto', 35, 'Restaurante', 'Almuerzo con mi esposa en restaurante', 'Almuerzo con mi esposa en restaurante $35', 'chat', 'confirmado', now() - interval '12 days'),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', (select id from categories where slug = 'personal_amigos'), 'gasto', 20, null, 'Cervezas con amigos', 'Cervezas con amigos $20', 'chat', 'confirmado', now() - interval '11 days'),
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', (select id from categories where slug = 'en_familia'), 'gasto', 25, null, 'Salida familiar al parque con niños helados', 'Salida familiar al parque con niños $25 helados', 'chat', 'confirmado', now() - interval '9 days'),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', (select id from categories where slug = 'domicilio'), 'gasto', 22, null, 'Pedimos pizza a domicilio', 'Pedimos pizza a domicilio $22', 'chat', 'confirmado', now() - interval '7 days'),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', (select id from categories where slug = 'mantenimiento_auto'), 'gasto', 50, null, 'Taller cambio de aceite', 'Taller cambio de aceite $50', 'chat', 'confirmado', now() - interval '5 days'),
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', (select id from categories where slug = 'farmacia'), 'gasto', 20, null, 'Farmacia', 'Farmacia $20', 'chat', 'confirmado', now() - interval '3 days'),
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', (select id from categories where slug = 'supermercado'), 'gasto', 60, null, 'Supermercado', 'Supermercado $60', 'chat', 'confirmado', now());

insert into budgets (family_id, category_id, name, amount_limit, alert_threshold_pct)
values
  ('11111111-1111-1111-1111-111111111111', null, 'Presupuesto general del mes', 2000, 90),
  ('11111111-1111-1111-1111-111111111111', null, 'Salidas y Convivencia', 150, 80),
  ('11111111-1111-1111-1111-111111111111', null, 'Alimentación fuera', 120, 80);

-- El presupuesto por categoría se vincula a un `kind` completo (todas las
-- subcategorías de ese grupo) — como budgets.category_id apunta a UNA fila
-- de `categories`, en producción crea una fila "agregadora" por kind o suma
-- varias filas de budget, según prefieras (ver docs/DATABASE_SCHEMA.md).

insert into reminders (family_id, category_id, name, amount, recurrence, next_due_date, notify_days_before)
values
  ('11111111-1111-1111-1111-111111111111', null, 'Tarjeta de crédito', 250, 'mensual', (current_date + 1), 3),
  ('11111111-1111-1111-1111-111111111111', (select id from categories where slug = 'servicios'), 'Internet', 45, 'mensual', (current_date + 3), 3),
  ('11111111-1111-1111-1111-111111111111', (select id from categories where slug = 'colegiaturas'), 'Colegiatura', 300, 'mensual', (current_date + 6), 5),
  ('11111111-1111-1111-1111-111111111111', (select id from categories where slug = 'seguros'), 'Seguro del carro', 60, 'mensual', (current_date + 20), 5);

insert into sms_inbox (user_id, raw_sms, parsed_amount, parsed_merchant, parsed_transaction_type, confidence, status)
values
  ('22222222-2222-2222-2222-222222222222', 'Compra aprobada por $18.50 en CAFETERIA EXPRESS el ' || to_char(now(), 'DD/MM'), 18.50, 'Cafeteria Express', 'compra', 'high', 'pendiente'),
  ('33333333-3333-3333-3333-333333333333', 'Su tarjeta terminada en 4521 fue debitada por $65.00 en SUPERMERCADO LA COLONIA', 65.00, 'Supermercado La Colonia', 'compra', 'high', 'pendiente');
