import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { categoryColor, findCategory } from '../domain/categories';
import { groupLabel } from '../domain/selectors';
import type { Transaction } from '../domain/types';
import { colors, spacing } from '../theme';

const SOURCE_ICON: Record<Transaction['source'], string> = {
  chat: '💬',
  voz: '🎙️',
  sms: '🏦',
  manual: '✍️',
  recurrente: '🔁',
};

export function TransactionRow({ transaction, memberName, onPress }: { transaction: Transaction; memberName?: string; onPress?: () => void }) {
  const isIncome = transaction.type === 'ingreso';
  const category = findCategory(transaction.groupSlug, transaction.subSlug);
  const color = isIncome ? colors.good : categoryColor(transaction.groupSlug);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}>
      <View style={[styles.iconWrap, { backgroundColor: color + '22' }]}>
        <Text style={styles.icon}>{isIncome ? '💰' : SOURCE_ICON[transaction.source]}</Text>
      </View>
      <View style={styles.middle}>
        <Text style={styles.title} numberOfLines={1}>
          {transaction.description || transaction.merchant || 'Movimiento'}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {isIncome ? 'Ingreso' : category?.label ?? groupLabel(transaction.groupSlug)}
          {memberName ? ` · ${memberName}` : ''}
          {transaction.status === 'pendiente' ? ' · Por confirmar' : ''}
        </Text>
      </View>
      <Text style={[styles.amount, { color: isIncome ? colors.good : colors.textPrimary }]}>
        {isIncome ? '+' : '-'}${transaction.amount.toFixed(2)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  iconWrap: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 16 },
  middle: { flex: 1 },
  title: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  subtitle: { fontSize: 12, color: colors.muted, marginTop: 2 },
  amount: { fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
