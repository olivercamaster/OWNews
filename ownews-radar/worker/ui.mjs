/**
 * Componentes e páginas do Radar Offshore (HTML do CONTEÚDO). O portal veste com a casca
 * oficial do OWNews (cabeçalho, menu, tema claro/escuro, rodapé) — ver rota /radar-offshore do
 * worker principal. Todo texto vindo de dados passa por esc(). Sem números inventados: valor
 * ausente vira "Informação não disponível na base consultada".
 */
export const BASE = '/radar-offshore';
export const SEM_DADO = 'Informação não disponível na base consultada.';
export const ATRIB = 'Agência Nacional do Petróleo, Gás Natural e Biocombustíveis (ANP)';

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const fmt0 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const fmt1 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmt2 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const n0 = (v) => (Number.isFinite(v) ? fmt0.format(v) : '—');

/** Barris/dia legíveis: 4.529.159 → "4,53 milhões"; 162.604 → "162,6 mil"; 950 → "950". */
export function barris(v) {
  if (!Number.isFinite(v)) return null;
  if (v >= 1e6) return `${fmt2.format(v / 1e6)} milhões de barris/dia`;
  if (v >= 1e3) return `${fmt1.format(v / 1e3)} mil barris/dia`;
  return `${fmt0.format(v)} barris/dia`;
}
/** Gás em mil m³/dia: 194.751,6 → "194,8 milhões de m³/dia"; 6.278,5 → "6,3 milhões de m³/dia". */
export function gas(vMil) {
  if (!Number.isFinite(vMil)) return null;
  if (vMil >= 1000) return `${fmt1.format(vMil / 1000)} milhões de m³/dia`;
  return `${fmt0.format(vMil)} mil m³/dia`;
}
export function reais(v) {
  if (!Number.isFinite(v)) return null;
  if (v >= 1e9) return `R$ ${fmt1.format(v / 1e9)} bilhões`;
  if (v >= 1e6) return `R$ ${fmt1.format(v / 1e6)} milhões`;
  return `R$ ${fmt0.format(v)}`;
}
export function dataBr(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const MES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export function mesExtenso(iso) { const m = /^(\d{4})-(\d{2})/.exec(String(iso || '')); return m ? `${MESES[+m[2] - 1]} de ${m[1]}` : ''; }
const mesCurto = (iso) => { const m = /^(\d{4})-(\d{2})/.exec(String(iso || '')); return m ? `${MES_CURTO[+m[2] - 1]}/${m[1].slice(2)}` : ''; };
export function pct(v) {
  if (!Number.isFinite(v)) return 'n/d';
  return `${v >= 0 ? '+' : ''}${fmt1.format(v)}%`;
}

const link = (href, texto, cls = '') => `<a href="${esc(href)}"${cls ? ` class="${cls}"` : ''}>${esc(texto)}</a>`;

/* ─── Blocos comuns ─── */

export const CSS_LINK = `<link rel="stylesheet" href="${BASE}/static/radar.css?v=2">`;

export function cabecalho({ kicker = 'Radar Offshore', titulo, sub, migalhas = [] }) {
  const trilha = [['Radar Offshore', BASE], ...migalhas];
  return `${CSS_LINK}<nav class="ro-trilha" aria-label="Você está em">${trilha.map(([t, h], i) => (i < trilha.length - 1 && h ? link(h, t) : `<span aria-current="page">${esc(t)}</span>`)).join('<span aria-hidden="true">›</span>')}</nav>
<div class="ro-cab"><p class="ro-kicker">${esc(kicker)}</p><h1>${esc(titulo)}</h1>${sub ? `<p class="ro-sub">${esc(sub)}</p>` : ''}</div>`;
}

export const SECOES = [
  ['Unidades', `${BASE}/unidades`], ['Sondas', `${BASE}/sondas`], ['Campos', `${BASE}/campos`], ['Operadores', `${BASE}/operadores`],
  ['Produção', `${BASE}/producao`], ['Exploração', `${BASE}/exploracao`], ['Futuro offshore', `${BASE}/futuro`], ['Mapa', `${BASE}/mapa`],
];
export function navSecoes(atual) {
  return `<nav class="ro-secoes" aria-label="Seções do Radar Offshore">${SECOES.map(([t, h]) => (h === atual ? `<span aria-current="page">${esc(t)}</span>` : link(h, t))).join('')}</nav>`;
}

/**
 * Rodapé de fonte e atualização (honestidade de freshness): para cada base usada, a data em
 * que o OWNews consultou a ANP e, quando é dado mensal, o mês a que os números se referem.
 */
export function rodapeFonte(meta, ids, nota) {
  const linhas = ids.map((id) => meta?.fontes?.[id]).filter(Boolean).map((f) => {
    const ref = /^\d{4}-\d{2}$/.test(f.referencia || '') && f.nome.includes('mensal') ? ` · dados de ${mesExtenso(f.referencia)}` : '';
    const falhou = f.status === 'falhou' ? ` <strong class="ro-aviso">A ANP não respondeu na última verificação; exibindo a base de ${dataBr(f.baixado_em)}.</strong>` : '';
    return `<li>${esc(f.nome)} — base consultada em ${dataBr(f.baixado_em)}${esc(ref)}.${falhou}</li>`;
  });
  return `<footer class="ro-fonte"><p><strong>Fonte:</strong> ${esc(ATRIB)}.</p>${linhas.length ? `<ul>${linhas.join('')}</ul>` : ''}${nota ? `<p>${esc(nota)}</p>` : ''}<p class="ro-disclaimer">Dados públicos consolidados pelo OWNews a partir de fontes oficiais. Consulte a fonte original para informações regulatórias. ${link(`${BASE}/fontes`, 'Como o Radar funciona')}</p></footer>`;
}

export function vazio(texto = SEM_DADO) { return `<p class="ro-vazio">${esc(texto)}</p>`; }

export function cartoes(itens) {
  const validos = itens.filter((i) => i && i.valor !== null && i.valor !== undefined && i.valor !== '');
  return `<div class="ro-cartoes">${validos.map((i) => `<${i.href ? `a href="${esc(i.href)}"` : 'div'} class="ro-cartao"><span class="ro-cartao-valor">${esc(i.valor)}</span><span class="ro-cartao-rotulo">${esc(i.rotulo)}</span>${i.nota ? `<span class="ro-cartao-nota">${esc(i.nota)}</span>` : ''}</${i.href ? 'a' : 'div'}>`).join('')}</div>`;
}

export function dados(pares) {
  const linhas = pares.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v === null || v === undefined || v === '' ? `<span class="ro-nd">${esc(SEM_DADO)}</span>` : v}</dd></div>`);
  return `<dl class="ro-dados">${linhas.join('')}</dl>`;
}

/** Barras verticais em SVG (12 meses). Acessível: título + tabela recolhível com os valores. */
export function graficoMensal(serie, { campo = 'petroleo_bbl_d', titulo, formatar = barris } = {}) {
  const s = (serie || []).filter((x) => Number.isFinite(x[campo]));
  if (s.length < 2) return '';
  const max = Math.max(...s.map((x) => x[campo])) || 1;
  const L = 320, A = 120, larg = L / s.length;
  const barrasSvg = s.map((x, i) => {
    const h = Math.max(1, Math.round((x[campo] / max) * (A - 18)));
    return `<rect x="${(i * larg + larg * 0.15).toFixed(1)}" y="${A - 14 - h}" width="${(larg * 0.7).toFixed(1)}" height="${h}" rx="1.5"><title>${esc(mesCurto(x.mes))}: ${esc(formatar(x[campo]))}</title></rect>`;
  }).join('');
  const rotulos = s.map((x, i) => (i % Math.ceil(s.length / 6) === 0 || i === s.length - 1 ? `<text x="${(i * larg + larg / 2).toFixed(1)}" y="${A - 2}" text-anchor="middle">${esc(mesCurto(x.mes))}</text>` : '')).join('');
  return `<figure class="ro-grafico"><figcaption>${esc(titulo)}</figcaption><svg viewBox="0 0 ${L} ${A}" role="img" aria-label="${esc(titulo)}">${barrasSvg}${rotulos}</svg>
<details><summary>Ver valores mês a mês</summary><table class="ro-tabela"><thead><tr><th scope="col">Mês</th><th scope="col">Valor</th></tr></thead><tbody>${s.map((x) => `<tr><td>${esc(mesExtenso(x.mes))}</td><td>${esc(formatar(x[campo]))}</td></tr>`).join('')}</tbody></table></details></figure>`;
}

export function listaNoticias(itens, titulo, vaziaTexto) {
  if (!itens || !itens.length) return vaziaTexto ? `<section class="ro-bloco"><h2>${esc(titulo)}</h2>${vazio(vaziaTexto)}</section>` : '';
  return `<section class="ro-bloco"><h2>${esc(titulo)}</h2><ul class="ro-noticias">${itens.map((n) => `<li><a href="/noticia?id=${encodeURIComponent(n.id)}">${esc(n.titulo)}</a><time datetime="${esc(n.data)}">${esc(dataBr(n.data))}</time></li>`).join('')}</ul></section>`;
}

/** Linha de lista de unidade (usada em listas, campos e operadores). */
export function linhaUnidade(u, opsPorId) {
  const op = u.categoria === 'sonda' ? opsPorId.get(u.operador_sonda) : opsPorId.get(u.operador);
  const tipo = u.tipo || (u.categoria === 'sonda' ? 'Sonda' : 'Unidade de produção');
  return `<li class="ro-item" data-tipo="${esc(tipo)}" data-op="${esc(op ? op.nome : '')}" data-bacia="${esc(u.bacia || '')}" data-busca="${esc(`${u.nome} ${u.sigla} ${tipo} ${op ? op.nome : ''} ${(u.campos || []).map((c) => c.nome).join(' ')}`.toLowerCase())}">
<a href="${BASE}/unidades/${esc(u.slug)}"><strong>${esc(u.nome)}</strong><span>${esc(tipo)}${op ? ` · ${esc(op.nome)}` : ''}${u.bacia ? ` · ${esc(u.bacia)}` : ''}</span></a></li>`;
}

/** Filtros por dados reais da lista (só aparecem se houver mais de uma opção). */
export function filtros(itens, campos) {
  const grupos = campos.map(([chave, rotulo]) => {
    const opcoes = [...new Set(itens.map((i) => i[chave]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    if (opcoes.length < 2) return '';
    return `<label>${esc(rotulo)}<select data-filtro="${esc(chave)}"><option value="">Todos</option>${opcoes.map((o) => `<option>${esc(o)}</option>`).join('')}</select></label>`;
  }).join('');
  return `<div class="ro-filtros" role="search"><label class="ro-busca">Buscar<input type="search" data-filtro="busca" placeholder="Nome, sigla, campo…" autocomplete="off"></label>${grupos}<p class="ro-contagem" aria-live="polite"></p></div><script src="${BASE}/static/filtros.js?v=1" defer></script>`;
}
