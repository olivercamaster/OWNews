/**
 * Minha Função — a função (ou a função de interesse) da pessoa no offshore.
 *
 * Regras:
 *  - Opcional, local (fora do sync, do analytics e dos logs). O catálogo é público (Carreiras do
 *    OWNews, /api/buddy/funcoes) e igual para todos; o match acontece no aparelho.
 *  - Personalização = prioridade, nunca filtro: nada daqui esconde vaga ou notícia geral.
 *  - "Quero embarcar" NÃO é exercer a função: o texto e as sugestões mudam ("para começar").
 *  - Função escrita à mão (não encontrada no catálogo) é guardada à parte e não vira id confiável.
 *  - Alertas são um consentimento separado (informar a função não liga nada).
 *  - Matching determinístico e explicável; nada de "a palavra deck apareceu no texto".
 *
 * Sem storage, sem rede, sem relógio implícito.
 */

export type SituacaoFuncao = 'trabalho' | 'quero_embarcar';

export interface MinhaFuncao {
  v: 1;
  situacao: SituacaoFuncao;
  /** Área (id do catálogo). Em "quero embarcar", é a área de interesse. */
  area: string | null;
  /** Função do catálogo (slug + nome exibido). Em "quero embarcar", é a função de interesse. */
  funcao: { slug: string; nome: string } | null;
  /** "Não encontrei minha função": texto da pessoa, nunca tratado como função do catálogo. */
  texto_livre: string | null;
  /** Consentimento separado para avisos relacionados à função. */
  alertas: boolean;
  definida_em: string;
}

export interface AreaCatalogo { id: string; nome: string; categorias_vaga: string[] }
export interface FuncaoCatalogo { slug: string; nome: string; area: string; termos: string[]; relacionadas: string[]; entrada: boolean; url: string }
export interface CatalogoFuncoes { versao: 1; areas: AreaCatalogo[]; funcoes: FuncaoCatalogo[] }

const txt = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '');
const SLUG = /^[a-z0-9-]{1,60}$/;

/** Lê o que está guardado; qualquer coisa fora do formato vira null (nunca derruba a tela). */
export function lerMinhaFuncao(raw: unknown): MinhaFuncao | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const situacao: SituacaoFuncao = o.situacao === 'quero_embarcar' ? 'quero_embarcar' : 'trabalho';
  const area = typeof o.area === 'string' && SLUG.test(o.area) ? o.area : null;
  const f = o.funcao && typeof o.funcao === 'object' ? (o.funcao as Record<string, unknown>) : null;
  const funcao = f && typeof f.slug === 'string' && SLUG.test(f.slug) && txt(f.nome, 80) ? { slug: f.slug, nome: txt(f.nome, 80) } : null;
  const texto_livre = txt(o.texto_livre, 80) || null;
  if (situacao === 'trabalho' && !area && !funcao && !texto_livre) return null;
  return { v: 1, situacao, area, funcao, texto_livre, alertas: o.alertas === true, definida_em: txt(o.definida_em, 40) || '' };
}

/** Lê o catálogo baixado do OWNews; entradas fora do formato são descartadas. */
export function lerCatalogoFuncoes(raw: unknown): CatalogoFuncoes | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const areas = (Array.isArray(o.areas) ? o.areas : []).map((a) => {
    const x = (a ?? {}) as Record<string, unknown>;
    return typeof x.id === 'string' && SLUG.test(x.id) && txt(x.nome, 60)
      ? { id: x.id, nome: txt(x.nome, 60), categorias_vaga: Array.isArray(x.categorias_vaga) ? x.categorias_vaga.filter((c): c is string => typeof c === 'string') : [] }
      : null;
  }).filter((a): a is AreaCatalogo => a !== null);
  const funcoes = (Array.isArray(o.funcoes) ? o.funcoes : []).map((f) => {
    const x = (f ?? {}) as Record<string, unknown>;
    if (typeof x.slug !== 'string' || !SLUG.test(x.slug) || !txt(x.nome, 80) || typeof x.area !== 'string') return null;
    return {
      slug: x.slug, nome: txt(x.nome, 80), area: x.area,
      termos: (Array.isArray(x.termos) ? x.termos : []).map((t) => txt(t, 80)).filter(Boolean),
      relacionadas: (Array.isArray(x.relacionadas) ? x.relacionadas : []).filter((s): s is string => typeof s === 'string' && SLUG.test(s)),
      entrada: x.entrada === true,
      url: typeof x.url === 'string' && x.url.startsWith('https://ownews.com.br/') ? x.url : `https://ownews.com.br/funcoes/${x.slug}`,
    };
  }).filter((f): f is FuncaoCatalogo => f !== null);
  return areas.length && funcoes.length ? { versao: 1, areas, funcoes } : null;
}

/** Monta o registro a partir do que a pessoa escolheu. Sem área, função nem texto (trabalho) → null. */
export function definirMinhaFuncao(
  e: { situacao: SituacaoFuncao; area?: string | null; funcao?: FuncaoCatalogo | null; texto_livre?: string | null; alertas?: boolean },
  agoraISO: string,
): MinhaFuncao | null {
  const funcao = e.funcao ? { slug: e.funcao.slug, nome: e.funcao.nome } : null;
  return lerMinhaFuncao({
    situacao: e.situacao, area: e.funcao ? e.funcao.area : e.area ?? null, funcao,
    texto_livre: funcao ? null : e.texto_livre ?? null, alertas: !!e.alertas, definida_em: agoraISO,
  });
}

/* ─── Busca (autocomplete) ─── */
/** Normaliza para comparar: minúsculas, sem acento, sem marcação de gênero "(a)", "a(o)", "o(a)". */
export function normalizarCargo(s: string): string {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/([a-z])a\s*\(o\)/g, '$1o').replace(/([a-z])o\s*\(a\)/g, '$1o').replace(/([a-z])\s*\(a\)/g, '$1').replace(/\(o\)/g, '')
    .replace(/\b(\w+)a\/o\b/g, '$1o').replace(/[^a-z0-9]+/g, ' ').trim();
}
const contemFrase = (texto: string, frase: string) => frase.length >= 2 && (' ' + texto + ' ').includes(' ' + frase + ' ');

/** Funções do catálogo que casam com o que foi digitado (nome ou apelido); área opcional filtra. */
export function buscarFuncoes(cat: CatalogoFuncoes | null, consulta: string, area?: string | null, max = 8): FuncaoCatalogo[] {
  if (!cat) return [];
  const q = normalizarCargo(consulta);
  const base = cat.funcoes.filter((f) => !area || f.area === area);
  if (!q) return area ? base.slice(0, max) : [];
  const pontos = (f: FuncaoCatalogo) => {
    let best = 0;
    for (const t of f.termos) {
      const n = normalizarCargo(t);
      if (n === q) best = Math.max(best, 3);
      else if (n.startsWith(q) || n.split(' ').some((w) => w.startsWith(q))) best = Math.max(best, 2);
      else if (n.includes(q)) best = Math.max(best, 1);
    }
    return best;
  };
  return base.map((f) => ({ f, p: pontos(f) })).filter((x) => x.p > 0).sort((a, b) => b.p - a.p || a.f.nome.localeCompare(b.f.nome, 'pt-BR')).slice(0, max).map((x) => x.f);
}

/* ─── Vagas ─── */
export type NivelMatch = 'exata' | 'relacionada' | 'area' | 'entrada';
export interface VagaMatch { nivel: NivelMatch; motivo: string }
export interface VagaParaMatch { id: string; titulo: string; categoria?: string | null }

/** Função do catálogo que o título da vaga nomeia (o termo mais longo vence: "Assistant Driller" ≠ "Driller"). */
export function funcaoDoTitulo(cat: CatalogoFuncoes, titulo: string): FuncaoCatalogo | null {
  const t = normalizarCargo(titulo);
  let melhor: FuncaoCatalogo | null = null, tam = 0;
  for (const f of cat.funcoes) for (const termo of f.termos) {
    const n = normalizarCargo(termo);
    if (n.length > tam && contemFrase(t, n)) { melhor = f; tam = n.length; }
  }
  return melhor;
}

const ENTRADA_TITULO = /\b(estagiari[oa]s?|estagio|trainee|aprendiz|jovem aprendiz)\b/;

/**
 * Por que uma vaga é relevante para esta pessoa (ou null). Só dados estruturados do catálogo +
 * categoria da vaga; título só é usado para reconhecer o NOME de uma função conhecida.
 */
export function classificarVaga(v: VagaParaMatch, mf: MinhaFuncao | null, cat: CatalogoFuncoes | null): VagaMatch | null {
  if (!mf || !cat) return null;
  const funcaoVaga = funcaoDoTitulo(cat, v.titulo);
  const minha = mf.funcao ? cat.funcoes.find((f) => f.slug === mf.funcao!.slug) ?? null : null;
  const area = minha?.area ?? mf.area;
  const areaNome = cat.areas.find((a) => a.id === area)?.nome ?? null;
  const naArea = !!area && ((funcaoVaga && funcaoVaga.area === area) || (!!v.categoria && (cat.areas.find((a) => a.id === area)?.categorias_vaga ?? []).includes(v.categoria)));
  if (mf.situacao === 'quero_embarcar') {
    // Quem ainda não embarca: vaga de entrada (função porta de entrada ou estágio/trainee), na área de interesse se houver.
    const ehEntrada = (funcaoVaga?.entrada ?? false) || ENTRADA_TITULO.test(normalizarCargo(v.titulo));
    if (ehEntrada && (!area || naArea)) return { nivel: 'entrada', motivo: areaNome ? `Para começar em ${areaNome}` : 'Para começar no offshore' };
    if (minha && funcaoVaga?.slug === minha.slug) return { nivel: 'relacionada', motivo: 'Função que você quer' };
    return null;
  }
  if (minha && funcaoVaga) {
    if (funcaoVaga.slug === minha.slug) return { nivel: 'exata', motivo: 'Sua função' };
    if (minha.relacionadas.includes(funcaoVaga.slug)) return { nivel: 'relacionada', motivo: 'Função relacionada' };
  }
  if (naArea && areaNome) return { nivel: 'area', motivo: `Sua área: ${areaNome}` };
  return null;
}

const PESO: Record<NivelMatch, number> = { exata: 0, entrada: 1, relacionada: 2, area: 3 };
/**
 * Separa as vagas para a tela: "para você" (exata, relacionada, entrada) e "na sua área". As
 * demais seguem em "Todas" — nada é escondido. Ordem original preservada dentro de cada nível.
 */
export function vagasParaFuncao<T extends VagaParaMatch>(vagas: readonly T[], mf: MinhaFuncao | null, cat: CatalogoFuncoes | null) {
  const com = vagas.map((v, i) => ({ v, i, m: classificarVaga(v, mf, cat) })).filter((x) => x.m);
  com.sort((a, b) => PESO[a.m!.nivel] - PESO[b.m!.nivel] || a.i - b.i);
  return {
    paraVoce: com.filter((x) => x.m!.nivel !== 'area').map((x) => ({ vaga: x.v, match: x.m! })),
    naArea: com.filter((x) => x.m!.nivel === 'area').map((x) => ({ vaga: x.v, match: x.m! })),
  };
}

/** Vagas "para você" que a pessoa ainda não viu (aviso no app; push remoto ainda não existe). */
export function vagasNovasParaFuncao<T extends VagaParaMatch>(vagas: readonly T[], mf: MinhaFuncao | null, cat: CatalogoFuncoes | null, vistas: readonly string[]): T[] {
  const ja = new Set(vistas);
  return vagasParaFuncao(vagas, mf, cat).paraVoce.map((x) => x.vaga).filter((v) => !ja.has(v.id));
}

/* ─── Notícias ─── */
/**
 * Sinal "Relacionado à sua função" numa notícia: só quando o TÍTULO nomeia a função (ou apelido
 * documentado). Não reordena nem filtra o feed — notícia geral importante continua para todos.
 */
export function noticiaRelacionada(titulo: string, mf: MinhaFuncao | null, cat: CatalogoFuncoes | null): boolean {
  if (!mf || !cat || !mf.funcao || mf.situacao !== 'trabalho') return false;
  const f = funcaoDoTitulo(cat, titulo);
  return !!f && f.slug === mf.funcao.slug;
}

/* ─── Conteúdos (OWNews) ─── */
export interface ConteudoFuncao { titulo: string; url: string; tipo: 'carreira' | 'relacionada' | 'guia' }
const OW = 'https://ownews.com.br';
/** Conteúdo REAL do OWNews ligado à função/área (fichas de Carreiras e guias de entrada). */
export function conteudosParaFuncao(mf: MinhaFuncao | null, cat: CatalogoFuncoes | null): ConteudoFuncao[] {
  if (!mf) return [];
  const out: ConteudoFuncao[] = [];
  const minha = mf.funcao && cat ? cat.funcoes.find((f) => f.slug === mf.funcao!.slug) ?? null : null;
  if (mf.situacao === 'quero_embarcar') {
    out.push({ titulo: 'Comece aqui: como trabalhar offshore', url: `${OW}/comece-aqui`, tipo: 'guia' });
    if (minha) out.push({ titulo: `Como é a função: ${minha.nome}`, url: minha.url, tipo: 'carreira' });
    if (cat && mf.area) for (const f of cat.funcoes.filter((x) => x.area === mf.area && x.entrada && x.slug !== minha?.slug)) out.push({ titulo: `Porta de entrada: ${f.nome}`, url: f.url, tipo: 'carreira' });
    out.push({ titulo: 'Cursos offshore: o que é obrigatório', url: `${OW}/guias/cursos-offshore`, tipo: 'guia' });
    out.push({ titulo: 'Erros comuns e golpes de vagas', url: `${OW}/guias/erros-comuns-golpes`, tipo: 'guia' });
    return out;
  }
  if (minha) {
    out.push({ titulo: `Ver carreira: ${minha.nome}`, url: minha.url, tipo: 'carreira' });
    for (const s of minha.relacionadas.slice(0, 4)) {
      const r = cat!.funcoes.find((f) => f.slug === s);
      if (r) out.push({ titulo: r.nome, url: r.url, tipo: 'relacionada' });
    }
  }
  return out;
}

/* ─── Convite (Home) ─── */
export const CONVITE_FUNCAO_PAUSA_DIAS = 30;
/** Convite discreto só para quem não informou função; "Agora não" pausa por 30 dias. */
export function mostrarConviteFuncao(mf: MinhaFuncao | null, dispensadoEmISO: string | null, agoraMs: number): boolean {
  if (mf) return false;
  if (!dispensadoEmISO) return true;
  const t = Date.parse(dispensadoEmISO);
  return !Number.isFinite(t) || agoraMs - t >= CONVITE_FUNCAO_PAUSA_DIAS * 86400000;
}

/** Texto curto de quem é a pessoa, para a tela e a Home. */
export function rotuloMinhaFuncao(mf: MinhaFuncao | null, cat: CatalogoFuncoes | null): string | null {
  if (!mf) return null;
  const area = mf.area ? cat?.areas.find((a) => a.id === mf.area)?.nome ?? null : null;
  if (mf.situacao === 'quero_embarcar') return mf.funcao ? `Quero embarcar · ${mf.funcao.nome}` : area ? `Quero embarcar · ${area}` : 'Quero embarcar';
  return mf.funcao?.nome ?? mf.texto_livre ?? area;
}
