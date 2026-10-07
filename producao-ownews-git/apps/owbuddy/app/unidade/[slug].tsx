import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OWBackground } from '../../src/components/OWBackground';
import { colors, spacing, radius, typography, surface } from '../../src/theme';
import { fetchUnidades } from '../../src/api';
import { analytics } from '../../src/analytics';
import type { Unidade } from '../../src/api';

const TIPO_ICON: Record<string, string> = {
  fpso: 'boat',
  drillship: 'construct',
  semissubmersivel: 'layers',
  psv: 'navigate',
  ahts: 'navigate-circle',
  plsv: 'navigate-circle-outline',
  dsv: 'navigate-circle-outline',
};

function MetaRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

export default function UnidadeScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const insets = useSafeAreaInsets();
  const [unidade, setUnidade] = useState<Unidade | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchUnidades().then(result => {
      if (result.status === 'ok' || result.status === 'offline_cached') {
        const found = result.unidades.find(u => u.slug === slug) ?? null;
        setUnidade(found);
        if (!found) setError(true);
        if (found) analytics.track('unidade_opened', { slug: found.slug, tipo: found.tipo });
      } else {
        setError(true);
      }
      setLoading(false);
    });
  }, [slug]);

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.cyan} size="large" />
        <Text style={styles.loadingText}>Carregando ficha…</Text>
      </View>
    );
  }

  if (error || !unidade) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Ionicons name="cloud-offline-outline" size={48} color={colors.mutedDim} />
        <Text style={styles.errorTitle}>Unidade não encontrada.</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => router.back()}>
          <Text style={styles.retryText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const iconName = (TIPO_ICON[unidade.tipo] ?? 'boat') as keyof typeof Ionicons.glyphMap;
  const isAtiva = unidade.status_brasil === 'ativa_brasil' || unidade.status_brasil === 'ativa';

  return (
    <OWBackground>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerLabel} numberOfLines={1}>Radar de Unidades</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView
        style={styles.root}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero photo */}
        {unidade.image_url ? (
          <View style={styles.heroWrap}>
            <Image source={{ uri: unidade.image_url }} style={styles.heroImage} resizeMode="cover" />
            {unidade.image_credit && (
              <Text style={styles.imageCredit}>{unidade.image_credit}</Text>
            )}
          </View>
        ) : (
          <View style={[styles.heroWrap, styles.heroFallback]}>
            <Ionicons name={iconName} size={48} color={colors.mutedDim} />
            <Text style={styles.heroFallbackLabel}>Foto não disponível</Text>
          </View>
        )}

        <View style={styles.body}>
          {/* Nome e tipo */}
          <View style={styles.nameBlock}>
            <Text style={styles.nome}>{unidade.nome}</Text>
            <View style={styles.tipoPill}>
              <Ionicons name={iconName} size={12} color={colors.cyanDim} />
              <Text style={styles.tipoText}>{unidade.tipo_label}</Text>
            </View>
          </View>

          {/* Código Petrobras */}
          {unidade.codigo_petrobras ? (
            <View style={styles.codigoBlock}>
              <Text style={styles.codigoLabel}>IDENTIFICADOR PETROBRAS</Text>
              <Text style={styles.codigoValue}>{unidade.codigo_petrobras}</Text>
              {unidade.codigo_confianca === 'baixa' && (
                <Text style={styles.codigoConfianca}>Associação com confiança baixa</Text>
              )}
            </View>
          ) : null}

          {/* Status */}
          <View style={[styles.statusCard, isAtiva ? styles.statusCardAtiva : styles.statusCardInativa]}>
            <Ionicons
              name={isAtiva ? 'checkmark-circle' : 'ellipse-outline'}
              size={18}
              color={isAtiva ? colors.cyan : colors.mutedDim}
            />
            <View style={{ flex: 1 }}>
              <Text style={[styles.statusTitle, isAtiva ? styles.statusTitleAtiva : styles.statusTitleInativa]}>
                {isAtiva ? 'Operando no Brasil' : unidade.status_brasil.replace(/_/g, ' ')}
              </Text>
              {unidade.campo ? (
                <Text style={styles.statusSub}>Campo: {unidade.campo}</Text>
              ) : null}
            </View>
          </View>

          {/* Ficha */}
          <View style={styles.fichaCard}>
            <Text style={styles.sectionTitle}>Ficha da Unidade</Text>
            <MetaRow label="Empresa operadora" value={unidade.owner} />
            <MetaRow label="Contratante" value={unidade.contratante} />
            <MetaRow label="Campo" value={unidade.campo} />
          </View>

          {/* Sobre */}
          {unidade.sobre ? (
            <View style={styles.sobreCard}>
              <Text style={styles.sectionTitle}>Sobre</Text>
              <Text style={styles.sobreText}>{unidade.sobre}</Text>
            </View>
          ) : null}

          {/* Fleet Intelligence */}
          {unidade.fleet_status_fonte ? (
            <View style={styles.fleetCard}>
              <Text style={styles.sectionTitle}>Fleet Intelligence</Text>
              <MetaRow label="Fonte primária" value={unidade.fleet_status_fonte.nome} />
              <MetaRow label="Documento" value={unidade.fleet_status_fonte.documento} />
              <MetaRow label="Data de referência" value={unidade.fleet_status_fonte.data_ref} />
              <TouchableOpacity
                style={styles.fleetLink}
                onPress={() => {
                  analytics.track('unidade_radar_web_opened', { slug: unidade.slug, origem: 'fleet_status' });
                  Linking.openURL(unidade.fleet_status_fonte!.url);
                }}
              >
                <Text style={styles.fleetLinkText}>Ver relatório oficial</Text>
                <Ionicons name="open-outline" size={13} color={colors.cyanDim} />
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Ver ficha completa no OWNews */}
          <TouchableOpacity
            style={styles.radarLink}
            onPress={() => {
              analytics.track('unidade_radar_web_opened', { slug: unidade.slug, origem: 'ficha' });
              Linking.openURL(unidade.url);
            }}
          >
            <Ionicons name="globe-outline" size={16} color={colors.cyanDim} />
            <Text style={styles.radarLinkText}>Ver ficha completa no OWNews</Text>
            <Ionicons name="open-outline" size={13} color={colors.mutedDim} />
          </TouchableOpacity>

          <Text style={styles.brandingLine}>OWNews · Radar de Unidades · by OffshoreWorks</Text>
        </View>
      </ScrollView>
    </OWBackground>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  loadingText: { ...typography.small, color: colors.mutedDim },
  errorTitle: { ...typography.h3, textAlign: 'center', color: colors.muted },
  retryBtn: { backgroundColor: colors.cyan, borderRadius: radius.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  retryText: { color: colors.navy950, fontWeight: '700' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingBottom: spacing.sm,
    backgroundColor: colors.navy900, borderBottomWidth: 1, borderBottomColor: colors.line,
  },
  headerBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerLabel: { ...typography.label, flex: 1, textAlign: 'center', fontSize: 12 },

  root: { flex: 1 },
  content: {},

  heroWrap: { width: '100%', height: 240, backgroundColor: surface.card, overflow: 'hidden' },
  heroFallback: { alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  heroFallbackLabel: { fontSize: 12, color: colors.mutedDim },
  heroImage: { width: '100%', height: '100%' },
  imageCredit: {
    position: 'absolute', bottom: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    fontSize: 10, color: 'rgba(255,255,255,0.8)',
    paddingHorizontal: 8, paddingVertical: 3,
  },

  body: { padding: spacing.md, gap: spacing.md },

  nameBlock: { gap: 6 },
  nome: { fontSize: 24, fontWeight: '800', color: colors.white, lineHeight: 30, letterSpacing: -0.3 },
  tipoPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
    borderRadius: 99, borderWidth: 1, borderColor: colors.cyan + '44',
    backgroundColor: colors.cyan + '12', paddingHorizontal: 10, paddingVertical: 3,
  },
  tipoText: { fontSize: 11, fontWeight: '700', color: colors.cyanDim, letterSpacing: 0.5 },

  codigoBlock: {
    backgroundColor: surface.card, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.line, padding: spacing.md, gap: 4,
  },
  codigoLabel: { fontSize: 9, fontWeight: '800', color: colors.mutedDim, letterSpacing: 1 },
  codigoValue: { fontSize: 18, fontWeight: '800', color: colors.cyan, letterSpacing: 1 },
  codigoConfianca: { fontSize: 11, color: colors.amber },

  statusCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
    borderRadius: radius.md, borderWidth: 1, padding: spacing.md,
  },
  statusCardAtiva: { backgroundColor: colors.cyan + '0d', borderColor: colors.cyan + '33' },
  statusCardInativa: { backgroundColor: surface.card, borderColor: colors.line },
  statusTitle: { fontSize: 15, fontWeight: '700' },
  statusTitleAtiva: { color: colors.cyan },
  statusTitleInativa: { color: colors.muted },
  statusSub: { fontSize: 12, color: colors.mutedDim, marginTop: 2 },

  fichaCard: {
    backgroundColor: surface.card, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.line, padding: spacing.md, gap: spacing.sm,
  },
  sectionTitle: { fontSize: 11, fontWeight: '800', color: colors.mutedDim, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 2 },
  metaRow: { gap: 2 },
  metaLabel: { fontSize: 10, color: colors.mutedDim, letterSpacing: 0.3 },
  metaValue: { fontSize: 14, color: colors.white, fontWeight: '500' },

  sobreCard: {
    backgroundColor: surface.card, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.line, padding: spacing.md, gap: spacing.sm,
  },
  sobreText: { fontSize: 14, color: colors.muted, lineHeight: 21 },

  fleetCard: {
    backgroundColor: colors.navy900, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.cyan + '33', padding: spacing.md, gap: spacing.sm,
  },
  fleetLink: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    borderRadius: 99, borderWidth: 1, borderColor: colors.line,
    paddingHorizontal: 12, paddingVertical: 6, marginTop: 4,
  },
  fleetLinkText: { fontSize: 13, color: colors.cyanDim, fontWeight: '600' },

  radarLink: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: surface.card, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.line, padding: spacing.md,
  },
  radarLinkText: { flex: 1, fontSize: 14, color: colors.cyanDim, fontWeight: '600' },

  brandingLine: { fontSize: 11, color: colors.mutedDim, textAlign: 'center', marginTop: spacing.sm },
});
