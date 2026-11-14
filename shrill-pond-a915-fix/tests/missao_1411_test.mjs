// Missão 14/11/2026 — testa o worker.js REAL do collector.
// 1) Extração: página com <article> de card (Sindipetro-NF/Elementor) não pode virar "sem_material".
// 2) Paywall continua curto (sem_material legítimo). 3) Página normal com <article> não muda.
// 4) Saúde do Telegram: candidato abaixo do limiar do slot não gera "garantia não cumprida" falsa.
// 5) Nenhum link/CTA público para o OffVoos no texto enviado pelo collector (Telegram/API).
// Uso: node --test tests/missao_1411_test.mjs
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let W, SRC;
before(async () => {
  SRC = fs.readFileSync(new URL('../worker.js', import.meta.url), 'utf8');
  const src = SRC.replace(/^const ([A-Z_0-9]+) = /gm, 'var $1 = ') +
    '\nexport { extrairConteudoMateria, contarElegiveisSlotTelegram, avaliarGarantiaMeioDiaTelegram, LIMIAR_SLOT_TELEGRAM };\n';
  const f = path.join(os.tmpdir(), `m1411-worker-${process.pid}.mjs`);
  fs.writeFileSync(f, src);
  W = await import('file://' + f);
});

const P = (t) => `<p>${t}</p>`;
const CORPO = [
  'Os trabalhadores da empresa na base do sindicato vão decidir, na quinta-feira (19), às 10h, se aprovam a proposta de termo aditivo ao acordo coletivo.',
  'A votação será realizada pela plataforma do sindicato, com prazo de 24 horas para que a categoria registre seu voto em assembleia virtual.',
  'De acordo com o edital, se a proposta for rejeitada, a categoria manterá o estado de assembleia permanente para novas deliberações.',
];
const RODAPE = 'Rua Tenente Rui Lopes Ribeiro, 257 Centro CEP 27910-330 Telefone: (22) 2765-9550 / (22) 99742-3547';
const CARD = (n) => `<article class="elementor-post"><a href="/x${n}">Outra notícia ${n} do sindicato</a><span>13/11/2026</span></article>`;

test('Sindipetro-NF: 1º <article> é card sem <p> → texto vem do contêiner do post, sem rodapé', () => {
  const html = `<html><body><nav>${P('DIRETORIA COLEGIADA CONSELHO FISCAL NF NAS INSTITUIÇÕES HISTÓRICO ESTATUTO FILIE-SE')}</nav>
${CARD(1)}${CARD(2)}${CARD(3)}
<div class="elementor-element paragrafo elementor-widget elementor-widget-theme-post-content"><div class="elementor-widget-container">
${CORPO.map(P).join('\n')}</div></div>
${'<div class="widget"><span>'.repeat(40)}${'x'.repeat(3000)}${'</span></div>'.repeat(40)}
<footer>${P(RODAPE)}</footer></body></html>`;
  const t = W.extrairConteudoMateria(html);
  assert.ok(t.length >= 300, 'material curto: ' + t.length);
  for (const c of CORPO) assert.ok(t.includes(c));
  assert.ok(!t.includes('Rua Tenente'), 'engoliu o rodapé');
});

test('paywall: só a linha fina → continua curto (sem_material legítimo, nada é inventado)', () => {
  const html = `<article><h2>Capacidade expandida</h2>${P('<em>Petrobras acredita que a estratégia de antecipação de 5 novas unidades resultará em 520 mil barris por dia</em>')}<p class="readmore"><a href="/login">Restrito a assinantes</a></p></article>`;
  assert.ok(W.extrairConteudoMateria(html).length < 300);
});

test('página normal com <article> completo: resultado igual ao de antes (só o <article>)', () => {
  const html = `<div class="entry-content">${P('Texto de outro lugar da página que não deve entrar porque o article já tem conteúdo suficiente.')}</div><article>${CORPO.map(P).join('')}</article>`;
  assert.equal(W.extrairConteudoMateria(html), CORPO.join('\n\n'));
});

test('Telegram /saude: melhor candidato com score 8 (< 12) → slot pulado honesto, não "havia candidato elegível"', () => {
  const resultados = [{ status: 'dry_run', pontuacao: 8 }, { status: 'ja_publicado', pontuacao: 30 }, { status: 'descartado_editorial', pontuacao: 2 }];
  assert.equal(W.contarElegiveisSlotTelegram(resultados), 0);
  const depoisDaJanela = Date.parse('2026-11-14T15:00:00Z'); // 12:00 BRT
  const g = W.avaliarGarantiaMeioDiaTelegram({ enviadosHoje: 0 }, depoisDaJanela, W.contarElegiveisSlotTelegram(resultados));
  assert.ok(!/havia candidato/.test(g.motivo), g.motivo);
  assert.equal(W.contarElegiveisSlotTelegram([{ status: 'aguardando_intervalo', pontuacao: W.LIMIAR_SLOT_TELEGRAM }]), 1);
});

test('collector: nenhum link público para o OffVoos (só a coleta autorizada do dado)', () => {
  const urls = SRC.match(/https?:\/\/(?:www\.)?offvoos\.com\.br[^\s"'`)]*/gi) || [];
  // A única URL permitida é o endpoint de coleta (/<slug>/tbody), nunca uma página para o leitor.
  for (const u of urls) assert.match(u, /\/tbody\?d=/, 'URL do OffVoos fora da coleta: ' + u);
  assert.ok(!/instagram\.com\/offvoos|@offvoos/i.test(SRC));
});
