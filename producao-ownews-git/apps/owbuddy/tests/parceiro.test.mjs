/**
 * Camada parceiro pessoal: Buddy Agora, Datas importantes, Meu Pagamento, presentes,
 * saudações, Home personalizável e lembretes. Contra o domínio REAL (packages/ow-domain).
 */
process.env.TZ = 'America/Sao_Paulo';
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
register('./_ts-resolver.mjs', import.meta.url);
let D;
before(async () => { D = await import('../../../packages/ow-domain/src/index.ts'); });

const dia = (iso, h = 12) => new Date(`${iso}T${String(h).padStart(2, '0')}:00:00`);
const ESC = { tipo: '14x14', dataRef: '2026-10-19', tipoRef: 'embarquei' }; // 19/10–01/11 embarcado; DEB 02/11; EMB 16/11
const ev = (id, tipo, data_ini, extra = {}) => ({ id, tipo, nome: extra.nome ?? '', data_ini, ...extra });
const gerar = (o) => D.gerarAcontecimentos({ escala: null, checklist: null, certs: [], viagem: null, eventos: [], pagamento: null, hoje: dia('2026-10-19'), ...o });

// ─── Buddy Agora ───────────────────────────────────────────────────────────
test('faixas: hoje, amanhã, 7 dias, 30 dias, mais adiante', () => {
  assert.deepEqual([0, 1, 2, 7, 8, 30, 31, 200].map(D.faixaDe), ['HOJE', 'AMANHA', 'SEMANA', 'SEMANA', 'MES', 'MES', 'DEPOIS', 'DEPOIS']);
  const l = gerar({ eventos: [
    ev('a', 'COMPROMISSO', '2026-10-19', { nome: 'Hoje' }), ev('b', 'COMPROMISSO', '2026-10-20', { nome: 'Amanhã' }),
    ev('c', 'COMPROMISSO', '2026-10-26', { nome: 'Sete' }), ev('d', 'COMPROMISSO', '2026-11-18', { nome: 'Trinta' }),
    ev('e', 'COMPROMISSO', '2026-11-19', { nome: 'Trinta e um' }), ev('f', 'COMPROMISSO', '2026-10-18', { nome: 'Passado' }),
  ] });
  assert.deepEqual(l.map(a => [a.titulo, a.dias, a.faixa]), [
    ['Hoje', 0, 'HOJE'], ['Amanhã', 1, 'AMANHA'], ['Sete', 7, 'SEMANA'], ['Trinta', 30, 'MES'], ['Trinta e um', 31, 'DEPOIS'],
  ]);
  assert.equal(D.quandoTexto(0, '2026-10-19', '08:00'), 'Hoje · 08:00');
  assert.equal(D.quandoTexto(1, '2026-10-20'), 'Amanhã');
  assert.equal(D.quandoTexto(4, '2026-10-23', '08:00'), '23/10 · 08:00 · daqui a 4 dias');
});

test('recorrência anual, virada de ano e 29/02', () => {
  const aniv = ev('n', 'ANIVERSARIO', '1990-10-31', { pessoa: 'Ana', recorrencia: 'anual' });
  assert.deepEqual(D.proximaOcorrencia(aniv, '2026-10-19'), { iso: '2026-10-31', dias: 12, emAndamento: false });
  assert.deepEqual(D.proximaOcorrencia(aniv, '2026-11-01'), { iso: '2027-10-31', dias: 364, emAndamento: false });
  assert.equal(D.tituloEvento(aniv), 'Aniversário de Ana');
  const virada = ev('v', 'ANIVERSARIO', '2000-01-05', { recorrencia: 'anual' });
  assert.deepEqual(D.proximaOcorrencia(virada, '2026-12-30'), { iso: '2027-01-05', dias: 6, emAndamento: false });
  const bis = ev('b', 'ANIVERSARIO', '2000-02-29', { recorrencia: 'anual' });
  assert.equal(D.proximaOcorrencia(bis, '2027-02-20').iso, '2027-02-28');
  assert.equal(D.proximaOcorrencia(bis, '2028-02-20').iso, '2028-02-29');
  // calendário mostra o aniversário todo ano
  assert.equal(D.eventoOcorreEm(aniv, '2031-10-31'), true);
  assert.equal(D.eventoOcorreEm(ev('x', 'CURSO', '2026-10-23'), '2027-10-23'), false);
  // evento de vários dias em andamento
  assert.deepEqual(D.proximaOcorrencia(ev('c', 'CURSO', '2026-10-15', { data_fim: '2026-10-21' }), '2026-10-19'), { iso: '2026-10-19', dias: 0, emAndamento: true });
});

test('fuso: 23:30 em Brasília ainda é o mesmo dia (dia de calendário local)', () => {
  const l = D.gerarAcontecimentos({ escala: null, checklist: null, certs: [], viagem: null, pagamento: null,
    eventos: [ev('a', 'CURSO', '2026-10-20', { nome: 'NR-35' })], hoje: new Date('2026-10-19T23:30:00') });
  assert.equal(l[0].dias, 1);
  assert.equal(l[0].faixa, 'AMANHA');
});

test('relação com a escala: embarcado, folga, troca e hoje (regra canônica)', () => {
  const l = gerar({ escala: ESC, eventos: [
    ev('curso', 'CURSO', '2026-10-23', { nome: 'Curso NR-35', hora_ini: '08:00' }),
    ev('troca', 'COMPROMISSO', '2026-11-02', { nome: 'Dentista' }),
    ev('folga', 'PESSOAL', '2026-11-05', { nome: 'Churrasco' }),
    ev('hoje', 'OUTRO', '2026-10-19', { nome: 'Hoje' }),
  ] });
  const por = Object.fromEntries(l.filter(a => a.tipo === 'EVENTO').map(a => [a.meta.eventoId, a.detalhe]));
  assert.equal(por.curso, 'Você estará embarcado nessa data.');
  assert.equal(por.troca, 'É dia de desembarque.');
  assert.equal(por.folga, 'Você estará de folga nessa data.');
  assert.equal(por.hoje, 'Hoje é dia de embarque.');
  // dobra/férias respeitadas (mesma regra do calendário)
  const comFerias = { ...ESC, excecoes: [{ id: 'f', tipo: 'ferias', ini: '2026-11-03', fim: '2026-11-10' }] };
  const l2 = gerar({ escala: comFerias, eventos: [ev('folga', 'PESSOAL', '2026-11-05', { nome: 'X' })] });
  assert.equal(l2.find(a => a.tipo === 'EVENTO').detalhe, 'Você estará de férias nessa data.');
  // embarque/desembarque derivados da escala
  const emb = l.find(a => a.tipo === 'EMBARQUE'), deb = l.find(a => a.tipo === 'DESEMBARQUE');
  assert.equal(emb.dataISO, '2026-11-16'); assert.equal(deb.dataISO, '2026-11-02'); assert.equal(deb.dias, 14);
});

test('ordenação: faixa → criticidade → data; limite de 3 na Home sem duplicar o card da escala', () => {
  const l = gerar({
    escala: ESC,
    certs: [{ id: 'c1', nome: 'ASO', validade: '2026-10-25' }, { id: 'c2', nome: 'HUET', validade: '2026-11-15' }, { id: 'c3', nome: 'Longe', validade: '2027-06-01' }],
    viagem: { tipo: 'AVIAO', data: '2026-10-24', hora: '18:40', destino: 'Macaé' },
    eventos: [
      ev('a', 'ANIVERSARIO', '1990-10-21', { pessoa: 'Ana', recorrencia: 'anual' }),
      ev('c', 'CURSO', '2026-10-23', { nome: 'Curso NR-35' }),
    ],
    pagamento: { ...D.CONFIG_PAGAMENTO_PADRAO },
  });
  const semana = l.filter(a => a.faixa === 'SEMANA').map(a => a.titulo);
  assert.deepEqual(semana, ['ASO vence', 'Voo para Macaé', 'Curso NR-35', 'Aniversário de Ana']);
  assert.ok(!l.some(a => a.titulo.startsWith('Longe')), 'certificado > 30 dias fica fora');
  const pg = l.find(a => a.tipo === 'PAGAMENTO');
  assert.equal(pg.dataISO, '2026-10-30'); assert.equal(pg.dias, 11); assert.equal(pg.dentroDoAviso, false);
  const home = D.acontecimentosParaHome(l);
  assert.equal(home.itens.length, 3);
  assert.deepEqual(home.itens.map(a => a.titulo), ['ASO vence', 'Voo para Macaé', 'Curso NR-35']);
  assert.ok(home.total > 3, 'Ver todos aparece quando há mais');
  assert.ok(!home.itens.some(a => a.tipo === 'EMBARQUE' || a.tipo === 'DESEMBARQUE'));
  // uma ação principal por item
  assert.equal(l.find(a => a.tipo === 'VIAGEM').acao.label, 'Ir para o aeroporto');
  assert.equal(l.find(a => a.subtipo === 'ANIVERSARIO').acao.tipo, 'presente');
  assert.equal(l.find(a => a.tipo === 'CERTIFICADO').acao.label, 'Ver certificado');
  assert.equal(pg.acao.label, 'Ver regra');
});

test('pagamento entra na Home só dentro do aviso (7 dias); no dia vira "para hoje"; depois passa ao próximo ciclo', () => {
  const cfg = { ...D.CONFIG_PAGAMENTO_PADRAO };
  const em = h => D.acontecimentosParaHome(gerar({ pagamento: cfg, hoje: dia(h) })).itens.find(a => a.tipo === 'PAGAMENTO');
  assert.equal(em('2026-10-22'), undefined);
  assert.equal(em('2026-10-23').quando ?? em('2026-10-23').dias, 7);
  assert.equal(em('2026-10-30').titulo, 'Pagamento previsto para hoje');
  const depois = gerar({ pagamento: cfg, hoje: dia('2026-10-31') }).find(a => a.tipo === 'PAGAMENTO');
  assert.equal(depois.dataISO, '2026-11-30');
  assert.equal(D.acontecimentosParaHome(gerar({ pagamento: { ...cfg, avisoDias: 0 }, hoje: dia('2026-10-29') })).itens.length, 0, 'aviso desligado');
});

test('checklist incompleto aparece mesmo com o card do Meu Embarque oculto (só depende dos dados)', () => {
  const esc = { tipo: '14x14', dataRef: '2026-10-21', tipoRef: 'embarquei' };
  const l = gerar({ escala: esc, checklist: { ciclo: '2026-10-21', items: [{ id: 'a', t: 'A', cat: 'documentos', ok: false }, { id: 'b', t: 'B', cat: 'documentos', ok: false }] } });
  const ck = l.find(a => a.tipo === 'CHECKLIST');
  assert.equal(ck.titulo, 'Faltam 2 itens para o embarque');
  assert.equal(ck.dias, 2);
});

// ─── Meu Pagamento ─────────────────────────────────────────────────────────
const P = (o) => ({ ...D.CONFIG_PAGAMENTO_PADRAO, ...o });
const mes = (cfg, a, m) => D.dataPagamentoNoMes(cfg, a, m).iso;

test('regras de dia útil com feriados nacionais (casos conhecidos)', () => {
  assert.equal(mes(P({ regra: 'ULTIMO_UTIL' }), 2026, 10), '2026-10-30');   // 31/10 é sábado
  assert.equal(mes(P({ regra: 'ULTIMO_UTIL' }), 2026, 12), '2026-12-31');
  assert.equal(mes(P({ regra: 'ULTIMO_UTIL' }), 2027, 2), '2027-02-26');    // fevereiro
  assert.equal(mes(P({ regra: 'PRIMEIRO_UTIL' }), 2026, 11), '2026-11-03'); // 01 dom, 02 Finados
  assert.equal(mes(P({ regra: 'PRIMEIRO_UTIL', considerarFeriados: false }), 2026, 11), '2026-11-02');
  assert.equal(mes(P({ regra: 'PRIMEIRO_UTIL' }), 2027, 1), '2027-01-04');  // dez/jan: 01/01 feriado
  assert.equal(mes(P({ regra: 'QUINTO_UTIL' }), 2026, 11), '2026-11-09');
  assert.equal(mes(P({ regra: 'QUINTO_UTIL', considerarFeriados: false }), 2026, 11), '2026-11-06');
  assert.equal(mes(P({ regra: 'NESIMO_UTIL', nUtil: 3 }), 2026, 11), '2026-11-05');
  assert.equal(mes(P({ regra: 'PRIMEIRO_UTIL' }), 2026, 4), '2026-04-01');
});

test('dia fixo: sábado, domingo, feriado, antecipar/postergar/sem ajuste, fevereiro e bissexto', () => {
  const fixo = (dia, ajuste, extra = {}) => P({ regra: 'DIA_FIXO', dia, ajuste, ...extra });
  assert.equal(mes(fixo(15, 'ANTECIPAR'), 2026, 11), '2026-11-13');   // domingo → sexta
  assert.equal(mes(fixo(15, 'POSTERGAR'), 2026, 11), '2026-11-16');   // domingo → segunda
  assert.equal(mes(fixo(15, 'SEM_AJUSTE'), 2026, 11), '2026-11-15');
  assert.equal(mes(fixo(31, 'ANTECIPAR'), 2026, 10), '2026-10-30');   // sábado
  assert.equal(mes(fixo(20, 'ANTECIPAR'), 2026, 11), '2026-11-19');   // Consciência Negra
  assert.equal(mes(fixo(20, 'POSTERGAR'), 2026, 11), '2026-11-23');
  assert.equal(mes(fixo(20, 'ANTECIPAR', { considerarFeriados: false }), 2026, 11), '2026-11-20'); // sem calendário de feriado
  assert.equal(mes(fixo(3, 'ANTECIPAR'), 2026, 4), '2026-04-02');     // Sexta-feira Santa
  assert.equal(mes(fixo(17, 'ANTECIPAR'), 2026, 2), '2026-02-17');    // Carnaval NÃO é feriado nacional
  assert.equal(mes(fixo(31, 'ANTECIPAR'), 2026, 2), '2026-02-27');    // 28/02/2026 é sábado
  assert.equal(mes(fixo(30, 'SEM_AJUSTE'), 2028, 2), '2028-02-29');   // bissexto
  const r = D.dataPagamentoNoMes(fixo(15, 'ANTECIPAR'), 2026, 11);
  assert.deepEqual([r.ajustado, r.nominal, r.motivoAjuste], [true, '2026-11-15', 'fim_de_semana']);
});

test('próximo pagamento: mês seguinte, antecipação para o mês anterior e mudança de regra', () => {
  assert.deepEqual(D.proximosPagamentos(P({ regra: 'ULTIMO_UTIL' }), '2026-10-31', 2).map(p => p.iso), ['2026-11-30', '2026-12-31']);
  // dia 1 de novembro cai no domingo e antecipa para 30/10
  assert.equal(D.proximoPagamento(P({ regra: 'DIA_FIXO', dia: 1, ajuste: 'ANTECIPAR' }), '2026-10-19').iso, '2026-10-30');
  assert.equal(D.proximoPagamento(P({ regra: 'QUINTO_UTIL' }), '2026-10-19').iso, '2026-11-09');
  assert.match(D.descreverRegra(P({ regra: 'ULTIMO_UTIL' })), /Último dia útil do mês · feriados nacionais considerados/);
  assert.equal(D.normalizarConfigPagamento({ regra: 'XYZ' }), null);
  assert.equal(D.normalizarConfigPagamento({ regra: 'DIA_FIXO', dia: 40 }).dia, 31);
  assert.equal(D.normalizarConfigPagamento({ regra: 'ULTIMO_UTIL' }).avisoDias, 7);
  assert.equal(D.feriadosNacionaisISO(2026).size, 10);
});

// ─── Presentes ─────────────────────────────────────────────────────────────
test('ideias de presente: filtros determinísticos e à distância primeiro quando embarcado', () => {
  const ate50 = D.ideiasDePresente({ faixa: 'ATE_50' });
  assert.ok(ate50.length >= 4 && ate50.every(i => i.faixas.includes('ATE_50')));
  assert.ok(D.ideiasDePresente({ categoria: 'FLORES' }).every(i => i.categoria === 'FLORES'));
  assert.equal(D.ideiasDePresente({ embarcadoNaData: true })[0].aDistancia, true);
  assert.deepEqual(D.ideiasDePresente({}).map(i => i.id), D.ideiasDePresente({}).map(i => i.id));
});

// ─── Saudações ─────────────────────────────────────────────────────────────
test('saudação: manhã/tarde/noite, com e sem nome, 4 estilos', () => {
  assert.equal(D.saudacaoTopo(dia('2026-10-19', 8), 'PARCEIRO', 'Oliver'), 'Bom dia, Oliver!');
  assert.equal(D.saudacaoTopo(dia('2026-10-19', 14), 'DISCRETO', 'Oliver'), 'Boa tarde, Oliver.');
  assert.equal(D.saudacaoTopo(dia('2026-10-19', 21), 'DIRETO', ''), 'Boa noite.');
  assert.equal(D.saudacaoTopo(dia('2026-10-19', 3), 'MOTIVACIONAL', null), 'Boa noite, Buddy!');
  for (const e of D.ESTILOS_SAUDACAO) assert.ok(D.fraseDoDia(dia('2026-10-19', 9), e).length > 3);
});

test('saudação: vocativo do dia (irmão, parça, brother…), feminino sem "amiga", direto/discreto sem vocativo', () => {
  const dias = Array.from({ length: 30 }, (_, i) => dia(`2026-11-${String(i + 1).padStart(2, '0')}`, 8));
  const masc = new Set(dias.map(d => D.saudacaoTopo(d, 'PARCEIRO', null, 'parceiro')));
  assert.ok(masc.size >= 8, 'pouca variedade: ' + [...masc].join(' | '));
  for (const v of ['irmão', 'parça', 'brother', 'bro', 'Buddy']) assert.ok([...masc].some(t => t === `Bom dia, ${v}!`), v);
  const fem = dias.map(d => D.saudacaoTopo(d, 'PARCEIRO', null, 'parceira'));
  assert.ok(fem.every(t => !/amig/i.test(t)), 'feminino nunca usa amiga');
  assert.ok(fem.some(t => t === 'Bom dia, parceira!') && fem.some(t => t === 'Bom dia, guerreira!'));
  assert.ok(D.VOCATIVOS.parceira.length < D.VOCATIVOS.parceiro.length, 'feminino mais limitado');
  assert.ok(Object.values(D.VOCATIVOS).flat().every(v => !/amig/i.test(v)));
  // com nome: nome na maioria dos dias, vocativo às vezes
  const comNome = dias.map(d => D.saudacaoTopo(d, 'PARCEIRO', 'Oliver', 'parceiro'));
  const nNome = comNome.filter(t => t.includes('Oliver')).length;
  assert.ok(nNome >= 18 && nNome < 30, 'nome em ~2/3 dos dias: ' + nNome);
  // sem tratamento + nome: sempre o nome
  assert.ok(dias.every(d => D.saudacaoTopo(d, 'PARCEIRO', 'Ana', 'neutro') === 'Bom dia, Ana!'));
  // direto/discreto não brincam
  assert.equal(D.saudacaoTopo(dias[0], 'DIRETO', null, 'parceiro'), 'Bom dia.');
  assert.equal(D.saudacaoTopo(dias[0], 'DISCRETO', 'Ana', 'parceira'), 'Bom dia, Ana.');
  // estável no mesmo dia
  assert.equal(D.saudacaoTopo(dia('2026-11-03', 6), 'PARCEIRO', null, 'parceiro').split(', ')[1], D.saudacaoTopo(dia('2026-11-03', 23), 'PARCEIRO', null, 'parceiro').split(', ')[1]);
});

test('frase do dia: biblioteca >= 60, curta, muda todo dia e não repete em dias seguidos', () => {
  const todas = Object.values(D.FRASES).flat();
  assert.ok(todas.length >= 60, `só ${todas.length}`);
  assert.ok(todas.every(f => f.t.length <= 60), 'frase longa demais');
  for (const e of D.ESTILOS_SAUDACAO) for (const h of [8, 14, 21]) {
    let anterior = null; const vistas = new Set();
    for (let i = 0; i < 400; i++) {
      const d = new Date(2026, 0, 1 + i, h);
      const f = D.fraseDoDia(d, e);
      assert.notEqual(f, anterior, `${e} repetiu em dias seguidos`);
      anterior = f; if (i < 18) vistas.add(f);
    }
    assert.equal(vistas.size, 18, `${e}/${h}: repetição recente`);
  }
  // estável ao longo do dia (mesmo período)
  assert.equal(D.fraseDoDia(dia('2026-10-19', 13), 'DIRETO'), D.fraseDoDia(dia('2026-10-19', 17), 'DIRETO'));
});

// ─── Home personalizável ───────────────────────────────────────────────────
test('prefs da Home: padrão, ocultar/mostrar, reordenar, tamanhos, protegidos', () => {
  const p0 = D.normalizarPrefsHome(null);
  assert.deepEqual(D.modulosVisiveis(p0), D.ORDEM_PADRAO);
  let p = D.alternarVisibilidade(p0, 'embarque');
  assert.ok(!D.modulosVisiveis(p).includes('embarque'));
  p = D.alternarVisibilidade(p, 'embarque');
  assert.ok(D.modulosVisiveis(p).includes('embarque'));
  assert.equal(D.alternarVisibilidade(p0, 'momento'), p0, 'momento não se oculta');
  p = D.moverModulo(p0, p0.ordem.indexOf('proximos'), 0);
  assert.equal(p.ordem[0], 'proximos');
  assert.equal(p.preset, null);
  p = D.definirTamanho(p, 'vagas', 'DESTAQUE');
  assert.equal(D.tamanhoDe(p, 'vagas'), 'DESTAQUE');
  assert.equal(D.definirTamanho(p, 'aeroportos', 'DESTAQUE'), p, 'tamanho fora dos presets é ignorado');
  const r = D.restaurarLayoutPadrao({ ...p, estiloSaudacao: 'DIRETO', fraseDoDia: false, clima: false });
  assert.deepEqual(r.ordem, D.ORDEM_PADRAO); assert.deepEqual(r.ocultos, []); assert.deepEqual(r.tamanhos, {});
  assert.deepEqual([r.estiloSaudacao, r.fraseDoDia, r.clima], ['DIRETO', false, false], 'restaurar não mexe na saudação/clima');
});

test('presets: ponto de partida editável', () => {
  const base = D.normalizarPrefsHome(null);
  const rot = D.aplicarPreset(base, 'ROTINA');
  assert.deepEqual(D.modulosVisiveis(rot), ['momento', 'proximos', 'embarque', 'viagem', 'certs', 'escala']);
  const car = D.aplicarPreset(base, 'CARREIRA');
  assert.deepEqual(D.modulosVisiveis(car), ['momento', 'proximos', 'vagas', 'certs', 'unidades', 'noticias']);
  assert.equal(D.tamanhoDe(car, 'vagas'), 'DESTAQUE');
  const min = D.aplicarPreset(car, 'MINIMALISTA');
  assert.equal(D.tamanhoDe(min, 'proximos'), 'COMPACTO');
  assert.equal(D.tamanhoDe(min, 'vagas'), 'COMPACTO');
  const editado = D.alternarVisibilidade(min, 'aeroportos');
  assert.ok(D.modulosVisiveis(editado).includes('aeroportos'));
  assert.equal(editado.preset, null);
});

test('migração: dado antigo/estranho nunca reseta nem quebra; módulo novo entra no lugar padrão', () => {
  const antigo = { v: 1, ordem: ['vagas', 'momento', 'xpto', 'certs'], ocultos: ['noticias', 'momento', 'xpto'], tamanhos: { vagas: 'DESTAQUE', noticias: 'GIGANTE' }, estiloSaudacao: 'DIRETO' };
  const p = D.normalizarPrefsHome(antigo);
  assert.deepEqual(p.ordem.filter(m => ['vagas', 'momento', 'certs'].includes(m)), ['vagas', 'momento', 'certs'], 'ordem do usuário preservada');
  assert.equal(p.ordem.indexOf('unidades'), p.ordem.indexOf('vagas') + 1, 'módulo ausente entra após o vizinho padrão');
  assert.equal(p.ordem.length, D.ORDEM_PADRAO.length);
  assert.deepEqual(p.ocultos, ['noticias']);
  assert.deepEqual(p.tamanhos, { vagas: 'DESTAQUE' });
  assert.equal(p.estiloSaudacao, 'DIRETO');
  assert.equal(p.fraseDoDia, true); assert.equal(p.clima, true);
  assert.deepEqual(D.normalizarPrefsHome('lixo'), D.normalizarPrefsHome(null));
  assert.ok(D.MODULOS_HOME.every(m => m.plano === 'free'), 'nada pago no 1.0');
});

// ─── Lembretes ─────────────────────────────────────────────────────────────
test('lembretes: datas e pagamento com antecedência padrão, sem dado pessoal, um por evento/dia', () => {
  const prefs = { ...D.PREFS_LEMBRETES_PADRAO, ativo: true };
  const plano = D.planejarLembretes({
    escala: null, checklist: null, certs: [], viagem: null, prefs, agora: dia('2026-10-19', 8),
    eventos: [
      ev('a', 'ANIVERSARIO', '1990-10-31', { pessoa: 'Ana Maria', nome: 'Aniversário da esposa', recorrencia: 'anual', obs: 'segredo' }),
      ev('c', 'CURSO', '2026-10-30', { nome: 'NR-35' }),
      ev('m', 'COMPROMISSO', '2026-10-22', { nome: 'Banco' }),
      ev('off', 'CONSULTA', '2026-10-25', { nome: 'Off', lembrete_dias: [] }),
    ],
    pagamento: { ...D.CONFIG_PAGAMENTO_PADRAO },
  });
  const quando = Object.fromEntries(plano.map(l => [l.id, l.quando]));
  assert.equal(quando['evento-7d-a-2026-10-31'], '2026-10-24T09:00');
  assert.equal(quando['evento-1d-a-2026-10-31'], '2026-10-30T09:00');
  assert.equal(quando['evento-7d-c-2026-10-30'], '2026-10-23T09:00');
  assert.equal(quando['evento-1d-m-2026-10-22'], '2026-10-21T09:00');
  assert.ok(!plano.some(l => l.id.includes('-off-')), 'lembrete desligado no evento');
  assert.equal(quando['pagamento-7d-2026-10-30'], '2026-10-23T09:00');
  const texto = plano.map(l => l.titulo + ' ' + l.corpo).join(' ');
  for (const proibido of ['Ana', 'esposa', 'segredo', 'NR-35', 'Banco']) assert.ok(!texto.includes(proibido), `vazou "${proibido}"`);
  assert.equal(new Set(plano.map(l => l.id)).size, plano.length);
  // categorias desligáveis
  const sem = D.planejarLembretes({ escala: null, checklist: null, certs: [], viagem: null, agora: dia('2026-10-19', 8),
    eventos: [ev('c', 'CURSO', '2026-10-30')], pagamento: { ...D.CONFIG_PAGAMENTO_PADRAO }, prefs: { ...prefs, datas: false, pagamento: false } });
  assert.equal(sem.length, 0);
  // prefs antigas (sem datas/pagamento) continuam valendo: merge com o padrão liga as novas
  assert.equal({ ...D.PREFS_LEMBRETES_PADRAO, ...{ ativo: true, embarque: false } }.datas, true);
});
