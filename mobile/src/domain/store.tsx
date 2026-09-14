import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { findCategory } from './categories';
import { makeId } from './id';
import { KipoContext, type KipoContextValue } from './kipoContext';
import { parseBankSms, parseExpenseWithFamilyRules } from './parsing';
import { buildSeedState } from './seed';
import type { Account, Budget, CategorizationRule, FamilyMember, KipoState, Reminder, SavingsGoal, SmsSuggestion, Transaction } from './types';

const STORAGE_KEY = 'kipo:test-data:v1';

// Modo local/demo: 100% AsyncStorage, sin backend — es el "Nivel 1" de
// docs/TESTING_ENVIRONMENT.md. Cuando el proyecto SÍ tiene Supabase
// configurado, mobile/app/_layout.tsx monta SupabaseKipoProvider en su lugar
// (mismo <KipoContext>, mismo useKipo() en las pantallas).
export function KipoProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<KipoState>(() => buildSeedState());
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState('user_ana');
  const hydrated = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          setState(JSON.parse(raw));
        } else {
          const seeded = buildSeedState();
          setState(seeded);
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
        }
      } catch {
        // Si el storage falla (ej. modo incógnito), seguimos con la data
        // semilla en memoria para no bloquear la app de pruebas.
      } finally {
        hydrated.current = true;
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
  }, [state]);

  const addTransactionFromText = useCallback(
    (text: string, userId: string = currentUserId): Transaction => {
      let created!: Transaction;
      setState((prev) => {
        const draft = parseExpenseWithFamilyRules(text, prev.categorizationRules);
        created = {
          id: makeId('tx'),
          userId,
          type: draft.type,
          amount: draft.amount ?? 0,
          currency: prev.baseCurrency,
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
        return { ...prev, transactions: [created, ...prev.transactions] };
      });
      return created;
    },
    [currentUserId],
  );

  const updateTransaction = useCallback((id: string, patch: Partial<Transaction>) => {
    setState((prev) => ({
      ...prev,
      transactions: prev.transactions.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }));
  }, []);

  const confirmTransaction = useCallback((id: string, patch: Partial<Transaction> = {}) => {
    setState((prev) => ({
      ...prev,
      transactions: prev.transactions.map((t) => (t.id === id ? { ...t, ...patch, status: 'confirmado' } : t)),
    }));
  }, []);

  const deleteTransaction = useCallback((id: string) => {
    setState((prev) => ({ ...prev, transactions: prev.transactions.filter((t) => t.id !== id) }));
  }, []);

  // Corregir una categoría sugerida "enseña" al parser de esta familia:
  // guarda una palabra distintiva del texto original como regla propia,
  // evaluada antes que el diccionario del sistema en la próxima captura.
  const correctCategory = useCallback((id: string, groupSlug: string, subSlug: string) => {
    setState((prev) => {
      const tx = prev.transactions.find((t) => t.id === id);
      const category = findCategory(groupSlug, subSlug);
      const transactions = prev.transactions.map((t) =>
        t.id === id ? { ...t, groupSlug, subSlug, status: 'confirmado' as const } : t,
      );

      if (!tx?.rawText || !category) return { ...prev, transactions };

      const distinctiveWord = tx.rawText
        .split(/\s+/)
        .map((w) => w.replace(/[^\p{L}]/gu, ''))
        .filter((w) => w.length > 3)
        .pop();
      if (!distinctiveWord) return { ...prev, transactions };

      const rule: CategorizationRule = { id: makeId('rule'), keyword: distinctiveWord, groupSlug, subSlug };
      return { ...prev, transactions, categorizationRules: [rule, ...prev.categorizationRules] };
    });
  }, []);

  // Simula la llegada de un SMS bancario — sustituye al listener nativo de
  // Android (que no puede ejercitarse en este entorno de pruebas web) sin
  // cambiar el parser real: es exactamente `parseBankSms` de src/parsing.
  const simulateIncomingSms = useCallback((rawSms: string): SmsSuggestion => {
    const parsed = parseBankSms(rawSms);
    const suggestion: SmsSuggestion = {
      id: makeId('sms'),
      rawSms: parsed.raw_sms,
      parsedAmount: parsed.amount,
      parsedMerchant: parsed.merchant,
      transactionType: parsed.transaction_type as SmsSuggestion['transactionType'],
      confidence: parsed.confidence as SmsSuggestion['confidence'],
      status: 'pendiente',
      receivedAt: parsed.occurred_at,
    };
    setState((prev) => ({ ...prev, smsInbox: [suggestion, ...prev.smsInbox] }));
    return suggestion;
  }, []);

  const confirmSms = useCallback(
    (id: string, overrides: Partial<Transaction> = {}) => {
      setState((prev) => {
        const sms = prev.smsInbox.find((s) => s.id === id);
        if (!sms) return prev;
        const transaction: Transaction = {
          id: makeId('tx'),
          userId: overrides.userId ?? currentUserId,
          type: 'gasto',
          amount: overrides.amount ?? sms.parsedAmount ?? 0,
          currency: prev.baseCurrency,
          groupSlug: overrides.groupSlug ?? null,
          subSlug: overrides.subSlug ?? null,
          merchant: overrides.merchant ?? sms.parsedMerchant,
          description: overrides.description ?? sms.parsedMerchant ?? 'Compra con tarjeta',
          rawText: sms.rawSms,
          source: 'sms',
          status: 'confirmado',
          occurredAt: overrides.occurredAt ?? sms.receivedAt,
        };
        return {
          ...prev,
          transactions: [transaction, ...prev.transactions],
          smsInbox: prev.smsInbox.map((s) =>
            s.id === id ? { ...s, status: 'confirmado', matchedTransactionId: transaction.id } : s,
          ),
        };
      });
    },
    [currentUserId],
  );

  const discardSms = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      smsInbox: prev.smsInbox.map((s) => (s.id === id ? { ...s, status: 'descartado' } : s)),
    }));
  }, []);

  const addBudget = useCallback((budget: Omit<Budget, 'id'>) => {
    setState((prev) => ({ ...prev, budgets: [...prev.budgets, { ...budget, id: makeId('bud') }] }));
  }, []);

  const removeBudget = useCallback((id: string) => {
    setState((prev) => ({ ...prev, budgets: prev.budgets.filter((b) => b.id !== id) }));
  }, []);

  const addReminder = useCallback((reminder: Omit<Reminder, 'id'>) => {
    setState((prev) => ({ ...prev, reminders: [...prev.reminders, { ...reminder, id: makeId('rem') }] }));
  }, []);

  const removeReminder = useCallback((id: string) => {
    setState((prev) => ({ ...prev, reminders: prev.reminders.filter((r) => r.id !== id) }));
  }, []);

  const addMember = useCallback((member: Omit<FamilyMember, 'id'>) => {
    setState((prev) => ({ ...prev, members: [...prev.members, { ...member, id: makeId('user') }] }));
  }, []);

  const addAccount = useCallback((account: Omit<Account, 'id'>) => {
    setState((prev) => ({ ...prev, accounts: [...prev.accounts, { ...account, id: makeId('acc') }] }));
  }, []);

  const removeAccount = useCallback((id: string) => {
    setState((prev) => ({ ...prev, accounts: prev.accounts.filter((a) => a.id !== id) }));
  }, []);

  const addSavingsGoal = useCallback((goal: Omit<SavingsGoal, 'id' | 'savedAmount'>) => {
    setState((prev) => ({
      ...prev,
      savingsGoals: [...prev.savingsGoals, { ...goal, id: makeId('goal'), savedAmount: 0 }],
    }));
  }, []);

  const contributeSavingsGoal = useCallback((id: string, amount: number) => {
    setState((prev) => ({
      ...prev,
      savingsGoals: prev.savingsGoals.map((g) => (g.id === id ? { ...g, savedAmount: g.savedAmount + amount } : g)),
    }));
  }, []);

  const removeSavingsGoal = useCallback((id: string) => {
    setState((prev) => ({ ...prev, savingsGoals: prev.savingsGoals.filter((g) => g.id !== id) }));
  }, []);

  const resetSeedData = useCallback(() => {
    const seeded = buildSeedState();
    setState(seeded);
  }, []);

  const value = useMemo<KipoContextValue>(
    () => ({
      state,
      loading,
      currentUserId,
      setCurrentUserId,
      addTransactionFromText,
      updateTransaction,
      confirmTransaction,
      deleteTransaction,
      correctCategory,
      simulateIncomingSms,
      confirmSms,
      discardSms,
      addBudget,
      removeBudget,
      addReminder,
      removeReminder,
      addMember,
      addAccount,
      removeAccount,
      addSavingsGoal,
      contributeSavingsGoal,
      removeSavingsGoal,
      resetSeedData,
    }),
    [
      state,
      loading,
      currentUserId,
      addTransactionFromText,
      updateTransaction,
      confirmTransaction,
      deleteTransaction,
      correctCategory,
      simulateIncomingSms,
      confirmSms,
      discardSms,
      addBudget,
      removeBudget,
      addReminder,
      removeReminder,
      addMember,
      addAccount,
      removeAccount,
      addSavingsGoal,
      contributeSavingsGoal,
      removeSavingsGoal,
      resetSeedData,
    ],
  );

  return <KipoContext.Provider value={value}>{children}</KipoContext.Provider>;
}

export { useKipo } from './kipoContext';
