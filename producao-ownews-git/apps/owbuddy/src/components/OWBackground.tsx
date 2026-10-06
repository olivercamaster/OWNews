/**
 * OWBackground — camada visual premium do OWBuddy (Design System 3.0).
 *
 * Hierarquia visual (fundo → frente):
 *   1. Gradiente navy profundo com brilho diagonal e sombra de profundidade.
 *   2. Curvas batimétricas orgânicas — textura sutil (~3%), nunca grade.
 *   3. Mascote OFICIAL OWBuddy como grande marca-d'água tom sobre tom
 *      (assets/buddy-watermark.png: máscara alfa derivada do mascote oficial —
 *      capacete OW + óculos com plataforma + sorriso). Opacidade muito baixa,
 *      nunca compete com cards ou texto. Primeiro se percebe "identidade premium";
 *      só depois "o Buddy está ali".
 *   4. Conteúdo da tela.
 *
 * React Native puro + expo-linear-gradient. Compatível com Expo Go SDK 57.
 * Opacidade e tint vivem em `maritime` (src/theme.ts).
 */

import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { maritime } from '../theme';

const BUDDY = require('../../assets/buddy-watermark.png');

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

      {/* 3. Mascote oficial OWBuddy — marca-d'água tom sobre tom */}
      {showWatermark && (
        <View style={[StyleSheet.absoluteFill, styles.clip]} pointerEvents="none">
          <Image
            source={BUDDY}
            style={styles.buddy}
            resizeMode="contain"
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        </View>
      )}

      {/* 4. Conteúdo */}
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
  // Cabeça do Buddy grande e centrada na metade superior (composição do mockup aprovado):
  // ligeiramente mais larga que a tela, para as bordas do capacete tocarem as laterais.
  buddy: {
    position: 'absolute',
    width: '108%',
    height: '52%',
    top: '10%',
    left: '-4%',
    opacity: maritime.watermarkOpacity,
    tintColor: maritime.watermarkTint,
  } as const,
});
