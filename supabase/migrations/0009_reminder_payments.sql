-- "Marcar como pagado" para pagos fijos recurrentes: en vez de volver a
-- escribir el gasto cada mes (colegiatura, tarjeta de crédito, internet...),
-- el usuario toca un botón, declara cuánto pagó, y eso crea el gasto y avanza
-- next_due_date al siguiente ciclo — ver markReminderPaid en supabaseStore.tsx.

alter table reminders add column account_id uuid references accounts(id) on delete set null;
alter table reminders add column last_paid_amount numeric(12,2);
alter table reminders add column last_paid_at timestamptz;
alter table reminders add column last_paid_transaction_id uuid references transactions(id) on delete set null;
