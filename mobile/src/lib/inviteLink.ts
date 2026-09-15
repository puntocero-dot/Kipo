import { Platform, Share } from 'react-native';
import { notify } from './confirm';

// Solo tiene sentido en web (es donde vive el despliegue real, en Vercel) —
// en nativo no hay un dominio propio todavía, así que no se genera enlace.
export function buildInviteUrl(code: string): string | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  return `${window.location.origin}/join?code=${encodeURIComponent(code)}`;
}

// Comparte un enlace real (no solo el código pelado) para que quien lo
// reciba pueda entrar directo a "Unirme con código" con el código ya
// puesto — ver WorkspaceGateScreen.tsx, que lee ?code= de la URL. Si el
// navegador no soporta compartir (share sheet nativo), copia el enlace al
// portapapeles como respaldo.
export async function shareInvite(code: string, familyName: string) {
  const url = buildInviteUrl(code);
  const message = url
    ? `Únete a "${familyName}" en Kipo: ${url}`
    : `Únete a "${familyName}" en Kipo con el código: ${code}`;

  try {
    await Share.share(url ? { message, url } : { message });
    return;
  } catch {
    // Share.share rechaza en navegadores sin Web Share API (ej. la mayoría
    // de desktop) — no es un error real, solo falta esa capacidad.
  }

  if (url && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(url);
      notify('Enlace copiado', 'Pégalo donde quieras compartirlo — abre la app directo en "Unirme con código".');
      return;
    } catch {
      // sigue al aviso genérico de abajo
    }
  }

  notify('Código de invitación', `Comparte este código: ${code}`);
}
