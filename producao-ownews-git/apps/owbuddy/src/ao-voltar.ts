import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

/**
 * Chama `fn` quando o app volta do segundo plano (o foco de tela não dispara nesse caso:
 * quem deixou o Buddy aberto na Home ontem à noite veria as notícias de ontem).
 * Sem polling — o TTL de cada fonte decide se vai à rede.
 */
export function useAoVoltarAoApp(fn: () => void): void {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    let anterior = AppState.currentState;
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active' && anterior !== 'active') ref.current();
      anterior = s;
    });
    return () => sub.remove();
  }, []);
}
