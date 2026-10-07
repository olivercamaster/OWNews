import { useEffect, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OWBackground } from '../src/components/OWBackground';
import { colors, spacing, radius, typography, surface } from '../src/theme';
import { fetchUnidades } from '../src/api';
import { analytics } from '../src/analytics';
import type { Unidade } from '../src/api';

const TIPO_CHIPS = [
  { key: '', label: 'Todos' },
  { key: 'fpso', label: 'FPSO' },
  { key: 'navio_sonda', label: 'Navio-Sonda' },
  { key: 'semi', label: 'Semissubmersível' },
  { key: 'psv', label: 'PSV' },
  { key: 'ahts', label: 'AHTS' },
];

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
}

function StatusBadge({ status }: { status: string }) {
  const isAtiva = status === 'ativa_brasil' || status === 'ativa';
  return (
    <View style={[styles.statusBadge, isAtiva ? styles.statusAtiva : styles.statusInativa]}>
      <Text style={[styles.statusText, isAtiva ? styles.statusTextAtiva : styles.statusTextInativa]}>
        {isAtiva ? 'BRASIL' : status.replace(/_/g, ' ').toUpperCase()}
      </Text>
    </View>
  );
}

function UnidadeCard({ item, onPress }: { item: Unidade; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.cardPhoto}>
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={styles.cardImg} resizeMode="cover" />
        ) : (
          <View style={styles.cardImgFallback}>
            <Ionicons name="boat-outline" size={28} color={colors.mutedDim} />
          </View>
        )}
        {item.image_status === 'real' && (
          <View style={styles.photoRealBadge}>
            <Ionicons name="checkmark-circle" size={12} color={colors.cyan} />
          </View>
        )}
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardNome} numberOfLines={2}>{item.nome}</Text>
        {item.codigo_petrobras ? (
          <Text style={styles.cardCodigo}>{item.codigo_petrobras}</Text>
        ) : null}
        <Text style={styles.cardTipo}>{item.tipo_label}</Text>
        {item.owner ? (
          <Text style={styles.cardOwner} numberOfLines={1}>{item.owner}</Text>
        ) : null}
      </View>
      <View style={styles.cardRight}>
        <StatusBadge status={item.status_brasil} />
        <Ionicons name="chevron-forward" size={16} color={colors.mutedDim} style={{ marginTop: 8 }} />
      </View>
    </TouchableOpacity>
  );
}

export default function UnidadesScreen() {
  const insets = useSafeAreaInsets();
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    fetchUnidades().then(result => {
      if (result.status === 'ok' || result.status === 'offline_cached') {
        setUnidades(result.unidades);
      } else {
        setError(true);
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    analytics.screen('unidades');
    load();
  }, [load]);

  const filtered = unidades.filter(u => {
    const tipoOk = !tipoFiltro || u.tipo === tipoFiltro;
    if (!tipoOk) return false;
    if (!query) return true;
    const q = normalize(query);
    return (
      normalize(u.nome).includes(q) ||
      (u.codigo_petrobras ? normalize(u.codigo_petrobras).includes(q) : false) ||
      (u.owner ? normalize(u.owner).includes(q) : false) ||
      normalize(u.tipo_label).includes(q) ||
      (u.campo ? normalize(u.campo).includes(q) : false)
    );
  });

  if (loading) {
    return (
      <OWBackground>
        <View style={[styles.center, { paddingTop: insets.top + spacing.xl }]}>
          <ActivityIndicator color={colors.cyan} size="large" />
          <Text style={styles.loadingText}>Carregando unidades…</Text>
        </View>
      </OWBackground>
    );
  }

  if (error) {
    return (
      <OWBackground>
        <View style={[styles.center, { paddingTop: insets.top + spacing.xl }]}>
          <Ionicons name="cloud-offline-outline" size={48} color={colors.mutedDim} />
          <Text style={styles.errorTitle}>Não foi possível carregar.</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      </OWBackground>
    );
  }

  return (
    <OWBackground>
      <View style={[styles.searchWrap, { paddingTop: spacing.sm }]}>
        <View style={styles.searchRow}>
          <Ionicons name="search" size={16} color={colors.mutedDim} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar unidade, código, empresa…"
            placeholderTextColor={colors.mutedDim}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={colors.mutedDim} />
            </TouchableOpacity>
          )}
        </View>
        <FlatList
          data={TIPO_CHIPS}
          keyExtractor={c => c.key}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
          renderItem={({ item: chip }) => (
            <TouchableOpacity
              style={[styles.chip, tipoFiltro === chip.key && styles.chipActive]}
              onPress={() => setTipoFiltro(chip.key)}
            >
              <Text style={[styles.chipText, tipoFiltro === chip.key && styles.chipTextActive]}>
                {chip.label}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={u => u.slug}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + spacing.xl }]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <Text style={styles.countLabel}>
            {filtered.length} {filtered.length === 1 ? 'unidade' : 'unidades'}
          </Text>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="boat-outline" size={40} color={colors.mutedDim} />
            <Text style={styles.emptyText}>Nenhuma unidade encontrada</Text>
          </View>
        }
        renderItem={({ item }) => (
          <UnidadeCard
            item={item}
            onPress={() => {
              analytics.track('unidade_opened', { slug: item.slug, tipo: item.tipo });
              router.push(`/unidade/${item.slug}`);
            }}
          />
        )}
      />
    </OWBackground>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  loadingText: { ...typography.small, color: colors.mutedDim },
  errorTitle: { ...typography.h3, textAlign: 'center', color: colors.muted },
  retryBtn: { backgroundColor: colors.cyan, borderRadius: radius.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  retryText: { color: colors.navy950, fontWeight: '700' },

  searchWrap: { backgroundColor: colors.navy900, borderBottomWidth: 1, borderBottomColor: colors.line },
  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: surface.card, borderRadius: radius.sm,
    marginHorizontal: spacing.md, marginBottom: spacing.sm,
    paddingHorizontal: spacing.sm, paddingVertical: 6,
    borderWidth: 1, borderColor: colors.line,
  },
  searchIcon: { marginRight: 6 },
  searchInput: { flex: 1, ...typography.body, color: colors.white, padding: 0 },

  chipsRow: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm, gap: spacing.xs },
  chip: {
    borderRadius: 99, borderWidth: 1, borderColor: colors.line,
    paddingHorizontal: 12, paddingVertical: 5,
    backgroundColor: surface.card,
  },
  chipActive: { borderColor: colors.cyan, backgroundColor: colors.cyan + '18' },
  chipText: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  chipTextActive: { color: colors.cyan },

  list: { padding: spacing.md, gap: spacing.sm },
  countLabel: { ...typography.micro, marginBottom: spacing.xs },

  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: surface.card, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.line,
    overflow: 'hidden',
  },
  cardPhoto: { width: 80, height: 80, position: 'relative' },
  cardImg: { width: '100%', height: '100%' },
  cardImgFallback: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.navy800 },
  photoRealBadge: {
    position: 'absolute', bottom: 4, right: 4,
    backgroundColor: colors.navy900 + 'cc', borderRadius: 99, padding: 2,
  },
  cardBody: { flex: 1, padding: spacing.sm, gap: 3 },
  cardNome: { fontSize: 14, fontWeight: '700', color: colors.white, lineHeight: 18 },
  cardCodigo: { fontSize: 11, fontWeight: '700', color: colors.cyan, letterSpacing: 0.5 },
  cardTipo: { fontSize: 11, color: colors.muted },
  cardOwner: { fontSize: 11, color: colors.mutedDim },
  cardRight: { paddingRight: spacing.sm, alignItems: 'flex-end', paddingVertical: spacing.sm },

  statusBadge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  statusAtiva: { backgroundColor: colors.cyan + '20', borderWidth: 1, borderColor: colors.cyan + '55' },
  statusInativa: { backgroundColor: colors.mutedDim + '20', borderWidth: 1, borderColor: colors.mutedDim + '44' },
  statusText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  statusTextAtiva: { color: colors.cyan },
  statusTextInativa: { color: colors.mutedDim },

  empty: { alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.md },
  emptyText: { ...typography.small, color: colors.mutedDim },
});
