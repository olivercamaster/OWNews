import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, maritime, radius, spacing, themed } from './theme';
import { useTema } from './tema';

/**
 * Feedback discreto ("Salvo", "Excluído"): uma faixa curta no rodapé que some
 * sozinha em ~2 s. Sem botão, sem empilhar — a mensagem nova substitui a anterior.
 */
type Ouvinte = (msg: string) => void;
let ouvinte: Ouvinte | null = null;

export function avisar(msg: string): void {
  ouvinte?.(msg);
}

export function OWToastHost() {
  useTema();
  const insets = useSafeAreaInsets();
  const [msg, setMsg] = useState<string | null>(null);
  const op = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    ouvinte = m => {
      setMsg(m);
      if (timer.current) clearTimeout(timer.current);
      Animated.timing(op, { toValue: 1, duration: 140, useNativeDriver: Platform.OS !== 'web' }).start();
      timer.current = setTimeout(() => {
        Animated.timing(op, { toValue: 0, duration: 220, useNativeDriver: Platform.OS !== 'web' }).start(() => setMsg(null));
      }, 2000);
    };
    return () => { ouvinte = null; if (timer.current) clearTimeout(timer.current); };
  }, [op]);

  if (!msg) return null;
  return (
    <View pointerEvents="none" style={[styles.wrap, { bottom: Math.max(insets.bottom, 8) + 92 }]}>
      <Animated.View style={[styles.toast, { opacity: op }]} accessibilityLiveRegion="polite" accessibilityRole="alert">
        <Ionicons name="checkmark-circle" size={16} color={colors.green} />
        <Text style={styles.texto} numberOfLines={2}>{msg}</Text>
      </Animated.View>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', paddingHorizontal: spacing.md },
  toast: {
    flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: 420,
    backgroundColor: maritime.navBg, borderRadius: radius.lg, borderWidth: 1, borderColor: maritime.navBorder,
    paddingHorizontal: spacing.md, paddingVertical: 10,
  },
  texto: { color: colors.white, fontSize: 14, fontWeight: '600', flexShrink: 1 },
}));
