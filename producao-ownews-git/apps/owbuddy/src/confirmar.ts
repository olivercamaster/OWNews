import { Alert, Platform } from 'react-native';

/** Confirmação antes de apagar (Alert nativo; no navegador, window.confirm). */
export function confirmarRemocao(titulo: string, mensagem: string, aoConfirmar: () => void): void {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    if (typeof window !== 'undefined' && window.confirm(`${titulo}\n${mensagem}`)) aoConfirmar();
    return;
  }
  Alert.alert(titulo, mensagem, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Remover', style: 'destructive', onPress: aoConfirmar },
  ]);
}
