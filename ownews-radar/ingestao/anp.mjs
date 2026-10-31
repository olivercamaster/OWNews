/**
 * Fonte oficial → arquivo validado. Roda no VPS (Node), nunca no worker nem no navegador.
 *
 *   descobrirArquivos(fonte)  lê a página oficial e escolhe o(s) arquivo(s) vigente(s)
 *   baixar(url)               download com tempo limite e tentativas
 *   lerFonte(fonte, bytes)    decodifica, lê o CSV e VALIDA (colunas essenciais, volume plausível)
 */
import { MESES_ARQUIVO } from '../fontes.mjs';
import { csvParaObjetos, decodificar } from '../lib/texto.mjs';

const UA = 'Mozilla/5.0 (compatible; OWNewsRadar/1.0; +https://ownews.com.br/radar-offshore)';
const paginasEmCache = new Map();

export async function baixar(url, { tentativas = 3, tempoMs = 120000 } = {}) {
  let ultimoErro;
  for (let i = 0; i < tentativas; i++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), tempoMs);
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: ctrl.signal });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return new Uint8Array(await r.arrayBuffer());
    } catch (e) {
      ultimoErro = e;
      await new Promise((ok) => setTimeout(ok, 2000 * (i + 1)));
    } finally { clearTimeout(t); }
  }
  throw new Error(`download falhou (${url.split('/').pop()}): ${ultimoErro && ultimoErro.message}`);
}

async function pagina(url) {
  if (!paginasEmCache.has(url)) paginasEmCache.set(url, new TextDecoder().decode(await baixar(url)));
  return paginasEmCache.get(url);
}

/** Ordena candidatos: por ano (grupo 1) e mês abreviado (grupo 2), mais recente primeiro. */
export function escolherArquivos(links, fonte) {
  const casados = [];
  for (const href of new Set(links)) {
    const m = fonte.padrao.exec(href);
    if (!m) continue;
    const ano = m[1] ? +m[1] : 0;
    const mes = m[2] ? MESES_ARQUIVO.indexOf(m[2]) + 1 : 0;
    if (m[2] && mes === 0) continue;
    casados.push({ url: href, ano, mes, ordem: ano * 100 + mes });
  }
  casados.sort((a, b) => b.ordem - a.ordem || a.url.localeCompare(b.url));
  return casados.slice(0, fonte.quantos || 1);
}

export async function descobrirArquivos(fonte) {
  const html = await pagina(fonte.pagina);
  const links = [...html.matchAll(/href="(https?:\/\/[^"]+\.csv)"/gi)].map((m) => m[1]);
  const escolhidos = escolherArquivos(links, fonte);
  if (!escolhidos.length) throw new Error(`nenhum arquivo casa com o padrão na página oficial (${fonte.nome})`);
  return escolhidos;
}

/** Decodifica e valida. Erro = snapshot anterior continua valendo. */
export function lerFonte(fonte, bytes) {
  let texto;
  try { texto = decodificar(bytes, fonte.encoding); } catch { throw new Error(`encoding inesperado (esperado ${fonte.encoding})`); }
  if (/<html|<!doctype/i.test(texto.slice(0, 400))) throw new Error('a ANP devolveu uma página HTML no lugar do CSV');
  const { colunas, linhas } = csvParaObjetos(texto, fonte.separador);
  const faltando = fonte.essenciais.filter((c) => !colunas.includes(c));
  if (faltando.length) throw new Error(`colunas essenciais ausentes: ${faltando.join(', ')}`);
  const validas = linhas.filter((l) => String(l[fonte.chave] || '').trim());
  if (validas.length < fonte.minimo) throw new Error(`volume implausível: ${validas.length} linhas (mínimo ${fonte.minimo})`);
  if (validas.length > fonte.maximo) throw new Error(`volume implausível: ${validas.length} linhas (máximo ${fonte.maximo})`);
  return { colunas, linhas: validas };
}
