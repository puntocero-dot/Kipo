import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { TransactionRow } from '../../src/components/TransactionRow';
import { Card, EmptyState, Screen } from '../../src/components/ui';
import { GROUP_LABELS, GROUP_ORDER, categoryColor } from '../../src/domain/categories';
import { useKipo } from '../../src/domain/store';
import { colors, radius, spacing } from '../../src/theme';

export default function HistoryScreen() {
  const { state } = useKipo();
  const [groupFilter, setGroupFilter] = useState<string | null>(null);
  const [memberFilter, setMemberFilter] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    return state.transactions
      .filter((t) => (groupFilter ? t.groupSlug === groupFilter : true))
      .filter((t) => (memberFilter ? t.userId === memberFilter : true))
      .filter((t) => {
        if (!query.trim()) return true;
        const haystack = `${t.description} ${t.merchant ?? ''} ${t.rawText ?? ''}`.toLowerCase();
        return haystack.includes(query.trim().toLowerCase());
      })
      .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
  }, [state.transactions, groupFilter, memberFilter, query]);

  const memberName = (id: string) => state.members.find((m) => m.id === id)?.name;

  return (
    <Screen>
      <TextInput
        style={styles.search}
        placeholder="Buscar por comercio o descripción..."
        value={query}
        onChangeText={setQuery}
      />

      <View style={styles.chipsRow}>
        <Pressable onPress={() => setGroupFilter(null)} style={[styles.chip, !groupFilter && styles.chipActive]}>
          <Text style={[styles.chipText, !groupFilter && styles.chipTextActive]}>Todas</Text>
        </Pressable>
        {GROUP_ORDER.map((slug) => (
          <Pressable
            key={slug}
            onPress={() => setGroupFilter(groupFilter === slug ? null : slug)}
            style={[styles.chip, groupFilter === slug && { backgroundColor: categoryColor(slug) }]}
          >
            <Text style={[styles.chipText, groupFilter === slug && styles.chipTextActive]}>{GROUP_LABELS[slug]}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.chipsRow}>
        <Pressable onPress={() => setMemberFilter(null)} style={[styles.chip, !memberFilter && styles.chipActive]}>
          <Text style={[styles.chipText, !memberFilter && styles.chipTextActive]}>Toda la familia</Text>
        </Pressable>
        {state.members.map((m) => (
          <Pressable
            key={m.id}
            onPress={() => setMemberFilter(memberFilter === m.id ? null : m.id)}
            style={[styles.chip, memberFilter === m.id && styles.chipActive]}
          >
            <Text style={[styles.chipText, memberFilter === m.id && styles.chipTextActive]}>{m.name}</Text>
          </Pressable>
        ))}
      </View>

      <Card>
        {filtered.length === 0 ? (
          <EmptyState message="No hay movimientos que coincidan con los filtros." />
        ) : (
          filtered.map((t) => <TransactionRow key={t.id} transaction={t} memberName={memberName(t.userId)} />)
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: 14,
  },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.textPrimary, borderColor: colors.textPrimary },
  chipText: { fontSize: 12, color: colors.textSecondary },
  chipTextActive: { color: '#fff', fontWeight: '600' },
});
