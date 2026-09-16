// Set de íconos propios de Kipo — mismo estilo de línea que los "-outline" de
// Ionicons que conviven con ellos (stroke fino, esquinas redondeadas, un solo
// color recibido por prop para que tabBarActiveTintColor/muted los tiña
// igual que a cualquier ícono de Ionicons). Cada uno lleva la misma firma
// {size, color} para poder pasarlos donde antes había un nombre de Ionicons.
import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

interface IconProps {
  size?: number;
  color: string;
}

// "Captura por lenguaje natural" — burbuja de chat con un micrófono adentro
// (registrar un gasto hablando o escribiendo, como ya hace /chat).
export function VoiceCaptureIcon({ size = 22, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 5.5A2 2 0 0 1 6 3.5h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-6.5L8 17.5v-3H6a2 2 0 0 1-2-2v-7Z"
        stroke={color}
        strokeWidth={1.7}
        strokeLinejoin="round"
      />
      <Rect x={10.7} y={6} width={2.6} height={4.6} rx={1.3} stroke={color} strokeWidth={1.5} />
      <Path d="M9.4 9.6a2.6 2.6 0 0 0 5.2 0" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      <Path d="M12 12.2v1.2" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

// "Lectura segura de SMS bancarios" — escudo con un brote (misma idea de
// "crecer con cuidado" que la planta de SeedGrowthIntro) adentro.
export function BankShieldIcon({ size = 22, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3.5 5 6v5.2c0 4.3 2.9 7.6 7 9.3 4.1-1.7 7-5 7-9.3V6l-7-2.5Z"
        stroke={color}
        strokeWidth={1.7}
        strokeLinejoin="round"
      />
      <Path d="M12 16v-5.4" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      <Path
        d="M12 10.6c-2-.3-3-1.6-3.1-3 1.5-.2 2.8.5 3.1 1.9.3-1.4 1.6-2.1 3.1-1.9-.1 1.4-1.1 2.7-3.1 3Z"
        stroke={color}
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// "Seguimiento familiar de gastos" — dos personas + una flecha ascendente.
export function FamilyTrackingIcon({ size = 22, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={8.2} cy={7.3} r={2.1} stroke={color} strokeWidth={1.6} />
      <Path d="M4 18v-1.4a3.7 3.7 0 0 1 3.7-3.7h1a3.7 3.7 0 0 1 3.4 2.2" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
      <Circle cx={15.4} cy={5.8} r={1.7} stroke={color} strokeWidth={1.6} />
      <Path d="M12.4 12.6a3 3 0 0 1 2.6-1.5h.6a3 3 0 0 1 3 3V16" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
      <Path d="M15.5 20.5 18 17.7l2.3 2.1" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M18 20.7v-6" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

// Marca de "árbol familiar" — mismo lenguaje visual de tallo + hojas de
// SeedGrowthIntro, pero como ícono de navegación de un solo color (el tab de
// Inicio) en vez de la animación a todo color del login.
export function FamilyTreeIcon({ size = 22, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 21v-8.5" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
      <Path d="M12 15c-2.6-.4-4-2.1-4.2-4.3 2-.3 3.7.7 4.2 2.5.5-1.8 2.2-2.8 4.2-2.5-.2 2.2-1.6 3.9-4.2 4.3Z" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
      <Path d="M12 11.2c-2.2-.4-3.4-1.9-3.6-3.8 1.7-.3 3.2.6 3.6 2.2.4-1.6 1.9-2.5 3.6-2.2-.2 1.9-1.4 3.4-3.6 3.8Z" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
      <Circle cx={12} cy={6.4} r={1.1} fill={color} />
    </Svg>
  );
}
