// Tipos de dominio en camelCase, alineados 1:1 con database/schema.sql
// (ver docs/DATABASE_SCHEMA.md). `groupSlug`/`subSlug` corresponden a
// categories.kind/slug una vez migrado a Postgres.

export type TransactionSource = 'chat' | 'voz' | 'sms' | 'manual' | 'recurrente';
export type TransactionStatus = 'confirmado' | 'pendiente';
export type Confidence = 'high' | 'medium' | 'low' | 'none';

export interface FamilyMember {
  id: string;
  name: string;
  role: 'admin' | 'member' | 'child';
}

export interface Transaction {
  id: string;
  userId: string;
  type: 'gasto' | 'ingreso';
  amount: number;
  currency: string;
  groupSlug: string | null;
  subSlug: string | null;
  merchant: string | null;
  description: string;
  rawText: string | null;
  source: TransactionSource;
  status: TransactionStatus;
  occurredAt: string;
  confidence?: Confidence;
  accountId?: string | null;
  // Override explícito de a qué presupuesto afecta este gasto, independiente
  // de su categoría (groupSlug/subSlug) — ver computeBudgetUsage. null/undefined
  // = comportamiento implícito: se atribuye al presupuesto cuyo groupSlug
  // coincide con esta transacción, como siempre. Un id explícito redirige el
  // gasto a OTRO presupuesto sin cambiar su categoría (ej. gasolina de un
  // viaje familiar sigue reportando como "Gasolina" pero cuenta contra
  // "Vacaciones familiares" en vez del presupuesto normal de gasolina).
  budgetId?: string | null;
}

export type AccountType = 'efectivo' | 'debito' | 'credito' | 'ahorros';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  bankName: string | null;
  lastFour: string | null;
  currency: string;
}

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  savedAmount: number;
  accountId: string | null;
  targetDate: string | null; // fecha ISO (solo día), opcional
  isActive: boolean;
}

export interface Budget {
  id: string;
  name: string;
  groupSlug: string | null; // null = presupuesto general del mes
  amountLimit: number;
  alertThresholdPct: number;
}

export interface Reminder {
  id: string;
  name: string;
  amount: number | null;
  recurrence: 'mensual' | 'semanal' | 'anual' | 'unico' | 'quincenal';
  nextDueDate: string; // fecha ISO (solo día)
  notifyDaysBefore: number;
  isActive: boolean;
  groupSlug: string | null; // categoría del gasto que se crea al marcar "Pagado"
  subSlug: string | null;
  accountId: string | null; // medio de pago habitual
  lastPaidAmount: number | null;
  lastPaidAt: string | null; // fecha/hora ISO del último pago registrado
  lastPaidTransactionId: string | null; // permite deshacer el último pago
}

export interface SmsSuggestion {
  id: string;
  rawSms: string;
  parsedAmount: number | null;
  parsedMerchant: string | null;
  transactionType: 'compra' | 'retiro' | 'pago' | 'deposito';
  confidence: Confidence;
  status: 'pendiente' | 'confirmado' | 'descartado';
  receivedAt: string;
  matchedTransactionId?: string;
}

export interface CategorizationRule {
  id: string;
  keyword: string;
  groupSlug: string;
  subSlug: string;
}

export interface KipoState {
  familyName: string;
  inviteCode: string;
  baseCurrency: string;
  members: FamilyMember[];
  transactions: Transaction[];
  budgets: Budget[];
  reminders: Reminder[];
  smsInbox: SmsSuggestion[];
  categorizationRules: CategorizationRule[];
  accounts: Account[];
  savingsGoals: SavingsGoal[];
}
