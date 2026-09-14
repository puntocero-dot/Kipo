import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { Card, PrimaryButton, Screen, SectionTitle } from '../src/components/ui';
import { useKipo } from '../src/domain/store';
import { isSupabaseConfigured } from '../src/lib/supabase';
import { colors, radius, spacing } from '../src/theme';

const ROLE_LABEL: Record<string, string> = { admin: 'Administrador', member: 'Miembro', child: 'Hijo/a' };

export default function FamilyScreen() {
  const { state, addMember } = useKipo();
  const [name, setName] = useState('');

  return (
    <Screen>
      <Card>
        <SectionTitle>{state.familyName}</SectionTitle>
        <Text style={styles.meta} selectable>
          Código de invitación: {state.inviteCode}
        </Text>
        <Text style={styles.meta}>Moneda base: {state.baseCurrency}</Text>
      </Card>

      <Card>
        <SectionTitle>Miembros</SectionTitle>
        {state.members.map((m) => (
          <View key={m.id} style={styles.memberRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{m.name.charAt(0)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.memberName}>{m.name}</Text>
              <Text style={styles.memberRole}>{ROLE_LABEL[m.role]}</Text>
            </View>
          </View>
        ))}
      </Card>

      {isSupabaseConfigured ? (
        <Card>
          <SectionTitle>Invitar a alguien</SectionTitle>
          <Text style={styles.meta}>
            No hay formulario para "agregar" a alguien directo — cada persona necesita su propia cuenta. Comparte este
            código; en la pantalla de inicio eligen "Unirme con código" y quedan dentro al instante.
          </Text>
          <Text style={styles.inviteCode} selectable>
            {state.inviteCode}
          </Text>
        </Card>
      ) : (
        <Card>
          <SectionTitle>Invitar miembro</SectionTitle>
          <TextInput style={styles.input} placeholder="Nombre del nuevo miembro" value={name} onChangeText={setName} />
          <PrimaryButton
            label="Agregar a la familia"
            onPress={() => {
              if (!name.trim()) return;
              addMember({ name: name.trim(), role: 'member' });
              setName('');
              Alert.alert('Miembro agregado', `${name.trim()} ya puede registrar gastos en Kipo.`);
            }}
          />
        </Card>
      )}

      <Card>
        <SectionTitle>Lector de SMS (Android)</SectionTitle>
        <Text style={styles.meta}>
          En una build nativa de Android, cada dispositivo puede activar/desactivar el permiso de lectura de SMS desde
          aquí. En iOS, el equivalente es compartir manualmente la notificación bancaria — ver la pestaña "SMS" para
          simularlo en este ambiente de pruebas.
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  meta: { fontSize: 13, color: colors.textSecondary },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '700' },
  memberName: { fontWeight: '600', color: colors.textPrimary },
  memberRole: { fontSize: 12, color: colors.muted },
  input: { backgroundColor: colors.page, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 10, fontSize: 14 },
  inviteCode: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 2,
    color: colors.primary,
    textAlign: 'center',
    backgroundColor: colors.page,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
  },
});
