import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { getAeroporto } from '@owbuddy/domain';
import { getEscala } from '../src/storage';
import { bottomNavSpace, colors, maritime, spacing, radius, typography, surface } from '../src/theme';
import { OWBackground } from '../src/components/OWBackground';
import { analytics } from '../src/analytics';

const API_URL = 'https://ownews.com.br/api/buddy/aeroportos';
const OWNEWS_AEROPORTOS = 'https://ownews.com.br/aeroportos';
const CACHE_TTL_MS = 60_000; // 1 min

type AeroportoVivo = {
  codigo: string;
  nome: string;
  cidade: string;
  uf: string;
  status: 'g' | 'y' | 'r' | null;
  temperatura: number | null;
  icone: string | null;
  tempo: string | null;
  horarioUTC: string | null;
};

type ApiResult = {
  aeroportos: AeroportoVivo[];
  fetched_at: string;
};

let _cache: { data: ApiResult; ts: number } | null = null;

async function fetchAeroportos(): Promise<ApiResult> {
  if (_cache && Date.now() - _cache.ts < CACHE_TTL_MS) return _cache.data;
  const resp = await fetch(API_URL);
  if (!resp.ok) throw new Error('HTTP ' + resp.status);
  const data: ApiResult = await resp.json();
  _cache = { data, ts: Date.now() };
  return data;
}

function statusInfo(status: string | null): { label: string; color: string } {
  if (status === 'g') return { label: 'Normal', color: colors.green };
  if (status === 'y') return { label: 'Atenção', color: colors.orange };
  if (status === 'r') return { label: 'Restrição', color: colors.red };
  return { label: 'Sem dados', color: colors.mutedDim };
}

export default function AeroportosScreen() {
  const [result, setResult] = useState<ApiResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(false);
  const [meuCodigo, setMeuCodigo] = useState<string | null>(null);

  const load = useCallback(async () => {
    const escala = await getEscala();
    setMeuCodigo(escala?.aeroporto ?? null);
    try {
      const data = await fetchAeroportos();
      setResult(data);
      setErro(false);
    } catch {
      setErro(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { analytics.screen('Aeroportos'); }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const meuAero = meuCodigo
    ? result?.aeroportos.find(a => a.codigo === meuCodigo) ?? null
    : null;

  const outros = result?.aeroportos.filter(a => a.codigo !== meuCodigo) ?? [];

  const insets = useSafeAreaInsets();

  return (
    <OWBackground>
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: bottomNavSpace(insets.bottom) }]}>
      <View style={styles.hero}>
        <Ionicons name="airplane-outline" size={52} color={colors.cyanDim} />
        <Text style={styles.heroTitle}>Aeroportos & Heliportos</Text>
        <Text style={styles.heroSub}>
          Condições operacionais em bases offshore do Brasil, via REDEMET.
        </Text>
      </View>

      {loading && <ActivityIndicator color={colors.cyan} style={{ marginVertical: spacing.lg }} />}

      {erro && !loading && (
        <View style={styles.erroCard}>
          <Ionicons name="cloud-offline-outline" size={18} color={colors.mutedDim} />
          <Text style={styles.erroText}>Não foi possível carregar as condições ao vivo.</Text>
          <TouchableOpacity onPress={load}>
            <Text style={styles.retryLink}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Meu aeroporto (destaque) ── */}
      {meuAero && (
        <>
          <Text style={styles.sectionLabel}>MEU AEROPORTO</Text>
          <AeroCard aero={meuAero} destaque />
        </>
      )}

      {/* ── Todos os aeroportos ── */}
      {!loading && result && (
        <>
          <Text style={styles.sectionLabel}>BASES MONITORADAS</Text>
          {outros.map(a => <AeroCard key={a.codigo} aero={a} />)}
          <Text style={styles.atualizacao}>
            Atualizado {result.fetched_at ? new Date(result.fetched_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—'}
          </Text>
        </>
      )}

      <TouchableOpacity
        style={styles.cta}
        onPress={() => {
          analytics.track('aeroportos_web_opened');
          Linking.openURL(OWNEWS_AEROPORTOS);
        }}
        accessibilityRole="button"
        accessibilityLabel="Abrir Aeroportos no OWNews"
      >
        <Ionicons name="globe-outline" size={18} color={colors.navy950} />
        <Text style={styles.ctaText}>Ver painel completo no OWNews</Text>
      </TouchableOpacity>
    </ScrollView>
    </OWBackground>
  );
}

function AeroCard({ aero, destaque = false }: { aero: AeroportoVivo; destaque?: boolean }) {
  const { label, color } = statusInfo(aero.status);
  return (
    <View style={[styles.card, destaque && styles.cardDestaque]}>
      <View style={styles.cardTop}>
        <View style={styles.codeBadge}>
          <Text style={styles.codeText}>{aero.codigo}</Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardNome}>{aero.nome}</Text>
          <Text style={styles.cardCidade}>{aero.cidade}, {aero.uf}</Text>
        </View>
        <View style={styles.statusBadge}>
          <View style={[styles.statusDot, { backgroundColor: color }]} />
          <Text style={[styles.statusLabel, { color }]}>{label}</Text>
        </View>
      </View>
      {(aero.icone || aero.temperatura != null) && (
        <View style={styles.cardClima}>
          {aero.icone ? <Text style={styles.climaIcone}>{aero.icone}</Text> : null}
          {aero.temperatura != null && (
            <Text style={styles.climaTemp}>{aero.temperatura}°C</Text>
          )}
          {aero.tempo ? <Text style={styles.climaTempo}>{aero.tempo}</Text> : null}
          {aero.horarioUTC ? (
            <Text style={styles.climaHora}>Obs. {aero.horarioUTC} UTC</Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: 40 },

  hero: { alignItems: 'center', paddingVertical: spacing.lg, gap: spacing.sm },
  heroTitle: { ...typography.h2 },
  heroSub: { ...typography.small, textAlign: 'center', color: colors.muted, maxWidth: 280 },

  sectionLabel: { ...typography.micro, color: colors.mutedDim, marginTop: spacing.sm },

  card: {
    backgroundColor: maritime.glass,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: maritime.glassBorder,
    gap: spacing.sm,
    ...maritime.cardShadow,
  },
  cardDestaque: {
    borderColor: colors.cyan + '55',
    backgroundColor: maritime.glassElevated,
    borderLeftWidth: 3,
    borderLeftColor: colors.cyan,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  codeBadge: {
    backgroundColor: maritime.glassElevated,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 52,
    alignItems: 'center',
  },
  codeText: { fontFamily: 'monospace', fontSize: 12, fontWeight: '700', color: colors.cyan },
  cardInfo: { flex: 1, gap: 2 },
  cardNome: { ...typography.h3, fontSize: 14 },
  cardCidade: { ...typography.small, color: colors.mutedDim, fontSize: 12 },
  statusBadge: { alignItems: 'flex-end', gap: 4 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusLabel: { fontSize: 11, fontWeight: '600' },

  cardClima: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    flexWrap: 'wrap',
  },
  climaIcone: { fontSize: 18 },
  climaTemp: { fontSize: 15, fontWeight: '700', color: colors.white },
  climaTempo: { flex: 1, ...typography.small, color: colors.muted, fontSize: 12 },
  climaHora: { ...typography.micro, color: colors.mutedDim },

  erroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: surface.card,
    borderRadius: radius.md,
    padding: spacing.md,
    flexWrap: 'wrap',
  },
  erroText: { ...typography.small, color: colors.muted, flex: 1 },
  retryLink: { ...typography.small, color: colors.cyan, fontWeight: '600' },

  atualizacao: { ...typography.micro, color: colors.mutedDim, textAlign: 'center' },

  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.cyan,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  ctaText: { fontSize: 15, fontWeight: '700', color: colors.navy950 },
});
