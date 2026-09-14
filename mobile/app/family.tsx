import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Card, PrimaryButton, Screen, SectionTitle } from '../src/components/ui';
import { useKipo } from '../src/domain/store';
import { notify } from '../src/lib/confirm';
import { isSupabaseConfigured } from '../src/lib/supabase';
import { colors, fonts, radius, spacing } from '../src/theme';

const ROLE_LABEL: Record<string, string> = { admin: 'Administrador', member: 'Miembro', child: 'Hijo/a' };

export default function FamilyScreen() {
  const { state, addMember } = useKipo();
  const [name, setName] = useState('');

  return (
    <Screen>
      <Card>
        <SectionTitle icon="home-outline">{state.familyName}</SectionTitle>
        <Text style={styles.meta} selectable>
          Código de invitación: {state.inviteCode}
        </Text>
        <Text style={styles.meta}>Moneda base: {state.baseCurrency}</Text>
      </Card>

      <Card>
        <SectionTitle icon="people-outline">Miembros</SectionTitle>
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
          <SectionTitle icon="share-social-outline">Invitar a alguien</SectionTitle>
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
          <SectionTitle icon="person-add-outline">Invitar miembro</SectionTitle>
          <TextInput style={styles.input} placeholder="Nombre del nuevo miembro" value={name} onChangeText={setName} />
          <PrimaryButton
            label="Agregar a la familia"
            onPress={() => {
              if (!name.trim()) return;
              addMember({ name: name.trim(), role: 'member' });
              setName('');
              notify('Miembro agregado', `${name.trim()} ya puede registrar gastos en Kipo.`);
            }}
          />
        </Card>
      )}

      <Card>
        <SectionTitle icon="phone-portrait-outline">Lector de SMS (Android)</SectionTitle>
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
  meta: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontFamily: fonts.displaySemibold, fontSize: 15 },
  memberName: { fontFamily: fonts.bodySemibold, color: colors.textPrimary, fontSize: 14 },
  memberRole: { fontFamily: fonts.body, fontSize: 12, color: colors.muted },
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
  inviteCode: {
    fontFamily: fonts.displayBlack,
    fontSize: 22,
    letterSpacing: 2,
    color: colors.primary,
    textAlign: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
  },
});
