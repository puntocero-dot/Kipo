import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { TabScreenGuard } from '../../src/components/TabScreenGuard';
import { TransactionRow } from '../../src/components/TransactionRow';
import { Card, EmptyState, Screen } from '../../src/components/ui';
import { GROUP_LABELS, GROUP_ORDER, categoryColor } from '../../src/domain/categories';
import { useKipo } from '../../src/domain/store';
import { confirmAction } from '../../src/lib/confirm';
import { colors, fonts, radius, spacing } from '../../src/theme';

export default function HistoryScreen() {
  const { state, deleteTransaction } = useKipo();
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
          filtered.map((t) => (
            <TransactionRow
              key={t.id}
              transaction={t}
              memberName={memberName(t.userId)}
              onDelete={() =>
                confirmAction(
                  'Eliminar movimiento',
                  `¿Borrar "${t.description || t.merchant || 'este movimiento'}"?`,
                  'Eliminar',
                  () => deleteTransaction(t.id),
                )
              }
            />
          ))
        )}
      </Card>
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
  search: { flex: 1, paddingVertical: 11, fontFamily: fonts.body, fontSize: 14, color: colors.textPrimary },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { paddingHorizontal: spacing.sm, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.textSecondary },
  chipTextActive: { color: '#fff', fontFamily: fonts.bodyBold },
});
