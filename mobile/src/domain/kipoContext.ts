// Contexto compartido por las dos implementaciones del store: KipoProvider
// (local/demo, AsyncStorage) y SupabaseKipoProvider (backend real). Ambas
// exponen exactamente la misma forma, así que las pantallas (dashboard,
// chat, sms, historial, presupuestos, recordatorios, familia) no cambian
// según cuál esté montada — mobile/app/_layout.tsx decide cuál usar según
// si hay un proyecto de Supabase configurado.
import { createContext, useContext } from 'react';
import type { CategoryOption } from './categories';
import type { Account, Budget, FamilyMember, KipoState, Reminder, SavingsGoal, SmsSuggestion, Transaction } from './types';

export interface KipoContextValue {
  state: KipoState;
  loading: boolean;
  currentUserId: string;
  setCurrentUserId: (id: string) => void;
  addTransactionFromText: (text: string, userId?: string) => Transaction;
  updateTransaction: (id: string, patch: Partial<Transaction>) => void;
  confirmTransaction: (id: string, patch?: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;
  correctCategory: (id: string, groupSlug: string, subSlug: string) => void;
  simulateIncomingSms: (rawSms: string) => SmsSuggestion;
  confirmSms: (id: string, overrides?: Partial<Transaction>) => void;
  discardSms: (id: string) => void;
  addBudget: (budget: Omit<Budget, 'id'>) => void;
  updateBudget: (id: string, patch: Partial<Omit<Budget, 'id'>>) => void;
  removeBudget: (id: string) => void;
  addReminder: (reminder: Omit<Reminder, 'id'>) => void;
  removeReminder: (id: string) => void;
  // Marca el ciclo actual de un recordatorio recurrente como pagado: crea el
  // gasto correspondiente y avanza nextDueDate al siguiente ciclo — así el
  // usuario nunca tiene que volver a "escribirlo" en el chat cada mes.
  markReminderPaid: (id: string, amount: number, accountId?: string | null) => void;
  // Revierte el último pago marcado (borra el gasto creado y regresa
  // nextDueDate al ciclo anterior) — por si se tocó por error.
  undoReminderPayment: (id: string) => void;
  addMember: (member: Omit<FamilyMember, 'id'>) => void;
  // Invalida el código actual y genera uno nuevo — solo un admin puede
  // hacerlo (ver regenerate_invite_code() en Supabase / family.tsx).
  regenerateInviteCode: () => void;
  // Nombre/foto de familia — un admin edita, visibles para todos.
  updateFamilyProfile: (patch: { name?: string; photoUrl?: string | null }) => void;
  // Color de acento de la vista propia del usuario actual — self-service,
  // sin permiso de admin.
  setAccentColor: (color: string | null) => void;
  // Suspende/reactiva a OTRO miembro — solo un admin puede hacerlo. No borra
  // datos, solo revoca/restaura el acceso (ver users.status).
  setMemberStatus: (memberId: string, status: 'active' | 'suspended') => void;
  // Subcategoría nueva dentro de un grupo macro ya existente (ej. "Parqueo
  // mensual" en Transporte) — solo un admin la ofrece en la UI (ver
  // CategoryPickerModal.tsx), aunque a nivel de datos cualquier miembro de
  // la familia podría (mismo círculo de confianza que el resto).
  addCustomCategory: (input: { groupSlug: string; label: string }) => void;
  addAccount: (account: Omit<Account, 'id'>) => void;
  removeAccount: (id: string) => void;
  addSavingsGoal: (goal: Omit<SavingsGoal, 'id' | 'savedAmount'>) => void;
  contributeSavingsGoal: (id: string, amount: number) => void;
  removeSavingsGoal: (id: string) => void;
  resetSeedData: () => void;
}

export const KipoContext = createContext<KipoContextValue | null>(null);

export function useKipo(): KipoContextValue {
  const ctx = useContext(KipoContext);
  if (!ctx) throw new Error('useKipo debe usarse dentro de <KipoProvider> o <SupabaseKipoProvider>');
  return ctx;
}

export function emptyKipoState(): KipoState {
  return {
    familyName: '',
    familyPhotoUrl: null,
    inviteCode: '',
    baseCurrency: 'USD',
    members: [],
    transactions: [],
    budgets: [],
    reminders: [],
    smsInbox: [],
    categorizationRules: [],
    accounts: [],
    savingsGoals: [],
    customCategories: [],
  };
}
