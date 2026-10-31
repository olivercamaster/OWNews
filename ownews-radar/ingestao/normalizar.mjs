/**
 * Modelo canônico do Radar Offshore (OWNews) a partir das bases oficiais da ANP.
 *
 * Entidades: Unidade (plataforma de produção ou sonda), Campo, Operador, Produção (agregados
 * mensais), Exploração, Futuro (previsões). Regras:
 *  - nada é inventado: campo ausente na base → null (a página diz "não disponível na base");
 *  - identidade conservadora: plataforma = sigla ANP da instalação; sonda = sigla ANP da sonda;
 *    campo = código ANP do campo; operador = CNPJ (ou o nome exato quando a base não traz CNPJ).
 *    Nomes parecidos NUNCA unem entidades; casos ambíguos vão para `revisao`;
 *  - slugs estáveis: uma vez atribuído a um id, o slug não muda (mapa `slugsAnteriores`);
 *  - todo texto externo passa por limparTexto (sem controle, tamanho limitado).
 */
import {
  chaveNome, coordenada, dataIso, diasNoMes, limparTexto, M3_PARA_BARRIL, mesIso, nomeExibicao, numero, slug,
} from '../lib/texto.mjs';

const TIPO_PLATAFORMA = {
  'FLOATING PRODUCTION STORAGE OFFLOADING FPSO': 'FPSO',
  'PLATAFORMA FIXA JAQUETA': 'Plataforma fixa (jaqueta)',
  'PLATAFORMA FIXA CAISSON': 'Plataforma fixa (caisson)',
  'SEMISSUBMERSIVEL SS': 'Semissubmersível',
  'TENSION LEG PLATFORM TLP': 'TLP (plataforma de pernas atirantadas)',
};
/** Tipo da sonda pelo prefixo da sigla ANP — só os prefixos de significado inequívoco. */
const TIPO_SONDA = { NS: 'Navio-sonda', SS: 'Semissubmersível', PA: 'Plataforma autoelevatória' };

/** Coordenada plausível para o mar brasileiro; fora disso é descartada (nunca "corrigida"). */
export function coordenadaValida(lat, lon) {
  return Number.isFinite(lat) && Number.isFinite(lon) && lat > -35 && lat < 6 && lon > -55 && lon < -28;
}

/** Slug estável: reaproveita o já atribuído ao id; senão o nome; colisão → sufixo da sigla/código. */
export function atribuirSlugs(itens, anteriores = {}, usados = new Set()) {
  const saida = {};
  for (const it of itens) if (anteriores[it.id] && !usados.has(anteriores[it.id])) { saida[it.id] = anteriores[it.id]; usados.add(anteriores[it.id]); }
  for (const it of itens) {
    if (saida[it.id]) continue;
    let s = slug(it.nome) || slug(it.sufixo);
    if (usados.has(s)) s = `${s}-${slug(it.sufixo)}`;
    let n = 2;
    while (usados.has(s)) s = `${slug(it.nome)}-${slug(it.sufixo)}-${n++}`;
    saida[it.id] = s; usados.add(s);
  }
  return saida;
}

function dividirCampos(s) {
  return String(s || '').split('/').map((c) => limparTexto(c, 80)).filter(Boolean);
}

/* ─── Operadores ─────────────────────────────────────────────────────────── */

export function construirOperadores({ campos, concessionarios, plataformas, sondas }) {
  const porId = new Map();
  const revisao = [];
  const garantir = (id, dados) => {
    if (!porId.has(id)) porId.set(id, { id, nome: dados.nome, razao_social: dados.razao_social || null, cnpj: dados.cnpj || null, papeis: new Set() });
    return porId.get(id);
  };
  // 1) operador de cada campo: concessionário com OPERADOR = "S" (tem CNPJ).
  const operadorDoCampo = new Map();
  const razaoParaCnpj = new Map();
  for (const c of concessionarios) {
    const cnpj = String(c.CNPJ || '').replace(/\D/g, '');
    const razao = limparTexto(c['RAZAO_SOCIAL/CONCESSIONARIO'], 160);
    if (cnpj.length === 14) razaoParaCnpj.set(chaveNome(razao), { cnpj, razao });
    if (String(c.OPERADOR).trim().toUpperCase() === 'S' && cnpj.length === 14) operadorDoCampo.set(String(c.CODIGO_CAMPO).trim(), { cnpj, razao });
  }
  // nome curto do operador = como a própria ANP o abrevia na base de campos (ex.: "PETROBRAS")
  const nomeCurto = new Map();
  for (const c of campos) {
    const op = operadorDoCampo.get(String(c.CODIGO_CAMPO).trim());
    if (op && c.OPERADOR) nomeCurto.set(op.cnpj, limparTexto(c.OPERADOR, 80));
  }
  const idPorChaveCurta = new Map();
  for (const [cnpj, curto] of nomeCurto) {
    const razao = [...razaoParaCnpj.values()].find((r) => r.cnpj === cnpj)?.razao || null;
    garantir(`op-${cnpj}`, { nome: nomeExibicao(curto), razao_social: razao, cnpj });
    idPorChaveCurta.set(chaveNome(curto), `op-${cnpj}`);
  }
  const idOperadorCampo = (codigo) => { const o = operadorDoCampo.get(String(codigo).trim()); return o ? `op-${o.cnpj}` : null; };

  // 2) operador da plataforma: razão social → CNPJ (exato). Sem CNPJ: entidade pelo nome exato.
  const idOperadorPlataforma = (razao) => {
    const r = razaoParaCnpj.get(chaveNome(razao));
    if (r) {
      const id = `op-${r.cnpj}`;
      garantir(id, { nome: nomeCurto.has(r.cnpj) ? nomeExibicao(nomeCurto.get(r.cnpj)) : nomeExibicao(r.razao), razao_social: r.razao, cnpj: r.cnpj });
      return id;
    }
    const id = `op-${slug(razao)}`;
    garantir(id, { nome: nomeExibicao(razao), razao_social: limparTexto(razao, 160) });
    revisao.push({ tipo: 'operador_sem_cnpj', nome: limparTexto(razao, 160) });
    return id;
  };
  // 3) operador da sonda: mesmo nome curto de um operador de campo → mesma entidade; senão próprio.
  const idOperadorSonda = (nome) => {
    const k = chaveNome(nome);
    if (idPorChaveCurta.has(k)) return idPorChaveCurta.get(k);
    const id = `op-${slug(nome)}`;
    garantir(id, { nome: nomeExibicao(nome) });
    return id;
  };
  return { porId, revisao, idOperadorCampo, idOperadorPlataforma, idOperadorSonda };
}

/* ─── Produção (agregados mensais) ───────────────────────────────────────── */

/**
 * Linhas por poço → agregados. Petróleo = óleo + condensado (m³ → barris/dia, pelo número de
 * dias do mês); gás = associado + não associado (Mm³ = mil m³ → mil m³/dia).
 */
export function agregarProducao(linhas) {
  const porMes = new Map();
  const acumular = (mapa, chave, mes, v) => {
    if (!mapa.has(chave)) mapa.set(chave, new Map());
    const m = mapa.get(chave);
    const a = m.get(mes) || { oleo: 0, gas: 0, pocos: new Set() };
    a.oleo += v.oleo; a.gas += v.gas; if (v.poco) a.pocos.add(v.poco);
    m.set(mes, a);
  };
  const campo = new Map(), instalacao = new Map();
  for (const l of linhas) {
    const mes = mesIso(l['Mês/Ano']);
    if (!mes) continue;
    const oleo = (numero(l['Produção de Óleo (m³)']) || 0) + (numero(l['Produção de Condensado (m³)']) || 0);
    const gas = (numero(l['Produção de Gás Associado (Mm³)']) || 0) + (numero(l['Produção de Gás Não Associado (Mm³)']) || 0);
    const produziu = oleo > 0 || gas > 0;
    const v = { oleo, gas, poco: produziu ? limparTexto(l['Poço'], 40) : null };
    acumular(porMes, 'BR', mes, v);
    acumular(campo, chaveNome(l.Campo), mes, v);
    acumular(instalacao, chaveNome(l['Instalação']), mes, v);
  }
  const serie = (m) => [...(m || new Map()).entries()].sort(([a], [b]) => a.localeCompare(b)).map(([mes, a]) => ({
    mes,
    petroleo_bbl_d: Math.round((a.oleo * M3_PARA_BARRIL) / diasNoMes(mes)),
    gas_mil_m3_d: Math.round((a.gas / diasNoMes(mes)) * 10) / 10,
    pocos: a.pocos.size,
  }));
  return { nacional: serie(porMes.get('BR')), campo: new Map([...campo].map(([k, m]) => [k, serie(m)])), instalacao: new Map([...instalacao].map(([k, m]) => [k, serie(m)])) };
}

/* ─── Snapshot completo ──────────────────────────────────────────────────── */

export function construirSnapshot(d) {
  const agora = d.agora || new Date().toISOString();
  const slugsAnteriores = d.slugsAnteriores || {};
  const revisao = [];

  const camposMar = d.campos.filter((c) => /^mar$/i.test(String(c.AMBIENTE).trim()));
  const ops = construirOperadores({ campos: d.campos, concessionarios: d.concessionarios, plataformas: d.plataformas, sondas: d.sondas });
  const campoPorChave = new Map(camposMar.map((c) => [chaveNome(c.CAMPO), c]));

  // Produção: últimos 12 meses disponíveis
  const prod = agregarProducao(d.producao || []);
  const meses = prod.nacional.map((x) => x.mes);
  const mesRef = meses[meses.length - 1] || null;
  const ult12 = (s) => (s || []).slice(-12);
  const noMes = (s, mes) => (s || []).find((x) => x.mes === mes) || null;

  // ─ Campos ─
  const slugsCampos = atribuirSlugs(camposMar.map((c) => ({ id: `campo-${c.CODIGO_CAMPO}`, nome: c.CAMPO, sufixo: c.SIGLA_CAMPO || c.CODIGO_CAMPO })), slugsAnteriores.campos);
  const participacoes = new Map();
  for (const c of d.concessionarios) {
    const k = String(c.CODIGO_CAMPO).trim();
    if (!participacoes.has(k)) participacoes.set(k, []);
    participacoes.get(k).push({ nome: limparTexto(c['RAZAO_SOCIAL/CONCESSIONARIO'], 160), participacao: numero(c['PARTICIPACAO (%)']), operador: String(c.OPERADOR).trim().toUpperCase() === 'S' });
  }
  const campos = camposMar.map((c) => {
    const id = `campo-${c.CODIGO_CAMPO}`;
    const serieCampo = prod.campo.get(chaveNome(c.CAMPO));
    return {
      id, slug: slugsCampos[id], nome: nomeExibicao(c.CAMPO), nome_anp: limparTexto(c.CAMPO, 80), codigo: limparTexto(c.CODIGO_CAMPO, 12),
      bacia: limparTexto(c.BACIA, 60) || null, estado: limparTexto(c.ESTADO, 60) || null,
      operador: ops.idOperadorCampo(c.CODIGO_CAMPO),
      situacao: limparTexto(c.SITUACAO_CAMPO, 40) || null, rodada: limparTexto(c.RODADA, 20) || null,
      contrato: limparTexto(c.NOME_CONTRATO, 60) || null,
      inicio_producao: dataIso(c.DATA_INICIO_PRODUCAO), assinatura: dataIso(c.DATA_ASSINATURA),
      concessionarios: (participacoes.get(String(c.CODIGO_CAMPO).trim()) || []).sort((a, b) => (b.participacao || 0) - (a.participacao || 0)),
      producao: mesRef ? noMes(serieCampo, mesRef) : null,
      serie: ult12(serieCampo),
      unidades: [], sondas: [],
    };
  });
  const campoPorId = new Map(campos.map((c) => [c.id, c]));
  const idCampoPorNome = (nome) => { const c = campoPorChave.get(chaveNome(nome)); return c ? `campo-${c.CODIGO_CAMPO}` : null; };

  // ─ Unidades: plataformas ─
  const plataformas = d.plataformas.map((p) => {
    const sigla = limparTexto(p['SIGLA DA INSTALAÇÃO'], 20).toUpperCase();
    const lat = numero(p.LATITUDE), lon = numero(p.LONGITUDE);
    const tipoAnp = limparTexto(p['CLASSIFICAÇÃO'], 80);
    const serieInst = prod.instalacao.get(chaveNome(p['NOME DA INSTALAÇÃO']));
    return {
      id: `plat-${sigla}`, categoria: 'producao', sigla,
      nome: nomeExibicao(p['NOME DA INSTALAÇÃO']), nome_anp: limparTexto(p['NOME DA INSTALAÇÃO'], 120),
      tipo: TIPO_PLATAFORMA[chaveNome(tipoAnp)] || tipoAnp || null, tipo_anp: tipoAnp || null,
      campos: dividirCampos(p.CAMPOS).map((n) => ({ nome: nomeExibicao(n), id: idCampoPorNome(n) })),
      bacia: limparTexto(p.BACIA, 60) || null,
      operador: p.OPERADOR ? ops.idOperadorPlataforma(p.OPERADOR) : null,
      lamina_dagua_m: numero(p["LÂMINA D'ÁGUA (m)"]),
      escoamento: limparTexto(p['SISTEMA DE ESCOAMENTO'], 80) || null,
      inicio_operacao: numero(p['ANO DE INÍCIO DE OPERAÇÃO']),
      lat: coordenadaValida(lat, lon) ? lat : null, lon: coordenadaValida(lat, lon) ? lon : null,
      capacidade_petroleo_bbl_d: numero(p['CAPACIDADE DE PRODUÇÃO DE PETRÓLEO (bbl/d)']),
      capacidade_gas_mil_m3_d: numero(p['CAPACIDADE DE PRODUÇÃO DE GÁS NATURAL (Mil m³/d)']),
      producao: mesRef ? noMes(serieInst, mesRef) : null,
      serie: ult12(serieInst),
    };
  });
  for (const p of plataformas) if (p.lat === null) revisao.push({ tipo: 'coordenada_invalida', id: p.id });

  // ─ Unidades: sondas no mar (ao menos um campo marítimo) ─
  const sondas = [];
  for (const s of d.sondas) {
    const nomesCampos = dividirCampos(s.Campo);
    const idsCampos = nomesCampos.map(idCampoPorNome);
    if (!idsCampos.some(Boolean)) continue; // só terra (ou campo desconhecido): fora do Radar Offshore
    const sigla = limparTexto(s.Sigla_da_sonda, 20).toUpperCase();
    sondas.push({
      id: `sonda-${slug(sigla)}`, categoria: 'sonda', sigla,
      nome: nomeExibicao(s.Nome_da_sonda), nome_anp: limparTexto(s.Nome_da_sonda, 120),
      tipo: TIPO_SONDA[sigla.split('-')[0]] || null,
      campos: nomesCampos.map((n, i) => ({ nome: nomeExibicao(n), id: idsCampos[i] })),
      operador_sonda: s.Operador_da_sonda ? ops.idOperadorSonda(s.Operador_da_sonda) : null,
      ano_atividade: d.anoSondas || null,
    });
  }
  // sigla repetida na base: mantém as duas linhas separadas e registra para revisão
  const vistos = new Map();
  for (const s of sondas) {
    if (vistos.has(s.id)) { revisao.push({ tipo: 'sonda_sigla_repetida', sigla: s.sigla }); s.id = `${s.id}-${slug(s.nome)}`; }
    vistos.set(s.id, true);
  }

  const unidades = [...plataformas, ...sondas];
  const slugsUnid = atribuirSlugs(unidades.map((u) => ({ id: u.id, nome: u.nome, sufixo: u.sigla })), slugsAnteriores.unidades);
  for (const u of unidades) u.slug = slugsUnid[u.id];

  // Fotos curadas (Radar de Unidades do OWNews): só por nome EXATO — nunca por código de baixa confiança.
  const curadaPorNome = new Map((d.curadas || []).map((c) => [chaveNome(c.nome), c]));
  for (const u of unidades) {
    const c = curadaPorNome.get(chaveNome(u.nome_anp)) || curadaPorNome.get(chaveNome(u.nome));
    if (c && c.foto_url && /^https:\/\//.test(c.foto_url)) u.foto = { url: c.foto_url, credito: limparTexto(c.foto_credito, 120) || null, ficha: `/radar/${slug(c.slug)}` };
  }

  for (const u of plataformas) for (const c of u.campos) if (c.id && campoPorId.has(c.id)) campoPorId.get(c.id).unidades.push(u.id);
  for (const u of sondas) for (const c of u.campos) if (c.id && campoPorId.has(c.id)) campoPorId.get(c.id).sondas.push(u.id);

  revisao.push(...ops.revisao); // depois de plataformas e sondas: inclui operadores sem CNPJ
  // ─ Operadores (só os que aparecem no mar) ─
  const usados = new Set([...campos.map((c) => c.operador), ...plataformas.map((p) => p.operador), ...sondas.map((s) => s.operador_sonda)].filter(Boolean));
  const opsLista = [...ops.porId.values()].filter((o) => usados.has(o.id));
  const slugsOps = atribuirSlugs(opsLista.map((o) => ({ id: o.id, nome: o.nome, sufixo: o.cnpj || o.id })), slugsAnteriores.operadores);
  const operadores = opsLista.map((o) => {
    const meusCampos = campos.filter((c) => c.operador === o.id);
    const prodMes = meusCampos.reduce((acc, c) => ({ petroleo_bbl_d: acc.petroleo_bbl_d + (c.producao?.petroleo_bbl_d || 0), gas_mil_m3_d: acc.gas_mil_m3_d + (c.producao?.gas_mil_m3_d || 0) }), { petroleo_bbl_d: 0, gas_mil_m3_d: 0 });
    return {
      id: o.id, slug: slugsOps[o.id], nome: o.nome, razao_social: o.razao_social, cnpj: o.cnpj,
      campos: meusCampos.map((c) => c.id),
      unidades: plataformas.filter((p) => p.operador === o.id).map((p) => p.id),
      sondas: sondas.filter((s) => s.operador_sonda === o.id).map((s) => s.id),
      producao: meusCampos.length && mesRef ? { mes: mesRef, petroleo_bbl_d: prodMes.petroleo_bbl_d, gas_mil_m3_d: Math.round(prodMes.gas_mil_m3_d * 10) / 10 } : null,
    };
  });

  // ─ Produção (resumo nacional, rankings do mês de referência) ─
  const producao = {
    mes_referencia: mesRef,
    nacional: ult12(prod.nacional),
    campos: campos.filter((c) => c.producao && (c.producao.petroleo_bbl_d > 0 || c.producao.gas_mil_m3_d > 0))
      .map((c) => ({ id: c.id, petroleo_bbl_d: c.producao.petroleo_bbl_d, gas_mil_m3_d: c.producao.gas_mil_m3_d, pocos: c.producao.pocos }))
      .sort((a, b) => b.petroleo_bbl_d - a.petroleo_bbl_d),
    unidades: plataformas.filter((p) => p.producao && p.producao.petroleo_bbl_d + p.producao.gas_mil_m3_d > 0)
      .map((p) => ({ id: p.id, petroleo_bbl_d: p.producao.petroleo_bbl_d, gas_mil_m3_d: p.producao.gas_mil_m3_d, pocos: p.producao.pocos }))
      .sort((a, b) => b.petroleo_bbl_d - a.petroleo_bbl_d),
  };

  const exploracao = construirExploracao(d);
  const futuro = construirFuturo(d);

  const ativos = campos.filter((c) => c.situacao === 'Produção' || c.situacao === 'Desenvolvimento');
  const ultimoNacional = producao.nacional[producao.nacional.length - 1] || null;
  const resumo = {
    unidades_producao: plataformas.length,
    sondas: sondas.length,
    ano_sondas: d.anoSondas || null,
    campos_mar: campos.length,
    campos_producao: campos.filter((c) => c.situacao === 'Produção').length,
    campos_desenvolvimento: campos.filter((c) => c.situacao === 'Desenvolvimento').length,
    operadores_campos: new Set(ativos.map((c) => c.operador).filter(Boolean)).size,
    producao: ultimoNacional,
    exploracao: exploracao.resumo,
  };

  return {
    versao: 1, gerado_em: agora,
    resumo, unidades, campos, operadores, producao, exploracao, futuro, revisao,
    slugs: { unidades: slugsUnid, campos: slugsCampos, operadores: slugsOps },
  };
}

/* ─── Exploração ─────────────────────────────────────────────────────────── */

const ehMar = (v) => /^mar$/i.test(String(v || '').trim());
const simNao = (v) => (/^sim$/i.test(String(v || '').trim()) ? true : /^n[ãa]o$/i.test(String(v || '').trim()) ? false : null);

export function construirExploracao(d) {
  const pocos = (d.pocosExploratorios || []).filter((p) => ehMar(p.AMBIENTE)).map((p) => ({
    poco: limparTexto(p['POÇO ANP'], 40), bloco: limparTexto(p.BLOCO, 30) || null, bacia: limparTexto(p.BACIA, 60) || null,
    operador: limparTexto(p.OPERADOR, 80) || null,
    inicio: dataIso(p['INÍCIO DA PERFURAÇÃO']), conclusao: dataIso(p['CONCLUSÃO DO POÇO']),
    profundidade_m: numero(p['PROFUNDIDADE FINAL (m)']), presal: simNao(p['ATINGIU PRÉ-SAL?']),
    descoberta: simNao(p['NOTIFICAÇÃO DE DESCOBERTA ?']), data_descoberta: dataIso(p['DATA 1ª DESCOBERTA']),
    fluido: limparTexto(p['FLUIDO NOTIFICAÇÃO DESCOBERTA'], 40) || null,
  })).filter((p) => p.poco && p.inicio).sort((a, b) => b.inicio.localeCompare(a.inicio));
  const pads = (d.padsAndamento || []).filter((p) => ehMar(p.AMBIENTE)).map((p) => ({
    codigo: limparTexto(p['CÓDIGO DO PAD'], 80), bloco: limparTexto(p.BLOCO, 40) || null, bacia: limparTexto(p.BACIA, 60) || null,
    operador: limparTexto(p.OPERADOR, 80) || null, situacao: limparTexto(p['SITUAÇÃO'], 80) || null,
    inicio: dataIso(p['INÍCIO EFETIVO']), termino_previsto: dataIso(p['TÉRMINO PREVISTO']),
  }));
  const declaracoes = (d.declaracoes || []).filter((p) => ehMar(p.AMBIENTE)).map((p) => ({
    area: limparTexto(p['ÁREA DE DESENVOLVIMENTO'], 80), bacia: limparTexto(p.BACIA, 60) || null,
    operador: limparTexto(p.OPERADOR_DC || p.OPERADOR, 80) || null, data: dataIso(p['DATA DECLARAÇÃO COMERCIALIDADE']),
  })).filter((x) => x.area && x.data).sort((a, b) => b.data.localeCompare(a.data));
  const blocos = (d.blocos || []).filter((b) => ehMar(b.AMBIENTE));
  const porBacia = {};
  for (const b of blocos) { const k = limparTexto(b.BACIA, 60) || 'Não informada'; porBacia[k] = (porBacia[k] || 0) + 1; }
  const anoRef = d.anoExploracao || (pocos[0] && +pocos[0].inicio.slice(0, 4)) || null;
  return {
    referencia: d.refExploracao || null,
    pocos: pocos.slice(0, 120),
    pads,
    declaracoes: declaracoes.slice(0, 60),
    blocos: { total: blocos.length, por_bacia: Object.entries(porBacia).sort((a, b) => b[1] - a[1]).map(([bacia, n]) => ({ bacia, n })) },
    resumo: {
      ano: anoRef,
      pocos_iniciados_ano: anoRef ? pocos.filter((p) => p.inicio.startsWith(String(anoRef))).length : null,
      descobertas_ano: anoRef ? pocos.filter((p) => p.data_descoberta && p.data_descoberta.startsWith(String(anoRef))).length : null,
      em_perfuracao: pocos.filter((p) => !p.conclusao).length,
      pads_andamento: pads.length,
      blocos_sob_contrato: blocos.length,
    },
  };
}

/* ─── Futuro (previsões informadas pelas operadoras à ANP) ─────────────────── */

const ATIVIDADES_FUTURO = [
  'Perfuração - produtor', 'Perfuração - injetor', 'Perfuração - exploratório', 'Completação para produção',
  'UEP - instalação', 'UEP - construção', 'Coleta - linhas - lançamento (inclui risers)',
  'Descomissionamento - desmobilização UEP', 'Abandono Permanente',
];

export function construirFuturo(d) {
  const inv = {};
  for (const l of (d.investimentoBacia || []).filter((x) => ehMar(x.AMBIENTE))) {
    const ano = numero(l.ANO), v = numero(l['INVESTIMENTO R$']);
    if (!ano || v === null) continue;
    inv[ano] = inv[ano] || { ano, total_rs: 0, bacias: {} };
    inv[ano].total_rs += v;
    const b = limparTexto(l.BACIA, 60);
    inv[ano].bacias[b] = (inv[ano].bacias[b] || 0) + v;
  }
  const atividades = {};
  for (const l of (d.previsaoAtividade || []).filter((x) => ehMar(x.AMBIENTE))) {
    const tipo = limparTexto(l['TIPO ATIVIDADE'], 80);
    if (!ATIVIDADES_FUTURO.includes(tipo)) continue;
    const ano = numero(l.ANO), q = numero(l['QUANTIDADE ATIVIDADE']);
    if (!ano || q === null) continue;
    atividades[tipo] = atividades[tipo] || { tipo, unidade: limparTexto(l['UNIDADE DA ATIVIDADE'], 30), anos: {} };
    atividades[tipo].anos[ano] = (atividades[tipo].anos[ano] || 0) + q;
  }
  const producao = {};
  for (const l of (d.previsaoProducao || []).filter((x) => ehMar(x.AMBIENTE))) {
    const ano = numero(l.ANO), vazao = numero(l['VAZÃO PETRÓLEO']), gas = numero(l['VAZÃO GÁS']);
    if (!ano || vazao === null) continue;
    producao[ano] = producao[ano] || { ano, petroleo_bbl_d: 0, gas_mil_m3_d: 0 };
    producao[ano].petroleo_bbl_d += vazao * M3_PARA_BARRIL; // vazão em m³/d
    producao[ano].gas_mil_m3_d += gas || 0;
  }
  const pte = (d.previsaoExploracao || []).filter((x) => ehMar(x.AMBIENTE));
  const refPte = Math.max(0, ...pte.map((x) => numero(x['Ano Referência']) || 0)) || null;
  const invExp = {};
  for (const l of pte.filter((x) => numero(x['Ano Referência']) === refPte)) {
    const ano = numero(l['Ano Atividade']), v = numero(l['INVESTIMENTO (milhares R$)']);
    if (!ano || v === null) continue;
    invExp[ano] = (invExp[ano] || 0) + v * 1000;
  }
  return {
    investimento_mar: Object.values(inv).sort((a, b) => a.ano - b.ano).map((x) => ({
      ano: x.ano, total_rs: Math.round(x.total_rs),
      bacias: Object.entries(x.bacias).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([bacia, v]) => ({ bacia, rs: Math.round(v) })),
    })),
    atividades_mar: Object.values(atividades),
    producao_prevista_mar: Object.values(producao).sort((a, b) => a.ano - b.ano).map((x) => ({ ano: x.ano, petroleo_bbl_d: Math.round(x.petroleo_bbl_d), gas_mil_m3_d: Math.round(x.gas_mil_m3_d) })),
    exploracao_prevista_mar: { ano_referencia: refPte, investimento: Object.entries(invExp).map(([ano, rs]) => ({ ano: +ano, rs: Math.round(rs) })).sort((a, b) => a.ano - b.ano) },
  };
}
