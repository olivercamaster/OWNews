// OWBuddy Design System — Premium Dark / Light (2026-10-20)
// Visual language: premium, maritime/offshore, modern, clean, adult, professional, welcoming.
// NOT: cyberpunk, gamer, heavy industrial dashboard, excessive neon, emoji iconography.
//
// UM design system, DOIS materiais. Os dois temas fornecem valores para os MESMOS tokens
// (mesma tipografia, raios, espaçamentos, ícones e hierarquia) — o que muda é material,
// luminosidade, contraste e superfícies.
//   Escuro (padrão de identidade): preto azulado, navy muito profundo, grafite, branco frio.
//   Claro: instrumentação náutica premium de dia — off-white frio, branco, navy nos textos.
// O ciano OW é ACENTO (ação, estado ativo, precisão) — aparece pouco de propósito.
//
// Telas NUNCA perguntam "if dark / if light" nem escrevem hex: consomem os tokens abaixo.
// `aplicarTema()` troca os valores no lugar e `themed()` refaz as folhas de estilo por tema.
// Este arquivo não importa React Native (os testes rodam em Node).

export type TemaEfetivo = 'escuro' | 'claro';

// ─── Tokens semânticos (camada canônica) ─────────────────────────────────────
export interface TokensSemanticos {
  background: string;
  backgroundSecondary: string;
  surface: string;
  surfaceElevated: string;
  surfacePressed: string;
  surfaceSunken: string;
  borderSubtle: string;
  borderStrong: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textEmphasis: string;
  textInverse: string;
  textDisabled: string;
  accent: string;
  accentPressed: string;
  accentSoft: string;
  accentBorder: string;
  accentText: string;
  onAccent: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  info: string;
  infoSoft: string;
  shadow: string;
  overlay: string;
  navigationBackground: string;
  navigationBorder: string;
  navigationActive: string;
  navigationInactive: string;
  headerBackground: string;
  inputBackground: string;
  inputBorder: string;
  inputFocus: string;
  inputPlaceholder: string;
  // Contorno de controle (checkbox, rádio, trilho de switch desligado) — visível sem gritar
  controlBorder: string;
  // Calendário da escala (estado do dia: fundo / texto / borda)
  calendarEmbarcadoBg: string;
  calendarEmbarcadoText: string;
  calendarEmbarcadoBorder: string;
  calendarEmbarqueText: string;
  calendarFolgaBg: string;
  calendarFolgaText: string;
  calendarFolgaBorder: string;
  calendarDobraBg: string;
  calendarDobraText: string;
  calendarDobraBorder: string;
  calendarFeriasBg: string;
  calendarFeriasText: string;
  calendarFeriasBorder: string;
  calendarSemEscalaBg: string;
  calendarSemEscalaText: string;
  calendarSemEscalaBorder: string;
  calendarHoje: string;
  calendarJuntos: string;
  calendarJuntosBorder: string;
  // Categorias de lembrete (ícone): mesmas famílias de cor, tom ajustado ao fundo
  eventoAniversario: string;
  eventoConsulta: string;
  eventoDocumento: string;
  eventoPessoal: string;
  eventoPagamento: string;
  // Marca de terceiros (Uber): botão branco com texto preto nos dois temas
  brandUberBg: string;
  brandUberText: string;
  brandUberBorder: string;
  // Fotos (legenda/crédito sobre imagem)
  photoScrim: string;
  photoScrimText: string;
}

const ESCURO: TokensSemanticos = {
  // N0 — quase preto com fundo navy profundo (menos azul que antes: grafite azulado)
  background:          '#030b11',
  backgroundSecondary: '#06111a',
  // N1/N2 — grafite-navy; a diferença entre níveis é controlada, nunca "card azul"
  surface:         '#0b151d',
  surfaceElevated: '#0f1c27',
  surfacePressed:  '#13222e',
  surfaceSunken:   '#060e15',
  borderSubtle: 'rgba(150, 188, 214, 0.10)',
  borderStrong: 'rgba(150, 188, 214, 0.18)',
  textPrimary:   '#eef3f6',
  textSecondary: '#9cadb9',
  textMuted:     '#8494a1',
  textEmphasis:  '#c9d4dc',
  textInverse:   '#0b1824',
  textDisabled:  '#56656f',
  accent:        '#14a9ec',
  accentPressed: '#0f93d0',
  accentSoft:    'rgba(20, 169, 236, 0.10)',
  accentBorder:  'rgba(20, 169, 236, 0.30)',
  accentText:    '#62c5ee',
  onAccent:      '#03121c',
  success:     '#33c27a',
  successSoft: 'rgba(51, 194, 122, 0.10)',
  warning:     '#e9a640',
  warningSoft: 'rgba(233, 166, 64, 0.10)',
  danger:      '#ef6d64',
  dangerSoft:  'rgba(239, 109, 100, 0.10)',
  info:        '#62c5ee',
  infoSoft:    'rgba(98, 197, 238, 0.10)',
  shadow:  '#000000',
  overlay: 'rgba(1, 6, 10, 0.66)',
  navigationBackground: 'rgba(4, 11, 17, 0.97)',
  navigationBorder:     'rgba(150, 188, 214, 0.11)',
  navigationActive:     '#14a9ec',
  navigationInactive:   '#8494a1',
  headerBackground:     '#061019',
  inputBackground:  '#060e15',
  inputBorder:      'rgba(150, 188, 214, 0.15)',
  inputFocus:       'rgba(20, 169, 236, 0.55)',
  inputPlaceholder: '#76879a',
  controlBorder:    '#2b3c4a',
  calendarEmbarcadoBg:     '#0b2418',
  calendarEmbarcadoText:   '#4fc77e',
  calendarEmbarcadoBorder: '#1a4d30',
  calendarEmbarqueText:    '#74e295',
  calendarFolgaBg:         '#0b151d',
  calendarFolgaText:       '#9cadb9',
  calendarFolgaBorder:     '#16242f',
  calendarDobraBg:         '#2a1f05',
  calendarDobraText:       '#f2bf3a',
  calendarDobraBorder:     '#4a3a0a',
  calendarFeriasBg:        '#121634',
  calendarFeriasText:      '#8e9be0',
  calendarFeriasBorder:    '#262c5c',
  calendarSemEscalaBg:     '#071019',
  calendarSemEscalaText:   '#56656f',
  calendarSemEscalaBorder: '#101c26',
  calendarHoje:            '#14a9ec',
  calendarJuntos:          '#33c27a',
  calendarJuntosBorder:    'rgba(51, 194, 122, 0.45)',
  eventoAniversario: '#f48fb1',
  eventoConsulta:    '#80cbc4',
  eventoDocumento:   '#b0bec5',
  eventoPessoal:     '#ce93d8',
  eventoPagamento:   '#a5d6a7',
  brandUberBg:     '#f7fafc',
  brandUberText:   '#000000',
  brandUberBorder: '#f7fafc',
  photoScrim:     'rgba(0, 0, 0, 0.55)',
  photoScrimText: 'rgba(255, 255, 255, 0.85)',
};

const CLARO: TokensSemanticos = {
  // Off-white frio de fundo; superfícies brancas; separação por borda fina e sombra baixa.
  background:          '#f2f5f8',
  backgroundSecondary: '#e9eef2',
  surface:         '#ffffff',
  surfaceElevated: '#ffffff',
  surfacePressed:  '#eef3f7',
  surfaceSunken:   '#f1f4f7',
  borderSubtle: 'rgba(16, 46, 72, 0.09)',
  borderStrong: 'rgba(16, 46, 72, 0.16)',
  // Navy quase preto + grafite azulado (contraste AA sobre branco e sobre o fundo)
  textPrimary:   '#0b1824',
  textSecondary: '#445664',
  textMuted:     '#5a6b78',
  textEmphasis:  '#1d3344',
  textInverse:   '#eef3f6',
  textDisabled:  '#9aa7b1',
  // Azul OW profundo para ação (texto branco legível); ciano controlado em detalhes
  accent:        '#086aa0',
  accentPressed: '#065a88',
  accentSoft:    'rgba(8, 106, 160, 0.08)',
  accentBorder:  'rgba(8, 106, 160, 0.30)',
  accentText:    '#075f90',
  onAccent:      '#ffffff',
  success:     '#0f7442',
  successSoft: 'rgba(15, 116, 66, 0.08)',
  warning:     '#8a5500',
  warningSoft: 'rgba(196, 128, 16, 0.10)',
  danger:      '#b3322a',
  dangerSoft:  'rgba(179, 50, 42, 0.07)',
  info:        '#075f90',
  infoSoft:    'rgba(8, 106, 160, 0.08)',
  shadow:  '#0d2436',
  overlay: 'rgba(10, 24, 36, 0.38)',
  navigationBackground: 'rgba(251, 252, 253, 0.97)',
  navigationBorder:     'rgba(16, 46, 72, 0.10)',
  navigationActive:     '#086aa0',
  navigationInactive:   '#5a6b78',
  headerBackground:     '#f7f9fb',
  inputBackground:  '#ffffff',
  inputBorder:      'rgba(16, 46, 72, 0.18)',
  inputFocus:       'rgba(8, 106, 160, 0.60)',
  inputPlaceholder: '#6b7b88',
  controlBorder:    '#a3b2bd',
  calendarEmbarcadoBg:     '#e2f3e9',
  calendarEmbarcadoText:   '#0f6e3d',
  calendarEmbarcadoBorder: '#a8d8bb',
  calendarEmbarqueText:    '#0b5c32',
  calendarFolgaBg:         '#ffffff',
  calendarFolgaText:       '#33475a',
  calendarFolgaBorder:     '#dde5ec',
  calendarDobraBg:         '#fdf0d3',
  calendarDobraText:       '#7c4f00',
  calendarDobraBorder:     '#ecc97a',
  calendarFeriasBg:        '#ebedfb',
  calendarFeriasText:      '#3b469a',
  calendarFeriasBorder:    '#c3c9ef',
  calendarSemEscalaBg:     '#f3f6f8',
  calendarSemEscalaText:   '#93a1ac',
  calendarSemEscalaBorder: '#e5ebf0',
  calendarHoje:            '#086aa0',
  calendarJuntos:          '#0f7442',
  calendarJuntosBorder:    'rgba(15, 116, 66, 0.45)',
  eventoAniversario: '#ad1457',
  eventoConsulta:    '#00796b',
  eventoDocumento:   '#546e7a',
  eventoPessoal:     '#8e24aa',
  eventoPagamento:   '#2e7d32',
  brandUberBg:     '#000000',
  brandUberText:   '#ffffff',
  brandUberBorder: '#000000',
  photoScrim:     'rgba(0, 0, 0, 0.55)',
  photoScrimText: 'rgba(255, 255, 255, 0.85)',
};

/** Valores por tema — fonte única. */
export const TOKENS_POR_TEMA: Readonly<Record<TemaEfetivo, TokensSemanticos>> = { escuro: ESCURO, claro: CLARO };

// ─── Material por tema (luz, profundidade, gradientes) ───────────────────────
interface Material {
  bg: { bg0: string; bg1: string; bg2: string; bg3: string };
  surfaceTop: string; surfaceBottom: string;
  elevatedTop: string; elevatedBottom: string;
  edgeLight: string; edgeDark: string;
  borderActive: string;
  iconTile: string;
  // Divisórias sólidas para listas (sem alfa, para não somar sobre superfícies)
  line: string; lineSoft: string;
  bgGradient: string[]; bgLocations: number[];
  glowGradient: string[]; glowLocations: number[];
  depthGradient: string[];
  glass: string; glassElevated: string;
  glassBorderActive: string;
  sheenGradient: string[]; sheenLocations: number[];
  heroGradient: string[];
  fieldBorder: string;
  cardShadow: { shadowColor: string; shadowOffset: { width: number; height: number }; shadowOpacity: number; shadowRadius: number; elevation: number };
  navShadow: { shadowColor: string; shadowOffset: { width: number; height: number }; shadowOpacity: number; shadowRadius: number; elevation: number };
  bathymetryColor: string; bathymetryOpacity: number;
  watermarkTint: string; watermarkOpacity: number; homeWatermarkOpacity: number;
  // Destaque do tile principal da Home (aresta superior)
  tileHighlight: string;
}

const MATERIAL_ESCURO: Material = {
  bg: { bg0: '#01070c', bg1: ESCURO.background, bg2: '#05101a', bg3: ESCURO.headerBackground },
  // Metal anodizado escuro: topo levemente mais claro → base mais escura
  surfaceTop: '#0e1922', surfaceBottom: '#091219',
  elevatedTop: '#132230', elevatedBottom: '#0b1720',
  edgeLight: 'rgba(214, 234, 248, 0.10)',
  edgeDark:  'rgba(0, 4, 8, 0.60)',
  borderActive: 'rgba(20, 169, 236, 0.42)',
  iconTile: 'rgba(160, 196, 222, 0.065)',
  line: '#15232f', lineSoft: '#101c26',
  // Fundo: quase preto; faixa central só um tom acima — identidade marítima sem "tudo azul"
  bgGradient: ['#01060b', '#030b11', '#05111a', '#040e16', '#02080d'],
  bgLocations: [0, 0.30, 0.56, 0.82, 1],
  glowGradient: ['rgba(60, 140, 185, 0.060)', 'rgba(60, 140, 185, 0.018)', 'rgba(60, 140, 185, 0)'],
  glowLocations: [0, 0.45, 0.85],
  depthGradient: ['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0.32)'],
  glass: 'rgba(11, 21, 29, 0.97)',
  glassElevated: 'rgba(15, 28, 39, 0.98)',
  glassBorderActive: 'rgba(20, 169, 236, 0.38)',
  sheenGradient: ['rgba(205, 228, 246, 0.050)', 'rgba(205, 228, 246, 0.012)', 'rgba(205, 228, 246, 0)'],
  sheenLocations: [0, 0.30, 0.60],
  heroGradient: ['rgba(19, 36, 50, 0.99)', 'rgba(13, 26, 37, 0.99)', 'rgba(8, 17, 25, 0.99)'],
  fieldBorder: ESCURO.inputBorder,
  cardShadow: { shadowColor: '#000000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.34, shadowRadius: 18, elevation: 4 },
  navShadow:  { shadowColor: '#000000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.45, shadowRadius: 22, elevation: 16 },
  bathymetryColor: '#5c9fc2', bathymetryOpacity: 0.022,
  // Gravação tonal no material
  watermarkTint: '#8aaabd', watermarkOpacity: 0.06, homeWatermarkOpacity: 0.055,
  tileHighlight: 'rgba(150, 215, 245, 0.24)',
};

const MATERIAL_CLARO: Material = {
  bg: { bg0: '#e6ecf1', bg1: CLARO.background, bg2: '#eef2f6', bg3: CLARO.headerBackground },
  // Branco premium: base levemente fria, topo branco puro
  surfaceTop: '#ffffff', surfaceBottom: '#fafcfd',
  elevatedTop: '#ffffff', elevatedBottom: '#f6f9fb',
  // Highlight branco no topo + sombra de contato muito baixa na base
  // Aresta superior um tom mais suave que as laterais (sem "dente" nos cantos)
  edgeLight: 'rgba(16, 46, 72, 0.06)',
  edgeDark:  'rgba(16, 46, 72, 0.10)',
  borderActive: 'rgba(8, 106, 160, 0.48)',
  iconTile: 'rgba(16, 70, 110, 0.055)',
  line: '#e1e8ee', lineSoft: '#eaf0f4',
  bgGradient: ['#f7f9fb', '#f2f5f8', '#eef2f6', '#f0f4f7', '#f3f6f8'],
  bgLocations: [0, 0.30, 0.56, 0.82, 1],
  // Luz do dia vinda do canto superior esquerdo
  glowGradient: ['rgba(255, 255, 255, 0.85)', 'rgba(255, 255, 255, 0.25)', 'rgba(255, 255, 255, 0)'],
  glowLocations: [0, 0.45, 0.85],
  depthGradient: ['rgba(24, 60, 92, 0)', 'rgba(24, 60, 92, 0.035)'],
  glass: 'rgba(255, 255, 255, 0.98)',
  glassElevated: '#ffffff',
  glassBorderActive: 'rgba(8, 106, 160, 0.40)',
  // No claro o "material" é a base fria (não reflexo): branco → névoa fria embaixo
  sheenGradient: ['rgba(234, 242, 248, 0)', 'rgba(234, 242, 248, 0.35)', 'rgba(234, 242, 248, 0.70)'],
  sheenLocations: [0.35, 0.75, 1],
  heroGradient: ['rgba(255, 255, 255, 1)', 'rgba(250, 252, 253, 1)', 'rgba(241, 246, 250, 1)'],
  fieldBorder: CLARO.inputBorder,
  cardShadow: { shadowColor: '#0d2436', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.07, shadowRadius: 14, elevation: 2 },
  navShadow:  { shadowColor: '#0d2436', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 10 },
  bathymetryColor: '#3f7a9c', bathymetryOpacity: 0.045,
  // Quase impressão / baixo-relevo
  watermarkTint: '#4f7690', watermarkOpacity: 0.05, homeWatermarkOpacity: 0.06,
  tileHighlight: 'rgba(255, 255, 255, 1)',
};

const MATERIAL_POR_TEMA: Record<TemaEfetivo, Material> = { escuro: MATERIAL_ESCURO, claro: MATERIAL_CLARO };

// ─── Construção das camadas legadas (nomes que as telas já consomem) ─────────
function construir(tema: TemaEfetivo) {
  const t = TOKENS_POR_TEMA[tema];
  const m = MATERIAL_POR_TEMA[tema];
  const tone = {
    bg0: m.bg.bg0, bg1: m.bg.bg1, bg2: m.bg.bg2, bg3: m.bg.bg3,
    surface: t.surface, surfaceTop: m.surfaceTop, surfaceBottom: m.surfaceBottom,
    elevated: t.surfaceElevated, elevatedTop: m.elevatedTop, elevatedBottom: m.elevatedBottom,
    sunken: t.surfaceSunken,
    borderSubtle: t.borderSubtle, border: t.borderStrong, borderActive: m.borderActive,
    edgeLight: m.edgeLight, edgeDark: m.edgeDark,
    textPrimary: t.textPrimary, textSecondary: t.textSecondary, textMuted: t.textMuted, textEmphasis: t.textEmphasis,
    accent: t.accent, accentText: t.accentText, accentSoft: t.accentSoft, accentBorder: t.accentBorder,
    iconTile: m.iconTile,
    shadow: t.shadow,
  };
  const colors = {
    // Fundos (nomes históricos: "navy" = nível de profundidade, não cor literal)
    navy950: m.bg.bg1,
    navy900: m.bg.bg3,
    navy800: t.surface,
    navy700: t.surfaceElevated,
    line: m.line,
    lineSoft: m.lineSoft,
    cyan: t.accent,
    cyanDim: t.accentText,
    cyanFaint: t.accentSoft,
    // Texto ("white" = texto primário do tema)
    white: t.textPrimary,
    muted: t.textSecondary,
    mutedDim: t.textMuted,
    // Texto/ícone sobre o acento (botão primário)
    onAccent: t.onAccent,
    green: t.success,
    amber: t.warning,
    red: t.danger,
    orange: tema === 'escuro' ? '#f0852a' : '#a94c0c',
  };
  const surface = {
    bg: m.bg.bg1,
    card: t.surface,
    elevated: t.surfaceElevated,
    header: t.headerBackground,
    border: m.line,
  };
  const typography = {
    h1:    { fontSize: 28, fontWeight: '700' as const, color: t.textPrimary },
    h2:    { fontSize: 20, fontWeight: '700' as const, color: t.textPrimary },
    h3:    { fontSize: 16, fontWeight: '600' as const, color: t.textPrimary },
    body:  { fontSize: 15, fontWeight: '400' as const, color: t.textPrimary },
    small: { fontSize: 13, fontWeight: '400' as const, color: t.textSecondary },
    micro: { fontSize: 11, fontWeight: '600' as const, color: t.textMuted, letterSpacing: 0.8, textTransform: 'uppercase' as const },
    label: { fontSize: 12, fontWeight: '600' as const, color: t.textSecondary, letterSpacing: 0.6, textTransform: 'uppercase' as const },
    mono:  { fontSize: 11, fontFamily: 'monospace' as const, color: t.textSecondary },
  };
  const elevation = {
    card: { ...m.cardShadow, shadowOffset: { ...m.cardShadow.shadowOffset } },
    modal: tema === 'escuro'
      ? { shadowColor: '#000000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 8 }
      : { shadowColor: '#0d2436', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.14, shadowRadius: 24, elevation: 8 },
  };
  const maritime = {
    bgGradient: [...m.bgGradient],
    bgLocations: [...m.bgLocations],
    glowGradient: [...m.glowGradient],
    glowLocations: [...m.glowLocations],
    depthGradient: [...m.depthGradient],
    glass: m.glass,
    glassElevated: m.glassElevated,
    glassBorder: t.borderSubtle,
    glassActive: t.accentSoft,
    glassBorderActive: m.glassBorderActive,
    cardShadow: { ...m.cardShadow, shadowOffset: { ...m.cardShadow.shadowOffset } },
    sheenGradient: [...m.sheenGradient],
    sheenLocations: [...m.sheenLocations],
    heroGradient: [...m.heroGradient],
    edgeLight: m.edgeLight,
    edgeDark: m.edgeDark,
    sunken: t.surfaceSunken,
    // Campo de formulário: recuado no escuro, branco no claro (borda faz a separação)
    field: t.inputBackground,
    fieldBorder: m.fieldBorder,
    iconTile: m.iconTile,
    accentSoft: t.accentSoft,
    accentBorder: t.accentBorder,
    tileHighlight: m.tileHighlight,
    overlay: t.overlay,
    // Nav flutuante — sem glow
    navBg: t.navigationBackground,
    navBorder: t.navigationBorder,
    navShadow: { ...m.navShadow, shadowOffset: { ...m.navShadow.shadowOffset } },
    navHeight: 64,
    navMarginBottom: 8,
    // Carta náutica ultra-suave: só textura
    bathymetryColor: m.bathymetryColor,
    bathymetryOpacity: m.bathymetryOpacity,
    // Mascote oficial (assets/buddy-watermark.png). Opacidade por tema, não a mesma nos dois.
    watermarkTint: m.watermarkTint,
    watermarkOpacity: m.watermarkOpacity,
    // Decisão do dono (2026-10-19): SÓ a Home tem o Buddy como marca-d'água.
    homeWatermarkOpacity: m.homeWatermarkOpacity,
  };
  return { tokens: { ...t }, tone, colors, surface, typography, elevation, maritime };
}

type Camadas = ReturnType<typeof construir>;
const CAMADAS: Record<TemaEfetivo, Camadas> = { escuro: construir('escuro'), claro: construir('claro') };

// Objetos exportados são ESTÁVEIS (mesma referência sempre); `aplicarTema` troca os valores.
// Itens aninhados (typography.small, maritime.cardShadow…) são SUBSTITUÍDOS, nunca mutados —
// o StyleSheet.create em dev congela objetos que recebe.
export const tokens: TokensSemanticos = { ...CAMADAS.escuro.tokens };
export const tone: Camadas['tone'] = { ...CAMADAS.escuro.tone };
export const colors: Camadas['colors'] = { ...CAMADAS.escuro.colors };
export const surface: Camadas['surface'] = { ...CAMADAS.escuro.surface };
export const typography: Camadas['typography'] = { ...CAMADAS.escuro.typography };
export const elevation: Camadas['elevation'] = { ...CAMADAS.escuro.elevation };
export const maritime: Camadas['maritime'] = { ...CAMADAS.escuro.maritime };

let temaAtual: TemaEfetivo = 'escuro';

/** Tema efetivo em uso agora. */
export function temaAtivo(): TemaEfetivo {
  return temaAtual;
}

/** Troca todos os tokens para o tema pedido (instantâneo, sem recarregar). */
export function aplicarTema(tema: TemaEfetivo): void {
  if (tema !== 'escuro' && tema !== 'claro') return;
  const c = construir(tema);
  Object.assign(tokens, c.tokens);
  Object.assign(tone, c.tone);
  Object.assign(colors, c.colors);
  Object.assign(surface, c.surface);
  Object.assign(typography, c.typography);
  Object.assign(elevation, c.elevation);
  Object.assign(maritime, c.maritime);
  temaAtual = tema;
}

/** Camadas de um tema sem aplicá-lo (testes e comparação). */
export function camadasDoTema(tema: TemaEfetivo): Camadas {
  return construir(tema);
}

/**
 * Valor dependente do tema (folha de estilos, mapa de cores). A fábrica roda uma vez por tema,
 * na primeira leitura, com os tokens daquele tema já aplicados. Uso:
 *   const styles = themed(() => StyleSheet.create({ ... }));
 */
export function themed<T extends object>(fabrica: () => T): T {
  const cache: Partial<Record<TemaEfetivo, T>> = {};
  const atual = (): T => (cache[temaAtual] ??= fabrica());
  return new Proxy({} as T, {
    get: (_, k) => (atual() as Record<PropertyKey, unknown>)[k],
    has: (_, k) => k in atual(),
    ownKeys: () => Reflect.ownKeys(atual()),
    getOwnPropertyDescriptor: (_, k) => {
      const d = Object.getOwnPropertyDescriptor(atual(), k);
      return d ? { ...d, configurable: true } : undefined;
    },
  });
}

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

// ─── Screen-level layout tokens ──────────────────────────────────────────────
export const screen = {
  sectionGap: 20,
  cardPad: 14,
  listItemHeight: 72,
} as const;

/** Espaço que o conteúdo rolável precisa reservar embaixo para a nav flutuante nunca cobrir nada. */
export function bottomNavSpace(bottomInset: number): number {
  return maritime.navHeight + maritime.navMarginBottom + Math.max(bottomInset, 8) + spacing.lg;
}
