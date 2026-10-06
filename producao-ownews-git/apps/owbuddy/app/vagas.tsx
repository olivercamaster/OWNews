import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography, surface, maritime } from '../src/theme';
import { OWBackground } from '../src/components/OWBackground';
import { fetchVagas, type Vaga, type VagasResult } from '../src/api';
import { analytics } from '../src/analytics';

const OFFSHORE_LABELS: Record<string, string> = {
  OFFSHORE: 'Offshore',
  ONSHORE: 'Onshore',
  HIBRIDO: 'Híbrido',
};

function VagaCard({ item }: { item: Vaga }) {
  const [pressed, setPressed] = useState(false);
  const handlePress = () => {
    analytics.track('vaga_opened', { vaga_id: item.id });
    if (item.application_url) Linking.openURL(item.application_url);
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
      {!!item.local && <Text style={styles.local}>{item.local}</Text>}
      <Text style={styles.resumo} numberOfLines={3}>{item.resumo}</Text>
    </Pressable>
  );
}

export default function VagasScreen() {
  const [result, setResult] = useState<VagasResult | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    const r = await fetchVagas();
    setResult(r);
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

  return (
    <OWBackground>
    <View style={styles.root}>
      {isOffline && (
        <View style={styles.offlineBanner}>
          <Ionicons name="cloud-offline-outline" size={14} color={colors.amber} />
          <Text style={styles.offlineBannerText}>Modo offline — exibindo cache</Text>
        </View>
      )}
      {!vagas.length ? (
        <View style={styles.center}>
          <Ionicons name="briefcase-outline" size={48} color={colors.mutedDim} />
          <Text style={styles.emptyTitle}>Sem vagas abertas</Text>
          <Text style={styles.emptyText}>Nenhuma vaga ativa no momento.</Text>
        </View>
      ) : (
        <FlatList
          data={vagas}
          keyExtractor={v => v.id}
          renderItem={({ item }) => <VagaCard item={item} />}
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

const styles = StyleSheet.create({
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
  emptyText: { ...typography.small, textAlign: 'center', color: colors.mutedDim },
});
