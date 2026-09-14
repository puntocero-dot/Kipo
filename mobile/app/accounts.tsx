import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Card, EmptyState, PrimaryButton, Screen, SectionTitle } from '../src/components/ui';
import { useKipo } from '../src/domain/store';
import { notify } from '../src/lib/confirm';
import type { Account, AccountType } from '../src/domain/types';
import { colors, fonts, radius, spacing } from '../src/theme';

const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  efectivo: 'Efectivo',
  debito: 'Débito',
  credito: 'Crédito',
  ahorros: 'Ahorros',
};

const ACCOUNT_TYPE_ICON: Record<AccountType, keyof typeof Ionicons.glyphMap> = {
  efectivo: 'cash-outline',
  debito: 'card-outline',
  credito: 'card-outline',
  ahorros: 'wallet-outline',
};

function accountTotal(account: Account, transactions: ReturnType<typeof useKipo>['state']['transactions']) {
  const now = new Date();
  const linked = transactions.filter((t) => t.accountId === account.id);
  if (account.type === 'credito') {
    // Una tarjeta de crédito no tiene "saldo tuyo" — lo que importa es
    // cuánto se ha cargado este ciclo, como un estado de cuenta.
    const thisMonth = linked.filter((t) => {
      const d = new Date(t.occurredAt);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && t.type === 'gasto';
    });
    return { label: 'Gastado este mes', amount: thisMonth.reduce((s, t) => s + t.amount, 0) };
  }
  const balance = linked.reduce((s, t) => s + (t.type === 'ingreso' ? t.amount : -t.amount), 0);
  return { label: 'Saldo', amount: balance };
}

export default function AccountsScreen() {
  const { state, addAccount, removeAccount, addSavingsGoal, contributeSavingsGoal, removeSavingsGoal } = useKipo();
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('efectivo');
  const [bankName, setBankName] = useState('');
  const [lastFour, setLastFour] = useState('');

  const [goalName, setGoalName] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalAccountId, setGoalAccountId] = useState<string | null>(null);
  const [contributingId, setContributingId] = useState<string | null>(null);
  const [contributeAmount, setContributeAmount] = useState('');

  const needsCardDetails = type === 'debito' || type === 'credito';

  const accountName = (id: string | null) => state.accounts.find((a) => a.id === id)?.name;

  const submitAccount = () => {
    if (!name.trim()) {
      notify('Datos incompletos', 'Ingresa un nombre para la cuenta.');
      return;
    }
    addAccount({
      name: name.trim(),
      type,
      bankName: needsCardDetails && bankName.trim() ? bankName.trim() : null,
      lastFour: needsCardDetails && lastFour.trim() ? lastFour.trim().slice(-4) : null,
      currency: state.baseCurrency,
    });
    setName('');
    setBankName('');
    setLastFour('');
    setType('efectivo');
  };

  const submitGoal = () => {
    const target = parseFloat(goalTarget.replace(',', '.'));
    if (!goalName.trim() || Number.isNaN(target) || target <= 0) {
      notify('Datos incompletos', 'Ingresa un nombre y una meta mayor a $0.');
      return;
    }
    addSavingsGoal({ name: goalName.trim(), targetAmount: target, accountId: goalAccountId, targetDate: null, isActive: true });
    setGoalName('');
    setGoalTarget('');
    setGoalAccountId(null);
  };

  const submitContribution = (goalId: string) => {
    const amount = parseFloat(contributeAmount.replace(',', '.'));
    if (Number.isNaN(amount) || amount <= 0) {
      notify('Monto inválido', 'Ingresa un monto mayor a $0.');
      return;
    }
    contributeSavingsGoal(goalId, amount);
    setContributingId(null);
    setContributeAmount('');
  };

  return (
    <Screen>
      <Card>
        <SectionTitle icon="wallet-outline">Mis cuentas</SectionTitle>
        {state.accounts.length === 0 ? (
          <EmptyState icon="wallet-outline" message="Aún no has agregado ninguna cuenta." />
        ) : (
          state.accounts.map((account) => {
            const total = accountTotal(account, state.transactions);
            return (
              <View key={account.id} style={styles.accountRow}>
                <View style={styles.accountIconWrap}>
                  <Ionicons name={ACCOUNT_TYPE_ICON[account.type]} size={18} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.accountName}>{account.name}</Text>
                  <Text style={styles.accountMeta}>
                    {ACCOUNT_TYPE_LABEL[account.type]}
                    {account.bankName ? ` · ${account.bankName}` : ''}
                    {account.lastFour ? ` · ****${account.lastFour}` : ''}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.accountAmount, total.amount < 0 && { color: colors.critical }]}>
                    {total.amount < 0 ? '-' : ''}${Math.abs(total.amount).toFixed(2)}
                  </Text>
                  <Text style={styles.accountAmountLabel}>{total.label}</Text>
                </View>
                <Pressable onPress={() => removeAccount(account.id)} style={styles.removeIcon}>
                  <Ionicons name="trash-outline" size={16} color={colors.muted} />
                </Pressable>
              </View>
            );
          })
        )}
      </Card>

      <Card>
        <SectionTitle icon="add-circle-outline">Nueva cuenta</SectionTitle>
        <TextInput style={styles.input} placeholder="Nombre (ej. Tarjeta BAC)" value={name} onChangeText={setName} />
        <View style={styles.chipsRow}>
          {(Object.keys(ACCOUNT_TYPE_LABEL) as AccountType[]).map((t) => (
            <Pressable key={t} onPress={() => setType(t)} style={[styles.chip, type === t && styles.chipActive]}>
              <Text style={[styles.chipText, type === t && styles.chipTextActive]}>{ACCOUNT_TYPE_LABEL[t]}</Text>
            </Pressable>
          ))}
        </View>
        {needsCardDetails && (
          <>
            <TextInput style={styles.input} placeholder="Banco (ej. Banco Agrícola)" value={bankName} onChangeText={setBankName} />
            <TextInput
              style={styles.input}
              placeholder="Últimos 4 dígitos (opcional)"
              keyboardType="number-pad"
              maxLength={4}
              value={lastFour}
              onChangeText={setLastFour}
            />
          </>
        )}
        <PrimaryButton label="Agregar cuenta" onPress={submitAccount} />
      </Card>

      <Card>
        <SectionTitle icon="airplane-outline">Metas de ahorro</SectionTitle>
        {state.savingsGoals.length === 0 ? (
          <EmptyState icon="airplane-outline" message="Aún no has creado ninguna meta de ahorro." />
        ) : (
          state.savingsGoals.map((goal) => {
            const pct = Math.min(goal.savedAmount / goal.targetAmount, 1);
            return (
              <View key={goal.id} style={styles.goalItem}>
                <View style={styles.goalHeader}>
                  <Text style={styles.accountName}>{goal.name}</Text>
                  <Pressable onPress={() => removeSavingsGoal(goal.id)}>
                    <Text style={styles.removeLink}>Eliminar</Text>
                  </Pressable>
                </View>
                <Text style={styles.accountMeta}>
                  ${goal.savedAmount.toFixed(2)} de ${goal.targetAmount.toFixed(2)}
                  {goal.accountId ? ` · Guardado en ${accountName(goal.accountId)}` : ''}
                </Text>
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${pct * 100}%` }]} />
                </View>
                {contributingId === goal.id ? (
                  <View style={styles.contributeRow}>
                    <TextInput
                      style={[styles.input, { flex: 1, marginBottom: 0 }]}
                      placeholder="Monto a aportar"
                      keyboardType="decimal-pad"
                      autoFocus
                      value={contributeAmount}
                      onChangeText={setContributeAmount}
                    />
                    <Pressable style={styles.contributeConfirm} onPress={() => submitContribution(goal.id)}>
                      <Ionicons name="checkmark" size={18} color="#fff" />
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    style={styles.secondaryButton}
                    onPress={() => {
                      setContributingId(goal.id);
                      setContributeAmount('');
                    }}
                  >
                    <Text style={styles.secondaryButtonText}>+ Aportar</Text>
                  </Pressable>
                )}
              </View>
            );
          })
        )}
      </Card>

      <Card>
        <SectionTitle icon="add-circle-outline">Nueva meta de ahorro</SectionTitle>
        <TextInput style={styles.input} placeholder="Nombre (ej. Viaje a Guatemala)" value={goalName} onChangeText={setGoalName} />
        <TextInput style={styles.input} placeholder="Meta ($)" keyboardType="decimal-pad" value={goalTarget} onChangeText={setGoalTarget} />
        {state.accounts.length > 0 && (
          <View style={styles.chipsRow}>
            <Pressable onPress={() => setGoalAccountId(null)} style={[styles.chip, !goalAccountId && styles.chipActive]}>
              <Text style={[styles.chipText, !goalAccountId && styles.chipTextActive]}>Sin cuenta</Text>
            </Pressable>
            {state.accounts.map((a) => (
              <Pressable key={a.id} onPress={() => setGoalAccountId(a.id)} style={[styles.chip, goalAccountId === a.id && styles.chipActive]}>
                <Text style={[styles.chipText, goalAccountId === a.id && styles.chipTextActive]}>{a.name}</Text>
              </Pressable>
            ))}
          </View>
        )}
        <PrimaryButton label="Crear meta" onPress={submitGoal} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  accountRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderTopWidth: 1, borderColor: colors.gridline, paddingVertical: spacing.sm },
  accountIconWrap: { width: 36, height: 36, borderRadius: radius.sm, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  accountName: { fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.textPrimary },
  accountMeta: { fontFamily: fonts.body, fontSize: 12, color: colors.muted, marginTop: 2 },
  accountAmount: { fontFamily: fonts.displaySemibold, fontSize: 14, color: colors.textPrimary },
  accountAmountLabel: { fontFamily: fonts.body, fontSize: 10, color: colors.muted },
  removeIcon: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  removeLink: { color: colors.critical, fontFamily: fonts.bodyMedium, fontSize: 12 },
  input: {
    backgroundColor: colors.page,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    fontFamily: fonts.body,
    fontSize: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xs,
  },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.xs },
  chip: { paddingHorizontal: spacing.sm, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.page, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.textSecondary },
  chipTextActive: { color: '#fff', fontFamily: fonts.bodyBold },
  goalItem: { borderTopWidth: 1, borderColor: colors.gridline, paddingVertical: spacing.sm, gap: 6 },
  goalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  track: { height: 8, borderRadius: radius.pill, backgroundColor: colors.gridline, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.gold, borderRadius: radius.pill },
  secondaryButton: { alignSelf: 'flex-start', borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: 6 },
  secondaryButtonText: { fontFamily: fonts.bodySemibold, fontSize: 12, color: colors.primary },
  contributeRow: { flexDirection: 'row', gap: spacing.xs, alignItems: 'center' },
  contributeConfirm: { width: 38, height: 38, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
});
