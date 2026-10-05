import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { blurActiveElement } from '../lib/confirm';
import { colors, fonts, radius, shadow, spacing } from '../theme';

export type SelectOption<T extends string | null> =
  | { header: string }
  | { value: T; label: string; hint?: string };

interface Props<T extends string | null> {
  label?: string; // etiqueta chica encima del campo
  title?: string; // título de la hoja (por defecto, la etiqueta)
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  // Texto del campo cuando `value` no coincide con ninguna opción.
  placeholder?: string;
  style?: object;
}

// Selector desplegable: un campo que muestra la opción elegida y, al tocarlo,
// abre una lista para elegir otra. Reemplaza las filas de "chips" cuando hay
// demasiadas opciones (12 meses, varios presupuestos, varias cuentas...) —
// con chips el contenido se desbordaba o ocupaba media pantalla.
export function SelectField<T extends string | null>({ label, title, value, options, onChange, placeholder = 'Elegir', style }: Props<T>) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) blurActiveElement();
  }, [open]);

  const selected = options.find((o): o is Extract<SelectOption<T>, { value: T }> => 'value' in o && o.value === value);

  return (
    <View style={style}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable style={styles.field} onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={label ?? title}>
        <Text style={styles.fieldText} numberOfLines={1}>
          {selected?.label ?? placeholder}
        </Text>
        <Ionicons name="chevron-down" size={16} color={colors.muted} />
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{title ?? label ?? 'Elegir'}</Text>
            <Pressable onPress={() => setOpen(false)} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.muted} />
            </Pressable>
          </View>
          <ScrollView>
            {options.map((o, i) => {
              if ('header' in o) {
                return (
                  <Text key={`h-${i}`} style={styles.header}>
                    {o.header}
                  </Text>
                );
              }
              const active = o.value === value;
              return (
                <Pressable
                  key={String(o.value)}
                  style={[styles.option, active && styles.optionActive]}
                  onPress={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.optionText, active && styles.optionTextActive]}>{o.label}</Text>
                    {o.hint ? <Text style={styles.hint}>{o.hint}</Text> : null}
                  </View>
                  {active && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.muted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  fieldText: { flex: 1, fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.textPrimary },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    maxHeight: '70%',
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingBottom: spacing.lg,
    ...shadow.floating,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, paddingBottom: spacing.sm },
  sheetTitle: { fontFamily: fonts.displaySemibold, fontSize: 17, color: colors.textPrimary },
  header: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: 4 },
  option: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: 13 },
  optionActive: { backgroundColor: colors.primarySoft },
  optionText: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.textPrimary },
  optionTextActive: { fontFamily: fonts.bodyBold },
  hint: { fontFamily: fonts.body, fontSize: 12, color: colors.muted, marginTop: 1 },
});
