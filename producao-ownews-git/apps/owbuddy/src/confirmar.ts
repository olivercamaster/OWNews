import { Alert, Platform } from 'react-native';

/** Confirmação genérica (Alert nativo; no navegador, window.confirm — Alert com botões não existe na web). */
export function confirmar(titulo: string, mensagem: string, rotulo: string, aoConfirmar: () => void, destrutivo = false): void {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    if (typeof window !== 'undefined' && window.confirm(`${titulo}\n${mensagem}`)) aoConfirmar();
    return;
  }
  Alert.alert(titulo, mensagem, [
    { text: 'Cancelar', style: 'cancel' },
    { text: rotulo, style: destrutivo ? 'destructive' : 'default', onPress: aoConfirmar },
  ]);
}

/** Confirmação antes de apagar. */
export function confirmarRemocao(titulo: string, mensagem: string, aoConfirmar: () => void): void {
  confirmar(titulo, mensagem, 'Excluir', aoConfirmar, true);
}

/**
 * Pergunta de duas opções que devolve a escolha (true = confirmou). Para encadear avisos
 * antes de salvar ("Essa data ainda não chegou", "sobrepõe outro registro"...).
 */
export function perguntar(titulo: string, mensagem: string, rotulo: string, rotuloCancelar = 'Cancelar'): Promise<boolean> {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    return Promise.resolve(typeof window !== 'undefined' && window.confirm(`${titulo}\n${mensagem}`));
  }
  return new Promise(resolve => {
    Alert.alert(titulo, mensagem, [
      { text: rotuloCancelar, style: 'cancel', onPress: () => resolve(false) },
      { text: rotulo, onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}
