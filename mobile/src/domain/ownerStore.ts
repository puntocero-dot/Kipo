// ¿Es este usuario el dueño de la app (puede cambiar la apariencia del
// login)? En modo local/demo siempre true — no hay tabla app_owners que
// consultar, y así la pantalla /branding (y su botón "Ver animación") son
// probables con Playwright en este ambiente sin credenciales reales de
// Supabase. En modo Supabase se consulta is_app_owner() una vez que hay
// sesión (ver migración 0014_login_branding.sql).
import { useEffect, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { useAuth } from './authStore';

export function useIsAppOwner(): boolean {
  if (!isSupabaseConfigured) return true;
  return useIsAppOwnerRemote();
}

function useIsAppOwnerRemote(): boolean {
  const { session } = useAuth();
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    if (!session) {
      setIsOwner(false);
      return;
    }
    let cancelled = false;
    supabase!.rpc('is_app_owner').then(({ data }) => {
      if (!cancelled) setIsOwner(Boolean(data));
    });
    return () => {
      cancelled = true;
    };
  }, [session]);

  return isOwner;
}
