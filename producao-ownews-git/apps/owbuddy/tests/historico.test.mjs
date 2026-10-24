/**
 * OWBuddy 1.0 — Meu Histórico (registro do REALIZADO; a escala é o planejado).
 * Regras puras (ow-domain/historico.ts) + garantias estáticas de privacidade/arquitetura.
 * Relógio SEMPRE injetado; TZ fixo.
 */
process.env.TZ = 'America/Sao_Paulo';

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

register('./_ts-resolver.mjs', import.meta.url);

let D;
before(async () => {
  D = await import('../../../packages/ow-domain/src/index.ts');
});

const AGORA = '2026-10-24T12:00:00.000Z';
const dia = (iso, h = 12, m = 0) => { const [y, mo, d] = iso.split('-').map(Number); return new Date(y, mo - 1, d, h, m); };
const ESCALA = () => ({ tipo: '14x14', dataRef: '2026-10-16', tipoRef: 'embarquei' });

let n = 0;
const reg = (o = {}) => ({ id: `he_${++n}`, embarque: '2026-10-16', desembarque: '2026-10-30', fonte: 'manual', criado_em: AGORA, updated_at: AGORA, ...o });
const ac = (registroId, o) => ({ id: `ha_${++n}`, registroId, ...o });
const titulos = (h, id) => D.linhaDoTempo(h, id).map(a => `${a.data.slice(8)}/${a.data.slice(5, 7)}${a.hora ? ' ' + a.hora : ''} ${D.LABEL_ACONTECIMENTO_HIST[a.tipo]}`);

// ─── Duração: convenção única (a da escala) ──────────────────────────────────

test('duração: 16/10 → 30/10 = 14 dias (Dia 1 = 16, Dia 14 = 29, desembarque 30) — nunca 15 por contagem inclusiva', () => {
  assert.equal(D.diasEmbarcado({ embarque: '2026-10-16', desembarque: '2026-10-30' }), 14);
  // Mesma convenção da escala: no 14x14 com embarque 16/10, 29/10 é o Dia 14 e 30/10 já é folga.
  const c29 = D.calcEscalaISO(ESCALA(), '2026-10-29');
  const c30 = D.calcEscalaISO(ESCALA(), '2026-10-30');
  assert.equal(c29.embarcado, true); assert.equal(c29.diaDoBloco, 14);
  assert.equal(c30.embarcado, false);
  assert.equal(D.diasEmbarcado({ embarque: '2026-10-16', desembarque: '2026-10-31' }), 15);
  assert.equal(D.diasEmbarcado({ embarque: '2026-10-16', desembarque: '2026-10-16' }), 0);
  assert.equal(D.diasEmbarcado({ embarque: '2025-12-28', desembarque: '2026-01-11' }), 14, 'virada de ano');
  assert.equal(D.diasEmbarcado({ embarque: '2028-02-20', desembarque: '2028-03-05' }), 14, 'ano bissexto');
  assert.equal(D.diasEmbarcado({ embarque: '2026-10-16', desembarque: null }), null, 'em andamento');
  assert.equal(D.textoDias(14), '14 dias embarcado');
  assert.equal(D.textoDias(1), '1 dia embarcado');
});

test('datas civis locais: 23:30 de 30/10 em Brasília continua 30/10 (sem UTC empurrando o dia)', () => {
  assert.equal(D.hojeISO(dia('2026-10-30', 23, 30)), '2026-10-30');
  assert.equal(D.hojeISO(dia('2026-10-15', 0, 5)), '2026-10-15');
  const h = D.salvarRegistro(D.historicoVazio(), reg({ id: 'r', embarque: '2026-10-15', desembarque: '2026-10-30' }), AGORA);
  assert.equal(h.registros[0].embarque, '2026-10-15');
  assert.equal(D.periodoCurto(h.registros[0]), '15 OUT → 30 OUT');
  assert.equal(D.periodoCurto({ embarque: '2025-12-28', desembarque: '2026-01-11' }), '28 DEZ 2025 → 11 JAN 2026');
});

// ─── Caso principal (59) ─────────────────────────────────────────────────────

test('caso 16/10 → 30/10: 1 embarque concluído, 14 dias, linha do tempo em ordem; depois 31/10 → 15 dias SEM mudar a escala', () => {
  const escala = ESCALA();
  const escalaAntes = JSON.stringify(escala);
  // Ciclo atual SUGERIDO pela escala (Dia 9 em 24/10) — a pessoa revisa e registra.
  const s = D.sugestaoCicloAtual(escala, [], dia('2026-10-24'));
  assert.deepEqual([s.embarquePrevisto, s.desembarquePrevisto, s.momento, s.diaDoBloco], ['2026-10-16', '2026-10-30', 'atual', 9]);

  let h = D.salvarRegistro(D.historicoVazio(), reg({
    id: 'wj', unidade: 'West Jupiter', embarque: s.embarquePrevisto, desembarque: null, fonte: 'escala',
    previsto: { embarque: s.embarquePrevisto, desembarque: s.desembarquePrevisto },
  }), AGORA);
  assert.equal(D.estadoRegistro(h.registros[0]), 'EM_ANDAMENTO');
  assert.equal(D.resumoHistorico(h.registros).embarques, 0, 'em andamento não conta como concluído');

  h = D.salvarAcontecimento(h, ac('wj', { tipo: 'HOTEL', data: '2026-10-15' }), AGORA);
  h = D.salvarAcontecimento(h, ac('wj', { tipo: 'VOO', data: '2026-10-16', hora: '08:40' }), AGORA);
  // Desembarque previsto chegou → a pessoa confirma.
  assert.equal(D.pendenciaFinalizar(h.registros, '2026-10-29'), null);
  const p = D.pendenciaFinalizar(h.registros, '2026-10-30');
  assert.equal(p.diasDesde, 0);
  h = D.finalizarRegistro(h, 'wj', '2026-10-30', AGORA);
  h = D.salvarAcontecimento(h, ac('wj', { tipo: 'VOO', data: '2026-10-30', hora: '16:10' }), AGORA);
  h = D.salvarAcontecimento(h, ac('wj', { tipo: 'CASA', data: '2026-10-30' }), AGORA);

  assert.deepEqual(titulos(h, 'wj'), [
    '15/10 Hotel', '16/10 08:40 Voo', '16/10 Embarque', '30/10 Desembarque', '30/10 16:10 Voo', '30/10 Casa',
  ]);
  let r = D.resumoHistorico(h.registros);
  assert.deepEqual([r.embarques, r.dias, r.unidades, r.desde], [1, 14, 1, 2026]);

  // Desembarque REAL foi 31/10.
  const atual = h.registros[0];
  h = D.salvarRegistro(h, { ...atual, desembarque: '2026-10-31' }, AGORA);
  assert.equal(D.diasEmbarcado(h.registros[0]), 15);
  r = D.resumoHistorico(h.registros);
  assert.equal(r.dias, 15);
  assert.ok(titulos(h, 'wj').includes('31/10 Desembarque'), 'acontecimento automático acompanha a data principal');
  assert.equal(D.linhaDoTempo(h, 'wj').filter(a => a.tipo === 'DESEMBARQUE').length, 1, 'sem duplicar');
  // Escala: intocada (objeto e cálculo).
  assert.equal(JSON.stringify(escala), escalaAntes);
  assert.equal(D.proximoDesembarqueISO(escala, dia('2026-10-24')), '2026-10-30');
  assert.equal(h.registros[0].previsto.desembarque, '2026-10-30', 'o previsto fica guardado como previsto');
  // E a diferença vira sugestão de dobra — só se a pessoa quiser.
  assert.equal(D.atrasoDesembarque(h.registros[0]), 1);
});

test('planejado ≠ realizado: embarque e desembarque reais diferentes da escala não alteram a escala', () => {
  const escala = ESCALA();
  const antes = JSON.stringify(escala);
  let h = D.salvarRegistro(D.historicoVazio(), reg({ id: 'x', embarque: '2026-10-17', desembarque: '2026-10-31', unidade: 'West Tellus', previsto: { embarque: '2026-10-16', desembarque: '2026-10-30' }, fonte: 'escala' }), AGORA);
  assert.equal(D.diasEmbarcado(h.registros[0]), 14);
  assert.equal(JSON.stringify(escala), antes);
  assert.equal(D.calcEscalaISO(escala, '2026-10-16').diaDoBloco, 1, 'escala continua com embarque 16/10');
  // Unidade realizada ≠ planejada: o histórico guarda o que aconteceu.
  assert.equal(h.registros[0].unidade, 'West Tellus');
  // Nada no módulo recebe a escala para gravar.
  const src = readFileSync(new URL('../../../packages/ow-domain/src/historico.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /setEscala|deleteEscala|dataRef\s*=|\.dataRef\s*=/);
});

test('em andamento: "Dia N registrado" vem do embarque REAL, não do dia calculado pela escala', () => {
  const r = reg({ embarque: '2026-10-17', desembarque: null });
  assert.equal(D.diaRegistrado(r, '2026-10-24'), 8);
  assert.equal(D.calcEscalaISO(ESCALA(), '2026-10-24').diaDoBloco, 9, 'a escala diz Dia 9');
  assert.equal(D.estadoRegistro(r), 'EM_ANDAMENTO');
  const g = D.agruparPorAno([r, reg({ embarque: '2026-09-18', desembarque: '2026-10-02', unidade: 'P-80' })]);
  assert.equal(g[0].emAndamento, 1);
  assert.equal(g[0].resumo.embarques, 1, 'o em andamento não entra nos concluídos');
});

// ─── Caso Transferido (60) ───────────────────────────────────────────────────

test('logística alterada: Voo previsto 08:40 + Transferido 08:00 + Voo real 11:20 convivem; Transferido não vira "cancelado"', () => {
  let h = D.salvarRegistro(D.historicoVazio(), reg({ id: 'r', desembarque: null }), AGORA);
  const viagem = { tipo: 'AVIAO', data: '2026-10-16', hora: '08:40', num_voo: 'AD4512', origem: 'GRU', destino: 'Macaé', localizador: 'XYZ123', assento: '12A', obs: 'privado' };
  h = D.importarViagem(h, 'r', viagem, '2026-10-24', AGORA);
  h = D.salvarAcontecimento(h, ac('r', { tipo: 'TRANSFERIDO', data: '2026-10-16', hora: '08:00' }), AGORA);
  h = D.salvarAcontecimento(h, ac('r', { tipo: 'VOO', data: '2026-10-16', hora: '11:20' }), AGORA);
  assert.deepEqual(titulos(h, 'r'), ['16/10 08:00 Transferido', '16/10 08:40 Voo', '16/10 11:20 Voo', '16/10 Embarque']);
  assert.equal(D.LABEL_ACONTECIMENTO_HIST.TRANSFERIDO, 'Transferido');
  assert.ok(D.TIPOS_ACONTECIMENTO_HIST.includes('TRANSFERIDO'));
  const src = readFileSync(new URL('../../../packages/ow-domain/src/historico.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /TRANSFERIDO[^\n]*[Cc]ancelad|TRANSFERIDO[^\n]*[Dd]esviad/);
  // Importação copia só o trajeto (sem localizador, assento, observação).
  const voo = D.linhaDoTempo(h, 'r').find(a => a.importadoDe);
  assert.deepEqual([voo.tipo, voo.hora, voo.origem, voo.destino, voo.numero], ['VOO', '08:40', 'GRU', 'Macaé', 'AD4512']);
  assert.equal(JSON.stringify(voo).includes('XYZ123') || JSON.stringify(voo).includes('12A') || JSON.stringify(voo).includes('privado'), false);
});

// ─── Embarque antigo (61) e cadastro manual ─────────────────────────────────

test('embarque antigo: West Tellus, Guindasteiro, 01/03/2018 → 15/03/2018 — sem voo, hotel, empresa, observação ou acontecimentos', () => {
  const r = reg({ id: 'old', unidade: 'West Tellus', funcao: 'Guindasteiro', embarque: '2018-03-01', desembarque: '2018-03-15' });
  assert.equal(D.validarRegistro(r), null);
  const h = D.salvarRegistro(D.historicoVazio(), r, AGORA);
  const x = h.registros[0];
  assert.equal(x.empresa, undefined); assert.equal(x.obs, undefined);
  assert.equal(D.diasEmbarcado(x), 14);
  assert.deepEqual(titulos(h, 'old'), ['01/03 Embarque', '15/03 Desembarque']);
  assert.equal(D.anoDoRegistro(x), 2018);
  // Só datas também vale (unidade opcional).
  const so = D.salvarRegistro(D.historicoVazio(), reg({ id: 's', embarque: '2026-10-16', desembarque: '2026-10-30' }), AGORA);
  assert.equal(D.nomeRegistro(so.registros[0]), 'Embarque');
  // Validação mínima.
  assert.equal(D.validarRegistro({ embarque: '', desembarque: null }), 'SEM_EMBARQUE');
  assert.equal(D.validarRegistro({ embarque: '2026-10-16', desembarque: '2026-10-10' }), 'DESEMBARQUE_ANTES');
});

test('função por registro: histórico atravessa promoções (não vale retroativamente)', () => {
  let h = D.historicoVazio();
  h = D.salvarRegistro(h, reg({ id: 'a', embarque: '2019-05-01', desembarque: '2019-05-15', funcao: 'Guindasteiro' }), AGORA);
  h = D.salvarRegistro(h, reg({ id: 'b', embarque: '2026-09-01', desembarque: '2026-09-15', funcao: 'Deck Pusher' }), AGORA);
  assert.equal(h.registros.find(r => r.id === 'a').funcao, 'Guindasteiro');
  assert.deepEqual(D.sugestoesCampo(h.registros, 'funcao'), ['Deck Pusher', 'Guindasteiro'], 'só sugestão para tocar, mais recente primeiro');
});

// ─── Linha do tempo ──────────────────────────────────────────────────────────

test('linha do tempo: antes do embarque e depois do desembarque; data → horário → ordem de criação (sem horário estável)', () => {
  let h = D.salvarRegistro(D.historicoVazio(), reg({ id: 'r' }), AGORA);
  h = D.salvarAcontecimento(h, ac('r', { tipo: 'CASA', data: '2026-10-31' }), AGORA);
  h = D.salvarAcontecimento(h, ac('r', { tipo: 'VOO', data: '2026-10-31', hora: '09:00' }), AGORA);
  h = D.salvarAcontecimento(h, ac('r', { tipo: 'HOTEL', data: '2026-10-30' }), AGORA);
  h = D.salvarAcontecimento(h, ac('r', { tipo: 'OUTRO', titulo: 'Troca de aeroporto', data: '2026-10-16', hora: '07:20' }), AGORA);
  h = D.salvarAcontecimento(h, ac('r', { tipo: 'BASE', data: '2026-10-16' }), AGORA);
  h = D.salvarAcontecimento(h, ac('r', { tipo: 'TREINAMENTO', data: '2026-10-16' }), AGORA);
  h = D.salvarAcontecimento(h, ac('r', { tipo: 'HOTEL', data: '2026-10-15' }), AGORA);
  assert.deepEqual(titulos(h, 'r'), [
    '15/10 Hotel', '16/10 07:20 Outro', '16/10 Base', '16/10 Treinamento', '16/10 Embarque',
    '30/10 Desembarque', '30/10 Hotel', '31/10 09:00 Voo', '31/10 Casa',
  ]);
  assert.equal(D.tituloAcontecimentoHist(D.linhaDoTempo(h, 'r')[1]), 'Troca de aeroporto');
  // Reordenar a lista crua não muda o resultado (estável por seq).
  const emb = { ...h, acontecimentos: [...h.acontecimentos].reverse() };
  assert.deepEqual(titulos(emb, 'r'), titulos(h, 'r'));
});

test('editar e excluir acontecimento; editar o automático corrige a data do registro (no histórico)', () => {
  let h = D.salvarRegistro(D.historicoVazio(), reg({ id: 'r' }), AGORA);
  const voo = ac('r', { tipo: 'VOO', data: '2026-10-16', hora: '08:40' });
  h = D.salvarAcontecimento(h, voo, AGORA);
  h = D.salvarAcontecimento(h, { ...voo, hora: '11:20', numero: 'G3 1234' }, AGORA);
  const v = D.linhaDoTempo(h, 'r').filter(a => a.tipo === 'VOO');
  assert.equal(v.length, 1); assert.equal(v[0].hora, '11:20'); assert.equal(v[0].numero, 'G3 1234');
  h = D.removerAcontecimento(h, voo.id);
  assert.equal(D.linhaDoTempo(h, 'r').some(a => a.tipo === 'VOO'), false);
  const autoEmb = D.linhaDoTempo(h, 'r').find(a => a.auto === 'embarque');
  h = D.salvarAcontecimento(h, { ...autoEmb, data: '2026-10-17' }, AGORA);
  assert.equal(h.registros[0].embarque, '2026-10-17');
  assert.equal(D.diasEmbarcado(h.registros[0]), 13);
  // Automático não pode inverter as datas.
  const autoDes = D.linhaDoTempo(h, 'r').find(a => a.auto === 'desembarque');
  const h2 = D.salvarAcontecimento(h, { ...autoDes, data: '2026-10-01' }, AGORA);
  assert.equal(h2.registros[0].desembarque, '2026-10-30');
});

test('excluir registro remove os acontecimentos dele e não toca nos outros', () => {
  let h = D.historicoVazio();
  h = D.salvarRegistro(h, reg({ id: 'a' }), AGORA);
  h = D.salvarRegistro(h, reg({ id: 'b', embarque: '2026-09-01', desembarque: '2026-09-15' }), AGORA);
  h = D.salvarAcontecimento(h, ac('a', { tipo: 'HOTEL', data: '2026-10-15' }), AGORA);
  h = D.removerRegistro(h, 'a');
  assert.deepEqual(h.registros.map(r => r.id), ['b']);
  assert.equal(h.acontecimentos.every(x => x.registroId === 'b'), true);
  assert.equal(h.acontecimentos.length, 2);
});

test('correção de datas recalcula dias, estatísticas, ordenação e ano', () => {
  let h = D.historicoVazio();
  h = D.salvarRegistro(h, reg({ id: 'a', embarque: '2026-01-05', desembarque: '2026-01-19', unidade: 'P-80' }), AGORA);
  h = D.salvarRegistro(h, reg({ id: 'b', embarque: '2026-03-05', desembarque: '2026-03-19', unidade: 'P-80' }), AGORA);
  assert.deepEqual(D.agruparPorAno(h.registros)[0].registros.map(r => r.id), ['b', 'a']);
  h = D.salvarRegistro(h, { ...h.registros.find(r => r.id === 'a'), embarque: '2025-12-20', desembarque: '2026-01-05' }, AGORA);
  const g = D.agruparPorAno(h.registros);
  assert.deepEqual(g.map(x => x.ano), [2026, 2025], 'conta no ano do embarque');
  assert.equal(g[1].resumo.dias, 16);
  assert.equal(g[0].resumo.dias, 14);
});

// ─── Duplo toque, duplicidade, sobreposição ─────────────────────────────────

test('duplo toque: mesmo id = atualização (sem duplicata), inclusive importação e dobra', () => {
  let h = D.historicoVazio();
  const r = reg({ id: 'r', desembarque: '2026-11-02', previsto: { embarque: '2026-10-16', desembarque: '2026-10-30' } });
  h = D.salvarRegistro(h, r, AGORA);
  h = D.salvarRegistro(h, r, AGORA);
  assert.equal(h.registros.length, 1);
  assert.equal(h.acontecimentos.filter(a => a.auto).length, 2);
  const v = { tipo: 'AVIAO', data: '2026-10-16', hora: '08:40' };
  h = D.importarViagem(h, 'r', v, '2026-10-24', AGORA);
  h = D.importarViagem(h, 'r', v, '2026-10-24', AGORA);
  assert.equal(h.acontecimentos.filter(a => a.importadoDe).length, 1);
  h = D.registrarDobra(h, 'r', AGORA);
  h = D.registrarDobra(h, 'r', AGORA);
  const dobras = h.acontecimentos.filter(a => a.tipo === 'DOBRA');
  assert.equal(dobras.length, 1);
  assert.equal(dobras[0].titulo, 'Dobra de 3 dias');
  assert.equal(dobras[0].data, '2026-10-30');
  // Sem atraso não há dobra (não inferimos causa nem inventamos dobra).
  let h2 = D.salvarRegistro(D.historicoVazio(), reg({ id: 'z', previsto: { desembarque: '2026-10-30' } }), AGORA);
  h2 = D.registrarDobra(h2, 'z', AGORA);
  assert.equal(h2.acontecimentos.some(a => a.tipo === 'DOBRA'), false);
});

test('duplicidade: mesmas datas (e mesma unidade quando houver) → aviso antes de salvar', () => {
  let h = D.salvarRegistro(D.historicoVazio(), reg({ id: 'a', unidade: 'West Jupiter' }), AGORA);
  assert.ok(D.registroDuplicado(h, { id: 'n', embarque: '2026-10-16', desembarque: '2026-10-30', unidade: 'west  júpiter' }));
  assert.ok(D.registroDuplicado(h, { id: 'n', embarque: '2026-10-16', desembarque: '2026-10-30' }), 'sem unidade: datas bastam');
  assert.equal(D.registroDuplicado(h, { id: 'n', embarque: '2026-10-16', desembarque: '2026-10-30', unidade: 'P-80' }), null);
  assert.equal(D.registroDuplicado(h, { id: 'a', embarque: '2026-10-16', desembarque: '2026-10-30', unidade: 'West Jupiter' }), null, 'editar a si mesmo não é duplicata');
});

test('sobreposição: avisa (não bloqueia); embarcar no dia do desembarque anterior não conta', () => {
  const h = D.salvarRegistro(D.historicoVazio(), reg({ id: 'a' }), AGORA);
  assert.ok(D.registroSobreposto(h, { id: 'n', embarque: '2026-10-25', desembarque: '2026-11-08' }, '2026-12-01'));
  assert.ok(D.registroSobreposto(h, { id: 'n', embarque: '2026-10-01', desembarque: '2026-10-17' }, '2026-12-01'));
  assert.equal(D.registroSobreposto(h, { id: 'n', embarque: '2026-10-30', desembarque: '2026-11-13' }, '2026-12-01'), null);
  assert.equal(D.registroSobreposto(h, { id: 'n', embarque: '2026-10-02', desembarque: '2026-10-16' }, '2026-12-01'), null);
  // Em andamento ocupa até hoje.
  const h2 = D.salvarRegistro(D.historicoVazio(), reg({ id: 'b', embarque: '2026-10-16', desembarque: null }), AGORA);
  assert.ok(D.registroSobreposto(h2, { id: 'n', embarque: '2026-10-20', desembarque: '2026-10-22' }, '2026-10-24'));
  // O formulário pergunta "Revisar / Salvar mesmo assim" (aviso, não bloqueio).
  const f = readFileSync(new URL('../app/historico-form.tsx', import.meta.url), 'utf8');
  assert.match(f, /Esse período se sobrepõe a outro registro\./);
  assert.match(f, /'Salvar mesmo assim', 'Revisar'/);
});

// ─── Futuro / planejado ──────────────────────────────────────────────────────

test('datas futuras: aviso antes de salvar e marcação "Planejado" (fora das estatísticas até confirmar)', () => {
  let h = D.salvarRegistro(D.historicoVazio(), reg({ id: 'f', embarque: '2026-11-13', desembarque: '2026-11-27', planejado: true }), AGORA);
  assert.equal(D.estadoRegistro(h.registros[0]), 'PLANEJADO');
  assert.equal(h.acontecimentos.length, 0, 'planejado não gera "Embarque" realizado');
  assert.equal(D.resumoHistorico(h.registros).embarques, 0);
  assert.equal(D.planejadoAConfirmar(h.registros, '2026-11-12'), null);
  assert.equal(D.planejadoAConfirmar(h.registros, '2026-11-13').id, 'f');
  h = D.salvarRegistro(h, { ...h.registros[0], planejado: undefined }, AGORA);
  assert.equal(D.estadoRegistro(h.registros[0]), 'CONCLUIDO');
  assert.equal(h.acontecimentos.length, 2);
  for (const f of ['../app/historico-form.tsx', '../app/historico-acontecimento.tsx']) {
    assert.match(readFileSync(new URL(f, import.meta.url), 'utf8'), /Essa data ainda não chegou\./);
  }
});

// ─── Sugestão e migração: nunca popular com ciclos passados ─────────────────

test('migração: escala com anos de ciclos calculáveis NÃO gera nenhum registro; só o ciclo atual é sugerido', () => {
  const escala = { tipo: '14x14', dataRef: '2009-01-05', tipoRef: 'embarquei' };
  const h = D.historicoVazio();
  assert.equal(h.registros.length, 0);
  const s = D.sugestaoCicloAtual(escala, h.registros, dia('2026-10-24'));
  assert.ok(s, 'há sugestão do ciclo atual');
  assert.equal(D.resumoHistorico(h.registros).desde, null, 'sem dado real não há "desde"');
  // A sugestão é só leitura: nada foi gravado.
  assert.equal(h.registros.length, 0);
});

test('sugestão: ciclo atual (embarcado) ou o que acabou há ≤ 7 dias; some quando registrado (com tolerância de data real)', () => {
  const esc = ESCALA();
  assert.equal(D.sugestaoCicloAtual(esc, [], dia('2026-10-16')).diaDoBloco, 1);
  const ult = D.sugestaoCicloAtual(esc, [], dia('2026-11-02'));
  assert.deepEqual([ult.momento, ult.embarquePrevisto, ult.desembarquePrevisto], ['ultimo', '2026-10-16', '2026-10-30']);
  assert.equal(D.sugestaoCicloAtual(esc, [], dia('2026-11-08')), null, 'folga avançada: nada');
  assert.equal(D.sugestaoCicloAtual(null, [], dia('2026-10-24')), null, 'sem escala: nada');
  assert.equal(D.sugestaoCicloAtual(esc, [reg({ embarque: '2026-10-17', desembarque: null })], dia('2026-10-24')), null);
  assert.equal(D.sugestaoCicloAtual(esc, [reg({ embarque: '2026-10-18' })], dia('2026-10-24')), null);
});

test('Home: no máximo um aviso, só com ação útil, e anti-spam ("Agora não")', () => {
  const esc = ESCALA();
  const vazio = D.historicoVazio();
  let av = D.avisosVazios();
  // Dia 1–3 do embarque, sem registro → sugerir.
  const a1 = D.avisoHistoricoHome(esc, vazio, av, dia('2026-10-16'), '2026-10-16');
  assert.equal(a1.tipo, 'SUGERIR');
  assert.equal(D.avisoHistoricoHome(esc, vazio, av, dia('2026-10-20'), '2026-10-20'), null, 'dia 5: só na tela do Histórico');
  av = D.dispensarSugestao(av, a1.sugestao);
  assert.equal(D.avisoHistoricoHome(esc, vazio, av, dia('2026-10-17'), '2026-10-17'), null, 'dispensada para este ciclo');
  // Duas dispensas → a Home para de sugerir (a tela do Histórico continua oferecendo).
  av = D.dispensarSugestao(av, { chave: '2026-11-13' });
  assert.equal(D.avisoHistoricoHome(esc, vazio, av, dia('2026-11-13'), '2026-11-13'), null);
  // Finalização: aparece no dia previsto; "Agora não" → volta amanhã; atrasado → 3 dias.
  const h = D.salvarRegistro(vazio, reg({ id: 'r', desembarque: null, previsto: { embarque: '2026-10-16', desembarque: '2026-10-30' } }), AGORA);
  let av2 = D.avisosVazios();
  assert.equal(D.avisoHistoricoHome(esc, h, av2, dia('2026-10-29'), '2026-10-29'), null);
  const f = D.avisoHistoricoHome(esc, h, av2, dia('2026-10-30'), '2026-10-30');
  assert.equal(f.tipo, 'FINALIZAR');
  av2 = D.adiarFinalizacao(av2, f.pendencia, '2026-10-30');
  assert.equal(D.avisoHistoricoHome(esc, h, av2, dia('2026-10-30', 18), '2026-10-30'), null);
  const f2 = D.avisoHistoricoHome(esc, h, av2, dia('2026-10-31'), '2026-10-31');
  assert.equal(f2.pendencia.diasDesde, 1);
  av2 = D.adiarFinalizacao(av2, f2.pendencia, '2026-10-31');
  assert.equal(D.avisoHistoricoHome(esc, h, av2, dia('2026-11-02'), '2026-11-02'), null);
  assert.equal(D.avisoHistoricoHome(esc, h, av2, dia('2026-11-03'), '2026-11-03').tipo, 'FINALIZAR');
  // Leitura tolerante dos avisos.
  assert.deepEqual(D.lerAvisos({ dispensadas: ['x', '2026-10-16'], adiadoAte: { r: 'lixo', s: '2026-11-01' } }), { dispensadas: ['2026-10-16'], adiadoAte: { s: '2026-11-01' } });
});

// ─── Persistência, reabertura e migração do formato ─────────────────────────

test('persistência: ida e volta por JSON é idêntica (fechar e reabrir o app)', () => {
  let h = D.salvarRegistro(D.historicoVazio(), reg({ id: 'r', unidade: 'P-80', funcao: 'Plataformista', empresa: 'X', obs: 'Dobra de 3 dias.' }), AGORA);
  h = D.salvarAcontecimento(h, ac('r', { tipo: 'VOO', data: '2026-10-16', hora: '08:40', origem: 'GRU', destino: 'MEA', numero: 'AD1' }), AGORA);
  const lido = D.lerHistorico(JSON.parse(JSON.stringify(h)));
  assert.deepEqual(lido.data, h);
  assert.equal(lido.descartados, 0);
  assert.equal(h.v, D.HISTORICO_VERSAO);
  // IDs estáveis: excluir um item não muda a identidade dos outros.
  const ids = h.acontecimentos.map(a => a.id);
  const sem = D.removerAcontecimento(h, ids[0]);
  assert.deepEqual(sem.acontecimentos.map(a => a.id), ids.slice(1));
});

test('migração/leitura tolerante: lixo descartado item a item, versão nova sinalizada, nada lança', () => {
  assert.deepEqual(D.lerHistorico(null).data, D.historicoVazio());
  assert.equal(D.lerHistorico('quebrado').descartados, 1);
  assert.equal(D.lerHistorico([1, 2]).descartados, 1);
  const raw = {
    v: 1, seq: 2,
    registros: [
      { id: 'ok', embarque: '2026-10-16', desembarque: '2026-10-30', fonte: 'manual' },
      { id: 'ruim', embarque: '2026-02-30', desembarque: null },
      { id: 'ok', embarque: '2026-01-01', desembarque: null },
      { embarque: '2026-01-01' },
    ],
    acontecimentos: [
      { id: 'a1', registroId: 'ok', tipo: 'VOO', data: '2026-10-16', hora: '25:99', seq: 7 },
      { id: 'a2', registroId: 'fantasma', tipo: 'VOO', data: '2026-10-16' },
      { id: 'a3', registroId: 'ok', tipo: 'TELETRANSPORTE', data: '2026-10-16' },
    ],
  };
  const l = D.lerHistorico(raw);
  assert.deepEqual(l.data.registros.map(r => r.id), ['ok']);
  assert.deepEqual(l.data.acontecimentos.map(a => a.id), ['a1']);
  assert.equal(l.data.acontecimentos[0].hora, undefined, 'hora inválida vira "sem horário"');
  assert.equal(l.data.seq, 8, 'seq nunca reaproveita ordem já usada');
  assert.equal(l.descartados, 5);
  assert.equal(D.lerHistorico({ v: 99, registros: [] }).versaoDesconhecida, true);
  // Storage: guarda cópia do bruto antes de regravar e nunca sobrescreve versão nova.
  const st = readFileSync(new URL('../src/storage.ts', import.meta.url), 'utf8');
  assert.match(st, /HISTORICO_BACKUP/);
  assert.match(st, /bruto\.v > HISTORICO_VERSAO\) return atual/);
});

test('migração do app: nenhuma chave existente muda de nome; Histórico usa chaves novas com prefixo owbuddy_', () => {
  const st = readFileSync(new URL('../src/storage.ts', import.meta.url), 'utf8');
  for (const k of ["'ownews_minha_escala'", "'ownews_certificados'", "'ownews_checklist_mala'", "'ownews_minha_viagem'", "'ownews_buddy_prefs'",
    "'owbuddy_contatos_embarque'", "'owbuddy_pagamento_v1'", "'owbuddy_home_prefs'", "'owbuddy_aparencia'", "'owbuddy_eventos_pessoais'"]) {
    assert.ok(st.includes(k), `chave ${k} preservada`);
  }
  assert.match(st, /HISTORICO:\s+'owbuddy_historico'/);
  assert.match(st, /HISTORICO_AVISOS:\s+'owbuddy_historico_avisos'/);
});

// ─── Estatísticas ────────────────────────────────────────────────────────────

test('estatísticas e resumo anual: só concluídos; unidades normalizadas; sem métrica vazia; "desde" só com dado real', () => {
  const regs = [
    reg({ id: '1', embarque: '2026-10-16', desembarque: '2026-10-30', unidade: 'West Jupiter' }),
    reg({ id: '2', embarque: '2026-09-18', desembarque: '2026-10-02', unidade: 'P-80' }),
    reg({ id: '3', embarque: '2026-08-21', desembarque: '2026-09-04', unidade: 'west júpiter ' }),
    reg({ id: '4', embarque: '2025-05-01', desembarque: '2025-05-15' }),
    reg({ id: '5', embarque: '2026-11-13', desembarque: null }),
  ];
  const g = D.agruparPorAno(regs);
  assert.deepEqual(g.map(x => x.ano), [2026, 2025]);
  assert.deepEqual([g[0].resumo.embarques, g[0].resumo.dias, g[0].resumo.unidades, g[0].emAndamento], [3, 42, 2, 1]);
  assert.deepEqual(g[0].registros.map(r => r.id), ['5', '1', '2', '3'], 'mais recente primeiro');
  assert.equal(g[1].resumo.unidades, 0, 'sem unidade informada: a métrica some (não vira "0 unidades")');
  const geral = D.resumoHistorico(regs);
  assert.deepEqual([geral.embarques, geral.dias, geral.unidades, geral.desde], [4, 56, 2, 2025]);
  // Filtros.
  assert.deepEqual(D.agruparPorAno(regs, { ano: 2025 }).map(x => x.ano), [2025]);
  assert.deepEqual(D.agruparPorAno(regs, { unidade: 'WEST JUPITER' })[0].registros.map(r => r.id), ['1', '3']);
  assert.deepEqual(D.anosDoHistorico(regs), [2026, 2025]);
  assert.deepEqual(D.unidadesDoHistorico(regs), ['West Jupiter', 'P-80']);
});

test('desempenho: 300 embarques e 1.500 acontecimentos agrupam e ordenam rápido', () => {
  let h = D.historicoVazio();
  const regs = [], acs = [];
  for (let i = 0; i < 300; i++) {
    const emb = D.somarDiasISO('2009-01-05', i * 28);
    regs.push(reg({ id: `r${i}`, embarque: emb, desembarque: D.somarDiasISO(emb, 14), unidade: `U${i % 12}` }));
    for (let k = 0; k < 5; k++) acs.push({ id: `a${i}_${k}`, registroId: `r${i}`, tipo: 'VOO', data: emb, hora: `0${k}:00`, seq: i * 5 + k, criado_em: AGORA, updated_at: AGORA });
  }
  h = { ...h, registros: regs, acontecimentos: acs, seq: 2000 };
  const t0 = performance.now();
  const lido = D.lerHistorico(JSON.parse(JSON.stringify(h))).data;
  const g = D.agruparPorAno(lido.registros);
  const r = D.resumoHistorico(lido.registros);
  const l = D.linhaDoTempo(lido, 'r150');
  const ms = performance.now() - t0;
  assert.equal(r.embarques, 300); assert.equal(r.dias, 4200); assert.equal(r.unidades, 12); assert.equal(r.desde, 2009);
  assert.equal(l.length, 5);
  assert.ok(g.length >= 20);
  assert.ok(ms < 250, `levou ${ms.toFixed(1)} ms`);
});

// ─── Privacidade, apagar dados, conta, offline ──────────────────────────────

function arquivos(dir) {
  return readdirSync(dir).flatMap(f => { const p = join(dir, f); return statSync(p).isDirectory() ? arquivos(p) : /\.tsx?$/.test(f) ? [p] : []; });
}
const RAIZ = new URL('..', import.meta.url).pathname;
const ARQ_HIST = [
  ...arquivos(join(RAIZ, 'app')).filter(f => /historico/.test(f)),
  join(RAIZ, 'src/historico-acoes.ts'), join(RAIZ, 'src/historico-visual.ts'), join(RAIZ, 'src/components/HistoricoAvisos.tsx'),
  new URL('../../../packages/ow-domain/src/historico.ts', import.meta.url).pathname,
];

test('local-first: Histórico não vai para Supabase/Conta OW, OWNews, rede, log nem notificação', () => {
  assert.equal(ARQ_HIST.length >= 8, true);
  const sync = readFileSync(join(RAIZ, 'src/sync.ts'), 'utf8');
  assert.doesNotMatch(sync, /historico|HISTORICO|getHistorico/i);
  for (const f of ['src/auth.ts', 'src/supabase.ts', 'src/api.ts', 'src/notifications.ts']) {
    assert.doesNotMatch(readFileSync(join(RAIZ, f), 'utf8'), /historico|HISTORICO/i, f);
  }
  assert.doesNotMatch(readFileSync(new URL('../../../packages/ow-domain/src/lembretes.ts', import.meta.url), 'utf8'), /historico/i);
  for (const f of ARQ_HIST) {
    const s = readFileSync(f, 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.doesNotMatch(s, /fetch\(|XMLHttpRequest|sendBeacon|supabase|from '\.\.\/src\/api'|from '\.\.\/api'|console\.|Sentry|crashlytics/i, f);
  }
});

test('analytics do Histórico: só eventos genéricos, nunca unidade, empresa, função, datas, hotel, voo ou texto', () => {
  const a = readFileSync(join(RAIZ, 'src/analytics.ts'), 'utf8');
  for (const ev of ['historico_aberto', 'embarque_registrado', 'embarque_editado', 'embarque_excluido', 'acontecimento_registrado']) assert.match(a, new RegExp(`'${ev}'`));
  const proibidas = /\b(unidade|empresa|funcao|obs|data|embarque|desembarque|hora|numero|local|titulo|origem|destino|registroId|id)\s*:(?!\s*'[a-z_]+')/;
  let chamadas = 0;
  for (const f of ARQ_HIST) {
    const s = readFileSync(f, 'utf8');
    for (const m of s.matchAll(/analytics\.track\(\s*([^)]*)\)/g)) {
      chamadas++;
      const args = m[1];
      assert.doesNotMatch(args, proibidas, `${f}: ${m[0]}`);
      // Única variável permitida em props: o TIPO do acontecimento (categoria fixa, ex.: 'VOO').
      const vars = [...args.matchAll(/\{([^}]*)\}/g)].flatMap(x => x[1].split(',').map(p => p.trim()).filter(Boolean));
      for (const p of vars) assert.match(p, /^(tipo|origem:\s*'[a-z_]+')$/, `${f}: ${p}`);
    }
  }
  assert.ok(chamadas >= 6);
});

test('apagar dados do aparelho inclui o Histórico; Sair e excluir conta NÃO apagam o Histórico local', () => {
  const st = readFileSync(join(RAIZ, 'src/storage.ts'), 'utf8');
  assert.match(st, /k\.startsWith\('owbuddy_'\) \|\| k\.startsWith\('ownews_'\)/, 'owbuddy_historico* entra no apagar');
  const cfg = readFileSync(join(RAIZ, 'app/buddy-config.tsx'), 'utf8');
  assert.match(cfg, /datas, Meu Histórico e preferências saem deste aparelho/);
  assert.match(cfg, /'Apagar tudo'/);
  const sair = cfg.match(/const handleSair = async \(\) => \{([\s\S]*?)\n  \};/)[1];
  assert.doesNotMatch(sair, /apagar|removeItem|multiRemove|Historico/i);
  const excluirConta = cfg.match(/const pedirExclusaoConta = \(\) => \{([\s\S]*?)\n  \};/)[1];
  assert.doesNotMatch(excluirConta, /apagar|removeItem|multiRemove|Historico/i);
  assert.match(cfg, /Viagem, contatos, datas, Meu Histórico, Cruzar e pagamento ficam só neste aparelho\./);
  const auth = readFileSync(join(RAIZ, 'src/auth.ts'), 'utf8');
  assert.doesNotMatch(auth, /AsyncStorage\.(clear|multiRemove)/);
});

test('offline: o Histórico não depende de rede (só armazenamento local)', () => {
  for (const f of ARQ_HIST) {
    const s = readFileSync(f, 'utf8');
    assert.doesNotMatch(s, /useConnectivity|expo-network|from '\.\.\/src\/net'|from '\.\.\/net'/, f);
  }
  const st = readFileSync(join(RAIZ, 'src/storage.ts'), 'utf8');
  assert.match(st, /export async function getHistorico/);
  assert.match(st, /export function alterarHistorico/);
});

test('Histórico nunca grava a escala; entrada pela Escala sem sexta aba; rotas existem', () => {
  for (const f of ARQ_HIST) assert.doesNotMatch(readFileSync(f, 'utf8'), /\b(setEscala|deleteEscala)\b/, f);
  for (const r of ['historico', 'historico-registro', 'historico-form', 'historico-acontecimento']) {
    assert.ok(existsSync(join(RAIZ, `app/${r}.tsx`)), r);
  }
  const esc = readFileSync(join(RAIZ, 'app/(tabs)/escala.tsx'), 'utf8');
  assert.match(esc, /router\.push\('\/historico'\)/);
  const tabs = readFileSync(join(RAIZ, 'app/(tabs)/_layout.tsx'), 'utf8');
  assert.doesNotMatch(tabs, /historico/i, 'bottom nav aprovado intocado');
  const lay = readFileSync(join(RAIZ, 'app/_layout.tsx'), 'utf8');
  for (const r of ['historico', 'historico-registro', 'historico-form', 'historico-acontecimento']) assert.match(lay, new RegExp(`name="${r}"`));
});

test('edição e exclusão sempre visíveis (sem depender de swipe/toque longo); "não é documento oficial"', () => {
  const det = readFileSync(join(RAIZ, 'app/historico-registro.tsx'), 'utf8');
  const lista = readFileSync(join(RAIZ, 'app/historico.tsx'), 'utf8');
  const all = ARQ_HIST.map(f => readFileSync(f, 'utf8')).join('\n');
  assert.doesNotMatch(all, /onLongPress|Swipeable|PanResponder/);
  assert.match(det, /Editar embarque/);
  assert.match(det, /Excluir registro/);
  assert.match(det, /Registrar acontecimento/);
  assert.match(det, /Excluir este registro do histórico\?', 'Isso não altera sua escala atual\./);
  assert.match(readFileSync(join(RAIZ, 'app/historico-acontecimento.tsx'), 'utf8'), /Excluir este acontecimento\?/);
  assert.match(lista, /Seus embarques registrados vão aparecer aqui\./);
  assert.match(lista, /Registrar primeiro embarque/);
  assert.match(lista, /Quer começar pelo seu embarque atual\?/);
  assert.match(lista, /não é documento oficial/);
  assert.match(readFileSync(join(RAIZ, 'app/historico-form.tsx'), 'utf8'), /Registrar outro/);
});

test('sem cor fixa nas telas do Histórico (tokens do tema; dark cockpit e claro)', () => {
  for (const f of ARQ_HIST.filter(x => !x.includes('ow-domain'))) {
    assert.doesNotMatch(readFileSync(f, 'utf8'), /#[0-9a-fA-F]{3,8}\b|rgba?\(/, f);
  }
});
