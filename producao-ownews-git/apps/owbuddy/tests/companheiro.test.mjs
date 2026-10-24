/**
 * OWBuddy 1.0 — Auditoria pré-RC + Companheiro offshore.
 * Mala inteligente (ciclo), Documentos, Contatos, "Onde preciso estar?",
 * "Falta quanto pra casa?", Compartilhar escala, lembretes consolidados,
 * privacidade (sync/analytics) e migração de dados antigos.
 * Relógio SEMPRE injetado; TZ fixo.
 */
process.env.TZ = 'America/Sao_Paulo';

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

register('./_ts-resolver.mjs', import.meta.url);

let D, O;
before(async () => {
  D = await import('../../../packages/ow-domain/src/index.ts');
  O = await import('../src/onde-estar.ts');
});

const CFG = { tipo: '14x14', dataRef: '2026-10-16', tipoRef: 'embarquei' };
const dia = (iso, h = 12, m = 0) => { const [y, mo, d] = iso.split('-').map(Number); return new Date(y, mo - 1, d, h, m); };
const resumo = iso => D.resumoEscala(CFG, dia(iso));

// ─── Mala: ciclo ─────────────────────────────────────────────────────────────

test('mala: alvo é o embarque de HOJE no Dia 1 e o próximo a partir do Dia 2', () => {
  assert.equal(D.cicloAlvoChecklist(resumo('2026-10-16')), '2026-10-16');
  assert.equal(D.cicloAlvoChecklist(resumo('2026-10-17')), '2026-11-13');
  assert.equal(D.cicloAlvoChecklist(resumo('2026-10-15')), '2026-10-16', 'véspera: o embarque de amanhã');
  assert.equal(D.cicloAlvoChecklist(D.resumoEscala(null, dia('2026-10-24'))), null);
});

test('mala: NÃO zera na manhã do embarque; zera no Dia 2 (embarque passou)', () => {
  let lista = { ciclo: '2026-10-16', items: [{ id: 'a', t: 'A', cat: 'roupas', ok: true }] };
  for (const [h, m] of [[6, 0], [9, 30], [23, 59]]) {
    const r = D.resumoEscala(CFG, dia('2026-10-16', h, m));
    const s = D.sincronizarChecklistComCiclo(lista, D.cicloAlvoChecklist(r), r.hojeISO);
    assert.equal(s.resetado, false, `às ${h}:${m} do embarque`);
    assert.equal(s.data.items[0].ok, true);
  }
  const r2 = resumo('2026-10-17');
  const s2 = D.sincronizarChecklistComCiclo(lista, D.cicloAlvoChecklist(r2), r2.hojeISO);
  assert.equal(s2.resetado, true);
  assert.equal(s2.data.ciclo, '2026-11-13');
  assert.equal(s2.data.items[0].ok, false, 'check reinicia');
  assert.equal(s2.data.items.length, 1, 'item recorrente continua');
});

test('mala: abrir o app de novo no mesmo ciclo não reseta (idempotente)', () => {
  const r = resumo('2026-10-24');
  const alvo = D.cicloAlvoChecklist(r);
  let lista = { ciclo: alvo, items: [{ id: 'a', t: 'A', cat: 'roupas', ok: true }] };
  for (let i = 0; i < 5; i++) {
    const s = D.sincronizarChecklistComCiclo(lista, alvo, r.hojeISO);
    assert.equal(s.alterado, false);
    lista = s.data;
  }
  assert.equal(lista.items[0].ok, true);
});

test('mala: escala editada antes do embarque só re-chaveia (marcações intactas)', () => {
  const lista = { ciclo: '2026-11-13', items: [{ id: 'a', t: 'A', cat: 'roupas', ok: true }] };
  const s = D.sincronizarChecklistComCiclo(lista, '2026-11-20', '2026-10-24');
  assert.equal(s.resetado, false);
  assert.equal(s.data.ciclo, '2026-11-20');
  assert.equal(s.data.items[0].ok, true);
});

test('mala: relógio/escala para trás nunca apaga marcações', () => {
  const lista = { ciclo: '2026-11-13', items: [{ id: 'a', t: 'A', cat: 'roupas', ok: true }] };
  const s = D.sincronizarChecklistComCiclo(lista, '2026-10-16', '2026-10-10');
  assert.equal(s.resetado, false);
  assert.equal(s.data.ciclo, '2026-11-13');
  assert.equal(s.data.items[0].ok, true);
});

test('mala legada sem ciclo adota o alvo sem desmarcar', () => {
  const s = D.sincronizarChecklistComCiclo({ ciclo: null, items: [{ id: 'a', t: 'A', cat: 'roupas', ok: true }] }, '2026-11-13', '2026-10-24');
  assert.equal(s.resetado, false);
  assert.equal(s.data.ciclo, '2026-11-13');
  assert.equal(s.data.items[0].ok, true);
});

test('mala: "usar em todos os embarques" — só-neste sai no novo ciclo; recorrente fica desmarcado', () => {
  let c = { ciclo: '2026-10-16', items: [] };
  c = D.addItem(c, 'Carregador');
  c = D.addItem(c, 'Bolo da vó', 'personalizados', false);
  c = c.items.reduce((acc, i) => D.toggleItem(acc, i.id), c);
  assert.equal(c.items.find(i => i.t === 'Bolo da vó').rec, false);
  assert.equal(D.ehRecorrente(c.items.find(i => i.t === 'Carregador')), true);
  const s = D.sincronizarChecklistComCiclo(c, '2026-11-13', '2026-10-17');
  assert.deepEqual(s.data.items.map(i => [i.t, i.ok]), [['Carregador', false]]);
});

test('mala: toque duplo / nome repetido não duplica; ids únicos', () => {
  let c = { ciclo: null, items: [] };
  c = D.addItem(c, 'Fone');
  const mesmo = D.addItem(c, '  fone ');
  assert.equal(mesmo, c, 'mesmo nome → mesma lista');
  assert.equal(D.addItem(c, '   '), c, 'vazio não entra');
  for (let i = 0; i < 50; i++) c = D.addItem(c, 'Item ' + i);
  assert.equal(new Set(c.items.map(i => i.id)).size, c.items.length);
});

test('mala: editar nome e recorrência; progresso humano', () => {
  let c = D.addItem({ ciclo: null, items: [] }, 'Óculos');
  const id = c.items[0].id;
  c = D.editarItem(c, id, 'Óculos de grau', false);
  assert.deepEqual([c.items[0].t, c.items[0].rec], ['Óculos de grau', false]);
  c = D.editarItem(c, id, 'Óculos de grau', true);
  assert.equal('rec' in c.items[0], false, 'volta a ser recorrente (ausente = sim)');
  assert.equal(D.editarItem(c, id, '  '), c);
  assert.equal(D.progressoMala({ items: [] }).texto, 'Lista vazia');
  const p = D.progressoMala({ items: [{ ok: true }, { ok: false }, { ok: true }] });
  assert.equal(p.texto, '2 de 3 itens prontos');
  assert.equal(D.progressoMala({ items: [{ ok: true }] }).texto, 'Mala pronta');
});

// ─── Documentos ──────────────────────────────────────────────────────────────

test('documentos: tipos, nome padrão, aviso padrão 30, validação humana', () => {
  assert.deepEqual(D.DOCUMENTO_TIPOS.map(t => t.label), ['Certificado', 'Passaporte', 'CNH', 'ASO', 'Outro']);
  assert.equal(D.nomePadraoDocumento('PASSAPORTE'), 'Passaporte');
  assert.equal(D.tipoDocumento({}), 'CERTIFICADO', 'dado antigo sem tipo = certificado');
  assert.equal(D.avisoDiasDocumento({}), 30);
  assert.equal(D.avisoDiasDocumento({ aviso_dias: 0 }), 30);
  assert.equal(D.avisoDiasDocumento({ aviso_dias: 60 }), 60);
  assert.equal(D.validarDocumento({ tipo: 'CNH', nome: ' ' }), 'Dê um nome ao documento.');
  assert.equal(D.validarDocumento({ nome: 'X', validade: '2026-02-30' }), 'A data de validade não é válida.');
  assert.equal(D.validarDocumento({ nome: 'ASO', validade: '2027-01-01' }), null);
});

test('documentos: estados humanos Válido / Vence em N dias / Vence hoje / Vencido', () => {
  const hoje = dia('2026-10-24');
  const st = (validade, extra = {}) => D.calcCertStatus({ id: 'x', nome: 'ASO', validade, ...extra }, hoje);
  assert.equal(st('2026-12-31', { aviso_dias: 30 }).label, 'Válido');
  assert.equal(st('2026-11-23', { aviso_dias: 30 }).label, 'Vence em 30 dias');
  assert.equal(st('2026-11-11', { aviso_dias: 30 }).status, 'atencao');
  assert.equal(st('2026-10-31').label, 'Vence em 7 dias');
  assert.equal(st('2026-10-31').critico, true);
  assert.equal(st('2026-10-24').label, 'Vence hoje');
  assert.equal(st('2026-10-20').status, 'vencido');
  assert.equal(st('2027-01-10').status, 'atencao', 'sem aviso escolhido (dado antigo): janela antiga de 90 dias');
});

test('documentos: lembrete no "avisar antes" + 7 dias; texto sem nome do documento', () => {
  const prefs = { ...D.PREFS_LEMBRETES_PADRAO, ativo: true };
  const l = D.planejarLembretes({ escala: null, checklist: null, viagem: null, prefs, agora: dia('2026-10-24'),
    certs: [{ id: 'p', nome: 'Passaporte', tipo: 'PASSAPORTE', validade: '2027-03-01', aviso_dias: 90 }] });
  assert.deepEqual(l.map(x => x.quando), ['2026-12-01T09:00', '2027-02-22T09:00']);
  assert.ok(l.every(x => !x.corpo.includes('Passaporte')));
});

test('documentos: Buddy Agora respeita a janela do aviso', () => {
  const certs = [{ id: 'a', nome: 'ASO', validade: '2026-12-10', aviso_dias: 60 }, { id: 'c', nome: 'CNH', validade: '2026-12-10', aviso_dias: 15 }];
  const l = D.gerarAcontecimentos({ escala: null, checklist: null, certs, viagem: null, eventos: [], pagamento: null, hoje: dia('2026-10-24') });
  assert.deepEqual(l.filter(a => a.tipo === 'CERTIFICADO').map(a => a.titulo), ['ASO vence']);
});

// ─── Contatos ────────────────────────────────────────────────────────────────

test('contatos: ligar (tel:) e WhatsApp (wa.me sem mensagem)', () => {
  assert.equal(D.linkLigar('(22) 99999-1234'), 'tel:22999991234');
  assert.equal(D.linkWhatsApp('(22) 99999-1234'), 'https://wa.me/5522999991234');
  assert.equal(D.linkWhatsApp('+351 912 345 678'), 'https://wa.me/351912345678');
  assert.equal(D.linkWhatsApp('0800 123 4567'), null, '0800 não tem WhatsApp');
  assert.equal(D.linkWhatsApp('3333-4444'), null, 'sem DDD não abre WhatsApp');
  assert.equal(D.linkLigar('123'), null);
  assert.ok(!D.linkWhatsApp('22999991234').includes('text='), 'nunca pré-preenche mensagem');
  assert.equal(D.formatarTelefone('22999991234'), '(22) 99999-1234');
});

test('contatos: validação, salvar (novo/editar), excluir, leitura tolerante', () => {
  assert.match(D.validarContato({ nome: '', telefone: '22999991234' }), /nome/);
  assert.match(D.validarContato({ nome: 'Hotel', telefone: '99' }), /incompleto/);
  assert.equal(D.validarContato({ nome: 'Hotel', telefone: '2227721234' }), null);
  let l = D.salvarContato([], { nome: ' Logística ', tipo: 'LOGISTICA', telefone: '22999991234' }, '2026-10-24T10:00:00Z');
  l = D.salvarContato(l, { nome: 'Hotel', tipo: 'HOTEL', telefone: '2227721234', obs: '' });
  assert.equal(l.length, 2);
  assert.equal(l[0].nome, 'Logística');
  assert.equal(l[1].obs, undefined);
  const id = l[0].id;
  l = D.salvarContato(l, { id, nome: 'Logística Macaé', tipo: 'LOGISTICA', telefone: '22999991234' });
  assert.equal(l.length, 2);
  assert.equal(l.find(c => c.id === id).nome, 'Logística Macaé');
  l = D.removerContato(l, id);
  assert.deepEqual(l.map(c => c.nome), ['Hotel']);
  assert.deepEqual(D.normalizarContatos('lixo'), []);
  assert.equal(D.normalizarContatos([null, { id: 'x', nome: 'A', telefone: '1', tipo: 'XYZ' }, { id: 'x', nome: 'dup', telefone: '2' }])[0].tipo, 'OUTRO');
  assert.equal(D.normalizarContatos([{ id: 'x', nome: 'A', telefone: '1' }, { id: 'x', nome: 'B', telefone: '2' }]).length, 1);
});

// ─── Onde preciso estar? ─────────────────────────────────────────────────────

const VOO = { tipo: 'AVIAO', data: '2026-11-13', hora: '08:40', empresa: 'GOL', num_voo: 'G31234', origem: 'SDU', destino: 'MEA', localizador: 'ABC123', obs: 'secreto' };

test('onde estar: só na véspera e no dia da viagem', () => {
  assert.equal(O.ondePrecisoEstar(VOO, CFG, dia('2026-11-11'), '2026-11-13'), null);
  assert.equal(O.ondePrecisoEstar(VOO, CFG, dia('2026-11-12'), '2026-11-13').quando, 'AMANHA');
  assert.equal(O.ondePrecisoEstar(VOO, CFG, dia('2026-11-13'), '2026-11-13').quando, 'HOJE');
  assert.equal(O.ondePrecisoEstar(VOO, CFG, dia('2026-11-14'), '2026-11-13'), null);
  assert.equal(O.ondePrecisoEstar(null, CFG, dia('2026-11-13')), null);
});

test('onde estar (avião, dia do embarque): voo, aeroporto com coordenadas, base; nunca localizador/obs', () => {
  const cfg = { ...CFG, aeroporto: 'SBME' };
  const o = O.ondePrecisoEstar(VOO, cfg, dia('2026-11-13'), '2026-11-13');
  assert.equal(o.titulo, 'Seu embarque é hoje');
  assert.deepEqual(o.linhas.map(l => l.rotulo), ['Voo', 'Aeroporto', 'Destino', 'Base']);
  assert.equal(o.linhas[0].valor, '08:40 · GOL G31234');
  assert.equal(o.linhas[1].valor, 'Aeroporto Santos Dumont (SDU)');
  assert.ok(typeof o.mapa.latitude === 'number');
  const txt = JSON.stringify(o);
  assert.ok(!txt.includes('ABC123') && !txt.includes('secreto'));
});

test('onde estar: ônibus, van, carro — só o que foi preenchido, nada inventado', () => {
  const bus = O.ondePrecisoEstar({ tipo: 'ONIBUS', data: '2026-11-13', hora: '06:00', origem: 'Rodoviária Tietê', destino: 'Macaé' }, null, dia('2026-11-13'));
  assert.deepEqual(bus.linhas, [{ rotulo: 'Ônibus', valor: '06:00' }, { rotulo: 'Saída', valor: 'Rodoviária Tietê' }, { rotulo: 'Destino', valor: 'Macaé' }]);
  assert.equal(bus.titulo, 'Sua viagem é hoje');
  assert.deepEqual(bus.mapa, { nome: 'Rodoviária Tietê' }, 'texto vai como busca, sem coordenada inventada');
  const van = O.ondePrecisoEstar({ tipo: 'VAN', data: '2026-11-13', hora: '05:30', ponto: 'Hotel X' }, null, dia('2026-11-13'));
  assert.deepEqual(van.linhas, [{ rotulo: 'Van', valor: '05:30' }, { rotulo: 'Local', valor: 'Hotel X' }]);
  const carro = O.ondePrecisoEstar({ tipo: 'CARRO', data: '2026-11-13', destino: 'Base de Macaé' }, null, dia('2026-11-13'));
  assert.deepEqual(carro.linhas, [{ rotulo: 'Destino', valor: 'Base de Macaé' }]);
  const vazio = O.ondePrecisoEstar({ tipo: 'CARRO', data: '2026-11-13' }, null, dia('2026-11-13'));
  assert.deepEqual([vazio.linhas, vazio.mapa], [[], null]);
});

test('mapa: Android geo: (qualquer app de mapas), iOS Apple Maps, web Google Maps; reserva no navegador', () => {
  const [a, ar] = O.linksMapa({ nome: 'Hotel X' }, 'android');
  assert.equal(a, 'geo:0,0?q=Hotel%20X');
  assert.ok(ar.startsWith('https://www.google.com/maps/search/?api=1&query=Hotel%20X'));
  assert.equal(O.linksMapa({ nome: 'SDU', latitude: -22.9, longitude: -43.1 }, 'android')[0], 'geo:-22.9,-43.1?q=-22.9,-43.1(SDU)');
  assert.equal(O.linksMapa({ nome: 'Hotel X' }, 'ios')[0], 'https://maps.apple.com/?q=Hotel%20X');
  assert.ok(O.linksMapa({ nome: 'Hotel X' }, 'web')[0].startsWith('https://www.google.com/maps/'));
});

test('preparação (3 dias antes): viagem e documentos — só o que existe', () => {
  const calc = c => D.calcCertStatus(c, dia('2026-11-10'));
  const semNada = O.linhasPreparacao(null, [], '2026-11-13', calc);
  assert.deepEqual(semNada.map(l => [l.rotulo, l.valor]), [['Viagem', 'Cadastrar viagem']], 'sem documentos cadastrados: não mostra linha vazia');
  const ok = O.linhasPreparacao(VOO, [{ nome: 'ASO', validade: '2027-08-01', aviso_dias: 30 }], '2026-11-13', calc);
  assert.deepEqual(ok.map(l => [l.rotulo, l.valor]), [['Avião', '13/11 · 08:40'], ['Documentos', 'Tudo certo']]);
  const aso = O.linhasPreparacao(VOO, [{ nome: 'ASO', validade: '2026-11-28', aviso_dias: 30 }], '2026-11-13', calc);
  assert.equal(aso[1].valor, 'ASO vence em 18 dias');
  const viagemVelha = O.linhasPreparacao({ ...VOO, data: '2026-10-01' }, [], '2026-11-13', calc);
  assert.equal(viagemVelha[0].valor, 'Cadastrar viagem', 'viagem antiga não conta como a deste embarque');
});

// ─── Falta quanto pra casa? + ciclo ──────────────────────────────────────────

test('falta pra casa: caso 16/10 → 24/10 e folga', () => {
  const f = D.faltaPraCasa(resumo('2026-10-24'));
  assert.deepEqual([f.frase, f.rotulo, f.dataISO], ['Faltam 6 dias pra casa', 'Desembarque', '2026-10-30']);
  assert.equal(D.faltaPraCasa(resumo('2026-10-29')).frase, 'Amanhã você volta pra casa');
  const folga = D.faltaPraCasa(resumo('2026-11-04'));
  assert.deepEqual([folga.frase, folga.rotulo, folga.dataISO], ['Mais 9 dias em casa', 'Próximo embarque', '2026-11-13']);
  assert.equal(D.faltaPraCasa(resumo('2026-11-12')).frase, 'Último dia em casa');
  assert.equal(D.faltaPraCasa(D.resumoEscala(null)), null);
});

test('Home acompanha o ciclo: embarque → embarcado → desembarque → primeiro dia em casa → folga', () => {
  const ctx = iso => { const r = resumo(iso); return D.contextoHome(r, D.calcularMomento(CFG, dia(iso)), { total: 4, feitos: 2, pendentes: 2 }); };
  assert.equal(ctx('2026-10-16').titulo, 'Hoje é dia de embarque');
  assert.equal(ctx('2026-10-24').detalhe, 'Faltam 6 dias pra casa.');
  assert.equal(ctx('2026-10-29').titulo, 'Desembarque amanhã');
  const deb = ctx('2026-10-30');
  assert.equal(deb.titulo, 'Desembarque hoje');
  assert.equal(deb.detalhe, '14 dias embarcado concluídos. Mais 14 dias em casa.');
  assert.equal(ctx('2026-10-31').titulo, 'Primeiro dia em casa');
  assert.equal(ctx('2026-11-04').detalhe, 'Mais 9 dias em casa.');
  const pre = ctx('2026-11-10');
  assert.equal(pre.titulo, 'Embarque em 3 dias');
  assert.equal(pre.detalhe, 'Faltam 2 itens na mala.');
});

// ─── Compartilhar escala ─────────────────────────────────────────────────────

test('compartilhar: novembro/2026 do caso real — dias, marcadores e semanas', () => {
  const m = D.mesCompartilhado({ ...CFG, aeroporto: 'SBME', excecoes: [{ id: 'f', tipo: 'ferias', ini: '2026-11-01', fim: '2026-11-30' }] }, 2026, 11);
  assert.equal(m.titulo, 'NOVEMBRO 2026');
  assert.equal(m.ciclo, '14 × 14');
  assert.deepEqual(m.embarques, ['2026-11-13']);
  assert.deepEqual(m.desembarques, ['2026-11-27']);
  assert.equal(m.diasEmbarcado + m.diasFolga, 30);
  assert.equal(m.diasEmbarcado, 14);
  assert.ok(m.semanas.every(s => s.length === 7));
  assert.equal(m.semanas[0][0].dia, 1, '01/11/2026 é domingo');
  const out = D.mesCompartilhado(CFG, 2026, 10);
  assert.deepEqual(out.embarques, ['2026-10-16']);
  assert.deepEqual(out.desembarques, ['2026-10-02', '2026-10-30']);
});

test('compartilhar: privacidade — nada além do ciclo entra na imagem', () => {
  const cfg = { ...CFG, aeroporto: 'SBME', origem: 'conta', updated_at: '2026-10-24T10:00:00Z', excecoes: [{ id: 'x', tipo: 'dobra', ini: '2026-11-01', fim: '2026-11-03' }] };
  const txt = JSON.stringify(D.mesCompartilhado(cfg, 2026, 11));
  for (const proibido of ['SBME', 'Macaé', 'conta', 'dobra', 'updated', '2026-10-24T']) assert.ok(!txt.includes(proibido), proibido);
  assert.equal(D.nomeArquivoEscala(2026, 11), 'minha-escala-2026-11.png');
  assert.equal(D.mesCompartilhado(null, 2026, 11), null);
  const tela = readFileSync(new URL('../src/components/CompartilharEscala.tsx', import.meta.url), 'utf8');
  assert.ok(!/Baixe|QR|download agora/i.test(tela.replace(/download/gi, '')), 'sem propaganda invasiva');
  assert.match(tela, /Seu parceiro na vida offshore\./);
});

// ─── Lembretes: valor, sem spam ──────────────────────────────────────────────

test('véspera do embarque: UM aviso com embarque + voo + mala (sem "viagem amanhã" repetido)', () => {
  const prefs = { ...D.PREFS_LEMBRETES_PADRAO, ativo: true };
  const checklist = { ciclo: '2026-11-13', items: [{ id: 'a', t: 'Passaporte', cat: 'documentos', ok: false }, { id: 'b', t: 'x', cat: 'roupas', ok: false }] };
  const l = D.planejarLembretes({ escala: CFG, checklist, certs: [], viagem: VOO, prefs, agora: dia('2026-11-01') });
  const vespera = l.filter(x => x.quando.startsWith('2026-11-12'));
  assert.equal(vespera.length, 1);
  assert.equal(vespera[0].corpo, 'Amanhã (13/11) é dia de embarque. Voo às 08:40. Faltam 2 itens na mala.');
  assert.ok(!l.some(x => x.id.startsWith('viagem-1d')));
  assert.ok(l.some(x => x.id.startsWith('viagem-3h')), 'aviso de 3 h antes continua');
  assert.ok(l.every(x => !x.corpo.includes('Passaporte') && !x.corpo.includes('ABC123')));
  for (const x of l) assert.doesNotMatch(x.titulo + x.corpo, /sentimos sua falta|abra o|novidades/i);
});

test('lembretes: mala usa o ciclo certo (lista velha toda marcada não esconde a pendência)', () => {
  const prefs = { ...D.PREFS_LEMBRETES_PADRAO, ativo: true };
  const velha = { ciclo: '2026-10-16', items: [{ id: 'a', t: 'A', cat: 'roupas', ok: true }] };
  const l = D.planejarLembretes({ escala: CFG, checklist: velha, certs: [], viagem: null, prefs, agora: dia('2026-10-24') });
  assert.ok(l.some(x => x.id === 'checklist-2d-2026-11-13'));
});

// ─── Privacidade: sync e analytics ───────────────────────────────────────────

function arquivos(dir) {
  return readdirSync(dir).flatMap(n => { const p = join(dir, n); return statSync(p).isDirectory() ? arquivos(p) : /\.tsx?$/.test(n) ? [p] : []; });
}

test('contatos e viagem nunca vão para a Conta OW', () => {
  const sync = readFileSync(new URL('../src/sync.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(sync, /getContatos|CONTATOS|contatos_embarque/);
  assert.doesNotMatch(sync, /getViagem\(/);
});

test('analytics: nenhum evento carrega texto pessoal (nome, telefone, item, documento, data)', () => {
  const raiz = new URL('..', import.meta.url).pathname;
  const proibidas = /\b(nome|telefone|tel|whats|obs|pessoa|relacao|validade|data|dataRef|destino|origem|localizador|email|apelido|texto|t)\s*:(?!\s*(['"]|true\b|false\b|\d))/;  // literal fixo (ex.: origem: 'home') é permitido
  for (const f of [...arquivos(join(raiz, 'app')), ...arquivos(join(raiz, 'src'))]) {
    const s = readFileSync(f, 'utf8');
    for (const m of s.matchAll(/analytics\.track\(\s*'[a-z_]+'\s*(?:,\s*(\{[^}]*\}))?\s*\)/g)) {
      if (m[1]) assert.doesNotMatch(m[1], proibidas, `${f}: ${m[0]}`);
    }
  }
});

test('apagar dados do aparelho: só chaves do OWBuddy/OWNews, separado de Sair e de excluir conta', () => {
  const st = readFileSync(new URL('../src/storage.ts', import.meta.url), 'utf8');
  assert.match(st, /k\.startsWith\('owbuddy_'\) \|\| k\.startsWith\('ownews_'\)/);
  const cfg = readFileSync(new URL('../app/buddy-config.tsx', import.meta.url), 'utf8');
  assert.match(cfg, /Sair não apaga nada deste aparelho\./);
  assert.match(cfg, /Excluir minha Conta OW/);
  assert.match(cfg, /Apagar dados deste aparelho/);
  assert.match(cfg, /'Apagar tudo'/, 'confirmação explícita');
  // ownews.com.br não recebe e-mail (MX nulo): exclusão vai para a página pública da Play Store
  assert.match(cfg, /URL_EXCLUIR_CONTA = 'https:\/\/ownews\.com\.br\/excluir-conta'/);
  assert.doesNotMatch(cfg, /mailto:|suporte@ownews/);
});

test('estatísticas de uso não saem do aparelho nesta versão (sem rede no analytics)', () => {
  const a = readFileSync(new URL('../src/analytics.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(a.replace(/\/\/.*$/gm, ''), /fetch\(|XMLHttpRequest|sendBeacon|https?:\/\//);
  assert.match(a, /if \(__DEV__\)/);
});
