import { Linking, Platform } from 'react-native';
import { linksMapa, type LocalMapa } from './onde-estar';
import { analytics } from './analytics';

/** Abre o app de mapas do sistema; se não houver, o mapa no navegador. */
export function abrirNoMapa(local: LocalMapa): void {
  const plat = Platform.OS === 'android' ? 'android' : Platform.OS === 'ios' ? 'ios' : 'web';
  const [principal, reserva] = linksMapa(local, plat);
  analytics.track('trip_map_opened');
  Linking.openURL(principal).catch(() => { Linking.openURL(reserva).catch(() => {}); });
}
