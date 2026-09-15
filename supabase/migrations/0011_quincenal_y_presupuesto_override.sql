-- (1) 'quincenal' (cada 15 días) para recordatorios recurrentes — sueldos y
-- varios pagos fijos en Centroamérica se pagan en dos quincenas ("1Q"/"2Q").
-- shiftByRecurrence en mobile/src/domain/selectors.ts avanza/retrocede 15
-- días exactos, igual que 'semanal' ya hace con 7.
alter table reminders drop constraint reminders_recurrence_check;
alter table reminders add constraint reminders_recurrence_check
  check (recurrence in ('mensual', 'semanal', 'anual', 'unico', 'quincenal'));

-- (2) Override explícito de a qué presupuesto afecta un gasto, independiente
-- de su categoría (category_id no cambia) — ej. gasolina de un viaje
-- familiar sigue contando en la categoría "Gasolina" para reportes, pero
-- puede redirigirse a un presupuesto "Vacaciones familiares" en vez del
-- presupuesto normal de Gasolina. null = comportamiento implícito de
-- siempre (se atribuye por category_kind coincidente, ver
-- computeBudgetUsage). Si se borra el presupuesto referenciado, vuelve a
-- null en vez de romper la transacción (mismo patrón que account_id).
alter table transactions add column budget_id uuid references budgets(id) on delete set null;
create index idx_transactions_budget on transactions (budget_id) where budget_id is not null;
