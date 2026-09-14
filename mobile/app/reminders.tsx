import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Card, EmptyState, PrimaryButton, Screen, SectionTitle } from '../src/components/ui';
import { daysUntil } from '../src/domain/selectors';
import { useKipo } from '../src/domain/store';
import { notify } from '../src/lib/confirm';
import { colors, fonts, radius, spacing } from '../src/theme';

export default function RemindersScreen() {
  const { state, addReminder, removeReminder } = useKipo();
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [dueInDays, setDueInDays] = useState('');

  const sorted = [...state.reminders].sort((a, b) => new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime());

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
      recurrence: 'mensual',
      nextDueDate: due.toISOString().slice(0, 10),
      notifyDaysBefore: 3,
      isActive: true,
    });
    setName('');
    setAmount('');
    setDueInDays('');
  };

  return (
    <Screen>
      <Card>
        <SectionTitle icon="alarm-outline">Pagos fijos recurrentes</SectionTitle>
        {sorted.length === 0 ? (
          <EmptyState icon="calendar-clear-outline" message="No tienes recordatorios configurados." />
        ) : (
          sorted.map((r) => {
            const d = daysUntil(r.nextDueDate);
            return (
              <View key={r.id} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{r.name}</Text>
                  <Text style={styles.due}>
                    {d < 0 ? 'Vencido' : d === 0 ? 'Vence hoy' : `Vence en ${d} días`}
                    {r.amount ? ` · $${r.amount}` : ''} · {r.recurrence}
                  </Text>
                </View>
                <Pressable onPress={() => removeReminder(r.id)}>
                  <Text style={styles.removeLink}>Eliminar</Text>
                </Pressable>
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
        <PrimaryButton label="Crear recordatorio" onPress={submit} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderColor: colors.gridline, paddingVertical: spacing.sm },
  name: { fontFamily: fonts.bodySemibold, color: colors.textPrimary, fontSize: 14 },
  due: { fontFamily: fonts.body, fontSize: 12, color: colors.muted, marginTop: 2 },
  removeLink: { color: colors.critical, fontFamily: fonts.bodyMedium, fontSize: 12 },
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
});
