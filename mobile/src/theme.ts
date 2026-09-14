// Paleta validada con la skill de dataviz (references/palette.md) — orden fijo,
// nunca ciclado. 5 slots categóricos, uno por grupo de categoría.
// node scripts/validate_palette.js "#2a78d6,#eb6834,#1baf7a,#eda100,#e87ba4" --mode light
// → ALL CHECKS PASS (contraste bajo 3:1 en 3 slots => siempre acompañar con
// etiqueta visible, nunca color solo — ver relief rule).
export const groupColors: Record<string, string> = {
  fijos: '#2a78d6',
  necesarios: '#eb6834',
  transporte: '#1baf7a',
  alimentacion_fuera: '#eda100',
  salidas_convivencia: '#e87ba4',
};

// Identidad visual: una libreta de cuentas familiar, no un banco frío — papel
// cálido, tinta carbón, un verde pino como color de marca (dinero que crece,
// distinto del azul genérico de fintech) y un dorado bruñido como acento de
// segundo nivel (monedas, aguinaldo, la idea de "ahorro"). Semántica de
// ingreso/alerta usa tonos separados de la marca para que nunca se confundan.
export const colors = {
  // Superficies
  page: '#F3F0E9',
  surfaceRaised: '#FBF9F4',
  card: '#FFFFFF',
  // Tinta
  textPrimary: '#231F1A',
  textSecondary: '#6C6255',
  muted: '#96897A',
  // Líneas — con presencia real, no el 10% casi invisible de antes.
  gridline: '#E7E0D2',
  border: '#DFD6C4',
  // Marca
  primary: '#1E6B5C',
  primaryDeep: '#123F37',
  primarySoft: '#E1EEE9',
  gold: '#B4791E',
  goldSoft: '#F5E6CC',
  // Semántica
  good: '#3C8B4A',
  goodSoft: '#E3F1E4',
  warning: '#C97A1F',
  warningSoft: '#F7E9D6',
  critical: '#B8452F',
  criticalSoft: '#F6E1DB',
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
