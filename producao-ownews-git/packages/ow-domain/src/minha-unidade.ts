/**
 * Minha Unidade — a unidade onde a pessoa embarca, ligada (opcionalmente) ao catálogo público do
 * Radar Offshore do OWNews.
 *
 * Regras:
 *  - O texto da pessoa manda: dá para salvar qualquer nome, sem internet e sem catálogo.
 *  - Escolher do catálogo guarda uma referência estável (id + slug), preservando o nome exibido.
 *  - Fica só no aparelho (fora do sync e do analytics). Nada aqui muda escala, ciclo ou histórico.
 *  - Associação com o catálogo só por escolha da pessoa (ou sugestão por nome EXATO, que ela aceita).
 *
 * Sem storage, sem rede, sem relógio implícito.
 */

export interface RefRadar {
  /** Id estável do Radar (ex.: "sonda-ns-55", "plat-FPBAR"). */
  id: string;
  slug: string;
}

export interface MinhaUnidade {
  v: 1;
  /** Como a pessoa quer ver o nome (texto livre ou o nome do catálogo). */
  nome: string;
  radar: RefRadar | null;
  definida_em: string;
}

/** Item do catálogo público (pacote do Radar). */
export interface UnidadeCatalogo {
  id: string;
  slug: string;
  nome: string;
  tipo: string | null;
  categoria: 'producao' | 'sonda';
  sigla: string;
  bacia: string | null;
  operador: { id: string; nome: string; slug: string } | null;
  campos: string[];
}

export interface NoticiaRadar { id: string; titulo: string; data: string }

export interface PacoteRadar {
  versao: 1;
  atualizado_em: string | null;
  base_url: string;
  unidades: UnidadeCatalogo[];
  noticias_unidades: Record<string, NoticiaRadar[]>;
  noticias_operadores: Record<string, NoticiaRadar[]>;
}

const txt = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '');
const refValida = (r: unknown): RefRadar | null => {
  if (!r || typeof r !== 'object') return null;
  const o = r as Record<string, unknown>;
  const id = txt(o.id, 80), slug = txt(o.slug, 100);
  return /^[a-z]+-[A-Za-z0-9-]+$/.test(id) && /^[a-z0-9-]+$/.test(slug) ? { id, slug } : null;
};

export function lerMinhaUnidade(raw: unknown): MinhaUnidade | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const nome = txt(r.nome, 80);
  if (r.v !== 1 || !nome) return null;
  return { v: 1, nome, radar: refValida(r.radar), definida_em: txt(r.definida_em, 40) || new Date(0).toISOString() };
}

/** Salva texto livre (radar null) ou a escolha do catálogo. Nome vazio → null (sem unidade). */
export function definirMinhaUnidade(nome: string, radar: RefRadar | null, agoraIso: string): MinhaUnidade | null {
  const n = txt(nome, 80);
  if (!n) return null;
  return { v: 1, nome: n, radar: radar ? refValida(radar) : null, definida_em: agoraIso };
}

/** Chave de comparação: sem acento, maiúscula, só letras e números. */
export function chaveUnidade(s: string): string {
  return String(s ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
}

/** Aliases de digitação comuns e inequívocos: "P-58" ⇄ "Petrobras 58". */
function chavesBusca(u: UnidadeCatalogo): string[] {
  const k = chaveUnidade(u.nome);
  const out = [k, chaveUnidade(u.sigla)];
  const m = /^(?:PETROBRAS|PLATAFORMA) (\d{1,3})$/.exec(k);
  if (m) out.push(`P ${m[1]}`, `P${m[1]}`);
  return out;
}

/**
 * Sugestões enquanto a pessoa digita (2+ letras): começa com > contém. Nunca obriga a escolher.
 */
export function sugerirUnidades(catalogo: UnidadeCatalogo[], texto: string, max = 6): UnidadeCatalogo[] {
  const q = chaveUnidade(texto);
  if (q.length < 2) return [];
  const pontos = (u: UnidadeCatalogo) => {
    const ks = chavesBusca(u);
    if (ks.some((k) => k === q)) return 0;
    if (ks.some((k) => k.startsWith(q))) return 1;
    if (ks.some((k) => k.split(' ').some((p) => p.startsWith(q)))) return 2;
    if (ks.some((k) => k.includes(q))) return 3;
    return 9;
  };
  return catalogo
    .map((u) => ({ u, p: pontos(u) }))
    .filter((x) => x.p < 9)
    .sort((a, b) => a.p - b.p || a.u.nome.localeCompare(b.u.nome, 'pt-BR'))
    .slice(0, max)
    .map((x) => x.u);
}

/**
 * Sugestão de associação para um nome já digitado (ex.: registro antigo do histórico): só quando o
 * nome bate EXATAMENTE com uma única unidade do catálogo. Ambíguo → null. Nunca aplica sozinho.
 */
export function unidadeComNomeExato(catalogo: UnidadeCatalogo[], nome: string | undefined | null): UnidadeCatalogo | null {
  const k = chaveUnidade(nome || '');
  if (!k) return null;
  const achadas = catalogo.filter((u) => chavesBusca(u).includes(k));
  return achadas.length === 1 ? achadas[0]! : null;
}

/** Unidade do catálogo pela referência guardada (id estável; slug só de reserva). */
export function unidadeDaRef(catalogo: UnidadeCatalogo[], ref: RefRadar | null | undefined): UnidadeCatalogo | null {
  if (!ref) return null;
  return catalogo.find((u) => u.id === ref.id) ?? catalogo.find((u) => u.slug === ref.slug) ?? null;
}

export interface ContextoMinhaUnidade {
  nome: string;
  unidade: UnidadeCatalogo | null;
  /** Notícias que citam a unidade (título ou primeira frase) — no máximo 3. */
  noticiasUnidade: NoticiaRadar[];
  /** Notícias da empresa, em lista SEPARADA (não são notícias da unidade). */
  noticiasOperador: NoticiaRadar[];
  /** Notícias da unidade que a pessoa ainda não viu. */
  novas: number;
  url: string | null;
}

export function contextoMinhaUnidade(mu: MinhaUnidade | null, pacote: PacoteRadar | null, vistas: string[] = []): ContextoMinhaUnidade | null {
  if (!mu) return null;
  const u = pacote ? unidadeDaRef(pacote.unidades, mu.radar) : null;
  const nu = u && pacote ? (pacote.noticias_unidades[u.id] || []).slice(0, 3) : [];
  const no = u && u.operador && pacote ? (pacote.noticias_operadores[u.operador.id] || []).filter((n) => !nu.some((x) => x.id === n.id)).slice(0, 3) : [];
  return {
    nome: mu.nome,
    unidade: u,
    noticiasUnidade: nu,
    noticiasOperador: no,
    novas: nu.filter((n) => !vistas.includes(n.id)).length,
    url: u && pacote ? `${pacote.base_url}/unidades/${u.slug}` : null,
  };
}

/**
 * Card da Início: só embarcado, com unidade do catálogo E notícia nova da unidade. Sem valor → null.
 */
export function cardMinhaUnidadeHome(ctx: ContextoMinhaUnidade | null, embarcado: boolean): { nome: string; novas: number } | null {
  if (!ctx || !embarcado || !ctx.unidade || ctx.novas <= 0) return null;
  return { nome: ctx.nome, novas: ctx.novas };
}

/** Pacote vindo da rede: só o que tem forma válida (o resto é descartado, nunca quebra a tela). */
export function lerPacoteRadar(raw: unknown): PacoteRadar | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (r.versao !== 1 || !Array.isArray(r.unidades)) return null;
  const noticias = (o: unknown): Record<string, NoticiaRadar[]> => {
    const out: Record<string, NoticiaRadar[]> = {};
    if (!o || typeof o !== 'object') return out;
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
      if (!Array.isArray(v)) continue;
      out[k] = v.map((n) => ({ id: txt((n as NoticiaRadar)?.id, 60), titulo: txt((n as NoticiaRadar)?.titulo, 200), data: txt((n as NoticiaRadar)?.data, 10) })).filter((n) => n.id && n.titulo);
    }
    return out;
  };
  const unidades: UnidadeCatalogo[] = [];
  for (const x of r.unidades as unknown[]) {
    const u = x as Record<string, unknown>;
    const ref = refValida(u);
    const nome = txt(u?.nome, 80);
    if (!ref || !nome) continue;
    const op = u.operador as Record<string, unknown> | null;
    unidades.push({
      id: ref.id, slug: ref.slug, nome, tipo: txt(u.tipo, 60) || null, categoria: u.categoria === 'sonda' ? 'sonda' : 'producao',
      sigla: txt(u.sigla, 20), bacia: txt(u.bacia, 40) || null,
      operador: op && txt(op.id, 80) && txt(op.nome, 80) ? { id: txt(op.id, 80), nome: txt(op.nome, 80), slug: txt(op.slug, 100) } : null,
      campos: Array.isArray(u.campos) ? (u.campos as unknown[]).map((c) => txt(c, 60)).filter(Boolean) : [],
    });
  }
  const base = txt(r.base_url, 120);
  return {
    versao: 1, atualizado_em: txt(r.atualizado_em, 40) || null,
    base_url: /^https:\/\/ownews\.com\.br\//.test(base) ? base : 'https://ownews.com.br/radar-offshore',
    unidades, noticias_unidades: noticias(r.noticias_unidades), noticias_operadores: noticias(r.noticias_operadores),
  };
}
