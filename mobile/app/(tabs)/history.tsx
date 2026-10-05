import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SelectField } from '../../src/components/SelectField';
import { TabScreenGuard } from '../../src/components/TabScreenGuard';
import { TransactionRow } from '../../src/components/TransactionRow';
import { Card, EmptyState, Screen } from '../../src/components/ui';
import { GROUP_LABELS, GROUP_ORDER, categoryColor } from '../../src/domain/categories';
import { availableMonths, availableYears, formatDayLabel, monthKey } from '../../src/domain/selectors';
import { useKipo } from '../../src/domain/store';
import { confirmAction } from '../../src/lib/confirm';
import type { Transaction } from '../../src/domain/types';
import { colors, fonts, radius, spacing } from '../../src/theme';

export default function HistoryScreen() {
  const { state, deleteTransaction } = useKipo();
  const [groupFilter, setGroupFilter] = useState<string | null>(null);
  const [memberFilter, setMemberFilter] = useState<string | null>(null);
  const [monthFilter, setMonthFilter] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const years = useMemo(() => availableYears(state.transactions), [state.transactions]);
  const months = useMemo(() => availableMonths(state.transactions), [state.transactions]);

  const filtered = useMemo(() => {
    return state.transactions
      .filter((t) => (groupFilter ? t.groupSlug === groupFilter : true))
      .filter((t) => (memberFilter ? t.userId === memberFilter : true))
      .filter((t) => (monthFilter ? monthKey(t.occurredAt).startsWith(monthFilter) : true))
      .filter((t) => {
        if (!query.trim()) return true;
        const haystack = `${t.description} ${t.merchant ?? ''} ${t.rawText ?? ''}`.toLowerCase();
        return haystack.includes(query.trim().toLowerCase());
      })
      .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
  }, [state.transactions, groupFilter, memberFilter, monthFilter, query]);

  // Agrupa por día real (Hoy / Ayer / 12 sep) — así el historial se lee como
  // lo que es, un registro cronológico, no una lista plana sin contexto.
  const groupedByDay = useMemo(() => {
    const groups: { label: string; items: Transaction[] }[] = [];
    for (const t of filtered) {
      const label = formatDayLabel(t.occurredAt);
      const last = groups[groups.length - 1];
      if (last && last.label === label) last.items.push(t);
      else groups.push({ label, items: [t] });
    }
    return groups;
  }, [filtered]);

  const memberName = (id: string) => state.members.find((m) => m.id === id)?.name;

  return (
    <TabScreenGuard>
    <Screen>
      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={16} color={colors.muted} />
        <TextInput
          style={styles.search}
          placeholder="Buscar por comercio o descripción..."
          placeholderTextColor={colors.muted}
          value={query}
          onChangeText={setQuery}
        />
      </View>

      <SelectField
        label="Período"
        value={monthFilter}
        onChange={setMonthFilter}
        options={[
          { value: null, label: 'Todos los meses' },
          { header: 'Año completo' },
          ...years.map((y) => ({ value: y.key as string | null, label: y.label })),
          { header: 'Mes' },
          ...months.map((m) => ({ value: m.key as string | null, label: m.label })),
        ]}
      />

      <View style={styles.filterRow}>
        <SelectField
          style={{ flex: 1 }}
          label="Categoría"
          value={groupFilter}
          onChange={setGroupFilter}
          options={[
            { value: null, label: 'Todas' },
            ...GROUP_ORDER.map((slug) => ({ value: slug as string | null, label: GROUP_LABELS[slug] })),
          ]}
        />
        <SelectField
          style={{ flex: 1 }}
          label="Miembro"
          value={memberFilter}
          onChange={setMemberFilter}
          options={[
            { value: null, label: 'Toda la familia' },
            ...state.members.map((m) => ({ value: m.id as string | null, label: m.name })),
          ]}
        />
      </View>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState message="No hay movimientos que coincidan con los filtros." />
        </Card>
      ) : (
        groupedByDay.map((group) => (
          <View key={group.label}>
            <Text style={styles.dayLabel}>{group.label}</Text>
            <Card>
              {group.items.map((t) => (
                <TransactionRow
                  key={t.id}
                  transaction={t}
                  memberName={memberName(t.userId)}
                  showTime
                  onDelete={() =>
                    confirmAction(
                      'Eliminar movimiento',
                      `¿Borrar "${t.description || t.merchant || 'este movimiento'}"?`,
                      'Eliminar',
                      () => deleteTransaction(t.id),
                    )
                  }
                />
              ))}
            </Card>
          </View>
        ))
      )}
    </Screen>
    </TabScreenGuard>
  );
}

const styles = StyleSheet.create({
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  search: { flex: 1, minWidth: 0, paddingVertical: 11, fontFamily: fonts.body, fontSize: 14, color: colors.textPrimary, outlineWidth: 0 },
  filterRow: { flexDirection: 'row', gap: spacing.sm },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chipsScroll: { flexDirection: 'row', gap: spacing.xs, paddingRight: spacing.lg },
  chip: { paddingHorizontal: spacing.sm, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.textSecondary },
  chipTextActive: { color: '#fff', fontFamily: fonts.bodyBold },
  dayLabel: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: spacing.xs, marginBottom: 6, marginLeft: 2 },
});
