import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '../domain/authStore';
import { colors, radius, spacing } from '../theme';

// Se muestra cuando ya hay sesión pero todavía no hay un espacio de trabajo
// activo: primera vez (sin membresías, hay que crear o unirse) o cuando el
// usuario pertenece a varios espacios y tiene que elegir cuál ver — ver
// docs/TESTING_ENVIRONMENT.md y supabase/migrations/0003_multi_workspace_and_rls.sql.
export function WorkspaceGateScreen() {
  const { memberships, loadingMemberships, selectFamily, createFamily, joinFamily, signOut } = useAuth();
  const [tab, setTab] = useState<'create' | 'join'>('create');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [memberName, setMemberName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submitCreate = async () => {
    if (!name.trim()) {
      setError('Ponle un nombre a tu espacio (ej. "Familia Pérez" o "Mis finanzas personales").');
      return;
    }
    setBusy(true);
    setError(null);
    const err = await createFamily(name.trim());
    setBusy(false);
    if (err) setError(err);
  };

  const submitJoin = async () => {
    if (!code.trim() || !memberName.trim()) {
      setError('Ingresa el código de invitación y tu nombre.');
      return;
    }
    setBusy(true);
    setError(null);
    const err = await joinFamily(code.trim(), memberName.trim());
    setBusy(false);
    if (err) setError(err);
  };

  if (loadingMemberships) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
      <Text style={styles.title}>Kipo</Text>

      {memberships.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Tus espacios</Text>
          <Text style={styles.muted}>Elige cuál quieres ver — puedes cambiar después desde "Más".</Text>
          {memberships.map((m) => (
            <Pressable key={m.familyId} style={styles.workspaceRow} onPress={() => selectFamily(m.familyId)}>
              <Text style={styles.workspaceName}>{m.familyName}</Text>
              <Text style={styles.workspaceRole}>{m.role === 'admin' ? 'Administrador' : 'Miembro'}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{memberships.length > 0 ? 'Agregar otro espacio' : 'Empecemos'}</Text>
        <View style={styles.tabRow}>
          <Pressable style={[styles.tabBtn, tab === 'create' && styles.tabBtnActive]} onPress={() => setTab('create')}>
            <Text style={[styles.tabText, tab === 'create' && styles.tabTextActive]}>Crear nuevo</Text>
          </Pressable>
          <Pressable style={[styles.tabBtn, tab === 'join' && styles.tabBtnActive]} onPress={() => setTab('join')}>
            <Text style={[styles.tabText, tab === 'join' && styles.tabTextActive]}>Unirme con código</Text>
          </Pressable>
        </View>

        {tab === 'create' ? (
          <>
            <Text style={styles.muted}>
              Puede ser tu familia, o un espacio separado solo para ti (ej. tus finanzas personales o un negocio).
            </Text>
            <TextInput style={styles.input} placeholder='Nombre (ej. "Familia Pérez")' value={name} onChangeText={setName} />
            <Pressable style={styles.primaryButton} onPress={submitCreate} disabled={busy}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Crear espacio</Text>}
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.muted}>Pide el código de invitación a quien ya tiene el espacio creado.</Text>
            <TextInput style={styles.input} placeholder="Código de invitación" autoCapitalize="characters" value={code} onChangeText={setCode} />
            <TextInput style={styles.input} placeholder="Tu nombre" value={memberName} onChangeText={setMemberName} />
            <Pressable style={styles.primaryButton} onPress={submitJoin} disabled={busy}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Unirme</Text>}
            </Pressable>
          </>
        )}

        {error && <Text style={styles.error}>{error}</Text>}
      </View>

      <Pressable onPress={() => signOut()}>
        <Text style={styles.signOut}>Cerrar sesión</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.page },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.page },
  title: { fontSize: 26, fontWeight: '800', color: colors.textPrimary, textAlign: 'center' },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm, borderWidth: 1, borderColor: colors.border },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  muted: { fontSize: 12.5, color: colors.muted },
  workspaceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderColor: colors.gridline,
  },
  workspaceName: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  workspaceRole: { fontSize: 12, color: colors.muted },
  tabRow: { flexDirection: 'row', gap: spacing.xs },
  tabBtn: { flex: 1, paddingVertical: 8, borderRadius: radius.pill, alignItems: 'center', backgroundColor: colors.page },
  tabBtnActive: { backgroundColor: colors.textPrimary },
  tabText: { fontSize: 12.5, color: colors.textSecondary, fontWeight: '600' },
  tabTextActive: { color: colors.card },
  input: { backgroundColor: colors.page, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 11, fontSize: 14 },
  primaryButton: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 11, alignItems: 'center' },
  primaryButtonText: { color: '#fff', fontWeight: '700' },
  error: { color: colors.critical, fontSize: 12 },
  signOut: { textAlign: 'center', color: colors.critical, fontSize: 13, fontWeight: '600', marginBottom: spacing.lg },
});
