import { useCallback, useEffect, useState } from 'react';
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
import { colors, spacing, radius, typography, surface, maritime, themed, tokens } from '../../src/theme';
import { useTema } from '../../src/tema';
import { fetchFeed, guardarNoticiaAberta, noticiaLocal, paragrafos } from '../../src/api';
import { urlExternaSegura } from '../../src/net';
import { analytics } from '../../src/analytics';
import type { Article } from '../../src/api';

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
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

function abrirExterno(url: string | null | undefined) {
  const u = urlExternaSegura(url);
  if (u) Linking.openURL(u).catch(() => {});
}

/** BUDDY RESUME — mesmo rótulo da web. Buddy oficial pequeno, funcional. */
function BuddyCard({ summary }: { summary: string }) {
  useTema();
  return (
    <View style={styles.buddyCard}>
      <Image
        source={require('../../assets/buddy-watermark.png')}
        style={styles.buddyImg}
        resizeMode="contain"
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
      <View style={styles.buddyContent}>
        <Text style={styles.buddyTitle} accessibilityRole="header">Buddy resume</Text>
        <Text style={styles.buddySub}>Em poucas palavras, o que aconteceu?</Text>
        <View style={styles.buddyDivider} />
        <Text style={styles.buddyText}>{summary}</Text>
      </View>
    </View>
  );
}

function OffshoreCard({ text }: { text: string }) {
  useTema();
  return (
    <View style={styles.offshoreCard}>
      <View style={styles.offshoreHeaderRow}>
        <Ionicons name="navigate-circle-outline" size={16} color={colors.amber} />
        <Text style={styles.offshoreTitle} accessibilityRole="header">O que isso impacta para o offshore</Text>
      </View>
      <Text style={styles.offshoreText}>{text}</Text>
    </View>
  );
}

type Estado =
  | { tipo: 'carregando' }
  | { tipo: 'ok'; article: Article; salva: boolean }
  | { tipo: 'indisponivel'; offline: boolean };

export default function NoticiaScreen() {
  useTema();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' });

  const carregar = useCallback(async () => {
    setEstado({ tipo: 'carregando' });
    // 1) cópia local (feed em cache ou matéria já aberta) — abre sem internet
    const local = await noticiaLocal(String(id));
    if (local) {
      setEstado({ tipo: 'ok', article: local, salva: false });
      guardarNoticiaAberta(local);
      return;
    }
    // 2) link direto para matéria fora do cache: tenta o feed atual
    const r = await fetchFeed(true);
    const achada = r.status === 'ok' || r.status === 'offline_cached' ? r.articles.find(a => a.id === id) ?? null : null;
    if (achada) {
      setEstado({ tipo: 'ok', article: achada, salva: r.status === 'offline_cached' });
      guardarNoticiaAberta(achada);
    } else {
      setEstado({ tipo: 'indisponivel', offline: r.status === 'offline_empty' || r.status === 'offline_cached' });
    }
  }, [id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    if (estado.tipo === 'ok') analytics.track('news_open', { article_id: estado.article.id });
  }, [estado.tipo === 'ok' ? estado.article.id : null]);

  const urlOWNews = `https://ownews.com.br/noticia?id=${encodeURIComponent(String(id ?? ''))}`;

  const handleShare = async (article: Article) => {
    analytics.track('news_share', { article_id: article.id });
    // Compartilha a URL canônica do OWNews, nunca a fonte.
    await Share.share({ message: `${article.title}\n\n${article.url}`, url: article.url, title: article.title }).catch(() => {});
  };

  const voltar = () => (router.canGoBack() ? router.back() : router.replace('/noticias'));

  const header = (article: Article | null) => (
    <View style={[styles.header, { paddingTop: insets.top }]}>
      <TouchableOpacity style={styles.headerBtn} onPress={voltar} hitSlop={12} accessibilityLabel="Voltar">
        <Ionicons name="arrow-back" size={22} color={colors.white} />
      </TouchableOpacity>
      <Text style={styles.headerLabel} numberOfLines={1}>OWNews</Text>
      {article ? (
        <TouchableOpacity style={styles.headerBtn} onPress={() => handleShare(article)} hitSlop={12} accessibilityLabel="Compartilhar notícia">
          <Ionicons name="share-outline" size={22} color={colors.white} />
        </TouchableOpacity>
      ) : <View style={styles.headerBtn} />}
    </View>
  );

  if (estado.tipo === 'carregando') {
    return (
      <OWBackground showWatermark={false}>
        {header(null)}
        <View style={styles.center}>
          <ActivityIndicator color={colors.cyan} size="large" />
        </View>
      </OWBackground>
    );
  }

  if (estado.tipo === 'indisponivel') {
    return (
      <OWBackground showWatermark={false}>
        {header(null)}
        <View style={styles.center}>
          <Ionicons name={estado.offline ? 'cloud-offline-outline' : 'newspaper-outline'} size={48} color={colors.mutedDim} />
          <Text style={styles.errorTitle}>
            {estado.offline ? 'Sem conexão e esta notícia não está salva no aparelho.' : 'Esta notícia não está mais na lista do app.'}
          </Text>
          <TouchableOpacity style={styles.retryBtn} onPress={carregar}>
            <Text style={styles.retryText}>Tentar novamente</Text>
          </TouchableOpacity>
          {!estado.offline && (
            <TouchableOpacity onPress={() => abrirExterno(urlOWNews)} accessibilityRole="link">
              <Text style={styles.sourceLinkText}>Abrir no OWNews</Text>
            </TouchableOpacity>
          )}
        </View>
      </OWBackground>
    );
  }

  const { article } = estado;
  const sourceName = sourceNameFrom(article);
  const data = formatDate(article.published_at);

  return (
    <OWBackground showWatermark={false}>
      {header(article)}

      <ScrollView
        style={styles.root}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        {estado.salva && (
          <View style={styles.offlineBadge}>
            <Ionicons name="cloud-offline-outline" size={12} color={colors.amber} />
            <Text style={styles.offlineBadgeText}>Conteúdo salvo · você está offline</Text>
          </View>
        )}

        <View style={styles.body}>
          <View style={styles.sourcePill}>
            <Text style={styles.sourcePillText}>OWNews · {sourceName}</Text>
          </View>
          <Text style={styles.title} accessibilityRole="header">{article.title}</Text>
          {data ? <Text style={styles.date}>{data}</Text> : null}
        </View>

        {article.image_url ? (
          <View style={styles.heroWrap}>
            <Image
              source={{ uri: article.image_url }}
              style={styles.heroImage}
              resizeMode="cover"
              accessibilityIgnoresInvertColors
            />
            {article.image_credit && (
              <Text style={styles.imageCredit}>{article.image_credit}</Text>
            )}
          </View>
        ) : null}

        <View style={styles.body}>
          <BuddyCard summary={article.buddy_summary} />

          <View style={styles.corpo}>
            {paragrafos(article.corpo).map((p, i) => (
              <Text key={i} style={styles.corpoParagrafo}>{p}</Text>
            ))}
          </View>

          <OffshoreCard text={article.why_it_matters} />

          {article.explica.length > 0 && (
            <View style={styles.explicaSection}>
              <Text style={styles.explicaTitle}>Entenda melhor</Text>
              {article.explica.map(item => (
                <TouchableOpacity
                  key={item.slug}
                  style={styles.explicaItem}
                  onPress={() => abrirExterno(item.url)}
                  accessibilityRole="link"
                >
                  <Ionicons name="book-outline" size={14} color={colors.cyanDim} />
                  <Text style={styles.explicaText}>{item.titulo}</Text>
                  <Ionicons name="open-outline" size={12} color={colors.mutedDim} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={styles.sourceSection}>
            <View style={styles.sourceSectionHeader}>
              <Ionicons name="link-outline" size={14} color={colors.mutedDim} />
              <Text style={styles.sourceSectionLabel}>Fonte</Text>
            </View>
            <Text style={styles.sourceSectionText}>
              Os fatos foram publicados originalmente por {sourceName}. O OWNews escreveu o resumo, o texto e a análise de impacto, com apoio de IA e checagens automáticas.
            </Text>
            {urlExternaSegura(article.original_url) ? (
              <TouchableOpacity
                style={styles.sourceLink}
                onPress={() => { analytics.track('news_source_open', { article_id: article.id }); abrirExterno(article.original_url); }}
                accessibilityRole="link"
              >
                <Text style={styles.sourceLinkText}>Acessar fonte original</Text>
                <Ionicons name="open-outline" size={13} color={colors.cyanDim} />
              </TouchableOpacity>
            ) : null}
          </View>

          <Text style={styles.brandingLine}>OWNews · by OffshoreWorks</Text>
        </View>
      </ScrollView>
    </OWBackground>
  );
}

const styles = themed(() => StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  loadingText: { ...typography.small, color: colors.mutedDim },
  errorTitle: { ...typography.h3, textAlign: 'center', color: colors.muted },
  retryBtn: { backgroundColor: colors.cyan, borderRadius: radius.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  retryText: { color: colors.onAccent, fontWeight: '700' },

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
    backgroundColor: tokens.photoScrim,
    fontSize: 10, color: tokens.photoScrimText,
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
  corpo: { marginTop: spacing.md, gap: spacing.md },
  corpoParagrafo: { fontSize: 16.5, lineHeight: 26, color: colors.white },

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
}));
