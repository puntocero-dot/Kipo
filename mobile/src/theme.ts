// Paleta validada con la skill de dataviz (references/palette.md) — orden fijo,
// nunca ciclado. 5 slots categóricos, uno por grupo de categoría. Son los
// mismos hexes documentados como la variante "Dark" de la paleta de
// referencia (mismo orden azul/naranja/aqua/amarillo/magenta que ya usaba
// Kipo en modo claro), re-escalonados para leerse sobre una superficie oscura:
// node scripts/validate_palette.js "#3987e5,#d95926,#199e70,#c98500,#d55181" --mode dark --surface "#153a30"
// → ALL CHECKS PASS.
export const groupColors: Record<string, string> = {
  fijos: '#3987e5',
  necesarios: '#d95926',
  transporte: '#199e70',
  alimentacion_fuera: '#c98500',
  salidas_convivencia: '#d55181',
  // No es un 6to slot categórico nuevo (no re-validado con la dataviz skill) —
  // reusa el mismo verde semántico de "ingreso" que ya se ve en el resto de
  // la app (colors.good abajo), así una categoría de ingreso nunca se confunde
  // visualmente con una de gasto.
  ingresos: '#4ADE80',
};

// Identidad visual: fintech familiar profesional sobre fondo oscuro — verde
// bosque profundo (dinero que crece, un jardín de noche) con dorado bruñido
// como acento de marca y un verde esmeralda vivo para lo interactivo. Antes
// el pino oscuro servía a la vez de fondo claro-de-marca y de acento sobre
// papel crema; con el fondo ahora oscuro, ese mismo tono pasa a `primaryDeep`
// (fondos, degradados, el "flood" de SeedGrowthIntro) y `primary` se vuelve
// un verde vivo que sí contrasta sobre superficies oscuras. Semántica de
// ingreso/alerta usa tonos separados de la marca para que nunca se confundan.
export const colors = {
  // Superficies
  page: '#0D2620',
  surfaceRaised: '#123830',
  card: '#153A30',
  // Tinta
  textPrimary: '#F4EFE4',
  textSecondary: '#C7D2C3',
  muted: '#7E9186',
  // Líneas — con presencia real, no el 10% casi invisible de antes.
  gridline: '#20443A',
  border: '#2B5445',
  // Marca
  primary: '#3ECF8E',
  primaryDeep: '#123F37',
  primarySoft: '#1C3F34',
  gold: '#E3AE55',
  goldSoft: '#3A2F18',
  // Semántica
  good: '#4ADE80',
  goodSoft: '#1C3A24',
  warning: '#E08D3C',
  warningSoft: '#3D2A16',
  critical: '#E85D4A',
  criticalSoft: '#3D1F1A',
};

// Outfit para números y titulares (confianza, peso) + Plus Jakarta Sans para
// texto de interfaz (cálido, legible en tamaños chicos). Cargadas en
// app/_layout.tsx vía @expo-google-fonts — mientras cargan, RN cae al
// sistema, así que todo el texto sigue siendo legible desde el primer frame.
export const fonts = {
  display: 'Outfit_700Bold',
  displaySemibold: 'Outfit_600SemiBold',
  displayBlack: 'Outfit_800ExtraBold',
  body: 'PlusJakartaSans_400Regular',
  bodyMedium: 'PlusJakartaSans_500Medium',
  bodySemibold: 'PlusJakartaSans_600SemiBold',
  bodyBold: 'PlusJakartaSans_700Bold',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 };

// Tres niveles de elevación — una tarjeta normal, una tarjeta destacada
// (balance del mes) y un elemento flotante (FAB, hoja modal).
export const shadow = {
  card: {
    shadowColor: '#3A2E1F',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  raised: {
    shadowColor: '#3A2E1F',
    shadowOpacity: 0.14,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  floating: {
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
} as const;
