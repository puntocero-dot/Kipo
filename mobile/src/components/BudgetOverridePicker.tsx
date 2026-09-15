import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { computeBudgetUsage, resolveDefaultBudgetId } from '../domain/selectors';
import { useKipo } from '../domain/store';
import { colors, fonts, radius, spacing } from '../theme';
import { BudgetBarRow } from './BudgetBarRow';

interface Props {
  groupSlug: string | null;
  amount: number;
  value: string | null; // override elegido; null = usar el sugerido
  onChange: (budgetId: string | null) => void;
}

// "¿A qué presupuesto afecta?" — un gasto ya categorizado puede redirigirse a
// cualquier presupuesto activo (no solo el de su categoría), con el
// presupuesto de la categoría pre-elegido como sugerencia y una previsualización
// en vivo de cómo queda ese presupuesto con este gasto sumado. Compartido entre
// ConfirmCaptureCard (captura por chat/manual) y el paso de confirmación de SMS.
export function BudgetOverridePicker({ groupSlug, amount, value, onChange }: Props) {
  const { state } = useKipo();
  const defaultBudgetId = resolveDefaultBudgetId(state.budgets, groupSlug);
  const effectiveBudgetId = value ?? defaultBudgetId;

  if (!groupSlug || state.budgets.length === 0) return null;

  const usage = effectiveBudgetId
    ? computeBudgetUsage(state.budgets, state.transactions).find((u) => u.id === effectiveBudgetId)
    : undefined;
  const projectedSpent = usage ? usage.spent + (Number.isNaN(amount) ? 0 : amount) : 0;
  const projectedPct = usage && usage.amountLimit > 0 ? projectedSpent / usage.amountLimit : 0;

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>¿A qué presupuesto afecta?</Text>
      <View style={styles.chipsRow}>
        {state.budgets.map((b) => (
          <Pressable
            key={b.id}
            onPress={() => onChange(b.id === defaultBudgetId ? null : b.id)}
            style={[styles.chip, effectiveBudgetId === b.id && styles.chipActive]}
          >
            <Text style={[styles.chipText, effectiveBudgetId === b.id && styles.chipTextActive]}>
              {b.name}
              {b.id === defaultBudgetId ? ' (sugerido)' : ''}
            </Text>
          </Pressable>
        ))}
      </View>

      {usage && (
        <View style={styles.preview}>
          <BudgetBarRow budget={usage} />
          <Text style={styles.previewCaption}>
            Con este gasto: ${projectedSpent.toFixed(0)} / ${usage.amountLimit.toFixed(0)} ({(projectedPct * 100).toFixed(0)}%)
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.muted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.page, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.textSecondary },
  chipTextActive: { color: '#fff', fontFamily: fonts.bodyBold },
  preview: { backgroundColor: colors.page, borderRadius: radius.md, padding: spacing.sm, gap: 6 },
  previewCaption: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.textSecondary },
});
