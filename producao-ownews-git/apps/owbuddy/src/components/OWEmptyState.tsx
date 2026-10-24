/**
 * OWEmptyState — estado vazio padronizado para todas as telas.
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography, themed, maritime } from '../theme';
import { useTema } from '../tema';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

interface OWEmptyStateProps {
  icon: IoniconsName;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function OWEmptyState({ icon, title, description, actionLabel, onAction }: OWEmptyStateProps) {
  useTema();
  return (
    <View style={styles.wrap}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={36} color={colors.cyanDim} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.desc}>{description}</Text> : null}
      {actionLabel && onAction ? (
        <TouchableOpacity style={styles.btn} onPress={onAction} accessibilityRole="button">
          <Text style={styles.btnText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    // Pastilha com o acento do app (antes: cinza + ícone cinza parecia "placeholder").
    backgroundColor: colors.cyanFaint,
    borderWidth: 1,
    borderColor: maritime.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  title: { ...typography.h3, textAlign: 'center' },
  desc: { ...typography.small, textAlign: 'center', lineHeight: 20, maxWidth: 280 },
  btn: {
    marginTop: spacing.sm,
    backgroundColor: colors.cyan,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  btnText: { color: colors.onAccent, fontWeight: '700', fontSize: 15 },
}));
