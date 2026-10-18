/**
 * Matriz da Minha Escala contra um ORÁCULO independente.
 *
 * O domínio calcula a fase do ciclo por aritmética modular sobre Date.UTC.
 * O oráculo abaixo não usa Date: anda dia a dia num calendário próprio
 * (anos bissextos, meses de 28–31 dias) com contadores de bloco. Se os dois
 * concordam em todos os dias de ~3 anos, para todos os ciclos e referências,
 * a regra canônica está certa — inclusive na virada de mês/ano e em fevereiro.
 *
 * Também confere: calendário (gerarMesDias) = regra canônica; resumo/Home =
 * oráculo; exceções só visuais; Cruzar; validação de ciclo; fusos horários.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

register('./_ts-resolver.mjs', import.meta.url);
const D = await import('../../../packages/ow-domain/src/index.ts');

// ─── Oráculo: calendário próprio, sem Date ──────────────────────────────────
const bissexto = y => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const diasNoMes = (y, m) => [31, bissexto(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
const p2 = n => String(n).padStart(2, '0');
const iso = (y, m, d) => `${y}-${p2(m)}-${p2(d)}`;
function proximo(s) {
  let [y, m, d] = s.split('-').map(Number);
  d++;
  if (d > diasNoMes(y, m)) { d = 1; m++; if (m > 12) { m = 1; y++; } }
  return iso(y, m, d);
}
function anterior(s) {
  let [y, m, d] = s.split('-').map(Number);
  d--;
  if (d < 1) { m--; if (m < 1) { m = 12; y--; } d = diasNoMes(y, m); }
  return iso(y, m, d);
}

/** Mapa iso → { embarcado, diaDoBloco } de `de` até `ate`, andando dia a dia. */
function oraculo(dEm, dFo, dataRef, tipoRef, de, ate) {
  // estado no dia de referência
  let embarcado = tipoRef === 'embarquei';
  let dia = 1;
  // volta até antes de `de` (desfazendo os contadores)
  let cur = dataRef;
  while (cur > de) {
    cur = anterior(cur);
    dia--;
    if (dia < 1) { embarcado = !embarcado; dia = embarcado ? dEm : dFo; }
  }
  const out = new Map();
  while (cur <= ate) {
    if (cur >= de) out.set(cur, { embarcado, diaDoBloco: dia });
    cur = proximo(cur);
    dia++;
    if (dia > (embarcado ? dEm : dFo)) { embarcado = !embarcado; dia = 1; }
  }
  return out;
}

const CICLOS = [
  ['14x14', 14, 14], ['14x21', 14, 21], ['14x28', 14, 28], ['21x21', 21, 21], ['28x28', 28, 28], ['7x7', 7, 7],
  ['custom', 1, 1], ['custom', 5, 2], ['custom', 21, 28], ['custom', 35, 35], ['custom', 15, 13], ['custom', 120, 120],
];
const REFS = ['2026-10-12', '2024-02-29', '2025-12-31', '2026-01-31', '2027-03-01', '2028-02-29', '2026-02-28', '2030-12-01'];
const DE = '2025-06-01';
const ATE = '2028-06-30';

function cfgDe([tipo, dEm, dFo], dataRef, tipoRef) {
  return tipo === 'custom'
    ? { tipo, diasEmbarcado: dEm, diasFolga: dFo, dataRef, tipoRef }
    : { tipo, dataRef, tipoRef };
}

test('calcEscalaISO = oráculo em todos os dias de 3 anos (12 ciclos × 8 referências × embarquei/desembarquei)', () => {
  let checados = 0;
  for (const c of CICLOS) {
    for (const ref of REFS) {
      for (const tipoRef of ['embarquei', 'desembarquei']) {
        const cfg = cfgDe(c, ref, tipoRef);
        // Convenção: "desembarquei em X" = X é o 1º dia de folga.
        const mapa = oraculo(c[1], c[2], ref, tipoRef === 'embarquei' ? 'embarquei' : 'folga', DE, ATE);
        for (const [dia, esperado] of mapa) {
          const calc = D.calcEscalaISO(cfg, dia);
          assert.ok(calc, `${c} ${ref} ${tipoRef} ${dia}: calc nulo`);
          if (calc.embarcado !== esperado.embarcado || calc.diaDoBloco !== esperado.diaDoBloco) {
            assert.fail(`${c[0]} ${c[1]}x${c[2]} ref=${ref} ${tipoRef} dia=${dia}: ` +
              `esperado ${esperado.embarcado ? 'EMB' : 'FOLGA'} D${esperado.diaDoBloco}, ` +
              `veio ${calc.embarcado ? 'EMB' : 'FOLGA'} D${calc.diaDoBloco}`);
          }
          checados++;
        }
      }
    }
  }
  assert.ok(checados > 200_000, `checados=${checados}`);
});

test('dia de referência: "embarquei" = EMB D1; "desembarquei" = FOLGA D1 (todos os ciclos)', () => {
  for (const c of CICLOS) {
    for (const ref of REFS) {
      const e = D.calcEscalaISO(cfgDe(c, ref, 'embarquei'), ref);
      assert.equal(e.embarcado, true); assert.equal(e.diaDoBloco, 1);
      const f = D.calcEscalaISO(cfgDe(c, ref, 'desembarquei'), ref);
      assert.equal(f.embarcado, false); assert.equal(f.diaDoBloco, 1);
      // véspera do embarque: último dia de folga
      const v = D.calcEscalaISO(cfgDe(c, ref, 'embarquei'), anterior(ref));
      assert.equal(v.embarcado, false); assert.equal(v.diaDoBloco, c[2]);
    }
  }
});

test('calendário (gerarMesDias) usa exatamente a regra canônica em 36 meses, com marcadores EMB/DEB', () => {
  for (const c of CICLOS.slice(0, 8)) {
    const cfg = cfgDe(c, '2026-10-12', 'embarquei');
    for (let ano = 2026; ano <= 2028; ano++) {
      for (let mes = 1; mes <= 12; mes++) {
        const dias = D.gerarMesDias(cfg, [], [], ano, mes, '2026-10-18');
        assert.equal(dias.length, diasNoMes(ano, mes), `${ano}-${mes} tamanho`);
        for (const d of dias) {
          const calc = D.calcEscalaISO(cfg, d.iso);
          assert.equal(d.kind, calc.embarcado ? 'EMBARCADO' : 'FOLGA', d.iso);
          assert.equal(d.diaDoBloco, calc.diaDoBloco, d.iso);
          assert.equal(d.isEmbarque, calc.embarcado && calc.diaDoBloco === 1, `EMB ${d.iso}`);
          assert.equal(d.isDesembarque, !calc.embarcado && calc.diaDoBloco === 1, `DEB ${d.iso}`);
        }
      }
    }
  }
});

test('resumo da Home/Meu Embarque = oráculo: próximo embarque, desembarque e contagens', () => {
  for (const c of CICLOS) {
    for (const tipoRef of ['embarquei', 'desembarquei']) {
      const cfg = cfgDe(c, '2026-10-12', tipoRef);
      const mapa = oraculo(c[1], c[2], '2026-10-12', tipoRef === 'embarquei' ? 'embarquei' : 'folga', '2026-01-01', '2028-12-31');
      for (let hoje = '2026-12-20'; hoje <= '2027-03-10'; hoje = proximo(hoje)) {
        const r = D.resumoEscala(cfg, new Date(hoje + 'T15:00:00'));
        assert.equal(r.hojeISO, hoje);
        // próximo EMB D1 estritamente depois de hoje
        let emb = proximo(hoje); let n = 1;
        while (!(mapa.get(emb).embarcado && mapa.get(emb).diaDoBloco === 1)) { emb = proximo(emb); n++; }
        let deb = proximo(hoje); let k = 1;
        while (!(!mapa.get(deb).embarcado && mapa.get(deb).diaDoBloco === 1)) { deb = proximo(deb); k++; }
        const est = mapa.get(hoje);
        assert.equal(r.estado, est.embarcado ? 'EMBARCADO' : 'DE_FOLGA', hoje);
        assert.equal(r.proximoEmbarqueISO, emb, `${c} ${tipoRef} hoje=${hoje} próximo embarque`);
        assert.equal(r.diasParaEmbarque, n, `${hoje} dias p/ embarque`);
        assert.equal(r.proximoDesembarqueISO, deb, `${hoje} próximo desembarque`);
        assert.equal(r.diasParaDesembarque, k, `${hoje} dias p/ desembarque`);
      }
    }
  }
});

test('caso histórico: embarque dia 12 → 12 é EMB D1 em qualquer mês (inclui 31 dias, fevereiro e bissexto)', () => {
  for (const ref of ['2026-01-12', '2026-02-12', '2028-02-12', '2026-03-12', '2026-07-12', '2026-12-12']) {
    const cfg = { tipo: '14x14', dataRef: ref, tipoRef: 'embarquei' };
    const r = D.resumoEscala(cfg, new Date(ref + 'T08:00:00'));
    assert.equal(r.estado, 'EMBARCADO'); assert.equal(r.calc.diaDoBloco, 1);
    assert.equal(r.proximoDesembarqueISO, D.somarDiasISO(ref, 14));
    const vespera = D.resumoEscala(cfg, new Date(anterior(ref) + 'T23:59:00'));
    assert.equal(vespera.estado, 'DE_FOLGA'); assert.equal(vespera.diasParaEmbarque, 1);
    assert.equal(vespera.proximoEmbarqueISO, ref);
  }
});

test('mudar a data de referência para outro dia do MESMO ciclo não muda nada; para outro dia, desloca', () => {
  const a = { tipo: '14x21', dataRef: '2026-10-12', tipoRef: 'embarquei' };
  const b = { tipo: '14x21', dataRef: '2026-11-16', tipoRef: 'embarquei' }; // +35 = 1 ciclo
  const c = { tipo: '14x21', dataRef: '2026-08-17', tipoRef: 'desembarquei' }; // 12/10 - 35 + 14... ver abaixo
  for (let d = '2026-01-01'; d <= '2027-12-31'; d = proximo(d)) {
    assert.deepEqual(D.calcEscalaISO(a, d), D.calcEscalaISO(b, d), d);
  }
  // desembarque 26/10 (12/10 + 14) é a mesma escala que "embarquei 12/10"
  const deb = { tipo: '14x21', dataRef: '2026-10-26', tipoRef: 'desembarquei' };
  for (let d = '2026-01-01'; d <= '2027-12-31'; d = proximo(d)) {
    assert.deepEqual(D.calcEscalaISO(deb, d), D.calcEscalaISO(a, d), d);
  }
  assert.ok(c);
});

test('dobra e férias são só visuais — atravessando mês e ano, sem deslocar o ciclo', () => {
  const cfg = { tipo: '14x14', dataRef: '2026-12-20', tipoRef: 'embarquei' };
  const exc = [
    { id: 'f', tipo: 'ferias', ini: '2026-12-28', fim: '2027-01-15' },
    { id: 'd', tipo: 'dobra', ini: '2027-01-31', fim: '2027-02-02' },
  ];
  const dez = D.gerarMesDias(cfg, exc, [], 2026, 12, '2026-12-01');
  const jan = D.gerarMesDias(cfg, exc, [], 2027, 1, '2026-12-01');
  const fev = D.gerarMesDias(cfg, exc, [], 2027, 2, '2026-12-01');
  const todos = [...dez, ...jan, ...fev];
  for (const d of todos) {
    const base = D.calcEscalaISO(cfg, d.iso);
    assert.equal(d.diaDoBloco, base.diaDoBloco, d.iso);
    const esperadoKind = (d.iso >= '2026-12-28' && d.iso <= '2027-01-15') ? 'FERIAS'
      : (d.iso >= '2027-01-31' && d.iso <= '2027-02-02') ? 'DOBRA'
      : base.embarcado ? 'EMBARCADO' : 'FOLGA';
    assert.equal(d.kind, esperadoKind, d.iso);
    assert.equal(d.isEmbarque, base.embarcado && base.diaDoBloco === 1);
  }
  assert.deepEqual(D.resumoEscala({ ...cfg, excecoes: exc }, new Date('2027-01-05T12:00:00')),
    D.resumoEscala(cfg, new Date('2027-01-05T12:00:00')));
});

test('eventos simultâneos no mesmo dia aparecem juntos; evento de vários dias cobre o intervalo (virada de ano)', () => {
  const cfg = { tipo: '14x14', dataRef: '2026-10-12', tipoRef: 'embarquei' };
  const ev = [
    { id: '1', tipo: 'VIAGEM', nome: 'a', data_ini: '2026-12-30', data_fim: '2027-01-02' },
    { id: '2', tipo: 'CURSO', nome: 'b', data_ini: '2027-01-01' },
    { id: '3', tipo: 'DATA_ESPECIAL', nome: 'c', data_ini: '2027-01-01', _deleted: true },
  ];
  const jan = D.gerarMesDias(cfg, [], ev, 2027, 1, '2026-12-01');
  assert.deepEqual(jan[0].eventosPessoais.map(e => e.id), ['1', '2']);
  assert.deepEqual(jan[1].eventosPessoais.map(e => e.id), ['1']);
  assert.deepEqual(jan[2].eventosPessoais.map(e => e.id), []);
  assert.equal(jan[0].feriado?.nome, 'Ano-Novo');
});

test('ciclo inválido nunca vira escala: vazio, zero, negativo, fração, gigante, data inexistente', () => {
  const ruins = [
    { tipo: 'custom', dataRef: '2026-10-12', tipoRef: 'embarquei' },
    { tipo: 'custom', diasEmbarcado: 0, diasFolga: 14, dataRef: '2026-10-12', tipoRef: 'embarquei' },
    { tipo: 'custom', diasEmbarcado: -5, diasFolga: 14, dataRef: '2026-10-12', tipoRef: 'embarquei' },
    { tipo: 'custom', diasEmbarcado: 14, diasFolga: 999, dataRef: '2026-10-12', tipoRef: 'embarquei' },
    { tipo: '14x14', dataRef: '2026-02-30', tipoRef: 'embarquei' },
    { tipo: '14x14', dataRef: '12/10/2026', tipoRef: 'embarquei' },
    { tipo: '14x14', dataRef: '', tipoRef: 'embarquei' },
  ];
  for (const r of ruins) {
    assert.equal(D.calcEscalaISO(r, '2026-10-20'), null, JSON.stringify(r));
    assert.equal(D.resumoEscala(r).estado, 'SEM_ESCALA');
  }
  assert.equal(D.validarDiasBloco(14), true);
  assert.equal(D.validarDiasBloco(14.5), false);
  assert.equal(D.validarDiasBloco(D.DIAS_BLOCO_MAX + 1), false);
  assert.equal(D.isoValido('2028-02-29'), true);
  assert.equal(D.isoValido('2027-02-29'), false);
});

// ─── Cruzar escalas ─────────────────────────────────────────────────────────

test('Cruzar = interseção de folgas do oráculo; dobra minha nunca vira folga em comum', () => {
  const a = { tipo: '14x14', dataRef: '2026-10-12', tipoRef: 'embarquei' };
  const b = { tipo: '14x21', dataRef: '2026-10-20', tipoRef: 'embarquei' };
  const ma = oraculo(14, 14, '2026-10-12', 'embarquei', '2026-10-01', '2027-06-30');
  const mb = oraculo(14, 21, '2026-10-20', 'embarquei', '2026-10-01', '2027-06-30');
  const janelas = D.encontrarJanelasJuntos(a, b, '2026-10-18', 180, 50);
  const livres = new Set();
  for (const j of janelas) for (let d = j.inicio; d <= j.fim; d = proximo(d)) livres.add(d);
  let d = '2026-10-18';
  for (let i = 0; i < 180; i++, d = proximo(d)) {
    const ambos = !ma.get(d).embarcado && !mb.get(d).embarcado;
    assert.equal(livres.has(d), ambos, d);
  }
  // dobra no meio de uma folga em comum quebra a janela
  const primeira = janelas[0];
  const meio = D.somarDiasISO(primeira.inicio, 1);
  const comDobra = { ...a, excecoes: [{ id: 'x', tipo: 'dobra', ini: meio, fim: meio }] };
  const j2 = D.encontrarJanelasJuntos(comDobra, b, '2026-10-18', 180, 50);
  for (const j of j2) assert.ok(!(meio >= j.inicio && meio <= j.fim), 'dia de dobra dentro de janela');
  // escala secundária inválida → nenhuma janela (antes: "sempre de folga")
  assert.deepEqual(D.encontrarJanelasJuntos(a, { tipo: 'custom', dataRef: '2026-10-12', tipoRef: 'embarquei' }), []);
});

// ─── Fuso horário: o "hoje" é o dia civil do aparelho, em qualquer fuso ─────

const FUSOS = [
  'America/Sao_Paulo', 'America/Noronha', 'America/Manaus', 'America/Rio_Branco',
  'UTC', 'Europe/London', 'America/New_York', 'Asia/Dubai', 'Asia/Singapore',
  'Australia/Perth', 'Pacific/Auckland', 'Pacific/Kiritimati', 'Pacific/Pago_Pago',
];

test('fusos (BR, DST de Londres/Nova York/Auckland, +14 e -11): "hoje" e calendário batem com o dia civil local', () => {
  const script = fileURLToPath(new URL('./_fuso-probe.mjs', import.meta.url));
  for (const tz of FUSOS) {
    const r = spawnSync(process.execPath, [script], { env: { ...process.env, TZ: tz }, encoding: 'utf8' });
    assert.equal(r.status, 0, `${tz}: ${r.stderr}`);
    const out = JSON.parse(r.stdout.trim().split('\n').pop());
    assert.deepEqual(out.erros, [], `${tz}: ${out.erros.slice(0, 3).join(' | ')}`);
    assert.ok(out.checados >= 500, tz);
  }
});

test('certificado: dias contados do dia civil local (às 22:00 de Brasília ainda é "hoje")', () => {
  // rodado no fuso deste processo; o probe cobre os outros fusos
  const cert = { id: 'c', nome: 'x', validade: '2026-10-20' };
  const noite = new Date(2026, 9, 20, 22, 30);
  assert.equal(D.calcCertStatus(cert, noite).status, 'vence-hoje');
  assert.equal(D.calcCertStatus(cert, new Date(2026, 9, 19, 23, 59)).dias, 1);
  assert.equal(D.calcCertStatus(cert, new Date(2026, 9, 21, 0, 1)).status, 'vencido');
  assert.equal(D.calcCertStatus({ id: 'x', nome: 'y', validade: '2026-13-01' }).status, 'sem-data');
});
