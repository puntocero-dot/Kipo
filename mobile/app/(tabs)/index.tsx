import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DonutChart } from '../../src/components/DonutChart';
import { TransactionRow } from '../../src/components/TransactionRow';
import { Card, EmptyState, Screen, SectionTitle } from '../../src/components/ui';
import { computeMacroDistribution, computeMonthSummary, computeUpcomingReminders, daysUntil } from '../../src/domain/selectors';
import { useKipo } from '../../src/domain/store';
import { colors, radius, spacing } from '../../src/theme';

const MONTH_NAMES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

export default function DashboardScreen() {
  const router = useRouter();
  const { state } = useKipo();
  const now = new Date();

  const summary = computeMonthSummary(state.transactions, now);
  const macro = computeMacroDistribution(state.transactions, now);
  const upcoming = computeUpcomingReminders(state.reminders, 7, now);
  const latest = [...state.transactions]
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
    .slice(0, 6);

  const memberName = (id: string) => state.members.find((m) => m.id === id)?.name;
  const usedPct = summary.income > 0 ? Math.min(summary.expenses / summary.income, 1) : 0;

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        <View>
          <Text style={styles.greeting}>{state.familyName}</Text>
          <Text style={styles.monthLabel}>Balance de {MONTH_NAMES[now.getMonth()]}</Text>
        </View>

        <Card>
          <View style={styles.balanceRow}>
            <View>
              <Text style={styles.balanceLabel}>Ingresos</Text>
              <Text style={[styles.balanceValue, { color: colors.good }]}>${summary.income.toFixed(0)}</Text>
            </View>
            <View>
              <Text style={styles.balanceLabel}>Gastos</Text>
              <Text style={[styles.balanceValue, { color: colors.critical }]}>${summary.expenses.toFixed(0)}</Text>
            </View>
            <View>
              <Text style={styles.balanceLabel}>Balance</Text>
              <Text style={styles.balanceValue}>${summary.balance.toFixed(0)}</Text>
            </View>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${usedPct * 100}%` }]} />
          </View>
          <Text style={styles.trackCaption}>{(usedPct * 100).toFixed(0)}% de tus ingresos ya se gastó este mes</Text>
        </Card>

        <Card>
          <SectionTitle>Distribución de gastos</SectionTitle>
          <DonutChart
            slices={macro.map((m) => ({ key: m.key, label: m.label, amount: m.amount, pct: m.pct, color: m.color }))}
            centerLabel="gastado"
            centerValue={`$${summary.expenses.toFixed(0)}`}
          />
        </Card>

        <Card>
          <SectionTitle>⏰ Próximos pagos (7 días)</SectionTitle>
          {upcoming.length === 0 ? (
            <EmptyState message="No tienes pagos fijos venciendo esta semana." />
          ) : (
            upcoming.map((r) => {
              const d = daysUntil(r.nextDueDate, now);
              const urgent = d <= 2;
              return (
                <View key={r.id} style={styles.reminderRow}>
                  <Text style={styles.reminderName}>{r.name}</Text>
                  <Text style={[styles.reminderDue, urgent && { color: colors.critical }]}>
                    {d <= 0 ? 'Vence hoy' : `Vence en ${d} día${d === 1 ? '' : 's'}`}
                    {r.amount ? ` · $${r.amount}` : ''}
                  </Text>
                </View>
              );
            })
          )}
        </Card>

        <Card>
          <SectionTitle
            right={
              <Pressable onPress={() => router.push('/history')}>
                <Text style={styles.link}>Ver todo</Text>
              </Pressable>
            }
          >
            Últimos movimientos
          </SectionTitle>
          {latest.length === 0 ? (
            <EmptyState message="Aún no hay movimientos registrados." />
          ) : (
            latest.map((t) => <TransactionRow key={t.id} transaction={t} memberName={memberName(t.userId)} />)
          )}
        </Card>
      </Screen>

      <Pressable style={styles.fab} onPress={() => router.push('/chat')}>
        <Text style={styles.fabIcon}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  greeting: { fontSize: 22, fontWeight: '800', color: colors.textPrimary },
  monthLabel: { fontSize: 13, color: colors.muted, marginTop: 2, textTransform: 'capitalize' },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between' },
  balanceLabel: { fontSize: 12, color: colors.muted },
  balanceValue: { fontSize: 18, fontWeight: '800', color: colors.textPrimary, marginTop: 2 },
  track: { height: 8, borderRadius: radius.pill, backgroundColor: colors.gridline, overflow: 'hidden', marginTop: spacing.sm },
  fill: { height: '100%', backgroundColor: colors.primary, borderRadius: radius.pill },
  trackCaption: { fontSize: 11, color: colors.muted, marginTop: 4 },
  reminderRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  reminderName: { fontSize: 14, color: colors.textPrimary, fontWeight: '600' },
  reminderDue: { fontSize: 13, color: colors.textSecondary },
  link: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.xl,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  fabIcon: { color: '#fff', fontSize: 30, marginTop: -2 },
});
