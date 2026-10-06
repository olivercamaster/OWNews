/**
 * OWBackground — camada visual premium do OWBuddy (Design System 3.0).
 *
 * Hierarquia visual (fundo → frente):
 *   1. Gradiente navy profundo com brilho diagonal e sombra de profundidade.
 *   2. Curvas batimétricas orgânicas — textura sutil (~3%), nunca grade.
 *   3. Sonar náutico (círculos concêntricos) — carta náutica ultra-discreta,
 *      complementar ao mascote (~1.6%).
 *   4. Mascote OWBuddy "A" chevron — watermark tom sobre tom, grande, parcialmente
 *      cortado nas laterais. ~2–3% percebido. "Quando percebe, fica bonito."
 *   5. Conteúdo da tela.
 *
 * Tudo em React Native puro + expo-linear-gradient. Compatível com Expo Go SDK 57.
 * Os valores de opacidade e tint vivem em `maritime` (src/theme.ts).
 */

import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { maritime } from '../theme';

// Mascote OWBuddy: silhueta "A" chevron (monochrome, fundo transparente)
const MASCOT = require('../../assets/android-icon-monochrome.png');
// Carta náutica: círculos concêntricos (sonar), elemento complementar
const NAUTICAL = require('../../assets/splash-icon.png');

interface OWBackgroundProps {
  children: React.ReactNode;
  /** false em telas de loading/transição (evita piscar). */
  showWatermark?: boolean;
}

export function OWBackground({ children, showWatermark = true }: OWBackgroundProps) {
  return (
    <View style={styles.root}>
      {/* 1. Gradiente premium */}
      <LinearGradient
        colors={maritime.bgGradient as unknown as [string, string, ...string[]]}
        locations={maritime.bgLocations as unknown as [number, number, ...number[]]}
        style={StyleSheet.absoluteFill}
      />
      {/* 1b. Brilho diagonal (canto superior esquerdo) */}
      <LinearGradient
        colors={maritime.glowGradient as unknown as [string, string, ...string[]]}
        locations={maritime.glowLocations as unknown as [number, number, ...number[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.9 }}
        style={StyleSheet.absoluteFill}
      />
      {/* 1c. Profundidade na base */}
      <LinearGradient
        colors={maritime.depthGradient as unknown as [string, string, ...string[]]}
        start={{ x: 0.5, y: 0.55 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* 2. Curvas batimétricas orgânicas */}
      <View style={[StyleSheet.absoluteFill, styles.clip]} pointerEvents="none">
        <Bathymetry />
      </View>

      {showWatermark && (
        <>
          {/* 3. Carta náutica: sonar concêntrico — complementar ao mascote */}
          <Image
            source={NAUTICAL}
            style={styles.nautical}
            resizeMode="contain"
            accessibilityElementsHidden
            importantForAccessibility="no"
          />

          {/* 4. Mascote OWBuddy "A" — marca-d'água tom sobre tom, grande, parcialmente cortado */}
          <Image
            source={MASCOT}
            style={styles.mascot}
            resizeMode="contain"
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        </>
      )}

      {/* 5. Conteúdo */}
      {children}
    </View>
  );
}

const CURVES: Array<{
  w: number; h: number; top?: number; bottom?: number; left?: number; right?: number;
  radii: [number, number, number, number]; rotate: string; fade: number;
}> = [
  // Conjunto superior direito (3 curvas aninhadas)
  { w: 560, h: 440, top: -260, right: -240, radii: [300, 220, 260, 180], rotate: '-14deg', fade: 1.0 },
  { w: 440, h: 350, top: -210, right: -190, radii: [240, 170, 210, 150], rotate: '-10deg', fade: 0.85 },
  { w: 330, h: 270, top: -165, right: -150, radii: [180, 130, 160, 110], rotate: '-6deg',  fade: 0.7 },
  // Conjunto inferior esquerdo (2 curvas)
  { w: 520, h: 380, bottom: -230, left: -260, radii: [220, 300, 180, 260], rotate: '12deg', fade: 0.8 },
  { w: 390, h: 290, bottom: -185, left: -205, radii: [170, 230, 140, 200], rotate: '8deg',  fade: 0.6 },
];

function Bathymetry() {
  return (
    <View style={styles.clip}>
      {CURVES.map((c, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            width: c.w,
            height: c.h,
            top: c.top,
            bottom: c.bottom,
            left: c.left,
            right: c.right,
            borderWidth: 1,
            borderColor: maritime.bathymetryColor,
            borderTopLeftRadius: c.radii[0],
            borderTopRightRadius: c.radii[1],
            borderBottomRightRadius: c.radii[2],
            borderBottomLeftRadius: c.radii[3],
            opacity: maritime.bathymetryOpacity * c.fade,
            transform: [{ rotate: c.rotate }],
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#04121d',
  },
  clip: {
    flex: 1,
    overflow: 'hidden',
  },

  // Carta náutica: sonar concêntrico, centrado, tamanho médio, ultra-discreto.
  // Fica "dentro" da abertura do mascote "A", criando composição náutica.
  nautical: {
    position: 'absolute',
    width: '72%',
    height: '38%',
    top: '32%',
    left: '14%',
    opacity: maritime.nauticalOpacity,
    tintColor: maritime.nauticalTint,
    pointerEvents: 'none',
  } as const,

  // Mascote "A" chevron: grande, centrado horizontalmente, braços cortados nas laterais.
  // Pico visível na área central-superior; base se dissolve na parte inferior.
  // A silhueta é percebida nas áreas livres entre os cards.
  mascot: {
    position: 'absolute',
    width: '145%',
    height: '72%',
    top: '18%',
    left: '-22.5%',
    opacity: maritime.watermarkOpacity,
    tintColor: maritime.watermarkTint,
    pointerEvents: 'none',
  } as const,
});
