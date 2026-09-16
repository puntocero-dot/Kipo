import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import { Image, StyleSheet } from 'react-native';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

// Gradiente por defecto de la pantalla de login — usado mientras carga
// login_branding, si la fila no tiene datos aún, o en modo local/demo (sin
// tabla que consultar). Verde bosque oscuro con un toque cálido arriba
// (identidad fintech profesional, no el atardecer cálido de antes). Termina
// en colors.primaryDeep — el mismo tono en el que se asienta el "flood" de
// SeedGrowthIntro al terminar su animación — para que la transición sea
// continua en vez de dar un salto de color.
const DEFAULT_GRADIENT = {
  colors: ['#3D4A34', '#1A3D33', '#123F37'],
  locations: [0, 0.55, 1],
};

interface LoginBranding {
  backgroundImageUrl: string | null;
  gradientColors: string[];
  gradientLocations: number[];
}

// Se ve SIN sesión (pantalla de login, antes de que monte cualquier
// Provider de datos) — por eso consulta Supabase directo en vez de pasar
// por useKipo()/SupabaseKipoProvider, que solo montan después de iniciar
// sesión y elegir espacio de trabajo.
function useLoginBranding(): LoginBranding {
  const [branding, setBranding] = useState<LoginBranding>({
    backgroundImageUrl: null,
    gradientColors: DEFAULT_GRADIENT.colors,
    gradientLocations: DEFAULT_GRADIENT.locations,
  });

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;
    supabase!
      .from('login_branding')
      .select('background_image_url, gradient_colors, gradient_locations')
      .single()
      .then(({ data }) => {
        if (cancelled || !data) return;
        setBranding({
          backgroundImageUrl: data.background_image_url ?? null,
          gradientColors: data.gradient_colors?.length ? data.gradient_colors : DEFAULT_GRADIENT.colors,
          gradientLocations: data.gradient_locations?.length ? data.gradient_locations : DEFAULT_GRADIENT.locations,
        });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return branding;
}

export function LoginBackdrop() {
  const branding = useLoginBranding();

  if (branding.backgroundImageUrl) {
    return <Image source={{ uri: branding.backgroundImageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />;
  }

  return (
    <LinearGradient
      colors={branding.gradientColors as [string, string, ...string[]]}
      locations={branding.gradientLocations as [number, number, ...number[]]}
      style={StyleSheet.absoluteFill}
    />
  );
}
