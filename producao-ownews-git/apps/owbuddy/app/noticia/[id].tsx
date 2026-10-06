import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OWBackground } from '../../src/components/OWBackground';
import { colors, spacing, radius, typography, surface, maritime } from '../../src/theme';
import { getArticle } from '../../src/articleStore';
import { fetchFeed } from '../../src/api';
import { setArticles } from '../../src/articleStore';
import { analytics } from '../../src/analytics';
import type { Article } from '../../src/api';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function sourceNameFrom(article: Article): string {
  if (article.image_credit) return article.image_credit;
  try {
    return new URL(article.original_url).hostname.replace('www.', '');
  } catch {
    return 'Fonte externa';
  }
}

function BuddyCard({ summary }: { summary: string }) {
  return (
    <View style={styles.buddyCard}>
      <Image
        source={require('../../assets/buddy-watermark.png')}
        style={styles.buddyImg}
        resizeMode="contain"
      />
      <View style={styles.buddyContent}>
        <Text style={styles.buddyTitle}>Buddy te explica</Text>
        <Text style={styles.buddySub}>Não quer ler a matéria toda?{'\n'}O Buddy resume e te explica.</Text>
        <View style={styles.buddyDivider} />
        <Text style={styles.buddyText}>{summary}</Text>
      </View>
    </View>
  );
}

function OffshoreCard({ text }: { text: string }) {
  return (
    <View style={styles.offshoreCard}>
      <View style={styles.offshoreHeaderRow}>
        <Ionicons name="navigate-circle-outline" size={16} color={colors.amber} />
        <Text style={styles.offshoreTitle}>O que isso representa para o offshore?</Text>
      </View>
      <Text style={styles.offshoreText}>{text}</Text>
    </View>
  );
}

export default function NoticiaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [article, setArticle] = useState<Article | null>(() => getArticle(id));
  const [loading, setLoading] = useState(!article);
  const [error, setError] = useState(false);
  const [fromCache, setFromCache] = useState(false);

  useEffect(() => {
    if (article) {
      analytics.track('news_open', { article_id: id });
      return;
    }
    // Se o store estiver vazio (ex: deep link), busca o feed e tenta de novo
    setLoading(true);
    fetchFeed().then(result => {
      if (result.status === 'ok' || result.status === 'offline_cached') {
        setArticles(result.articles);
        setFromCache(result.status === 'offline_cached');
        const found = result.articles.find(a => a.id === id) ?? null;
        setArticle(found);
        if (!found) setError(true);
      } else {
        setError(true);
      }
      setLoading(false);
    });
  }, [id]);

  const handleShare = async () => {
    if (!article) return;
    analytics.track('news_share', { article_id: id });
    await Share.share({
      message: `${article.title}\n\n${article.url}`,
      url: article.url,
      title: article.title,
    });
  };

  const handleOpenSource = () => {
    if (!article) return;
    analytics.track('news_source_open', { article_id: id });
    Linking.openURL(article.original_url);
  };

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.cyan} size="large" />
        <Text style={styles.loadingText}>Carregando…</Text>
      </View>
    );
  }

  if (error || !article) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Ionicons name="cloud-offline-outline" size={48} color={colors.mutedDim} />
        <Text style={styles.errorTitle}>Não foi possível carregar esta notícia.</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => {
          setError(false); setLoading(true);
          fetchFeed().then(result => {
            if (result.status === 'ok' || result.status === 'offline_cached') {
              setArticles(result.articles);
              const found = result.articles.find(a => a.id === id) ?? null;
              setArticle(found);
              if (!found) setError(true);
            } else { setError(true); }
            setLoading(false);
          });
        }}>
          <Text style={styles.retryText}>Tentar novamente</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const sourceName = sourceNameFrom(article);

  return (
    <OWBackground>
      {/* Header custom com back + share */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerLabel} numberOfLines={1}>OWNews</Text>
        <TouchableOpacity style={styles.headerBtn} onPress={handleShare} hitSlop={12}>
          <Ionicons name="share-outline" size={22} color={colors.white} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.root}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Offline badge */}
        {fromCache && (
          <View style={styles.offlineBadge}>
            <Ionicons name="cloud-offline-outline" size={12} color={colors.amber} />
            <Text style={styles.offlineBadgeText}>Conteúdo salvo · você está offline</Text>
          </View>
        )}

        {/* Hero image */}
        {article.image_url ? (
          <View style={styles.heroWrap}>
            <Image
              source={{ uri: article.image_url }}
              style={styles.heroImage}
              resizeMode="cover"
            />
            {article.image_credit && (
              <Text style={styles.imageCredit}>{article.image_credit}</Text>
            )}
          </View>
        ) : (
          <View style={[styles.heroWrap, styles.heroFallback]}>
            <Ionicons name="newspaper-outline" size={40} color={colors.mutedDim} />
          </View>
        )}

        <View style={styles.body}>
          {/* Source label */}
          <View style={styles.sourcePill}>
            <Text style={styles.sourcePillText}>OWNews · {sourceName}</Text>
          </View>

          {/* Headline */}
          <Text style={styles.title}>{article.title}</Text>

          {/* Date */}
          <Text style={styles.date}>{formatDate(article.published_at)}</Text>

          {/* Editorial summary */}
          {!!article.summary && (
            <Text style={styles.summary}>{article.summary}</Text>
          )}

          {/* Buddy te explica */}
          {!!article.buddy_summary && (
            <BuddyCard summary={article.buddy_summary} />
          )}

          {/* Offshore impact */}
          {!!article.why_it_matters && (
            <OffshoreCard text={article.why_it_matters} />
          )}

          {/* Explica links */}
          {!!(article.explica && article.explica.length > 0) && (
            <View style={styles.explicaSection}>
              <Text style={styles.explicaTitle}>Entenda melhor</Text>
              {article.explica.map(item => (
                <TouchableOpacity
                  key={item.slug}
                  style={styles.explicaItem}
                  onPress={() => Linking.openURL(item.url)}
                >
                  <Ionicons name="book-outline" size={14} color={colors.cyanDim} />
                  <Text style={styles.explicaText}>{item.titulo}</Text>
                  <Ionicons name="open-outline" size={12} color={colors.mutedDim} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Fonte / Proveniência */}
          <View style={styles.sourceSection}>
            <View style={styles.sourceSectionHeader}>
              <Ionicons name="link-outline" size={14} color={colors.mutedDim} />
              <Text style={styles.sourceSectionLabel}>Fonte / Proveniência</Text>
            </View>
            <Text style={styles.sourceSectionText}>Fonte: {sourceName}</Text>
            <TouchableOpacity style={styles.sourceLink} onPress={handleOpenSource}>
              <Text style={styles.sourceLinkText}>Acessar fonte original</Text>
              <Ionicons name="open-outline" size={13} color={colors.cyanDim} />
            </TouchableOpacity>
          </View>

          {/* OWNews branding */}
          <Text style={styles.brandingLine}>OWNews · by OffshoreWorks</Text>
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
  content: { paddingBottom: spacing.xxl },

  offlineBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: surface.card, paddingVertical: spacing.xs, paddingHorizontal: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.amber + '33',
  },
  offlineBadgeText: { fontSize: 11, color: colors.amber },

  heroWrap: { width: '100%', height: 220, backgroundColor: surface.card, overflow: 'hidden' },
  heroFallback: { alignItems: 'center', justifyContent: 'center' },
  heroImage: { width: '100%', height: '100%' },
  imageCredit: {
    position: 'absolute', bottom: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    fontSize: 10, color: 'rgba(255,255,255,0.8)',
    paddingHorizontal: 8, paddingVertical: 3,
  },

  body: { padding: spacing.md, gap: spacing.md },

  sourcePill: {
    alignSelf: 'flex-start', borderRadius: 99,
    backgroundColor: colors.cyan + '18', borderWidth: 1, borderColor: colors.cyan + '44',
    paddingHorizontal: 10, paddingVertical: 3,
  },
  sourcePillText: { fontSize: 11, fontWeight: '700', color: colors.cyanDim, letterSpacing: 0.5 },

  title: { fontSize: 22, fontWeight: '800', color: colors.white, lineHeight: 29, letterSpacing: -0.3 },
  date: { fontSize: 12, color: colors.mutedDim },
  summary: { fontSize: 16, color: colors.muted, lineHeight: 24 },

  // Buddy card — identidade visual alinhada com .eco-buddy do OWNews
  buddyCard: {
    backgroundColor: colors.navy900, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.line,
    overflow: 'hidden', flexDirection: 'row', alignItems: 'flex-start',
  },
  buddyImg: { width: 72, height: 75, opacity: 0.9, marginLeft: -14, marginTop: spacing.sm },
  buddyContent: { flex: 1, padding: spacing.md, paddingLeft: 4 },
  buddyTitle: { fontSize: 17, fontWeight: '800', color: colors.white, marginBottom: 3 },
  buddySub: { fontSize: 13, color: colors.cyanDim, lineHeight: 18, marginBottom: spacing.sm },
  buddyDivider: { height: 1, backgroundColor: colors.line, marginBottom: spacing.sm },
  buddyText: { fontSize: 14, color: colors.muted, lineHeight: 21 },

  // Offshore impact card
  offshoreCard: {
    backgroundColor: colors.amber + '0d', borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.amber + '33', padding: spacing.md, gap: spacing.sm,
  },
  offshoreHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  offshoreTitle: { fontSize: 14, fontWeight: '700', color: colors.amber, flex: 1 },
  offshoreText: { fontSize: 14, color: colors.muted, lineHeight: 21 },

  // Explica
  explicaSection: { gap: spacing.xs },
  explicaTitle: { ...typography.micro, marginBottom: 4 },
  explicaItem: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: surface.card, borderRadius: radius.sm,
    padding: spacing.sm, paddingHorizontal: 12,
    borderWidth: 1, borderColor: colors.line,
  },
  explicaText: { flex: 1, fontSize: 13, color: colors.white, fontWeight: '500' },

  // Source section
  sourceSection: {
    backgroundColor: surface.card, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.line, padding: spacing.md, gap: spacing.sm,
  },
  sourceSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sourceSectionLabel: { ...typography.micro },
  sourceSectionText: { fontSize: 13, color: colors.muted },
  sourceLink: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    borderRadius: 99, borderWidth: 1, borderColor: colors.line,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  sourceLinkText: { fontSize: 13, color: colors.cyanDim, fontWeight: '600' },

  brandingLine: { fontSize: 11, color: colors.mutedDim, textAlign: 'center', marginTop: spacing.sm },
});
