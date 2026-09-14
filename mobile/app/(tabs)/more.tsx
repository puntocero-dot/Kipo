import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { TabScreenGuard } from '../../src/components/TabScreenGuard';
import { Card, Screen, SectionTitle } from '../../src/components/ui';
import { useAuth } from '../../src/domain/authStore';
import { useKipo } from '../../src/domain/store';
import { confirmAction } from '../../src/lib/confirm';
import { isSupabaseConfigured } from '../../src/lib/supabase';
import { colors, fonts, radius, spacing } from '../../src/theme';

function MenuRow({
  icon,
  label,
  description,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  description: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={({ pressed }) => [styles.menuRow, pressed && { opacity: 0.6 }]} onPress={onPress}>
      <View style={styles.menuIconWrap}>
        <Ionicons name={icon} size={19} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.menuLabel}>{label}</Text>
        <Text style={styles.menuDescription}>{description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
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
          icon="pricetag-outline"
          label="Categorías y presupuestos"
          description="Límites mensuales y alertas por categoría"
          onPress={() => router.push('/budgets')}
        />
        <MenuRow
          icon="alarm-outline"
          label="Recordatorios"
          description="Pagos fijos recurrentes"
          onPress={() => router.push('/reminders')}
        />
        <MenuRow
          icon="wallet-outline"
          label="Cuentas y ahorros"
          description="Medios de pago, saldos y metas de ahorro"
          onPress={() => router.push('/accounts')}
        />
        <MenuRow
          icon="people-outline"
          label="Familia y perfil"
          description="Miembros, moneda, código de invitación"
          onPress={() => router.push('/family')}
        />
      </Card>

      {auth ? (
        <Card>
          <SectionTitle icon="home-outline">Espacio de trabajo</SectionTitle>
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
          <SectionTitle icon="flask-outline">Ambiente de pruebas</SectionTitle>
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
  menuIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: { fontFamily: fonts.bodySemibold, fontSize: 15, color: colors.textPrimary },
  menuDescription: { fontFamily: fonts.body, fontSize: 12, color: colors.muted, marginTop: 2 },
  note: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  secondaryButton: { borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingVertical: spacing.sm, alignItems: 'center' },
  secondaryButtonText: { color: colors.textSecondary, fontFamily: fonts.bodySemibold, fontSize: 14 },
  resetButton: { borderRadius: radius.md, borderWidth: 1, borderColor: colors.critical, paddingVertical: spacing.sm, alignItems: 'center' },
  resetText: { color: colors.critical, fontFamily: fonts.bodyBold, fontSize: 14 },
});
