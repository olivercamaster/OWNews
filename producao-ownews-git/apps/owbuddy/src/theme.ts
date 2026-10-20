// OWBuddy Design System 1.0
// Visual language: premium, maritime/offshore, modern, clean, adult, professional, welcoming.
// NOT: cyberpunk, gamer, heavy industrial dashboard, excessive neon, emoji iconography.

// ─── Premium Material Pass (2026-10-20) ─────────────────────────────────────
// Preto azulado + navy muito profundo + grafite azulado + cinza frio + branco frio.
// O ciano OW é ACENTO (ação, estado ativo, precisão) — aparece pouco de propósito.
// Três níveis de profundidade, nada além disso:
//   N0 fundo · N1 superfície (cards) · N2 superfície elevada (card principal/ação).
export const tone = {
  // N0 — fundo
  bg0: '#02090f',
  bg1: '#03111b',
  bg2: '#041722',
  bg3: '#061a26',
  // N1 — superfície (material: topo levemente mais claro → base mais escura)
  surface:       '#0a1923',
  surfaceTop:    '#0d1e2a',
  surfaceBottom: '#08141c',
  // N2 — superfície elevada
  elevated:       '#0d2130',
  elevatedTop:    '#12293a',
  elevatedBottom: '#0a1a26',
  // Abaixo da superfície: campos, trilhos, áreas recuadas
  sunken: '#050f17',
  // Bordas finas, frias — nunca contorno neon
  borderSubtle: 'rgba(130, 190, 225, 0.10)',
  border:       'rgba(130, 190, 225, 0.16)',
  borderActive: 'rgba(18, 168, 238, 0.42)',
  // Luz de superfície: aresta superior clara + aresta inferior escura = chanfro de metal anodizado
  edgeLight: 'rgba(214, 236, 250, 0.11)',
  edgeDark:  'rgba(0, 4, 8, 0.60)',
  // Texto
  textPrimary:   '#f2f6f8',
  textSecondary: '#91a5b2',
  textMuted:     '#8296a7',
  // Dado importante sem ser ação (datas, prazos): claro e com peso, sem ciano
  textEmphasis:  '#c4d1da',
  // Acento OW
  accent:       '#12a8ee',
  accentText:   '#5fc4ee',
  accentSoft:   'rgba(18, 168, 238, 0.10)',
  accentBorder: 'rgba(18, 168, 238, 0.30)',
  // Ícone em pastilha neutra (grafite), o ícone é que leva a cor
  iconTile: 'rgba(150, 195, 225, 0.07)',
  shadow: '#000000',
} as const;

// ─── Palette ────────────────────────────────────────────────────────────────
// Nomes mantidos (as telas consomem estes tokens); valores do Premium Material Pass.
export const colors = {
  // Backgrounds
  navy950: tone.bg1,
  navy900: tone.bg3,
  navy800: tone.surface,
  navy700: tone.elevated,

  // Borders / dividers (sólidas, para listas e divisórias)
  line:       '#16293a',
  lineSoft:   '#112230',

  // Brand
  cyan:     tone.accent,
  cyanDim:  tone.accentText,
  cyanFaint: tone.accentSoft,

  // Text
  white:    tone.textPrimary,
  muted:    tone.textSecondary,
  mutedDim: tone.textMuted,

  // Status — dessaturados, sem gritar
  green:  '#2fbf71',
  amber:  '#e9a23b',
  red:    '#ef6a61',
  orange: '#f0852a',
} as const;

// ─── Semantic tokens ─────────────────────────────────────────────────────────
export const surface = {
  bg:       tone.bg1,
  card:     tone.surface,
  elevated: tone.elevated,
  header:   tone.bg3,
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
  label: { fontSize: 12, fontWeight: '600' as const, color: colors.muted, letterSpacing: 0.6, textTransform: 'uppercase' as const },
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
    shadowColor: tone.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.30,
    shadowRadius: 16,
    elevation: 4,
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
  // Fundo N0: quase preto + navy profundo. A faixa central fica só um tom acima —
  // identidade marítima sem "tudo azul".
  bgGradient: ['#01070d', '#03111b', '#051824', '#04131d', '#02090f'] as string[],
  bgLocations: [0, 0.30, 0.56, 0.82, 1] as number[],
  // Luz fria vinda do canto superior esquerdo (muito baixa) e sombra de profundidade na base.
  // Ambos LinearGradient — zero blur.
  glowGradient:  ['rgba(46, 140, 190, 0.075)', 'rgba(46, 140, 190, 0.022)', 'rgba(46, 140, 190, 0)'] as string[],
  glowLocations: [0, 0.45, 0.85] as number[],
  depthGradient: ['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0.30)'] as string[],

  // Cards N1/N2 — material opaco, pouca distância do fundo, sem blur.
  glass:        'rgba(10, 25, 35, 0.97)',
  glassElevated:'rgba(13, 33, 48, 0.98)',
  glassBorder:  tone.borderSubtle,
  glassActive:  tone.accentSoft,
  glassBorderActive: 'rgba(18, 168, 238, 0.38)',
  // Sombra profunda e difusa (profundidade, não card flutuando)
  cardShadow: {
    shadowColor: tone.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.34,
    shadowRadius: 18,
    elevation: 4,
  },

  // Metal anodizado escuro: reflexo frio só no topo (some antes de 60% do card) +
  // aresta superior clara e inferior escura. Sentido, não "efeito".
  sheenGradient:  ['rgba(205, 230, 248, 0.055)', 'rgba(205, 230, 248, 0.014)', 'rgba(205, 230, 248, 0)'] as string[],
  sheenLocations: [0, 0.30, 0.60] as number[],
  // N2 (card da escala na Home): gradiente tonal diagonal grafite-navy.
  heroGradient:   ['rgba(18, 41, 58, 0.99)', 'rgba(12, 30, 44, 0.99)', 'rgba(8, 21, 31, 0.99)'] as string[],
  edgeLight:      tone.edgeLight,
  edgeDark:       tone.edgeDark,

  // Recuados (campos, trilhos de progresso) e pastilha neutra de ícone
  sunken:          tone.sunken,
  fieldBorder:     'rgba(130, 190, 225, 0.14)',
  iconTile:        tone.iconTile,
  accentSoft:      tone.accentSoft,
  accentBorder:    tone.accentBorder,

  // Nav flutuante — preto azulado, linha superior fina, sem glow
  navBg:           'rgba(3, 11, 18, 0.97)',
  navBorder:       'rgba(130, 190, 225, 0.11)',
  navHeight:       64,
  navMarginBottom: 8,

  // Carta náutica ultra-suave: só textura (curvas batimétricas), ~2% percebido.
  bathymetryColor:   '#5fa9cc',
  bathymetryOpacity: 0.024,

  // Mascote oficial OWBuddy (assets/buddy-watermark.png). Tom sobre tom.
  // OWBuddy 1.0: marca-d'água grande DESLIGADA (OWBackground showWatermark=false por padrão).
  watermarkTint:    '#8db4ca',
  watermarkOpacity: 0.06,
  // Decisão do dono (2026-10-19): SÓ a Home tem o Buddy como marca-d'água.
  // Premium Material Pass: gravação tonal no material (mais baixa, tom frio-acinzentado).
  homeWatermarkOpacity: 0.055,
} as const;

/** Espaço que o conteúdo rolável precisa reservar embaixo para a nav flutuante nunca cobrir nada. */
export function bottomNavSpace(bottomInset: number): number {
  return maritime.navHeight + maritime.navMarginBottom + Math.max(bottomInset, 8) + spacing.lg;
}
