import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { KipoProvider } from '../src/domain/store';
import { colors } from '../src/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <KipoProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.card },
            headerTintColor: colors.textPrimary,
            headerTitleStyle: { fontWeight: '700' },
            contentStyle: { backgroundColor: colors.page },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="budgets" options={{ title: 'Categorías y presupuestos' }} />
          <Stack.Screen name="reminders" options={{ title: 'Recordatorios' }} />
          <Stack.Screen name="family" options={{ title: 'Familia y perfil' }} />
        </Stack>
      </KipoProvider>
    </SafeAreaProvider>
  );
}
