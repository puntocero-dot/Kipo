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

export function TransactionRow({
  transaction,
  memberName,
  onPress,
  onDelete,
}: {
  transaction: Transaction;
  memberName?: string;
  onPress?: () => void;
  onDelete?: () => void;
}) {
  const isIncome = transaction.type === 'ingreso';
  const category = findCategory(transaction.groupSlug, transaction.subSlug);
  const color = isIncome ? colors.good : categoryColor(transaction.groupSlug);

  // Un Pressable anidado dentro de otro Pressable se comporta mal en
  // react-native-web (el de afuera puede tapar los clics del de adentro) —
  // como onPress hoy no lo usa ninguna pantalla, la fila es un View normal
  // salvo que de verdad se pase un onPress.
  const Wrapper = onPress ? Pressable : View;
  const wrapperProps = onPress
    ? { onPress, style: ({ pressed }: { pressed: boolean }) => [styles.row, pressed && { opacity: 0.7 }] }
    : { style: styles.row };

  return (
    <Wrapper {...(wrapperProps as any)}>
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
      {onDelete && (
        <Pressable
          onPress={onDelete}
          style={styles.deleteButton}
          accessibilityLabel="Eliminar movimiento"
          testID={`delete-tx-${transaction.id}`}
        >
          <Text style={styles.deleteIcon}>🗑️</Text>
        </Pressable>
      )}
    </Wrapper>
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
  deleteButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  deleteIcon: { fontSize: 15 },
});
