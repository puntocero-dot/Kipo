import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { CategoryPickerModal } from '../../src/components/CategoryPickerModal';
import { TabScreenGuard } from '../../src/components/TabScreenGuard';
import { Card, EmptyState, PrimaryButton, Screen, SecondaryButton, SectionTitle } from '../../src/components/ui';
import { useKipo } from '../../src/domain/store';
import { colors, radius, spacing } from '../../src/theme';

const SAMPLE_SMS = [
  'Compra aprobada por $28.00 en FARMACIA SAN JOSE el ' + new Date().toLocaleDateString('es-GT'),
  'Su tarjeta terminada en 7788 fue debitada por $54.30 en RESTAURANTE LA TERRAZA',
  'Retiro de $100.00 en cajero ATM CENTRO',
];

export default function SmsInboxScreen() {
  const { state, simulateIncomingSms, confirmSms, discardSms } = useKipo();
  const [customSms, setCustomSms] = useState('');
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const pending = state.smsInbox.filter((s) => s.status === 'pendiente');
  const resolved = state.smsInbox.filter((s) => s.status !== 'pendiente').slice(0, 5);

  return (
    <TabScreenGuard>
    <Screen>
      <Card>
        <SectionTitle>🧪 Simular alerta bancaria</SectionTitle>
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
        <SectionTitle>Pendientes de confirmar ({pending.length})</SectionTitle>
        {pending.length === 0 ? (
          <EmptyState message="No hay sugerencias de SMS pendientes." />
        ) : (
          pending.map((sms) => (
            <View key={sms.id} style={styles.smsRow}>
              <Text style={styles.smsRaw}>"{sms.rawSms}"</Text>
              <View style={styles.smsMeta}>
                <Text style={styles.smsAmount}>${sms.parsedAmount?.toFixed(2) ?? '—'}</Text>
                <Text style={styles.smsMerchant}>{sms.parsedMerchant ?? 'Comercio no detectado'}</Text>
                <Text style={styles.smsConfidence}>confianza: {sms.confidence}</Text>
              </View>
              <View style={styles.smsActions}>
                <PrimaryButton label="Confirmar" onPress={() => setConfirmingId(sms.id)} />
                <SecondaryButton label="Descartar" tone="danger" onPress={() => discardSms(sms.id)} />
              </View>
            </View>
          ))
        )}
      </Card>

      {resolved.length > 0 && (
        <Card>
          <SectionTitle>Resueltos recientemente</SectionTitle>
          {resolved.map((sms) => (
            <Text key={sms.id} style={styles.resolvedRow}>
              {sms.status === 'confirmado' ? '✅' : '🗑️'} ${sms.parsedAmount?.toFixed(2) ?? '—'} · {sms.parsedMerchant ?? '—'}
            </Text>
          ))}
        </Card>
      )}

      <CategoryPickerModal
        visible={!!confirmingId}
        onClose={() => setConfirmingId(null)}
        onSelect={(option) => {
          if (confirmingId) {
            const sms = state.smsInbox.find((s) => s.id === confirmingId);
            confirmSms(confirmingId, {
              groupSlug: option.groupSlug,
              subSlug: option.subSlug,
              description: sms?.parsedMerchant ?? undefined,
            });
          }
          setConfirmingId(null);
        }}
      />
    </Screen>
    </TabScreenGuard>
  );
}

const styles = StyleSheet.create({
  note: { fontSize: 12, color: colors.muted },
  sampleRow: { gap: spacing.xs },
  sampleChip: { backgroundColor: colors.page, borderRadius: radius.md, padding: spacing.sm },
  sampleChipText: { fontSize: 12, color: colors.textSecondary },
  input: {
    backgroundColor: colors.page,
    borderRadius: radius.md,
    padding: spacing.sm,
    fontSize: 13,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  smsRow: { paddingVertical: spacing.sm, borderTopWidth: 1, borderColor: colors.gridline, gap: 6 },
  smsRaw: { fontSize: 12, color: colors.muted, fontStyle: 'italic' },
  smsMeta: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  smsAmount: { fontWeight: '800', color: colors.textPrimary },
  smsMerchant: { color: colors.textSecondary, fontSize: 13, flex: 1 },
  smsConfidence: { fontSize: 11, color: colors.muted },
  smsActions: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  resolvedRow: { fontSize: 13, color: colors.textSecondary, paddingVertical: 4 },
});
