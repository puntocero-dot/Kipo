import { BlurView } from 'expo-blur';
import React, { useState } from 'react';
import { Dimensions, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { CATEGORY_OPTIONS, GROUP_LABELS, GROUP_ORDER, type CategoryOption } from '../domain/categories';
import { useKipo } from '../domain/store';
import { colors, fonts, glass, radius, shadow, spacing } from '../theme';
import { PrimaryButton, SecondaryButton } from './ui';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (option: CategoryOption) => void;
  // 'gasto' por defecto — los usos existentes (presupuestos, corrección de
  // categoría de un gasto, confirmar un cargo de SMS) son todos de gasto.
  // ConfirmCaptureCard pasa 'ingreso' cuando la transacción es un ingreso.
  kind?: 'gasto' | 'ingreso';
}

export function CategoryPickerModal({ visible, onClose, onSelect, kind = 'gasto' }: Props) {
  const { state, currentUserId, addCustomCategory } = useKipo();
  const isAdmin = state.members.find((m) => m.id === currentUserId)?.role === 'admin';
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newGroupSlug, setNewGroupSlug] = useState<string>(GROUP_ORDER[0]);

  const allOptions = [...CATEGORY_OPTIONS, ...state.customCategories];
  const kindOptions = allOptions.filter((c) => c.kind === kind);
  const groups = Array.from(new Set(kindOptions.map((c) => c.groupSlug)));

  const closeAndReset = () => {
    setAdding(false);
    setNewLabel('');
    onClose();
  };

  const submitNewCategory = () => {
    if (!newLabel.trim()) return;
    addCustomCategory({ groupSlug: newGroupSlug, label: newLabel.trim() });
    setAdding(false);
    setNewLabel('');
  };

  // Antes el formulario de "adding" era un View sin scroll ni manejo de
  // teclado: en un celular chico, con el teclado abierto, los botones
  // "Agregar"/"Cancelar" quedaban tapados por el teclado y no había forma de
  // tocarlos (había que cerrar el teclado a ciegas primero). Ahora todo el
  // contenido de la hoja va dentro de un ScrollView con tope de alto (no más
  // del ~80% de pantalla, para nunca taparse solo con el status bar/notch) y
  // la hoja entera sube sobre el teclado en iOS vía KeyboardAvoidingView.
  const sheetMaxHeight = Dimensions.get('window').height * 0.82;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={closeAndReset}>
      <Pressable style={styles.backdrop} onPress={closeAndReset} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <BlurView intensity={50} tint="dark" style={[styles.sheet, { maxHeight: sheetMaxHeight, overflow: 'hidden' }]}>
          <ScrollView contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>Elegir categoría</Text>
            {adding ? (
              <View style={styles.addForm}>
                <TextInput
                  style={styles.input}
                  placeholder="Nombre de la nueva categoría"
                  value={newLabel}
                  onChangeText={setNewLabel}
                />
                <Text style={styles.groupLabel}>Grupo</Text>
                <View style={styles.optionsRow}>
                  {GROUP_ORDER.map((groupSlug) => (
                    <Pressable
                      key={groupSlug}
                      onPress={() => setNewGroupSlug(groupSlug)}
                      style={[styles.chip, { borderColor: colors.border }, newGroupSlug === groupSlug && styles.chipSelected]}
                    >
                      <Text style={styles.chipText}>{GROUP_LABELS[groupSlug]}</Text>
                    </Pressable>
                  ))}
                </View>
                <PrimaryButton label="Agregar" onPress={submitNewCategory} />
                <SecondaryButton label="Cancelar" onPress={() => setAdding(false)} />
              </View>
            ) : (
              <>
                {groups.map((groupSlug) => {
                  const options = kindOptions.filter((c) => c.groupSlug === groupSlug);
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
                {isAdmin && (
                  <Pressable onPress={() => setAdding(true)} style={styles.addLink}>
                    <Text style={styles.addLinkText}>+ Agregar categoría</Text>
                  </Pressable>
                )}
              </>
            )}
          </ScrollView>
        </BlurView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(6,15,12,0.55)' },
  sheet: {
    backgroundColor: glass.bg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: glass.border,
    borderBottomWidth: 0,
    ...shadow.raised,
  },
  sheetContent: { padding: spacing.lg, gap: spacing.md },
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
  chipSelected: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  addForm: { gap: spacing.sm },
  input: {
    backgroundColor: colors.page,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    fontFamily: fonts.body,
    fontSize: 14,
    borderWidth: 1,
    borderColor: colors.border,
    outlineWidth: 0,
  },
  addLink: { alignItems: 'center', paddingTop: spacing.sm },
  addLinkText: { color: colors.primary, fontFamily: fonts.bodyMedium, fontSize: 13 },
});
