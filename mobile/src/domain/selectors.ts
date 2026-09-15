import { GROUP_LABELS, categoryColor } from './categories';
import type { Budget, Reminder, Transaction } from './types';

export function isSameMonth(iso: string, reference: Date): boolean {
  const d = new Date(iso);
  return d.getFullYear() === reference.getFullYear() && d.getMonth() === reference.getMonth();
}

export function monthTransactions(transactions: Transaction[], reference = new Date()): Transaction[] {
  return transactions.filter((t) => isSameMonth(t.occurredAt, reference));
}

export interface MonthSummary {
  income: number;
  expenses: number;
  balance: number;
}

export function computeMonthSummary(transactions: Transaction[], reference = new Date()): MonthSummary {
  const monthTx = monthTransactions(transactions, reference);
  const income = monthTx.filter((t) => t.type === 'ingreso').reduce((sum, t) => sum + t.amount, 0);
  const expenses = monthTx.filter((t) => t.type === 'gasto').reduce((sum, t) => sum + t.amount, 0);
  return { income, expenses, balance: income - expenses };
}

// Agrupa gastos del mes en 3 macro-grupos para la dona del dashboard, tal
// como lo pide el pedido original: Fijos vs Variables (Necesarios+Transporte)
// vs Salidas/Ocio (Alimentación fuera + Salidas y Convivencia).
export interface MacroSlice {
  key: 'fijos' | 'variables' | 'salidas';
  label: string;
  amount: number;
  pct: number;
  color: string;
}

const MACRO_MAP: Record<string, MacroSlice['key']> = {
  fijos: 'fijos',
  necesarios: 'variables',
  transporte: 'variables',
  alimentacion_fuera: 'salidas',
  salidas_convivencia: 'salidas',
};

const MACRO_META: Record<MacroSlice['key'], { label: string; color: string }> = {
  fijos: { label: 'Gastos Fijos', color: categoryColor('fijos') },
  variables: { label: 'Variables (necesarios + transporte)', color: categoryColor('transporte') },
  salidas: { label: 'Salidas y Ocio', color: categoryColor('salidas_convivencia') },
};

export function computeMacroDistribution(transactions: Transaction[], reference = new Date()): MacroSlice[] {
  const monthExpenses = monthTransactions(transactions, reference).filter((t) => t.type === 'gasto');
  const totals: Record<MacroSlice['key'], number> = { fijos: 0, variables: 0, salidas: 0 };

  for (const t of monthExpenses) {
    const macro = t.groupSlug ? MACRO_MAP[t.groupSlug] : undefined;
    if (macro) totals[macro] += t.amount;
  }

  const grandTotal = totals.fijos + totals.variables + totals.salidas || 1;
  return (Object.keys(totals) as MacroSlice['key'][]).map((key) => ({
    key,
    label: MACRO_META[key].label,
    color: MACRO_META[key].color,
    amount: totals[key],
    pct: totals[key] / grandTotal,
  }));
}

export interface BudgetUsage extends Budget {
  spent: number;
  pct: number;
  status: 'ok' | 'warning' | 'over';
}

export function computeBudgetUsage(
  budgets: Budget[],
  transactions: Transaction[],
  reference = new Date(),
): BudgetUsage[] {
  const monthExpenses = monthTransactions(transactions, reference).filter((t) => t.type === 'gasto');
  const specificGroupSlugs = new Set(budgets.filter((b) => b.groupSlug).map((b) => b.groupSlug));

  return budgets.map((budget) => {
    // Si la transacción tiene un budgetId explícito, gana sobre el match por
    // categoría — así un gasto puede reportar como "Gasolina" pero contar
    // contra "Vacaciones familiares" en vez del presupuesto normal de
    // gasolina. El presupuesto general (groupSlug null) suma lo que NADIE
    // más ya reclamó (ni un budgetId explícito hacia otro presupuesto, ni
    // una categoría cubierta por un presupuesto específico) — así cada
    // gasto cuenta hacia exactamente un presupuesto, nunca dos.
    const spent = budget.groupSlug
      ? monthExpenses
          .filter((t) => (t.budgetId ? t.budgetId === budget.id : t.groupSlug === budget.groupSlug))
          .reduce((s, t) => s + t.amount, 0)
      : monthExpenses
          .filter((t) => (t.budgetId ? t.budgetId === budget.id : !t.groupSlug || !specificGroupSlugs.has(t.groupSlug)))
          .reduce((s, t) => s + t.amount, 0);
    const pct = budget.amountLimit > 0 ? spent / budget.amountLimit : 0;
    const status: BudgetUsage['status'] = pct >= 1 ? 'over' : pct >= budget.alertThresholdPct / 100 ? 'warning' : 'ok';
    return { ...budget, spent, pct, status };
  });
}

// Presupuesto que aplicaría por defecto a esta categoría si no se elige uno
// explícito — primer presupuesto cuyo groupSlug coincide; si no existe, cae
// al presupuesto general (groupSlug null); si tampoco existe, no hay default.
export function resolveDefaultBudgetId(budgets: Budget[], groupSlug: string | null): string | null {
  const specific = groupSlug ? budgets.find((b) => b.groupSlug === groupSlug) : undefined;
  if (specific) return specific.id;
  return budgets.find((b) => b.groupSlug === null)?.id ?? null;
}

export function computeUpcomingReminders(reminders: Reminder[], withinDays = 7, reference = new Date()): Reminder[] {
  const limit = new Date(reference);
  limit.setDate(limit.getDate() + withinDays);
  return reminders
    .filter((r) => r.isActive && new Date(r.nextDueDate) <= limit)
    .sort((a, b) => new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime());
}

export function daysUntil(dateIso: string, reference = new Date()): number {
  const ms = new Date(dateIso).setHours(0, 0, 0, 0) - new Date(reference).setHours(0, 0, 0, 0);
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

// Mueve la fecha de vencimiento de un recordatorio recurrente un ciclo hacia
// adelante (al marcarlo pagado) o hacia atrás (al deshacer un pago) — 'unico'
// no se mueve, ese recordatorio no se repite.
export function shiftByRecurrence(dateIso: string, recurrence: Reminder['recurrence'], direction: 1 | -1 = 1): string {
  const d = new Date(dateIso);
  switch (recurrence) {
    case 'semanal':
      d.setDate(d.getDate() + 7 * direction);
      break;
    case 'quincenal':
      d.setDate(d.getDate() + 15 * direction);
      break;
    case 'mensual':
      d.setMonth(d.getMonth() + 1 * direction);
      break;
    case 'anual':
      d.setFullYear(d.getFullYear() + 1 * direction);
      break;
    case 'unico':
      break;
  }
  return d.toISOString().slice(0, 10);
}

export function groupLabel(groupSlug: string | null): string {
  if (!groupSlug) return 'Sin categorizar';
  return GROUP_LABELS[groupSlug] ?? groupSlug;
}

const MONTH_NAMES_SHORT = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

// "Hoy" / "Ayer" / "12 sep" (o "12 sep 2025" si no es el año en curso) — para
// agrupar el historial por día real, no solo mostrar una lista plana.
export function formatDayLabel(iso: string, reference = new Date()): string {
  const d = new Date(iso);
  const startOf = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diffDays = Math.round((startOf(reference) - startOf(d)) / 86400000);
  if (diffDays === 0) return 'Hoy';
  if (diffDays === 1) return 'Ayer';
  const day = `${d.getDate()} ${MONTH_NAMES_SHORT[d.getMonth()]}`;
  return d.getFullYear() === reference.getFullYear() ? day : `${day} ${d.getFullYear()}`;
}

// "3:45 p.m."
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es', { hour: 'numeric', minute: '2-digit' });
}

export interface MonthOption {
  key: string; // "2026-09"
  label: string; // "Septiembre 2026"
}

const MONTH_NAMES_LONG = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export function monthKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export interface MonthTrendPoint {
  key: string; // "2026-09"
  label: string; // "Sep"
  income: number;
  expenses: number;
}

// Últimos `monthsBack` meses (incluyendo el actual), del más antiguo al más
// reciente — para el dashboard comparativo. Incluye meses sin movimientos
// (en 0) para que la evolución se vea completa, no solo los meses con datos.
export function computeMonthlyTrend(transactions: Transaction[], monthsBack = 6, reference = new Date()): MonthTrendPoint[] {
  const points: MonthTrendPoint[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(reference.getFullYear(), reference.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const monthTx = transactions.filter((t) => monthKey(t.occurredAt) === key);
    points.push({
      key,
      label: MONTH_NAMES_SHORT[d.getMonth()],
      income: monthTx.filter((t) => t.type === 'ingreso').reduce((s, t) => s + t.amount, 0),
      expenses: monthTx.filter((t) => t.type === 'gasto').reduce((s, t) => s + t.amount, 0),
    });
  }
  return points;
}

// Meses con al menos un movimiento, más recientes primero — para poblar el
// selector de mes del Historial sin inventar meses vacíos.
export function availableMonths(transactions: Transaction[]): MonthOption[] {
  const keys = new Set(transactions.map((t) => monthKey(t.occurredAt)));
  return Array.from(keys)
    .sort((a, b) => (a < b ? 1 : -1))
    .map((key) => {
      const [year, month] = key.split('-').map(Number);
      return { key, label: `${MONTH_NAMES_LONG[month - 1]} ${year}` };
    });
}
