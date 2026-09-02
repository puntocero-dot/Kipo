import { Tabs } from 'expo-router';
import React from 'react';
import { ColorValue, Text } from 'react-native';
import { useKipo } from '../../src/domain/store';
import { colors } from '../../src/theme';

function TabIcon({ emoji, color }: { emoji: string; color: ColorValue }) {
  return <Text style={{ fontSize: 18, color }}>{emoji}</Text>;
}

export default function TabsLayout() {
  const { state } = useKipo();
  const pendingSms = state.smsInbox.filter((s) => s.status === 'pendiente').length;

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.card },
        headerTitleStyle: { fontWeight: '700', color: colors.textPrimary },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Kipo', tabBarLabel: 'Inicio', tabBarIcon: ({ color }) => <TabIcon emoji="🏠" color={color} /> }}
      />
      <Tabs.Screen
        name="chat"
        options={{ title: 'Registrar gasto', tabBarLabel: 'Registrar', tabBarIcon: ({ color }) => <TabIcon emoji="💬" color={color} /> }}
      />
      <Tabs.Screen
        name="sms"
        options={{
          title: 'Bandeja de SMS',
          tabBarLabel: 'SMS',
          tabBarIcon: ({ color }) => <TabIcon emoji="🏦" color={color} />,
          tabBarBadge: pendingSms > 0 ? pendingSms : undefined,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{ title: 'Historial', tabBarLabel: 'Historial', tabBarIcon: ({ color }) => <TabIcon emoji="📜" color={color} /> }}
      />
      <Tabs.Screen
        name="more"
        options={{ title: 'Más', tabBarLabel: 'Más', tabBarIcon: ({ color }) => <TabIcon emoji="⚙️" color={color} /> }}
      />
    </Tabs>
  );
}
