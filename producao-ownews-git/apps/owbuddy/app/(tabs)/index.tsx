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
  MOMENTO_LABEL,
} from '@owbuddy/domain';
import type { EscalaConfig, EscalaResumo, BuddyPrefs, Viagem, ChecklistData, Certificado } from '@owbuddy/domain';
import type { AeroportoEscala } from '@owbuddy/domain';
import { getEscala, getBuddyPrefs, getViagem, getChecklist, getCerts, getCityPref, setCityPref } from '../../src/storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { bottomNavSpace, colors, maritime, spacing, radius, typography, iconSize, surface } from '../../src/theme';
import { OWBackground } from '../../src/components/OWBackground';
import { saudacao, formatDateBR } from '../../src/format';
import { getWeather, isCacheStale, weatherCacheLabel, type WeatherData } from '../../src/weather';
import { useConnectivity } from '../../src/connectivity';
import { CITIES, type City } from '../../src/cities';
import { searchCities } from '../../src/geocoding';
import { analytics } from '../../src/analytics';


const MOMENTO_CHIP = MOMENTO_LABEL;

const MOMENTO_COLOR: Record<string, string> = {
  FOLGA:               colors.cyanDim,
  EMBARQUE_DISTANTE:   colors.cyanDim,
  EMBARQUE_PROXIMO:    colors.cyan,
  VESPERA_EMBARQUE:    colors.amber,
  EMBARCADO:           colors.green,
  DESEMBARQUE_PROXIMO: colors.amber,
  SEM_ESCALA:          colors.mutedDim,
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
    paddingTop: insets.top + spacing.md,
    paddingBottom: bottomNavSpace(insets.bottom),
  }];

  if (!state) return <OWBackground showWatermark={false}><View style={styles.root} /></OWBackground>;

  const { escala, prefs, viagem, checklist, certs } = state;
  const momento = calcularMomento(escala);
  const resumo = resumoEscala(escala);
  const aeroporto = escala?.aeroporto ? getAeroporto(escala.aeroporto) : undefined;
  const msg = gerarMensagemMomento(momento, prefs);
  const accentColor = MOMENTO_COLOR[momento.tipo] ?? colors.mutedDim;
  const checkCount = checklist ? contarPendentes(checklist) : null;
  const critCerts = certs
    .filter(c => !c._deleted && c.validade)
    .filter(c => calcCertStatus(c).critico);
  const viagemBreve = viagem ? (viagemEAmanha(viagem) || viagemEHoje(viagem)) : false;
  const greeting = saudacao();
  const nome = prefs.apelido?.trim();
  const greetingLabel = nome ? `${greeting}, ${nome}` : `${greeting}, Buddy!`;

  return (
    <OWBackground>
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

        {/* ── Greeting ── */}
        <View style={styles.greetingRow}>
          <View style={styles.greetingLeft}>
            <Text style={styles.greetingText}>{greetingLabel}</Text>
            {momento.tipo !== 'SEM_ESCALA' && (
              <View style={[styles.momentoChip, { borderColor: accentColor }]}>
                <Text style={[styles.momentoChipText, { color: accentColor }]}>
                  {MOMENTO_CHIP[momento.tipo]}
                </Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            style={styles.configBtn}
            onPress={() => router.push('/buddy-config')}
            hitSlop={12}
            accessibilityLabel="Configurações do Buddy"
          >
            <Ionicons name="person-circle-outline" size={28} color={colors.muted} />
          </TouchableOpacity>
        </View>

        {/* ── City + Weather ── */}
        <TouchableOpacity
          style={styles.weatherCard}
          onPress={openCityPicker}
          activeOpacity={0.8}
        >
          {state.city && weather ? (
            <>
              <View style={styles.weatherLeft}>
                <Ionicons name="location-outline" size={13} color={colors.cyanDim} />
                <Text style={styles.weatherCity}>{weather.city}, {weather.state}</Text>
              </View>
              <View style={styles.weatherRight}>
                <Text style={styles.weatherTemp}>{weather.tempC}°</Text>
                <Text style={styles.weatherDesc}>{weather.description}</Text>
              </View>
              {isCacheStale(weather.cachedAt) && (
                <Text style={styles.weatherAge}>{weatherCacheLabel(weather.cachedAt)}</Text>
              )}
            </>
          ) : (
            <View style={styles.weatherEmpty}>
              <Ionicons name="partly-sunny-outline" size={16} color={colors.mutedDim} />
              <Text style={styles.weatherEmptyText}>Toque para configurar sua cidade</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* ── Buddy message ── */}
        {msg ? (
          <View style={styles.msgBubble}>
            <Text style={styles.msgText}>{msg}</Text>
          </View>
        ) : null}

        {/* ── Escala: 3 estados (SEM_ESCALA / DE_FOLGA / EMBARCADO) ── */}
        <HomeEscalaCard resumo={resumo} aeroporto={aeroporto} />

        {/* ── Ações principais (list rows — não card soup) ── */}
        <Text style={styles.sectionLabel}>Meu painel</Text>
        <View style={styles.actionList}>
          <ActionRow
            icon="calendar-outline"
            label="Minha Escala"
            sub={escala ? 'Ver calendário e ciclo' : 'Configurar agora'}
            accent={escala ? colors.cyan : colors.mutedDim}
            onPress={() => router.push(escala ? '/escala' : '/escala-config')}
          />
          <ActionRow
            icon="checkbox-outline"
            label="Meu Embarque"
            sub={checkCount ? `${checkCount.feitos}/${checkCount.total} itens prontos` : 'Checklist de viagem'}
            badge={checkCount && checkCount.pendentes > 0 ? String(checkCount.pendentes) : undefined}
            onPress={() => router.navigate('/mala')}
          />
          <ActionRow
            icon="airplane-outline"
            label="Minha Viagem"
            sub={viagem ? formatDateBR(viagem.data) + (viagem.hora ? ` · ${viagem.hora}` : '') : 'Registrar viagem de embarque'}
            accent={viagemBreve ? colors.amber : undefined}
            onPress={() => router.navigate('/viagem')}
          />
          <ActionRow
            icon="document-text-outline"
            label="Certificados"
            sub={critCerts.length > 0 ? `${critCerts.length} vence(m) em breve` : 'Controle de validades'}
            badge={critCerts.length > 0 ? String(critCerts.length) : undefined}
            badgeColor={colors.red}
            onPress={() => router.navigate('/certs')}
            last
          />
        </View>

        {/* ── Alerta certificados ── */}
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

        {/* ── Alerta viagem iminente ── */}
        {viagem && viagemBreve && (
          <TouchableOpacity style={[styles.alertCard, styles.alertCardViagem]} onPress={() => router.navigate('/viagem')}>
            <Ionicons name="airplane" size={16} color={colors.amber} />
            <Text style={[styles.alertText, { color: colors.amber }]}>
              Viagem{' '}
              {viagemEHoje(viagem) ? 'hoje' : 'amanhã'}
              {viagem.hora ? ` · ${viagem.hora}` : ''}
            </Text>
            <Ionicons name="chevron-forward" size={14} color={colors.mutedDim} />
          </TouchableOpacity>
        )}

        {/* ── Informação offshore ── */}
        <Text style={styles.sectionLabel}>Informação offshore</Text>
        <View style={styles.chipRow}>
          <ChipButton icon="newspaper-outline" label="Notícias" onPress={() => router.push('/noticias')} />
          <ChipButton icon="airplane-outline" label="Aeroportos" onPress={() => router.push('/aeroportos')} />
          <ChipButton icon="briefcase-outline" label="Vagas" onPress={() => router.push('/vagas')} />
          <ChipButton icon="hammer-outline" label="Ferramentas" onPress={() => router.push('/ferramentas')} />
        </View>
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

/**
 * Cartão de escala da Home. Três estados explícitos, todos vindos de
 * resumoEscala() — nenhuma aritmética de datas aqui.
 *  SEM_ESCALA → convite para configurar
 *  DE_FOLGA   → countdown + data do embarque + aeroporto + checklist pronto
 *  EMBARCADO  → dia X de Y + progresso + data/countdown do desembarque
 */
function HomeEscalaCard({
  resumo,
  aeroporto,
}: {
  resumo: EscalaResumo;
  aeroporto?: AeroportoEscala;
}) {
  if (resumo.estado === 'SEM_ESCALA' || !resumo.calc) {
    return (
      <TouchableOpacity style={styles.alertCard} onPress={() => router.push('/escala-config')} activeOpacity={0.85}>
        <Ionicons name="calendar-outline" size={18} color={colors.cyanDim} />
        <Text style={styles.alertText}>Configure sua escala para ver seu momento offshore</Text>
        <Ionicons name="chevron-forward" size={14} color={colors.mutedDim} />
      </TouchableOpacity>
    );
  }

  const { calc } = resumo;

  if (resumo.estado === 'EMBARCADO') {
    const dias = resumo.diasParaDesembarque ?? calc.diasRestantes;
    return (
      <TouchableOpacity style={[styles.escalaCard, styles.escalaCardEmbarcado]} onPress={() => router.push('/escala')} activeOpacity={0.85}>
        <View style={styles.escalaRow}>
          <View>
            <Text style={[styles.escalaLabel, { color: colors.green }]}>EMBARCADO</Text>
            <Text style={styles.escalaValue}>Dia {calc.diaDoBloco} de {calc.dEm}</Text>
            {resumo.proximoDesembarqueISO && (
              <Text style={styles.escalaSub}>desembarca {formatDateBR(resumo.proximoDesembarqueISO)}</Text>
            )}
          </View>
          <View style={styles.escalaRight}>
            <Text style={[styles.escalaCountdown, { color: colors.green }]}>{dias}</Text>
            <Text style={styles.escalaUnit}>{dias === 1 ? 'dia p/ desembarque' : 'dias p/ desembarque'}</Text>
          </View>
        </View>
        <View style={styles.escalaProgress}>
          <View style={[styles.escalaFill, { width: `${Math.round(resumo.progresso * 100)}%` as `${number}%`, backgroundColor: colors.green }]} />
        </View>
        {aeroporto && <Text style={styles.escalaBadge}>{aeroporto.code} · {aeroporto.nome}</Text>}
      </TouchableOpacity>
    );
  }

  // DE_FOLGA
  const dias = resumo.diasParaEmbarque ?? calc.diasRestantes;
  const countdown = dias <= 0 ? 'Hoje' : dias === 1 ? 'Amanhã' : `Em ${dias} dias`;
  return (
    <TouchableOpacity style={[styles.escalaCard, styles.escalaCardFolga]} onPress={() => router.push('/escala')} activeOpacity={0.85}>
      <View style={styles.escalaRow}>
        <View>
          <Text style={[styles.escalaLabel, { color: colors.amber }]}>PRÓXIMO EMBARQUE</Text>
          <Text style={styles.escalaValue}>{countdown}</Text>
          {resumo.proximoEmbarqueISO && (
            <Text style={styles.escalaSub}>
              {formatDateBR(resumo.proximoEmbarqueISO)} · folga dia {calc.diaDoBloco} de {calc.dFo}
            </Text>
          )}
        </View>
        {aeroporto && (
          <View style={styles.escalaRight}>
            <Text style={[styles.escalaCountdown, { fontSize: 14, color: colors.cyanDim }]}>{aeroporto.code}</Text>
            <Text style={styles.escalaUnit}>{aeroporto.nome}</Text>
          </View>
        )}
      </View>
      <View style={styles.escalaProgress}>
        <View style={[styles.escalaFill, { width: `${Math.round(resumo.progresso * 100)}%` as `${number}%`, backgroundColor: colors.amber }]} />
      </View>
    </TouchableOpacity>
  );
}

/** Action row — ícone + label + sub + badge. Usado no painel principal. */
function ActionRow({
  icon, label, sub, onPress, accent, badge, badgeColor, last,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  sub?: string;
  onPress: () => void;
  accent?: string;
  badge?: string;
  badgeColor?: string;
  last?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.actionRow, !last && styles.actionRowBorder]}
      onPress={onPress}
      activeOpacity={0.72}
    >
      <View style={[styles.actionIconWrap, { backgroundColor: (accent ?? colors.cyanDim) + '18' }]}>
        <Ionicons name={icon} size={18} color={accent ?? colors.cyanDim} />
      </View>
      <View style={styles.actionContent}>
        <Text style={styles.actionLabel}>{label}</Text>
        {sub ? <Text style={styles.actionSub} numberOfLines={1}>{sub}</Text> : null}
      </View>
      {badge ? (
        <View style={[styles.actionBadge, { backgroundColor: badgeColor ?? colors.cyan }]}>
          <Text style={styles.actionBadgeText}>{badge}</Text>
        </View>
      ) : null}
      <Ionicons name="chevron-forward" size={14} color={colors.mutedDim} />
    </TouchableOpacity>
  );
}

/** Chip compacto — linha de 4 chips para atalhos de informação */
function ChipButton({ icon, label, onPress }: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.chip} onPress={onPress} activeOpacity={0.72}>
      <Ionicons name={icon} size={16} color={colors.cyanDim} />
      <Text style={styles.chipLabel}>{label}</Text>
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

  // Greeting
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    marginTop: spacing.xs,
  },
  greetingLeft: { flex: 1, marginRight: spacing.sm },
  greetingText: { fontSize: 22, fontWeight: '700', color: colors.white, marginBottom: 6 },
  momentoChip: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  momentoChipText: { fontSize: 11, fontWeight: '600', letterSpacing: 0.3 },
  configBtn: { paddingTop: 2 },

  // Weather
  weatherCard: {
    backgroundColor: maritime.glass,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: maritime.glassBorder,
  },
  weatherLeft: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  weatherCity: { fontSize: 13, color: colors.muted, fontWeight: '500' },
  weatherRight: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  weatherTemp: { fontSize: 18, fontWeight: '700', color: colors.white },
  weatherDesc: { fontSize: 12, color: colors.muted },
  weatherAge: { fontSize: 10, color: colors.mutedDim, position: 'absolute', bottom: 3, right: spacing.sm },
  weatherEmpty: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  weatherEmptyText: { fontSize: 13, color: colors.mutedDim },

  // Buddy message
  msgBubble: {
    backgroundColor: maritime.glassElevated,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderLeftWidth: 2,
    borderLeftColor: colors.cyan,
    borderWidth: 1,
    borderColor: maritime.glassBorder,
    ...maritime.cardShadow,
  },
  msgText: { ...typography.body, lineHeight: 22 },

  // Section titles
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.white,
    marginBottom: spacing.md,
    marginTop: spacing.xs,
  },
  sectionLabel: {
    ...typography.micro,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },

  // Action list (painel principal)
  actionList: {
    backgroundColor: maritime.glass,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: maritime.glassBorder,
    marginBottom: spacing.md,
    overflow: 'hidden',
    ...maritime.cardShadow,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
    gap: spacing.sm,
  },
  actionRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: maritime.glassBorder,
  },
  actionIconWrap: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionContent: { flex: 1 },
  actionLabel: { fontSize: 14, fontWeight: '600', color: colors.white },
  actionSub: { fontSize: 12, color: colors.mutedDim, marginTop: 1 },
  actionBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  actionBadgeText: { fontSize: 10, fontWeight: '700', color: colors.navy950 },

  // Chips offshore (linha horizontal)
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: maritime.glass,
    borderRadius: radius.xl,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: maritime.glassBorder,
  },
  chipLabel: { fontSize: 12, fontWeight: '600', color: colors.muted },

  // Escala status card (3 estados)
  escalaCard: {
    backgroundColor: maritime.glassElevated, borderRadius: radius.md, padding: spacing.md,
    marginBottom: spacing.md, borderWidth: 1, borderColor: maritime.glassBorder, gap: spacing.sm,
    ...maritime.cardShadow,
  },
  escalaCardEmbarcado: { borderColor: colors.green + '55' },
  escalaCardFolga: { borderColor: colors.amber + '44' },
  escalaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  escalaLabel: { fontSize: 10, fontWeight: '700', color: colors.mutedDim, letterSpacing: 0.8 },
  escalaValue: { fontSize: 16, fontWeight: '700', color: colors.white, marginTop: 2 },
  escalaSub: { fontSize: 12, color: colors.mutedDim, marginTop: 2 },
  escalaRight: { alignItems: 'flex-end' },
  escalaCountdown: { fontSize: 24, fontWeight: '700', color: colors.green },
  escalaUnit: { fontSize: 10, color: colors.mutedDim },
  escalaBadge: { fontSize: 11, color: colors.cyanDim, fontWeight: '600' },
  escalaProgress: { height: 4, backgroundColor: 'rgba(6, 28, 43, 0.6)', borderRadius: 2, overflow: 'hidden' },
  escalaFill: { height: '100%', backgroundColor: colors.green, borderRadius: 2 },

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
  alertCardViagem: { borderColor: colors.amber + '44' },
  alertText: { flex: 1, fontSize: 13, color: colors.muted },

  // Offshore - estilos removidos (agora usa chipRow/chip)

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
