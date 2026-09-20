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
import { GROUP_LABELS, type CategoryOption } from './categories';
import { KipoContext, emptyKipoState, type KipoContextValue } from './kipoContext';
import { supabase } from '../lib/supabase';
import { notify } from '../lib/confirm';
import { colors, groupColors } from '../theme';
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
  const catMapsRef = useRef<CategoryMaps>({ idToSlug: new Map(), slugToId: new Map(), customOptions: [] });

  const loadAll = useCallback(async () => {
    const cats = await fetchCategoryMaps(familyId);
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
      customCategories: cats.customOptions,
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
  //
  // Con debounce: sin esto, cada evento de cada una de las 6 tablas dispara
  // su propio loadAll() (10 consultas) sin agrupar — un miembro guardando
  // varios cambios seguidos (o un cambio que toca dos tablas, ej. marcar un
  // recordatorio como pagado) multiplicaba las recargas innecesariamente en
  // TODOS los dispositivos conectados de la familia, incluido el que hizo el
  // cambio. Agrupar eventos cercanos en una sola recarga no cambia el
  // comportamiento (sigue siendo "recarga completa"), solo evita repetirla
  // varias veces por ráfaga.
  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleReload = useCallback(() => {
    if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
    reloadTimerRef.current = setTimeout(() => {
      reloadTimerRef.current = null;
      loadAll();
    }, 400);
  }, [loadAll]);

  useEffect(() => {
    const channel = supabase!
      .channel(`kipo-family-${familyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: `family_id=eq.${familyId}` }, scheduleReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'budgets', filter: `family_id=eq.${familyId}` }, scheduleReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reminders', filter: `family_id=eq.${familyId}` }, scheduleReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users', filter: `family_id=eq.${familyId}` }, scheduleReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'accounts', filter: `family_id=eq.${familyId}` }, scheduleReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'savings_goals', filter: `family_id=eq.${familyId}` }, scheduleReload)
      .subscribe();

    return () => {
      if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
      supabase!.removeChannel(channel);
    };
  }, [familyId, scheduleReload]);

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
        } else if (error) {
          setState((prev) => ({ ...prev, transactions: prev.transactions.filter((t) => t.id !== optimisticId) }));
          notify('No se pudo guardar el gasto', error.message);
        }
      })();

      return optimistic;
    },
    [membershipId, familyId, state.categorizationRules, state.baseCurrency],
  );

  const updateTransaction = useCallback(
    (id: string, patch: Partial<Transaction>) => {
      const previous = state.transactions.find((t) => t.id === id);
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
        supabase!
          .from('transactions')
          .update(dbPatch)
          .eq('id', id)
          .then(({ error }) => {
            if (error) {
              if (previous) setState((prev) => ({ ...prev, transactions: prev.transactions.map((t) => (t.id === id ? previous : t)) }));
              notify('No se pudo guardar el cambio', error.message);
            }
          });
      }
    },
    [state.transactions],
  );

  const confirmTransaction = useCallback(
    (id: string, patch: Partial<Transaction> = {}) => {
      const previousStatus = state.transactions.find((t) => t.id === id)?.status;
      updateTransaction(id, patch);
      setState((prev) => ({ ...prev, transactions: prev.transactions.map((t) => (t.id === id ? { ...t, status: 'confirmado' } : t)) }));
      supabase!
        .from('transactions')
        .update({ status: 'confirmado' })
        .eq('id', id)
        .then(({ error }) => {
          if (error) {
            if (previousStatus) setState((prev) => ({ ...prev, transactions: prev.transactions.map((t) => (t.id === id ? { ...t, status: previousStatus } : t)) }));
            notify('No se pudo confirmar el movimiento', error.message);
          }
        });
    },
    [updateTransaction, state.transactions],
  );

  const deleteTransaction = useCallback(
    (id: string) => {
      const previous = state.transactions.find((t) => t.id === id);
      setState((prev) => ({ ...prev, transactions: prev.transactions.filter((t) => t.id !== id) }));
      supabase!
        .from('transactions')
        .delete()
        .eq('id', id)
        .then(({ error }) => {
          if (error) {
            if (previous) setState((prev) => ({ ...prev, transactions: [previous, ...prev.transactions] }));
            notify('No se pudo eliminar el movimiento', error.message);
          }
        });
    },
    [state.transactions],
  );

  const correctCategory = useCallback(
    (id: string, groupSlug: string, subSlug: string) => {
      const tx = state.transactions.find((t) => t.id === id);
      const previous = tx ? { groupSlug: tx.groupSlug, subSlug: tx.subSlug, status: tx.status } : null;
      setState((prev) => ({
        ...prev,
        transactions: prev.transactions.map((t) => (t.id === id ? { ...t, groupSlug, subSlug, status: 'confirmado' } : t)),
      }));
      // categoryId sale de catMapsRef, que trae TODAS las categorías de la
      // familia (sistema + personalizadas) — sirve como el mismo chequeo de
      // "existe de verdad" que findCategory() hace en el store local, solo
      // que este reconoce también las categorías personalizadas.
      const categoryId = categoryIdFor(catMapsRef.current, groupSlug, subSlug);
      supabase!
        .from('transactions')
        .update({ category_id: categoryId, status: 'confirmado' })
        .eq('id', id)
        .then(({ error }) => {
          if (error) {
            if (previous) setState((prev) => ({ ...prev, transactions: prev.transactions.map((t) => (t.id === id ? { ...t, ...previous } : t)) }));
            notify('No se pudo guardar la categoría', error.message);
          }
        });

      // Las reglas de categorización aprendidas solo aplican a gasto (ver
      // parsing.ts) — guardar una para un ingreso nunca se volvería a usar.
      if (tx?.rawText && categoryId && tx.type === 'gasto') {
        const distinctiveWord = tx.rawText
          .split(/\s+/)
          .map((w) => w.replace(/[^\p{L}]/gu, ''))
          .filter((w) => w.length > 3)
          .pop();
        if (distinctiveWord) {
          const optimisticRuleId = `local_${Date.now()}`;
          const rule: CategorizationRule = { id: optimisticRuleId, keyword: distinctiveWord, groupSlug, subSlug };
          setState((prev) => ({ ...prev, categorizationRules: [rule, ...prev.categorizationRules] }));
          (async () => {
            const { data, error } = await supabase!
              .from('categorization_rules')
              .insert({ family_id: familyId, keyword: distinctiveWord, category_id: categoryId })
              .select()
              .single();
            if (data) {
              // Reconciliar el id local temporal con el real — sin esto, la
              // regla se queda con un id que nunca existió en la DB y
              // desaparece sin aviso la próxima vez que se recarga el estado.
              setState((prev) => ({
                ...prev,
                categorizationRules: prev.categorizationRules.map((r) => (r.id === optimisticRuleId ? { ...r, id: data.id } : r)),
              }));
            } else if (error) {
              // Silencioso a propósito: es un aprendizaje automático de
              // conveniencia (no una acción que el usuario pidió
              // explícitamente) — perder la regla no le impide seguir usando
              // la app, pero si falla no debe quedar "fantasma" en el estado.
              setState((prev) => ({ ...prev, categorizationRules: prev.categorizationRules.filter((r) => r.id !== optimisticRuleId) }));
            }
          })();
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
        } else if (error) {
          setState((prev) => ({ ...prev, smsInbox: prev.smsInbox.filter((s) => s.id !== optimisticId) }));
          notify('No se pudo guardar el SMS', error.message);
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
        const { data, error } = await supabase!
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
        } else if (error) {
          setState((prev) => ({
            ...prev,
            transactions: prev.transactions.filter((t) => t.id !== transaction.id),
            smsInbox: prev.smsInbox.map((s) => (s.id === id ? { ...s, status: 'pendiente' } : s)),
          }));
          notify('No se pudo confirmar el SMS', error.message);
        }
      })();
    },
    [state.smsInbox, state.baseCurrency, membershipId, familyId],
  );

  const discardSms = useCallback((id: string) => {
    setState((prev) => ({ ...prev, smsInbox: prev.smsInbox.map((s) => (s.id === id ? { ...s, status: 'descartado' } : s)) }));
    supabase!
      .from('sms_inbox')
      .update({ status: 'descartado' })
      .eq('id', id)
      .then(({ error }) => {
        if (error) {
          setState((prev) => ({ ...prev, smsInbox: prev.smsInbox.map((s) => (s.id === id ? { ...s, status: 'pendiente' } : s)) }));
          notify('No se pudo descartar el SMS', error.message);
        }
      });
  }, []);

  const addBudget = useCallback(
    (budget: Omit<Budget, 'id'>) => {
      (async () => {
        const { data, error } = await supabase!
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
        else if (error) notify('No se pudo crear el presupuesto', error.message);
      })();
    },
    [familyId],
  );

  const updateBudget = useCallback(
    (id: string, patch: Partial<Omit<Budget, 'id'>>) => {
      const previous = state.budgets.find((b) => b.id === id);
      setState((prev) => ({ ...prev, budgets: prev.budgets.map((b) => (b.id === id ? { ...b, ...patch } : b)) }));
      const dbPatch: Record<string, unknown> = {};
      if (patch.name !== undefined) dbPatch.name = patch.name;
      if (patch.amountLimit !== undefined) dbPatch.amount_limit = patch.amountLimit;
      if (patch.alertThresholdPct !== undefined) dbPatch.alert_threshold_pct = patch.alertThresholdPct;
      if (patch.groupSlug !== undefined) dbPatch.category_kind = patch.groupSlug ? GROUP_TO_KIND[patch.groupSlug] ?? patch.groupSlug : null;
      if (Object.keys(dbPatch).length > 0) {
        supabase!
          .from('budgets')
          .update(dbPatch)
          .eq('id', id)
          .then(({ error }) => {
            if (error) {
              if (previous) setState((prev) => ({ ...prev, budgets: prev.budgets.map((b) => (b.id === id ? previous : b)) }));
              notify('No se pudo guardar el presupuesto', error.message);
            }
          });
      }
    },
    [state.budgets],
  );

  const removeBudget = useCallback(
    (id: string) => {
      const previous = state.budgets.find((b) => b.id === id);
      setState((prev) => ({ ...prev, budgets: prev.budgets.filter((b) => b.id !== id) }));
      supabase!
        .from('budgets')
        .delete()
        .eq('id', id)
        .then(({ error }) => {
          if (error) {
            if (previous) setState((prev) => ({ ...prev, budgets: [...prev.budgets, previous] }));
            notify('No se pudo eliminar el presupuesto', error.message);
          }
        });
    },
    [state.budgets],
  );

  const addReminder = useCallback(
    (reminder: Omit<Reminder, 'id'>) => {
      (async () => {
        const { data, error } = await supabase!
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
        else if (error) notify('No se pudo crear el recordatorio', error.message);
      })();
    },
    [familyId],
  );

  const removeReminder = useCallback(
    (id: string) => {
      const previous = state.reminders.find((r) => r.id === id);
      setState((prev) => ({ ...prev, reminders: prev.reminders.filter((r) => r.id !== id) }));
      supabase!
        .from('reminders')
        .delete()
        .eq('id', id)
        .then(({ error }) => {
          if (error) {
            if (previous) setState((prev) => ({ ...prev, reminders: [...prev.reminders, previous] }));
            notify('No se pudo eliminar el recordatorio', error.message);
          }
        });
    },
    [state.reminders],
  );

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
        const [txRes, reminderRes] = await Promise.all([
          supabase!.from('transactions').insert({
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
          }),
          supabase!
            .from('reminders')
            .update({
              next_due_date: nextDueDate,
              is_active: isActive,
              last_paid_amount: amount,
              last_paid_at: now,
              last_paid_transaction_id: txId,
            })
            .eq('id', id),
        ]);
        // Dos escrituras independientes — si una falla, el estado optimista
        // (que ya asumió ambas) puede haber quedado a medias. En vez de
        // revertir cada campo a mano, se resincroniza con loadAll() para
        // garantizar que lo que se ve coincide con lo que de verdad se
        // guardó, y se avisa.
        if (txRes.error || reminderRes.error) {
          notify('No se pudo marcar como pagado', (txRes.error ?? reminderRes.error)!.message);
          loadAll();
        }
      })();
    },
    [state.reminders, state.baseCurrency, membershipId, familyId, loadAll],
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
        const [delRes, reminderRes] = await Promise.all([
          supabase!.from('transactions').delete().eq('id', txId),
          supabase!
            .from('reminders')
            .update({ next_due_date: previousDueDate, is_active: true, last_paid_amount: null, last_paid_at: null, last_paid_transaction_id: null })
            .eq('id', id),
        ]);
        if (delRes.error || reminderRes.error) {
          notify('No se pudo deshacer el pago', (delRes.error ?? reminderRes.error)!.message);
          loadAll();
        }
      })();
    },
    [state.reminders, loadAll],
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
      } else if (error) {
        notify('No se pudo regenerar el código', error.message);
      }
    })();
  }, [familyId]);

  const updateFamilyProfile = useCallback(
    (patch: { name?: string; photoUrl?: string | null }) => {
      const previous = { name: state.familyName, photoUrl: state.familyPhotoUrl };
      setState((prev) => ({
        ...prev,
        familyName: patch.name ?? prev.familyName,
        familyPhotoUrl: patch.photoUrl !== undefined ? patch.photoUrl : prev.familyPhotoUrl,
      }));
      const dbPatch: Record<string, unknown> = {};
      if (patch.name !== undefined) dbPatch.name = patch.name;
      if (patch.photoUrl !== undefined) dbPatch.photo_url = patch.photoUrl;
      if (Object.keys(dbPatch).length > 0) {
        supabase!
          .from('families')
          .update(dbPatch)
          .eq('id', familyId)
          .then(({ error }) => {
            if (error) {
              setState((prev) => ({ ...prev, familyName: previous.name, familyPhotoUrl: previous.photoUrl }));
              notify('No se pudo guardar el perfil de familia', error.message);
            }
          });
      }
    },
    [familyId, state.familyName, state.familyPhotoUrl],
  );

  const setAccentColor = useCallback(
    (color: string | null) => {
      const previous = state.members.find((m) => m.id === membershipId)?.accentColor ?? null;
      setState((prev) => ({
        ...prev,
        members: prev.members.map((m) => (m.id === membershipId ? { ...m, accentColor: color } : m)),
      }));
      supabase!
        .from('users')
        .update({ accent_color: color })
        .eq('id', membershipId)
        .then(({ error }) => {
          if (error) {
            setState((prev) => ({
              ...prev,
              members: prev.members.map((m) => (m.id === membershipId ? { ...m, accentColor: previous } : m)),
            }));
            notify('No se pudo guardar el color', error.message);
          }
        });
    },
    [membershipId, state.members],
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
        notify('No se pudo cambiar el estado del miembro', error.message);
      }
    })();
  }, []);

  const addCustomCategory = useCallback(
    ({ groupSlug, label }: { groupSlug: string; label: string }) => {
      const subSlug = label
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
      (async () => {
        const { data, error } = await supabase!
          .from('categories')
          .insert({
            family_id: familyId,
            kind: GROUP_TO_KIND[groupSlug] ?? groupSlug,
            slug: subSlug,
            name: label.trim(),
            is_system: false,
          })
          .select()
          .single();
        if (data) {
          catMapsRef.current.idToSlug.set(data.id, { groupSlug, subSlug: data.slug });
          catMapsRef.current.slugToId.set(`${groupSlug}:${data.slug}`, data.id);
          const option: CategoryOption = {
            groupSlug,
            groupLabel: GROUP_LABELS[groupSlug] ?? groupSlug,
            subSlug: data.slug,
            label: data.name,
            color: groupColors[groupSlug] ?? colors.muted,
            kind: data.kind === 'ingreso' ? 'ingreso' : 'gasto',
          };
          catMapsRef.current.customOptions = [...catMapsRef.current.customOptions, option];
          setState((prev) => ({ ...prev, customCategories: [...prev.customCategories, option] }));
        } else if (error) {
          notify('No se pudo agregar la categoría', error.message);
        }
      })();
    },
    [familyId],
  );

  const addAccount = useCallback(
    (account: Omit<Account, 'id'>) => {
      (async () => {
        const { data, error } = await supabase!
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
        else if (error) notify('No se pudo agregar la cuenta', error.message);
      })();
    },
    [familyId],
  );

  const removeAccount = useCallback(
    (id: string) => {
      const previous = state.accounts.find((a) => a.id === id);
      setState((prev) => ({ ...prev, accounts: prev.accounts.filter((a) => a.id !== id) }));
      supabase!
        .from('accounts')
        .delete()
        .eq('id', id)
        .then(({ error }) => {
          if (error) {
            if (previous) setState((prev) => ({ ...prev, accounts: [...prev.accounts, previous] }));
            notify('No se pudo eliminar la cuenta', error.message);
          }
        });
    },
    [state.accounts],
  );

  const addSavingsGoal = useCallback(
    (goal: Omit<SavingsGoal, 'id' | 'savedAmount'>) => {
      (async () => {
        const { data, error } = await supabase!
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
        else if (error) notify('No se pudo crear la meta de ahorro', error.message);
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
      supabase!
        .from('savings_goals')
        .update({ saved_amount: savedAmount })
        .eq('id', id)
        .then(({ error }) => {
          if (error) {
            setState((prev) => ({ ...prev, savingsGoals: prev.savingsGoals.map((g) => (g.id === id ? { ...g, savedAmount: goal.savedAmount } : g)) }));
            notify('No se pudo guardar el aporte', error.message);
          }
        });
    },
    [state.savingsGoals],
  );

  const removeSavingsGoal = useCallback(
    (id: string) => {
      const previous = state.savingsGoals.find((g) => g.id === id);
      setState((prev) => ({ ...prev, savingsGoals: prev.savingsGoals.filter((g) => g.id !== id) }));
      supabase!
        .from('savings_goals')
        .delete()
        .eq('id', id)
        .then(({ error }) => {
          if (error) {
            if (previous) setState((prev) => ({ ...prev, savingsGoals: [...prev.savingsGoals, previous] }));
            notify('No se pudo eliminar la meta', error.message);
          }
        });
    },
    [state.savingsGoals],
  );

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
      updateBudget,
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
      addCustomCategory,
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
      updateBudget,
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
      addCustomCategory,
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
