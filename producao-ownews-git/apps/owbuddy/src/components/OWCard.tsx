/**
 * OWCard — card glass padrão do OWBuddy.
 * Usa maritime.glass por padrão; pode ser elevated ou custom.
 * LEITURA > EFEITO: superfície quase opaca, borda luminosa fina, elevação discreta.
 */
import React from 'react';
import { StyleSheet, TouchableOpacity, View, type ViewStyle, type StyleProp } from 'react-native';
import { maritime, radius, spacing, themed } from '../theme';
import { useTema } from '../tema';

interface OWCardProps {
  children: React.ReactNode;
  elevated?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  /** Cor da borda esquerda de destaque (estado, acento) */
  accentBorder?: string;
  /** Padding interno customizado */
  pad?: number;
}

export function OWCard({ children, elevated, onPress, style, accentBorder, pad }: OWCardProps) {
  useTema();
  const base = elevated ? styles.elevated : styles.base;
  const inner = [base, accentBorder ? { borderLeftWidth: 2, borderLeftColor: accentBorder } : undefined, pad !== undefined ? { padding: pad } : undefined, style];

  if (onPress) {
    return (
      <TouchableOpacity style={inner} onPress={onPress} activeOpacity={0.82}>
        {children}
      </TouchableOpacity>
    );
  }
  return <View style={inner}>{children}</View>;
}

const styles = themed(() => StyleSheet.create({
  base: {
    backgroundColor: maritime.glass,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: maritime.glassBorder,
    ...maritime.cardShadow,
  },
  elevated: {
    backgroundColor: maritime.glassElevated,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: maritime.glassBorder,
    ...maritime.cardShadow,
  },
}));
