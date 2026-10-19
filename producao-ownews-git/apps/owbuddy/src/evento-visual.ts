import type { Ionicons } from '@expo/vector-icons';
import type { AcontecimentoTipo, EventoTipo } from '@owbuddy/domain';
import { LABEL_EVENTO } from '@owbuddy/domain';
import { colors } from './theme';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

/** Ícone/cor por tipo de evento — único lugar (calendário, cadastro, Home, Próximos). */
export const EVENTO_VISUAL: Record<EventoTipo, { icon: IoniconsName; color: string; label: string }> = {
  ANIVERSARIO:  { icon: 'gift-outline',                       color: '#f48fb1',       label: LABEL_EVENTO.ANIVERSARIO },
  CURSO:        { icon: 'school-outline',                     color: colors.amber,    label: LABEL_EVENTO.CURSO },
  CONSULTA:     { icon: 'medkit-outline',                     color: '#80cbc4',       label: LABEL_EVENTO.CONSULTA },
  COMPROMISSO:  { icon: 'calendar-outline',                   color: colors.orange,   label: LABEL_EVENTO.COMPROMISSO },
  TRABALHO:     { icon: 'briefcase-outline',                  color: colors.cyanDim,  label: LABEL_EVENTO.TRABALHO },
  DOCUMENTO:    { icon: 'id-card-outline',                    color: '#b0bec5',       label: LABEL_EVENTO.DOCUMENTO },
  PESSOAL:      { icon: 'person-outline',                     color: '#ce93d8',       label: LABEL_EVENTO.PESSOAL },
  OUTRO:        { icon: 'ellipsis-horizontal-circle-outline', color: colors.mutedDim, label: LABEL_EVENTO.OUTRO },
  VIAGEM:       { icon: 'airplane-outline',                   color: colors.cyan,     label: LABEL_EVENTO.VIAGEM },
  DATA_ESPECIAL:{ icon: 'star-outline',                       color: '#ce93d8',       label: LABEL_EVENTO.DATA_ESPECIAL },
};

export const ACONTECIMENTO_VISUAL: Record<Exclude<AcontecimentoTipo, 'EVENTO'>, { icon: IoniconsName; color: string }> = {
  EMBARQUE:    { icon: 'boat-outline',          color: colors.green },
  DESEMBARQUE: { icon: 'home-outline',          color: colors.amber },
  VIAGEM:      { icon: 'airplane-outline',      color: colors.cyan },
  CERTIFICADO: { icon: 'document-text-outline', color: colors.amber },
  CHECKLIST:   { icon: 'checkbox-outline',      color: colors.cyan },
  PAGAMENTO:   { icon: 'wallet-outline',        color: '#a5d6a7' },
};

export function visualAcontecimento(tipo: AcontecimentoTipo, subtipo?: EventoTipo): { icon: IoniconsName; color: string } {
  if (tipo === 'EVENTO') return EVENTO_VISUAL[subtipo ?? 'OUTRO'];
  return ACONTECIMENTO_VISUAL[tipo];
}
