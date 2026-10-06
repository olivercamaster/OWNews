/**
 * OWBackground — camada visual premium do OWBuddy (Design System 2.0, execução refinada).
 *
 * Hierarquia visual (fundo → frente):
 *   1. Gradiente navy profundo → petróleo/naval, com brilho diagonal e sombra de
 *      profundidade na base (dois LinearGradient — sem blur, sem custo de GPU).
 *   2. Carta náutica ultra-suave: 5 curvas batimétricas ORGÂNICAS (formas
 *      irregulares, aninhadas, parcialmente fora da tela). Nenhuma reta, nenhuma
 *      grade, nenhum cruzamento atravessando os cards. Só textura (~3%).
 *   3. Marca-d'água OWBuddy tom sobre tom (tint), grande, quase subliminar (~2,8%).
 *   4. Conteúdo da tela.
 *
 * Tudo em React Native puro + expo-linear-gradient. Compatível com Expo Go SDK 57.
 * Os valores vivem em `maritime` (src/theme.ts) — este componente só os aplica.
 */

import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { maritime } from '../theme';

// Mascote OWBuddy (helmet + óculos + plataforma offshore)
const MASCOT = require('../../assets/splash-icon.png');

interface OWBackgroundProps {
  children: React.ReactNode;
  /** false em telas de loading/transição (evita a marca-d'água "piscar"). */
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
      {/* 1b. Luz diagonal (canto superior esquerdo) — dá volume ao fundo */}
      <LinearGradient
        colors={maritime.glowGradient as unknown as [string, string, ...string[]]}
        locations={maritime.glowLocations as unknown as [number, number, ...number[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.9 }}
        style={StyleSheet.absoluteFill}
      />
      {/* 1c. Profundidade na base — o conteúdo "assenta" sobre a nav */}
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

      {/* 3. Marca-d'água tom sobre tom */}
      {showWatermark && (
        <Image
          source={MASCOT}
          style={styles.watermark}
          resizeMode="contain"
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
      )}

      {/* 4. Conteúdo */}
      {children}
    </View>
  );
}

/**
 * Formas orgânicas: cada curva é uma View só com borda, cantos com raios
 * diferentes (vira um "blob" irregular, não um círculo perfeito) e leve rotação.
 * Aninhadas e afastadas entre si → nunca se cruzam. Parcialmente fora da tela →
 * nunca "fecham" uma figura no meio do conteúdo.
 */
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
  watermark: {
    position: 'absolute',
    width: '115%',
    height: '58%',
    top: '24%',
    left: '-7%',
    opacity: maritime.watermarkOpacity,
    tintColor: maritime.watermarkTint,
    pointerEvents: 'none',
  } as const,
});
