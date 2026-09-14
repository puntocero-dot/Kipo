import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CATEGORY_OPTIONS, type CategoryOption } from '../domain/categories';
import { colors, fonts, radius, shadow, spacing } from '../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (option: CategoryOption) => void;
}

export function CategoryPickerModal({ visible, onClose, onSelect }: Props) {
  const groups = Array.from(new Set(CATEGORY_OPTIONS.map((c) => c.groupSlug)));

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <Text style={styles.title}>Elegir categoría</Text>
        <ScrollView style={{ maxHeight: 420 }}>
          {groups.map((groupSlug) => {
            const options = CATEGORY_OPTIONS.filter((c) => c.groupSlug === groupSlug);
            return (
              <View key={groupSlug} style={styles.groupBlock}>
                <Text style={styles.groupLabel}>{options[0].groupLabel}</Text>
                <View style={styles.optionsRow}>
                  {options.map((option) => (
                    <Pressable
                      key={option.subSlug}
                      onPress={() => onSelect(option)}
                      style={[styles.chip, { borderColor: option.color }]}
                    >
                      <View style={[styles.dot, { backgroundColor: option.color }]} />
                      <Text style={styles.chipText}>{option.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(35,31,26,0.45)' },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow.raised,
  },
  title: { fontFamily: fonts.display, fontSize: 18, color: colors.textPrimary },
  groupBlock: { marginBottom: spacing.md, gap: spacing.xs },
  groupLabel: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  optionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  chipText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.textPrimary },
});
