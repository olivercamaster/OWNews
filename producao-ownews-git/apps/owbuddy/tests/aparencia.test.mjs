/**
 * Aparência — Automático / Escuro / Claro + tokens dos dois temas.
 * Roda com: node --test tests/aparencia.test.mjs
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

register('./_ts-resolver.mjs', import.meta.url);

let A, T;
before(async () => {
  A = await import('../src/aparencia.ts');
  T = await import('../src/theme.ts');
});

const RAIZ = new URL('..', import.meta.url).pathname;
const ler = rel => readFileSync(join(RAIZ, rel), 'utf8');
function arquivos(dir, re = /\.tsx?$/) {
  const out = [];
  const andar = d => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) andar(p); else if (re.test(f)) out.push(p); } };
  andar(join(RAIZ, dir));
  return out;
}

/** Persistência como o app faz: AsyncStorage/localStorage guardam JSON; a leitura normaliza. */
const persistir = modo => A.normalizarModoAparencia(JSON.parse(JSON.stringify(modo)));

// ─── Preferência ─────────────────────────────────────────────────────────────

test('usuário novo (sem valor salvo) → Automático', () => {
  assert.equal(A.MODO_APARENCIA_PADRAO, 'auto');
  assert.equal(A.normalizarModoAparencia(null), 'auto');
  assert.equal(A.normalizarModoAparencia(undefined), 'auto');
});

test('persistência: o que foi escolhido volta igual depois de fechar e abrir', () => {
  for (const m of ['auto', 'escuro', 'claro']) assert.equal(persistir(m), m);
});

test('Automático acompanha o sistema: claro → claro, escuro → escuro', () => {
  assert.equal(A.resolverTema('auto', 'light'), 'claro');
  assert.equal(A.resolverTema('auto', 'dark'), 'escuro');
});

test('mudança do sistema com o app aberto: Automático troca junto', () => {
  const sequencia = ['dark', 'light', 'dark'].map(s => A.resolverTema('auto', s));
  assert.deepEqual(sequencia, ['escuro', 'claro', 'escuro']);
});

test('sistema sem preferência conhecida → escuro (identidade OWBuddy)', () => {
  assert.equal(A.resolverTema('auto', null), 'escuro');
  assert.equal(A.resolverTema('auto', undefined), 'escuro');
});

test('forçar Escuro: fica escuro mesmo com o celular claro', () => {
  assert.equal(A.resolverTema('escuro', 'light'), 'escuro');
  assert.equal(A.resolverTema('escuro', 'dark'), 'escuro');
});

test('forçar Claro: fica claro mesmo com o celular escuro', () => {
  assert.equal(A.resolverTema('claro', 'dark'), 'claro');
  assert.equal(A.resolverTema('claro', 'light'), 'claro');
});

test('voltar para Automático: passa a seguir o sistema de novo', () => {
  let modo = 'claro';
  assert.equal(A.resolverTema(modo, 'dark'), 'claro');
  modo = persistir('auto');
  assert.equal(A.resolverTema(modo, 'dark'), 'escuro');
  assert.equal(A.resolverTema(modo, 'light'), 'claro');
});

test('migração: valores antigos/sinônimos e lixo nunca quebram (lixo → Automático)', () => {
  assert.equal(A.normalizarModoAparencia('dark'), 'escuro');
  assert.equal(A.normalizarModoAparencia('light'), 'claro');
  assert.equal(A.normalizarModoAparencia('system'), 'auto');
  assert.equal(A.normalizarModoAparencia(' Claro '), 'claro');
  assert.equal(A.normalizarModoAparencia({ modo: 'escuro' }), 'escuro');
  for (const lixo of [42, true, '', 'roxo', [], {}, { modo: 7 }]) assert.equal(A.normalizarModoAparencia(lixo), 'auto');
});

test('barra de status: ícones claros no escuro, escuros no claro', () => {
  assert.equal(A.estiloStatusBar('escuro'), 'light');
  assert.equal(A.estiloStatusBar('claro'), 'dark');
  assert.match(ler('app/_layout.tsx'), /<StatusBar style=\{estiloStatusBar\(tema\)\}/);
});

test('opções da tela: Automático, Escuro e Claro com os textos pedidos', () => {
  assert.deepEqual(A.OPCOES_APARENCIA.map(o => [o.titulo, o.sub]), [
    ['Automático', 'Usar a aparência do celular'],
    ['Escuro', 'Visual premium navy'],
    ['Claro', 'Visual premium claro'],
  ]);
  const tela = ler('app/buddy-config.tsx');
  assert.match(tela, />Aparência</);
  assert.match(tela, /OPCOES_APARENCIA\.map/);
  // vale na hora: tocar chama setModo (sem depender do botão Salvar)
  assert.match(tela, /onPress=\{\(\) => \{ setModoAparencia\(o\.modo\)/);
});

// ─── Sem reset de dados ──────────────────────────────────────────────────────

test('aparência numa chave própria: não regrava escala, Cruzar, checklist, Home, Buddy…', () => {
  const storage = ler('src/storage.ts');
  assert.match(storage, /APARENCIA:\s+'owbuddy_aparencia'/);
  const bloco = storage.slice(storage.indexOf('export async function setModoAparencia'));
  assert.match(bloco, /await set\(KEYS\.APARENCIA, modo\)/);
  assert.equal((bloco.match(/await set\(/g) || []).length, 1, 'grava UMA chave');
  // chaves históricas intactas (dados de quem já usa o app)
  for (const [k, v] of [['ESCALA', 'ownews_minha_escala'], ['CERTS', 'ownews_certificados'], ['CHECKLIST', 'ownews_checklist_mala'],
    ['VIAGEM', 'ownews_minha_viagem'], ['BUDDY', 'ownews_buddy_prefs'], ['CITY', 'owbuddy_city_pref'], ['ESCALAS_CRUZAR', 'ownews_cruzar_v2'],
    ['PAGAMENTO', 'owbuddy_pagamento_v1'], ['HOME_PREFS', 'owbuddy_home_prefs'], ['EVENTOS_PESSOAIS', 'owbuddy_eventos_pessoais']]) {
    assert.match(storage, new RegExp(`${k}:\\s+'${v}'`), `${k} continua ${v}`);
  }
  assert.doesNotMatch(ler('src/sync.ts'), /APARENCIA|ModoAparencia/, 'aparência é deste aparelho (fora do sync)');
});

test('web sem piscar: o index.html lê a MESMA chave antes do JS', () => {
  const html = ler('public/index.html');
  assert.match(html, /localStorage\.getItem\('owbuddy_aparencia'\)/);
  assert.match(html, /prefers-color-scheme: light/);
});

// ─── Tokens ──────────────────────────────────────────────────────────────────

const COR = /^(#[0-9a-f]{6}|rgba\(\s*\d{1,3},\s*\d{1,3},\s*\d{1,3},\s*(0|1|0?\.\d+)\s*\))$/i;

test('tokens semânticos completos e válidos nos dois temas', () => {
  const { escuro, claro } = T.TOKENS_POR_TEMA;
  assert.deepEqual(Object.keys(claro).sort(), Object.keys(escuro).sort());
  for (const nome of ['background', 'backgroundSecondary', 'surface', 'surfaceElevated', 'surfacePressed', 'borderSubtle', 'borderStrong',
    'textPrimary', 'textSecondary', 'textMuted', 'textInverse', 'accent', 'accentPressed', 'accentSoft', 'success', 'warning', 'danger', 'info',
    'shadow', 'overlay', 'navigationBackground', 'navigationBorder', 'inputBackground', 'inputBorder', 'inputFocus', 'calendarEmbarcadoBg', 'calendarJuntos']) {
    assert.ok(nome in escuro, `token ${nome}`);
  }
  for (const tema of [escuro, claro]) for (const [k, v] of Object.entries(tema)) assert.match(v, COR, `${k} = ${v}`);
});

test('camadas (tone/colors/surface/maritime/typography/elevation) com as mesmas chaves nos dois temas', () => {
  const e = T.camadasDoTema('escuro'), c = T.camadasDoTema('claro');
  for (const camada of ['tone', 'colors', 'surface', 'maritime', 'typography', 'elevation']) {
    assert.deepEqual(Object.keys(c[camada]).sort(), Object.keys(e[camada]).sort(), camada);
  }
  // mesma tipografia, raios e espaçamentos — só a cor muda
  for (const k of Object.keys(e.typography)) {
    const { color: _a, ...fe } = e.typography[k]; const { color: _b, ...fc } = c.typography[k];
    assert.deepEqual(fc, fe, `typography.${k}`);
  }
  assert.equal(c.maritime.navHeight, e.maritime.navHeight);
});

test('claro NÃO é inversão: superfícies e textos desenhados, não o negativo do escuro', () => {
  const { escuro, claro } = T.TOKENS_POR_TEMA;
  const inverter = h => '#' + h.slice(1).match(/../g).map(x => (255 - parseInt(x, 16)).toString(16).padStart(2, '0')).join('');
  for (const k of ['background', 'surface', 'textPrimary', 'textSecondary', 'accent']) {
    assert.notEqual(claro[k], inverter(escuro[k]), k);
  }
  // o ciano OW continua a mesma família (azul), só mais profundo no claro para ler sobre branco
  const hue = h => { const [r, g, b] = h.slice(1).match(/../g).map(x => parseInt(x, 16) / 255); const mx = Math.max(r, g, b), mn = Math.min(r, g, b); const d = mx - mn; const H = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return (H * 60 + 360) % 360; };
  assert.ok(Math.abs(hue(claro.accent) - hue(escuro.accent)) < 12, 'mesmo matiz de acento');
  // Buddy: opacidade da marca-d'água ajustada por tema (não a mesma nos dois)
  assert.notEqual(T.camadasDoTema('claro').maritime.watermarkTint, T.camadasDoTema('escuro').maritime.watermarkTint);
});

function rgb(c) {
  if (typeof c === "object") return c;
  if (c.startsWith('#')) return { r: parseInt(c.slice(1, 3), 16), g: parseInt(c.slice(3, 5), 16), b: parseInt(c.slice(5, 7), 16), a: 1 };
  const [r, g, b, a] = c.match(/[\d.]+/g).map(Number);
  return { r, g, b, a };
}
function sobre(c, fundo) {
  const x = rgb(c), f = rgb(fundo);
  return { r: x.r * x.a + f.r * (1 - x.a), g: x.g * x.a + f.g * (1 - x.a), b: x.b * x.a + f.b * (1 - x.a), a: 1 };
}
function contraste(a, b) {
  const L = ({ r, g, b }) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const l1 = L(a), l2 = L(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

test('acessibilidade: texto principal, secundário e muted ≥ 4,5:1 no fundo e nas superfícies', () => {
  for (const [nome, t] of Object.entries(T.TOKENS_POR_TEMA)) {
    for (const fundo of ['background', 'surface', 'surfaceElevated', 'inputBackground']) {
      const bg = sobre(t[fundo], t.background);
      for (const texto of ['textPrimary', 'textSecondary', 'textMuted', 'accentText', 'success', 'warning', 'danger']) {
        const r = contraste(sobre(t[texto], bg), bg);
        assert.ok(r >= 4.5, `${nome}: ${texto} sobre ${fundo} = ${r.toFixed(2)}`);
      }
    }
    // botão primário
    assert.ok(contraste(rgb(t.onAccent), rgb(t.accent)) >= 4.5, `${nome}: texto do botão primário`);
    // chip suave (status com fundo *Soft)
    for (const [c, soft] of [['success', 'successSoft'], ['warning', 'warningSoft'], ['danger', 'dangerSoft'], ['accentText', 'accentSoft']]) {
      const bg = sobre(t[soft], sobre(t.surface, t.background));
      assert.ok(contraste(rgb(t[c]), bg) >= 4.5, `${nome}: ${c} sobre ${soft} = ${contraste(rgb(t[c]), bg).toFixed(2)}`);
    }
  }
});

test('calendário legível nos dois temas: número do dia ≥ 4,5:1 sobre a célula de cada estado', () => {
  for (const [nome, t] of Object.entries(T.TOKENS_POR_TEMA)) {
    for (const est of ['Embarcado', 'Folga', 'Dobra', 'Ferias']) {
      const bg = sobre(t[`calendar${est}Bg`], t.background);
      const r = contraste(rgb(t[`calendar${est}Text`]), bg);
      assert.ok(r >= 4.5, `${nome}: ${est} = ${r.toFixed(2)}`);
    }
    assert.ok(contraste(rgb(t.calendarEmbarqueText), sobre(t.calendarEmbarcadoBg, t.background)) >= 4.5, `${nome}: EMB`);
    // "sem escala" é propositalmente apagado, mas ainda distinguível (≥ 2:1, texto decorativo)
    assert.ok(contraste(rgb(t.calendarSemEscalaText), sobre(t.calendarSemEscalaBg, t.background)) >= 2);
  }
});

// ─── Troca em tempo de execução ──────────────────────────────────────────────

test('aplicarTema troca os valores NO LUGAR (mesmas referências) e volta', () => {
  const ref = { colors: T.colors, tone: T.tone, maritime: T.maritime, typography: T.typography };
  T.aplicarTema('claro');
  assert.equal(T.temaAtivo(), 'claro');
  assert.equal(T.colors.white, T.TOKENS_POR_TEMA.claro.textPrimary);
  assert.equal(T.typography.body.color, T.TOKENS_POR_TEMA.claro.textPrimary);
  assert.equal(T.colors, ref.colors); assert.equal(T.tone, ref.tone); assert.equal(T.maritime, ref.maritime); assert.equal(T.typography, ref.typography);
  T.aplicarTema('escuro');
  assert.equal(T.colors.white, T.TOKENS_POR_TEMA.escuro.textPrimary);
});

test('aplicarTema não muta objetos aninhados (StyleSheet congela o que recebe)', () => {
  T.aplicarTema('escuro');
  const corpo = Object.freeze(T.typography.body);
  const sombra = Object.freeze(T.maritime.cardShadow);
  assert.doesNotThrow(() => T.aplicarTema('claro'));
  assert.notEqual(T.typography.body, corpo);
  assert.equal(corpo.color, T.TOKENS_POR_TEMA.escuro.textPrimary, 'objeto antigo intacto');
  assert.notEqual(T.maritime.cardShadow, sombra);
  T.aplicarTema('escuro');
});

test('themed(): uma folha por tema, montada com os tokens do tema ativo', () => {
  let chamadas = 0;
  const estilos = T.themed(() => { chamadas++; return { card: { backgroundColor: T.tokens.surface, color: T.colors.white } }; });
  T.aplicarTema('escuro');
  assert.equal(estilos.card.backgroundColor, T.TOKENS_POR_TEMA.escuro.surface);
  T.aplicarTema('claro');
  assert.equal(estilos.card.backgroundColor, T.TOKENS_POR_TEMA.claro.surface);
  assert.equal(estilos.card.color, T.TOKENS_POR_TEMA.claro.textPrimary);
  T.aplicarTema('escuro');
  assert.equal(estilos.card.backgroundColor, T.TOKENS_POR_TEMA.escuro.surface);
  assert.equal(chamadas, 2, 'cache por tema (troca instantânea, sem recriar)');
  assert.deepEqual(Object.keys(estilos), ['card']);
});

// ─── Telas ───────────────────────────────────────────────────────────────────

test('telas sem cor hardcoded: nenhum hex/rgba fora de src/theme.ts', () => {
  const comCor = [...arquivos('app'), ...arquivos('src')]
    .filter(p => !p.endsWith('src/theme.ts'))
    .filter(p => /#[0-9a-fA-F]{3,8}\b(?![\w-])|rgba?\(/.test(readFileSync(p, 'utf8').replace(/\/\/.*$/gm, '')));
  assert.deepEqual(comCor.map(p => p.slice(RAIZ.length)), []);
});

test('toda tela/componente com estilos por tema se inscreve na troca (useTema)', () => {
  const faltando = [];
  for (const p of [...arquivos('app', /\.tsx$/), ...arquivos('src/components', /\.tsx$/)]) {
    const s = readFileSync(p, 'utf8');
    if (!/themed\(/.test(s)) continue;
    for (const m of s.matchAll(/^(?:export )?(?:default )?function ([A-Z]\w*)\s*\(/gm)) {
      // fim dos parâmetros (podem ter { desestruturação }: { tipos })
      let i = m.index + m[0].length, d = 1;
      while (d > 0 && i < s.length) { if (s[i] === '(') d++; else if (s[i] === ')') d--; i++; }
      const corpo = s.indexOf('{', i);
      const primeira = s.slice(corpo + 1).trimStart().split('\n')[0];
      if (!/useTema\(\)/.test(primeira)) faltando.push(`${p.slice(RAIZ.length)}:${m[1]}`);
    }
  }
  assert.deepEqual(faltando.filter(f => !/_layout\.tsx:RootLayout$/.test(f)), []);
  assert.doesNotMatch([...arquivos('app'), ...arquivos('src')].map(p => readFileSync(p, 'utf8')).join('\n'), /^const \w+ = StyleSheet\.create\(/m,
    'folha de estilo no módulo sem themed() ficaria presa no tema do primeiro carregamento');
});

test('Cruzar Escalas 2.1 nos dois temas: lista, ações e "Juntos" por token', () => {
  const lista = ler('app/escala-cruzar.tsx');
  assert.match(lista, /const styles = themed\(\(\) => StyleSheet\.create/);
  assert.match(lista, /export default function EscalaCruzarScreen\(\) \{\n  useTema\(\);/);
  for (const acao of ['Editar', 'Mostrar', 'Ocultar', 'Excluir']) assert.match(lista, new RegExp(`'${acao}'|label="${acao}"`));
  const form = ler('app/escala-secundaria-form.tsx');
  assert.match(form, /label: 'Cunhado\/a'/);
  assert.match(form, /useTema\(\);/);
  const cal = ler('app/(tabs)/escala.tsx');
  assert.match(cal, /tokens\.calendarJuntos/);
  assert.match(cal, /tokens\.calendarJuntosBorder/);
  for (const t of Object.values(T.TOKENS_POR_TEMA)) assert.ok(contraste(rgb(t.calendarJuntos), rgb(t.background)) >= 3, 'ícone Juntos visível');
});

test('modais e sheets usam o overlay e a superfície do tema (sem "app claro + modal escuro")', () => {
  for (const rel of ['app/(tabs)/escala.tsx', 'app/(tabs)/mala.tsx', 'src/components/TransporteSheet.tsx', 'src/components/OWDatePicker.tsx', 'src/components/OWTimePicker.tsx']) {
    const s = ler(rel);
    assert.match(s, /maritime\.overlay/, `${rel}: overlay do tema`);
  }
  assert.ok(rgb(T.TOKENS_POR_TEMA.claro.overlay).a < rgb(T.TOKENS_POR_TEMA.escuro.overlay).a, 'véu mais leve no claro');
  // navegação (fundo atrás de transições e modais) segue o tema
  assert.match(ler('app/_layout.tsx'), /<ThemeProvider value=\{navTema\}>/);
});
