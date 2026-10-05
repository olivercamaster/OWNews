// OWBuddy Design System 1.0
// Visual language: premium, maritime/offshore, modern, clean, adult, professional, welcoming.
// NOT: cyberpunk, gamer, heavy industrial dashboard, excessive neon, emoji iconography.

// ─── Palette ────────────────────────────────────────────────────────────────
export const colors = {
  // Backgrounds
  navy950: '#061c2b',
  navy900: '#08283a',
  navy800: '#0a2c40',
  navy700: '#0e3450',

  // Borders / dividers
  line:       '#16445e',
  lineSoft:   '#123c53',

  // Brand
  cyan:     '#12a8ee',
  cyanDim:  '#5fc4ee',
  cyanFaint: 'rgba(18,168,238,0.12)',

  // Text
  white:    '#f7fafc',
  muted:    '#9eb5c5',
  mutedDim: '#6f8b9c',

  // Status
  green:  '#22c55e',
  amber:  '#f59e0b',
  red:    '#ef4444',
  orange: '#ff7a00',
} as const;

// ─── Semantic tokens ─────────────────────────────────────────────────────────
export const surface = {
  bg:       colors.navy950,
  card:     colors.navy800,
  elevated: colors.navy700,
  header:   colors.navy900,
  border:   colors.line,
} as const;

// ─── Spacing ─────────────────────────────────────────────────────────────────
export const spacing = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
  xxl: 48,
} as const;

// ─── Border radius ───────────────────────────────────────────────────────────
export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
} as const;

// ─── Typography ──────────────────────────────────────────────────────────────
export const typography = {
  h1:    { fontSize: 28, fontWeight: '700' as const, color: colors.white },
  h2:    { fontSize: 20, fontWeight: '700' as const, color: colors.white },
  h3:    { fontSize: 16, fontWeight: '600' as const, color: colors.white },
  body:  { fontSize: 15, fontWeight: '400' as const, color: colors.white },
  small: { fontSize: 13, fontWeight: '400' as const, color: colors.muted },
  micro: { fontSize: 11, fontWeight: '600' as const, color: colors.mutedDim, letterSpacing: 0.8, textTransform: 'uppercase' as const },
  label: { fontSize: 12, fontWeight: '600' as const, color: colors.cyanDim, letterSpacing: 0.5, textTransform: 'uppercase' as const },
  mono:  { fontSize: 11, fontFamily: 'monospace' as const, color: colors.muted },
} as const;

// ─── Icon sizes ──────────────────────────────────────────────────────────────
export const iconSize = {
  tab:    24,
  card:   20,
  inline: 16,
  small:  14,
} as const;

// ─── Touch targets ───────────────────────────────────────────────────────────
export const touchTarget = {
  min: 44,  // WCAG / Apple HIG minimum
} as const;

// ─── Elevation (shadow tokens) ───────────────────────────────────────────────
export const elevation = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  modal: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
} as const;

// ─── Screen-level layout tokens ──────────────────────────────────────────────
export const screen = {
  sectionGap: 20,
  cardPad: 14,
  listItemHeight: 72,
} as const;

// ─── Maritime visual identity (Design System 2.0) ────────────────────────────
// Glassmorphism cards over the premium navy gradient background.
// Never add opacity tokens inside StyleSheet.create() — keep them here.
export const maritime = {
  // Background gradient stops (top → bottom)
  bgGradient: ['#061c2b', '#07223a', '#0a2c40', '#061c2b'] as string[],
  bgLocations: [0, 0.3, 0.7, 1] as number[],

  // Glass cards — navy with controlled transparency
  glass:        'rgba(10, 44, 64, 0.72)',
  glassElevated:'rgba(14, 52, 80, 0.82)',
  glassBorder:  'rgba(22, 68, 94, 0.55)',
  glassActive:  'rgba(18, 168, 238, 0.18)',
  glassBorderActive: 'rgba(18, 168, 238, 0.40)',

  // Watermark opacity — mascot behind content
  watermarkOpacity: 0.055,
  // Nautical decoration opacity
  nauticalOpacity: 0.045,
} as const;
