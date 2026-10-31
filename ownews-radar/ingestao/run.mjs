#!/usr/bin/env node
/**
 * Ingestão do Radar Offshore (VPS, crontab). Uso:
 *   node ingestao/run.mjs              → baixa, valida, normaliza e envia ao worker
 *   node ingestao/run.mjs --seco       → tudo, menos o envio (gera state/saida/*.json)
 *   node ingestao/run.mjs --so-noticias → reaproveita as bases e só refaz notícias relacionadas
 *
 * Fonte que falhar (rede, HTML no lugar do CSV, coluna faltando, volume implausível) NÃO
 * substitui a anterior: o último dado válido continua valendo e o status registra a falha.
 * Logs estruturados (JSON por linha): dataset_refresh_success | dataset_refresh_failed |
 * dataset_validation_failed | snapshot_sent | snapshot_unchanged.
 *
 * Variáveis: RADAR_ESTADO (padrão ~/ownews-radar-state), RADAR_WORKER_URL, RADAR_INGEST_SECRET.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { FONTES, NOTICIAS, ATRIBUICAO } from '../fontes.mjs';
import { baixar, descobrirArquivos, lerFonte } from './anp.mjs';
import { construirSnapshot } from './normalizar.mjs';
import { relacionarNoticias, vagasPorOperador } from './noticias.mjs';
import { detectarPautas } from './pautas.mjs';
import { baixarCamada, ligarCamposAoRadar } from './geo.mjs';

const ESTADO = process.env.RADAR_ESTADO || join(homedir(), 'ownews-radar-state');
const SECO = process.argv.includes('--seco');
const SO_NOTICIAS = process.argv.includes('--so-noticias');
for (const d of ['', 'fontes', 'saida']) mkdirSync(join(ESTADO, d), { recursive: true });

const lerJson = (f, padrao = null) => { try { return JSON.parse(readFileSync(join(ESTADO, f), 'utf8')); } catch { return padrao; } };
const gravarJson = (f, v) => writeFileSync(join(ESTADO, f), JSON.stringify(v));
function log(evento, dados = {}) {
  const linha = JSON.stringify({ em: new Date().toISOString(), evento, ...dados });
  console.log(linha);
  appendFileSync(join(ESTADO, 'ingestao.log'), linha + '\n');
}

/** Baixa/valida uma fonte; em falha devolve o último dado válido (marcado). */
async function obterFonte(id, fonte) {
  const anterior = lerJson(`fontes/${id}.json`);
  if (SO_NOTICIAS && anterior) return anterior;
  try {
    const arquivos = await descobrirArquivos(fonte);
    const linhas = [];
    for (const a of arquivos) linhas.push(...lerFonte(fonte, await baixar(a.url)).linhas);
    const ref = arquivos[0];
    const registro = {
      id, nome: fonte.nome, arquivo: ref.url, arquivos: arquivos.map((a) => a.url),
      referencia: ref.mes ? `${ref.ano}-${String(ref.mes).padStart(2, '0')}` : ref.ano ? String(ref.ano) : null,
      baixado_em: new Date().toISOString(), status: 'ok', linhas,
    };
    const hash = createHash('sha256').update(JSON.stringify(linhas)).digest('hex').slice(0, 16);
    registro.hash = hash;
    registro.mudou_em = anterior && anterior.hash === hash ? anterior.mudou_em : registro.baixado_em;
    gravarJson(`fontes/${id}.json`, registro);
    log('dataset_refresh_success', { dataset: id, linhas: linhas.length, mudou: !anterior || anterior.hash !== hash });
    return registro;
  } catch (e) {
    const tipo = /colunas|volume|encoding|HTML/.test(e.message) ? 'dataset_validation_failed' : 'dataset_refresh_failed';
    log(tipo, { dataset: id, erro: e.message.slice(0, 200) });
    if (anterior) return { ...anterior, status: 'falhou', erro: e.message.slice(0, 200), tentou_em: new Date().toISOString() };
    return null;
  }
}

async function buscarJson(url, headers = {}) {
  const r = await fetch(url, { headers: { 'User-Agent': 'OWNewsRadar/1.0', ...headers } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

async function main() {
  const t0 = Date.now();
  const fontes = {};
  for (const [id, f] of Object.entries(FONTES)) fontes[id] = await obterFonte(id, f);
  const essenciais = ['plataformas', 'sondas', 'campos', 'concessionarios'];
  const faltando = essenciais.filter((id) => !fontes[id]);
  if (faltando.length) { log('snapshot_abortado', { motivo: `sem dado válido de: ${faltando.join(', ')}` }); process.exitCode = 1; return; }

  // fotos curadas do Radar de Unidades (opcional; falha = sem fotos)
  let curadas = lerJson('curadas.json', []);
  if (!SO_NOTICIAS) {
    try { const r = await buscarJson('https://ownews.com.br/api/buddy/unidades'); curadas = (r.unidades || []).map((u) => ({ slug: u.slug, nome: u.nome, foto_url: u.foto_url, foto_credito: u.foto_credito })); gravarJson('curadas.json', curadas); }
    catch (e) { log('curadas_falhou', { erro: e.message }); }
  }

  const slugsAnteriores = lerJson('slugs.json', {});
  const exp = fontes.pocos_exploratorios;
  const snap = construirSnapshot({
    plataformas: fontes.plataformas.linhas, sondas: fontes.sondas.linhas, anoSondas: fontes.sondas.referencia ? +fontes.sondas.referencia.slice(0, 4) : null,
    campos: fontes.campos.linhas, concessionarios: fontes.concessionarios.linhas,
    producao: fontes.producao_mar?.linhas || [],
    pocosExploratorios: exp?.linhas || [], padsAndamento: fontes.pads_andamento?.linhas || [],
    declaracoes: fontes.declaracoes_comercialidade?.linhas || [], blocos: fontes.blocos?.linhas || [],
    refExploracao: exp?.referencia || null, anoExploracao: exp?.referencia ? +exp.referencia.slice(0, 4) : null,
    investimentoBacia: fontes.investimento_bacia?.linhas || [], previsaoAtividade: fontes.previsao_atividade?.linhas || [],
    previsaoProducao: fontes.previsao_producao?.linhas || [], previsaoExploracao: fontes.previsao_exploracao?.linhas || [],
    curadas, slugsAnteriores,
  });
  // slugs nunca são reatribuídos: acumula
  gravarJson('slugs.json', {
    unidades: { ...(slugsAnteriores.unidades || {}), ...snap.slugs.unidades },
    campos: { ...(slugsAnteriores.campos || {}), ...snap.slugs.campos },
    operadores: { ...(slugsAnteriores.operadores || {}), ...snap.slugs.operadores },
  });

  // geometrias (semanal; falha = mantém a anterior)
  const geo = {};
  for (const nome of ['campos', 'blocos', 'presal']) {
    const anterior = lerJson(`fontes/geo-${nome}.json`);
    const velha = !anterior || Date.now() - Date.parse(anterior.baixado_em) > 7 * 86400000;
    if (velha && !SO_NOTICIAS) {
      try { const g = await baixarCamada(nome); geo[nome] = { baixado_em: new Date().toISOString(), g }; gravarJson(`fontes/geo-${nome}.json`, geo[nome]); log('dataset_refresh_success', { dataset: `geo-${nome}`, feicoes: g.features.length }); }
      catch (e) { log('dataset_refresh_failed', { dataset: `geo-${nome}`, erro: e.message.slice(0, 200) }); geo[nome] = anterior; }
    } else geo[nome] = anterior;
  }
  if (geo.campos) ligarCamposAoRadar(geo.campos.g, snap.campos);

  // notícias OWNews relacionadas (só leitura pública)
  let noticias = lerJson('saida/noticias.json', { unidades: {}, campos: {}, operadores: {} });
  try {
    const sel = 'id,title,buddy_summary,published_at';
    const artigos = await buscarJson(`${NOTICIAS.url}?select=${sel}&status=eq.published&order=published_at.desc&limit=${NOTICIAS.limite}`, { apikey: NOTICIAS.chave, Authorization: `Bearer ${NOTICIAS.chave}` });
    noticias = relacionarNoticias(artigos, snap);
    log('noticias_relacionadas', { artigos: artigos.length, unidades: Object.keys(noticias.unidades).length, campos: Object.keys(noticias.campos).length, operadores: Object.keys(noticias.operadores).length });
  } catch (e) { log('noticias_falhou', { erro: e.message }); }

  // vagas reais por operador (Radar de Vagas do OWNews)
  let vagas = lerJson('saida/vagas.json', {});
  try { const r = await buscarJson('https://ownews.com.br/api/buddy/vagas'); vagas = vagasPorOperador(r.vagas || [], snap.operadores); gravarJson('saida/vagas.json', vagas); }
  catch (e) { log('vagas_falhou', { erro: e.message }); }

  // pautas (candidatas, nunca publicadas sozinhas)
  const anterior = lerJson('saida/entidades.json');
  const novas = detectarPautas(anterior, snap);
  const pautas = [...novas, ...lerJson('saida/pautas.json', [])].slice(0, 200);

  const meta = {
    gerado_em: snap.gerado_em, atribuicao: ATRIBUICAO,
    fontes: Object.fromEntries(Object.entries(fontes).filter(([, f]) => f).map(([id, f]) => [id, {
      nome: f.nome, arquivo: f.arquivo, referencia: f.referencia, baixado_em: f.baixado_em, mudou_em: f.mudou_em || f.baixado_em, status: f.status, erro: f.erro || null,
    }])),
    geo: Object.fromEntries(Object.entries(geo).filter(([, g]) => g).map(([k, g]) => [k, { baixado_em: g.baixado_em }])),
    revisao: snap.revisao.length,
  };

  // Chaves do KV (cada página lê só o que usa)
  const busca = snap.unidades.map((u) => ({ id: u.id, slug: u.slug, nome: u.nome, categoria: u.categoria, tipo: u.tipo, sigla: u.sigla }));
  const saida = {
    'radar:meta': meta,
    'radar:resumo': { ...snap.resumo, gerado_em: snap.gerado_em },
    'radar:unidades': snap.unidades,
    'radar:campos': snap.campos,
    'radar:operadores': snap.operadores,
    'radar:producao': snap.producao,
    'radar:exploracao': snap.exploracao,
    'radar:futuro': snap.futuro,
    'radar:noticias': noticias,
    'radar:vagas': vagas,
    'radar:busca': busca,
    'radar:pautas': pautas,
    'radar:revisao': snap.revisao,
    ...(geo.campos ? { 'radar:geo:campos': geo.campos.g } : {}),
    ...(geo.blocos ? { 'radar:geo:blocos': geo.blocos.g } : {}),
    ...(geo.presal ? { 'radar:geo:presal': geo.presal.g } : {}),
  };
  gravarJson('saida/entidades.json', { unidades: snap.unidades, campos: snap.campos, producao: snap.producao, exploracao: snap.exploracao, futuro: snap.futuro });
  gravarJson('saida/noticias.json', noticias);
  gravarJson('saida/pautas.json', pautas);
  for (const [k, v] of Object.entries(saida)) writeFileSync(join(ESTADO, 'saida', `${k.replace(/:/g, '_')}.json`), JSON.stringify(v));

  if (SECO) { log('snapshot_seco', { chaves: Object.keys(saida).length, ms: Date.now() - t0 }); return; }
  const url = process.env.RADAR_WORKER_URL, segredo = process.env.RADAR_INGEST_SECRET;
  if (!url || !segredo) { log('snapshot_nao_enviado', { motivo: 'RADAR_WORKER_URL/RADAR_INGEST_SECRET ausentes' }); process.exitCode = 1; return; }
  const enviados = lerJson('enviados.json', {});
  // meta por último: quando ele chega, todo o resto já está no ar
  const ordem = Object.keys(saida).filter((k) => k !== 'radar:meta').concat('radar:meta');
  for (const chave of ordem) {
    const corpo = JSON.stringify(saida[chave]);
    const hash = createHash('sha256').update(corpo).digest('hex').slice(0, 16);
    if (enviados[chave] === hash && chave !== 'radar:meta') { continue; }
    const r = await fetch(`${url}/interno/snapshot?chave=${encodeURIComponent(chave)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Radar-Secret': segredo }, body: corpo });
    if (!r.ok) { log('snapshot_falhou', { chave, http: r.status }); process.exitCode = 1; continue; }
    enviados[chave] = hash;
    log('snapshot_sent', { chave, bytes: corpo.length });
  }
  gravarJson('enviados.json', enviados);
  log('ingestao_concluida', { ms: Date.now() - t0 });
}

main().catch((e) => { log('ingestao_erro', { erro: String(e && e.stack || e).slice(0, 400) }); process.exitCode = 1; });
