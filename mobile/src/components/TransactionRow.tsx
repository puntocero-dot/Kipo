import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { categoryColor, findCategory } from '../domain/categories';
import { groupLabel } from '../domain/selectors';
import type { Transaction } from '../domain/types';
import { colors, fonts, radius, spacing } from '../theme';

const SOURCE_ICON: Record<Transaction['source'], keyof typeof Ionicons.glyphMap> = {
  chat: 'chatbubble-outline',
  voz: 'mic-outline',
  sms: 'card-outline',
  manual: 'create-outline',
  recurrente: 'repeat-outline',
};

export function TransactionRow({
  transaction,
  memberName,
  showTime,
  onPress,
  onDelete,
}: {
  transaction: Transaction;
  memberName?: string;
  showTime?: boolean;
  onPress?: () => void;
  onDelete?: () => void;
}) {
  const isIncome = transaction.type === 'ingreso';
  const category = findCategory(transaction.groupSlug, transaction.subSlug);
  const color = isIncome ? colors.good : categoryColor(transaction.groupSlug);
  const time = showTime
    ? new Date(transaction.occurredAt).toLocaleTimeString('es', { hour: 'numeric', minute: '2-digit' })
    : null;

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
      <View style={[styles.iconWrap, { backgroundColor: color + '1F' }]}>
        <Ionicons name={isIncome ? 'trending-up-outline' : SOURCE_ICON[transaction.source]} size={17} color={color} />
      </View>
      <View style={styles.middle}>
        <Text style={styles.title} numberOfLines={1}>
          {transaction.description || transaction.merchant || 'Movimiento'}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {category?.label ?? (isIncome ? 'Ingreso' : groupLabel(transaction.groupSlug))}
          {memberName ? ` · ${memberName}` : ''}
          {transaction.status === 'pendiente' ? ' · Por confirmar' : ''}
        </Text>
      </View>
      <View style={styles.amountCol}>
        <Text style={[styles.amount, { color: isIncome ? colors.good : colors.textPrimary }]}>
          {isIncome ? '+' : '-'}${transaction.amount.toFixed(2)}
        </Text>
        {time && <Text style={styles.time}>{time}</Text>}
      </View>
      {onDelete && (
        <Pressable
          onPress={onDelete}
          style={styles.deleteButton}
          accessibilityLabel="Eliminar movimiento"
          testID={`delete-tx-${transaction.id}`}
        >
          <Ionicons name="trash-outline" size={16} color={colors.muted} />
        </Pressable>
      )}
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gridline,
  },
  iconWrap: { width: 38, height: 38, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  middle: { flex: 1 },
  title: { fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.textPrimary },
  subtitle: { fontFamily: fonts.body, fontSize: 12, color: colors.muted, marginTop: 2 },
  amountCol: { alignItems: 'flex-end' },
  amount: { fontFamily: fonts.displaySemibold, fontSize: 14, fontVariant: ['tabular-nums'] },
  time: { fontFamily: fonts.body, fontSize: 11, color: colors.muted, marginTop: 2, fontVariant: ['tabular-nums'] },
  deleteButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
});
