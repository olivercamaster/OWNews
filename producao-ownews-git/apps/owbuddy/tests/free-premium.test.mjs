/**
 * OWBuddy Free + Premium — fechamento de produto (2026-10-30).
 *
 * Regras de negócio: Minha Escala e Minha Mala são FREE PARA SEMPRE (sem conta, offline,
 * sem limite); o Histórico básico é Free; o período Premium de 45 dias começa com a escala,
 * é local e sem cobrança; o fim do Premium nunca apaga nem esconde dado.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

register('./_ts-resolver.mjs', import.meta.url);

let D;
before(async () => {
  D = await import('../../../packages/ow-domain/src/index.ts');
});

const RAIZ = new URL('..', import.meta.url).pathname;
const ler = rel => readFileSync(join(RAIZ, rel), 'utf8');
const DIA = 86_400_000;
const T0 = Date.UTC(2026, 9, 30, 12);
const lojaFree = { tipo: 'ok', status: { ativo: false, produtoId: null, renovaAutomaticamente: null, fimDoPeriodo: null, pendente: false } };
const lojaPremium = { tipo: 'ok', status: { ativo: true, produtoId: 'owbuddy_plus_monthly', renovaAutomaticamente: true, fimDoPeriodo: null, pendente: false } };
const acesso = (consulta, trial, agora) => D.combinarComTrial(D.resolverAcessoPlus(consulta, null, agora), D.statusTrialPremium(trial, agora));

// ─── Período de 45 dias ─────────────────────────────────────────────────────

test('45 dias: começa uma vez só; ativo do dia 1 ao 45; dia 46 volta ao Free', () => {
  const t = D.iniciarTrialPremium(null, T0);
  assert.equal(D.iniciarTrialPremium(t, T0 + 10 * DIA), t, 'já começou: não recomeça');
  assert.deepEqual(D.statusTrialPremium(t, T0), { ativo: true, diasRestantes: 45, terminou: false, fim: T0 + 45 * DIA });
  assert.equal(D.statusTrialPremium(t, T0 + 13 * DIA).diasRestantes, 32);
  assert.equal(D.statusTrialPremium(t, T0 + 44 * DIA + 1).diasRestantes, 1);
  const fim = D.statusTrialPremium(t, T0 + 45 * DIA);
  assert.equal(fim.ativo, false);
  assert.equal(fim.terminou, true);
  assert.equal(D.statusTrialPremium(null, T0), null, 'sem escala ainda: período não começou');
});

test('antifraude leve: voltar o relógio do celular não devolve dias (relógio visto nunca recua)', () => {
  let t = D.iniciarTrialPremium(null, T0);
  t = D.tocarTrialPremium(t, T0 + 50 * DIA); // abriu o app no dia 50
  assert.equal(D.statusTrialPremium(t, T0 + 5 * DIA).terminou, true, 'relógio voltado para o dia 5: continua terminado');
  assert.equal(D.tocarTrialPremium(t, T0), t, 'relógio para trás não altera o registro');
  assert.equal(D.lerTrialPremium({ v: 1, inicio: T0, visto: T0 - DIA }).visto, T0, 'visto nunca é menor que o início');
  assert.equal(D.lerTrialPremium({ v: 2, inicio: T0 }), null);
  assert.equal(D.lerTrialPremium('lixo'), null);
});

test('níveis: free → premium_trial → premium_expired; assinatura da loja = premium_active (vence o período)', () => {
  assert.equal(acesso(lojaFree, null, T0).nivel, 'free');
  const t = D.iniciarTrialPremium(null, T0);
  const durante = acesso(lojaFree, t, T0 + 13 * DIA);
  assert.equal(durante.nivel, 'premium_trial');
  assert.equal(durante.plus, true);
  assert.equal(durante.origem, 'trial');
  assert.equal(durante.trial.diasRestantes, 32);
  const depois = acesso(lojaFree, t, T0 + 46 * DIA);
  assert.equal(depois.nivel, 'premium_expired');
  assert.equal(depois.plus, false);
  assert.equal(depois.expirou, true);
  assert.equal(acesso(lojaPremium, t, T0 + 46 * DIA).nivel, 'premium_active');
  assert.equal(acesso(lojaPremium, null, T0).nivel, 'premium_active');
});

test('período não depende da loja nem de internet: loja com erro ou carregando, Premium continua no período', () => {
  const t = D.iniciarTrialPremium(null, T0);
  assert.equal(acesso({ tipo: 'erro', motivo: 'offline' }, t, T0 + DIA).plus, true);
  assert.equal(acesso(null, t, T0 + DIA).plus, true, 'sem resposta da loja ainda');
  assert.equal(acesso({ tipo: 'erro', motivo: 'offline' }, null, T0).plus, false);
});

test('venda desligada até a missão Play Billing: sem loja = Free (não erro), nenhuma chamada nativa', () => {
  assert.equal(D.ASSINATURA_PREMIUM_LIBERADA, false);
  const loja = ler('src/plus/loja.ts');
  assert.match(loja, /\} else if \(ASSINATURA_PREMIUM_LIBERADA && \(Platform\.OS === 'android' \|\| Platform\.OS === 'ios'\)\) \{/);
  assert.match(loja, /consultar: async \(\) => \(\{ tipo: 'ok', status: \{ ativo: false/);
  assert.match(ler('app/owbuddy-plus.tsx'), /A assinatura do OWBuddy Premium ainda não está disponível\./);
});

test('indicador discreto: só Meu Buddy mostra "Premium ativo · N dias restantes"; avisos do Início uma vez cada', () => {
  assert.equal(D.textoDiasRestantes(32), '32 dias restantes');
  assert.equal(D.textoDiasRestantes(1), '1 dia restante');
  assert.match(ler('app/buddy-config.tsx'), /`Premium ativo · \$\{textoDiasRestantes\(acesso\.trial\.diasRestantes\)\}`/);
  assert.equal(D.TRIAL_AVISO_FIM_DIAS, 3);
  const aviso = ler('src/components/AvisoPeriodoPremium.tsx');
  assert.match(aviso, /Sua Escala, Minha Mala e seus dados continuam disponíveis normalmente\./);
  assert.match(aviso, /Continuar no Free/);
  assert.match(aviso, /Conhecer Premium/);
  // nada de contagem nas outras telas
  for (const f of ['app/(tabs)/escala.tsx', 'app/(tabs)/mala.tsx', 'app/(tabs)/viagem.tsx', 'app/(tabs)/certs.tsx', 'app/historico.tsx']) {
    assert.doesNotMatch(ler(f), /trial\.diasRestantes|textoDiasRestantes|AvisoPeriodoPremium/, f);
  }
});

// ─── Matriz ─────────────────────────────────────────────────────────────────

test('matriz: Premium é um conjunto (≥ 3 recursos) e nenhum deles é Escala, Mala ou dado básico', () => {
  const recursos = Object.keys(D.RECURSO_PLUS);
  assert.deepEqual(recursos.sort(), ['alertas_inteligentes', 'buddy_inteligente', 'historico_avancado']);
  assert.ok(D.BENEFICIOS_PLUS.length >= 3);
  const premium = D.BENEFICIOS_PLUS.join(' | ');
  assert.doesNotMatch(premium, /^Minha Escala|Minha Mala completa|Certificados$/);
  const free = D.RECURSOS_FREE.join(' | ');
  for (const t of ['Minha Escala', 'Minha Mala', 'Meu Histórico', 'Certificados', 'Compartilhar escala']) assert.ok(free.includes(t), t);
  assert.doesNotMatch(premium, /certificad/i, 'certificados sozinhos não são a proposta Premium');
});

// ─── Minha Escala: Free para sempre ─────────────────────────────────────────

test('Minha Escala: nenhuma referência a acesso Premium na tela, no formulário ou no cálculo', () => {
  for (const f of ['app/(tabs)/escala.tsx', 'app/escala-config.tsx', 'app/escala-excecao-form.tsx', 'app/escala-evento-form.tsx', 'app/escala-cruzar.tsx', 'src/components/CompartilharEscala.tsx']) {
    assert.doesNotMatch(ler(f), /useOwBuddyPlus|CartaoPremium|PortaoPlus|recorteFree/, f);
  }
  // Premium expirado: a escala continua calculando igual (o domínio não conhece Premium)
  assert.doesNotMatch(ler('../../packages/ow-domain/src/escala.ts'), /plus|premium/i);
});

// ─── Minha Mala: Free, editável, recorrência ────────────────────────────────

test('Minha Mala (teste 37): adicionar Café ×2 e Carregador (todos), editar para Café especial ×3, excluir outro', () => {
  let m = D.criarChecklistPadrao('2026-11-13');
  m = D.addItem(m, 'Café', 'personalizados', false, 2);
  m = D.addItem(m, 'Carregador extra', 'personalizados', true);
  const cafe = m.items.find(i => i.t === 'Café');
  assert.equal(D.qtdItem(cafe), 2);
  assert.equal(cafe.rec, false);
  m = D.editarItem(m, cafe.id, 'Café especial', false, 3);
  const editado = m.items.find(i => i.id === cafe.id);
  assert.equal(editado.t, 'Café especial');
  assert.equal(D.qtdItem(editado), 3);
  const antes = m.items.length;
  m = D.removeItem(m, 'chinelo');
  assert.equal(m.items.length, antes - 1);
  assert.ok(!m.items.some(i => i.id === 'chinelo'));
  // persistência = JSON (AsyncStorage): ida e volta sem perder nada
  assert.deepEqual(JSON.parse(JSON.stringify(m)), m);
});

test('item padrão é sugestão: renomear/quantidade ficam; restaurar padrão e novo ciclo não desfazem', () => {
  let m = D.criarChecklistPadrao('2026-11-13');
  m = D.editarItem(m, 'academia', 'Roupa íntima', true, 10);
  m = D.restaurarItensPadrao(m);
  const item = m.items.find(i => i.id === 'academia');
  assert.equal(item.t, 'Roupa íntima');
  assert.equal(D.qtdItem(item), 10);
  assert.equal(m.items.filter(i => i.id === 'academia').length, 1, 'não duplica');
  // item padrão excluído não volta sozinho
  m = D.removeItem(m, 'fone');
  const novoCiclo = D.sincronizarChecklistComCiclo(m, '2026-12-11', '2026-11-20').data;
  assert.ok(!novoCiclo.items.some(i => i.id === 'fone'), 'excluído continua fora');
  assert.equal(novoCiclo.items.find(i => i.id === 'academia').t, 'Roupa íntima');
  assert.equal(D.qtdItem(novoCiclo.items.find(i => i.id === 'academia')), 10);
});

test('Minha Mala novo ciclo (teste 38): recorrentes ficam desmarcados; "só este embarque" não volta', () => {
  let m = D.criarChecklistPadrao('2026-11-13');
  m = D.addItem(m, 'Carregador do notebook', 'personalizados', true);
  m = D.addItem(m, 'Café especial', 'personalizados', false, 3);
  m = m.items.reduce((acc, i) => D.toggleItem(acc, i.id), m); // marcou tudo
  const r = D.sincronizarChecklistComCiclo(m, '2026-12-11', '2026-11-20');
  assert.equal(r.resetado, true);
  assert.ok(r.data.items.some(i => i.t === 'Carregador do notebook'));
  assert.ok(!r.data.items.some(i => i.t === 'Café especial'));
  assert.ok(r.data.items.every(i => !i.ok));
  assert.equal(r.data.ciclo, '2026-12-11');
});

test('quantidade: 1–99, inteira; 1 não é gravado (lista igual à do OWNews web)', () => {
  assert.equal(D.normalizarQtd(0), 1);
  assert.equal(D.normalizarQtd(-3), 1);
  assert.equal(D.normalizarQtd(2.7), 2);
  assert.equal(D.normalizarQtd('7'), 7);
  assert.equal(D.normalizarQtd(500), 99);
  assert.equal(D.normalizarQtd('x'), 1);
  let m = D.addItem({ items: [], ciclo: null }, 'Meias', 'roupas', true, 1);
  assert.equal('q' in m.items[0], false);
  m = D.editarItem(m, m.items[0].id, 'Meias', undefined, 7);
  assert.equal(m.items[0].q, 7);
  m = D.editarItem(m, m.items[0].id, 'Meias', undefined, 1);
  assert.equal('q' in m.items[0], false);
});

test('reorganizar: sobe/desce dentro da categoria; pontas não mudam; outras categorias intactas', () => {
  const m = { ciclo: null, items: [
    { id: 'a', t: 'A', cat: 'higiene', ok: false }, { id: 'x', t: 'X', cat: 'roupas', ok: false },
    { id: 'b', t: 'B', cat: 'higiene', ok: false }, { id: 'c', t: 'C', cat: 'higiene', ok: false },
  ] };
  const desce = D.moverItem(m, 'a', 1);
  assert.deepEqual(desce.items.map(i => i.id), ['b', 'x', 'a', 'c']);
  assert.equal(D.moverItem(m, 'a', -1), m, 'primeiro não sobe');
  assert.equal(D.moverItem(m, 'c', 1), m, 'último não desce');
  assert.equal(D.moverItem(m, 'x', 1), m, 'único da categoria fica');
  assert.deepEqual(D.podeMoverItem(m, 'b'), { subir: true, descer: true });
  assert.deepEqual(D.podeMoverItem(m, 'x'), { subir: false, descer: false });
});

test('Minha Mala sem conta, sem portão e com ações à vista (botão ⋯, sem gesto escondido)', () => {
  const tela = ler('app/(tabs)/mala.tsx');
  assert.doesNotMatch(tela, /PortaoPlus|useOwBuddyPlus|getSession|supabase/);
  assert.match(tela, /accessibilityLabel=\{`Editar ou excluir \$\{item\.t\}`\}/, 'botão ⋯ visível em cada item');
  for (const t of ['Quantidade', 'Subir', 'Descer', 'Usar em todos os embarques', 'Ocultar da minha lista', 'Excluir item', 'Restaurar itens padrão', 'Vai lembrando. Eu guardo pra você.']) {
    assert.ok(tela.includes(t), t);
  }
  assert.match(ler('app/(tabs)/_layout.tsx'), /title: 'Minha Mala',\n\s+headerTitle: 'Minha Mala'/);
});

// ─── Meu Histórico: dados não são reféns ────────────────────────────────────

test('Histórico (teste 39): registros do período continuam; básico Free; só resumo/totais/filtros/importar são Premium', () => {
  let h = D.historicoVazio();
  const r = { id: 'r1', embarque: '2026-10-01', desembarque: '2026-10-15', unidade: 'P-78', criado_em: '2026-10-01T10:00:00Z', atualizado_em: '2026-10-01T10:00:00Z' };
  h = D.salvarRegistro(h, r, '2026-10-16T10:00:00Z');
  // o domínio do histórico não conhece Premium: expirar não muda o que é lido
  assert.doesNotMatch(ler('../../packages/ow-domain/src/historico.ts'), /plus|premium/i);
  assert.equal(D.agruparPorAno(h.registros, {}).flatMap(g => g.registros).length, 1);
  const tela = ler('app/historico.tsx');
  assert.match(tela, /agruparPorAno\(registros, plus \? \{ ano, unidade \} : \{\}\)/, 'sem Premium: lista completa, sem filtro');
  assert.match(tela, /geral\.embarques > 0 && plus \? <ResumoGeral/);
  assert.match(tela, /\{plus && anos\.length > 1 \?/);
  for (const f of ['app/historico-form.tsx', 'app/historico-registro.tsx', 'app/historico-acontecimento.tsx']) {
    assert.doesNotMatch(ler(f), /<PortaoPlus/, `${f}: registrar/editar/excluir são Free`);
  }
  assert.match(ler('app/historico-registro.tsx'), /\{podeImportar && plus \? \(/);
});

test('apagar dados do aparelho continua Free e apaga também o registro do período (privacidade > antifraude)', () => {
  const storage = ler('src/storage.ts');
  assert.match(storage, /PREMIUM_TRIAL:\s+'owbuddy_premium_trial'/);
  assert.match(storage, /k\.startsWith\('owbuddy_'\) \|\| k\.startsWith\('ownews_'\)/);
  assert.match(ler('app/buddy-config.tsx'), /O período Premium de 45 dias deste aparelho também é apagado\./);
});

test('período fora do sync e da Conta OW (nenhum dado novo vai para a nuvem)', () => {
  const sync = ler('src/sync.ts');
  assert.doesNotMatch(sync, /PREMIUM_TRIAL|getTrialPremium|getHistorico|getViagem|getContatos/);
});
