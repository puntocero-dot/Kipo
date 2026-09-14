import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { TabScreenGuard } from '../../src/components/TabScreenGuard';
import { Card, Screen, SectionTitle } from '../../src/components/ui';
import { useAuth } from '../../src/domain/authStore';
import { useKipo } from '../../src/domain/store';
import { confirmAction } from '../../src/lib/confirm';
import { isSupabaseConfigured } from '../../src/lib/supabase';
import { colors, radius, spacing } from '../../src/theme';

function MenuRow({ icon, label, description, onPress }: { icon: string; label: string; description: string; onPress: () => void }) {
  return (
    <Pressable style={styles.menuRow} onPress={onPress}>
      <Text style={styles.menuIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.menuLabel}>{label}</Text>
        <Text style={styles.menuDescription}>{description}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

export default function MoreScreen() {
  const router = useRouter();
  const { resetSeedData } = useKipo();
  // useAuth() solo existe dentro de <AuthProvider>, que _layout.tsx monta
  // únicamente cuando isSupabaseConfigured es true — por eso el hook se
  // llama condicionado a esa misma constante, nunca al revés.
  const auth = isSupabaseConfigured ? useAuth() : null;

  return (
    <TabScreenGuard>
    <Screen>
      <Card>
        <MenuRow
          icon="🏷️"
          label="Categorías y presupuestos"
          description="Límites mensuales y alertas por categoría"
          onPress={() => router.push('/budgets')}
        />
        <MenuRow
          icon="⏰"
          label="Recordatorios"
          description="Pagos fijos recurrentes"
          onPress={() => router.push('/reminders')}
        />
        <MenuRow
          icon="👨‍👩‍👧"
          label="Familia y perfil"
          description="Miembros, moneda, código de invitación"
          onPress={() => router.push('/family')}
        />
      </Card>

      {auth ? (
        <Card>
          <SectionTitle>Espacio de trabajo</SectionTitle>
          <Text style={styles.note}>
            {auth.activeMembership?.familyName} · {auth.memberships.length > 1 ? `1 de ${auth.memberships.length} espacios` : 'tu espacio'}
          </Text>
          {auth.memberships.length > 1 && (
            <Pressable style={styles.secondaryButton} onPress={auth.clearActiveFamily}>
              <Text style={styles.secondaryButtonText}>Cambiar de espacio</Text>
            </Pressable>
          )}
          <Pressable style={styles.secondaryButton} onPress={auth.clearActiveFamily}>
            <Text style={styles.secondaryButtonText}>Crear o unirme a otro espacio</Text>
          </Pressable>
          <Pressable
            style={styles.resetButton}
            onPress={() => confirmAction('Cerrar sesión', '¿Seguro que quieres cerrar sesión?', 'Cerrar sesión', () => auth.signOut())}
          >
            <Text style={styles.resetText}>Cerrar sesión</Text>
          </Pressable>
        </Card>
      ) : (
        <Card>
          <SectionTitle>Ambiente de pruebas</SectionTitle>
          <Text style={styles.note}>
            Esta app corre 100% local (AsyncStorage) con datos de ejemplo — pensada para validar el flujo de captura y el
            dashboard antes de conectar el backend de staging en Supabase. Ver docs/TESTING_ENVIRONMENT.md.
          </Text>
          <Pressable
            style={styles.resetButton}
            onPress={() =>
              confirmAction(
                'Reiniciar datos de prueba',
                '¿Restaurar la data semilla y descartar los cambios hechos en esta sesión?',
                'Reiniciar',
                resetSeedData,
              )
            }
          >
            <Text style={styles.resetText}>Reiniciar datos de prueba</Text>
          </Pressable>
        </Card>
      )}
    </Screen>
    </TabScreenGuard>
  );
}

const styles = StyleSheet.create({
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  menuIcon: { fontSize: 22 },
  menuLabel: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  menuDescription: { fontSize: 12, color: colors.muted, marginTop: 2 },
  chevron: { fontSize: 20, color: colors.muted },
  note: { fontSize: 13, color: colors.textSecondary },
  secondaryButton: { borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingVertical: spacing.sm, alignItems: 'center' },
  secondaryButtonText: { color: colors.textSecondary, fontWeight: '600' },
  resetButton: { borderRadius: radius.md, borderWidth: 1, borderColor: colors.critical, paddingVertical: spacing.sm, alignItems: 'center' },
  resetText: { color: colors.critical, fontWeight: '700' },
});
