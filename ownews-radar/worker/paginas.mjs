/**
 * Páginas do Radar Offshore. Cada uma recebe os dados do KV e devolve
 * { titulo, descricao, html, canonical, jsonLd?, robots?, status }.
 */
import {
  BASE, SEM_DADO, barris, cabecalho, cartoes, dados, dataBr, esc, filtros, gas, graficoMensal, linhaUnidade, listaNoticias,
  mesExtenso, n0, navSecoes, pct, reais, rodapeFonte, vazio,
} from './ui.mjs';

const pagina = (o) => ({ status: 200, ...o });

/* Indexação das fichas (AdSense / conteúdo de baixo valor, 31/10/2026): só entra no índice e no sitemap a
   ficha que tem dado próprio além do cadastro — medido no crawl, as sem isso tinham 36–91 palavras.
   Unidade: produção oficial no último mês. Sonda: não (a ANP só informa sonda × campo; a lista /sondas
   cobre). Campo: produção. Operador: produção + notícias. As demais seguem acessíveis (noindex,follow). */
const temProducao = (p) => !!p && ((p.petroleo_bbl_d || 0) > 0 || (p.gas_mil_m3_d || 0) > 0);
export function fichaIndexavel(tipo, x, noticias) {
  if (!x) return false;
  if (tipo === 'unidade') return x.categoria !== 'sonda' && temProducao(x.producao);
  if (tipo === 'campo') return temProducao(x.producao);
  if (tipo === 'operador') return temProducao(x.producao) && (((noticias || {}).operadores || {})[x.id] || []).length > 0;
  return true;
}
const robotsFicha = (tipo, x, noticias) => (fichaIndexavel(tipo, x, noticias) ? {} : { robots: 'noindex,follow' });
const opsMap = (ops) => new Map((ops || []).map((o) => [o.id, o]));
const linkOp = (o, ops) => { const x = ops.get(o); return x ? `<a href="${BASE}/operadores/${esc(x.slug)}">${esc(x.nome)}</a>` : null; };

/* ─── Hub ─── */
export function hub({ resumo, meta, producao }) {
  const r = resumo || {};
  const p = r.producao;
  const html = `${cabecalho({ titulo: 'Radar Offshore', sub: 'O offshore brasileiro em dados.' })}
<p class="ro-selo">Dados públicos oficiais · Atualização automática</p>
${navSecoes(BASE)}
<section class="ro-bloco" aria-labelledby="agora"><h2 id="agora">Brasil offshore agora</h2>
${cartoes([
    { valor: n0(r.unidades_producao), rotulo: 'unidades de produção em operação', href: `${BASE}/unidades` },
    { valor: n0(r.sondas), rotulo: `sondas com atividade no mar${r.ano_sondas ? ` em ${r.ano_sondas}` : ''}`, href: `${BASE}/sondas` },
    { valor: n0(r.campos_mar), rotulo: 'campos marítimos', nota: Number.isFinite(r.campos_producao) ? `${n0(r.campos_producao)} em produção` : null, href: `${BASE}/campos` },
    { valor: n0(r.operadores_campos), rotulo: 'operadores de campos no mar', href: `${BASE}/operadores` },
    p ? { valor: barris(p.petroleo_bbl_d), rotulo: `petróleo no mar · ${mesExtenso(p.mes)}`, href: `${BASE}/producao` } : null,
    p ? { valor: gas(p.gas_mil_m3_d), rotulo: `gás natural no mar · ${mesExtenso(p.mes)}`, href: `${BASE}/producao` } : null,
    r.exploracao && Number.isFinite(r.exploracao.pads_andamento) ? { valor: n0(r.exploracao.pads_andamento), rotulo: 'planos de avaliação de descoberta em andamento', href: `${BASE}/exploracao` } : null,
  ])}
</section>
${producao && producao.nacional ? graficoMensal(producao.nacional, { titulo: 'Petróleo produzido no mar — últimos 12 meses (barris por dia)' }) : ''}
<section class="ro-bloco ro-atalhos"><h2>Explore</h2><ul>
<li><a href="${BASE}/mapa"><strong>Mapa offshore</strong><span>Unidades, campos e blocos sobre o litoral</span></a></li>
<li><a href="${BASE}/futuro"><strong>Futuro offshore</strong><span>Investimentos e atividades previstos pelas operadoras</span></a></li>
<li><a href="${BASE}/exploracao"><strong>Exploração</strong><span>Poços, descobertas e declarações de comercialidade</span></a></li>
<li><a href="/radar"><strong>Fichas das unidades</strong><span>Fotos e fichas curadas pela redação do OWNews</span></a></li>
</ul></section>
${rodapeFonte(meta, ['plataformas', 'sondas', 'campos', 'producao_mar', 'pads_andamento'])}`;
  return pagina({
    titulo: 'Radar Offshore: o offshore brasileiro em dados', canonical: BASE,
    descricao: 'Unidades, sondas, campos, operadores, produção e exploração no mar brasileiro, a partir de dados públicos oficiais da ANP, com atualização automática.',
    html,
  });
}

/* ─── Unidades / sondas (lista) ─── */
export function listaUnidades({ unidades, operadores, meta }, categoria) {
  const ops = opsMap(operadores);
  const lista = (unidades || []).filter((u) => u.categoria === categoria).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const sonda = categoria === 'sonda';
  const linhas = lista.map((u) => ({ ...u, _op: (ops.get(sonda ? u.operador_sonda : u.operador) || {}).nome, _tipo: u.tipo || (sonda ? 'Sonda' : 'Unidade de produção') }));
  const html = `${cabecalho({ titulo: sonda ? 'Sondas no Brasil' : 'Unidades offshore', sub: sonda ? `Sondas com atividade registrada pela ANP em campos marítimos${lista[0]?.ano_atividade ? ` em ${lista[0].ano_atividade}` : ''}.` : 'Plataformas e navios-plataforma em operação no mar, segundo a ANP.', migalhas: [[sonda ? 'Sondas' : 'Unidades', null]] })}
${navSecoes(sonda ? `${BASE}/sondas` : `${BASE}/unidades`)}
${filtros(linhas.map((u) => ({ tipo: u._tipo, op: u._op, bacia: u.bacia })), sonda ? [['tipo', 'Tipo'], ['op', 'Operador da sonda']] : [['tipo', 'Tipo'], ['op', 'Operador'], ['bacia', 'Bacia']])}
${lista.length ? `<ul class="ro-lista" data-lista>${lista.map((u) => linhaUnidade(u, ops)).join('')}</ul>` : vazio()}
${sonda ? '<p class="ro-nota">A base da ANP informa a sonda, o campo onde atuou e a empresa que opera a sonda. Ela não informa a posição nem a situação contratual: o Radar não afirma nada além disso.</p>' : ''}
${rodapeFonte(meta, sonda ? ['sondas', 'campos'] : ['plataformas'])}`;
  return pagina({
    titulo: sonda ? 'Sondas no Brasil — Radar Offshore' : 'Unidades offshore no Brasil — Radar Offshore',
    canonical: sonda ? `${BASE}/sondas` : `${BASE}/unidades`,
    descricao: sonda ? `${lista.length} sondas com atividade em campos marítimos brasileiros segundo a ANP: nome, tipo, operador da sonda e campos.` : `${lista.length} unidades de produção offshore em operação no Brasil: FPSOs, plataformas fixas e semissubmersíveis, com operador, bacia e campos.`,
    html,
  });
}

/* ─── Unidade ─── */
export function unidade({ u, unidades, campos, operadores, noticias, meta }) {
  const ops = opsMap(operadores);
  const camposPorId = new Map((campos || []).map((c) => [c.id, c]));
  const sonda = u.categoria === 'sonda';
  const opId = sonda ? u.operador_sonda : u.operador;
  const op = ops.get(opId);
  const alias = /^Petrobras (\d{1,3})$/.exec(u.nome);
  const camposHtml = (u.campos || []).map((c) => (c.id && camposPorId.get(c.id) ? `<a href="${BASE}/campos/${esc(camposPorId.get(c.id).slug)}">${esc(c.nome)}</a>` : esc(c.nome))).join(', ');
  const p = u.producao;
  const pares = sonda ? [
    ['Tipo', u.tipo ? esc(u.tipo) : null],
    ['Sigla na ANP', esc(u.sigla)],
    ['Operador da sonda', op ? linkOp(opId, ops) : null],
    ['Campos com atividade registrada', camposHtml || null],
    ['Período', u.ano_atividade ? `Atividade registrada pela ANP em ${esc(u.ano_atividade)}` : null],
    ['Posição', 'A ANP não publica a posição das sondas.'],
  ] : [
    ['Tipo', u.tipo ? esc(u.tipo) : null],
    ['Sigla na ANP', esc(u.sigla)],
    ['Operador', op ? linkOp(opId, ops) : null],
    ['Bacia', u.bacia ? esc(u.bacia) : null],
    ['Campos', camposHtml || null],
    ['Lâmina d’água', Number.isFinite(u.lamina_dagua_m) ? `${n0(u.lamina_dagua_m)} m` : null],
    ['Início de operação', u.inicio_operacao ? esc(u.inicio_operacao) : null],
    ['Escoamento', u.escoamento ? esc(u.escoamento) : null],
    ['Capacidade de petróleo', Number.isFinite(u.capacidade_petroleo_bbl_d) ? esc(barris(u.capacidade_petroleo_bbl_d)) : null],
    ['Capacidade de gás', Number.isFinite(u.capacidade_gas_mil_m3_d) ? esc(gas(u.capacidade_gas_mil_m3_d)) : null],
  ];
  const nUnid = (noticias.unidades || {})[u.id] || [];
  const nOp = opId ? (noticias.operadores || {})[opId] || [] : [];
  const carreira = sonda ? '<a href="/carreiras/sonda-de-perfuracao">Funções comuns em sondas de perfuração</a>' : '<a href="/funcoes">Funções a bordo de unidades de produção</a>';
  const html = `${cabecalho({ kicker: u.tipo || (sonda ? 'Sonda' : 'Unidade offshore'), titulo: u.nome, sub: alias ? `Conhecida no setor como P-${alias[1]}.` : null, migalhas: [[sonda ? 'Sondas' : 'Unidades', sonda ? `${BASE}/sondas` : `${BASE}/unidades`], [u.nome, null]] })}
${u.foto ? `<figure class="ro-foto"><img src="${esc(u.foto.url)}" alt="${esc(u.nome)}" loading="lazy" decoding="async" width="640" height="360"><figcaption>${u.foto.credito ? `Foto: ${esc(u.foto.credito)} · ` : ''}<a href="${esc(u.foto.ficha)}">Ficha da unidade no OWNews</a></figcaption></figure>` : ''}
<section class="ro-bloco"><h2>Dados da unidade</h2>${dados(pares)}</section>
${!sonda ? `<section class="ro-bloco"><h2>Produção</h2>${p ? `${cartoes([{ valor: barris(p.petroleo_bbl_d), rotulo: `petróleo · ${mesExtenso(p.mes)}` }, { valor: gas(p.gas_mil_m3_d), rotulo: `gás natural · ${mesExtenso(p.mes)}` }, { valor: n0(p.pocos), rotulo: 'poços produtores ligados à unidade no mês' }])}${graficoMensal(u.serie, { titulo: `Petróleo — ${u.nome}, últimos meses (barris por dia)` })}` : vazio('Sem produção registrada para esta unidade no último mês da base da ANP.')}</section>` : ''}
${!sonda && Number.isFinite(u.lat) ? `<p class="ro-acoes"><a class="ro-botao" href="${BASE}/mapa#unidade=${esc(u.slug)}">Ver no mapa</a></p>` : ''}
${listaNoticias(nUnid, `Notícias sobre ${u.nome}`, `Nenhuma notícia do OWNews cita ${u.nome} nos últimos 12 meses.`)}
${op ? listaNoticias(nOp, `Notícias de ${op.nome} (empresa)`) : ''}
<p class="ro-nota">Carreiras: ${carreira}. Conteúdo geral por tipo de instalação, não sobre a tripulação desta unidade.</p>
${rodapeFonte(meta, sonda ? ['sondas', 'campos'] : ['plataformas', 'producao_mar'])}`;
  const descricao = sonda
    ? `${u.nome} (${u.sigla})${u.tipo ? `, ${u.tipo.toLowerCase()}` : ''}${op ? `, operada por ${op.nome}` : ''}: campos com atividade registrada pela ANP e notícias relacionadas.`
    : `${u.nome}: ${u.tipo || 'unidade de produção'}${op ? ` da ${op.nome}` : ''}${u.bacia ? ` na Bacia de ${u.bacia}` : ''}. Campos, capacidade, produção mensal oficial e notícias.`;
  return pagina({
    ...robotsFicha('unidade', u, noticias),
    titulo: `${u.nome} — ${u.tipo || (sonda ? 'Sonda' : 'Unidade offshore')}`, canonical: `${BASE}/unidades/${u.slug}`, descricao, html,
    jsonLd: { '@context': 'https://schema.org', '@type': 'Place', name: u.nome, description: descricao, ...(Number.isFinite(u.lat) ? { geo: { '@type': 'GeoCoordinates', latitude: u.lat, longitude: u.lon } } : {}) },
  });
}

/* ─── Campos ─── */
export function listaCampos({ campos, operadores, meta }) {
  const ops = opsMap(operadores);
  const ordem = { 'Produção': 0, 'Desenvolvimento': 1, 'Em Devolução': 2 };
  const lista = [...(campos || [])].sort((a, b) => (ordem[a.situacao] ?? 3) - (ordem[b.situacao] ?? 3) || (b.producao?.petroleo_bbl_d || 0) - (a.producao?.petroleo_bbl_d || 0) || a.nome.localeCompare(b.nome, 'pt-BR'));
  const html = `${cabecalho({ titulo: 'Campos offshore', sub: 'Campos de petróleo e gás no mar brasileiro, com operador, situação e produção oficial.', migalhas: [['Campos', null]] })}
${navSecoes(`${BASE}/campos`)}
${filtros(lista.map((c) => ({ tipo: c.situacao, op: (ops.get(c.operador) || {}).nome, bacia: c.bacia })), [['tipo', 'Situação'], ['op', 'Operador'], ['bacia', 'Bacia']])}
<ul class="ro-lista" data-lista>${lista.map((c) => { const op = ops.get(c.operador); return `<li class="ro-item" data-tipo="${esc(c.situacao || '')}" data-op="${esc(op ? op.nome : '')}" data-bacia="${esc(c.bacia || '')}" data-busca="${esc(`${c.nome} ${c.bacia} ${op ? op.nome : ''}`.toLowerCase())}"><a href="${BASE}/campos/${esc(c.slug)}"><strong>${esc(c.nome)}</strong><span>${esc([c.bacia && `Bacia de ${c.bacia}`, c.situacao, op && op.nome, c.producao && c.producao.petroleo_bbl_d > 0 && barris(c.producao.petroleo_bbl_d)].filter(Boolean).join(' · '))}</span></a></li>`; }).join('')}</ul>
${rodapeFonte(meta, ['campos', 'concessionarios', 'producao_mar'])}`;
  return pagina({ titulo: 'Campos offshore no Brasil — Radar Offshore', canonical: `${BASE}/campos`, descricao: `${lista.length} campos marítimos de petróleo e gás no Brasil: operador, bacia, situação e produção mensal oficial da ANP.`, html });
}

export function campo({ c, unidades, operadores, noticias, meta }) {
  const ops = opsMap(operadores);
  const uPorId = new Map((unidades || []).map((u) => [u.id, u]));
  const op = ops.get(c.operador);
  const plat = (c.unidades || []).map((id) => uPorId.get(id)).filter(Boolean);
  const sondas = (c.sondas || []).map((id) => uPorId.get(id)).filter(Boolean);
  const p = c.producao;
  const html = `${cabecalho({ kicker: 'Campo offshore', titulo: c.nome, sub: c.bacia ? `Bacia de ${c.bacia}${c.estado ? ` · ${c.estado}` : ''}` : null, migalhas: [['Campos', `${BASE}/campos`], [c.nome, null]] })}
<section class="ro-bloco"><h2>Dados do campo</h2>${dados([
    ['Operador', op ? linkOp(c.operador, ops) : null],
    ['Situação', c.situacao ? esc(c.situacao) : null],
    ['Início da produção', c.inicio_producao ? dataBr(c.inicio_producao) : null],
    ['Contrato', c.contrato ? esc(c.contrato) : null],
    ['Rodada', c.rodada ? esc(c.rodada) : null],
    ['Concessionários', c.concessionarios?.length ? c.concessionarios.map((x) => `${esc(x.nome)}${Number.isFinite(x.participacao) ? ` — ${esc(String(x.participacao).replace('.', ','))}%` : ''}${x.operador ? ' (operador)' : ''}`).join('<br>') : null],
  ])}</section>
<section class="ro-bloco"><h2>Produção</h2>${p && (p.petroleo_bbl_d > 0 || p.gas_mil_m3_d > 0) ? `${cartoes([{ valor: barris(p.petroleo_bbl_d), rotulo: `petróleo · ${mesExtenso(p.mes)}` }, { valor: gas(p.gas_mil_m3_d), rotulo: `gás natural · ${mesExtenso(p.mes)}` }, { valor: n0(p.pocos), rotulo: 'poços produtores no mês' }])}${graficoMensal(c.serie, { titulo: `Petróleo — campo de ${c.nome}, últimos meses (barris por dia)` })}` : vazio('Sem produção registrada no último mês da base da ANP.')}</section>
<section class="ro-bloco"><h2>Unidades de produção</h2>${plat.length ? `<ul class="ro-lista">${plat.map((u) => linhaUnidade(u, ops)).join('')}</ul>` : vazio('Nenhuma plataforma da base da ANP lista este campo.')}</section>
${sondas.length ? `<section class="ro-bloco"><h2>Sondas com atividade registrada</h2><ul class="ro-lista">${sondas.map((u) => linhaUnidade(u, ops)).join('')}</ul></section>` : ''}
<p class="ro-acoes"><a class="ro-botao" href="${BASE}/mapa#campo=${esc(c.slug)}">Ver no mapa</a></p>
${listaNoticias((noticias.campos || {})[c.id], `Notícias sobre o campo de ${c.nome}`, `Nenhuma notícia do OWNews cita o campo de ${c.nome} nos últimos 12 meses.`)}
${rodapeFonte(meta, ['campos', 'concessionarios', 'producao_mar'])}`;
  return pagina({ ...robotsFicha('campo', c, noticias), titulo: `Campo de ${c.nome}`, canonical: `${BASE}/campos/${c.slug}`, html, descricao: `Campo de ${c.nome}${c.bacia ? `, Bacia de ${c.bacia}` : ''}: operador${op ? ` ${op.nome}` : ''}, concessionários, unidades, produção mensal oficial e notícias.` });
}

/* ─── Operadores ─── */
export function listaOperadores({ operadores, meta }) {
  const lista = [...(operadores || [])].sort((a, b) => (b.producao?.petroleo_bbl_d || 0) - (a.producao?.petroleo_bbl_d || 0) || (b.campos.length + b.unidades.length + b.sondas.length) - (a.campos.length + a.unidades.length + a.sondas.length));
  const linha = (o) => `<li class="ro-item"><a href="${BASE}/operadores/${esc(o.slug)}"><strong>${esc(o.nome)}</strong><span>${esc([o.campos.length && `${o.campos.length} ${o.campos.length === 1 ? 'campo' : 'campos'}`, o.unidades.length && `${o.unidades.length} ${o.unidades.length === 1 ? 'unidade' : 'unidades'}`, o.sondas.length && `${o.sondas.length} ${o.sondas.length === 1 ? 'sonda' : 'sondas'}`].filter(Boolean).join(' · '))}</span></a></li>`;
  const deCampo = lista.filter((o) => o.campos.length || o.unidades.length);
  const deSonda = lista.filter((o) => !o.campos.length && !o.unidades.length);
  const html = `${cabecalho({ titulo: 'Operadores', sub: 'Empresas que operam campos, unidades e sondas no mar brasileiro.', migalhas: [['Operadores', null]] })}
${navSecoes(`${BASE}/operadores`)}
<section class="ro-bloco"><h2>Operadores de campos e unidades</h2><ul class="ro-lista">${deCampo.map(linha).join('')}</ul></section>
${deSonda.length ? `<section class="ro-bloco"><h2>Empresas que operam sondas</h2><ul class="ro-lista">${deSonda.map(linha).join('')}</ul></section>` : ''}
<p class="ro-nota">Empresas são identificadas pelo CNPJ quando a base da ANP o informa. Nomes diferentes na base não são unidos por semelhança.</p>
${rodapeFonte(meta, ['campos', 'concessionarios', 'plataformas', 'sondas'])}`;
  return pagina({ titulo: 'Operadores offshore no Brasil — Radar Offshore', canonical: `${BASE}/operadores`, descricao: 'Operadores de campos, unidades e sondas no mar brasileiro, com dados públicos da ANP.', html });
}

export function operador({ o, unidades, campos, noticias, vagas, meta }) {
  const uPorId = new Map((unidades || []).map((u) => [u.id, u]));
  const cPorId = new Map((campos || []).map((c) => [c.id, c]));
  const ops = new Map([[o.id, o]]);
  const meusCampos = o.campos.map((id) => cPorId.get(id)).filter(Boolean);
  const v = (vagas || {})[o.id];
  const html = `${cabecalho({ kicker: 'Operador', titulo: o.nome, sub: o.razao_social && o.razao_social !== o.nome ? o.razao_social : null, migalhas: [['Operadores', `${BASE}/operadores`], [o.nome, null]] })}
${o.producao && o.producao.petroleo_bbl_d > 0 ? cartoes([{ valor: barris(o.producao.petroleo_bbl_d), rotulo: `petróleo dos campos que opera · ${mesExtenso(o.producao.mes)}` }, { valor: gas(o.producao.gas_mil_m3_d), rotulo: `gás natural · ${mesExtenso(o.producao.mes)}` }]) : ''}
${meusCampos.length ? `<section class="ro-bloco"><h2>Campos operados no mar</h2><ul class="ro-lista">${meusCampos.map((c) => `<li class="ro-item"><a href="${BASE}/campos/${esc(c.slug)}"><strong>${esc(c.nome)}</strong><span>${esc([c.bacia && `Bacia de ${c.bacia}`, c.situacao].filter(Boolean).join(' · '))}</span></a></li>`).join('')}</ul></section>` : ''}
${o.unidades.length ? `<section class="ro-bloco"><h2>Unidades de produção</h2><ul class="ro-lista">${o.unidades.map((id) => uPorId.get(id)).filter(Boolean).map((u) => linhaUnidade(u, ops)).join('')}</ul></section>` : ''}
${o.sondas.length ? `<section class="ro-bloco"><h2>Sondas</h2><ul class="ro-lista">${o.sondas.map((id) => uPorId.get(id)).filter(Boolean).map((u) => linhaUnidade(u, ops)).join('')}</ul></section>` : ''}
${v ? `<section class="ro-bloco"><h2>Vagas verificadas</h2><p>${esc(v.total)} ${v.total === 1 ? 'vaga aberta' : 'vagas abertas'} da ${esc(v.empresa)} no Radar de Vagas do OWNews, publicadas no portal oficial da empresa.</p><ul class="ro-noticias">${v.exemplos.map((x) => `<li>${esc(x.titulo)}${x.local ? ` <span>· ${esc(x.local)}</span>` : ''}</li>`).join('')}</ul><p><a href="/vagas">Ver todas as vagas</a></p></section>` : ''}
${listaNoticias((noticias.operadores || {})[o.id], `Notícias de ${o.nome}`, `Nenhuma notícia do OWNews com ${o.nome} no título nos últimos 12 meses.`)}
${rodapeFonte(meta, ['campos', 'concessionarios', 'plataformas', 'sondas', 'producao_mar'])}`;
  return pagina({ ...robotsFicha('operador', o, noticias), titulo: `${o.nome} no offshore brasileiro`, canonical: `${BASE}/operadores/${o.slug}`, html, descricao: `${o.nome}: campos, unidades e sondas no mar brasileiro segundo a ANP, produção dos campos operados e notícias do OWNews.` });
}

/* ─── Produção ─── */
export function producao({ producao: p, campos, unidades, meta }) {
  const cPorId = new Map((campos || []).map((c) => [c.id, c]));
  const uPorId = new Map((unidades || []).map((u) => [u.id, u]));
  const s = p?.nacional || [];
  const [ant, atu] = s.slice(-2);
  const vOleo = ant && atu ? { abs: atu.petroleo_bbl_d - ant.petroleo_bbl_d, pct: ant.petroleo_bbl_d ? ((atu.petroleo_bbl_d - ant.petroleo_bbl_d) / ant.petroleo_bbl_d) * 100 : null } : null;
  const tabela = (itens, porId, prefixo) => `<table class="ro-tabela"><thead><tr><th scope="col">#</th><th scope="col">Nome</th><th scope="col">Petróleo</th><th scope="col">Gás natural</th></tr></thead><tbody>${itens.slice(0, 15).map((x, i) => { const e = porId.get(x.id); return e ? `<tr><td>${i + 1}</td><td><a href="${BASE}/${prefixo}/${esc(e.slug)}">${esc(e.nome)}</a></td><td>${esc(barris(x.petroleo_bbl_d))}</td><td>${esc(gas(x.gas_mil_m3_d))}</td></tr>` : ''; }).join('')}</tbody></table>`;
  const html = `${cabecalho({ titulo: 'Produção no mar', sub: atu ? `Dados oficiais da ANP. Mês mais recente publicado: ${mesExtenso(atu.mes)}.` : 'Dados oficiais da ANP.', migalhas: [['Produção', null]] })}
${navSecoes(`${BASE}/producao`)}
${atu ? cartoes([
    { valor: barris(atu.petroleo_bbl_d), rotulo: `petróleo no mar · ${mesExtenso(atu.mes)}`, nota: vOleo ? `${vOleo.abs >= 0 ? '+' : ''}${n0(vOleo.abs)} barris/dia (${pct(vOleo.pct)}) sobre ${mesExtenso(ant.mes)}` : null },
    { valor: gas(atu.gas_mil_m3_d), rotulo: `gás natural no mar · ${mesExtenso(atu.mes)}` },
    { valor: n0(atu.pocos), rotulo: 'poços com produção no mês' },
  ]) : vazio()}
${graficoMensal(s, { titulo: 'Petróleo no mar — últimos 12 meses (barris por dia)' })}
${graficoMensal(s, { campo: 'gas_mil_m3_d', formatar: gas, titulo: 'Gás natural no mar — últimos 12 meses (m³ por dia)' })}
<section class="ro-bloco"><h2>Maiores campos em ${esc(mesExtenso(p?.mes_referencia))}</h2>${p?.campos?.length ? tabela(p.campos, cPorId, 'campos') : vazio()}</section>
<section class="ro-bloco"><h2>Maiores unidades em ${esc(mesExtenso(p?.mes_referencia))}</h2>${p?.unidades?.length ? tabela(p.unidades, uPorId, 'unidades') : vazio()}</section>
<p class="ro-nota">Petróleo = óleo + condensado, convertido de m³ para barris (1 m³ = 6,2898 barris) e dividido pelos dias do mês. Gás natural = associado + não associado. A ANP publica a produção com cerca de dois meses de defasagem.</p>
${rodapeFonte(meta, ['producao_mar'])}`;
  return pagina({ titulo: 'Produção de petróleo e gás no mar — Radar Offshore', canonical: `${BASE}/producao`, html, descricao: `Produção offshore de petróleo e gás natural no Brasil${atu ? ` em ${mesExtenso(atu.mes)}` : ''}, últimos 12 meses e maiores campos e unidades, com dados oficiais da ANP.` });
}

/* ─── Exploração (REALIZADO) ─── */
export function exploracao({ exploracao: e, meta }) {
  const r = e?.resumo || {};
  const pocos = (e?.pocos || []).slice(0, 25);
  const html = `${cabecalho({ titulo: 'Exploração no mar', sub: `Atividade exploratória realizada, segundo o painel da fase de exploração da ANP${e?.referencia ? ` (${mesExtenso(e.referencia)})` : ''}.`, migalhas: [['Exploração', null]] })}
${navSecoes(`${BASE}/exploracao`)}
<p class="ro-selo">Realizado — dados da ANP. Para o que está previsto, veja <a href="${BASE}/futuro">Futuro offshore</a>.</p>
${cartoes([
    Number.isFinite(r.pocos_iniciados_ano) ? { valor: n0(r.pocos_iniciados_ano), rotulo: `poços exploratórios iniciados no mar em ${r.ano}` } : null,
    Number.isFinite(r.descobertas_ano) ? { valor: n0(r.descobertas_ano), rotulo: `notificações de descoberta em ${r.ano}` } : null,
    Number.isFinite(r.em_perfuracao) ? { valor: n0(r.em_perfuracao), rotulo: 'poços ainda sem conclusão na base' } : null,
    Number.isFinite(r.pads_andamento) ? { valor: n0(r.pads_andamento), rotulo: 'planos de avaliação (PAD) em andamento' } : null,
    Number.isFinite(r.blocos_sob_contrato) ? { valor: n0(r.blocos_sob_contrato), rotulo: 'blocos exploratórios sob contrato no mar' } : null,
  ])}
<section class="ro-bloco"><h2>Poços exploratórios mais recentes</h2>${pocos.length ? `<div class="ro-rolagem"><table class="ro-tabela"><thead><tr><th scope="col">Poço</th><th scope="col">Bacia</th><th scope="col">Operador</th><th scope="col">Início</th><th scope="col">Conclusão</th><th scope="col">Descoberta</th></tr></thead><tbody>${pocos.map((p) => `<tr><td>${esc(p.poco)}</td><td>${esc(p.bacia || '—')}</td><td>${esc(p.operador || '—')}</td><td>${esc(dataBr(p.inicio))}</td><td>${p.conclusao ? esc(dataBr(p.conclusao)) : 'em andamento'}</td><td>${p.descoberta === true ? `Sim${p.fluido ? ` (${esc(p.fluido)})` : ''}` : p.descoberta === false ? 'Não' : '—'}</td></tr>`).join('')}</tbody></table></div>` : vazio()}</section>
<section class="ro-bloco"><h2>Declarações de comercialidade recentes</h2>${e?.declaracoes?.length ? `<ul class="ro-noticias">${e.declaracoes.slice(0, 12).map((d) => `<li>${esc(d.area)} <span>· ${esc([d.operador, d.bacia && `Bacia de ${d.bacia}`].filter(Boolean).join(' · '))}</span><time datetime="${esc(d.data)}">${esc(dataBr(d.data))}</time></li>`).join('')}</ul>` : vazio()}</section>
<section class="ro-bloco"><h2>Planos de avaliação de descoberta em andamento</h2>${e?.pads?.length ? `<ul class="ro-noticias">${e.pads.map((p) => `<li>${esc(p.bloco || p.codigo)} <span>· ${esc([p.operador, p.bacia && `Bacia de ${p.bacia}`, p.situacao].filter(Boolean).join(' · '))}</span>${p.termino_previsto ? `<time datetime="${esc(p.termino_previsto)}">término previsto ${esc(dataBr(p.termino_previsto))}</time>` : ''}</li>`).join('')}</ul>` : vazio()}</section>
<section class="ro-bloco"><h2>Blocos sob contrato no mar, por bacia</h2>${e?.blocos?.por_bacia?.length ? `<table class="ro-tabela"><tbody>${e.blocos.por_bacia.map((b) => `<tr><td>${esc(b.bacia)}</td><td>${n0(b.n)}</td></tr>`).join('')}</tbody></table>` : vazio()}</section>
${rodapeFonte(meta, ['pocos_exploratorios', 'pads_andamento', 'declaracoes_comercialidade', 'blocos'])}`;
  return pagina({ titulo: 'Exploração de petróleo no mar — Radar Offshore', canonical: `${BASE}/exploracao`, html, descricao: 'Poços exploratórios, descobertas, planos de avaliação e declarações de comercialidade no mar brasileiro, com dados oficiais da ANP.' });
}

/* ─── Futuro offshore (PREVISTO) ─── */
export function futuro({ futuro: f, meta }) {
  const inv = f?.investimento_mar || [];
  const maxInv = Math.max(1, ...inv.map((x) => x.total_rs));
  const ativ = (f?.atividades_mar || []).filter((a) => Object.values(a.anos).some((v) => v > 0));
  const anos = [...new Set(ativ.flatMap((a) => Object.keys(a.anos)))].sort();
  const html = `${cabecalho({ titulo: 'Futuro offshore', sub: 'Investimentos e atividades que as operadoras informaram à ANP para os próximos anos.', migalhas: [['Futuro offshore', null]] })}
${navSecoes(`${BASE}/futuro`)}
<p class="ro-selo ro-previsto">Previsto — informado pelas operadoras à ANP. Previsão não é fato realizado.</p>
<section class="ro-bloco"><h2>Investimento previsto no mar (desenvolvimento e produção)</h2>${inv.length ? `<ul class="ro-barras">${inv.map((x) => `<li><span>${esc(x.ano)}</span><span class="ro-barra" style="--p:${((x.total_rs / maxInv) * 100).toFixed(1)}%"></span><strong>${esc(reais(x.total_rs))}</strong></li>`).join('')}</ul>${inv[0]?.bacias?.length ? `<details><summary>Por bacia</summary><table class="ro-tabela"><thead><tr><th scope="col">Bacia</th>${inv.map((x) => `<th scope="col">${esc(x.ano)}</th>`).join('')}</tr></thead><tbody>${[...new Set(inv.flatMap((x) => x.bacias.map((b) => b.bacia)))].map((b) => `<tr><td>${esc(b)}</td>${inv.map((x) => `<td>${esc(reais((x.bacias.find((y) => y.bacia === b) || {}).rs) || '—')}</td>`).join('')}</tr>`).join('')}</tbody></table></details>` : ''}` : vazio()}</section>
<section class="ro-bloco"><h2>Atividades previstas no mar</h2>${ativ.length ? `<div class="ro-rolagem"><table class="ro-tabela"><thead><tr><th scope="col">Atividade</th>${anos.map((a) => `<th scope="col">${esc(a)}</th>`).join('')}</tr></thead><tbody>${ativ.map((a) => `<tr><td>${esc(a.tipo)}${a.unidade && a.unidade !== 'Unidade' ? ` <span>(${esc(a.unidade.toLowerCase())})</span>` : ''}</td>${anos.map((y) => `<td>${Number.isFinite(a.anos[y]) ? n0(a.anos[y]) : '—'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : vazio()}</section>
<section class="ro-bloco"><h2>Produção prevista no mar</h2>${f?.producao_prevista_mar?.length ? `<table class="ro-tabela"><thead><tr><th scope="col">Ano</th><th scope="col">Petróleo</th><th scope="col">Gás natural</th></tr></thead><tbody>${f.producao_prevista_mar.map((x) => `<tr><td>${esc(x.ano)}</td><td>${esc(barris(x.petroleo_bbl_d))}</td><td>${esc(gas(x.gas_mil_m3_d))}</td></tr>`).join('')}</tbody></table>` : vazio()}</section>
<section class="ro-bloco"><h2>Exploração prevista no mar</h2>${f?.exploracao_prevista_mar?.investimento?.some((x) => x.rs > 0) ? `<p>Investimento exploratório previsto (plano informado em ${esc(f.exploracao_prevista_mar.ano_referencia)}):</p><ul class="ro-barras">${f.exploracao_prevista_mar.investimento.filter((x) => x.rs > 0).map((x) => `<li><span>${esc(x.ano)}</span><strong>${esc(reais(x.rs))}</strong></li>`).join('')}</ul>` : vazio()}</section>
<aside class="ro-analise"><p class="ro-kicker">Contexto OWNews — análise, não dado da ANP</p><p>Investimento e perfuração previstos indicam onde a atividade tende a se concentrar: novas unidades, poços e linhas submarinas costumam puxar contratos de serviços, embarcações de apoio e mão de obra embarcada. O tamanho desse efeito não é medido por estas bases.</p></aside>
${rodapeFonte(meta, ['investimento_bacia', 'previsao_atividade', 'previsao_producao', 'previsao_exploracao'])}`;
  return pagina({ titulo: 'Futuro offshore: investimentos e atividades previstos — Radar Offshore', canonical: `${BASE}/futuro`, html, descricao: 'Investimentos, perfurações, novas unidades e produção previstos no mar brasileiro, informados pelas operadoras à ANP.' });
}

/* ─── Mapa ─── */
export function mapa({ meta }) {
  const html = `${cabecalho({ titulo: 'Mapa offshore do Brasil', sub: 'Unidades de produção, campos e blocos exploratórios, com coordenadas e polígonos oficiais da ANP.', migalhas: [['Mapa', null]] })}
${navSecoes(`${BASE}/mapa`)}
<fieldset class="ro-camadas"><legend>Camadas</legend>
<label><input type="checkbox" data-camada="unidades" checked> Unidades de produção</label>
<label><input type="checkbox" data-camada="campos"> Campos</label>
<label><input type="checkbox" data-camada="blocos"> Blocos exploratórios</label>
<label><input type="checkbox" data-camada="presal"> Polígono do pré-sal</label>
</fieldset>
<div id="ro-mapa" class="ro-mapa" role="region" aria-label="Mapa offshore do Brasil"><p class="ro-vazio">Carregando o mapa…</p></div>
<p class="ro-nota">Sondas não aparecem no mapa: a ANP não publica a posição delas. Todos os dados do mapa também estão nas listas de <a href="${BASE}/unidades">unidades</a> e <a href="${BASE}/campos">campos</a>.</p>
<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css">
<script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js" defer></script>
<script src="${BASE}/static/mapa.js?v=2" defer></script>
${rodapeFonte(meta, ['plataformas', 'campos'], 'Polígonos: GeoServer da ANP (campos de produção, blocos exploratórios e polígono do pré-sal), simplificados para exibição.')}`;
  return pagina({ titulo: 'Mapa offshore do Brasil — Radar Offshore', canonical: `${BASE}/mapa`, html, descricao: 'Mapa das unidades de produção, campos e blocos exploratórios no mar brasileiro, com dados oficiais da ANP.' });
}

/* ─── Fontes e metodologia ─── */
export function fontes({ meta }) {
  const lista = Object.entries(meta?.fontes || {});
  const html = `${cabecalho({ titulo: 'Como o Radar Offshore funciona', sub: 'Fontes oficiais, frequência de atualização e regras de consolidação.', migalhas: [['Fontes', null]] })}
<section class="ro-bloco"><h2>Bases consultadas</h2><div class="ro-rolagem"><table class="ro-tabela"><thead><tr><th scope="col">Base (ANP)</th><th scope="col">Consultada em</th><th scope="col">Situação</th></tr></thead><tbody>${lista.map(([, f]) => `<tr><td><a href="${esc(f.arquivo)}" rel="noopener">${esc(f.nome)}</a>${f.referencia && /^\d{4}-\d{2}$/.test(f.referencia) ? ` <span>· arquivo de ${esc(mesExtenso(f.referencia))}</span>` : ''}</td><td>${esc(dataBr(f.baixado_em))}</td><td>${f.status === 'ok' ? 'Atualizada' : 'Indisponível na última tentativa — mantida a base anterior'}</td></tr>`).join('')}</tbody></table></div></section>
<section class="ro-bloco"><h2>Regras</h2><ul class="ro-regras">
<li>O OWNews baixa as bases da ANP uma vez por dia, valida colunas, codificação e volume e só então substitui a versão anterior. Se a ANP falhar ou publicar um arquivo quebrado, a última versão válida continua no ar.</li>
<li>Uma unidade é identificada pela sigla da ANP; um campo, pelo código; uma empresa, pelo CNPJ quando a base o informa. Nomes parecidos nunca são unidos.</li>
<li>Produção: petróleo = óleo + condensado (1 m³ = 6,2898 barris), em média por dia do mês; gás = associado + não associado.</li>
<li>Notícias relacionadas: só quando a unidade ou o campo aparece pelo nome no título ou na primeira frase do resumo da matéria.</li>
<li>Previsões aparecem sempre marcadas como previsão informada pelas operadoras. Análises do OWNews são marcadas como análise.</li>
</ul></section>
${rodapeFonte(meta, [])}`;
  return pagina({ titulo: 'Fontes e metodologia — Radar Offshore', canonical: `${BASE}/fontes`, html, descricao: 'Bases oficiais da ANP usadas pelo Radar Offshore do OWNews, frequência de atualização e regras de consolidação.' });
}

export function naoEncontrada(oque) {
  return { status: 404, robots: 'noindex,follow', titulo: 'Não encontrada — Radar Offshore', canonical: null, descricao: 'Página não encontrada no Radar Offshore.', html: `${cabecalho({ titulo: `${oque} não encontrada` })}<p>Esta página não existe ou saiu da base oficial da ANP. ${'<a href="' + BASE + '">Voltar ao Radar Offshore</a>'}.</p>` };
}

export function indisponivel() {
  return { status: 503, robots: 'noindex,follow', titulo: 'Radar Offshore', canonical: BASE, descricao: 'Radar Offshore temporariamente indisponível.', html: `${cabecalho({ titulo: 'Radar Offshore' })}<p class="ro-vazio">Os dados do Radar ainda não foram carregados. Tente de novo em alguns minutos.</p>` };
}

export { SEM_DADO };
