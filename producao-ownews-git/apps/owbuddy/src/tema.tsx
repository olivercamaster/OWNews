// Tema em tempo de execução: Automático / Escuro / Claro.
// O provider resolve o tema efetivo, aplica os tokens (src/theme.ts) ANTES de renderizar os
// filhos e avisa as telas pelo contexto — a troca é instantânea, sem reiniciar e sem perder
// a tela atual. Em Automático acompanha o celular ao vivo (useColorScheme).
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform, useColorScheme } from 'react-native';
import { aplicarTema, temaAtivo, tone, type TemaEfetivo } from './theme';
import { MODO_APARENCIA_PADRAO, normalizarModoAparencia, resolverTema, type ModoAparencia } from './aparencia';
import { KEYS, getModoAparencia, setModoAparencia } from './storage';

interface TemaCtx {
  /** Escolha do usuário. */
  modo: ModoAparencia;
  /** O que aparece de fato agora. */
  tema: TemaEfetivo;
  /** false até ler a preferência salva (segura o splash no nativo). */
  pronto: boolean;
  setModo: (m: ModoAparencia) => void;
}

const Ctx = createContext<TemaCtx>({ modo: MODO_APARENCIA_PADRAO, tema: 'escuro', pronto: true, setModo: () => {} });

/** Web: o AsyncStorage é o localStorage — ler já no primeiro render evita piscar o tema errado. */
function lerModoSincrono(): ModoAparencia | null {
  if (Platform.OS !== 'web' || typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(KEYS.APARENCIA);
    return normalizarModoAparencia(raw ? JSON.parse(raw) : null);
  } catch {
    return MODO_APARENCIA_PADRAO;
  }
}

/** Web: fundo da página e cor da barra do navegador seguem o tema (sem faixa da cor errada). */
function sincronizarDocumento(tema: TemaEfetivo) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  document.documentElement.style.backgroundColor = tone.bg0;
  document.documentElement.style.colorScheme = tema === 'claro' ? 'light' : 'dark';
  document.documentElement.dataset.tema = tema;
  if (document.body) document.body.style.backgroundColor = tone.bg0;
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', tone.bg1);
}

export function TemaProvider({ children }: { children: ReactNode }) {
  const sistema = useColorScheme();
  const [salvo, setSalvo] = useState<ModoAparencia | null>(lerModoSincrono);

  useEffect(() => {
    if (salvo !== null) return;
    let vivo = true;
    getModoAparencia()
      .then(m => { if (vivo) setSalvo(m); })
      .catch(() => { if (vivo) setSalvo(MODO_APARENCIA_PADRAO); });
    return () => { vivo = false; };
  }, [salvo]);

  const modo = salvo ?? MODO_APARENCIA_PADRAO;
  const tema = resolverTema(modo, sistema === 'light' || sistema === 'dark' ? sistema : null);
  // Antes dos filhos: as folhas `themed()` leem os tokens já no tema certo.
  if (temaAtivo() !== tema) aplicarTema(tema);

  useEffect(() => { sincronizarDocumento(tema); }, [tema]);

  const setModo = useCallback((m: ModoAparencia) => {
    setSalvo(m);
    setModoAparencia(m).catch(() => {});
  }, []);

  const valor = useMemo(() => ({ modo, tema, pronto: salvo !== null, setModo }), [modo, tema, salvo, setModo]);
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

/**
 * Inscreve o componente nas trocas de tema. Toda tela/componente com estilos `themed()`
 * chama isto no topo — é o que faz a tela redesenhar na hora.
 */
export function useTema(): TemaCtx {
  return useContext(Ctx);
}
