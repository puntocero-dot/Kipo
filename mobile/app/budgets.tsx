import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { BudgetBarRow } from '../src/components/BudgetBarRow';
import { CategoryPickerModal } from '../src/components/CategoryPickerModal';
import { Card, EmptyState, PrimaryButton, Screen, SecondaryButton, SectionTitle } from '../src/components/ui';
import { computeBudgetUsage } from '../src/domain/selectors';
import { useKipo } from '../src/domain/store';
import { colors, radius, spacing } from '../src/theme';

export default function BudgetsScreen() {
  const { state, addBudget, removeBudget } = useKipo();
  const [name, setName] = useState('');
  const [limit, setLimit] = useState('');
  const [groupSlug, setGroupSlug] = useState<string | null | 'general'>('general');
  const [pickerOpen, setPickerOpen] = useState(false);

  const usage = computeBudgetUsage(state.budgets, state.transactions);

  const submit = () => {
    const amountLimit = parseFloat(limit.replace(',', '.'));
    if (!name.trim() || Number.isNaN(amountLimit) || amountLimit <= 0) {
      Alert.alert('Datos incompletos', 'Ingresa un nombre y un límite mensual válido.');
      return;
    }
    addBudget({ name: name.trim(), groupSlug: groupSlug === 'general' ? null : groupSlug, amountLimit, alertThresholdPct: 80 });
    setName('');
    setLimit('');
    setGroupSlug('general');
  };

  return (
    <Screen>
      <Card>
        <SectionTitle>Presupuestos activos</SectionTitle>
        {usage.length === 0 ? (
          <EmptyState message="Aún no has definido presupuestos." />
        ) : (
          usage.map((b) => (
            <View key={b.id} style={styles.budgetItem}>
              <BudgetBarRow budget={b} />
              <Pressable onPress={() => removeBudget(b.id)}>
                <Text style={styles.removeLink}>Eliminar</Text>
              </Pressable>
            </View>
          ))
        )}
      </Card>

      <Card>
        <SectionTitle>Nuevo presupuesto</SectionTitle>
        <TextInput style={styles.input} placeholder="Nombre (ej. Salidas y comida fuera)" value={name} onChangeText={setName} />
        <TextInput
          style={styles.input}
          placeholder="Límite mensual ($)"
          keyboardType="decimal-pad"
          value={limit}
          onChangeText={setLimit}
        />
        <Pressable onPress={() => setPickerOpen(true)} style={styles.categoryPicker}>
          <Text style={styles.categoryPickerText}>
            {groupSlug === 'general' ? 'Presupuesto general del mes' : `Categoría: ${groupSlug}`}
          </Text>
        </Pressable>
        <SecondaryButton label="Usar presupuesto general (no por categoría)" onPress={() => setGroupSlug('general')} />
        <PrimaryButton label="Crear presupuesto" onPress={submit} />
      </Card>

      <CategoryPickerModal
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(option) => {
          setGroupSlug(option.groupSlug);
          setPickerOpen(false);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  budgetItem: { borderTopWidth: 1, borderColor: colors.gridline, paddingVertical: spacing.sm, gap: 6 },
  removeLink: { color: colors.critical, fontSize: 12, alignSelf: 'flex-end' },
  input: {
    backgroundColor: colors.page,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 14,
  },
  categoryPicker: { backgroundColor: colors.page, borderRadius: radius.md, padding: spacing.sm },
  categoryPickerText: { color: colors.textSecondary, fontSize: 13 },
});
