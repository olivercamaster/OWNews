import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  calcularMomento,
  resumoEscala,
  gerarMensagemMomento,
  contarPendentes,
  viagemEAmanha,
  viagemEHoje,
  calcCertStatus,
  getAeroporto,
  contextoHome,
  sincronizarChecklistComCiclo,
} from '@owbuddy/domain';
import type { EscalaConfig, BuddyPrefs, Viagem, ChecklistData, Certificado, HomeContexto, HomeChecklistContagem } from '@owbuddy/domain';
import type { AeroportoEscala } from '@owbuddy/domain';
import { getEscala, getBuddyPrefs, getViagem, getChecklist, getCerts, getCityPref, setCityPref } from '../../src/storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { bottomNavSpace, colors, maritime, spacing, radius, typography, surface } from '../../src/theme';
import { OWBackground } from '../../src/components/OWBackground';
import { saudacao, formatDateBR } from '../../src/format';
import { getWeather, isCacheStale, weatherCacheLabel, type WeatherData } from '../../src/weather';
import { useConnectivity } from '../../src/connectivity';
import { CITIES, type City } from '../../src/cities';
import { searchCities } from '../../src/geocoding';
import { analytics } from '../../src/analytics';
import { fetchVagas } from '../../src/api';
import { LinearGradient } from 'expo-linear-gradient';


// Cor de acento por estado contextual (chip, barra de progresso, borda do hero).
const CONTEXTO_COR: Record<HomeContexto['tipo'], string> = {
  SEM_ESCALA:   colors.cyanDim,
  PRE_EMBARQUE: colors.amber,
  EMBARCADO:    colors.green,
  FOLGA:        colors.cyanDim,
};

type HomeState = {
  escala: EscalaConfig | null;
  prefs: BuddyPrefs;
  viagem: Viagem | null;
  checklist: ChecklistData | null;
  certs: Certificado[];
  city: City | null;
};

export default function TelaHoje() {
  const [state, setState] = useState<HomeState | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  // Só número REAL do /api/buddy/vagas (cache 1 h; offline usa o último cache). Sem dado → sem contador.
  const [vagasTotal, setVagasTotal] = useState<number | null>(null);
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [cityQuery, setCityQuery] = useState('');
  const [cityResults, setCityResults] = useState<City[]>([]);
  const [citySearching, setCitySearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const online = useConnectivity();
  const prevOnline = useRef(online);

  const load = useCallback(async () => {
    const [escala, prefs, viagem, checklist, certs, city] = await Promise.all([
      getEscala(),
      getBuddyPrefs(),
      getViagem(),
      getChecklist(),
      getCerts(),
      getCityPref(),
    ]);
    setState({ escala, prefs, viagem, checklist, certs, city });
    fetchVagas().then(r => {
      setVagasTotal((r.status === 'ok' || r.status === 'offline_cached') && r.vagas.length > 0 ? r.vagas.length : null);
    }).catch(() => setVagasTotal(null));
    if (city) {
      const w = await getWeather(city);
      setWeather(w);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    analytics.screen('home');
    load();
  }, [load]));

  // Refresh weather when coming back online
  useEffect(() => {
    if (online && !prevOnline.current && state?.city) {
      getWeather(state.city).then(setWeather);
      analytics.markOnline();
    }
    if (!online) analytics.markOffline();
    prevOnline.current = online;
  }, [online, state?.city]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  // Debounced geocoding search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (cityQuery.trim().length < 2) {
      setCityResults([]);
      return;
    }
    setCitySearching(true);
    searchTimer.current = setTimeout(async () => {
      analytics.track('city_searched', { query_length: cityQuery.trim().length });
      const results = await searchCities(cityQuery);
      setCityResults(results);
      setCitySearching(false);
    }, 350);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [cityQuery]);

  const openCityPicker = () => {
    setCityQuery('');
    setCityResults([]);
    setShowCityPicker(true);
  };

  const selectCity = async (city: City) => {
    await setCityPref(city);
    setShowCityPicker(false);
    setCityQuery('');
    setCityResults([]);
    setState(s => s ? { ...s, city } : s);
    analytics.track('city_configured');
    const w = await getWeather(city);
    setWeather(w);
  };

  // Reserva no fim do scroll para a nav flutuante nunca cobrir o último card (Android + iOS).
  const insets = useSafeAreaInsets();
  const contentStyle = [styles.content, {
    paddingTop: insets.top + spacing.lg,
    paddingBottom: bottomNavSpace(insets.bottom),
  }];

  if (!state) return <OWBackground watermark="home"><View style={styles.root} /></OWBackground>;

  const { escala, prefs, viagem, checklist, certs } = state;
  const momento = calcularMomento(escala);
  const resumo = resumoEscala(escala);
  const aeroporto = escala?.aeroporto ? getAeroporto(escala.aeroporto) : undefined;
  // Contagem da lista do PRÓXIMO embarque — mesma regra de ciclo do Meu Embarque
  // (sincronizarChecklistComCiclo), só para exibir; quem grava é a tela Meu Embarque.
  const listaCiclo = sincronizarChecklistComCiclo(checklist, resumo.proximoEmbarqueISO).data;
  const checkCount: HomeChecklistContagem = contarPendentes(listaCiclo);
  const contexto = contextoHome(resumo, momento, checkCount);
  // Voz do Buddy (tom escolhido em Meu Buddy) — no tom "discreto" repetiria o hero.
  const voz = prefs.tom && prefs.tom !== 'discreto' ? gerarMensagemMomento(momento, prefs) : '';
  const critCerts = certs
    .filter(c => !c._deleted && c.validade)
    .filter(c => calcCertStatus(c).critico);
  const totalCerts = certs.filter(c => !c._deleted).length;
  const viagemBreve = viagem ? (viagemEAmanha(viagem) || viagemEHoje(viagem)) : false;
  const greeting = saudacao();
  const nome = prefs.apelido?.trim();
  const greetingLabel = nome ? `${greeting}, ${nome}` : `${greeting}!`;

  return (
    <OWBackground watermark="home">
      <ScrollView
        style={styles.root}
        contentContainerStyle={contentStyle}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.cyan} />}
      >
        {/* ── Offline banner ── */}
        {!online && (
          <View style={styles.offlineBanner}>
            <Ionicons name="cloud-offline-outline" size={14} color={colors.amber} />
            <Text style={styles.offlineText}>Offline · suas informações continuam disponíveis</Text>
          </View>
        )}

        {/* ── Saudação + clima numa linha ── */}
        <View style={styles.greetingRow}>
          <View style={styles.greetingLeft}>
            <Text style={styles.greetingText} numberOfLines={1}>{greetingLabel}</Text>
            <TouchableOpacity onPress={openCityPicker} activeOpacity={0.7} style={styles.weatherInline} accessibilityLabel="Cidade e clima">
              {state.city && weather ? (
                <>
                  <Ionicons name="location-outline" size={12} color={colors.cyanDim} />
                  <Text style={styles.weatherInlineText} numberOfLines={1}>
                    {weather.city} · <Text style={styles.weatherInlineTemp}>{weather.tempC}°</Text> {weather.description}
                    {isCacheStale(weather.cachedAt) ? ` · ${weatherCacheLabel(weather.cachedAt)}` : ''}
                  </Text>
                </>
              ) : (
                <>
                  <Ionicons name="partly-sunny-outline" size={13} color={colors.mutedDim} />
                  <Text style={styles.weatherInlineText}>Definir cidade para ver o clima</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.configBtn}
            onPress={() => router.push('/buddy-config')}
            hitSlop={12}
            accessibilityLabel="Configurações do Buddy"
          >
            <Ionicons name="person-circle-outline" size={32} color={colors.muted} />
          </TouchableOpacity>
        </View>

        {/* ── Momento offshore (contextual, dados da Minha Escala) ── */}
        <HomeHero
          contexto={contexto}
          progresso={contexto.tipo === 'PRE_EMBARQUE'
            ? (checkCount.total > 0 ? checkCount.feitos / checkCount.total : 0)
            : resumo.progresso}
          dataISO={contexto.tipo === 'EMBARCADO' ? resumo.proximoDesembarqueISO : resumo.proximoEmbarqueISO}
          aeroporto={aeroporto ? `${aeroporto.code} · ${aeroporto.nome}` : null}
          voz={voz}
        />

        {/* ── Alertas pontuais ── */}
        {critCerts.length > 0 && (
          <TouchableOpacity style={[styles.alertCard, styles.alertCardWarn]} onPress={() => router.navigate('/certs')}>
            <Ionicons name="warning-outline" size={18} color={colors.amber} />
            <Text style={[styles.alertText, { color: colors.amber }]}>
              {critCerts.length === 1
                ? `${critCerts[0]!.nome} vence em breve`
                : `${critCerts.length} certificados vencem em breve`}
            </Text>
            <Ionicons name="chevron-forward" size={14} color={colors.mutedDim} />
          </TouchableOpacity>
        )}
        {viagem && viagemBreve && (
          <TouchableOpacity style={[styles.alertCard, styles.alertCardWarn]} onPress={() => router.navigate('/viagem')}>
            <Ionicons name="airplane" size={16} color={colors.amber} />
            <Text style={[styles.alertText, { color: colors.amber }]}>
              Viagem{' '}
              {viagemEHoje(viagem) ? 'hoje' : 'amanhã'}
              {viagem.hora ? ` · ${viagem.hora}` : ''}
            </Text>
            <Ionicons name="chevron-forward" size={14} color={colors.mutedDim} />
          </TouchableOpacity>
        )}

        {/* ── Núcleo pessoal (2 × 2) ── */}
        <Text style={styles.sectionLabel}>Meu offshore</Text>
        <View style={styles.grid}>
          <HomeTile
            icon="calendar-outline"
            label="Minha Escala"
            sub={resumo.calc ? `${resumo.calc.dEm} × ${resumo.calc.dFo} · calendário` : 'Configurar agora'}
            accent={escala ? colors.cyan : colors.mutedDim}
            onPress={() => router.push(escala ? '/escala' : '/escala-config')}
          />
          <HomeTile
            icon="checkbox-outline"
            label="Meu Embarque"
            sub={checkCount.total === 0
              ? 'Montar minha lista'
              : checkCount.pendentes === 0
                ? 'Tudo preparado'
                : `${checkCount.feitos}/${checkCount.total} preparados`}
            accent={checkCount.total > 0 && checkCount.pendentes === 0 ? colors.green : undefined}
            badge={checkCount.pendentes > 0 ? String(checkCount.pendentes) : undefined}
            onPress={() => router.navigate('/mala')}
          />
          <HomeTile
            icon="airplane-outline"
            label="Minha Viagem"
            sub={viagem ? formatDateBR(viagem.data) + (viagem.hora ? ` · ${viagem.hora}` : '') : 'Registrar viagem'}
            accent={viagemBreve ? colors.amber : undefined}
            onPress={() => router.navigate('/viagem')}
          />
          <HomeTile
            icon="document-text-outline"
            label="Certificados"
            sub={critCerts.length > 0
              ? `${critCerts.length} vence(m) em breve`
              : totalCerts > 0 ? `${totalCerts} em dia` : 'Controle de validades'}
            accent={critCerts.length > 0 ? colors.amber : undefined}
            badge={critCerts.length > 0 ? String(critCerts.length) : undefined}
            badgeColor={colors.red}
            onPress={() => router.navigate('/certs')}
          />
        </View>

        {/* ── Offshore agora ── */}
        <Text style={styles.sectionLabel}>Offshore agora</Text>
        <View style={styles.grid}>
          <HomeTile
            destaque
            icon="briefcase-outline"
            label="Vagas"
            sub={vagasTotal != null ? `${vagasTotal} ${vagasTotal === 1 ? 'vaga verificada' : 'vagas verificadas'}` : 'Vagas verificadas'}
            onPress={() => router.push('/vagas')}
          />
          <HomeTile
            destaque
            icon="boat-outline"
            label="Unidades"
            sub="FPSOs, sondas e navios"
            onPress={() => router.push('/unidades')}
          />
        </View>
        <View style={styles.actionList}>
          <ActionRow icon="newspaper-outline" label="Notícias" sub="O que importa no setor hoje" onPress={() => router.push('/noticias')} />
          <ActionRow icon="cloudy-outline" label="Aeroportos" sub="Condições nas bases offshore" onPress={() => router.push('/aeroportos')} last />
        </View>
        <TouchableOpacity style={styles.toolsLink} onPress={() => router.push('/ferramentas')} activeOpacity={0.7}>
          <Ionicons name="hammer-outline" size={14} color={colors.mutedDim} />
          <Text style={styles.toolsLinkText}>Ferramentas offshore</Text>
          <Ionicons name="chevron-forward" size={13} color={colors.mutedDim} />
        </TouchableOpacity>
      </ScrollView>

      {/* ── City Search Modal ── */}
      <Modal visible={showCityPicker} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowCityPicker(false)} style={{ zIndex: 999 }}>
        <View style={styles.modalRoot}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Buscar cidade</Text>
            <TouchableOpacity onPress={() => setShowCityPicker(false)} hitSlop={12}>
              <Ionicons name="close" size={24} color={colors.muted} />
            </TouchableOpacity>
          </View>
          <View style={styles.searchRow}>
            <Ionicons name="search-outline" size={16} color={colors.mutedDim} />
            <TextInput
              style={styles.searchInput}
              value={cityQuery}
              onChangeText={setCityQuery}
              placeholder="Digite o nome da cidade..."
              placeholderTextColor={colors.mutedDim}
              autoFocus
              autoCorrect={false}
            />
            {citySearching && <ActivityIndicator size="small" color={colors.cyan} />}
            {!citySearching && cityQuery.length > 0 && (
              <TouchableOpacity onPress={() => setCityQuery('')} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={colors.mutedDim} />
              </TouchableOpacity>
            )}
          </View>
          <FlatList
            data={cityResults.length > 0 ? cityResults : CITIES}
            keyExtractor={c => `${c.name}-${c.lat}-${c.lon}`}
            ListHeaderComponent={cityResults.length === 0 && cityQuery.length < 2
              ? <Text style={styles.modalSub}>Cidades frequentes — ou busque qualquer cidade</Text>
              : cityResults.length === 0 && cityQuery.length >= 2 && !citySearching
              ? <Text style={styles.modalSub}>Nenhuma cidade encontrada</Text>
              : null
            }
            renderItem={({ item: c }) => (
              <TouchableOpacity
                style={[styles.cityRow, state.city?.name === c.name && styles.cityRowActive]}
                onPress={() => selectCity(c)}
              >
                <Text style={[styles.cityName, state.city?.name === c.name && styles.cityNameActive]}>{c.name}</Text>
                <Text style={styles.cityState}>{c.state}</Text>
                {state.city?.name === c.name && (
                  <Ionicons name="checkmark" size={18} color={colors.cyan} />
                )}
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>
    </OWBackground>
  );
}

/** Reflexo frio no topo da superfície — acabamento "marítimo", nunca cromado. */
function Sheen() {
  return (
    <LinearGradient
      pointerEvents="none"
      colors={maritime.sheenGradient as unknown as [string, string, ...string[]]}
      locations={maritime.sheenLocations as unknown as [number, number, ...number[]]}
      style={StyleSheet.absoluteFill}
    />
  );
}

/**
 * Hero contextual da Home. Todo o texto vem de contextoHome() (ow-domain),
 * que só lê resumoEscala()/calcularMomento() — nenhuma aritmética de datas aqui.
 */
function HomeHero({
  contexto, progresso, dataISO, aeroporto, voz,
}: {
  contexto: HomeContexto;
  progresso: number;
  dataISO: string | null;
  aeroporto: string | null;
  voz: string;
}) {
  const cor = CONTEXTO_COR[contexto.tipo];

  if (contexto.tipo === 'SEM_ESCALA') {
    return (
      <TouchableOpacity style={[styles.hero, styles.heroVazio]} onPress={() => router.push('/escala-config')} activeOpacity={0.85}>
        <Sheen />
        <Text style={styles.heroTitulo}>{contexto.titulo}</Text>
        <Text style={styles.heroDetalhe}>{contexto.detalhe}</Text>
        <View style={styles.heroCta}>
          <Text style={styles.heroCtaText}>Configurar escala</Text>
          <Ionicons name="arrow-forward" size={15} color={colors.navy950} />
        </View>
      </TouchableOpacity>
    );
  }

  const destino = contexto.tipo === 'PRE_EMBARQUE' ? '/mala' : '/escala';
  const pct = `${Math.round(Math.min(1, Math.max(0, progresso)) * 100)}%` as `${number}%`;
  return (
    <TouchableOpacity
      style={[styles.hero, { borderColor: cor + '40' }]}
      onPress={() => router.navigate(destino)}
      activeOpacity={0.88}
      accessibilityRole="button"
      accessibilityLabel={`${contexto.titulo}. ${contexto.destaque ?? ''}. ${contexto.detalhe}`}
    >
      <LinearGradient
        pointerEvents="none"
        colors={maritime.heroGradient as unknown as [string, string, ...string[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Sheen />
      <View style={styles.heroTop}>
        <View style={[styles.heroChip, { backgroundColor: cor + '1f' }]}>
          <View style={[styles.heroDot, { backgroundColor: cor }]} />
          <Text style={[styles.heroChipText, { color: cor }]}>{contexto.kicker.toUpperCase()}</Text>
        </View>
        {dataISO ? (
          <Text style={styles.heroData}>
            {contexto.tipo === 'EMBARCADO' ? 'Desembarque ' : 'Embarque '}{formatDateBR(dataISO)}
          </Text>
        ) : null}
      </View>
      <Text style={styles.heroTitulo}>{contexto.titulo}</Text>
      {contexto.destaque ? <Text style={[styles.heroDestaque, { color: cor }]}>{contexto.destaque}</Text> : null}
      <View style={styles.heroBar}>
        <View style={[styles.heroBarFill, { width: pct, backgroundColor: cor }]} />
      </View>
      <View style={styles.heroBottom}>
        <Text style={styles.heroDetalhe}>{contexto.detalhe}</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.mutedDim} />
      </View>
      {aeroporto ? (
        <View style={styles.heroAero}>
          <Ionicons name="location-outline" size={12} color={colors.cyanDim} />
          <Text style={styles.heroAeroText}>{aeroporto}</Text>
        </View>
      ) : null}
      {voz ? <Text style={styles.heroVoz}>“{voz}”</Text> : null}
    </TouchableOpacity>
  );
}

/** Bloco compacto da grade 2 × 2 (núcleo pessoal e Offshore agora). */
function HomeTile({
  icon, label, sub, onPress, accent, badge, badgeColor, destaque,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  sub: string;
  onPress: () => void;
  accent?: string;
  badge?: string;
  badgeColor?: string;
  destaque?: boolean;
}) {
  const cor = accent ?? colors.cyanDim;
  return (
    <TouchableOpacity
      style={[styles.tile, destaque && styles.tileDestaque]}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${sub}`}
    >
      <Sheen />
      <View style={styles.tileTop}>
        <View style={[styles.tileIcon, { backgroundColor: cor + '1c' }]}>
          <Ionicons name={icon} size={19} color={cor} />
        </View>
        {badge ? (
          <View style={[styles.actionBadge, { backgroundColor: badgeColor ?? colors.cyan }]}>
            <Text style={styles.actionBadgeText}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.tileLabel} numberOfLines={1}>{label}</Text>
      <Text style={styles.tileSub} numberOfLines={1}>{sub}</Text>
    </TouchableOpacity>
  );
}

/** Linha de lista compacta (Notícias, Aeroportos). */
function ActionRow({
  icon, label, sub, onPress, last,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  sub?: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.actionRow, !last && styles.actionRowBorder]}
      onPress={onPress}
      activeOpacity={0.72}
    >
      <View style={[styles.actionIconWrap, { backgroundColor: colors.cyanDim + '18' }]}>
        <Ionicons name={icon} size={17} color={colors.cyanDim} />
      </View>
      <View style={styles.actionContent}>
        <Text style={styles.actionLabel}>{label}</Text>
        {sub ? <Text style={styles.actionSub} numberOfLines={1}>{sub}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={14} color={colors.mutedDim} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  // paddingBottom real é calculado em runtime (bottomNavSpace) — este é só o fallback.
  content: { padding: spacing.md, paddingBottom: spacing.xxl + spacing.lg },

  // Offline
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.amber + '18',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.amber + '33',
  },
  offlineText: { fontSize: 12, color: colors.amber, flex: 1 },

  // Greeting + clima inline
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  greetingLeft: { flex: 1, marginRight: spacing.sm },
  greetingText: { fontSize: 28, fontWeight: '700', color: colors.white, letterSpacing: -0.3 },
  weatherInline: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, alignSelf: 'flex-start', minHeight: 24 },
  weatherInlineText: { fontSize: 13, color: colors.muted, flexShrink: 1 },
  weatherInlineTemp: { fontWeight: '700', color: colors.white },
  configBtn: { paddingTop: 2 },

  // Hero contextual
  hero: {
    borderRadius: radius.lg,
    padding: spacing.md + 2,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: maritime.glassBorder,
    borderTopColor: maritime.edgeLight,
    backgroundColor: maritime.glassElevated,
    overflow: 'hidden',
    ...maritime.cardShadow,
  },
  heroVazio: { gap: spacing.sm },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm + 2 },
  heroChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.xl, paddingHorizontal: 10, paddingVertical: 4 },
  heroDot: { width: 6, height: 6, borderRadius: 3 },
  heroChipText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.9 },
  heroData: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  heroTitulo: { fontSize: 23, fontWeight: '700', color: colors.white, letterSpacing: -0.2 },
  heroDestaque: { fontSize: 16, fontWeight: '700', marginTop: 4 },
  heroBar: { height: 4, backgroundColor: 'rgba(3, 16, 26, 0.55)', borderRadius: 2, overflow: 'hidden', marginTop: spacing.md },
  heroBarFill: { height: '100%', borderRadius: 2 },
  heroBottom: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm + 2 },
  heroDetalhe: { flex: 1, fontSize: 14, color: colors.muted, lineHeight: 20 },
  heroAero: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm },
  heroAeroText: { fontSize: 12, color: colors.cyanDim, fontWeight: '600' },
  heroVoz: { fontSize: 13, color: colors.mutedDim, fontStyle: 'italic', marginTop: spacing.sm },
  heroCta: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    backgroundColor: colors.cyan, borderRadius: radius.xl, paddingHorizontal: spacing.md, paddingVertical: 9, marginTop: spacing.xs,
  },
  heroCtaText: { fontSize: 14, fontWeight: '700', color: colors.navy950 },

  // Section titles
  sectionLabel: {
    ...typography.micro,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },

  // Grade 2 × 2
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.sm + 2,
    marginBottom: spacing.sm + 2,
  },
  tile: {
    width: '48.5%',
    minHeight: 104,
    backgroundColor: maritime.glass,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: maritime.glassBorder,
    borderTopColor: maritime.edgeLight,
    padding: spacing.sm + 6,
    overflow: 'hidden',
    ...maritime.cardShadow,
  },
  tileDestaque: { borderColor: 'rgba(18, 168, 238, 0.30)', borderTopColor: 'rgba(120, 210, 250, 0.40)' },
  tileTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.sm + 2 },
  tileIcon: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  tileLabel: { fontSize: 15, fontWeight: '700', color: colors.white },
  tileSub: { fontSize: 12, color: colors.muted, marginTop: 2 },

  // Lista compacta (Notícias, Aeroportos)
  actionList: {
    backgroundColor: maritime.glass,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: maritime.glassBorder,
    marginBottom: spacing.xs,
    overflow: 'hidden',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    gap: spacing.sm,
  },
  actionRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: maritime.glassBorder,
  },
  actionIconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionContent: { flex: 1 },
  actionLabel: { fontSize: 14, fontWeight: '600', color: colors.white },
  actionSub: { fontSize: 12, color: colors.mutedDim, marginTop: 1 },
  actionBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  actionBadgeText: { fontSize: 11, fontWeight: '700', color: colors.navy950 },

  // Ferramentas — prioridade menor, link discreto
  toolsLink: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', gap: 6, minHeight: 44, paddingHorizontal: spacing.md },
  toolsLinkText: { fontSize: 13, color: colors.mutedDim, fontWeight: '600' },

  // Alert cards
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: maritime.glass,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: maritime.glassBorder,
  },
  alertCardWarn: { borderColor: colors.amber + '44' },
  alertText: { flex: 1, fontSize: 13, color: colors.muted },

  // City search modal
  modalRoot: { flex: 1, backgroundColor: surface.header },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  modalTitle: { ...typography.h2 },
  modalSub: { ...typography.small, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, color: colors.mutedDim },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
    backgroundColor: surface.card,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.line,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.white,
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSoft,
    gap: spacing.sm,
  },
  cityRowActive: { backgroundColor: colors.cyanFaint },
  cityName: { flex: 1, fontSize: 15, color: colors.white, fontWeight: '500' },
  cityNameActive: { color: colors.cyan },
  cityState: { fontSize: 13, color: colors.mutedDim, width: 24 },
});
