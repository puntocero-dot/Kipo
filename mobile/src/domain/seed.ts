// Datos de prueba realistas para el ambiente de staging/QA. Las transacciones
// de gasto se generan pasando texto en lenguaje natural por el MISMO parser
// que usa la app en producción (parseExpenseWithFamilyRules) — así la data
// semilla también sirve para validar visualmente que el parser categoriza
// bien, no son datos inventados a mano desconectados de la lógica real.
import { makeId } from './id';
import { parseExpenseWithFamilyRules, parseBankSms } from './parsing';
import type { Budget, FamilyMember, KipoState, Reminder, SmsSuggestion, Transaction } from './types';

// La semilla se ve bien sin importar qué día del mes se ejecute la demo: los
// 34 mensajes se reparten proporcionalmente entre el día 1 y "hoy" del mes en
// curso (en vez de "hace N días", que en los primeros días de un mes calendario
// dejaría casi todo el histórico cayendo en el mes anterior y el dashboard de
// "mes actual" vacío). El orden de SEED_MESSAGES es del más antiguo al más
// reciente dentro de ese rango.
function spreadWithinCurrentMonth(indexFromOldest: number, total: number, hour: number): Date {
  const today = new Date();
  const dayOfMonth = today.getDate();
  const day = Math.max(1, Math.round(((indexFromOldest + 1) / total) * dayOfMonth));
  return new Date(today.getFullYear(), today.getMonth(), day, hour, 30, 0, 0);
}

// Un puñado de movimientos del mes anterior, solo para que el historial y los
// filtros por fecha tengan algo que mostrar cruzando el límite de mes.
function daysAgoLastMonth(daysBeforeMonthStart: number, hour = 13): Date {
  const today = new Date();
  const firstOfThisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  firstOfThisMonth.setDate(firstOfThisMonth.getDate() - daysBeforeMonthStart);
  firstOfThisMonth.setHours(hour, 30, 0, 0);
  return firstOfThisMonth;
}

function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

const ANA = 'user_ana';
const CARLOS = 'user_carlos';

// Mensajes del mes en curso, del más antiguo al más reciente ("hoy") —
// cubre las 5 categorías y ambos miembros. Las fechas se calculan repartiendo
// este orden entre el día 1 y hoy (ver spreadWithinCurrentMonth).
const SEED_MESSAGES: [string, string][] = [
  ['Renta del apartamento $650', ANA],
  ['Internet de la casa $45', CARLOS],
  ['Agua y luz $80', ANA],
  ['Colegiatura de los niños $300', CARLOS],
  ['Seguro del carro $60', ANA],
  ['Supermercado de la semana $120', ANA],
  ['Farmacia medicinas $25', CARLOS],
  ['Gasolina carro $40', CARLOS],
  ['Parqueo del centro comercial $5', ANA],
  ['Almuerzo con mi esposa en restaurante $35', CARLOS],
  ['Cervezas con amigos $20', CARLOS],
  ['Cafe con amigas $8', ANA],
  ['Salida familiar al parque con niños $25 helados', ANA],
  ['Comida rapida con los niños $18', CARLOS],
  ['Pedimos pizza a domicilio $22', ANA],
  ['Taller cambio de aceite $50', CARLOS],
  ['Cena de aniversario con mi esposa $70', CARLOS],
  ['Supermercado despensa del mes $150', ANA],
  ['Gasolina $38', ANA],
  ['Farmacia $15', CARLOS],
  ['Ferreteria para reparar la casa $30', ANA],
  ['Cita con mi esposa al cine $28', CARLOS],
  ['Parqueo $6', CARLOS],
  ['Salida con mis amigos al bar $30', CARLOS],
  ['Almuerzo rapido de trabajo $12', ANA],
  ['Gasolina carro $42', CARLOS],
  ['Supermercado $95', ANA],
  ['Cafeteria con mi esposa $10', ANA],
  ['Parque con la familia $15 helados', CARLOS],
  ['Farmacia $20', ANA],
  ['Domicilio de comida $19', CARLOS],
  ['Gasolina $36', ANA],
  ['Cervezas con mis amigos $25', CARLOS],
  ['Supermercado $60', ANA],
];

// Un par de movimientos del mes anterior, solo para historial/filtros.
const LAST_MONTH_MESSAGES: [number, string, string][] = [
  [6, 'Cena de aniversario con mi esposa $55', CARLOS],
  [3, 'Supermercado del mes pasado $110', ANA],
];

function buildSeedTransactions(): Transaction[] {
  const expenses: Transaction[] = SEED_MESSAGES.map(([text, userId], index) => {
    const when = spreadWithinCurrentMonth(index, SEED_MESSAGES.length, 12 + (index % 6));
    const draft = parseExpenseWithFamilyRules(text, [], when);
    return {
      id: makeId('tx'),
      userId,
      type: 'gasto',
      amount: draft.amount ?? 0,
      currency: 'USD',
      groupSlug: draft.groupSlug,
      subSlug: draft.subSlug,
      merchant: draft.merchant,
      description: draft.description,
      rawText: draft.rawText,
      source: 'chat',
      status: draft.needsReview ? 'pendiente' : 'confirmado',
      occurredAt: draft.occurredAt,
      confidence: draft.confidence,
    };
  });

  const lastMonthExpenses: Transaction[] = LAST_MONTH_MESSAGES.map(([daysBeforeMonthStart, text, userId]) => {
    const when = daysAgoLastMonth(daysBeforeMonthStart);
    const draft = parseExpenseWithFamilyRules(text, [], when);
    return {
      id: makeId('tx'),
      userId,
      type: 'gasto',
      amount: draft.amount ?? 0,
      currency: 'USD',
      groupSlug: draft.groupSlug,
      subSlug: draft.subSlug,
      merchant: draft.merchant,
      description: draft.description,
      rawText: draft.rawText,
      source: 'chat',
      status: draft.needsReview ? 'pendiente' : 'confirmado',
      occurredAt: draft.occurredAt,
      confidence: draft.confidence,
    };
  });

  const firstOfMonth = new Date();
  firstOfMonth.setDate(1);
  firstOfMonth.setHours(9, 0, 0, 0);

  const incomes: Transaction[] = [
    {
      id: makeId('tx'),
      userId: ANA,
      type: 'ingreso',
      amount: 1500,
      currency: 'USD',
      groupSlug: null,
      subSlug: null,
      merchant: null,
      description: 'Salario de Ana',
      rawText: null,
      source: 'manual',
      status: 'confirmado',
      occurredAt: firstOfMonth.toISOString(),
    },
    {
      id: makeId('tx'),
      userId: CARLOS,
      type: 'ingreso',
      amount: 1400,
      currency: 'USD',
      groupSlug: null,
      subSlug: null,
      merchant: null,
      description: 'Salario de Carlos',
      rawText: null,
      source: 'manual',
      status: 'confirmado',
      occurredAt: firstOfMonth.toISOString(),
    },
  ];

  return [...incomes, ...expenses, ...lastMonthExpenses].sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  );
}

function buildSeedBudgets(): Budget[] {
  return [
    { id: makeId('bud'), name: 'Presupuesto general del mes', groupSlug: null, amountLimit: 2000, alertThresholdPct: 90 },
    { id: makeId('bud'), name: 'Salidas y Convivencia', groupSlug: 'salidas_convivencia', amountLimit: 150, alertThresholdPct: 80 },
    { id: makeId('bud'), name: 'Alimentación fuera', groupSlug: 'alimentacion_fuera', amountLimit: 120, alertThresholdPct: 80 },
  ];
}

function buildSeedReminders(): Reminder[] {
  return [
    { id: makeId('rem'), name: 'Tarjeta de crédito', amount: 250, recurrence: 'mensual', nextDueDate: daysFromNow(1), notifyDaysBefore: 3, isActive: true },
    { id: makeId('rem'), name: 'Internet', amount: 45, recurrence: 'mensual', nextDueDate: daysFromNow(3), notifyDaysBefore: 3, isActive: true },
    { id: makeId('rem'), name: 'Colegiatura', amount: 300, recurrence: 'mensual', nextDueDate: daysFromNow(6), notifyDaysBefore: 5, isActive: true },
    { id: makeId('rem'), name: 'Seguro del carro', amount: 60, recurrence: 'mensual', nextDueDate: daysFromNow(20), notifyDaysBefore: 5, isActive: true },
  ];
}

function buildSeedSmsInbox(): SmsSuggestion[] {
  const raw1 = 'Compra aprobada por $18.50 en CAFETERIA EXPRESS el ' + new Date().toLocaleDateString('es-GT');
  const raw2 = 'Su tarjeta terminada en 4521 fue debitada por $65.00 en SUPERMERCADO LA COLONIA';
  const p1 = parseBankSms(raw1);
  const p2 = parseBankSms(raw2);
  return [p1, p2].map((p) => ({
    id: makeId('sms'),
    rawSms: p.raw_sms,
    parsedAmount: p.amount,
    parsedMerchant: p.merchant,
    transactionType: p.transaction_type as SmsSuggestion['transactionType'],
    confidence: p.confidence as SmsSuggestion['confidence'],
    status: 'pendiente',
    receivedAt: p.occurred_at,
  }));
}

export function buildSeedState(): KipoState {
  const members: FamilyMember[] = [
    { id: ANA, name: 'Ana Pérez', role: 'admin' },
    { id: CARLOS, name: 'Carlos Pérez', role: 'member' },
  ];

  return {
    familyName: 'Familia Pérez',
    inviteCode: 'PEREZ2026',
    baseCurrency: 'USD',
    members,
    transactions: buildSeedTransactions(),
    budgets: buildSeedBudgets(),
    reminders: buildSeedReminders(),
    smsInbox: buildSeedSmsInbox(),
    categorizationRules: [],
  };
}
