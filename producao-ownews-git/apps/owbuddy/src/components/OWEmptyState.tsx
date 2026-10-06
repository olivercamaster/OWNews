/**
 * OWEmptyState — estado vazio padronizado para todas as telas.
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography } from '../theme';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

interface OWEmptyStateProps {
  icon: IoniconsName;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function OWEmptyState({ icon, title, description, actionLabel, onAction }: OWEmptyStateProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={40} color={colors.mutedDim} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.desc}>{description}</Text> : null}
      {actionLabel && onAction ? (
        <TouchableOpacity style={styles.btn} onPress={onAction}>
          <Text style={styles.btnText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: 'rgba(111,139,156,0.1)',
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
  btnText: { color: colors.navy950, fontWeight: '700', fontSize: 15 },
});
