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
  confirmar(titulo, mensagem, 'Remover', aoConfirmar, true);
}
