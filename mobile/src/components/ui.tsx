import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, fonts, radius, shadow, spacing } from '../theme';

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

export function SectionTitle({
  children,
  icon,
  right,
}: {
  children: React.ReactNode;
  icon?: keyof typeof Ionicons.glyphMap;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.sectionTitleRow}>
      <View style={styles.sectionTitleLeft}>
        {icon && (
          <View style={styles.sectionIconWrap}>
            <Ionicons name={icon} size={15} color={colors.primary} />
          </View>
        )}
        <Text style={styles.sectionTitle}>{children}</Text>
      </View>
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
    <Pressable style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]} onPress={onPress}>
      <Text style={[styles.secondaryButtonText, tone === 'danger' && { color: colors.critical }]}>{label}</Text>
    </Pressable>
  );
}

export function EmptyState({ message, icon = 'leaf-outline' }: { message: string; icon?: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={22} color={colors.muted} style={{ marginBottom: spacing.xs }} />
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
    ...shadow.card,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitleLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexShrink: 1 },
  sectionIconWrap: {
    width: 26,
    height: 26,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { fontFamily: fonts.displaySemibold, fontSize: 16, color: colors.textPrimary },
  pill: { paddingHorizontal: spacing.sm, paddingVertical: 5, borderRadius: radius.pill, maxWidth: 180 },
  pillText: { fontFamily: fonts.bodySemibold, fontSize: 12 },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    shadowColor: colors.primaryDeep,
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  primaryButtonText: { color: '#ffffff', fontFamily: fonts.bodyBold, fontSize: 15, letterSpacing: 0.2 },
  secondaryButton: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, alignItems: 'center' },
  secondaryButtonText: { color: colors.textSecondary, fontFamily: fonts.bodySemibold, fontSize: 14 },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.75 },
  empty: { paddingVertical: spacing.xl, alignItems: 'center' },
  emptyText: { color: colors.muted, fontFamily: fonts.body, fontSize: 13, textAlign: 'center' },
});
