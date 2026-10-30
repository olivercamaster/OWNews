/**
 * Home personalizável ("Meu Buddy") — schema versionado, presets e normalização.
 *
 * Princípios:
 *  - Só LAYOUT: ordem, visibilidade e tamanho de módulos + saudação/frase/clima.
 *    Nada aqui desliga acontecimentos (Buddy Agora) ou lembretes — são coisas separadas.
 *  - Protegidos: saudação/topo, acesso à personalização e a barra inferior não são módulos;
 *    o card da escala ('momento') pode ser NORMAL ou COMPACTO, nunca oculto.
 *  - Tamanhos só por presets (COMPACTO/NORMAL/DESTAQUE) — nada de grid livre.
 *  - Tudo grátis no 1.0. `plano` existe para o Buddy+ futuro, mas nenhum módulo usa 'plus'.
 */
import type { EstiloSaudacao } from './saudacoes';

export type ModuloHome =
  | 'momento' | 'proximos'
  | 'escala' | 'embarque' | 'viagem' | 'certs'
  | 'vagas' | 'unidades' | 'noticias' | 'aeroportos' | 'ferramentas';

export type TamanhoModulo = 'COMPACTO' | 'NORMAL' | 'DESTAQUE';
export type GrupoModulo = 'topo' | 'pessoal' | 'proximos' | 'offshore' | 'atalhos';

export interface DefModulo {
  id: ModuloHome;
  label: string;
  grupo: GrupoModulo;
  tamanhos: TamanhoModulo[];
  padrao: TamanhoModulo;
  podeOcultar: boolean;
  /** Preparação Buddy+: no 1.0 tudo é 'free'. */
  plano: 'free' | 'plus';
}

export const MODULOS_HOME: DefModulo[] = [
  { id: 'momento',     label: 'Momento da escala', grupo: 'topo',     tamanhos: ['NORMAL', 'COMPACTO'],             padrao: 'NORMAL', podeOcultar: false, plano: 'free' },
  { id: 'escala',      label: 'Minha Escala',      grupo: 'pessoal',  tamanhos: ['NORMAL', 'COMPACTO'],             padrao: 'NORMAL', podeOcultar: true,  plano: 'free' },
  { id: 'embarque',    label: 'Minha Mala',        grupo: 'pessoal',  tamanhos: ['NORMAL', 'COMPACTO'],             padrao: 'NORMAL', podeOcultar: true,  plano: 'free' },
  { id: 'viagem',      label: 'Minha Viagem',      grupo: 'pessoal',  tamanhos: ['NORMAL', 'COMPACTO'],             padrao: 'NORMAL', podeOcultar: true,  plano: 'free' },
  { id: 'certs',       label: 'Certificados',      grupo: 'pessoal',  tamanhos: ['NORMAL', 'COMPACTO'],             padrao: 'NORMAL', podeOcultar: true,  plano: 'free' },
  { id: 'proximos',    label: 'Próximos dias',     grupo: 'proximos', tamanhos: ['NORMAL', 'COMPACTO'],             padrao: 'NORMAL', podeOcultar: true,  plano: 'free' },
  { id: 'vagas',       label: 'Vagas',             grupo: 'offshore', tamanhos: ['NORMAL', 'COMPACTO', 'DESTAQUE'], padrao: 'NORMAL', podeOcultar: true,  plano: 'free' },
  { id: 'unidades',    label: 'Unidades',          grupo: 'offshore', tamanhos: ['NORMAL', 'COMPACTO', 'DESTAQUE'], padrao: 'NORMAL', podeOcultar: true,  plano: 'free' },
  { id: 'noticias',    label: 'Notícias',          grupo: 'offshore', tamanhos: ['NORMAL', 'COMPACTO'],             padrao: 'NORMAL', podeOcultar: true,  plano: 'free' },
  { id: 'aeroportos',  label: 'Aeroportos',        grupo: 'offshore', tamanhos: ['NORMAL'],                         padrao: 'NORMAL', podeOcultar: true,  plano: 'free' },
  { id: 'ferramentas', label: 'Atalhos (Preciso de…, Ferramentas, Loja)', grupo: 'atalhos', tamanhos: ['NORMAL'], padrao: 'NORMAL', podeOcultar: true, plano: 'free' },
];

export const DEF_MODULO: Record<ModuloHome, DefModulo> = Object.fromEntries(MODULOS_HOME.map(m => [m.id, m])) as Record<ModuloHome, DefModulo>;

export const ORDEM_PADRAO: ModuloHome[] = MODULOS_HOME.map(m => m.id);

export const LABEL_TAMANHO: Record<TamanhoModulo, string> = { COMPACTO: 'Compacto', NORMAL: 'Normal', DESTAQUE: 'Destaque' };

export type PresetHome = 'EQUILIBRADO' | 'ROTINA' | 'CARREIRA' | 'MINIMALISTA';
export const LABEL_PRESET: Record<PresetHome, string> = {
  EQUILIBRADO: 'Equilibrado', ROTINA: 'Minha rotina', CARREIRA: 'Carreira', MINIMALISTA: 'Minimalista',
};
export const DESCRICAO_PRESET: Record<PresetHome, string> = {
  EQUILIBRADO: 'O layout padrão do OWBuddy.',
  ROTINA: 'Escala, próximos dias, embarque, viagem e certificados.',
  CARREIRA: 'Próximos dias, vagas, certificados, unidades e notícias.',
  MINIMALISTA: 'Escala, próximo acontecimento e Offshore Agora compacto.',
};

export interface PrefsHome {
  v: 1;
  ordem: ModuloHome[];
  ocultos: ModuloHome[];
  tamanhos: Partial<Record<ModuloHome, TamanhoModulo>>;
  estiloSaudacao: EstiloSaudacao;
  fraseDoDia: boolean;
  clima: boolean;
  /** Último preset aplicado (só informativo; o usuário pode editar depois). */
  preset?: PresetHome | null;
  /** Dica "Agora você pode deixar o Buddy do seu jeito" já dispensada. */
  dicaVista: boolean;
}

export const PREFS_HOME_PADRAO: PrefsHome = {
  v: 1,
  ordem: [...ORDEM_PADRAO],
  ocultos: [],
  tamanhos: {},
  estiloSaudacao: 'PARCEIRO',
  fraseDoDia: true,
  clima: true,
  preset: 'EQUILIBRADO',
  dicaVista: false,
};

const ESTILOS: EstiloSaudacao[] = ['PARCEIRO', 'DIRETO', 'MOTIVACIONAL', 'DISCRETO'];

/**
 * Lê qualquer coisa do storage e devolve prefs válidas (migração tolerante):
 *  - sem dado → padrão;
 *  - módulo desconhecido → descartado; módulo NOVO (versões futuras) → entra na posição padrão;
 *  - 'momento' nunca fica oculto; tamanho fora dos presets do módulo → padrão.
 */
export function normalizarPrefsHome(raw: unknown): PrefsHome {
  if (!raw || typeof raw !== 'object') return clonarPadrao();
  const r = raw as Partial<PrefsHome>;
  const validos = new Set<string>(ORDEM_PADRAO);
  const ordem: ModuloHome[] = [];
  for (const m of Array.isArray(r.ordem) ? r.ordem : []) {
    if (validos.has(m) && !ordem.includes(m)) ordem.push(m);
  }
  // Módulos que a versão salva não conhecia: insere logo depois do vizinho anterior da ordem padrão.
  for (const m of ORDEM_PADRAO) {
    if (ordem.includes(m)) continue;
    const idxPadrao = ORDEM_PADRAO.indexOf(m);
    const anterior = ORDEM_PADRAO.slice(0, idxPadrao).reverse().find(x => ordem.includes(x));
    ordem.splice(anterior ? ordem.indexOf(anterior) + 1 : 0, 0, m);
  }
  const ocultos = (Array.isArray(r.ocultos) ? r.ocultos : [])
    .filter((m): m is ModuloHome => validos.has(m) && DEF_MODULO[m as ModuloHome].podeOcultar);
  const tamanhos: PrefsHome['tamanhos'] = {};
  for (const [m, t] of Object.entries(r.tamanhos ?? {})) {
    if (validos.has(m) && DEF_MODULO[m as ModuloHome].tamanhos.includes(t as TamanhoModulo)) {
      tamanhos[m as ModuloHome] = t as TamanhoModulo;
    }
  }
  return {
    v: 1,
    ordem,
    ocultos: [...new Set(ocultos)],
    tamanhos,
    estiloSaudacao: ESTILOS.includes(r.estiloSaudacao as EstiloSaudacao) ? r.estiloSaudacao! : 'PARCEIRO',
    fraseDoDia: r.fraseDoDia !== false,
    clima: r.clima !== false,
    preset: r.preset ?? null,
    dicaVista: r.dicaVista === true,
  };
}

function clonarPadrao(): PrefsHome {
  return { ...PREFS_HOME_PADRAO, ordem: [...ORDEM_PADRAO], ocultos: [], tamanhos: {} };
}

export function tamanhoDe(p: PrefsHome, m: ModuloHome): TamanhoModulo {
  return p.tamanhos[m] ?? DEF_MODULO[m].padrao;
}

/** Módulos visíveis, na ordem do usuário. */
export function modulosVisiveis(p: PrefsHome): ModuloHome[] {
  const ocultos = new Set(p.ocultos);
  return p.ordem.filter(m => !ocultos.has(m));
}

export function moverModulo(p: PrefsHome, de: number, para: number): PrefsHome {
  const ordem = [...p.ordem];
  if (de < 0 || de >= ordem.length) return p;
  const alvo = Math.max(0, Math.min(ordem.length - 1, para));
  const [m] = ordem.splice(de, 1);
  ordem.splice(alvo, 0, m!);
  return { ...p, ordem, preset: null };
}

export function alternarVisibilidade(p: PrefsHome, m: ModuloHome): PrefsHome {
  if (!DEF_MODULO[m].podeOcultar) return p;
  const ocultos = p.ocultos.includes(m) ? p.ocultos.filter(x => x !== m) : [...p.ocultos, m];
  return { ...p, ocultos, preset: null };
}

export function definirTamanho(p: PrefsHome, m: ModuloHome, t: TamanhoModulo): PrefsHome {
  if (!DEF_MODULO[m].tamanhos.includes(t)) return p;
  return { ...p, tamanhos: { ...p.tamanhos, [m]: t }, preset: null };
}

/**
 * Aplica um preset: só ORDEM, VISIBILIDADE e TAMANHOS. Saudação, frase, clima e a dica ficam
 * como o usuário deixou. Os módulos fora do preset ficam ocultos (não apagados), na ordem padrão.
 */
export function aplicarPreset(p: PrefsHome, preset: PresetHome): PrefsHome {
  const def: Record<PresetHome, { visiveis: ModuloHome[]; tamanhos: PrefsHome['tamanhos'] }> = {
    EQUILIBRADO: { visiveis: [...ORDEM_PADRAO], tamanhos: {} },
    ROTINA: { visiveis: ['momento', 'proximos', 'embarque', 'viagem', 'certs', 'escala'], tamanhos: {} },
    CARREIRA: {
      visiveis: ['momento', 'proximos', 'vagas', 'certs', 'unidades', 'noticias'],
      tamanhos: { momento: 'COMPACTO', vagas: 'DESTAQUE' },
    },
    MINIMALISTA: {
      visiveis: ['momento', 'proximos', 'vagas', 'unidades', 'noticias'],
      tamanhos: { proximos: 'COMPACTO', vagas: 'COMPACTO', unidades: 'COMPACTO', noticias: 'COMPACTO' },
    },
  };
  const d = def[preset];
  const resto = ORDEM_PADRAO.filter(m => !d.visiveis.includes(m));
  return {
    ...p,
    ordem: [...d.visiveis, ...resto],
    ocultos: resto.filter(m => DEF_MODULO[m].podeOcultar),
    tamanhos: { ...d.tamanhos },
    preset,
  };
}

/** Restaurar layout padrão: ordem, visibilidade e tamanhos. Saudação/frase/clima preservados. */
export function restaurarLayoutPadrao(p: PrefsHome): PrefsHome {
  return { ...aplicarPreset(p, 'EQUILIBRADO') };
}
