import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { CategoryPickerModal } from '../src/components/CategoryPickerModal';
import { Card, EmptyState, PrimaryButton, Screen, SectionTitle } from '../src/components/ui';
import { findCategory } from '../src/domain/categories';
import { daysUntil, formatDayLabel } from '../src/domain/selectors';
import { useKipo } from '../src/domain/store';
import { confirmAction, notify } from '../src/lib/confirm';
import type { Reminder } from '../src/domain/types';
import { colors, fonts, radius, spacing } from '../src/theme';

const RECURRENCE_OPTIONS: { label: string; value: Reminder['recurrence'] }[] = [
  { label: 'Semanal', value: 'semanal' },
  { label: 'Quincenal', value: 'quincenal' },
  { label: 'Mensual', value: 'mensual' },
  { label: 'Anual', value: 'anual' },
  { label: 'Único', value: 'unico' },
];

export default function RemindersScreen() {
  const { state, addReminder, removeReminder, markReminderPaid, undoReminderPayment } = useKipo();
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [dueInDays, setDueInDays] = useState('');
  const [recurrence, setRecurrence] = useState<Reminder['recurrence']>('mensual');
  const [groupSlug, setGroupSlug] = useState<string | null>(null);
  const [subSlug, setSubSlug] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [payingId, setPayingId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payAccountId, setPayAccountId] = useState<string | null>(null);

  // Antes se reordenaba (con parseo de fecha por comparación) en cada
  // render, incluida cada tecla escrita en los formularios de esta pantalla.
  const sorted = useMemo(
    () => [...state.reminders].sort((a, b) => new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime()),
    [state.reminders],
  );
  const accountName = (id: string | null) => state.accounts.find((a) => a.id === id)?.name;

  const submit = () => {
    const days = parseInt(dueInDays, 10);
    if (!name.trim() || Number.isNaN(days) || days < 0) {
      notify('Datos incompletos', 'Ingresa un nombre y en cuántos días vence.');
      return;
    }
    const due = new Date();
    due.setDate(due.getDate() + days);
    addReminder({
      name: name.trim(),
      amount: amount ? parseFloat(amount.replace(',', '.')) : null,
      recurrence,
      nextDueDate: due.toISOString().slice(0, 10),
      notifyDaysBefore: 3,
      isActive: true,
      groupSlug,
      subSlug,
      accountId: null,
      lastPaidAmount: null,
      lastPaidAt: null,
      lastPaidTransactionId: null,
    });
    setName('');
    setAmount('');
    setDueInDays('');
    setRecurrence('mensual');
    setGroupSlug(null);
    setSubSlug(null);
  };

  const startPaying = (reminderId: string, prefillAmount: number | null, prefillAccountId: string | null) => {
    setPayingId(reminderId);
    setPayAmount(prefillAmount ? String(prefillAmount) : '');
    setPayAccountId(prefillAccountId);
  };

  const submitPayment = () => {
    if (!payingId) return;
    const value = parseFloat(payAmount.replace(',', '.'));
    if (Number.isNaN(value) || value <= 0) {
      notify('Monto inválido', 'Ingresa cuánto pagaste.');
      return;
    }
    markReminderPaid(payingId, value, payAccountId);
    setPayingId(null);
    setPayAmount('');
    setPayAccountId(null);
  };

  const category = (r: (typeof sorted)[number]) => findCategory(r.groupSlug, r.subSlug);

  return (
    <Screen>
      <Card>
        <SectionTitle icon="alarm-outline">Pagos fijos recurrentes</SectionTitle>
        {sorted.length === 0 ? (
          <EmptyState icon="calendar-clear-outline" message="No tienes recordatorios configurados." />
        ) : (
          sorted.map((r) => {
            const d = daysUntil(r.nextDueDate);
            const cat = category(r);
            return (
              <View key={r.id} style={styles.row}>
                <View style={styles.rowHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{r.name}</Text>
                    <Text style={styles.due}>
                      {d < 0 ? 'Vencido' : d === 0 ? 'Vence hoy' : `Vence en ${d} días`}
                      {r.amount ? ` · $${r.amount}` : ''} · {r.recurrence}
                      {cat ? ` · ${cat.label}` : ''}
                      {r.accountId ? ` · ${accountName(r.accountId)}` : ''}
                    </Text>
                  </View>
                  <Pressable onPress={() => removeReminder(r.id)}>
                    <Text style={styles.removeLink}>Eliminar</Text>
                  </Pressable>
                </View>

                {r.lastPaidAmount !== null && (
                  <View style={styles.lastPaidRow}>
                    <Ionicons name="checkmark-circle" size={14} color={colors.good} />
                    <Text style={styles.lastPaidText}>
                      Último pago: ${r.lastPaidAmount.toFixed(2)} · {r.lastPaidAt ? formatDayLabel(r.lastPaidAt) : ''}
                    </Text>
                    <Pressable
                      onPress={() =>
                        confirmAction('Deshacer pago', `¿Deshacer el último pago de "${r.name}"? Se borrará el gasto que creó.`, 'Deshacer', () =>
                          undoReminderPayment(r.id),
                        )
                      }
                    >
                      <Text style={styles.undoLink}>Deshacer</Text>
                    </Pressable>
                  </View>
                )}

                {payingId === r.id ? (
                  <View style={styles.payForm}>
                    <View style={styles.payAmountRow}>
                      <TextInput
                        style={[styles.input, { flex: 1, marginBottom: 0, minWidth: 0 }]}
                        placeholder="Monto pagado"
                        keyboardType="decimal-pad"
                        autoFocus
                        value={payAmount}
                        onChangeText={setPayAmount}
                      />
                      <Pressable style={styles.payConfirm} onPress={submitPayment}>
                        <Ionicons name="checkmark" size={18} color="#fff" />
                      </Pressable>
                      <Pressable style={styles.payCancel} onPress={() => setPayingId(null)}>
                        <Ionicons name="close" size={18} color={colors.muted} />
                      </Pressable>
                    </View>
                    {state.accounts.length > 0 && (
                      <View style={styles.chipsRow}>
                        <Pressable onPress={() => setPayAccountId(null)} style={[styles.chip, !payAccountId && styles.chipActive]}>
                          <Text style={[styles.chipText, !payAccountId && styles.chipTextActive]}>Sin especificar</Text>
                        </Pressable>
                        {state.accounts.map((a) => (
                          <Pressable
                            key={a.id}
                            onPress={() => setPayAccountId(a.id)}
                            style={[styles.chip, payAccountId === a.id && styles.chipActive]}
                          >
                            <Text style={[styles.chipText, payAccountId === a.id && styles.chipTextActive]}>{a.name}</Text>
                          </Pressable>
                        ))}
                      </View>
                    )}
                  </View>
                ) : (
                  <Pressable style={styles.payButton} onPress={() => startPaying(r.id, r.amount ?? r.lastPaidAmount, r.accountId)}>
                    <Ionicons name="checkmark-circle-outline" size={16} color={colors.primary} />
                    <Text style={styles.payButtonText}>Marcar como pagado</Text>
                  </Pressable>
                )}
              </View>
            );
          })
        )}
      </Card>

      <Card>
        <SectionTitle icon="add-circle-outline">Nuevo recordatorio</SectionTitle>
        <TextInput style={styles.input} placeholder="Nombre (ej. Internet)" value={name} onChangeText={setName} />
        <TextInput style={styles.input} placeholder="Monto ($, opcional)" keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />
        <TextInput style={styles.input} placeholder="Vence en cuántos días" keyboardType="number-pad" value={dueInDays} onChangeText={setDueInDays} />
        <Pressable onPress={() => setPickerOpen(true)} style={styles.categoryPicker}>
          <Text style={styles.categoryPickerText}>{findCategory(groupSlug, subSlug)?.label ?? 'Categoría (opcional)'}</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.muted} />
        </Pressable>
        <Text style={styles.recurrenceLabel}>¿Cada cuánto se repite?</Text>
        <View style={[styles.chipsRow, { marginBottom: spacing.xs }]}>
          {RECURRENCE_OPTIONS.map((opt) => (
            <Pressable
              key={opt.value}
              onPress={() => setRecurrence(opt.value)}
              style={[styles.chip, recurrence === opt.value && styles.chipActive]}
            >
              <Text style={[styles.chipText, recurrence === opt.value && styles.chipTextActive]}>{opt.label}</Text>
            </Pressable>
          ))}
        </View>
        <PrimaryButton label="Crear recordatorio" onPress={submit} />
      </Card>

      <CategoryPickerModal
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        kind="gasto"
        onSelect={(option) => {
          setGroupSlug(option.groupSlug);
          setSubSlug(option.subSlug);
          setPickerOpen(false);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { borderTopWidth: 1, borderColor: colors.gridline, paddingVertical: spacing.sm, gap: 6 },
  rowHeader: { flexDirection: 'row', alignItems: 'center' },
  name: { fontFamily: fonts.bodySemibold, color: colors.textPrimary, fontSize: 14 },
  due: { fontFamily: fonts.body, fontSize: 12, color: colors.muted, marginTop: 2 },
  removeLink: { color: colors.critical, fontFamily: fonts.bodyMedium, fontSize: 12 },
  lastPaidRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  lastPaidText: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary, flex: 1 },
  undoLink: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.muted },
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
  },
  payButtonText: { fontFamily: fonts.bodySemibold, fontSize: 12, color: colors.primary },
  payForm: { gap: spacing.xs },
  payAmountRow: { flexDirection: 'row', gap: spacing.xs, alignItems: 'center' },
  payConfirm: { width: 38, height: 38, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  payCancel: { width: 38, height: 38, borderRadius: radius.md, backgroundColor: colors.page, alignItems: 'center', justifyContent: 'center' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.page, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.textSecondary },
  chipTextActive: { color: '#fff', fontFamily: fonts.bodyBold },
  input: {
    backgroundColor: colors.page,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    fontFamily: fonts.body,
    fontSize: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xs,
    minWidth: 0,
    outlineWidth: 0,
  },
  categoryPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.page,
    borderRadius: radius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xs,
  },
  categoryPickerText: { fontFamily: fonts.bodyMedium, color: colors.textSecondary, fontSize: 13 },
  recurrenceLabel: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
});
