import { Linking, ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography, surface } from '../src/theme';
import { analytics } from '../src/analytics';
import { useEffect } from 'react';

const OWNEWS_AEROPORTOS = 'https://ownews.com.br/aeroportos';

export default function AeroportosScreen() {
  useEffect(() => { analytics.screen('Aeroportos'); }, []);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Ionicons name="airplane-outline" size={52} color={colors.cyanDim} />
        <Text style={styles.heroTitle}>Aeroportos &amp; Heliportos</Text>
        <Text style={styles.heroSub}>
          Painéis de voos em aeroportos e heliportos com operações offshore no Brasil.
        </Text>
      </View>

      <View style={styles.infoCard}>
        <Ionicons name="information-circle-outline" size={18} color={colors.cyan} />
        <Text style={styles.infoText}>
          Os painéis de voos ao vivo estão disponíveis no OWNews Web. O app nativo está em desenvolvimento e chegará em breve.
        </Text>
      </View>

      <Pressable
        style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
        onPress={() => {
          analytics.track('aeroportos_web_opened');
          Linking.openURL(OWNEWS_AEROPORTOS);
        }}
        accessibilityRole="button"
        accessibilityLabel="Abrir Aeroportos no OWNews"
      >
        <Ionicons name="globe-outline" size={18} color={colors.navy950} />
        <Text style={styles.ctaText}>Abrir no OWNews</Text>
      </Pressable>

      <View style={styles.airports}>
        <Text style={styles.airportsTitle}>Bases monitoradas</Text>
        {AIRPORTS.map(a => (
          <View key={a.code} style={styles.airportRow}>
            <View style={styles.codeBadge}><Text style={styles.codeText}>{a.code}</Text></View>
            <View style={styles.airportInfo}>
              <Text style={styles.airportName}>{a.name}</Text>
              <Text style={styles.airportCity}>{a.city}</Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const AIRPORTS = [
  { code: 'SBRJ', name: 'Santos Dumont', city: 'Rio de Janeiro, RJ' },
  { code: 'SBGL', name: 'Galeão', city: 'Rio de Janeiro, RJ' },
  { code: 'SBMK', name: 'Montes Claros', city: 'Montes Claros, MG' },
  { code: 'SSMK', name: 'Base Heliporto Macaé', city: 'Macaé, RJ' },
  { code: 'SNMQ', name: 'Heliporto Macaé', city: 'Macaé, RJ' },
  { code: 'SBAR', name: 'Santa Maria', city: 'Aracaju, SE' },
  { code: 'SBSV', name: 'Dep. Luís Eduardo Magalhães', city: 'Salvador, BA' },
  { code: 'SBFZ', name: 'Pinto Martins', city: 'Fortaleza, CE' },
  { code: 'SBOI', name: 'Petrolina', city: 'Petrolina, PE' },
  { code: 'SBMQ', name: 'Alberto Alcolumbre', city: 'Macapá, AP' },
  { code: 'SBLE', name: 'Ilhéus', city: 'Ilhéus, BA' },
];

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: surface.bg },
  content: { padding: spacing.md, gap: spacing.lg },
  hero: { alignItems: 'center', paddingVertical: spacing.lg, gap: spacing.sm },
  heroTitle: { ...typography.h2 },
  heroSub: { ...typography.small, textAlign: 'center', color: colors.muted, maxWidth: 280 },
  infoCard: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.cyanFaint,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.cyan + '33',
  },
  infoText: { ...typography.small, flex: 1, color: colors.muted, lineHeight: 20 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.cyan,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  ctaPressed: { opacity: 0.8 },
  ctaText: { fontSize: 15, fontWeight: '700', color: colors.navy950 },
  airports: { gap: spacing.sm },
  airportsTitle: { ...typography.micro, color: colors.mutedDim, marginBottom: 4 },
  airportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: surface.card,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  codeBadge: {
    backgroundColor: surface.elevated,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 52,
    alignItems: 'center',
  },
  codeText: { fontFamily: 'monospace', fontSize: 12, fontWeight: '700', color: colors.cyan },
  airportInfo: { gap: 2 },
  airportName: { ...typography.h3, fontSize: 14 },
  airportCity: { ...typography.small, color: colors.mutedDim, fontSize: 12 },
});
