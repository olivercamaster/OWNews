import type { Ionicons } from '@expo/vector-icons';
import type { TipoAcontecimentoHist } from '@owbuddy/domain';
import { colors, themed, tokens } from './theme';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

/**
 * Ícone/cor por tipo de acontecimento do Meu Histórico — único lugar. Cockpit: ícone neutro
 * por padrão; cor só onde é estado (embarque, desembarque, dobra, transferido/atraso).
 */
export const HIST_VISUAL: Record<TipoAcontecimentoHist, { icon: IoniconsName; color: string }> = themed(() => ({
  HOTEL:       { icon: 'bed-outline',                        color: colors.iconDefault },
  VOO:         { icon: 'airplane-outline',                   color: colors.iconDefault },
  ONIBUS:      { icon: 'bus-outline',                        color: colors.iconDefault },
  VAN:         { icon: 'car-sport-outline',                  color: colors.iconDefault },
  CARRO:       { icon: 'car-outline',                        color: colors.iconDefault },
  TRANSFER:    { icon: 'swap-horizontal-outline',            color: colors.iconDefault },
  HELICOPTERO: { icon: 'navigate-outline',                   color: colors.iconDefault },
  BASE:        { icon: 'business-outline',                   color: colors.iconDefault },
  EMBARQUE:    { icon: 'boat-outline',                       color: colors.green },
  DESEMBARQUE: { icon: 'log-out-outline',                    color: colors.amber },
  CASA:        { icon: 'home-outline',                       color: colors.iconDefault },
  TREINAMENTO: { icon: 'school-outline',                     color: colors.iconDefault },
  DOBRA:       { icon: 'add-circle-outline',                 color: tokens.calendarDobraText },
  TRANSFERIDO: { icon: 'repeat-outline',                     color: colors.amber },
  ATRASO:      { icon: 'time-outline',                       color: colors.amber },
  OUTRO:       { icon: 'ellipsis-horizontal-circle-outline', color: colors.iconDefault },
}));
