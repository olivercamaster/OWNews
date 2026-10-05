/**
 * OWBackground — camada visual premium do OWBuddy.
 *
 * Hierarquia visual (fundo → frente):
 *   1. Gradiente azul-marinho profundo
 *   2. Linhas batimétricas ultra-sutis (decoração náutica)
 *   3. Marca-d'água OWBuddy (tom sobre tom, quase invisível)
 *   4. Conteúdo da tela
 *
 * Tudo em React Native puro — sem native modules extras.
 * Compatível com Expo Go SDK 57.
 */

import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { maritime } from '../theme';

// Imagem do mascote OWBuddy (helmet + óculos + plataforma offshore)
const MASCOT = require('../../assets/splash-icon.png');

interface OWBackgroundProps {
  children: React.ReactNode;
  /** Quando true, mostra a marca-d'água do mascote grande (ex: telas mais vazias) */
  showWatermark?: boolean;
  /** Quando true, remove o padding horizontal padrão (para ScrollViews que gerenciam o próprio padding) */
  noPad?: boolean;
}

export function OWBackground({ children, showWatermark = true }: OWBackgroundProps) {
  return (
    <View style={styles.root}>
      {/* Camada 1: gradiente premium */}
      <LinearGradient
        colors={maritime.bgGradient as unknown as [string, string, ...string[]]}
        locations={maritime.bgLocations as unknown as [number, number, ...number[]]}
        style={StyleSheet.absoluteFill}
      />

      {/* Camada 2: decoração náutica (linhas batimétricas sutis) */}
      <View style={[StyleSheet.absoluteFill, styles.nauticalContainer]} pointerEvents="none">
        <NauticalDecoration />
      </View>

      {/* Camada 3: marca-d'água OWBuddy */}
      {showWatermark && (
        <Image
          source={MASCOT}
          style={styles.watermark}
          resizeMode="contain"
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
      )}

      {/* Camada 4: conteúdo */}
      {children}
    </View>
  );
}

/** Rosa dos ventos + linhas batimétricas em React Native puro */
function NauticalDecoration() {
  return (
    <View style={styles.nautical}>
      {/* Linhas de profundidade — círculos concêntricos descentrados (canto superior direito) */}
      {[320, 280, 240, 200, 160, 120, 80].map((size, i) => (
        <View
          key={i}
          style={[
            styles.depthLine,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              top: -size * 0.35,
              right: -size * 0.35,
              opacity: maritime.nauticalOpacity * (1 - i * 0.08),
            },
          ]}
        />
      ))}

      {/* Linhas horizontais esparsas */}
      {[0.22, 0.42, 0.62, 0.80].map((pos, i) => (
        <View
          key={'h' + i}
          style={[
            styles.horizLine,
            {
              top: `${pos * 100}%` as `${number}%`,
              opacity: maritime.nauticalOpacity * (0.6 + i * 0.1),
            },
          ]}
        />
      ))}

      {/* Rosa dos ventos — canto superior direito, muito sutil */}
      <CompassRose />
    </View>
  );
}

function CompassRose() {
  const size = 90;
  const half = size / 2;
  const arm = half - 4;
  return (
    <View
      style={[
        styles.compassContainer,
        { width: size, height: size },
      ]}
      pointerEvents="none"
    >
      {/* Círculo externo */}
      <View style={[styles.compassCircle, { width: size, height: size, borderRadius: half }]} />
      {/* Braços da rosa (N, S, E, W) */}
      {[0, 90, 180, 270].map(deg => (
        <View
          key={deg}
          style={[
            styles.compassArm,
            {
              width: 1,
              height: arm,
              top: half - arm / 2,
              left: half - 0.5,
              transform: [{ rotate: `${deg}deg` }, { translateY: -arm / 2 + arm / 2 }],
            },
          ]}
        />
      ))}
      {/* Ponto central */}
      <View style={[styles.compassDot, { top: half - 2.5, left: half - 2.5 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#061c2b',
  },
  nauticalContainer: {
    overflow: 'hidden',
  },
  nautical: {
    flex: 1,
  },
  depthLine: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: '#5fc4ee',
  },
  horizLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#12a8ee',
  },
  // Marca-d'água: mascote centrado, grande, quasi-invisível
  watermark: {
    position: 'absolute',
    width: '90%',
    height: '60%',
    top: '15%',
    left: '5%',
    opacity: maritime.watermarkOpacity,
    pointerEvents: 'none',
  } as const,

  compassContainer: {
    position: 'absolute',
    top: 24,
    right: 24,
    opacity: maritime.nauticalOpacity * 1.6,
  },
  compassCircle: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: '#5fc4ee',
  },
  compassArm: {
    position: 'absolute',
    backgroundColor: '#5fc4ee',
  },
  compassDot: {
    position: 'absolute',
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#12a8ee',
  },
});
