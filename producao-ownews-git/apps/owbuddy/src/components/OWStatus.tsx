/**
 * OWStatus — chip de status operacional (EMBARCADO, FOLGA, etc.)
 * Usado na Home e em Minha Escala.
 */
import React from 'react';
import { StyleSheet, Text, View, type ViewStyle, type StyleProp } from 'react-native';
import { colors, radius, spacing } from '../theme';

type StatusType = 'embarcado' | 'folga' | 'atencao' | 'neutro' | 'sucesso' | 'erro';

const STATUS_COLORS: Record<StatusType, { bg: string; text: string; border: string }> = {
  embarcado: { bg: 'rgba(34,197,94,0.12)',  text: colors.green,  border: 'rgba(34,197,94,0.25)' },
  folga:     { bg: 'rgba(245,158,11,0.12)', text: colors.amber,  border: 'rgba(245,158,11,0.25)' },
  atencao:   { bg: 'rgba(255,122,0,0.12)',  text: colors.orange, border: 'rgba(255,122,0,0.25)' },
  neutro:    { bg: 'rgba(111,139,156,0.12)',text: colors.muted,  border: 'rgba(111,139,156,0.2)' },
  sucesso:   { bg: 'rgba(34,197,94,0.12)',  text: colors.green,  border: 'rgba(34,197,94,0.25)' },
  erro:      { bg: 'rgba(239,68,68,0.12)',  text: colors.red,    border: 'rgba(239,68,68,0.25)' },
};

interface OWStatusProps {
  type: StatusType;
  label: string;
  style?: StyleProp<ViewStyle>;
}

export function OWStatus({ type, label, style }: OWStatusProps) {
  const { bg, text, border } = STATUS_COLORS[type];
  return (
    <View style={[styles.chip, { backgroundColor: bg, borderColor: border }, style]}>
      <View style={[styles.dot, { backgroundColor: text }]} />
      <Text style={[styles.label, { color: text }]}>{label}</Text>
    </View>
  );
}

/** Determina o tipo de status a partir do estado da escala */
export function estadoParaStatus(estado: string): StatusType {
  switch (estado) {
    case 'EMBARCADO':    return 'embarcado';
    case 'DE_FOLGA':     return 'folga';
    case 'SEM_ESCALA':   return 'neutro';
    default:             return 'neutro';
  }
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
