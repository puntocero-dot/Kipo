import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { useKipo } from '../../src/domain/store';
import { colors, fonts } from '../../src/theme';

function TabIcon({ name, focused }: { name: keyof typeof Ionicons.glyphMap; focused: boolean }) {
  return <Ionicons name={name} size={22} color={focused ? colors.primary : colors.muted} />;
}

export default function TabsLayout() {
  const { state } = useKipo();
  const pendingSms = state.smsInbox.filter((s) => s.status === 'pendiente').length;

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.page },
        headerShadowVisible: false,
        headerTitleStyle: { fontFamily: fonts.displaySemibold, fontSize: 17, color: colors.textPrimary },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopWidth: 1,
          borderTopColor: colors.gridline,
          height: 64,
          paddingTop: 8,
          paddingBottom: 10,
        },
        tabBarLabelStyle: { fontFamily: fonts.bodySemibold, fontSize: 11 },
        tabBarBadgeStyle: { backgroundColor: colors.critical, fontFamily: fonts.bodyBold, fontSize: 10 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Kipo',
          tabBarLabel: 'Inicio',
          tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'home' : 'home-outline'} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Registrar gasto',
          tabBarLabel: 'Registrar',
          tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'create' : 'create-outline'} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="sms"
        options={{
          title: 'Bandeja de SMS',
          tabBarLabel: 'SMS',
          tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'card' : 'card-outline'} focused={focused} />,
          tabBarBadge: pendingSms > 0 ? pendingSms : undefined,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'Historial',
          tabBarLabel: 'Historial',
          tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'receipt' : 'receipt-outline'} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'Más',
          tabBarLabel: 'Más',
          tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'settings' : 'settings-outline'} focused={focused} />,
        }}
      />
    </Tabs>
  );
}
