// Misma interfaz que src/domain/store.tsx (KipoContext/useKipo), pero
// respaldada por Postgres/Supabase en vez de AsyncStorage — así las
// pantallas no cambian una línea según cuál esté montada. Se activa cuando
// hay un proyecto de Supabase configurado y el usuario ya seleccionó un
// espacio de trabajo (mobile/app/_layout.tsx decide cuál montar).
//
// Estrategia de sincronización (deliberadamente simple para esta primera
// versión, ver docs/TESTING_ENVIRONMENT.md § Nivel 3): cada acción escribe
// directo a Supabase y actualiza el estado local al terminar; una
// suscripción de Supabase Realtime vuelve a cargar cuando otro dispositivo
// cambia algo. No hay cola offline todavía — sin conexión, las escrituras
// fallan (se documenta como pendiente, no se aparenta que funciona).
import * as Crypto from 'expo-crypto';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { categoryIdFor, fetchCategoryMaps, GROUP_TO_KIND, KIND_TO_GROUP, type CategoryMaps } from './categoriesRemote';
import { KipoContext, emptyKipoState, type KipoContextValue } from './kipoContext';
import { supabase } from '../lib/supabase';
import { parseBankSms, parseExpenseWithFamilyRules } from './parsing';
import { shiftByRecurrence } from './selectors';
import type { Account, Budget, CategorizationRule, FamilyMember, KipoState, Reminder, SavingsGoal, SmsSuggestion, Transaction } from './types';

function dbTransactionToApp(row: any, cats: CategoryMaps): Transaction {
  const cat = row.category_id ? cats.idToSlug.get(row.category_id) : undefined;
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    amount: Number(row.amount),
    currency: row.currency,
    groupSlug: cat?.groupSlug ?? null,
    subSlug: cat?.subSlug ?? null,
    merchant: row.merchant,
    description: row.description ?? '',
    rawText: row.raw_text,
    source: row.source,
    status: row.status,
    occurredAt: row.occurred_at,
    confidence: row.metadata?.confidence,
    accountId: row.account_id,
    budgetId: row.budget_id ?? null,
  };
}

function dbAccountToApp(row: any): Account {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    bankName: row.bank_name,
    lastFour: row.last_four,
    currency: row.currency,
  };
}

function dbSavingsGoalToApp(row: any): SavingsGoal {
  return {
    id: row.id,
    name: row.name,
    targetAmount: Number(row.target_amount),
    savedAmount: Number(row.saved_amount),
    accountId: row.account_id,
    targetDate: row.target_date,
    isActive: row.is_active,
  };
}

function dbBudgetToApp(row: any): Budget {
  return {
    id: row.id,
    name: row.name,
    groupSlug: row.category_kind ? KIND_TO_GROUP[row.category_kind] ?? row.category_kind : null,
    amountLimit: Number(row.amount_limit),
    alertThresholdPct: row.alert_threshold_pct,
  };
}

function dbReminderToApp(row: any, cats: CategoryMaps): Reminder {
  const cat = row.category_id ? cats.idToSlug.get(row.category_id) : undefined;
  return {
    id: row.id,
    name: row.name,
    amount: row.amount !== null ? Number(row.amount) : null,
    recurrence: row.recurrence,
    nextDueDate: row.next_due_date,
    notifyDaysBefore: row.notify_days_before,
    isActive: row.is_active,
    groupSlug: cat?.groupSlug ?? null,
    subSlug: cat?.subSlug ?? null,
    accountId: row.account_id,
    lastPaidAmount: row.last_paid_amount !== null && row.last_paid_amount !== undefined ? Number(row.last_paid_amount) : null,
    lastPaidAt: row.last_paid_at ?? null,
    lastPaidTransactionId: row.last_paid_transaction_id ?? null,
  };
}

function dbSmsToApp(row: any): SmsSuggestion {
  return {
    id: row.id,
    rawSms: row.raw_sms,
    parsedAmount: row.parsed_amount !== null ? Number(row.parsed_amount) : null,
    parsedMerchant: row.parsed_merchant,
    transactionType: row.parsed_transaction_type,
    confidence: row.confidence,
    status: row.status,
    receivedAt: row.received_at,
    matchedTransactionId: row.matched_transaction_id ?? undefined,
  };
}

interface Props {
  familyId: string;
  membershipId: string;
  children: React.ReactNode;
}

export function SupabaseKipoProvider({ familyId, membershipId, children }: Props) {
  const [state, setState] = useState<KipoState>(emptyKipoState());
  const [loading, setLoading] = useState(true);
  const catMapsRef = useRef<CategoryMaps>({ idToSlug: new Map(), slugToId: new Map() });

  const loadAll = useCallback(async () => {
    const cats = await fetchCategoryMaps();
    catMapsRef.current = cats;

    const [familyRes, membersRes, txRes, budgetsRes, remindersRes, smsRes, rulesRes, accountsRes, goalsRes] = await Promise.all([
      supabase!.from('families').select('name, invite_code, base_currency, photo_url').eq('id', familyId).single(),
      supabase!.from('users').select('id, display_name, role, email, status, accent_color').eq('family_id', familyId),
      supabase!.from('transactions').select('*').eq('family_id', familyId).order('occurred_at', { ascending: false }),
      supabase!.from('budgets').select('*').eq('family_id', familyId),
      supabase!.from('reminders').select('*').eq('family_id', familyId),
      supabase!.from('sms_inbox').select('*').eq('user_id', membershipId).order('received_at', { ascending: false }),
      supabase!.from('categorization_rules').select('id, keyword, category_id').eq('family_id', familyId),
      supabase!.from('accounts').select('*').eq('family_id', familyId),
      supabase!.from('savings_goals').select('*').eq('family_id', familyId),
    ]);

    const members: FamilyMember[] = (membersRes.data ?? []).map((r: any) => ({
      id: r.id,
      name: r.display_name,
      role: r.role,
      email: r.email,
      status: r.status ?? 'active',
      accentColor: r.accent_color ?? null,
    }));
    const transactions = (txRes.data ?? []).map((r: any) => dbTransactionToApp(r, cats));
    const budgets = (budgetsRes.data ?? []).map(dbBudgetToApp);
    const reminders = (remindersRes.data ?? []).map((r: any) => dbReminderToApp(r, cats));
    const smsInbox = (smsRes.data ?? []).map(dbSmsToApp);
    const categorizationRules: CategorizationRule[] = (rulesRes.data ?? [])
      .map((r: any) => {
        const cat = r.category_id ? cats.idToSlug.get(r.category_id) : undefined;
        return cat ? { id: r.id, keyword: r.keyword, groupSlug: cat.groupSlug, subSlug: cat.subSlug } : null;
      })
      .filter((r: CategorizationRule | null): r is CategorizationRule => r !== null);
    const accounts = (accountsRes.data ?? []).map(dbAccountToApp);
    const savingsGoals = (goalsRes.data ?? []).map(dbSavingsGoalToApp);

    setState({
      familyName: familyRes.data?.name ?? 'Mi espacio',
      familyPhotoUrl: familyRes.data?.photo_url ?? null,
      inviteCode: familyRes.data?.invite_code ?? '',
      baseCurrency: familyRes.data?.base_currency ?? 'USD',
      members,
      transactions,
      budgets,
      reminders,
      smsInbox,
      categorizationRules,
      accounts,
      savingsGoals,
    });
    setLoading(false);
  }, [familyId, membershipId]);

  useEffect(() => {
    setLoading(true);
    loadAll();
  }, [loadAll]);

  // Realtime: si otro miembro de la familia registra/edita algo desde otro
  // dispositivo, este vuelve a cargar solo. Estrategia simple (recarga
  // completa, no merge fino) — suficiente para el tamaño de datos de una
  // familia; ver docs/TESTING_ENVIRONMENT.md § Nivel 3 para una cola
  // optimista más fina.
  useEffect(() => {
    const channel = supabase!
      .channel(`kipo-family-${familyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: `family_id=eq.${familyId}` }, () => loadAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'budgets', filter: `family_id=eq.${familyId}` }, () => loadAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reminders', filter: `family_id=eq.${familyId}` }, () => loadAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users', filter: `family_id=eq.${familyId}` }, () => loadAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'accounts', filter: `family_id=eq.${familyId}` }, () => loadAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'savings_goals', filter: `family_id=eq.${familyId}` }, () => loadAll())
      .subscribe();

    return () => {
      supabase!.removeChannel(channel);
    };
  }, [familyId, loadAll]);

  const addTransactionFromText = useCallback(
    (text: string, userId: string = membershipId): Transaction => {
      const draft = parseExpenseWithFamilyRules(text, state.categorizationRules);
      // El id se genera aquí (no lo asigna Postgres) para que sea el mismo
      // antes y después del insert — así una pantalla que guardó este id al
      // mostrar la tarjeta de confirmación (chat.tsx) lo sigue encontrando
      // cuando el estado se reemplaza por la versión ya guardada, en vez de
      // que la tarjeta desaparezca al no hallar coincidencia.
      const optimisticId = Crypto.randomUUID();
      const optimistic: Transaction = {
        id: optimisticId,
        userId,
        type: draft.type,
        amount: draft.amount ?? 0,
        currency: state.baseCurrency,
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
      setState((prev) => ({ ...prev, transactions: [optimistic, ...prev.transactions] }));

      (async () => {
        const { data, error } = await supabase!
          .from('transactions')
          .insert({
            id: optimisticId,
            family_id: familyId,
            user_id: userId,
            type: draft.type,
            amount: draft.amount ?? 0,
            currency: state.baseCurrency,
            category_id: categoryIdFor(catMapsRef.current, draft.groupSlug, draft.subSlug),
            merchant: draft.merchant,
            description: draft.description,
            raw_text: draft.rawText,
            source: 'chat',
            status: draft.needsReview ? 'pendiente' : 'confirmado',
            occurred_at: draft.occurredAt,
            metadata: { confidence: draft.confidence },
          })
          .select()
          .single();

        if (!error && data) {
          const saved = dbTransactionToApp(data, catMapsRef.current);
          setState((prev) => ({ ...prev, transactions: prev.transactions.map((t) => (t.id === optimisticId ? saved : t)) }));
        }
      })();

      return optimistic;
    },
    [membershipId, familyId, state.categorizationRules, state.baseCurrency],
  );

  const updateTransaction = useCallback(
    (id: string, patch: Partial<Transaction>) => {
      setState((prev) => ({ ...prev, transactions: prev.transactions.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
      const dbPatch: Record<string, unknown> = {};
      if (patch.amount !== undefined) dbPatch.amount = patch.amount;
      if (patch.description !== undefined) dbPatch.description = patch.description;
      if (patch.merchant !== undefined) dbPatch.merchant = patch.merchant;
      if (patch.occurredAt !== undefined) dbPatch.occurred_at = patch.occurredAt;
      if (patch.accountId !== undefined) dbPatch.account_id = patch.accountId;
      if (patch.budgetId !== undefined) dbPatch.budget_id = patch.budgetId;
      if (patch.groupSlug !== undefined || patch.subSlug !== undefined) {
        const tx = state.transactions.find((t) => t.id === id);
        dbPatch.category_id = categoryIdFor(
          catMapsRef.current,
          patch.groupSlug !== undefined ? patch.groupSlug : tx?.groupSlug ?? null,
          patch.subSlug !== undefined ? patch.subSlug : tx?.subSlug ?? null,
        );
      }
      if (Object.keys(dbPatch).length > 0) {
        supabase!.from('transactions').update(dbPatch).eq('id', id).then();
      }
    },
    [state.transactions],
  );

  const confirmTransaction = useCallback(
    (id: string, patch: Partial<Transaction> = {}) => {
      updateTransaction(id, patch);
      setState((prev) => ({ ...prev, transactions: prev.transactions.map((t) => (t.id === id ? { ...t, status: 'confirmado' } : t)) }));
      supabase!.from('transactions').update({ status: 'confirmado' }).eq('id', id).then();
    },
    [updateTransaction],
  );

  const deleteTransaction = useCallback((id: string) => {
    setState((prev) => ({ ...prev, transactions: prev.transactions.filter((t) => t.id !== id) }));
    supabase!.from('transactions').delete().eq('id', id).then();
  }, []);

  const correctCategory = useCallback(
    (id: string, groupSlug: string, subSlug: string) => {
      const tx = state.transactions.find((t) => t.id === id);
      setState((prev) => ({
        ...prev,
        transactions: prev.transactions.map((t) => (t.id === id ? { ...t, groupSlug, subSlug, status: 'confirmado' } : t)),
      }));
      const categoryId = categoryIdFor(catMapsRef.current, groupSlug, subSlug);
      supabase!.from('transactions').update({ category_id: categoryId, status: 'confirmado' }).eq('id', id).then();

      // Las reglas de categorización aprendidas solo aplican a gasto (ver
      // parsing.ts) — guardar una para un ingreso nunca se volvería a usar.
      if (tx?.rawText && categoryId && tx.type === 'gasto') {
        const distinctiveWord = tx.rawText
          .split(/\s+/)
          .map((w) => w.replace(/[^\p{L}]/gu, ''))
          .filter((w) => w.length > 3)
          .pop();
        if (distinctiveWord) {
          const rule: CategorizationRule = { id: `local_${Date.now()}`, keyword: distinctiveWord, groupSlug, subSlug };
          setState((prev) => ({ ...prev, categorizationRules: [rule, ...prev.categorizationRules] }));
          supabase!.from('categorization_rules').insert({ family_id: familyId, keyword: distinctiveWord, category_id: categoryId }).then();
        }
      }
    },
    [state.transactions, familyId],
  );

  const simulateIncomingSms = useCallback(
    (rawSms: string): SmsSuggestion => {
      const parsed = parseBankSms(rawSms);
      const optimisticId = Crypto.randomUUID();
      const suggestion: SmsSuggestion = {
        id: optimisticId,
        rawSms: parsed.raw_sms,
        parsedAmount: parsed.amount,
        parsedMerchant: parsed.merchant,
        transactionType: parsed.transaction_type as SmsSuggestion['transactionType'],
        confidence: parsed.confidence as SmsSuggestion['confidence'],
        status: 'pendiente',
        receivedAt: parsed.occurred_at,
      };
      setState((prev) => ({ ...prev, smsInbox: [suggestion, ...prev.smsInbox] }));

      (async () => {
        const { data, error } = await supabase!
          .from('sms_inbox')
          .insert({
            id: optimisticId,
            user_id: membershipId,
            raw_sms: parsed.raw_sms,
            bank_pattern_id: parsed.bank_pattern_id,
            parsed_amount: parsed.amount,
            parsed_merchant: parsed.merchant,
            parsed_transaction_type: parsed.transaction_type,
            confidence: parsed.confidence,
            status: 'pendiente',
          })
          .select()
          .single();
        if (!error && data) {
          setState((prev) => ({ ...prev, smsInbox: prev.smsInbox.map((s) => (s.id === optimisticId ? dbSmsToApp(data) : s)) }));
        }
      })();

      return suggestion;
    },
    [membershipId],
  );

  const confirmSms = useCallback(
    (id: string, overrides: Partial<Transaction> = {}) => {
      const sms = state.smsInbox.find((s) => s.id === id);
      if (!sms) return;

      const isIncome = sms.transactionType === 'deposito';
      const transaction: Transaction = {
        id: Crypto.randomUUID(),
        userId: overrides.userId ?? membershipId,
        type: overrides.type ?? (isIncome ? 'ingreso' : 'gasto'),
        amount: overrides.amount ?? sms.parsedAmount ?? 0,
        currency: state.baseCurrency,
        groupSlug: overrides.groupSlug ?? null,
        subSlug: overrides.subSlug ?? null,
        merchant: overrides.merchant ?? sms.parsedMerchant,
        description: overrides.description ?? sms.parsedMerchant ?? (isIncome ? 'Depósito bancario' : 'Compra con tarjeta'),
        rawText: sms.rawSms,
        source: 'sms',
        status: 'confirmado',
        occurredAt: overrides.occurredAt ?? sms.receivedAt,
        accountId: overrides.accountId ?? null,
        budgetId: overrides.budgetId ?? null,
      };
      setState((prev) => ({
        ...prev,
        transactions: [transaction, ...prev.transactions],
        smsInbox: prev.smsInbox.map((s) => (s.id === id ? { ...s, status: 'confirmado' } : s)),
      }));

      (async () => {
        const { data } = await supabase!
          .from('transactions')
          .insert({
            id: transaction.id,
            family_id: familyId,
            user_id: transaction.userId,
            account_id: transaction.accountId,
            budget_id: transaction.budgetId,
            type: transaction.type,
            amount: transaction.amount,
            currency: transaction.currency,
            category_id: categoryIdFor(catMapsRef.current, transaction.groupSlug, transaction.subSlug),
            merchant: transaction.merchant,
            description: transaction.description,
            raw_text: transaction.rawText,
            source: 'sms',
            status: 'confirmado',
            occurred_at: transaction.occurredAt,
          })
          .select()
          .single();

        if (data) {
          setState((prev) => ({ ...prev, transactions: prev.transactions.map((t) => (t.id === transaction.id ? dbTransactionToApp(data, catMapsRef.current) : t)) }));
          await supabase!.from('sms_inbox').update({ status: 'confirmado', matched_transaction_id: data.id }).eq('id', id);
        }
      })();
    },
    [state.smsInbox, state.baseCurrency, membershipId, familyId],
  );

  const discardSms = useCallback((id: string) => {
    setState((prev) => ({ ...prev, smsInbox: prev.smsInbox.map((s) => (s.id === id ? { ...s, status: 'descartado' } : s)) }));
    supabase!.from('sms_inbox').update({ status: 'descartado' }).eq('id', id).then();
  }, []);

  const addBudget = useCallback(
    (budget: Omit<Budget, 'id'>) => {
      (async () => {
        const { data } = await supabase!
          .from('budgets')
          .insert({
            family_id: familyId,
            // category_kind en la DB es singular ('fijo', 'necesario'...) —
            // budget.groupSlug es plural ('fijos', 'necesarios'...). Sin esta
            // traducción, crear un presupuesto de "Gastos Fijos" o "Gastos
            // Necesarios" viola el check constraint y falla en silencio.
            category_kind: budget.groupSlug ? GROUP_TO_KIND[budget.groupSlug] ?? budget.groupSlug : null,
            name: budget.name,
            amount_limit: budget.amountLimit,
            alert_threshold_pct: budget.alertThresholdPct,
          })
          .select()
          .single();
        if (data) setState((prev) => ({ ...prev, budgets: [...prev.budgets, dbBudgetToApp(data)] }));
      })();
    },
    [familyId],
  );

  const removeBudget = useCallback((id: string) => {
    setState((prev) => ({ ...prev, budgets: prev.budgets.filter((b) => b.id !== id) }));
    supabase!.from('budgets').delete().eq('id', id).then();
  }, []);

  const addReminder = useCallback(
    (reminder: Omit<Reminder, 'id'>) => {
      (async () => {
        const { data } = await supabase!
          .from('reminders')
          .insert({
            family_id: familyId,
            name: reminder.name,
            amount: reminder.amount,
            recurrence: reminder.recurrence,
            next_due_date: reminder.nextDueDate,
            notify_days_before: reminder.notifyDaysBefore,
            is_active: reminder.isActive,
            category_id: categoryIdFor(catMapsRef.current, reminder.groupSlug, reminder.subSlug),
            account_id: reminder.accountId,
          })
          .select()
          .single();
        if (data) setState((prev) => ({ ...prev, reminders: [...prev.reminders, dbReminderToApp(data, catMapsRef.current)] }));
      })();
    },
    [familyId],
  );

  const removeReminder = useCallback((id: string) => {
    setState((prev) => ({ ...prev, reminders: prev.reminders.filter((r) => r.id !== id) }));
    supabase!.from('reminders').delete().eq('id', id).then();
  }, []);

  // Marca el ciclo actual de un recordatorio recurrente como pagado: crea el
  // gasto en `transactions` y avanza `next_due_date` al siguiente ciclo, así
  // el usuario nunca tiene que volver a "escribirlo" en el chat cada mes.
  const markReminderPaid = useCallback(
    (id: string, amount: number, accountId?: string | null) => {
      const reminder = state.reminders.find((r) => r.id === id);
      if (!reminder) return;
      const now = new Date().toISOString();
      const txId = Crypto.randomUUID();
      const resolvedAccountId = accountId ?? reminder.accountId ?? null;
      const nextDueDate = shiftByRecurrence(reminder.nextDueDate, reminder.recurrence, 1);
      const isActive = reminder.recurrence === 'unico' ? false : reminder.isActive;

      setState((prev) => ({
        ...prev,
        transactions: [
          {
            id: txId,
            userId: membershipId,
            type: 'gasto',
            amount,
            currency: prev.baseCurrency,
            groupSlug: reminder.groupSlug ?? 'fijos',
            subSlug: reminder.subSlug,
            merchant: null,
            description: reminder.name,
            rawText: null,
            source: 'recurrente',
            status: 'confirmado',
            occurredAt: now,
            accountId: resolvedAccountId,
          },
          ...prev.transactions,
        ],
        reminders: prev.reminders.map((r) =>
          r.id === id ? { ...r, nextDueDate, isActive, lastPaidAmount: amount, lastPaidAt: now, lastPaidTransactionId: txId } : r,
        ),
      }));

      (async () => {
        await supabase!.from('transactions').insert({
          id: txId,
          family_id: familyId,
          user_id: membershipId,
          type: 'gasto',
          amount,
          currency: state.baseCurrency,
          category_id: categoryIdFor(catMapsRef.current, reminder.groupSlug ?? 'fijos', reminder.subSlug),
          account_id: resolvedAccountId,
          description: reminder.name,
          source: 'recurrente',
          status: 'confirmado',
          occurred_at: now,
        });
        await supabase!
          .from('reminders')
          .update({
            next_due_date: nextDueDate,
            is_active: isActive,
            last_paid_amount: amount,
            last_paid_at: now,
            last_paid_transaction_id: txId,
          })
          .eq('id', id);
      })();
    },
    [state.reminders, state.baseCurrency, membershipId, familyId],
  );

  const undoReminderPayment = useCallback(
    (id: string) => {
      const reminder = state.reminders.find((r) => r.id === id);
      if (!reminder?.lastPaidTransactionId) return;
      const txId = reminder.lastPaidTransactionId;
      const previousDueDate = shiftByRecurrence(reminder.nextDueDate, reminder.recurrence, -1);

      setState((prev) => ({
        ...prev,
        transactions: prev.transactions.filter((t) => t.id !== txId),
        reminders: prev.reminders.map((r) =>
          r.id === id
            ? { ...r, nextDueDate: previousDueDate, isActive: true, lastPaidAmount: null, lastPaidAt: null, lastPaidTransactionId: null }
            : r,
        ),
      }));

      (async () => {
        await supabase!.from('transactions').delete().eq('id', txId);
        await supabase!
          .from('reminders')
          .update({ next_due_date: previousDueDate, is_active: true, last_paid_amount: null, last_paid_at: null, last_paid_transaction_id: null })
          .eq('id', id);
      })();
    },
    [state.reminders],
  );

  // En modo remoto un "miembro" nuevo se agrega compartiendo el código de
  // invitación (families.invite_code), no insertándolo directo — RLS
  // bloquea el insert en `users` a propósito (ver migración 0003), solo las
  // funciones create_family_and_join/join_family_by_invite pueden hacerlo.
  // mobile/app/family.tsx muestra el código en vez de este formulario
  // cuando isSupabaseConfigured es true.
  const addMember = useCallback((_member: Omit<FamilyMember, 'id'>) => {
    console.warn('addMember: en modo Supabase, comparte el código de invitación en vez de agregar miembros directo.');
  }, []);

  const regenerateInviteCode = useCallback(() => {
    (async () => {
      const { data, error } = await supabase!.rpc('regenerate_invite_code', { target_family_id: familyId });
      if (!error && data) {
        setState((prev) => ({ ...prev, inviteCode: data as string }));
      }
    })();
  }, [familyId]);

  const updateFamilyProfile = useCallback(
    (patch: { name?: string; photoUrl?: string | null }) => {
      setState((prev) => ({
        ...prev,
        familyName: patch.name ?? prev.familyName,
        familyPhotoUrl: patch.photoUrl !== undefined ? patch.photoUrl : prev.familyPhotoUrl,
      }));
      const dbPatch: Record<string, unknown> = {};
      if (patch.name !== undefined) dbPatch.name = patch.name;
      if (patch.photoUrl !== undefined) dbPatch.photo_url = patch.photoUrl;
      if (Object.keys(dbPatch).length > 0) {
        supabase!.from('families').update(dbPatch).eq('id', familyId).then();
      }
    },
    [familyId],
  );

  const setAccentColor = useCallback(
    (color: string | null) => {
      setState((prev) => ({
        ...prev,
        members: prev.members.map((m) => (m.id === membershipId ? { ...m, accentColor: color } : m)),
      }));
      supabase!.from('users').update({ accent_color: color }).eq('id', membershipId).then();
    },
    [membershipId],
  );

  const setMemberStatus = useCallback((memberId: string, status: 'active' | 'suspended') => {
    setState((prev) => ({
      ...prev,
      members: prev.members.map((m) => (m.id === memberId ? { ...m, status } : m)),
    }));
    (async () => {
      const { error } = await supabase!.rpc('set_member_status', { target_user_id: memberId, new_status: status });
      if (error) {
        // Revertir el optimista si el servidor lo rechazó (ej. intentar
        // suspenderse a sí mismo, o no ser admin).
        setState((prev) => ({
          ...prev,
          members: prev.members.map((m) => (m.id === memberId ? { ...m, status: status === 'active' ? 'suspended' : 'active' } : m)),
        }));
      }
    })();
  }, []);

  const addAccount = useCallback(
    (account: Omit<Account, 'id'>) => {
      (async () => {
        const { data } = await supabase!
          .from('accounts')
          .insert({
            family_id: familyId,
            name: account.name,
            type: account.type,
            bank_name: account.bankName,
            last_four: account.lastFour,
            currency: account.currency,
          })
          .select()
          .single();
        if (data) setState((prev) => ({ ...prev, accounts: [...prev.accounts, dbAccountToApp(data)] }));
      })();
    },
    [familyId],
  );

  const removeAccount = useCallback((id: string) => {
    setState((prev) => ({ ...prev, accounts: prev.accounts.filter((a) => a.id !== id) }));
    supabase!.from('accounts').delete().eq('id', id).then();
  }, []);

  const addSavingsGoal = useCallback(
    (goal: Omit<SavingsGoal, 'id' | 'savedAmount'>) => {
      (async () => {
        const { data } = await supabase!
          .from('savings_goals')
          .insert({
            family_id: familyId,
            account_id: goal.accountId,
            name: goal.name,
            target_amount: goal.targetAmount,
            target_date: goal.targetDate,
            is_active: goal.isActive,
          })
          .select()
          .single();
        if (data) setState((prev) => ({ ...prev, savingsGoals: [...prev.savingsGoals, dbSavingsGoalToApp(data)] }));
      })();
    },
    [familyId],
  );

  const contributeSavingsGoal = useCallback(
    (id: string, amount: number) => {
      const goal = state.savingsGoals.find((g) => g.id === id);
      if (!goal) return;
      const savedAmount = goal.savedAmount + amount;
      setState((prev) => ({ ...prev, savingsGoals: prev.savingsGoals.map((g) => (g.id === id ? { ...g, savedAmount } : g)) }));
      supabase!.from('savings_goals').update({ saved_amount: savedAmount }).eq('id', id).then();
    },
    [state.savingsGoals],
  );

  const removeSavingsGoal = useCallback((id: string) => {
    setState((prev) => ({ ...prev, savingsGoals: prev.savingsGoals.filter((g) => g.id !== id) }));
    supabase!.from('savings_goals').delete().eq('id', id).then();
  }, []);

  const resetSeedData = useCallback(() => {
    console.warn('resetSeedData no aplica en modo Supabase (son datos reales, no una semilla de prueba).');
  }, []);

  const setCurrentUserId = useCallback((_id: string) => {
    // No-op: en modo remoto no puedes "actuar como" otro miembro de la
    // familia — currentUserId siempre es tu propia membresía.
  }, []);

  const value = useMemo<KipoContextValue>(
    () => ({
      state,
      loading,
      currentUserId: membershipId,
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
      markReminderPaid,
      undoReminderPayment,
      addMember,
      regenerateInviteCode,
      updateFamilyProfile,
      setAccentColor,
      setMemberStatus,
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
      membershipId,
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
      markReminderPaid,
      undoReminderPayment,
      addMember,
      regenerateInviteCode,
      updateFamilyProfile,
      setAccentColor,
      setMemberStatus,
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
