import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { categoryColor, findCategory } from '../domain/categories';
import { formatDayLabel, formatTime } from '../domain/selectors';
import { useKipo } from '../domain/store';
import type { Transaction } from '../domain/types';
import { colors, fonts, radius, shadow, spacing } from '../theme';
import { BudgetOverridePicker } from './BudgetOverridePicker';
import { CategoryPickerModal } from './CategoryPickerModal';
import { Pill } from './ui';

const DAY_OPTIONS = [
  { label: 'Ahora', offset: 0 },
  { label: 'Ayer', offset: -1 },
  { label: 'Antier', offset: -2 },
];

function dayWithOffset(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString();
}

interface Props {
  transaction: Transaction;
  onConfirm: (patch: Partial<Transaction>) => void;
  onDiscard: () => void;
}

export function ConfirmCaptureCard({ transaction, onConfirm, onDiscard }: Props) {
  const { state } = useKipo();
  const isIncome = transaction.type === 'ingreso';
  const [amountText, setAmountText] = useState(transaction.amount ? String(transaction.amount) : '');
  const [groupSlug, setGroupSlug] = useState(transaction.groupSlug);
  const [subSlug, setSubSlug] = useState(transaction.subSlug);
  const [occurredAt, setOccurredAt] = useState(transaction.occurredAt);
  const [accountId, setAccountId] = useState(transaction.accountId ?? null);
  const [budgetId, setBudgetId] = useState<string | null>(transaction.budgetId ?? null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const dayOffsetSelected = (offset: number) => {
    const target = new Date();
    target.setDate(target.getDate() + offset);
    const current = new Date(occurredAt);
    return target.toDateString() === current.toDateString();
  };

  const category = findCategory(groupSlug, subSlug);
  const color = categoryColor(groupSlug);
  const parsedAmount = parseFloat(amountText.replace(',', '.'));
  // Un ingreso no tiene categoría en este esquema (ver categoryDictionary.mjs,
  // 100% de gasto) — solo el gasto necesita una para poder guardarse.
  const canConfirm = !Number.isNaN(parsedAmount) && parsedAmount > 0 && (isIncome || !!groupSlug);

  return (
    <View style={styles.card}>
      <Text style={styles.rawText}>"{transaction.rawText}"</Text>
      <Text style={styles.description}>{transaction.description}</Text>

      <View style={styles.row}>
        <View style={styles.amountBox}>
          <Text style={styles.label}>Monto</Text>
          <View style={styles.amountInputRow}>
            <Text style={styles.dollar}>$</Text>
            <TextInput
              style={styles.amountInput}
              keyboardType="decimal-pad"
              value={amountText}
              onChangeText={setAmountText}
              placeholder="0.00"
              autoFocus={!transaction.amount}
            />
          </View>
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.label}>{isIncome ? 'Tipo de ingreso' : 'Categoría'}</Text>
          <Pressable onPress={() => setPickerOpen(true)}>
            <Pill
              label={category?.label ?? (isIncome ? 'Ingreso' : 'Elegir categoría')}
              color={category ? color : isIncome ? colors.good : colors.muted}
            />
          </Pressable>
        </View>
      </View>

      <View>
        <View style={styles.whenRow}>
          <Text style={styles.label}>¿Cuándo?</Text>
          <Text style={styles.whenValue}>
            {formatDayLabel(occurredAt)} · {formatTime(occurredAt)}
          </Text>
        </View>
        <View style={styles.dayChipsRow}>
          {DAY_OPTIONS.map((opt) => {
            const selected = dayOffsetSelected(opt.offset);
            return (
              <Pressable
                key={opt.label}
                onPress={() => setOccurredAt(dayWithOffset(opt.offset))}
                style={[styles.dayChip, selected && styles.dayChipActive]}
              >
                <Text style={[styles.dayChipText, selected && styles.dayChipTextActive]}>{opt.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {state.accounts.length > 0 && (
        <View>
          <Text style={styles.label}>Medio de pago</Text>
          <View style={styles.dayChipsRow}>
            <Pressable onPress={() => setAccountId(null)} style={[styles.dayChip, !accountId && styles.dayChipActive]}>
              <Text style={[styles.dayChipText, !accountId && styles.dayChipTextActive]}>Sin especificar</Text>
            </Pressable>
            {state.accounts.map((a) => (
              <Pressable key={a.id} onPress={() => setAccountId(a.id)} style={[styles.dayChip, accountId === a.id && styles.dayChipActive]}>
                <Text style={[styles.dayChipText, accountId === a.id && styles.dayChipTextActive]}>{a.name}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {!isIncome && (
        <BudgetOverridePicker
          groupSlug={groupSlug}
          amount={parsedAmount}
          value={budgetId}
          onChange={setBudgetId}
        />
      )}

      {!isIncome && !groupSlug && <Text style={styles.warning}>No pude adivinar la categoría — elige una para confirmar.</Text>}
      {Number.isNaN(parsedAmount) && <Text style={styles.warning}>No detecté un monto válido.</Text>}

      <View style={styles.actions}>
        <Pressable
          style={[styles.confirmButton, !canConfirm && styles.disabled]}
          disabled={!canConfirm}
          onPress={() => onConfirm({ amount: parsedAmount, groupSlug, subSlug, occurredAt, accountId, budgetId })}
        >
          <Text style={styles.confirmText}>Guardar</Text>
        </Pressable>
        <Pressable style={styles.discardButton} onPress={onDiscard}>
          <Text style={styles.discardText}>Descartar</Text>
        </Pressable>
      </View>

      <CategoryPickerModal
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        kind={isIncome ? 'ingreso' : 'gasto'}
        onSelect={(option) => {
          setGroupSlug(option.groupSlug);
          setSubSlug(option.subSlug);
          setBudgetId(null); // la categoría cambió — no arrastrar un override que ya no aplica
          setPickerOpen(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    gap: spacing.sm,
    ...shadow.card,
  },
  rawText: { fontFamily: fonts.body, fontSize: 12, color: colors.muted, fontStyle: 'italic' },
  description: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.textPrimary },
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  amountBox: { width: 120 },
  label: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.muted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  amountInputRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 2, borderColor: colors.primarySoft },
  dollar: { fontFamily: fonts.displaySemibold, fontSize: 16, color: colors.textSecondary, marginRight: 2 },
  amountInput: {
    fontFamily: fonts.display,
    fontSize: 17,
    color: colors.textPrimary,
    paddingVertical: 4,
    flex: 1,
    minWidth: 0,
    outlineWidth: 0,
  },
  warning: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.warning },
  whenRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  whenValue: { fontFamily: fonts.bodySemibold, fontSize: 12, color: colors.textPrimary },
  dayChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: 6 },
  dayChip: { paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.page, borderWidth: 1, borderColor: colors.border },
  dayChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayChipText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.textSecondary },
  dayChipTextActive: { color: '#fff', fontFamily: fonts.bodyBold },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  confirmButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 11,
    alignItems: 'center',
    shadowColor: colors.primaryDeep,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  confirmText: { color: '#fff', fontFamily: fonts.bodyBold, fontSize: 14 },
  discardButton: { paddingVertical: 11, paddingHorizontal: spacing.md, alignItems: 'center' },
  discardText: { color: colors.critical, fontFamily: fonts.bodySemibold, fontSize: 14 },
  disabled: { opacity: 0.4 },
});
