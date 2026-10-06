import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography, surface, screen, maritime } from '../src/theme';
import { OWBackground } from '../src/components/OWBackground';
import { fetchFeed, type Article, type FeedResult } from '../src/api';
import { setArticles } from '../src/articleStore';
import { analytics } from '../src/analytics';

function relativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return 'Agora';
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

function sourceNameFrom(article: Article): string {
  if (article.image_credit) return article.image_credit;
  try { return new URL(article.original_url).hostname.replace('www.', ''); }
  catch { return ''; }
}

function ArticleCard({ item }: { item: Article }) {
  const [pressed, setPressed] = useState(false);
  const handlePress = () => {
    analytics.track('news_opened', { article_id: item.id });
    router.push(`/noticia/${item.id}`);
  };
  const hasBuddy = !!item.buddy_summary;
  const source = sourceNameFrom(item);

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
        {!!source && (
          <Text style={styles.cardSource} numberOfLines={1}>{source}</Text>
        )}
        <Text style={styles.cardTitle} numberOfLines={3}>{item.title}</Text>
        {!!item.summary && (
          <Text style={styles.cardSummary} numberOfLines={2}>{item.summary}</Text>
        )}
        <View style={styles.cardFooter}>
          <Text style={styles.cardMeta}>{relativeTime(item.published_at)}</Text>
          {hasBuddy && (
            <View style={styles.buddyBadge}>
              <Ionicons name="chatbubble-ellipses-outline" size={10} color={colors.cyanDim} />
              <Text style={styles.buddyBadgeText}>Buddy</Text>
            </View>
          )}
        </View>
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
    if (r.status === 'ok' || r.status === 'offline_cached') {
      setArticles(r.articles);
    }
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
    <OWBackground>
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
    flexDirection: 'row',
    backgroundColor: surface.card,
    borderRadius: radius.md,
    overflow: 'hidden',
    gap: spacing.sm,
  },
  cardPressed: { opacity: 0.75 },
  thumb: { width: 90, height: screen.listItemHeight + 20, borderRadius: 0 },
  thumbFallback: { backgroundColor: surface.elevated, alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1, paddingVertical: spacing.sm, paddingRight: spacing.sm, gap: 3 },
  cardSource: { fontSize: 10, fontWeight: '700', color: colors.cyanDim, letterSpacing: 0.4, textTransform: 'uppercase' },
  cardTitle: { ...typography.h3, fontSize: 14, lineHeight: 19 },
  cardSummary: { ...typography.small, fontSize: 12, lineHeight: 17 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  cardMeta: { ...typography.micro, fontSize: 10, color: colors.mutedDim },
  buddyBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: colors.cyan + '18', borderRadius: 99,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  buddyBadgeText: { fontSize: 9, fontWeight: '700', color: colors.cyanDim },

  separator: { height: spacing.sm },
  emptyTitle: { ...typography.h3, color: colors.muted },
  emptyText: { ...typography.small, textAlign: 'center', color: colors.mutedDim },
});
