// Autenticación real + selección de "espacio de trabajo" (familia). Solo
// tiene efecto cuando hay un proyecto de Supabase configurado — en modo
// local (Nivel 1 de docs/TESTING_ENVIRONMENT.md) `ready` es true de
// inmediato y no hay sesión que gestionar.
//
// Una misma persona (auth.users) puede pertenecer a varios espacios
// (`memberships`) — su familia, y aparte sus finanzas personales, o un
// segundo negocio — ver supabase/migrations/0003_multi_workspace_and_rls.sql.
// `activeFamilyId` es cuál de esos espacios se está viendo ahora mismo.
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

const ACTIVE_FAMILY_KEY = 'kipo:active-family-id';

export interface Membership {
  membershipId: string; // users.id — fila de membresía, no la identidad global
  familyId: string;
  familyName: string;
  role: 'admin' | 'member' | 'child';
}

interface AuthContextValue {
  ready: boolean;
  session: Session | null;
  memberships: Membership[];
  loadingMemberships: boolean;
  activeFamilyId: string | null;
  activeMembership: Membership | null;
  signUp: (email: string, password: string, termsAccepted: boolean) => Promise<string | null>;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  createFamily: (name: string) => Promise<string | null>;
  joinFamily: (code: string, memberName: string) => Promise<string | null>;
  selectFamily: (familyId: string) => void;
  clearActiveFamily: () => void;
  // Vuelve a leer memberships (nombre de familia, rol) — útil después de
  // renombrar la familia, para que el nombre cacheado aquí (usado en
  // more.tsx) no quede obsoleto.
  refreshMemberships: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(!isSupabaseConfigured);
  const [session, setSession] = useState<Session | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loadingMemberships, setLoadingMemberships] = useState(false);
  const [activeFamilyId, setActiveFamilyIdState] = useState<string | null>(null);

  const loadMemberships = useCallback(async (authUserId: string) => {
    setLoadingMemberships(true);
    const { data, error } = await supabase!
      .from('users')
      .select('id, family_id, role, families(name)')
      .eq('auth_user_id', authUserId);

    if (!error && data) {
      const list: Membership[] = data.map((row: any) => ({
        membershipId: row.id,
        familyId: row.family_id,
        role: row.role,
        familyName: row.families?.name ?? 'Espacio sin nombre',
      }));
      setMemberships(list);

      const stored = await AsyncStorage.getItem(ACTIVE_FAMILY_KEY);
      if (stored && list.some((m) => m.familyId === stored)) {
        setActiveFamilyIdState(stored);
      } else if (list.length === 1) {
        setActiveFamilyIdState(list[0].familyId);
        await AsyncStorage.setItem(ACTIVE_FAMILY_KEY, list[0].familyId);
      } else {
        setActiveFamilyIdState(null);
      }
    }
    setLoadingMemberships(false);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    supabase!.auth
      .getSession()
      .then(({ data }) => {
        setSession(data.session);
        if (data.session) loadMemberships(data.session.user.id);
      })
      .catch(() => {
        // Proyecto mal configurado, sin red, etc. — mostramos el login de
        // todos modos en vez de dejar el spinner girando para siempre; el
        // propio intento de sign-in mostrará el error real.
      })
      .finally(() => setReady(true));

    const { data: sub } = supabase!.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession) {
        loadMemberships(newSession.user.id);
      } else {
        setMemberships([]);
        setActiveFamilyIdState(null);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, [loadMemberships]);

  const signUp = useCallback(async (email: string, password: string, termsAccepted: boolean) => {
    // La aceptación queda en los metadatos del usuario de auth (sin migración
    // extra) — un registro real de cuándo aceptó, no solo un checkbox que se
    // olvida en cuanto se envía el formulario.
    const { error } = await supabase!.auth.signUp({
      email,
      password,
      options: {
        data: { terms_accepted_at: termsAccepted ? new Date().toISOString() : null },
        // Sin esto, el correo de confirmación redirige al "Site URL" fijo del
        // dashboard de Supabase (por defecto localhost:3000, que no existe
        // fuera de este entorno de desarrollo) — con esto, siempre vuelve a
        // donde sea que la app esté corriendo de verdad. Requiere que esa URL
        // esté en la lista blanca de Redirect URLs del dashboard.
        emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
      },
    });
    return error?.message ?? null;
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase!.auth.signInWithPassword({ email, password });
    return error?.message ?? null;
  }, []);

  const signOut = useCallback(async () => {
    await supabase!.auth.signOut();
    await AsyncStorage.removeItem(ACTIVE_FAMILY_KEY);
  }, []);

  const selectFamily = useCallback((familyId: string) => {
    setActiveFamilyIdState(familyId);
    AsyncStorage.setItem(ACTIVE_FAMILY_KEY, familyId).catch(() => {});
  }, []);

  const clearActiveFamily = useCallback(() => {
    setActiveFamilyIdState(null);
    AsyncStorage.removeItem(ACTIVE_FAMILY_KEY).catch(() => {});
  }, []);

  const createFamily = useCallback(
    async (name: string) => {
      const { data, error } = await supabase!.rpc('create_family_and_join', { family_name: name, currency: 'USD' });
      if (error) return error.message;
      if (session) await loadMemberships(session.user.id);
      if (data) selectFamily(data as string);
      return null;
    },
    [session, loadMemberships, selectFamily],
  );

  const joinFamily = useCallback(
    async (code: string, memberName: string) => {
      const { data, error } = await supabase!.rpc('join_family_by_invite', { code, member_name: memberName });
      if (error) return error.message;
      if (session) await loadMemberships(session.user.id);
      if (data) selectFamily(data as string);
      return null;
    },
    [session, loadMemberships, selectFamily],
  );

  const activeMembership = memberships.find((m) => m.familyId === activeFamilyId) ?? null;

  const refreshMemberships = useCallback(async () => {
    if (session) await loadMemberships(session.user.id);
  }, [session, loadMemberships]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ready,
      session,
      memberships,
      loadingMemberships,
      activeFamilyId,
      activeMembership,
      signUp,
      signIn,
      signOut,
      createFamily,
      joinFamily,
      selectFamily,
      clearActiveFamily,
      refreshMemberships,
    }),
    [
      ready,
      session,
      memberships,
      loadingMemberships,
      activeFamilyId,
      activeMembership,
      signUp,
      signIn,
      signOut,
      createFamily,
      joinFamily,
      selectFamily,
      clearActiveFamily,
      refreshMemberships,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
