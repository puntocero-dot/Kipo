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

export const colors = {
  surface: '#fcfcfb',
  page: '#f5f5f3',
  card: '#ffffff',
  textPrimary: '#0b0b0b',
  textSecondary: '#52514e',
  muted: '#898781',
  gridline: '#e1e0d9',
  border: 'rgba(11,11,11,0.10)',
  good: '#0ca30c',
  warning: '#fab219',
  critical: '#d03b3b',
  primary: '#2a78d6',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 };
