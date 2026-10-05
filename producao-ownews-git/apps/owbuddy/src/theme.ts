export const colors = {
  navy950: '#061c2b',
  navy900: '#08283a',
  navy800: '#0a2c40',
  navy700: '#0e3450',
  line: '#16445e',
  lineSoft: '#123c53',
  cyan: '#12a8ee',
  cyanDim: '#5fc4ee',
  white: '#f7fafc',
  muted: '#9eb5c5',
  mutedDim: '#6f8b9c',
  green: '#22c55e',
  amber: '#f59e0b',
  red: '#ef4444',
  orange: '#ff7a00',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
} as const;

export const typography = {
  h1: { fontSize: 28, fontWeight: '700' as const, color: colors.white },
  h2: { fontSize: 20, fontWeight: '700' as const, color: colors.white },
  h3: { fontSize: 16, fontWeight: '600' as const, color: colors.white },
  body: { fontSize: 15, fontWeight: '400' as const, color: colors.white },
  small: { fontSize: 13, fontWeight: '400' as const, color: colors.muted },
  micro: { fontSize: 11, fontWeight: '600' as const, color: colors.mutedDim, letterSpacing: 0.8, textTransform: 'uppercase' as const },
  label: { fontSize: 12, fontWeight: '600' as const, color: colors.cyanDim, letterSpacing: 0.5, textTransform: 'uppercase' as const },
  mono: { fontSize: 11, fontFamily: 'monospace' as const, color: colors.muted },
};
