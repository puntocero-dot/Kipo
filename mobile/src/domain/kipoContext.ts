// Contexto compartido por las dos implementaciones del store: KipoProvider
// (local/demo, AsyncStorage) y SupabaseKipoProvider (backend real). Ambas
// exponen exactamente la misma forma, así que las pantallas (dashboard,
// chat, sms, historial, presupuestos, recordatorios, familia) no cambian
// según cuál esté montada — mobile/app/_layout.tsx decide cuál usar según
// si hay un proyecto de Supabase configurado.
import { createContext, useContext } from 'react';
import type { Budget, FamilyMember, KipoState, Reminder, SmsSuggestion, Transaction } from './types';

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
  removeBudget: (id: string) => void;
  addReminder: (reminder: Omit<Reminder, 'id'>) => void;
  removeReminder: (id: string) => void;
  addMember: (member: Omit<FamilyMember, 'id'>) => void;
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
    inviteCode: '',
    baseCurrency: 'USD',
    members: [],
    transactions: [],
    budgets: [],
    reminders: [],
    smsInbox: [],
    categorizationRules: [],
  };
}
