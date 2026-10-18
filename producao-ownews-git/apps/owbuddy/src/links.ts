import { Linking } from 'react-native';
import { urlExternaSegura } from './net';

/** Abre no navegador só URL http(s); qualquer outra coisa (intent:, javascript:) é ignorada. */
export function abrirLinkExterno(url: unknown): void {
  const u = urlExternaSegura(url);
  if (u) Linking.openURL(u).catch(() => {});
}
