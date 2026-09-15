import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Card, PrimaryButton, Screen, SectionTitle } from '../src/components/ui';
import { ACCENT_SWATCHES, useAccentColor } from '../src/domain/accentStore';
import { useAuth } from '../src/domain/authStore';
import { useKipo } from '../src/domain/store';
import { confirmAction, notify } from '../src/lib/confirm';
import { pickAndUploadImage } from '../src/lib/imageUpload';
import { isSupabaseConfigured } from '../src/lib/supabase';
import { colors, fonts, radius, spacing } from '../src/theme';

const ROLE_LABEL: Record<string, string> = { admin: 'Administrador', member: 'Miembro', child: 'Hijo/a' };

export default function FamilyScreen() {
  const { state, currentUserId, addMember, regenerateInviteCode, updateFamilyProfile, setAccentColor, setMemberStatus } = useKipo();
  const auth = isSupabaseConfigured ? useAuth() : null;
  const accent = useAccentColor();
  const [name, setName] = useState('');
  const isAdmin = state.members.find((m) => m.id === currentUserId)?.role === 'admin';

  const [editingName, setEditingName] = useState(false);
  const [familyNameDraft, setFamilyNameDraft] = useState(state.familyName);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const saveFamilyName = () => {
    const trimmed = familyNameDraft.trim();
    if (trimmed && trimmed !== state.familyName) {
      updateFamilyProfile({ name: trimmed });
      auth?.refreshMemberships();
    }
    setEditingName(false);
  };

  const changePhoto = async () => {
    setUploadingPhoto(true);
    const familyId = auth?.activeFamilyId ?? 'local';
    const url = await pickAndUploadImage('family-photos', `${familyId}/photo.jpg`);
    setUploadingPhoto(false);
    if (url) updateFamilyProfile({ photoUrl: url });
  };

  return (
    <Screen>
      <Card>
        <View style={styles.familyHeader}>
          <Pressable onPress={isAdmin ? changePhoto : undefined} disabled={!isAdmin || uploadingPhoto}>
            {state.familyPhotoUrl ? (
              <Image source={{ uri: state.familyPhotoUrl }} style={styles.familyPhoto} />
            ) : (
              <View style={styles.familyPhotoPlaceholder}>
                <Ionicons name="home" size={22} color={colors.primary} />
              </View>
            )}
            {isAdmin && (
              <View style={styles.photoEditBadge}>
                <Ionicons name="camera-outline" size={12} color="#fff" />
              </View>
            )}
          </Pressable>

          <View style={{ flex: 1 }}>
            {editingName ? (
              <View style={styles.nameEditRow}>
                <TextInput
                  style={styles.nameInput}
                  value={familyNameDraft}
                  onChangeText={setFamilyNameDraft}
                  autoFocus
                  onSubmitEditing={saveFamilyName}
                />
                <Pressable onPress={saveFamilyName} hitSlop={8}>
                  <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={isAdmin ? () => setEditingName(true) : undefined}>
                <SectionTitle
                  icon="home-outline"
                  right={isAdmin ? <Ionicons name="pencil-outline" size={14} color={colors.muted} /> : undefined}
                >
                  {state.familyName}
                </SectionTitle>
              </Pressable>
            )}
          </View>
        </View>

        <Text style={styles.meta} selectable>
          Código de invitación: {state.inviteCode}
        </Text>
        <Text style={styles.meta}>Moneda base: {state.baseCurrency}</Text>
        {isAdmin && (
          <Pressable
            style={styles.regenerateButton}
            onPress={() =>
              confirmAction(
                'Regenerar código',
                'El código actual dejará de funcionar de inmediato. Cualquiera que lo tenga guardado ya no podrá unirse con él.',
                'Regenerar',
                regenerateInviteCode,
              )
            }
          >
            <Text style={styles.regenerateButtonText}>Regenerar código</Text>
          </Pressable>
        )}
      </Card>

      <Card>
        <SectionTitle icon="people-outline">Miembros</SectionTitle>
        {state.members.map((m) => {
          const suspended = m.status === 'suspended';
          const canManage = isAdmin && m.id !== currentUserId;
          return (
            <View key={m.id} style={styles.memberRow}>
              <View style={[styles.avatar, m.id === currentUserId && { backgroundColor: accent }, suspended && styles.avatarSuspended]}>
                <Text style={styles.avatarText}>{m.name.charAt(0)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.memberName}>{m.name}</Text>
                <Text style={styles.memberRole}>
                  {ROLE_LABEL[m.role]}
                  {suspended ? ' · Suspendido' : ''}
                </Text>
              </View>
              {canManage && (
                <Pressable
                  style={[styles.statusButton, suspended && styles.statusButtonReactivate]}
                  onPress={() =>
                    confirmAction(
                      suspended ? 'Reactivar miembro' : 'Suspender miembro',
                      suspended
                        ? `${m.name} volverá a ver los datos de la familia.`
                        : `${m.name} perderá acceso a los datos de la familia de inmediato. No se borra nada — puedes reactivarlo cuando quieras.`,
                      suspended ? 'Reactivar' : 'Suspender',
                      () => setMemberStatus(m.id, suspended ? 'active' : 'suspended'),
                      !suspended,
                    )
                  }
                >
                  <Text style={[styles.statusButtonText, suspended && styles.statusButtonTextReactivate]}>
                    {suspended ? 'Reactivar' : 'Suspender'}
                  </Text>
                </Pressable>
              )}
            </View>
          );
        })}
      </Card>

      <Card>
        <SectionTitle icon="color-palette-outline">Mi color</SectionTitle>
        <Text style={styles.meta}>Un acento propio para tu vista — el tab activo y los botones principales lo usan.</Text>
        <View style={styles.swatchRow}>
          {ACCENT_SWATCHES.map((color) => (
            <Pressable
              key={color}
              onPress={() => setAccentColor(color)}
              style={[styles.swatch, { backgroundColor: color }, accent === color && styles.swatchSelected]}
            >
              {accent === color && <Ionicons name="checkmark" size={16} color="#fff" />}
            </Pressable>
          ))}
        </View>
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
  familyHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  familyPhoto: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.page },
  familyPhotoPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoEditBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.card,
  },
  nameEditRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  nameInput: {
    flex: 1,
    fontFamily: fonts.displaySemibold,
    fontSize: 16,
    color: colors.textPrimary,
    borderBottomWidth: 2,
    borderColor: colors.primarySoft,
    paddingVertical: 4,
    outlineWidth: 0,
  },
  regenerateButton: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
  },
  regenerateButtonText: { fontFamily: fonts.bodySemibold, fontSize: 12, color: colors.primary },
  swatchRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  swatch: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  swatchSelected: { borderWidth: 2, borderColor: colors.textPrimary },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarSuspended: { backgroundColor: colors.muted },
  avatarText: { color: '#fff', fontFamily: fonts.displaySemibold, fontSize: 15 },
  memberName: { fontFamily: fonts.bodySemibold, color: colors.textPrimary, fontSize: 14 },
  memberRole: { fontFamily: fonts.body, fontSize: 12, color: colors.muted },
  statusButton: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.critical,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
  },
  statusButtonText: { fontFamily: fonts.bodySemibold, fontSize: 12, color: colors.critical },
  statusButtonReactivate: { borderColor: colors.primary },
  statusButtonTextReactivate: { color: colors.primary },
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
