/**
 * Componentes e páginas do Radar Offshore (HTML do CONTEÚDO). O portal veste com a casca
 * oficial do OWNews (cabeçalho, menu, tema claro/escuro, rodapé) — ver rota /radar-offshore do
 * worker principal. Todo texto vindo de dados passa por esc(). Sem números inventados: valor
 * ausente vira "Informação não disponível na base consultada".
 *
 * Linguagem visual (polimento 2026-10-31): hierarquia por tipografia e espaço, não por caixas.
 * Números grandes; rótulos pequenos em caixa alta; divisores finos; cartão só onde agrega.
 */
import { variacao } from '../lib/texto.mjs';

export const BASE = '/radar-offshore';
export const SEM_DADO = 'Informação não disponível na base consultada.';
export const ATRIB = 'Agência Nacional do Petróleo, Gás Natural e Biocombustíveis (ANP)';
export const VERSAO_CSS = '3';

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const fmt0 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const fmt1 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmt2 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const n0 = (v) => (Number.isFinite(v) ? fmt0.format(v) : '—');

/** Barris/dia legíveis: 4.529.159 → "4,53 milhões de barris/dia"; 162.604 → "162,6 mil barris/dia". */
export function barris(v) {
  if (!Number.isFinite(v)) return null;
  if (v >= 1e6) return `${fmt2.format(v / 1e6)} milhões de barris/dia`;
  if (v >= 1e3) return `${fmt1.format(v / 1e3)} mil barris/dia`;
  return `${fmt0.format(v)} barris/dia`;
}
/** Gás em mil m³/dia: 194.751,6 → "194,8 milhões de m³/dia". */
export function gas(vMil) {
  if (!Number.isFinite(vMil)) return null;
  if (vMil >= 1000) return `${fmt1.format(vMil / 1000)} milhões de m³/dia`;
  return `${fmt0.format(vMil)} mil m³/dia`;
}
/** "4,53 milhões de barris/dia" → { valor: "4,53", unidade: "milhões de barris/dia" } (para destaque). */
export function partes(texto) {
  const m = /^([\d.,]+)\s+(.+)$/.exec(String(texto || ''));
  return m ? { valor: m[1], unidade: m[2] } : { valor: texto || '—', unidade: '' };
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
export const mesCurto = (iso) => { const m = /^(\d{4})-(\d{2})/.exec(String(iso || '')); return m ? `${MES_CURTO[+m[2] - 1]}/${m[1].slice(2)}` : ''; };
export function pct(v) {
  if (!Number.isFinite(v)) return 'n/d';
  return `${v >= 0 ? '+' : ''}${fmt1.format(v)}%`;
}

const link = (href, texto, cls = '') => `<a href="${esc(href)}"${cls ? ` class="${cls}"` : ''}>${esc(texto)}</a>`;

/* Ícones de traço (SVG inline, 24×24, herdam a cor). Técnicos e discretos — sem emoji. */
const IC = {
  mapa: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z"/><path d="M9 4v14M15 6v14"/>',
  plataforma: '<path d="M4 20h16M7 20V10h10v10M9 10V6h6v4M12 6V3"/>',
  sonda: '<path d="M12 3 7 20M12 3l5 17M8.5 14h7M10 9h4M4 20h16"/>',
  campo: '<path d="M4 7c4-3 12-3 16 0v10c-4 3-12 3-16 0Z"/><path d="M4 12c4 3 12 3 16 0"/>',
  operador: '<path d="M4 20V8l8-4 8 4v12M9 20v-6h6v6"/>',
  exploracao: '<circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5M11 8v6M8 11h6"/>',
  futuro: '<path d="M4 18 9 12l4 3 7-9"/><path d="M15 6h5v5"/>',
  ficha: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/>',
  seta: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  busca: '<circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/>',
};
export const icone = (nome, cls = 'ro-ic') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${IC[nome] || ''}</svg>`;

/* ─── Blocos comuns ─── */

export const CSS_LINK = `<link rel="stylesheet" href="${BASE}/static/radar.css?v=${VERSAO_CSS}">`;

/**
 * Abre o contêiner do Radar e o cabeçalho. `meta` = linha discreta de fonte/atualização.
 * Toda página termina com FIM (fecha o contêiner).
 */
export function cabecalho({ kicker = 'Radar Offshore', titulo, sub, meta, migalhas = [] }) {
  const trilha = migalhas.length ? `<nav class="ro-trilha" aria-label="Você está em">${[['Radar Offshore', BASE], ...migalhas].map(([t, h], i, a) => (i < a.length - 1 && h ? link(h, t) : `<span aria-current="page">${esc(t)}</span>`)).join('<span aria-hidden="true">/</span>')}</nav>` : '';
  return `${CSS_LINK}<div class="radar-ro">${trilha}<div class="ro-cab">${kicker ? `<p class="ro-kicker">${esc(kicker)}</p>` : ''}<h1>${esc(titulo)}</h1>${sub ? `<p class="ro-sub">${esc(sub)}</p>` : ''}${meta ? `<p class="ro-meta">${meta}</p>` : ''}</div>`;
}
export const FIM = '</div>';

export const SECOES = [
  ['Visão geral', BASE], ['Mapa', `${BASE}/mapa`], ['Unidades', `${BASE}/unidades`], ['Sondas', `${BASE}/sondas`], ['Campos', `${BASE}/campos`],
  ['Operadores', `${BASE}/operadores`], ['Produção', `${BASE}/producao`], ['Exploração', `${BASE}/exploracao`], ['Futuro offshore', `${BASE}/futuro`],
];
/** Abas do Radar: barra única, rolagem horizontal no celular, aba atual sublinhada. */
export function navSecoes(atual) {
  return `<nav class="ro-abas" aria-label="Seções do Radar Offshore"><div class="ro-abas-trilho">${SECOES.map(([t, h]) => (h === atual ? `<a href="${esc(h)}" aria-current="page">${esc(t)}</a>` : link(h, t))).join('')}</div></nav>`;
}

/** Data mais recente de consulta entre as bases usadas. */
export function dataConsulta(meta, ids) {
  const datas = ids.map((id) => meta?.fontes?.[id]?.baixado_em).filter(Boolean).sort();
  return datas.length ? dataBr(datas[datas.length - 1]) : dataBr(meta?.gerado_em);
}
export const linhaMeta = (meta, ids) => `Dados públicos da ANP · atualizado em ${esc(dataConsulta(meta, ids))}`;

/**
 * Fonte e atualização: uma linha (fonte + data), aviso se a ANP falhou, detalhe por base
 * recolhido. Disclaimer curto e link para a metodologia.
 */
export function rodapeFonte(meta, ids, nota) {
  const fontes = ids.map((id) => meta?.fontes?.[id]).filter(Boolean);
  const falhas = fontes.filter((f) => f.status === 'falhou');
  const linhas = fontes.map((f) => {
    const ref = /^\d{4}-\d{2}$/.test(f.referencia || '') && f.nome.includes('mensal') ? ` · dados de ${mesExtenso(f.referencia)}` : '';
    return `<li>${esc(f.nome)} — base consultada em ${dataBr(f.baixado_em)}${esc(ref)}.</li>`;
  });
  return `<footer class="ro-fonte"><p><strong>Fonte:</strong> ${esc(ATRIB)}.${ids.length ? ` Base consultada em ${esc(dataConsulta(meta, ids))}.` : ''}</p>
${falhas.map((f) => `<p class="ro-aviso">${esc(f.nome)}: a ANP não respondeu na última verificação; exibindo a base de ${dataBr(f.baixado_em)}.</p>`).join('')}
${linhas.length ? `<details><summary>Bases consultadas</summary><ul>${linhas.join('')}</ul></details>` : ''}
${nota ? `<p>${esc(nota)}</p>` : ''}<p class="ro-disclaimer">Dados públicos consolidados pelo OWNews a partir de fontes oficiais. Consulte a fonte original para informações regulatórias. ${link(`${BASE}/fontes`, 'Como o Radar funciona')}</p></footer>`;
}

export function vazio(texto = SEM_DADO) { return `<p class="ro-vazio">${esc(texto)}</p>`; }

/** Seção: rótulo discreto + link "ver tudo" opcional. */
export function secao(titulo, corpo, { mais, id, cls = '' } = {}) {
  return `<section class="ro-sec${cls ? ` ${cls}` : ''}"${id ? ` aria-labelledby="${esc(id)}"` : ''}><div class="ro-sec-cab"><h2${id ? ` id="${esc(id)}"` : ''}>${esc(titulo)}</h2>${mais ? `<a class="ro-mais" href="${esc(mais[1])}">${esc(mais[0])}${icone('seta', 'ro-ic-seta')}</a>` : ''}</div>${corpo}</section>`;
}

/** Números em destaque, sem caixas: valor grande + rótulo pequeno, divisores finos. */
export function cartoes(itens) {
  const validos = itens.filter((i) => i && i.valor !== null && i.valor !== undefined && i.valor !== '');
  if (!validos.length) return '';
  return `<div class="ro-numeros">${validos.map((i) => {
    const corpo = `<span class="ro-num-valor">${esc(i.valor)}</span><span class="ro-num-rotulo">${esc(i.rotulo)}</span>${i.nota ? `<span class="ro-num-nota">${esc(i.nota)}</span>` : ''}`;
    return i.href ? `<a class="ro-num" href="${esc(i.href)}">${corpo}</a>` : `<div class="ro-num">${corpo}</div>`;
  }).join('')}</div>`;
}

/** Ficha técnica: pares rótulo/valor em grade. */
export function dados(pares) {
  const linhas = pares.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v === null || v === undefined || v === '' ? `<span class="ro-nd">${esc(SEM_DADO)}</span>` : v}</dd></div>`);
  return `<dl class="ro-ficha">${linhas.join('')}</dl>`;
}

/** Índices de rótulo do eixo: primeiro, último e espaçados — no máximo `max`, sem colar no último. */
export function indicesRotulos(n, max = 5) {
  if (n <= 0) return [];
  if (n <= max) return [...Array(n).keys()];
  const passo = Math.ceil((n - 1) / (max - 1));
  const idx = [];
  for (let i = 0; i < n - 1; i += passo) idx.push(i);
  if (n - 1 - idx[idx.length - 1] < Math.ceil(passo / 2)) idx.pop();
  idx.push(n - 1);
  return idx;
}

/**
 * Gráfico compacto: barras finas em altura fixa (o número é o protagonista). Rótulos do eixo em
 * HTML (não escalam com a largura), no máximo 5. Valores acessíveis numa tabela recolhida.
 */
export function graficoMensal(serie, { campo = 'petroleo_bbl_d', titulo, formatar = barris } = {}) {
  const s = (serie || []).filter((x) => Number.isFinite(x[campo]));
  if (s.length < 2) return '';
  const vals = s.map((x) => x[campo]);
  const max = Math.max(...vals), min = Math.min(...vals);
  const piso = Math.max(0, min - (max - min) * 0.6); // mostra a tendência sem exagerar a variação
  const n = s.length, L = 100 / n;
  const barrasSvg = s.map((x, i) => {
    const h = Math.max(4, ((x[campo] - piso) / (max - piso || 1)) * 100);
    return `<rect x="${(i * L + L * 0.2).toFixed(2)}" y="${(100 - h).toFixed(2)}" width="${(L * 0.6).toFixed(2)}" height="${h.toFixed(2)}"${i === n - 1 ? ' class="ro-barra-atual"' : ''}><title>${esc(mesCurto(x.mes))}: ${esc(formatar(x[campo]))}</title></rect>`;
  }).join('');
  const rot = new Set(indicesRotulos(n, 5));
  const eixo = s.map((x, i) => `<span>${rot.has(i) ? esc(mesCurto(x.mes)) : ''}</span>`).join('');
  return `<figure class="ro-grafico"><figcaption>${esc(titulo)}</figcaption><svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="${esc(titulo)}">${barrasSvg}</svg><div class="ro-eixo" style="--n:${n}" aria-hidden="true">${eixo}</div>
<details><summary>Valores mês a mês</summary><table class="ro-tabela"><tbody>${s.map((x) => `<tr><td>${esc(mesExtenso(x.mes))}</td><td>${esc(formatar(x[campo]))}</td></tr>`).join('')}</tbody></table></details></figure>`;
}

/** Variação do último mês contra o anterior (função testada `variacao`); null sem dois meses. */
export function variacaoMensal(serie, campo = 'petroleo_bbl_d') {
  const s = (serie || []).filter((x) => Number.isFinite(x[campo]));
  if (s.length < 2) return null;
  const [ant, atu] = s.slice(-2);
  const v = variacao(atu[campo], ant[campo]);
  return v ? { ...v, mes_anterior: ant.mes } : null;
}
export function textoVariacao(v) {
  if (!v || v.percentual === null) return '';
  const sobe = v.percentual >= 0;
  return `<span class="ro-var ${sobe ? 'ro-var-sobe' : 'ro-var-desce'}"><span aria-hidden="true">${sobe ? '▲' : '▼'}</span> ${esc(pct(v.percentual).replace('+', ''))} sobre ${esc(mesCurto(v.mes_anterior))}</span>`;
}

/** Notícias no padrão editorial do OWNews: título forte, data discreta, divisores finos. */
export function listaNoticias(itens, titulo, vaziaTexto) {
  if (!itens || !itens.length) return vaziaTexto ? secao(titulo, vazio(vaziaTexto)) : '';
  return secao(titulo, `<ul class="ro-noticias">${itens.map((n) => `<li><a href="/noticia?id=${encodeURIComponent(n.id)}"><span class="ro-noticia-titulo">${esc(n.titulo)}</span><time datetime="${esc(n.data)}">${esc(dataBr(n.data))}</time></a></li>`).join('')}</ul>`);
}

/** Linha de unidade: nome, tipo, operador · sigla. Detalhes ficam na ficha. */
export function linhaUnidade(u, opsPorId) {
  const op = u.categoria === 'sonda' ? opsPorId.get(u.operador_sonda) : opsPorId.get(u.operador);
  const tipo = u.tipo || (u.categoria === 'sonda' ? 'Sonda' : 'Unidade de produção');
  return `<li class="ro-item" data-tipo="${esc(tipo)}" data-op="${esc(op ? op.nome : '')}" data-bacia="${esc(u.bacia || '')}" data-busca="${esc(`${u.nome} ${u.sigla} ${tipo} ${op ? op.nome : ''} ${(u.campos || []).map((c) => c.nome).join(' ')}`.toLowerCase())}">
<a href="${BASE}/unidades/${esc(u.slug)}"><span class="ro-item-txt"><strong>${esc(u.nome)}</strong><span class="ro-item-tipo">${esc(tipo)}</span><span class="ro-item-meta">${esc([op && op.nome, u.sigla].filter(Boolean).join(' · '))}</span></span>${icone('seta', 'ro-ic-seta')}</a></li>`;
}

/** Linha genérica (campos, operadores, exploração): título + uma linha de contexto. */
export function linhaSimples(href, titulo, meta, attrs = '') {
  return `<li class="ro-item"${attrs}><a href="${esc(href)}"><span class="ro-item-txt"><strong>${esc(titulo)}</strong>${meta ? `<span class="ro-item-meta">${esc(meta)}</span>` : ''}</span>${icone('seta', 'ro-ic-seta')}</a></li>`;
}

/** Busca forte + filtros só com dados reais (só aparecem se houver mais de uma opção). */
export function filtros(itens, campos) {
  const grupos = campos.map(([chave, rotulo]) => {
    const opcoes = [...new Set(itens.map((i) => i[chave]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    if (opcoes.length < 2) return '';
    return `<label><span>${esc(rotulo)}</span><select data-filtro="${esc(chave)}"><option value="">Todos</option>${opcoes.map((o) => `<option>${esc(o)}</option>`).join('')}</select></label>`;
  }).join('');
  return `<div class="ro-filtros" role="search"><label class="ro-busca"><span class="ro-sr">Buscar</span>${icone('busca', 'ro-ic-busca')}<input type="search" data-filtro="busca" placeholder="Buscar por nome, sigla ou campo" autocomplete="off"></label>${grupos ? `<div class="ro-selects">${grupos}</div>` : ''}<p class="ro-contagem" aria-live="polite"></p></div><script src="${BASE}/static/filtros.js?v=${VERSAO_CSS}" defer></script>`;
}

/**
 * Carta do hub: SÓ dados reais — cada ponto é uma unidade com coordenada oficial da ANP, sobre
 * uma grade de latitude/longitude. Sem contorno de costa desenhado (não há dado para isso aqui).
 */
export function cartaUnidades(unidades) {
  const pts = (unidades || []).filter((u) => Number.isFinite(u.lat) && Number.isFinite(u.lon));
  if (pts.length < 3) return '';
  const lon0 = -50, lon1 = -32, lat0 = -28, lat1 = -1;
  const W = 360, H = 300;
  const x = (lon) => ((lon - lon0) / (lon1 - lon0)) * W;
  const y = (lat) => ((lat1 - lat) / (lat1 - lat0)) * H;
  const grade = [];
  for (let la = -25; la <= -5; la += 5) grade.push(`<line x1="0" x2="${W}" y1="${y(la).toFixed(1)}" y2="${y(la).toFixed(1)}"/><text x="4" y="${(y(la) - 4).toFixed(1)}">${-la}°S</text>`);
  for (let lo = -45; lo <= -35; lo += 5) grade.push(`<line y1="0" y2="${H}" x1="${x(lo).toFixed(1)}" x2="${x(lo).toFixed(1)}"/><text x="${(x(lo) + 4).toFixed(1)}" y="${H - 6}">${-lo}°W</text>`);
  const pontos = pts.map((u) => `<circle cx="${x(u.lon).toFixed(1)}" cy="${y(u.lat).toFixed(1)}" r="2.6"/>`).join('');
  return `<svg class="ro-carta" viewBox="0 0 ${W} ${H}" role="img" aria-label="${pts.length} unidades de produção com coordenadas oficiais da ANP"><g class="ro-carta-grade">${grade.join('')}</g><g class="ro-carta-pontos">${pontos}</g></svg>`;
}
