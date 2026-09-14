import { Outfit_600SemiBold, Outfit_700Bold, Outfit_800ExtraBold } from '@expo-google-fonts/outfit';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../src/domain/authStore';
import { KipoProvider } from '../src/domain/store';
import { SupabaseKipoProvider } from '../src/domain/supabaseStore';
import { isSupabaseConfigured } from '../src/lib/supabase';
import { AuthScreen } from '../src/screens/AuthScreen';
import { WorkspaceGateScreen } from '../src/screens/WorkspaceGateScreen';
import { colors, fonts } from '../src/theme';

function AppStack() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.page },
        headerShadowVisible: false,
        headerTintColor: colors.textPrimary,
        headerTitleStyle: { fontFamily: fonts.displaySemibold, fontSize: 17 },
        contentStyle: { backgroundColor: colors.page },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="budgets" options={{ title: 'Categorías y presupuestos' }} />
      <Stack.Screen name="reminders" options={{ title: 'Recordatorios' }} />
      <Stack.Screen name="family" options={{ title: 'Familia y perfil' }} />
    </Stack>
  );
}

function LoadingScreen() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.page }}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

// Solo entra en juego cuando hay un proyecto de Supabase configurado (.env
// con EXPO_PUBLIC_SUPABASE_URL/ANON_KEY) — sin sesión, muestra el login; con
// sesión pero sin espacio de trabajo elegido, el selector/onboarding; recién
// con ambos, monta el store real y las pantallas de siempre.
function RemoteGate() {
  const { ready, session, activeFamilyId, activeMembership } = useAuth();

  if (!ready) return <LoadingScreen />;
  if (!session) return <AuthScreen />;
  if (!activeFamilyId || !activeMembership) return <WorkspaceGateScreen />;

  return (
    <SupabaseKipoProvider familyId={activeFamilyId} membershipId={activeMembership.membershipId}>
      <AppStack />
    </SupabaseKipoProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Outfit_600SemiBold,
    Outfit_700Bold,
    Outfit_800ExtraBold,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  if (!fontsLoaded) return <LoadingScreen />;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {isSupabaseConfigured ? (
        <AuthProvider>
          <RemoteGate />
        </AuthProvider>
      ) : (
        <KipoProvider>
          <AppStack />
        </KipoProvider>
      )}
    </SafeAreaProvider>
  );
}
