import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { getAeroporto } from '@owbuddy/domain';
import { getEscala } from '../src/storage';
import { bottomNavSpace, colors, maritime, spacing, radius, typography, surface, themed } from '../src/theme';
import { useTema } from '../src/tema';
import { OWBackground } from '../src/components/OWBackground';
import { analytics } from '../src/analytics';
import { buscarJson } from '../src/net';

const API_URL = 'https://ownews.com.br/api/buddy/aeroportos';
const OWNEWS_AEROPORTOS = 'https://ownews.com.br/aeroportos';
const CACHE_TTL_MS = 60_000; // 1 min — mesmo frescor do proxy
const CACHE_KEY = 'owbuddy_cache_aeroportos_v1';

type AeroportoVivo = {
  codigo: string;
  nome: string;
  cidade: string;
  uf: string;
  status: 'g' | 'y' | 'r' | null;
  temperatura: number | null;
  icone: string | null;
  tempo: string | null;
  /** "HH:MM UTC" da observação (REDEMET/METAR) — sem data. */
  horarioUTC: string | null;
};

type ApiResult = {
  aeroportos: AeroportoVivo[];
  fetched_at: string;
};

type Carga = { data: ApiResult; salvoEm: number; offline: boolean };

/** Rede → cache persistente; sem rede → último dado salvo, marcado como antigo. */
async function carregarAeroportos(): Promise<Carga | null> {
  let salvo: { data: ApiResult; salvoEm: number } | null = null;
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    salvo = raw ? JSON.parse(raw) : null;
  } catch {}
  if (salvo && Date.now() - salvo.salvoEm < CACHE_TTL_MS) return { ...salvo, offline: false };
  const r = await buscarJson<ApiResult>(API_URL, 10_000);
  if (r.ok && Array.isArray(r.data?.aeroportos) && r.data.aeroportos.length > 0) {
    const novo = { data: r.data, salvoEm: Date.now() };
    AsyncStorage.setItem(CACHE_KEY, JSON.stringify(novo)).catch(() => {});
    return { ...novo, offline: false };
  }
  return salvo ? { ...salvo, offline: true } : null;
}

/** "17:00 UTC" → "14:00" em Brasília (UTC−3, sem horário de verão desde 2019). */
function horaObservacaoBrasilia(horarioUTC: string | null): string | null {
  const m = horarioUTC ? /(\d{1,2}):(\d{2})/.exec(horarioUTC) : null;
  if (!m) return null;
  const h = (Number(m[1]) + 21) % 24;
  return `${String(h).padStart(2, '0')}:${m[2]}`;
}

function horaCurta(ms: number): string {
  const d = new Date(ms);
  const hoje = new Date().toDateString() === d.toDateString();
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return hoje ? hora : `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${hora}`;
}

function statusInfo(status: string | null): { label: string; color: string } {
  if (status === 'g') return { label: 'Normal', color: colors.green };
  if (status === 'y') return { label: 'Atenção', color: colors.orange };
  if (status === 'r') return { label: 'Restrição', color: colors.red };
  return { label: 'Sem dados', color: colors.mutedDim };
}

export default function AeroportosScreen() {
  useTema();
  const [carga, setCarga] = useState<Carga | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(false);
  const [meuCodigo, setMeuCodigo] = useState<string | null>(null);

  const load = useCallback(async () => {
    const escala = await getEscala();
    setMeuCodigo(escala?.aeroporto ?? null);
    const c = await carregarAeroportos();
    setCarga(c);
    setErro(!c);
    setLoading(false);
  }, []);

  useEffect(() => { analytics.screen('Aeroportos'); }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const result = carga?.data ?? null;
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
          <Text style={styles.erroText}>Sem conexão. As condições dos aeroportos precisam de internet.</Text>
          <TouchableOpacity onPress={() => { setLoading(true); load(); }} hitSlop={10}>
            <Text style={styles.retryLink}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      )}

      {carga?.offline && (
        <View style={styles.erroCard}>
          <Ionicons name="cloud-offline-outline" size={18} color={colors.amber} />
          <Text style={styles.erroText}>Sem conexão · mostrando dados salvos às {horaCurta(carga.salvoEm)}. Podem estar desatualizados.</Text>
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
            Consultado às {horaCurta(carga!.salvoEm)} · horário de cada observação no cartão (Brasília)
          </Text>
        </>
      )}

      <TouchableOpacity
        style={styles.cta}
        onPress={() => {
          analytics.track('aeroportos_web_opened');
          Linking.openURL(OWNEWS_AEROPORTOS).catch(() => {});
        }}
        accessibilityRole="button"
        accessibilityLabel="Abrir Aeroportos no OWNews"
      >
        <Ionicons name="globe-outline" size={18} color={colors.onAccent} />
        <Text style={styles.ctaText}>Ver painel completo no OWNews</Text>
      </TouchableOpacity>
    </ScrollView>
    </OWBackground>
  );
}

function AeroCard({ aero, destaque = false }: { aero: AeroportoVivo; destaque?: boolean }) {
  useTema();
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
          {horaObservacaoBrasilia(aero.horarioUTC) ? (
            <Text style={styles.climaHora}>Obs. {horaObservacaoBrasilia(aero.horarioUTC)}</Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
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
  ctaText: { fontSize: 15, fontWeight: '700', color: colors.onAccent },
}));
