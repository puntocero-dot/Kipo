// Cliente de Supabase para el backend de staging/producción — ver
// docs/TESTING_ENVIRONMENT.md para crear el proyecto y aplicar
// database/schema.sql. Mientras EXPO_PUBLIC_SUPABASE_URL no esté definida,
// la app sigue funcionando 100% local (AsyncStorage) sin este cliente: nada
// en src/domain/store.tsx lo importa todavía — es el punto de partida para
// la sincronización familiar real, no está cableado al UI en este ambiente
// de pruebas.
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl as string, supabaseAnonKey as string)
  : null;
