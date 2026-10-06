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
  // Gradiente premium (topo → base): navy profundo → petróleo/naval → navy profundo.
  // Variação de luminosidade real, não um bloco azul chapado.
  bgGradient: ['#04121d', '#06243a', '#083247', '#06273c', '#041622'] as string[],
  bgLocations: [0, 0.28, 0.55, 0.80, 1] as number[],
  // Brilho diagonal (luz vinda do canto superior esquerdo) e sombra de profundidade na base.
  // Ambos são LinearGradient — zero blur, zero custo de GPU relevante.
  glowGradient:  ['rgba(32, 150, 200, 0.16)', 'rgba(32, 150, 200, 0.05)', 'rgba(32, 150, 200, 0)'] as string[],
  glowLocations: [0, 0.45, 0.85] as number[],
  depthGradient: ['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0.22)'] as string[],

  // Cards — LEITURA > EFEITO GLASS. Superfície quase opaca, um tom mais clara que o
  // fundo (lê como camada acima), borda fina luminosa, sem blur.
  glass:        'rgba(16, 58, 84, 0.92)',
  glassElevated:'rgba(20, 68, 98, 0.95)',
  glassBorder:  'rgba(120, 200, 240, 0.14)',
  glassActive:  'rgba(18, 168, 238, 0.18)',
  glassBorderActive: 'rgba(18, 168, 238, 0.40)',
  // Elevação discreta para os cards principais (escala, mensagem do Buddy)
  cardShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 3,
  },

  // Nav flutuante — contraste garantido sobre qualquer trecho do gradiente
  navBg:           'rgba(4, 18, 30, 0.97)',
  navBorder:       'rgba(120, 200, 240, 0.16)',
  navHeight:       62,
  navMarginBottom: 8,

  // Carta náutica ultra-suave: SÓ textura (curvas batimétricas orgânicas), nunca
  // grade, cruzamentos ou retas atravessando cards. ~3% percebido.
  bathymetryColor:   '#5fc4ee',
  bathymetryOpacity: 0.030,

  // Sonar náutico (círculos concêntricos) — complementar ao mascote, ainda mais discreto.
  nauticalTint:    '#5aafc5',
  nauticalOpacity: 0.016,

  // Mascote OWBuddy "A" chevron — watermark principal, tom sobre tom.
  // Grande, parcialmente cortado nas laterais. "Quando percebe, fica bonito."
  watermarkTint:    '#62b5d2',
  watermarkOpacity: 0.068,
} as const;

/** Espaço que o conteúdo rolável precisa reservar embaixo para a nav flutuante nunca cobrir nada. */
export function bottomNavSpace(bottomInset: number): number {
  return maritime.navHeight + maritime.navMarginBottom + Math.max(bottomInset, 8) + spacing.lg;
}
