// Color de acento de la vista propia del usuario actual. Deliberadamente NO
// es un Context/Provider de tema completo — mobile/src/theme.ts es un
// objeto estático importado en ~22 archivos, y reescribirlo es un proyecto
// aparte de esta función. En vez de eso, este hook lee el valor directo del
// store (ya disponible en ambos modos, local y Supabase, sin depender de
// AuthProvider) y los 4 puntos de contacto elegidos lo aplican como override
// de estilo inline sobre el objeto `colors` estático.
import { colors } from '../theme';
import { useKipo } from './store';

export const ACCENT_SWATCHES = ['#1E6B5C', '#2a78d6', '#B4791E', '#B8452F', '#7a3aa8', '#0f766e'];

export function useAccentColor(): string {
  const { state, currentUserId } = useKipo();
  return state.members.find((m) => m.id === currentUserId)?.accentColor || colors.primary;
}
