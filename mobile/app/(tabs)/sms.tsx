import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { BudgetOverridePicker } from '../../src/components/BudgetOverridePicker';
import { CategoryPickerModal } from '../../src/components/CategoryPickerModal';
import { TabScreenGuard } from '../../src/components/TabScreenGuard';
import { Card, EmptyState, PrimaryButton, Screen, SecondaryButton, SectionTitle } from '../../src/components/ui';
import { useKipo } from '../../src/domain/store';
import { colors, fonts, radius, spacing } from '../../src/theme';

interface SmsDraft {
  smsId: string;
  groupSlug: string;
  subSlug: string;
  budgetId: string | null;
}

const SAMPLE_SMS = [
  'Compra aprobada por $28.00 en FARMACIA SAN JOSE el ' + new Date().toLocaleDateString('es-GT'),
  'Su tarjeta terminada en 7788 fue debitada por $54.30 en RESTAURANTE LA TERRAZA',
  'Retiro de $100.00 en cajero ATM CENTRO',
  '*Davivienda Abono*\nCta:814\nConcep:PAGO DE PLANILLA\nFec:' + new Date().toLocaleDateString('es-GT') + '\nMonto:$450.00',
];

export default function SmsInboxScreen() {
  const { state, simulateIncomingSms, confirmSms, discardSms } = useKipo();
  const [customSms, setCustomSms] = useState('');
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<SmsDraft | null>(null);
  const draftSms = draft ? state.smsInbox.find((s) => s.id === draft.smsId) : undefined;

  const pending = state.smsInbox.filter((s) => s.status === 'pendiente');
  const resolved = state.smsInbox.filter((s) => s.status !== 'pendiente').slice(0, 5);

  return (
    <TabScreenGuard>
    <Screen>
      <Card>
        <SectionTitle icon="flask-outline">Simular alerta bancaria</SectionTitle>
        <Text style={styles.note}>
          El lector automático de SMS solo funciona en Android (ver docs/NLP_PARSING.md). Aquí puedes simular una alerta
          para probar el parser en este ambiente de pruebas.
        </Text>
        <View style={styles.sampleRow}>
          {SAMPLE_SMS.map((sms) => (
            <Pressable key={sms} style={styles.sampleChip} onPress={() => simulateIncomingSms(sms)}>
              <Text style={styles.sampleChipText} numberOfLines={2}>
                {sms}
              </Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          style={styles.input}
          placeholder="Pega o escribe el texto de un SMS bancario"
          value={customSms}
          onChangeText={setCustomSms}
          multiline
          maxLength={4000}
        />
        <PrimaryButton
          label="Procesar SMS"
          onPress={() => {
            if (!customSms.trim()) return;
            simulateIncomingSms(customSms.trim());
            setCustomSms('');
          }}
        />
      </Card>

      <Card>
        <SectionTitle icon="time-outline">Pendientes de confirmar ({pending.length})</SectionTitle>
        {pending.length === 0 ? (
          <EmptyState message="No hay sugerencias de SMS pendientes." />
        ) : (
          pending.map((sms) => {
            const isIncome = sms.transactionType === 'deposito';
            return (
              <View key={sms.id} style={styles.smsRow}>
                <Text style={styles.smsRaw}>"{sms.rawSms}"</Text>
                <View style={styles.smsMeta}>
                  <Text style={[styles.smsAmount, isIncome && { color: colors.good }]}>
                    {isIncome ? '+' : ''}${sms.parsedAmount?.toFixed(2) ?? '—'}
                  </Text>
                  <Text style={styles.smsMerchant}>{sms.parsedMerchant ?? 'Comercio no detectado'}</Text>
                  {isIncome && (
                    <View style={styles.depositBadge}>
                      <Ionicons name="arrow-down-circle" size={12} color={colors.good} />
                      <Text style={styles.depositBadgeText}>Depósito</Text>
                    </View>
                  )}
                  <Text style={styles.smsConfidence}>confianza: {sms.confidence}</Text>
                </View>
                <View style={styles.smsActions}>
                  <PrimaryButton label="Confirmar" onPress={() => setConfirmingId(sms.id)} />
                  <SecondaryButton label="Descartar" tone="danger" onPress={() => discardSms(sms.id)} />
                </View>
              </View>
            );
          })
        )}
      </Card>

      {resolved.length > 0 && (
        <Card>
          <SectionTitle icon="checkmark-done-outline">Resueltos recientemente</SectionTitle>
          {resolved.map((sms) => (
            <View key={sms.id} style={styles.resolvedRow}>
              <Ionicons
                name={sms.status === 'confirmado' ? 'checkmark-circle' : 'trash-outline'}
                size={14}
                color={sms.status === 'confirmado' ? colors.good : colors.muted}
              />
              <Text style={styles.resolvedText}>
                {sms.transactionType === 'deposito' ? '+' : ''}${sms.parsedAmount?.toFixed(2) ?? '—'} · {sms.parsedMerchant ?? '—'}
              </Text>
            </View>
          ))}
        </Card>
      )}

      {draft && draftSms && (
        <Card>
          <SectionTitle icon="wallet-outline">¿Dónde se registra este gasto?</SectionTitle>
          <BudgetOverridePicker
            groupSlug={draft.groupSlug}
            amount={draftSms.parsedAmount ?? 0}
            value={draft.budgetId}
            onChange={(budgetId) => setDraft((d) => (d ? { ...d, budgetId } : d))}
          />
          <View style={styles.smsActions}>
            <PrimaryButton
              label="Guardar"
              onPress={() => {
                confirmSms(draft.smsId, {
                  groupSlug: draft.groupSlug,
                  subSlug: draft.subSlug,
                  budgetId: draft.budgetId,
                  description: draftSms.parsedMerchant ?? undefined,
                });
                setDraft(null);
              }}
            />
            <SecondaryButton label="Cancelar" onPress={() => setDraft(null)} />
          </View>
        </Card>
      )}

      <CategoryPickerModal
        visible={!!confirmingId}
        onClose={() => setConfirmingId(null)}
        kind={state.smsInbox.find((s) => s.id === confirmingId)?.transactionType === 'deposito' ? 'ingreso' : 'gasto'}
        onSelect={(option) => {
          if (confirmingId) {
            const sms = state.smsInbox.find((s) => s.id === confirmingId);
            if (sms?.transactionType === 'deposito') {
              // Un ingreso no tiene presupuesto que afectar — se confirma directo,
              // igual que antes.
              confirmSms(confirmingId, {
                groupSlug: option.groupSlug,
                subSlug: option.subSlug,
                description: sms?.parsedMerchant ?? undefined,
              });
            } else {
              setDraft({ smsId: confirmingId, groupSlug: option.groupSlug, subSlug: option.subSlug, budgetId: null });
            }
          }
          setConfirmingId(null);
        }}
      />
    </Screen>
    </TabScreenGuard>
  );
}

const styles = StyleSheet.create({
  note: { fontFamily: fonts.body, fontSize: 12, color: colors.muted, lineHeight: 18 },
  sampleRow: { gap: spacing.xs },
  sampleChip: { backgroundColor: colors.page, borderRadius: radius.md, padding: spacing.sm },
  sampleChipText: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
  input: {
    backgroundColor: colors.page,
    borderRadius: radius.md,
    padding: spacing.sm,
    fontFamily: fonts.body,
    fontSize: 13,
    minHeight: 60,
    textAlignVertical: 'top',
    outlineWidth: 0,
  },
  smsRow: { paddingVertical: spacing.sm, borderTopWidth: 1, borderColor: colors.gridline, gap: 6 },
  smsRaw: { fontFamily: fonts.body, fontSize: 12, color: colors.muted, fontStyle: 'italic' },
  smsMeta: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  smsAmount: { fontFamily: fonts.displaySemibold, fontSize: 15, color: colors.textPrimary },
  depositBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.goodSoft, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  depositBadgeText: { fontFamily: fonts.bodyBold, fontSize: 10, color: colors.good },
  smsMerchant: { fontFamily: fonts.bodyMedium, color: colors.textSecondary, fontSize: 13, flex: 1 },
  smsConfidence: { fontFamily: fonts.body, fontSize: 11, color: colors.muted },
  smsActions: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  resolvedRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  resolvedText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.textSecondary },
});
