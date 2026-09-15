import { useEffect } from 'react';
import { useAuth } from '../src/domain/authStore';
import { isSupabaseConfigured } from '../src/lib/supabase';

// Alguien que ya tiene un espacio de trabajo activo y toca un enlace de
// invitación (para sumarse a OTRA familia) cae aquí en vez de en
// WorkspaceGateScreen directo, porque RemoteGate solo la muestra cuando no
// hay espacio activo — así que primero se limpia el activo, lo que hace que
// RemoteGate vuelva a WorkspaceGateScreen, que ya sabe leer ?code= de la URL
// (ver el useEffect en WorkspaceGateScreen.tsx) y precargar el código ahí.
export default function JoinRedirect() {
  const auth = isSupabaseConfigured ? useAuth() : null;

  useEffect(() => {
    auth?.clearActiveFamily();
  }, [auth]);

  return null;
}
