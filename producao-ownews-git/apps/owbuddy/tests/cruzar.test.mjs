/**
 * Cruzar Escalas 2.1 — gerenciamento (criar, editar, ocultar, excluir) sobre o domínio REAL.
 * Roda com: node --test tests/cruzar.test.mjs
 */
process.env.TZ = 'America/Sao_Paulo';

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

register('./_ts-resolver.mjs', import.meta.url);

let D, R;
before(async () => {
  D = await import('../../../packages/ow-domain/src/index.ts');
  R = await import('../src/relacao-icones.ts');
});

const HOJE = new Date('2026-10-20T12:00:00');
// Minha escala: embarquei 2026-10-06 (14x14) → a bordo 06–19/10, folga 20/10–02/11.
const EU = () => ({ tipo: '14x14', dataRef: '2026-10-06', tipoRef: 'embarquei', excecoes: [] });
// João: embarcou 2026-10-13 (14x14) → a bordo 13–26/10, folga 27/10–09/11.
const JOAO = () => ({ id: 'sec_1', nome: 'João', relacao: 'Cunhado/a', icon: 'coracao', tipo: '14x14', dataRef: '2026-10-13', tipoRef: 'embarquei' });
const ANA = () => ({ id: 'sec_2', nome: 'Ana', relacao: 'Amigo/a', icon: 'estrela', tipo: '14x14', dataRef: '2026-10-06', tipoRef: 'embarquei' });

/** Persistência como o app faz: JSON (AsyncStorage/localStorage) + codec na leitura. */
const persistir = lista => D.normalizeEscalasSecundarias(JSON.parse(JSON.stringify(lista)));

test('criar pessoa: entra na lista e sobrevive à persistência', () => {
  const lista = persistir(D.salvarEscalaSecundaria([], JOAO()));
  assert.equal(lista.length, 1);
  assert.deepEqual(lista[0], JOAO());
});

test('editar nome, relação, ícone, data e ciclo: mesmo id, mesma posição, sem duplicar', () => {
  const base = [JOAO(), ANA()];
  const editado = { ...JOAO(), nome: 'João Pedro', relacao: 'Cunhado', icon: 'barco', dataRef: '2026-10-20', tipo: '21x21' };
  const lista = persistir(D.salvarEscalaSecundaria(base, editado));
  assert.equal(lista.length, 2);
  assert.equal(lista[0].id, 'sec_1', 'editar não reordena');
  assert.equal(lista[0].nome, 'João Pedro');
  assert.equal(lista[0].relacao, 'Cunhado', 'relação em texto livre é preservada como digitada');
  assert.equal(lista[0].icon, 'barco');
  assert.equal(lista[0].dataRef, '2026-10-20');
  assert.equal(lista[0].tipo, '21x21');
  assert.deepEqual(lista[1], ANA(), 'outra pessoa intacta');
});

test('editar ciclo para personalizado guarda os dias; voltar a preset os remove', () => {
  const custom = persistir(D.salvarEscalaSecundaria([JOAO()], { ...JOAO(), tipo: 'custom', diasEmbarcado: 10, diasFolga: 20 }));
  assert.equal(D.rotuloCicloSecundaria(custom[0]), '10 × 20');
  const preset = persistir(D.salvarEscalaSecundaria(custom, { ...JOAO(), tipo: '28x28' }));
  assert.equal(preset[0].diasEmbarcado, undefined);
  assert.equal(D.rotuloCicloSecundaria(preset[0]), '28 × 28');
});

test('editar data de embarque recalcula o calendário (função canônica) e não toca na minha escala', () => {
  const eu = EU();
  const euAntes = JSON.stringify(eu);
  const antes = D.juntosNoDia(eu, [JOAO()], '2026-10-22');
  assert.equal(antes.length, 0, 'João a bordo em 22/10 com a referência antiga');
  // João passa a ter embarcado em 2026-10-06 (mesma fase que eu) → de folga junto em 22/10.
  const lista = D.salvarEscalaSecundaria([JOAO()], { ...JOAO(), dataRef: '2026-10-06' });
  const depois = D.juntosNoDia(eu, persistir(lista), '2026-10-22');
  assert.deepEqual(depois.map(s => s.nome), ['João']);
  assert.equal(JSON.stringify(eu), euAntes, 'escala principal intacta');
  // Mesmo resultado que a busca de janelas canônica
  const jan = D.encontrarJanelasJuntos(eu, D.secundariaParaConfig(lista[0]), '2026-10-20', 30, 1);
  assert.equal(jan[0].inicio, '2026-10-20');
});

test('próximo embarque da pessoa usa a regra da escala principal', () => {
  assert.equal(D.proximoEmbarqueSecundaria(JOAO(), HOJE), D.proximoEmbarqueISO(D.secundariaParaConfig(JOAO()), HOJE));
  assert.equal(D.proximoEmbarqueSecundaria(JOAO(), HOJE), '2026-11-10');
});

test('ocultar tira a pessoa do calendário sem perder dados; mostrar restaura', () => {
  const eu = EU();
  const oculto = persistir(D.definirOcultaSecundaria([JOAO()], 'sec_1', true));
  assert.equal(oculto[0].oculta, true);
  assert.equal(oculto[0].nome, 'João');
  assert.equal(oculto[0].dataRef, '2026-10-13');
  assert.deepEqual(D.cruzamentosDoDia(eu, oculto, '2026-10-28'), []);
  const visivel = persistir(D.definirOcultaSecundaria(oculto, 'sec_1', false));
  assert.equal('oculta' in visivel[0], false);
  assert.deepEqual(visivel[0], JOAO());
  assert.equal(D.juntosNoDia(eu, visivel, '2026-10-28').length, 1);
});

test('editar uma pessoa oculta mantém oculta (o form regrava o flag)', () => {
  const oculto = D.definirOcultaSecundaria([JOAO()], 'sec_1', true);
  const lista = persistir(D.salvarEscalaSecundaria(oculto, { ...JOAO(), nome: 'Jo', oculta: true }));
  assert.equal(lista[0].oculta, true);
});

test('excluir remove só aquela pessoa; cancelar (não chamar) mantém tudo', () => {
  const base = [JOAO(), ANA()];
  const cancelado = persistir(base);
  assert.equal(cancelado.length, 2);
  const removido = persistir(D.removerEscalaSecundaria(base, 'sec_1'));
  assert.deepEqual(removido.map(s => s.id), ['sec_2']);
  assert.equal(D.removerEscalaSecundaria(base, 'inexistente').length, 2);
});

test('duas pessoas no mesmo dia: cada uma separada, juntos primeiro, estado real', () => {
  const eu = EU();
  // 22/10: eu de folga; Ana de folga (mesma fase); João a bordo.
  const c = D.cruzamentosDoDia(eu, [JOAO(), ANA()], '2026-10-22');
  assert.deepEqual(c.map(x => [x.sec.nome, x.estado]), [['Ana', 'JUNTOS'], ['João', 'SO_VOCE_LIVRE']]);
  // 28/10: os dois de folga junto comigo.
  assert.deepEqual(D.juntosNoDia(eu, [JOAO(), ANA()], '2026-10-28').map(s => s.nome), ['João', 'Ana']);
  // 15/10: eu a bordo, Ana a bordo, João a bordo.
  assert.deepEqual(D.cruzamentosDoDia(eu, [JOAO(), ANA()], '2026-10-15').map(x => x.estado), ['AMBOS_A_BORDO', 'AMBOS_A_BORDO']);
  // 10/11: eu de folga? não — embarco 03/11. João de folga até 09/11 → 10/11 a bordo.
  assert.equal(D.cruzamentosDoDia(eu, [JOAO()], '2026-11-05')[0].estado, 'SO_PESSOA_LIVRE');
});

test('minha dobra nunca vira "juntos"; escala incompleta não inventa estado', () => {
  const eu = { ...EU(), excecoes: [{ id: 'd', tipo: 'dobra', ini: '2026-10-28', fim: '2026-10-28' }] };
  assert.equal(D.juntosNoDia(eu, [JOAO()], '2026-10-28').length, 0);
  const quebrada = { ...JOAO(), tipo: 'custom' };
  assert.deepEqual(D.cruzamentosDoDia(EU(), [quebrada], '2026-10-28'), []);
  assert.deepEqual(D.cruzamentosDoDia({ tipo: 'custom', dataRef: '2026-10-06', tipoRef: 'embarquei' }, [JOAO()], '2026-10-28'), []);
});

test('migração: dado antigo (emoji, sem oculta, formato web) continua funcionando sem recadastro', () => {
  const antigo = [
    { id: 'old1', nome: 'Carla', relacao: 'Cunhado', icon: '🤝', tipo: '14x14', dataRef: '2026-10-13', tipoRef: 'embarquei' },
    { id: 'web1', nome: 'Rui', relacao: 'Irmao', icon: '🤜🤛', diasEmb: 21, diasFolga: 21, refUTC: Date.UTC(2026, 9, 1), tipoRef: 'desembarquei' },
  ];
  const lista = persistir(antigo);
  assert.equal(lista.length, 2);
  assert.equal(lista[0].icon, '🤝', 'valor salvo não é reescrito');
  assert.equal(R.ioniconRelacao(lista[0].icon), 'happy', '🤝 aparece como ícone vetorial');
  assert.equal(R.ioniconRelacao(lista[1].icon), 'people');
  assert.equal(lista[0].relacao, 'Cunhado');
  assert.equal(lista[1].tipo, '21x21', 'par 21/21 do web vira o preset 21 × 21');
  assert.equal(lista[0].oculta, undefined, 'sem flag = visível');
  assert.equal(D.escalasVisiveis(lista).length, 2);
  // editar o antigo grava o ícone vetorial escolhido no MESMO id
  const editado = persistir(D.salvarEscalaSecundaria(lista, { ...lista[0], icon: R.chaveIconeRelacao(lista[0].icon) }));
  assert.equal(editado[0].id, 'old1');
  assert.equal(editado[0].icon, 'amizade');
});

test('oculta só aceita true literal (lixo antigo não esconde ninguém)', () => {
  const [s] = persistir([{ ...JOAO(), oculta: 'sim' }]);
  assert.equal(s.oculta, undefined);
});

test('offline: Cruzar só usa armazenamento local (sem rede, fora do sync)', () => {
  const storage = readFileSync(new URL('../src/storage.ts', import.meta.url), 'utf8');
  const bloco = storage.slice(storage.indexOf('export async function getEscalasCruzar'), storage.indexOf('export async function setEscalasCruzar') + 200);
  assert.doesNotMatch(bloco, /fetch|supabase|api\./i);
  const sync = readFileSync(new URL('../src/sync.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(sync, /ESCALAS_CRUZAR|getEscalasCruzar|setEscalasCruzar/);
});

test('UI sem 🤝 (e sem emoji de relação): só ícones vetoriais', () => {
  const raiz = new URL('..', import.meta.url).pathname;
  const arquivos = [];
  const andar = d => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) andar(p); else if (/\.tsx?$/.test(f)) arquivos.push(p); } };
  andar(join(raiz, 'app'));
  andar(join(raiz, 'src'));
  const comEmoji = arquivos.filter(p => !p.endsWith('relacao-icones.ts') && /🤝|🤜|❤️|👥|🔗/.test(readFileSync(p, 'utf8')));
  assert.deepEqual(comEmoji, [], 'emoji de relação só pode existir no mapa LEGADO');
  for (const k of R.ICONES_ORDEM) assert.ok(R.NOME_ICONE[k], `nome falado para ${k}`);
});

test('relação Cunhado/a disponível no formulário (neutra, sem inferir gênero)', () => {
  const form = readFileSync(new URL('../app/escala-secundaria-form.tsx', import.meta.url), 'utf8');
  assert.match(form, /label: 'Cunhado\/a'/);
});
