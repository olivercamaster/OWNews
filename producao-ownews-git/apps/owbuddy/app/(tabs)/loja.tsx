import { useCallback, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OWBackground } from '../../src/components/OWBackground';
import { bottomNavSpace, colors, maritime, radius, spacing, typography } from '../../src/theme';

const STORE_URL = 'https://www.offshoreworks.com.br';

export default function Loja() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);

  const openStore = useCallback(async () => {
    setLoading(true);
    await WebBrowser.openBrowserAsync(STORE_URL, {
      toolbarColor: '#061c2b',
      controlsColor: '#0de8c8',
      createTask: false,
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
    });
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => {
    openStore();
  }, [openStore]));

  return (
    <OWBackground>
      <View style={[styles.root, { paddingTop: insets.top + spacing.lg, paddingBottom: bottomNavSpace(insets.bottom) }]}>

        <View style={styles.logoRow}>
          <View style={styles.logoBox}>
            <Text style={styles.logoEmoji}>⚓</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.brand}>Offshore Works</Text>
            <Text style={styles.tagline}>Equipamentos para offshore</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Loja oficial</Text>
          <Text style={styles.cardBody}>
            Mochilas, coletes, bolsas e equipamentos pensados para a vida offshore. Entrega para todo o Brasil.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.cta, loading && styles.ctaLoading]}
          onPress={openStore}
          disabled={loading}
          activeOpacity={0.8}
        >
          <Ionicons name="storefront-outline" size={20} color={colors.navy950} />
          <Text style={styles.ctaText}>{loading ? 'Abrindo loja...' : 'Abrir loja'}</Text>
          {!loading && <Ionicons name="arrow-forward" size={16} color={colors.navy950} />}
        </TouchableOpacity>

        <Text style={styles.hint}>A loja abre dentro do app — sem sair.</Text>
      </View>
    </OWBackground>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: spacing.md,
    gap: spacing.lg,
    justifyContent: 'center',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  logoBox: {
    width: 60,
    height: 60,
    borderRadius: radius.lg,
    backgroundColor: maritime.glass,
    borderWidth: 1,
    borderColor: maritime.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoEmoji: { fontSize: 28 },
  brand: { ...typography.h2, fontWeight: '700' },
  tagline: { ...typography.small, marginTop: 2 },
  card: {
    backgroundColor: maritime.glass,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: maritime.glassBorder,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardTitle: { ...typography.h3, fontWeight: '700' },
  cardBody: { ...typography.body, lineHeight: 22, color: colors.muted },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.cyan,
    borderRadius: radius.lg,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.lg,
  },
  ctaLoading: { opacity: 0.6 },
  ctaText: {
    ...typography.body,
    fontWeight: '700',
    color: colors.navy950,
    fontSize: 16,
  },
  hint: {
    ...typography.micro,
    textAlign: 'center',
    color: colors.mutedDim,
  },
});
