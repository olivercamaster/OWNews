import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography, surface, maritime, themed } from '../src/theme';
import { useTema } from '../src/tema';
import { OWBackground } from '../src/components/OWBackground';
import { fetchCatalogoFuncoes, fetchVagas, type Vaga, type VagasResult } from '../src/api';
import { rotuloMinhaFuncao, vagasParaFuncao } from '@owbuddy/domain';
import type { CatalogoFuncoes, MinhaFuncao, VagaMatch } from '@owbuddy/domain';
import { getMinhaFuncao, marcarVagasFuncaoVistas } from '../src/storage';
import { analytics } from '../src/analytics';
import { abrirLinkExterno } from '../src/links';

const OFFSHORE_LABELS: Record<string, string> = {
  OFFSHORE: 'Offshore',
  ONSHORE: 'Onshore',
  HIBRIDO: 'Híbrido',
};

// Linha da lista: cabeçalho de seção, aviso neutro ou vaga (com o motivo do match, quando houver).
type Linha = { k: string; cab: string } | { k: string; vazio: true } | { k: string; vaga: Vaga; match?: VagaMatch };

function VagaCard({ item, match }: { item: Vaga; match?: VagaMatch }) {
  useTema();
  const [pressed, setPressed] = useState(false);
  const handlePress = () => {
    analytics.track('vaga_opened', { vaga_id: item.id });
    abrirLinkExterno(item.application_url);
  };
  const tag = OFFSHORE_LABELS[item.offshore_onshore ?? ''] || null;
  return (
    <Pressable
      style={[styles.card, pressed && styles.cardPressed]}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      onPress={item.application_url ? handlePress : undefined}
      accessibilityRole="button"
      accessibilityLabel={item.titulo}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <Text style={styles.empresa}>{item.empresa}</Text>
          {tag && <View style={styles.tagBadge}><Text style={styles.tagText}>{tag}</Text></View>}
        </View>
        {!!item.application_url && (
          <Ionicons name="open-outline" size={16} color={colors.cyanDim} />
        )}
      </View>
      <Text style={styles.titulo}>{item.titulo}</Text>
      {match ? <Text style={[styles.motivo, match.nivel === 'exata' && styles.motivoForte]}>{match.motivo}</Text> : null}
      {!!item.local && <Text style={styles.local}>{item.local}</Text>}
      <Text style={styles.resumo} numberOfLines={3}>{item.resumo}</Text>
    </Pressable>
  );
}

export default function VagasScreen() {
  useTema();
  const [result, setResult] = useState<VagasResult | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [mf, setMf] = useState<MinhaFuncao | null>(null);
  const [cat, setCat] = useState<CatalogoFuncoes | null>(null);
  const [aba, setAba] = useState<'funcao' | 'todas'>('funcao');

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    const [r, m, c] = await Promise.all([fetchVagas(), getMinhaFuncao(), fetchCatalogoFuncoes().catch(() => null)]);
    setResult(r); setMf(m); setCat(c);
    if (isRefresh) setRefreshing(false);
    analytics.screen('Vagas');
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!result) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.cyan} size="large" />
      </View>
    );
  }

  if (result.status === 'offline_empty') {
    return (
      <View style={styles.center}>
        <Ionicons name="cloud-offline-outline" size={48} color={colors.mutedDim} />
        <Text style={styles.emptyTitle}>Sem conexão</Text>
        <Text style={styles.emptyText}>Nenhuma vaga em cache. Conecte-se para carregar.</Text>
      </View>
    );
  }

  const vagas = result.status === 'ok' || result.status === 'offline_cached' ? result.vagas : [];
  const isOffline = result.status === 'offline_cached';
  // Personalização = prioridade: "Todas" continua sempre a um toque, nada é escondido.
  const pers = mf ? vagasParaFuncao(vagas, mf, cat) : null;
  const mostrandoFuncao = !!pers && aba === 'funcao';
  if (mostrandoFuncao && pers.paraVoce.length) marcarVagasFuncaoVistas(pers.paraVoce.map((x) => x.vaga.id));
  const linhas: Linha[] = mostrandoFuncao
    ? [
        ...(pers.paraVoce.length ? pers.paraVoce.map((x) => ({ k: x.vaga.id, vaga: x.vaga, match: x.match })) : [{ k: 'vazio', vazio: true as const }]),
        ...(pers.naArea.length ? [{ k: 'cab-area', cab: 'TAMBÉM NA SUA ÁREA' }, ...pers.naArea.map((x) => ({ k: 'a-' + x.vaga.id, vaga: x.vaga, match: x.match }))] : []),
      ]
    : vagas.map((v) => ({ k: v.id, vaga: v }));
  const rotulo = rotuloMinhaFuncao(mf, cat);

  return (
    <OWBackground>
    <View style={styles.root}>
      {isOffline && (
        <View style={styles.offlineBanner}>
          <Ionicons name="cloud-offline-outline" size={14} color={colors.amber} />
          <Text style={styles.offlineBannerText}>Modo offline — exibindo cache</Text>
        </View>
      )}
      {pers ? (
        <View style={styles.abas} accessibilityRole="tablist">
          {([['funcao', mf?.situacao === 'quero_embarcar' ? 'Para começar' : 'Para minha função'], ['todas', 'Todas as vagas']] as const).map(([v, t]) => (
            <TouchableOpacity key={v} style={[styles.aba, aba === v && styles.abaAtiva]} onPress={() => { setAba(v); if (v === 'funcao') analytics.track('jobs_role_tab'); }}
              accessibilityRole="tab" accessibilityState={{ selected: aba === v }}>
              <Text style={[styles.abaTexto, aba === v && styles.abaTextoAtivo]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : vagas.length ? (
        <TouchableOpacity style={styles.convite} onPress={() => router.push('/minha-funcao')} accessibilityRole="button">
          <Ionicons name="person-circle-outline" size={18} color={colors.cyanDim} />
          <Text style={styles.conviteTexto}>Informe sua função para ver primeiro as vagas relacionadas</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.mutedDim} />
        </TouchableOpacity>
      ) : null}
      {!vagas.length ? (
        <View style={styles.center}>
          <Ionicons name="briefcase-outline" size={48} color={colors.mutedDim} />
          <Text style={styles.emptyTitle}>Sem vagas abertas</Text>
          <Text style={styles.emptyText}>Nenhuma vaga ativa no momento.</Text>
        </View>
      ) : (
        <FlatList
          data={linhas}
          keyExtractor={l => l.k}
          ListHeaderComponent={mostrandoFuncao && rotulo ? <Text style={styles.contexto}>{rotulo}</Text> : null}
          renderItem={({ item }) => 'cab' in item ? <Text style={styles.cab}>{item.cab}</Text>
            : 'vazio' in item ? (
              <View style={styles.vazioFuncao}>
                <Text style={styles.vazioTexto}>{mf?.situacao === 'quero_embarcar' ? 'Nenhuma vaga de entrada relacionada agora.' : 'Nenhuma vaga relacionada à sua função agora.'}</Text>
                <TouchableOpacity style={styles.verTodas} onPress={() => setAba('todas')} accessibilityRole="button"><Text style={styles.verTodasTexto}>Ver todas as vagas</Text></TouchableOpacity>
              </View>
            )
            : <VagaCard item={item.vaga} match={item.match} />}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor={colors.cyan}
              colors={[colors.cyan]}
            />
          }
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        />
      )}
    </View>
    </OWBackground>
  );
}

const styles = themed(() => StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  list: { padding: spacing.md },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: surface.card,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.amber + '44',
  },
  offlineBannerText: { ...typography.small, color: colors.amber, fontSize: 12 },
  card: {
    backgroundColor: surface.card,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 6,
    borderWidth: 1,
    borderColor: colors.lineSoft,
  },
  cardPressed: { opacity: 0.75 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  empresa: { ...typography.micro, color: colors.cyanDim, fontSize: 11 },
  tagBadge: {
    backgroundColor: colors.cyanFaint,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tagText: { ...typography.micro, color: colors.cyan, fontSize: 10 },
  titulo: { ...typography.h3, fontSize: 15 },
  local: { ...typography.small, color: colors.mutedDim, fontSize: 12 },
  resumo: { ...typography.small, color: colors.muted, fontSize: 13, lineHeight: 18 },
  emptyTitle: { ...typography.h3, color: colors.muted },
  motivo: { fontSize: 12, color: colors.cyanDim, fontWeight: '600' },
  motivoForte: { color: colors.cyan },
  abas: { flexDirection: 'row', gap: 6, paddingHorizontal: spacing.md, paddingTop: spacing.md },
  aba: { flex: 1, minHeight: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.lineSoft, backgroundColor: surface.card, justifyContent: 'center', alignItems: 'center' },
  abaAtiva: { borderColor: colors.cyanDim },
  abaTexto: { fontSize: 14, fontWeight: '600', color: colors.muted },
  abaTextoAtivo: { color: colors.white },
  contexto: { ...typography.micro, color: colors.mutedDim, marginBottom: spacing.sm },
  cab: { ...typography.micro, marginTop: spacing.md, marginBottom: 2 },
  vazioFuncao: { paddingVertical: spacing.lg, alignItems: 'center', gap: spacing.sm },
  vazioTexto: { fontSize: 14, color: colors.muted, textAlign: 'center' },
  verTodas: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md },
  verTodasTexto: { fontSize: 14, fontWeight: '700', color: colors.cyanDim },
  convite: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: spacing.md, marginTop: spacing.md, minHeight: 44, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.lineSoft, backgroundColor: surface.card },
  conviteTexto: { flex: 1, fontSize: 13, color: colors.muted },
  emptyText: { ...typography.small, textAlign: 'center', color: colors.mutedDim },
}));
