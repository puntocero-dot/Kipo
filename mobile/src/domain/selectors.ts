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

  return budgets.map((budget) => {
    const spent = budget.groupSlug
      ? monthExpenses.filter((t) => t.groupSlug === budget.groupSlug).reduce((s, t) => s + t.amount, 0)
      : monthExpenses.reduce((s, t) => s + t.amount, 0);
    const pct = budget.amountLimit > 0 ? spent / budget.amountLimit : 0;
    const status: BudgetUsage['status'] = pct >= 1 ? 'over' : pct >= budget.alertThresholdPct / 100 ? 'warning' : 'ok';
    return { ...budget, spent, pct, status };
  });
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

export function groupLabel(groupSlug: string | null): string {
  if (!groupSlug) return 'Sin categorizar';
  return GROUP_LABELS[groupSlug] ?? groupSlug;
}
