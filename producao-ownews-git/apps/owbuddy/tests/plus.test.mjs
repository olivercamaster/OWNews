/**
 * OWBuddy Free + OWBuddy+ — acesso único (OWBUDDY_PLUS), oferta transparente, dados preservados.
 * Regras puras (ow-domain/plus.ts) + garantias estáticas: sem trial local, sem preço/período
 * escritos à mão, sem compra automática, sem apagar dados, modo de teste impossível em produção.
 * Preços dos fixtures são propositalmente estranhos (R$ 7,77, US$ 1.99) para provar que o texto
 * exibido é SEMPRE o da loja.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

register('./_ts-resolver.mjs', import.meta.url);

let D;
before(async () => {
  D = await import('../../../packages/ow-domain/src/index.ts');
});

const RAIZ = new URL('..', import.meta.url).pathname;
const ler = rel => readFileSync(join(RAIZ, rel), 'utf8');
function arquivos(dir, re = /\.tsx?$/) {
  const out = [];
  for (const n of readdirSync(join(RAIZ, dir))) {
    const p = join(RAIZ, dir, n);
    if (statSync(p).isDirectory()) out.push(...arquivos(join(dir, n), re));
    else if (re.test(n)) out.push(p);
  }
  return out;
}
const semComentarios = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, '');

const AGORA = Date.UTC(2026, 9, 25, 12);
const DIA = 86_400_000;
const status = (o = {}) => ({ ativo: false, produtoId: null, renovaAutomaticamente: null, fimDoPeriodo: null, pendente: false, ...o });
const ok = o => ({ tipo: 'ok', status: status(o) });
const cachePlus = (diasAtras = 1, o = {}) => ({ v: 1, plus: true, conferidoEm: AGORA - diasAtras * DIA, fimDoPeriodo: null, jaTevePlus: true, ...o });
const cacheFree = (o = {}) => ({ v: 1, plus: false, conferidoEm: AGORA - DIA, fimDoPeriodo: null, jaTevePlus: false, ...o });

const fase = (micros, preco, periodo, ciclos, rec) => ({ priceAmountMicros: micros, formattedPrice: preco, billingPeriod: periodo, billingCycleCount: ciclos, recurrenceMode: rec });
const BASE_OFFER = (preco = 'R$ 7,77', periodo = 'P1M') => ({ id: 'monthly', basePlanIdAndroid: 'monthly', offerTokenAndroid: 'tok-base', pricingPhasesAndroid: { pricingPhaseList: [fase('7770000', preco, periodo, 0, 1)] } });
const TRIAL_OFFER = (preco = 'R$ 7,77', gratis = 'P1M') => ({ id: 'trial', basePlanIdAndroid: 'monthly', offerTokenAndroid: 'tok-trial', pricingPhasesAndroid: { pricingPhaseList: [fase('0', 'Grátis', gratis, 1, 2), fase('7770000', preco, 'P1M', 0, 1)] } });
const android = offers => ({ id: 'owbuddy_plus_monthly', platform: 'android', subscriptionOffers: offers });
const ios = (o = {}) => ({
  id: 'owbuddy_plus_monthly', displayPrice: 'R$ 7,77', subscriptionPeriodUnitIOS: 'month', subscriptionPeriodNumberIOS: '1', subscriptionGroupIdIOS: 'g1',
  subscriptionOffers: [{ type: 'introductory', paymentMode: 'free-trial', period: { unit: 'month', value: 1 }, periodCount: 1 }], ...o,
});

// ─── Entitlement: estados ────────────────────────────────────────────────────

test('entitlement único: OWBUDDY_PLUS; produto mensal com ID estável igual nas duas lojas; anual só reservado', () => {
  assert.equal(D.ENTITLEMENT_PLUS, 'OWBUDDY_PLUS');
  assert.equal(D.PRODUTO_PLUS_MENSAL, 'owbuddy_plus_monthly');
  assert.deepEqual([...D.PRODUTOS_OFERECIDOS], ['owbuddy_plus_monthly']);
  assert.ok(D.PRODUTOS_QUE_DAO_PLUS.includes('owbuddy_plus_annual'), 'anual já dá Plus quando existir');
  // Regras das lojas: Google Play (minúsculas, números, _ e .) e App Store (alfanumérico, _ e .)
  for (const id of D.PRODUTOS_QUE_DAO_PLUS) assert.match(id, /^[a-z][a-z0-9_.]*$/);
});

test('Free: loja confirma que não há assinatura → free, sem Plus', () => {
  const a = D.resolverAcessoPlus(ok({ ativo: false }), null, AGORA);
  assert.equal(a.estado, 'free');
  assert.equal(a.plus, false);
  assert.equal(a.expirou, false);
});

test('Plus: assinatura ativa (inclui período gratuito oficial) → plus', () => {
  const a = D.resolverAcessoPlus(ok({ ativo: true, produtoId: 'owbuddy_plus_monthly', renovaAutomaticamente: true }), null, AGORA);
  assert.equal(a.estado, 'plus');
  assert.equal(a.plus, true);
  assert.equal(a.cancelado, false);
  assert.equal(a.origem, 'loja');
});

test('cancelada mas ainda no período pago → continua Plus até expirar (renovação desligada)', () => {
  const fim = AGORA + 10 * DIA;
  const a = D.resolverAcessoPlus(ok({ ativo: true, renovaAutomaticamente: false, fimDoPeriodo: fim }), cachePlus(), AGORA);
  assert.equal(a.plus, true);
  assert.equal(a.cancelado, true);
  assert.equal(a.fimDoPeriodo, fim);
});

test('expirada: quem já teve Plus vê "terminou" (não "experimente"); o resto é Free normal', () => {
  const cache = D.atualizarCachePlus(null, ok({ ativo: true }), AGORA - 40 * DIA);
  assert.equal(cache.jaTevePlus, true);
  const a = D.resolverAcessoPlus(ok({ ativo: false }), cache, AGORA);
  assert.equal(a.estado, 'free');
  assert.equal(a.plus, false);
  assert.equal(a.expirou, true);
});

test('reassinatura / restauração: a loja volta a confirmar → Plus de novo (sem migração)', () => {
  let cache = D.atualizarCachePlus(null, ok({ ativo: true }), AGORA - 60 * DIA);
  cache = D.atualizarCachePlus(cache, ok({ ativo: false }), AGORA - 10 * DIA);
  assert.equal(D.resolverAcessoPlus(null, cache, AGORA).plus, false);
  const r = ok({ ativo: true, renovaAutomaticamente: true });
  cache = D.atualizarCachePlus(cache, r, AGORA);
  const a = D.resolverAcessoPlus(r, cache, AGORA);
  assert.equal(a.plus, true);
  assert.equal(a.expirou, false);
  assert.equal(cache.plus, true);
});

test('pagamento pendente (ex.: boleto) NÃO libera Plus e é informado', () => {
  const a = D.resolverAcessoPlus(ok({ ativo: false, pendente: true }), null, AGORA);
  assert.equal(a.plus, false);
  assert.equal(a.pendente, true);
});

test('offline: assinante confirmado continua Plus por até 7 dias sem falar com a loja', () => {
  const erro = { tipo: 'erro', motivo: 'offline' };
  assert.equal(D.CARENCIA_OFFLINE_DIAS, 7);
  const a = D.resolverAcessoPlus(erro, cachePlus(3), AGORA);
  assert.equal(a.plus, true);
  assert.equal(a.origem, 'cache');
  assert.equal(a.motivoErro, 'offline');
  assert.equal(D.resolverAcessoPlus(erro, cachePlus(7), AGORA).plus, true);
  // passou a carência: não afirma Plus, mas também não diz que "terminou"
  const velho = D.resolverAcessoPlus(erro, cachePlus(8), AGORA);
  assert.equal(velho.plus, false);
  assert.equal(velho.estado, 'erro');
  assert.equal(velho.expirou, false);
});

test('falha de rede nunca muda o cache (nem rebaixa, nem promove)', () => {
  const c = cachePlus(2);
  assert.equal(D.atualizarCachePlus(c, { tipo: 'erro', motivo: 'offline' }, AGORA), c);
  assert.equal(D.atualizarCachePlus(null, { tipo: 'erro', motivo: 'loja' }, AGORA), null);
});

test('erro da loja sem confirmação anterior → estado erro, sem Plus, sem "expirou"', () => {
  const a = D.resolverAcessoPlus({ tipo: 'erro', motivo: 'loja' }, null, AGORA);
  assert.equal(a.estado, 'erro');
  assert.equal(a.plus, false);
  assert.equal(a.expirou, false);
  // quem era Free continua Free (erro não vira Plus)
  assert.equal(D.resolverAcessoPlus({ tipo: 'erro', motivo: 'loja' }, cacheFree(), AGORA).plus, false);
});

test('loading: sem resposta da loja usa a última confirmação (não pisca cadeado); sem nenhuma → carregando', () => {
  assert.equal(D.resolverAcessoPlus(null, null, AGORA).estado, 'carregando');
  assert.equal(D.resolverAcessoPlus(null, null, AGORA).plus, false);
  const p = D.resolverAcessoPlus(null, cachePlus(1), AGORA);
  assert.equal(p.estado, 'plus');
  assert.equal(p.plus, true);
  assert.equal(D.resolverAcessoPlus(null, cacheFree(), AGORA).estado, 'free');
});

test('cache tolerante: lixo, versão desconhecida ou número inválido → null (vira consulta à loja)', () => {
  for (const lixo of [null, 'x', 1, {}, { v: 2, plus: true, conferidoEm: 1 }, { v: 1, plus: 'sim', conferidoEm: 1 }, { v: 1, plus: true, conferidoEm: 'ontem' }]) {
    assert.equal(D.lerCachePlus(lixo), null);
  }
  assert.deepEqual(D.lerCachePlus({ v: 1, plus: true, conferidoEm: 5 }), { v: 1, plus: true, conferidoEm: 5, fimDoPeriodo: null, jaTevePlus: true });
});

// ─── Produto: preço, período e período gratuito SÓ da loja ───────────────────

test('Google Play, trial elegível: oferta grátis + base → "1 mês grátis", depois o preço da loja', () => {
  const p = D.produtoAndroid(android([BASE_OFFER(), TRIAL_OFFER()]));
  assert.deepEqual(p.gratis, { unidade: 'mes', quantidade: 1 });
  assert.equal(p.preco, 'R$ 7,77');
  assert.equal(p.ofertaAndroid, 'tok-trial', 'compra a oferta com período gratuito');
  const o = D.ofertaTexto(p);
  assert.equal(o.cta, 'Experimentar OWBuddy+');
  assert.equal(o.destaque, '1 mês grátis');
  assert.equal(o.depois, 'Depois, R$ 7,77/mês');
  assert.equal(o.aviso, 'Após o período gratuito de 1 mês, a assinatura passa a ser R$ 7,77/mês, salvo cancelamento.');
  assert.match(o.renovacao, /^Renovação automática todo mês até você cancelar/);
  assert.match(o.cancelamento, /Google Play/);
});

test('Google Play, trial NÃO elegível (loja não devolve a oferta grátis) → sem "grátis", CTA Assinar', () => {
  const p = D.produtoAndroid(android([BASE_OFFER()]));
  assert.equal(p.gratis, null);
  assert.equal(p.ofertaAndroid, 'tok-base');
  const o = D.ofertaTexto(p);
  assert.equal(o.cta, 'Assinar OWBuddy+');
  assert.equal(o.destaque, 'R$ 7,77/mês');
  assert.equal(o.depois, null);
  assert.doesNotMatch(JSON.stringify(o), /grátis|gratuito|trial/i);
});

test('Google Play: duração do período gratuito vem da loja (7 dias, 2 semanas), nunca fixa', () => {
  assert.deepEqual(D.produtoAndroid(android([TRIAL_OFFER('R$ 7,77', 'P7D')])).gratis, { unidade: 'dia', quantidade: 7 });
  const duas = TRIAL_OFFER('R$ 7,77', 'P1W');
  duas.pricingPhasesAndroid.pricingPhaseList[0].billingCycleCount = 2;
  const p = D.produtoAndroid(android([duas]));
  assert.deepEqual(p.gratis, { unidade: 'semana', quantidade: 2 });
  assert.equal(D.ofertaTexto(p).destaque, '2 semanas grátis');
});

test('Google Play: preço promocional PAGO é ignorado (só anunciamos o que explicamos)', () => {
  const intro = { id: 'intro', basePlanIdAndroid: 'monthly', offerTokenAndroid: 'tok-intro', pricingPhasesAndroid: { pricingPhaseList: [fase('990000', 'R$ 0,99', 'P1M', 1, 2), fase('7770000', 'R$ 7,77', 'P1M', 0, 1)] } };
  const p = D.produtoAndroid(android([intro, BASE_OFFER()]));
  assert.equal(p.ofertaAndroid, 'tok-base');
  assert.equal(p.gratis, null);
  assert.equal(D.produtoAndroid(android([intro])), null, 'sem plano base claro → sem produto (erro na tela, não preço inventado)');
});

test('preço localizado: moeda e formato do país passam intactos; período da loja', () => {
  assert.equal(D.ofertaTexto(D.produtoAndroid(android([BASE_OFFER('US$ 1.99')]))).destaque, 'US$ 1.99/mês');
  assert.equal(D.ofertaTexto(D.produtoAndroid(android([BASE_OFFER('€ 2,49', 'P1Y')]))).destaque, '€ 2,49/ano');
  assert.equal(D.ofertaTexto(D.produtoAndroid(android([BASE_OFFER('R$ 19,90', 'P3M')]))).destaque, 'R$ 19,90 a cada 3 meses');
  assert.equal(D.ofertaTexto(D.produtoIOS(ios({ displayPrice: 'US$ 1.99' }), false)).destaque, 'US$ 1.99/mês');
});

test('ausência de preço / dados incompletos → null (a tela mostra "não foi possível consultar")', () => {
  assert.equal(D.produtoAndroid(null), null);
  assert.equal(D.produtoAndroid(android([])), null);
  assert.equal(D.produtoAndroid(android([{ offerTokenAndroid: 't', pricingPhasesAndroid: { pricingPhaseList: [] } }])), null);
  assert.equal(D.produtoAndroid(android([{ offerTokenAndroid: 't', pricingPhasesAndroid: { pricingPhaseList: [fase('1', '', 'P1M', 0, 1)] } }])), null);
  assert.equal(D.produtoAndroid(android([{ offerTokenAndroid: 't', pricingPhasesAndroid: { pricingPhaseList: [fase('1', 'R$ 1', 'PXM', 0, 1)] } }])), null);
  assert.equal(D.produtoIOS(ios({ displayPrice: '' }), true), null);
  assert.equal(D.produtoIOS(ios({ subscriptionPeriodUnitIOS: 'empty' }), true), null);
});

test('App Store: período gratuito só com elegibilidade CONFIRMADA (true); false ou desconhecida → sem promessa', () => {
  assert.deepEqual(D.produtoIOS(ios(), true).gratis, { unidade: 'mes', quantidade: 1 });
  assert.equal(D.produtoIOS(ios(), false).gratis, null);
  assert.equal(D.produtoIOS(ios(), null).gratis, null);
  // oferta introdutória paga não vira "grátis"
  assert.equal(D.produtoIOS(ios({ subscriptionOffers: [{ type: 'introductory', paymentMode: 'pay-as-you-go', period: { unit: 'month', value: 1 }, periodCount: 3 }] }), true).gratis, null);
  const o = D.ofertaTexto(D.produtoIOS(ios(), true));
  assert.match(o.cancelamento, /24 horas antes do fim do período gratuito/);
  assert.match(o.renovacao, /App Store/);
});

test('textos de período: unidades e plurais', () => {
  assert.deepEqual(D.periodoISO('P1M'), { unidade: 'mes', quantidade: 1 });
  assert.deepEqual(D.periodoISO('p1y'), { unidade: 'ano', quantidade: 1 });
  assert.equal(D.periodoISO('P0M'), null);
  assert.equal(D.periodoISO('P1H'), null);
  assert.equal(D.textoDuracao({ unidade: 'mes', quantidade: 3 }), '3 meses');
  assert.equal(D.textoDuracao({ unidade: 'dia', quantidade: 1 }), '1 dia');
  assert.equal(D.textoRecorrencia({ unidade: 'ano', quantidade: 1 }), 'todo ano');
});

// ─── Dados preservados ──────────────────────────────────────────────────────

test('dados preservados após expiração: texto conta o que ficou guardado; zero → nada a dizer', () => {
  assert.equal(D.textoDadosGuardados('historico', 6), 'Seus 6 embarques registrados continuam guardados.');
  assert.equal(D.textoDadosGuardados('historico', 1), 'Seu embarque registrado continua guardado.');
  assert.equal(D.textoDadosGuardados('mala', 12), 'Os 12 itens da sua mala continuam guardados.');
  assert.equal(D.textoDadosGuardados('documentos', 0), null);
  for (const r of ['mala', 'viagem', 'documentos', 'historico', 'contatos']) {
    assert.doesNotMatch(D.textoDadosGuardados(r, 3) ?? '', /perd|apag|expira|última|urgente/i);
  }
});

test('recorte Free: sem Plus só esconde do cálculo; nunca altera nem apaga o original; com Plus devolve o mesmo', () => {
  const dados = { checklist: { items: [{ id: 'a', t: 'x', cat: 'c', ok: false }], ciclo: null }, certs: [{ id: 'c1', nome: 'NR-37' }], viagem: { tipo: 'AVIAO', data: '2026-10-30' }, outro: 1 };
  const copia = structuredClone(dados);
  const free = D.recorteFree(false, dados);
  assert.deepEqual(free, { checklist: null, certs: [], viagem: null, outro: 1 });
  assert.deepEqual(dados, copia, 'original intacto');
  assert.equal(D.recorteFree(true, dados), dados);
});

test('Buddy Agora Free: o acontecimento fica, só some o atalho para recurso Plus', () => {
  const l = [{ id: 'e', acao: { tipo: 'rota', label: 'Ver checklist', rota: '/mala' } }, { id: 'p', acao: { tipo: 'rota', label: 'Ver regra', rota: '/pagamento' } }, { id: 't', acao: { tipo: 'transporte', label: 'Transporte' } }];
  const f = D.semAtalhoPlus(false, l);
  assert.equal(f.length, 3);
  assert.equal(f[0].acao, undefined);
  assert.equal(f[1].acao.rota, '/pagamento');
  assert.equal(f[2].acao.tipo, 'transporte');
  assert.equal(l[0].acao.rota, '/mala', 'original intacto');
  assert.equal(D.semAtalhoPlus(true, l), l);
  assert.match(ler('app/(tabs)/index.tsx'), /semAtalhoPlus\(plus, gerarAcontecimentos/);
  assert.match(ler('app/proximos.tsx'), /semAtalhoPlus\(plus, gerarAcontecimentos/);
});

test('dados restaurados ao reassinar: as telas Plus leem as MESMAS chaves de sempre (sem cópia/migração)', () => {
  const storage = ler('src/storage.ts');
  for (const [k, v] of [['CHECKLIST', 'ownews_checklist_mala'], ['VIAGEM', 'ownews_minha_viagem'], ['CERTS', 'ownews_certificados'], ['CONTATOS', 'owbuddy_contatos_embarque'], ['HISTORICO', 'owbuddy_historico']]) {
    assert.match(storage, new RegExp(`${k}:\\s+'${v}'`));
  }
  const plusBloco = storage.slice(storage.indexOf('// ─── OWBuddy+'), storage.indexOf('// ─── Aparência'));
  assert.match(plusBloco, /getCachePlus/);
  assert.doesNotMatch(plusBloco, /KEYS\.(CHECKLIST|VIAGEM|CERTS|CONTATOS|HISTORICO)/, 'OWBuddy+ não toca dados de recursos');
});

// ─── Garantias estáticas ────────────────────────────────────────────────────

const PLUS_ARQS = ['src/plus/acesso.tsx', 'src/plus/loja.ts', 'src/plus/loja-nativa.ts', 'src/plus/loja-teste.ts', 'src/components/PortaoPlus.tsx', 'app/owbuddy-plus.tsx'];

test('nenhuma exclusão de dados: a camada Plus não remove, não sobrescreve e não chama "apagar dados"', () => {
  for (const f of PLUS_ARQS) {
    const s = semComentarios(ler(f));
    assert.doesNotMatch(s, /apagarDadosDoAparelho|multiRemove|removeItem|AsyncStorage\.clear|setChecklist|setViagem|setCerts|setContatos|alterarHistorico|setHistorico/, f);
  }
  // o portão não monta a tela Plus sem acesso (nada é lido para edição nem gravado)
  const portao = ler('src/components/PortaoPlus.tsx');
  assert.match(portao, /if \(plus\) return <>\{children\}<\/>;/);
});

test('não existe trial local: nada de data de instalação, contador ou período gratuito calculado no app', () => {
  const todos = [...arquivos('app'), ...arquivos('src'), join(RAIZ, '../../packages/ow-domain/src/plus.ts')];
  for (const f of todos) {
    const s = semComentarios(readFileSync(f, 'utf8'));
    assert.doesNotMatch(s, /installedAt|instaladoEm|dataInstalacao|first_?open|trialInicio|inicioTrial|trial_?start/i, f);
  }
  const dom = semComentarios(ler('../../packages/ow-domain/src/plus.ts'));
  assert.doesNotMatch(dom, /\b30\s*dias\b/);
  // único lugar com tempo próprio: carência offline de quem a LOJA confirmou (nunca concede a Free)
  assert.match(dom, /cache\.plus && agora - cache\.conferidoEm <= CARENCIA_OFFLINE_DIAS \* DIA_MS/);
});

test('não hardcodar preço nem período gratuito em telas/serviços (só o modo de teste tem valor fictício rotulado)', () => {
  const todos = [...arquivos('app'), ...arquivos('src')].filter(f => !f.endsWith('src/plus/loja-teste.ts'));
  for (const f of todos) {
    const s = semComentarios(readFileSync(f, 'utf8'));
    assert.doesNotMatch(s, /R\$\s?\d|US\$\s?\d|\d+,\d{2}\s*\/\s*m[eê]s|\b\d+\s*dias grátis|\b1 mês grátis|30 dias/i, f);
  }
  const teste = ler('src/plus/loja-teste.ts');
  assert.match(teste, /preco: 'R\$ 0,00'/);
  assert.match(ler('app/owbuddy-plus.tsx'), /Modo de teste: preço e período fictícios\. Nada é cobrado\./);
});

test('nenhum checkout automático: compra só por toque no botão da tela OWBuddy+', () => {
  const tela = ler('app/owbuddy-plus.tsx');
  assert.match(tela, /onPress=\{\(\) => onComprar\(produto\)\}/);
  // só a tela OWBuddy+ chama comprar; requestPurchase só dentro de comprar() da loja nativa
  for (const f of [...arquivos('app'), ...arquivos('src')]) {
    const s = semComentarios(readFileSync(f, 'utf8'));
    const rel = f.slice(RAIZ.length);
    if (/\bp\.comprar\(|\.comprar\(produto\)/.test(s)) assert.equal(rel, 'app/owbuddy-plus.tsx', rel);
    if (/requestPurchase\(/.test(s)) assert.equal(rel, 'src/plus/loja-nativa.ts', rel);
  }
  const nativa = ler('src/plus/loja-nativa.ts');
  const corpoComprar = nativa.slice(nativa.indexOf('async function comprar('), nativa.indexOf('async function restaurar('));
  assert.match(corpoComprar, /IAP\.requestPurchase/);
  assert.equal((nativa.match(/IAP\.requestPurchase/g) || []).length, 1);
  // ao abrir o app ou a tela, nada compra: efeitos só carregam produto/estado
  const acesso = ler('src/plus/acesso.tsx');
  const iniciar = acesso.slice(acesso.indexOf('async function iniciar('), acesso.indexOf('export function useIniciarPlus'));
  assert.doesNotMatch(iniciar, /comprar|requestPurchase/);
  assert.doesNotMatch(tela.slice(tela.indexOf('useEffect(() => {'), tela.indexOf('const [comprar')), /comprar\(/);
});

test('nenhum trial automático e nenhum paywall ao abrir o app: portão só EXPLICA e leva à tela informativa', () => {
  const portao = semComentarios(ler('src/components/PortaoPlus.tsx'));
  assert.doesNotMatch(portao, /comprar|requestPurchase/);
  assert.match(portao, /router\.push\(\{ pathname: '\/owbuddy-plus'/);
  assert.match(portao, /Conhecer OWBuddy\+/);
  assert.match(portao, /Agora não/);
  for (const f of ['app/_layout.tsx', 'app/(tabs)/index.tsx', 'app/(tabs)/_layout.tsx']) {
    assert.doesNotMatch(ler(f), /owbuddy-plus'/, `${f} não abre a tela OWBuddy+ sozinho`);
  }
});

test('transparência na tela: aviso de cobrança junto do botão, renovação, cancelamento, Free continua, dados não apagados, restaurar e gerenciar', () => {
  const tela = ler('app/owbuddy-plus.tsx');
  const oferta = tela.slice(tela.indexOf('function Oferta('), tela.indexOf('function Linha('));
  // aviso imediatamente antes do botão, em texto de corpo (15 px, cor primária)
  assert.match(oferta, /<Text style=\{styles\.aviso\}>\{o\.aviso\}<\/Text>\s*<TouchableOpacity/);
  assert.match(tela, /aviso: \{ fontSize: 15, lineHeight: 22, color: colors\.white \}/);
  for (const t of ['o.renovacao', 'o.cancelamento', 'O OWBuddy Free continua funcionando normalmente.', 'nada é apagado', 'Restaurar compras', 'Gerenciar assinatura', 'Continuar no Free', 'Não foi possível consultar o OWBuddy+ agora.', 'Tentar novamente', 'A assinatura é gerenciada pela loja onde foi contratada']) {
    assert.ok(tela.includes(t), t);
  }
  // nada de urgência, ameaça ou "melhor valor"
  for (const f of PLUS_ARQS) {
    assert.doesNotMatch(ler(f), /última chance|ultima chance|perderá|vai perder|best value|melhor valor|só hoje|oferta expira|corra|countdown|cronômetro/i, f);
  }
});

test('data só quando a loja informa: "Próxima renovação"/"Ativo até" dependem de fimDoPeriodo', () => {
  const tela = ler('app/owbuddy-plus.tsx');
  assert.match(tela, /else if \(acesso\.fimDoPeriodo\) linha = `Próxima renovação:/);
  assert.match(tela, /acesso\.fimDoPeriodo\s*\n?\s*\? `Renovação automática desligada\. Ativo até/);
  assert.match(ler('src/plus/loja-nativa.ts'), /fim = typeof s\.expirationDateIOS === 'number' \? s\.expirationDateIOS : null;/);
});

test('telas Plus atrás do portão (com o recurso certo); telas Free intocadas', () => {
  const gates = {
    'app/(tabs)/mala.tsx': 'mala', 'app/(tabs)/viagem.tsx': 'viagem', 'app/(tabs)/certs.tsx': 'documentos',
    'app/historico.tsx': 'historico', 'app/historico-registro.tsx': 'historico', 'app/historico-form.tsx': 'historico',
    'app/historico-acontecimento.tsx': 'historico', 'app/contato-form.tsx': 'contatos',
  };
  for (const [f, r] of Object.entries(gates)) {
    assert.match(ler(f), new RegExp(`export default function \\w+\\(\\) \\{\\n  useTema\\(\\);\\n  return <PortaoPlus recurso="${r}"`), f);
  }
  for (const f of ['app/(tabs)/escala.tsx', 'app/(tabs)/index.tsx', 'app/escala-config.tsx', 'app/escala-cruzar.tsx', 'src/components/CompartilharEscala.tsx', 'app/buddy-config.tsx', 'app/vagas.tsx', 'app/unidades.tsx', 'app/noticias.tsx', 'app/aeroportos.tsx']) {
    assert.doesNotMatch(ler(f), /<PortaoPlus/, `${f} é Free`);
  }
  // barra inferior continua com as mesmas 5 abas
  const tabs = ler('app/(tabs)/_layout.tsx');
  for (const t of ["title: 'Início'", "title: 'Escala'", "title: 'Embarque'", "title: 'Viagem'", "title: 'Certificados'"]) assert.ok(tabs.includes(t), t);
});

test('Início, Buddy Agora e lembretes usam o recorte Free sem Plus (e não apagam nada)', () => {
  const home = ler('app/(tabs)/index.tsx');
  assert.match(home, /recorteFree\(plus, \{ viagem: state\.viagem, checklist: state\.checklist, certs: state\.certs \}\)/);
  assert.match(home, /const avisoHist = plus \?/);
  assert.match(home, /if \(!state \|\| !plusLido\)/, 'Início espera a última confirmação: sem piscar');
  assert.match(ler('app/proximos.tsx'), /recorteFree\(plus,/);
  const notif = ler('src/notifications.ts');
  assert.match(notif, /recorteFree\(acesso\.plus,/);
  assert.match(notif, /if \(acesso\.estado === 'carregando'\) return 0;/, 'sem resposta ainda: não mexe no que está agendado');
});

test('analytics do OWBuddy+: só ação e valores fixos (sem preço, moeda, token, recibo, pedido)', () => {
  for (const f of [...arquivos('app'), ...arquivos('src')]) {
    const s = readFileSync(f, 'utf8');
    for (const m of s.matchAll(/analytics\.track\(\s*'plus_[a-z_]+'\s*(?:,\s*([^)]*))?\)/g)) {
      if (m[1]) assert.doesNotMatch(m[1], /preco|price|moeda|currency|token|receipt|recibo|order|pedido|transaction|email|conta/i, `${f}: ${m[0]}`);
    }
  }
  const a = ler('src/analytics.ts');
  for (const e of ['plus_tela_aberta', 'plus_bloqueio_visto', 'plus_agora_nao', 'plus_cta_tocado', 'plus_compra_resultado', 'plus_restaurar_resultado', 'plus_gerenciar_aberto']) assert.ok(a.includes(`'${e}'`), e);
});

test('Conta OW opcional: assinatura não depende de login nem vai para Supabase/sync', () => {
  for (const f of PLUS_ARQS) {
    const s = ler(f);
    assert.doesNotMatch(s, /from '\.\.\/auth'|from '\.\.\/supabase'|from '\.\.\/sync'|from '\.\.\/src\/auth'|from '\.\.\/src\/supabase'|getSession|signIn/, f);
  }
  assert.doesNotMatch(ler('src/sync.ts'), /PLUS|plus_cache|getCachePlus/);
  assert.match(ler('app/owbuddy-plus.tsx'), /Não precisa de Conta OW para assinar/);
});

test('sem segredo no app: nenhuma chave de API, service role ou chamada de rede na camada Plus', () => {
  for (const f of PLUS_ARQS) {
    const s = semComentarios(ler(f));
    assert.doesNotMatch(s, /fetch\(|apiKey|api_key|service_role|secret|sk_live|appl_|goog_|verifyPurchaseWithProvider|iapkit/i, f);
  }
});

test('modo de teste: impossível em build nativo de produção; só __DEV__ ou preview web com a flag', () => {
  assert.equal(D.modoTestePermitido({ dev: false, plataforma: 'android', flag: '1' }), false);
  assert.equal(D.modoTestePermitido({ dev: false, plataforma: 'ios', flag: '1' }), false);
  assert.equal(D.modoTestePermitido({ dev: false, plataforma: 'web', flag: undefined }), false);
  assert.equal(D.modoTestePermitido({ dev: false, plataforma: 'web', flag: '0' }), false);
  assert.equal(D.modoTestePermitido({ dev: false, plataforma: 'web', flag: '1' }), true);
  assert.equal(D.modoTestePermitido({ dev: true, plataforma: 'android', flag: undefined }), true);
  const loja = ler('src/plus/loja.ts');
  assert.match(loja, /dev: typeof __DEV__ !== 'undefined' && __DEV__ === true/);
  assert.match(loja, /plataforma: Platform\.OS/);
  assert.match(loja, /flag: process\.env\.EXPO_PUBLIC_OWBUDDY_PLUS_TESTE/);
  assert.match(loja, /if \(modoTesteAtivo\(\)\) \{\n[^\n]*\n[^\n]*loja-teste/);
  // nenhum perfil de build nem config liga a flag
  assert.doesNotMatch(ler('eas.json'), /OWBUDDY_PLUS_TESTE/);
  assert.doesNotMatch(ler('app.json'), /OWBUDDY_PLUS_TESTE/);
  // painel de cenários só renderiza com modo de teste; o cenário só é lido pela loja de teste
  assert.match(ler('app/owbuddy-plus.tsx'), /\{p\.modoTeste \? <PainelTeste \/> : null\}/);
  for (const f of [...arquivos('app'), ...arquivos('src')]) {
    const rel = f.slice(RAIZ.length);
    if (/getCenarioTestePlus|definirCenarioTeste/.test(readFileSync(f, 'utf8'))) {
      assert.ok(['src/storage.ts', 'src/plus/loja-teste.ts', 'app/owbuddy-plus.tsx'].includes(rel), rel);
    }
  }
  const ids = D.CENARIOS_TESTE_PLUS.map(c => c.id);
  for (const c of ['free_trial', 'free_sem_trial', 'plus', 'plus_cancelado', 'expirado', 'carregando', 'erro', 'offline_plus']) assert.ok(ids.includes(c), c);
});

test('dependência auditada: expo-iap fixado (~6.3), plugin no app.json, sem serviço pago', () => {
  const pkg = JSON.parse(ler('package.json'));
  assert.equal(pkg.dependencies['expo-iap'], '~6.3.0');
  assert.equal(pkg.dependencies['react-native-purchases'], undefined);
  assert.ok(JSON.parse(ler('app.json')).expo.plugins.includes('expo-iap'));
  // package ID e versionCode intactos
  const app = JSON.parse(ler('app.json')).expo;
  assert.equal(app.android.package, 'br.com.ownews.owbuddy');
  assert.equal(app.android.versionCode, 12);
  assert.equal(app.ios.bundleIdentifier, 'br.com.ownews.owbuddy');
});
