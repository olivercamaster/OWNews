import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography, surface, screen } from '../src/theme';
import { fetchFeed, type Article, type FeedResult } from '../src/api';
import { analytics } from '../src/analytics';

function relativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return 'Agora';
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

function ArticleCard({ item }: { item: Article }) {
  const [pressed, setPressed] = useState(false);
  const handlePress = () => {
    analytics.track('news_opened', { article_id: item.id });
    Linking.openURL(item.original_url);
  };
  return (
    <Pressable
      style={[styles.card, pressed && styles.cardPressed]}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={item.title}
    >
      {item.image_url ? (
        <Image source={{ uri: item.image_url }} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, styles.thumbFallback]}>
          <Ionicons name="newspaper-outline" size={28} color={colors.mutedDim} />
        </View>
      )}
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={3}>{item.title}</Text>
        {!!item.summary && (
          <Text style={styles.cardSummary} numberOfLines={2}>{item.summary}</Text>
        )}
        <Text style={styles.cardMeta}>{relativeTime(item.published_at)}</Text>
      </View>
    </Pressable>
  );
}

export default function NoticiasScreen() {
  const [result, setResult] = useState<FeedResult | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    const r = await fetchFeed();
    setResult(r);
    if (isRefresh) setRefreshing(false);
    analytics.screen('Noticias');
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
        <Text style={styles.emptyText}>Nenhuma notícia em cache. Conecte-se para carregar.</Text>
      </View>
    );
  }

  const articles = result.status === 'ok' || result.status === 'offline_cached' ? result.articles : [];
  const isOffline = result.status === 'offline_cached';

  return (
    <View style={styles.root}>
      {isOffline && (
        <View style={styles.offlineBanner}>
          <Ionicons name="cloud-offline-outline" size={14} color={colors.amber} />
          <Text style={styles.offlineBannerText}>Modo offline — exibindo cache</Text>
        </View>
      )}
      {!articles.length ? (
        <View style={styles.center}>
          <Ionicons name="newspaper-outline" size={48} color={colors.mutedDim} />
          <Text style={styles.emptyTitle}>Nenhuma notícia</Text>
          <Text style={styles.emptyText}>Tente novamente em instantes.</Text>
        </View>
      ) : (
        <FlatList
          data={articles}
          keyExtractor={a => a.id}
          renderItem={({ item }) => <ArticleCard item={item} />}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor={colors.cyan}
              colors={[colors.cyan]}
            />
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: surface.bg },
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
    flexDirection: 'row',
    backgroundColor: surface.card,
    borderRadius: radius.md,
    overflow: 'hidden',
    gap: spacing.sm,
  },
  cardPressed: { opacity: 0.75 },
  thumb: { width: 90, height: screen.listItemHeight + 20, borderRadius: 0 },
  thumbFallback: { backgroundColor: surface.elevated, alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1, paddingVertical: spacing.sm, paddingRight: spacing.sm, gap: 4 },
  cardTitle: { ...typography.h3, fontSize: 14, lineHeight: 19 },
  cardSummary: { ...typography.small, fontSize: 12, lineHeight: 17 },
  cardMeta: { ...typography.micro, fontSize: 10, color: colors.mutedDim },

  separator: { height: spacing.sm },
  emptyTitle: { ...typography.h3, color: colors.muted },
  emptyText: { ...typography.small, textAlign: 'center', color: colors.mutedDim },
});
