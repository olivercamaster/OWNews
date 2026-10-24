import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Platform } from 'react-native';

/**
 * Executa a ação uma vez por vez: o segundo toque enquanto a primeira ainda está
 * gravando é ignorado (sem duplicata). `ocupado` serve para desabilitar o botão.
 */
export function useAcaoUnica<A extends unknown[]>(fn: (...args: A) => Promise<void> | void): [(...args: A) => Promise<void>, boolean] {
  const trava = useRef(false);
  const [ocupado, setOcupado] = useState(false);
  const ref = useRef(fn);
  ref.current = fn;
  const exec = useCallback(async (...args: A) => {
    if (trava.current) return;
    trava.current = true;
    setOcupado(true);
    try { await ref.current(...args); } finally { trava.current = false; setOcupado(false); }
  }, []);
  return [exec, ocupado];
}

/**
 * Botão Voltar do Android fecha o formulário/painel aberto DENTRO da tela (em vez de
 * sair da aba). Só intercepta enquanto `ativo`.
 */
export function useVoltarAndroid(ativo: boolean, aoVoltar: () => void): void {
  const ref = useRef(aoVoltar);
  ref.current = aoVoltar;
  useEffect(() => {
    if (!ativo || Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { ref.current(); return true; });
    return () => sub.remove();
  }, [ativo]);
}
