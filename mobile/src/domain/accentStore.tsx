// Color de acento de la vista propia del usuario actual. Deliberadamente NO
// es un Context/Provider de tema completo — mobile/src/theme.ts es un
// objeto estático importado en ~22 archivos, y reescribirlo es un proyecto
// aparte de esta función. En vez de eso, este hook lee el valor directo del
// store (ya disponible en ambos modos, local y Supabase, sin depender de
// AuthProvider) y los 4 puntos de contacto elegidos lo aplican como override
// de estilo inline sobre el objeto `colors` estático.
import { colors } from '../theme';
import { useKipo } from './store';

// Re-tonalizadas junto al resto de la paleta (theme.ts) para que sigan
// contrastando sobre el fondo oscuro nuevo, en vez de los tonos apagados que
// se usaban sobre papel crema.
export const ACCENT_SWATCHES = ['#3ECF8E', '#3987E5', '#E3AE55', '#E85D4A', '#9B7FE0', '#2DD4BF'];

export function useAccentColor(): string {
  const { state, currentUserId } = useKipo();
  return state.members.find((m) => m.id === currentUserId)?.accentColor || colors.primary;
}
