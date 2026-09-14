import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { MonthTrendPoint } from '../domain/selectors';
import { colors, fonts, radius, spacing } from '../theme';

const CHART_HEIGHT = 120;

export function MonthlyTrendChart({ points }: { points: MonthTrendPoint[] }) {
  const max = Math.max(1, ...points.flatMap((p) => [p.income, p.expenses]));

  return (
    <View>
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: colors.good }]} />
          <Text style={styles.legendText}>Ingresos</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: colors.critical }]} />
          <Text style={styles.legendText}>Gastos</Text>
        </View>
      </View>

      <View style={styles.chart}>
        {points.map((p) => (
          <View key={p.key} style={styles.column}>
            <View style={styles.barsRow}>
              <View style={[styles.bar, { height: Math.max(3, (p.income / max) * CHART_HEIGHT), backgroundColor: colors.good }]} />
              <View style={[styles.bar, { height: Math.max(3, (p.expenses / max) * CHART_HEIGHT), backgroundColor: colors.critical }]} />
            </View>
            <Text style={styles.monthLabel}>{p.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  legend: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.textSecondary },
  chart: { flexDirection: 'row', alignItems: 'flex-end', height: CHART_HEIGHT + 24, gap: 4 },
  column: { flex: 1, alignItems: 'center' },
  barsRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: CHART_HEIGHT },
  bar: { width: 10, borderTopLeftRadius: radius.sm / 2, borderTopRightRadius: radius.sm / 2 },
  monthLabel: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.muted, marginTop: 6, textTransform: 'capitalize' },
});
