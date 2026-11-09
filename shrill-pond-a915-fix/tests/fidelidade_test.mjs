// Barreira de fidelidade à fonte (P0 03/11/2026). Testa o worker.js REAL; a IA verificadora é simulada.
// Uso: node --test tests/fidelidade_test.mjs
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let W;
before(async () => {
  let src = fs.readFileSync(new URL('../worker.js', import.meta.url), 'utf8').replace(/^const ([A-Z_0-9]+) = /gm, 'var $1 = ');
  src += '\nexport { verificarRelacoesFonte, barreiraFidelidade, dicaFidelidade, extrairConteudoMateria };\n';
  const f = path.join(os.tmpdir(), `fid-worker-${process.pid}.mjs`);
  fs.writeFileSync(f, src);
  W = await import('file://' + f);
});
const tipos = (fonte, txt) => W.verificarRelacoesFonte(fonte, { corpo: txt }).map((p) => p.tipo);
const passa = (fonte, txt) => assert.deepEqual(tipos(fonte, txt), [], txt);
const bloqueia = (fonte, txt, t) => assert.ok(tipos(fonte, txt).includes(t), `${txt} → esperado ${t}, veio ${JSON.stringify(tipos(fonte, txt))}`);

// Trecho real da fonte (Offshore Energy, 03/11/2026, artigo de Pavel Manchenko / Marine MAN).
const FONTE_DP = 'For offshore support vessel operators today, the scarcest resource is often not the vessel but the people who run it. ' +
  'ask any marine superintendent what keeps them awake and the answer is usually closer to home: who will relieve the Chief Officer on the PSV next month, and does he have enough DP hours to keep his certificate valid? ' +
  'A platform supply vessel on charter earns nothing while it waits for a qualified relief. ' +
  'That makes the pool of officers who are both certified and current much smaller than the headline number of DP certificates suggests.';

test('caso real DP: "disponibilidade de tripulação supera a oferta de embarcações" é BLOCK', () => {
  bloqueia(FONTE_DP, 'Segundo Pavel Manchenko, da Marine MAN, a disponibilidade de tripulação qualificada supera a oferta de embarcações, sobretudo para cargos críticos como o Chief Officer em PSV.', 'oferta_demanda_invertida');
  // O Buddy publicado (escassez) era coerente com a fonte: passa.
  passa(FONTE_DP, 'A escassez de oficiais qualificados em posicionamento dinâmico (DP) tem se tornado o principal gargalo para operadores de OSV.');
  // A correção publicada passa.
  passa(FONTE_DP, 'Para Pavel Manchenko, da Marine MAN, o recurso mais escasso para os operadores de OSV muitas vezes não é a embarcação, e sim as pessoas que a operam.');
});

test('oferta × demanda: paráfrase correta passa, inversão bloqueia', () => {
  const F = 'Demand for DP officers exceeds supply in the offshore market.';
  passa(F, 'A demanda por oficiais DP supera a oferta no mercado offshore.');
  bloqueia(F, 'A oferta de oficiais DP supera a demanda no mercado offshore.', 'oferta_demanda_invertida');
  passa('Há falta de profissionais DP no mercado.', 'O mercado enfrenta escassez de oficiais com experiência em DP.');
  bloqueia('Há falta de profissionais DP no mercado.', 'Há excesso de profissionais DP no mercado.', 'oferta_demanda_invertida');
});

test('alta × queda no mesmo percentual', () => {
  const F = 'A produção caiu 10% em setembro.';
  passa(F, 'A produção caiu aproximadamente 10% no mês.');
  bloqueia(F, 'A produção cresceu 10% no mês.', 'direcao_invertida');
  passa('Output rose 2.1% from August.', 'A produção subiu 2,1% frente a agosto.');
  bloqueia('Output rose 2.1% from August.', 'A produção recuou 2,1% frente a agosto.', 'direcao_invertida');
});

test('ordem de grandeza: milhão × bilhão, PT × EN', () => {
  passa('The contract is worth US$ 500 million.', 'O contrato vale US$ 500 milhões.');
  bloqueia('The contract is worth US$ 500 million.', 'O contrato vale US$ 5 bilhões.', 'numero_divergente');
  passa('Shell rakes in $1.45 billion for its stake.', 'A Shell recebe US$ 1,45 bilhão pela participação.');
  passa('No mês, foram produzidos 4,711 MMbbl/d de petróleo e 223,98 milhões de m³/d de gás.', 'Foram 4,711 milhões de barris por dia e 223,98 milhões de m³/d de gás.');
  bloqueia('A produção de gás foi de 223,98 milhões de m³/d.', 'A produção de gás foi de 223,98 mil m³/d.', 'numero_divergente');
});

test('previsto × realizado e datas', () => {
  bloqueia('A empresa prevê iniciar a produção em 2027.', 'A empresa iniciou a produção em 2027.', 'previsto_como_realizado');
  passa('A empresa prevê iniciar a produção em 2027.', 'A empresa prevê começar a produzir em 2027.');
  bloqueia('A operação está prevista para 2027.', 'A operação começou em 2026.', 'data_sem_fonte');
  passa('The FPSO started production in 2025.', 'O FPSO começou a produzir em 2025.');
});

test('atribuição: declaração posta na boca de quem a fonte diz que não comentou', () => {
  const F = 'An analyst at Rystad Energy said that rig demand in Brazil will stay high through 2027. Petrobras did not comment.';
  bloqueia(F, 'A Petrobras afirmou que a demanda por sondas no Brasil seguirá alta até 2027.', 'atribuicao_sem_fonte');
  bloqueia(F, 'Segundo a Petrobras, a demanda por sondas seguirá alta.', 'atribuicao_sem_fonte');
  passa(F, 'Segundo a Rystad Energy, a demanda por sondas no Brasil seguirá alta até 2027.');
  passa('Petrobras said the FPSO reached first oil.', 'A Petrobras informou que o FPSO produziu o primeiro óleo.');
});

test('confirmou × não confirmou', () => {
  bloqueia('A empresa não confirmou o contrato.', 'A empresa confirmou o contrato.', 'negacao_invertida');
  passa('A empresa não confirmou o contrato.', 'A empresa não confirmou o contrato com a operadora.');
  passa('Petrobras confirmed the contract award.', 'A Petrobras confirmou o contrato.');
});

test('falsos positivos da auditoria do acervo (03/11) continuam passando', () => {
  passa('Houve redução de 1,1% frente a maio e crescimento de 12,6% na comparação com julho de 2025.', 'A produção cresceu 12,6% frente a julho de 2025.');
  passa('O Brent subiu 4,94% na semana, enquanto o WTI cedeu 1,41%.', 'Na semana, o WTI recuou 1,41% e o Brent avançou 4,94%.');
  passa('Problemas na disponibilidade de gás levaram a Alunorte a reduzir sua produção para 50% da capacidade.', 'A falta de gás obrigou a unidade a operar a 50% da capacidade.');
  passa('O setor enfrenta excesso de oferta de energia e curtailment.', 'Ela disse que a falta de regulamentação impede a previsibilidade dos investimentos.');
  passa('Falta de mão de obra é desafio para a indústria de navegação.', 'O problema não é falta de mercado: sobra demanda e faltam profissionais treinados.');
  passa('“Conseguimos antecipar a produção da plataforma P-71, que estava originalmente prevista para 2023.”', 'A unidade entrou em produção antes do cronograma previsto para 2023.');
  passa('The project kicked off the processing stage in July 2026, with final products scheduled for April 2027.', 'A etapa de processamento começou em julho de 2026 e os produtos devem ser entregues em abril de 2027.');
  passa('O evento dá continuidade à agenda iniciada pela EPE em 2025.', 'O encontro dá sequência ao diagnóstico que a EPE começou a montar em 2025.');
  passa('The rated working pressure is 20,000 psi.', 'As árvores são de 20 mil psi.');
  passa('Os estoques tiveram alta de 2,969 milh&otilde;es de barris.', 'Os estoques subiram 2,969 milhões de barris.');
  passa('It will maintain plateau production of 140 kboe/day.', 'Deve manter um platô de 140 mil boe por dia.');
  passa('SEFE secured 1 mtpa of Canadian LNG.', 'A SEFE garantiu 1 milhão de toneladas por ano de GNL.');
  passa('Resources are estimated at more than 3 tcf of gas.', 'Os recursos passam de 3 trilhões de pés cúbicos de gás.');
  passa('A contract with a value between $50 and $100 million.', 'Contrato entre US$ 50 milhões e US$ 100 milhões.');
  passa('Capacity planned to be 160-175 kboe/d.', 'Capacidade planejada entre 160 e 175 mil boe por dia.');
  passa("It increases Oceânica's backlog to approximately R$10.3 billion (US$2.05 billion).", 'A carteira passa de US$ 2 bilhões.'.replace('passa de', 'chega a mais de'));
  passa('The partners previously signed a CCS agreement in 2023 and performed studies.', 'A parceria segue estudos iniciados em 2023.');
  passa('This nearly $1-billion development has unlocked new deepwater reserves.', 'O desenvolvimento, com investimento próximo a US$ 1 bilhão, liberou novas reservas.');
  passa('With an investment of close to a billion dollars, MP4 involved drilling two wells.', 'O investimento foi de cerca de US$ 1 bilhão.');
  bloqueia('Equinor struck gas that could deliver up to 10.3 million boe.', 'A descoberta pode produzir até 10 milhões de boe.', 'numero_divergente');
});

const IA = (problemas) => ({ AI: { run: async () => ({ response: JSON.stringify({ problemas }) }) } });
test('barreira: IA aponta entidade/atribuição grave → BLOCK com motivo legível; leve → WARN; fiel → PASS', async () => {
  const campos = { titulo: 'West Saturn inicia campanha', corpo: 'A Petrobras afirmou que o mercado está aquecido.' };
  const b = await W.barreiraFidelidade(IA([{ tipo: 'entidade', campo: 'titulo', trecho: 'West Saturn', fonte: 'West Jupiter', grave: true }]), 'West Jupiter starts campaign.', campos);
  assert.equal(b.veredito, 'BLOCK');
  assert.match(b.motivo, /Entidade trocada: "West Saturn"/);
  assert.match(W.dicaFidelidade(b), /a fonte diz: "West Jupiter"/);
  const at = await W.barreiraFidelidade(IA([{ tipo: 'atribuicao', campo: 'corpo', trecho: 'A Petrobras afirmou', fonte: 'analyst X said', grave: true }]), 'An analyst said the market is hot.', campos);
  assert.equal(at.veredito, 'BLOCK');
  assert.equal((await W.barreiraFidelidade(IA([{ tipo: 'sem_suporte', campo: 'impacto', trecho: 'x', grave: false }]), 'x', campos)).veredito, 'WARN');
  assert.equal((await W.barreiraFidelidade(IA([]), 'x', campos)).veredito, 'PASS');
});

test('barreira: problema só no resumo da fonte não bloqueia a matéria, remove o resumo', async () => {
  const b = await W.barreiraFidelidade(IA([{ tipo: 'numero', campo: 'resumo', trecho: '223.980 m³/d', grave: true }]), 'x', { corpo: 'ok', resumo: '223.980 m³/d' });
  assert.equal(b.veredito, 'PASS');
  assert.equal(b.removerResumo, true);
});

test('fail closed: verificador fora do ar, erro ou JSON inválido = BLOCK; regra determinística bloqueia sem gastar IA', async () => {
  let chamadas = 0;
  const quebra = { AI: { run: async () => { chamadas++; throw new Error('4006: daily allocation'); } } };
  assert.equal((await W.barreiraFidelidade(quebra, 'x', { corpo: 'y' })).veredito, 'BLOCK');
  assert.equal((await W.barreiraFidelidade({ AI: { run: async () => ({ response: 'não sei' }) } }, 'x', { corpo: 'y' })).veredito, 'BLOCK');
  assert.equal((await W.barreiraFidelidade({}, 'x', { corpo: 'y' })).veredito, 'BLOCK');
  chamadas = 0;
  const b = await W.barreiraFidelidade(quebra, FONTE_DP, { corpo: 'A disponibilidade de tripulação supera a oferta de embarcações.' });
  assert.equal(b.veredito, 'BLOCK'); assert.equal(b.origem, 'regras'); assert.equal(chamadas, 0);
});

test('extração: matéria longa não é cortada no 8º parágrafo (causa das "seis práticas" inventadas)', () => {
  const ps = Array.from({ length: 20 }, (_, i) => `<p>Parágrafo ${i + 1} da matéria com texto suficiente para passar no filtro de tamanho mínimo.</p>`).join('');
  const t = W.extrairConteudoMateria('<article>' + ps + '</article>');
  assert.match(t, /Parágrafo 20 /);
});
