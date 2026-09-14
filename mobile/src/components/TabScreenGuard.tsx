// Arregla un problema real de expo-router/React Navigation en web: al
// cambiar de pestaña, la pantalla anterior sigue montada debajo, ocupando
// toda la pantalla (position:absolute, inset:0) con pointer-events activo —
// así que a veces un toque en la pestaña "de encima" en realidad lo recibe
// la de abajo. Confirmado con Playwright contra el build de producción real
// (no es un artefacto del dev server): elementFromPoint mostraba el
// contenido del Dashboard capturando clics estando en Historial.
//
// useIsFocused() es la fuente de verdad real de navegación (no una
// comparación de ruta hecha a mano) — cuando esta pantalla no está enfocada,
// apagamos sus eventos de puntero para que nunca vuelva a interceptar un
// toque, sin tocar cómo se ve (sigue montada, solo deja de "escuchar").
import { useIsFocused } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

export function TabScreenGuard({ children }: { children: React.ReactNode }) {
  const isFocused = useIsFocused();
  return (
    <View style={{ flex: 1 }} pointerEvents={isFocused ? 'auto' : 'none'}>
      {children}
    </View>
  );
}
