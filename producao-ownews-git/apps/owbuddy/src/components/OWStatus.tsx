/**
 * OWStatus — chip de status operacional (EMBARCADO, FOLGA, etc.)
 * Usado na Home e em Minha Escala.
 */
import React from 'react';
import { StyleSheet, Text, View, type ViewStyle, type StyleProp } from 'react-native';
import { colors, radius, spacing, themed, tone } from '../theme';
import { useTema } from '../tema';

type StatusType = 'embarcado' | 'folga' | 'atencao' | 'neutro' | 'sucesso' | 'erro';

// Fundo suave + borda com a MESMA cor do texto (hex + alfa) — significado igual nos dois temas.
const STATUS_COLORS: Record<StatusType, { bg: string; text: string; border: string }> = themed(() => {
  const chip = (cor: string) => ({ bg: cor + '1c', text: cor, border: cor + '40' });
  return {
    embarcado: chip(colors.green),
    folga:     chip(colors.amber),
    atencao:   chip(colors.orange),
    neutro:    { bg: tone.iconTile, text: colors.muted, border: tone.border },
    sucesso:   chip(colors.green),
    erro:      chip(colors.red),
  };
});

interface OWStatusProps {
  type: StatusType;
  label: string;
  style?: StyleProp<ViewStyle>;
}

export function OWStatus({ type, label, style }: OWStatusProps) {
  useTema();
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

const styles = themed(() => StyleSheet.create({
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
}));
