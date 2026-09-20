import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { BudgetUsage } from '../domain/selectors';
import { colors, fonts, radius, spacing } from '../theme';

const STATUS_COLOR: Record<BudgetUsage['status'], string> = {
  ok: colors.good,
  warning: colors.warning,
  over: colors.critical,
};

const STATUS_TEXT: Record<BudgetUsage['status'], string> = {
  ok: 'Dentro del presupuesto',
  warning: 'Cerca del límite',
  over: 'Presupuesto superado',
};

export const BudgetBarRow = React.memo(function BudgetBarRow({ budget }: { budget: BudgetUsage }) {
  const color = STATUS_COLOR[budget.status];
  const widthPct = Math.min(budget.pct, 1) * 100;

  return (
    <View style={styles.row}>
      <View style={styles.header}>
        <Text style={styles.name}>{budget.name}</Text>
        <Text style={styles.amounts}>
          ${budget.spent.toFixed(0)} / ${budget.amountLimit.toFixed(0)}
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${widthPct}%`, backgroundColor: color }]} />
      </View>
      <View style={styles.footer}>
        {budget.status !== 'ok' && (
          <View style={[styles.dot, { backgroundColor: color }]} />
        )}
        <Text style={[styles.statusText, budget.status !== 'ok' && { color }]}>
          {STATUS_TEXT[budget.status]} ({(budget.pct * 100).toFixed(0)}%)
        </Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  row: { gap: spacing.xs },
  header: { flexDirection: 'row', justifyContent: 'space-between' },
  name: { fontFamily: fonts.bodySemibold, color: colors.textPrimary, fontSize: 14 },
  amounts: { fontFamily: fonts.bodyMedium, color: colors.textSecondary, fontSize: 13, fontVariant: ['tabular-nums'] },
  track: { height: 8, borderRadius: radius.pill, backgroundColor: colors.gridline, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontFamily: fonts.body, fontSize: 12, color: colors.muted },
});
