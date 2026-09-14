import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, radius, spacing } from '../theme';

export function Screen({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.page }}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl * 2, gap: spacing.md }}
    >
      {children}
    </ScrollView>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={styles.sectionTitle}>{children}</Text>
      {right}
    </View>
  );
}

export function Pill({ label, color, textColor }: { label: string; color: string; textColor?: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: color }]}>
      <Text style={[styles.pillText, { color: textColor ?? '#ffffff' }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export function PrimaryButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.primaryButton, disabled && styles.disabled, pressed && styles.pressed]}
    >
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

export function SecondaryButton({ label, onPress, tone = 'default' }: { label: string; onPress: () => void; tone?: 'default' | 'danger' }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
      <Text style={[styles.secondaryButtonText, tone === 'danger' && { color: colors.critical }]}>{label}</Text>
    </Pressable>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  pill: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.pill, maxWidth: 180 },
  pillText: { fontSize: 12, fontWeight: '600' },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#ffffff', fontWeight: '700', fontSize: 15 },
  secondaryButton: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, alignItems: 'center' },
  secondaryButtonText: { color: colors.textSecondary, fontWeight: '600' },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.75 },
  empty: { paddingVertical: spacing.lg, alignItems: 'center' },
  emptyText: { color: colors.muted, fontSize: 13 },
});
