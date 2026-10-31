/**
 * Utilitários puros do Radar Offshore (sem rede, sem I/O): decodificação, CSV, números e
 * datas no formato da ANP, normalização de nomes e slugs. Usados pela ingestão e pelos testes.
 */

/** Bytes → texto. ISO-8859-1 é 1:1 com os primeiros 256 code points; BOM UTF-8 removido. */
export function decodificar(bytes, encoding) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (/^(iso-8859-1|latin1|windows-1252)$/i.test(encoding)) {
    let s = '';
    for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192));
    return s;
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(u8).replace(/^﻿/, '');
}

/** CSV com aspas (RFC 4180) e separador configurável. Devolve linhas de células. */
export function lerCsv(texto, separador = ',') {
  const linhas = [];
  let celula = '', linha = [], aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) {
      if (c === '"') { if (texto[i + 1] === '"') { celula += '"'; i++; } else aspas = false; }
      else celula += c;
    } else if (c === '"') aspas = true;
    else if (c === separador) { linha.push(celula); celula = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++;
      linha.push(celula); celula = '';
      if (linha.length > 1 || linha[0] !== '') linhas.push(linha);
      linha = [];
    } else celula += c;
  }
  if (celula !== '' || linha.length) { linha.push(celula); linhas.push(linha); }
  return linhas;
}

/** Cabeçalho limpo: sem colchetes "[...]", sem BOM, espaços normalizados. */
export function limparCabecalho(h) {
  return String(h || '').replace(/^﻿/, '').replace(/^\[|\]$/g, '').replace(/\s+/g, ' ').trim();
}

/** Linhas → objetos com o cabeçalho limpo. */
export function csvParaObjetos(texto, separador) {
  const [cab, ...resto] = lerCsv(texto, separador);
  const chaves = (cab || []).map(limparCabecalho);
  return { colunas: chaves, linhas: resto.map((l) => Object.fromEntries(chaves.map((k, i) => [k, (l[i] ?? '').trim()]))) };
}

/** Texto externo seguro: sem caracteres de controle, espaços colapsados, tamanho limitado. */
export function limparTexto(s, max = 200) {
  return String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

/** Número no padrão ANP: "1.234,56" → 1234.56; "-24,55964917" → -24.55964917; "" → null. */
export function numero(s) {
  const t = String(s ?? '').trim();
  if (!t) return null;
  const n = Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t);
  return Number.isFinite(n) ? n : null;
}

/** "dd/mm/aaaa" → "aaaa-mm-dd" (data inválida → null). */
export function dataIso(s) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(s ?? '').trim());
  if (!m) return null;
  const [, d, mes, a] = m;
  const dt = new Date(Date.UTC(+a, +mes - 1, +d));
  return dt.getUTCDate() === +d && dt.getUTCMonth() === +mes - 1 ? `${a}-${mes}-${d}` : null;
}

/** "mm/aaaa" → "aaaa-mm". */
export function mesIso(s) {
  const m = /^(\d{2})\/(\d{4})$/.exec(String(s ?? '').trim());
  return m && +m[1] >= 1 && +m[1] <= 12 ? `${m[2]}-${m[1]}` : null;
}

/** Coordenada "-21:20:01,787" (graus:min:seg) ou decimal → graus decimais. */
export function coordenada(s) {
  const t = String(s ?? '').trim();
  const m = /^(-?)(\d{1,3}):(\d{1,2}):(\d{1,2}(?:[,.]\d+)?)$/.exec(t);
  if (m) {
    const v = +m[2] + +m[3] / 60 + Number(m[4].replace(',', '.')) / 3600;
    return m[1] ? -v : v;
  }
  return numero(t);
}

/** Chave de comparação: sem acento, maiúscula, espaços simples. NÃO é usada para exibir. */
export function chaveNome(s) {
  return String(s ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
}

/** Slug estável para URL: "FPSO Almirante Barroso" → "fpso-almirante-barroso". */
export function slug(s) {
  return String(s ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/&/g, ' e ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

/** Nome de exibição a partir de MAIÚSCULAS da ANP, sem inventar grafia: siglas e números ficam. */
const MINUSCULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'a', 'o']);
const SIGLAS = new Set(['S.A', 'S/A', 'LLC', 'SPE', 'COSL', 'FPSO', 'FSO', 'TLP', 'SS', 'NS', 'PA', 'UEP', 'BW', 'SBM', 'OSX', 'MV', 'PRIO', 'ECO', 'ANC', 'S.A.', 'SA', 'LTDA', 'LTDA.', 'EP', 'UK', 'BR', 'RJ', 'ES', 'SP', 'SE', 'AL', 'RN', 'CE', 'BA', 'PR', 'SC', 'PETROBRAS']);
/** Grafia oficial de marcas que a ANP publica em maiúsculas. */
const MARCAS = { PETROBRAS: 'Petrobras', TOTALENERGIES: 'TotalEnergies', SEADRILL: 'Seadrill', TRANSOCEAN: 'Transocean', EQUINOR: 'Equinor' };
export function nomeExibicao(s) {
  const t = limparTexto(s, 120);
  if (t !== t.toUpperCase()) return t;
  return t.split(' ').map((p, i) => {
    const l = p.toLowerCase();
    if (i > 0 && MINUSCULAS.has(l)) return l;
    if (MARCAS[p]) return MARCAS[p];
    if (/\d/.test(p) || SIGLAS.has(p) || /^[IVX]+$/.test(p)) return p;
    return l.replace(/(^|[-/(_])([a-zà-ÿ])/g, (_, a, b) => a + b.toUpperCase());
  }).join(' ');
}

/** Mês ISO "2026-08" → "agosto de 2026". */
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export function mesPorExtenso(iso) {
  const m = /^(\d{4})-(\d{2})/.exec(String(iso || ''));
  return m ? `${MESES[+m[2] - 1]} de ${m[1]}` : '';
}

/** Dias do mês ISO "2026-02" (para converter volume mensal em vazão diária). */
export function diasNoMes(iso) {
  const [a, m] = String(iso).split('-').map(Number);
  return new Date(Date.UTC(a, m, 0)).getUTCDate();
}

export const M3_PARA_BARRIL = 6.28981077;

/** Variações: absoluta, percentual (null se a base é 0) — nunca confundir com pontos percentuais. */
export function variacao(atual, anterior) {
  if (!Number.isFinite(atual) || !Number.isFinite(anterior)) return null;
  const absoluta = atual - anterior;
  return { absoluta, percentual: anterior === 0 ? null : (absoluta / anterior) * 100 };
}
