import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { BudgetBarRow } from '../src/components/BudgetBarRow';
import { CategoryPickerModal } from '../src/components/CategoryPickerModal';
import { Card, EmptyState, PrimaryButton, Screen, SecondaryButton, SectionTitle } from '../src/components/ui';
import { GROUP_LABELS } from '../src/domain/categories';
import { computeBudgetUsage } from '../src/domain/selectors';
import { useKipo } from '../src/domain/store';
import { notify } from '../src/lib/confirm';
import { colors, fonts, radius, spacing } from '../src/theme';

export default function BudgetsScreen() {
  const { state, addBudget, updateBudget, removeBudget } = useKipo();
  const [name, setName] = useState('');
  const [limit, setLimit] = useState('');
  const [groupSlug, setGroupSlug] = useState<string | null | 'general'>('general');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const usage = computeBudgetUsage(state.budgets, state.transactions);

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setLimit('');
    setGroupSlug('general');
  };

  const startEdit = (budgetId: string) => {
    const budget = state.budgets.find((b) => b.id === budgetId);
    if (!budget) return;
    setEditingId(budget.id);
    setName(budget.name);
    setLimit(String(budget.amountLimit));
    setGroupSlug(budget.groupSlug ?? 'general');
  };

  const submit = () => {
    const amountLimit = parseFloat(limit.replace(',', '.'));
    if (!name.trim() || Number.isNaN(amountLimit) || amountLimit <= 0) {
      notify('Datos incompletos', 'Ingresa un nombre y un límite mensual válido.');
      return;
    }
    const isGeneral = groupSlug === 'general';
    if (isGeneral && state.budgets.some((b) => b.groupSlug === null && b.id !== editingId)) {
      notify(
        'Ya existe un presupuesto general',
        'Solo puede haber un presupuesto general del mes a la vez — elige una categoría específica para este nuevo presupuesto.',
      );
      return;
    }
    if (editingId) {
      updateBudget(editingId, { name: name.trim(), groupSlug: isGeneral ? null : groupSlug, amountLimit });
    } else {
      addBudget({ name: name.trim(), groupSlug: isGeneral ? null : groupSlug, amountLimit, alertThresholdPct: 80 });
    }
    resetForm();
  };

  return (
    <Screen>
      <Card>
        <SectionTitle icon="pie-chart-outline">Presupuestos activos</SectionTitle>
        {usage.length === 0 ? (
          <EmptyState icon="wallet-outline" message="Aún no has definido presupuestos." />
        ) : (
          usage.map((b) => (
            <View key={b.id} style={styles.budgetItem}>
              <BudgetBarRow budget={b} />
              <View style={styles.actionsRow}>
                <Pressable onPress={() => startEdit(b.id)}>
                  <Text style={styles.editLink}>Editar</Text>
                </Pressable>
                <Pressable onPress={() => removeBudget(b.id)}>
                  <Text style={styles.removeLink}>Eliminar</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </Card>

      <Card>
        <SectionTitle icon="add-circle-outline">{editingId ? 'Editar presupuesto' : 'Nuevo presupuesto'}</SectionTitle>
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
            {groupSlug === 'general' ? 'Presupuesto general del mes' : `Categoría: ${GROUP_LABELS[groupSlug ?? ''] ?? groupSlug}`}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.muted} />
        </Pressable>
        <SecondaryButton label="Usar presupuesto general (no por categoría)" onPress={() => setGroupSlug('general')} />
        <PrimaryButton label={editingId ? 'Guardar cambios' : 'Crear presupuesto'} onPress={submit} />
        {editingId && <SecondaryButton label="Cancelar" onPress={resetForm} />}
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
  actionsRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.md },
  editLink: { color: colors.primary, fontFamily: fonts.bodyMedium, fontSize: 12 },
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
  categoryPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.page,
    borderRadius: radius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryPickerText: { fontFamily: fonts.bodyMedium, color: colors.textSecondary, fontSize: 13 },
});
