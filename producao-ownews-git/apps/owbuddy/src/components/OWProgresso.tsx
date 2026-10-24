/**
 * OWProgresso — barra de progresso de instrumentação (Home, Escala, Embarque).
 * Trilho fino em grafite, preenchimento na cor do estado e um marcador preciso na ponta.
 * Só exibe o valor recebido (0–1): nenhuma regra ou cálculo vive aqui.
 */
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { maritime, themed } from '../theme';
import { useTema } from '../tema';

interface OWProgressoProps {
  /** 0 a 1 */
  valor: number;
  cor: string;
  style?: StyleProp<ViewStyle>;
}

export function OWProgresso({ valor, cor, style }: OWProgressoProps) {
  useTema();
  const v = Math.min(1, Math.max(0, Number.isFinite(valor) ? valor : 0));
  const pct = `${Math.round(v * 100)}%` as `${number}%`;
  return (
    <View style={[styles.wrap, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.trilho}>
        <View style={[styles.fill, { width: pct, backgroundColor: cor }]} />
      </View>
      {v > 0 && v < 1 ? (
        <View style={[styles.marcador, { left: pct, backgroundColor: cor, shadowColor: cor }]} />
      ) : null}
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  // Altura do wrap = marcador; o trilho fica centrado nele
  wrap: { height: 9, justifyContent: 'center' },
  trilho: { height: 3, borderRadius: 2, backgroundColor: maritime.progressTrack, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 2 },
  marcador: {
    position: 'absolute', top: 0, width: 9, height: 9, borderRadius: 5, marginLeft: -4.5,
    borderWidth: 2, borderColor: maritime.glassElevated,
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: maritime.progressGlow, shadowRadius: 5, elevation: 0,
  },
}));
