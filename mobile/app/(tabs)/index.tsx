import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DonutChart } from '../../src/components/DonutChart';
import { TabScreenGuard } from '../../src/components/TabScreenGuard';
import { TransactionRow } from '../../src/components/TransactionRow';
import { Card, EmptyState, Screen, SectionTitle } from '../../src/components/ui';
import { computeMacroDistribution, computeMonthSummary, computeUpcomingReminders, daysUntil } from '../../src/domain/selectors';
import { useKipo } from '../../src/domain/store';
import { colors, fonts, radius, shadow, spacing } from '../../src/theme';

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
    <TabScreenGuard>
      <Screen>
        <View>
          <Text style={styles.greeting}>{state.familyName}</Text>
          <Text style={styles.monthLabel}>Balance de {MONTH_NAMES[now.getMonth()]}</Text>
        </View>

        <LinearGradient
          colors={[colors.primary, colors.primaryDeep]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.balanceRow}>
            <View>
              <Text style={styles.balanceLabel}>Ingresos</Text>
              <Text style={styles.balanceValue}>${summary.income.toFixed(0)}</Text>
            </View>
            <View>
              <Text style={styles.balanceLabel}>Gastos</Text>
              <Text style={styles.balanceValue}>${summary.expenses.toFixed(0)}</Text>
            </View>
            <View>
              <Text style={styles.balanceLabel}>Balance</Text>
              <Text style={styles.balanceValueStrong}>${summary.balance.toFixed(0)}</Text>
            </View>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${usedPct * 100}%` }]} />
          </View>
          <Text style={styles.trackCaption}>{(usedPct * 100).toFixed(0)}% de tus ingresos ya se gastó este mes</Text>
        </LinearGradient>

        <Card>
          <SectionTitle icon="pie-chart-outline">Distribución de gastos</SectionTitle>
          <DonutChart
            slices={macro.map((m) => ({ key: m.key, label: m.label, amount: m.amount, pct: m.pct, color: m.color }))}
            centerLabel="gastado"
            centerValue={`$${summary.expenses.toFixed(0)}`}
          />
        </Card>

        <Card>
          <SectionTitle icon="alarm-outline">Próximos pagos (7 días)</SectionTitle>
          {upcoming.length === 0 ? (
            <EmptyState icon="checkmark-circle-outline" message="No tienes pagos fijos venciendo esta semana." />
          ) : (
            upcoming.map((r) => {
              const d = daysUntil(r.nextDueDate, now);
              const urgent = d <= 2;
              return (
                <View key={r.id} style={styles.reminderRow}>
                  <View style={[styles.reminderDot, urgent && { backgroundColor: colors.critical }]} />
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
            icon="time-outline"
            right={
              <Pressable style={styles.linkRow} onPress={() => router.push('/history')}>
                <Text style={styles.link}>Ver todo</Text>
                <Ionicons name="chevron-forward" size={14} color={colors.primary} />
              </Pressable>
            }
          >
            Últimos movimientos
          </SectionTitle>
          {latest.length === 0 ? (
            <EmptyState icon="document-text-outline" message="Aún no hay movimientos registrados." />
          ) : (
            latest.map((t) => (
              <TransactionRow key={t.id} transaction={t} memberName={memberName(t.userId)} />
            ))
          )}
        </Card>
      </Screen>

      <Pressable style={({ pressed }) => [styles.fab, pressed && { opacity: 0.85 }]} onPress={() => router.push('/chat')}>
        <Ionicons name="add" size={28} color="#fff" />
      </Pressable>
    </TabScreenGuard>
  );
}

const styles = StyleSheet.create({
  greeting: { fontFamily: fonts.display, fontSize: 24, color: colors.textPrimary },
  monthLabel: { fontFamily: fonts.body, fontSize: 13, color: colors.muted, marginTop: 2, textTransform: 'capitalize' },
  heroCard: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadow.raised,
  },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between' },
  balanceLabel: { fontFamily: fonts.bodyMedium, fontSize: 12, color: 'rgba(255,255,255,0.75)' },
  balanceValue: { fontFamily: fonts.displaySemibold, fontSize: 19, color: '#fff', marginTop: 2 },
  balanceValueStrong: { fontFamily: fonts.displayBlack, fontSize: 19, color: '#fff', marginTop: 2 },
  track: { height: 8, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.22)', overflow: 'hidden', marginTop: spacing.md },
  fill: { height: '100%', backgroundColor: colors.gold, borderRadius: radius.pill },
  trackCaption: { fontFamily: fonts.body, fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 6 },
  reminderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: 7 },
  reminderDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.gold },
  reminderName: { flex: 1, fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.textPrimary },
  reminderDue: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.textSecondary },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  link: { color: colors.primary, fontFamily: fonts.bodySemibold, fontSize: 13 },
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
    ...shadow.floating,
  },
});
