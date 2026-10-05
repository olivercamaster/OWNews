import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Linking,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  calcularMomento,
  gerarMensagemMomento,
  contarPendentes,
  viagemEAmanha,
  viagemEHoje,
  calcCertStatus,
} from '@owbuddy/domain';
import type { EscalaConfig, BuddyPrefs, Viagem, ChecklistData, Certificado } from '@owbuddy/domain';
import { getEscala, getBuddyPrefs, getViagem, getChecklist, getCerts, getCityPref, setCityPref } from '../../src/storage';
import { colors, spacing, radius, typography, iconSize, surface } from '../../src/theme';
import { formatDateBR, saudacao } from '../../src/format';
import { getWeather, isCacheStale, weatherCacheLabel, type WeatherData } from '../../src/weather';
import { useConnectivity } from '../../src/connectivity';
import { CITIES, type City } from '../../src/cities';
import { analytics } from '../../src/analytics';

const OWNEWS_URL = 'https://ownews.com.br';

const MOMENTO_CHIP: Record<string, string> = {
  FOLGA:               'De folga',
  EMBARQUE_DISTANTE:   'Embarque se aproxima',
  EMBARQUE_PROXIMO:    'Embarque em breve',
  VESPERA_EMBARQUE:    'Véspera do embarque',
  EMBARCADO:           'Embarcado',
  DESEMBARQUE_PROXIMO: 'Desembarque próximo',
};

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

  const selectCity = async (city: City) => {
    await setCityPref(city);
    setShowCityPicker(false);
    setState(s => s ? { ...s, city } : s);
    analytics.track('city_configured');
    const w = await getWeather(city);
    setWeather(w);
  };

  if (!state) return <View style={styles.root} />;

  const { escala, prefs, viagem, checklist, certs } = state;
  const momento = calcularMomento(escala);
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
    <>
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.content}
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
                  {momento.diasEmbarque != null
                    ? ` · ${momento.diasEmbarque}d para embarque`
                    : momento.diasDesembarque != null
                    ? ` · ${momento.diasDesembarque}d para desembarque`
                    : ''}
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
          onPress={() => setShowCityPicker(true)}
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

        {/* ── Como te ajudo, Buddy? ── */}
        <Text style={styles.sectionTitle}>Como te ajudo, Buddy?</Text>

        {/* Primary actions */}
        <View style={styles.ctaGrid}>
          <CtaCard
            icon="calendar-outline"
            label="Minha Escala"
            accent={escala ? colors.cyan : colors.mutedDim}
            onPress={() => router.push('/escala-config')}
          />
          <CtaCard
            icon="checkbox-outline"
            label="Lista Inteligente"
            badge={checkCount && checkCount.pendentes > 0 ? String(checkCount.pendentes) : undefined}
            onPress={() => router.navigate('/mala')}
          />
          <CtaCard
            icon="airplane-outline"
            label="Minha Viagem"
            accent={viagemBreve ? colors.amber : undefined}
            onPress={() => router.navigate('/viagem')}
          />
          <CtaCard
            icon="document-text-outline"
            label="Certificados"
            badge={critCerts.length > 0 ? String(critCerts.length) : undefined}
            badgeColor={colors.red}
            onPress={() => router.navigate('/certs')}
          />
        </View>

        {/* ── Alerta escala não configurada ── */}
        {momento.tipo === 'SEM_ESCALA' && (
          <TouchableOpacity style={styles.alertCard} onPress={() => router.push('/escala-config')}>
            <Ionicons name="information-circle-outline" size={18} color={colors.cyanDim} />
            <Text style={styles.alertText}>Configure sua escala para ver seu momento offshore</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.mutedDim} />
          </TouchableOpacity>
        )}

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
        <View style={styles.offshoreGrid}>
          <OffshoreCard icon="newspaper-outline" label="Notícias" onPress={() => Linking.openURL(OWNEWS_URL)} />
          <OffshoreCard icon="partly-sunny-outline" label="Meteorologia" onPress={() => setShowCityPicker(true)} />
          <OffshoreCard icon="airplane-outline" label="Aeroportos" onPress={() => Linking.openURL(`${OWNEWS_URL}/aeroportos`)} />
          <OffshoreCard icon="briefcase-outline" label="Vagas" onPress={() => Linking.openURL(`${OWNEWS_URL}/vagas`)} />
          <OffshoreCard icon="trending-up-outline" label="Salários" onPress={() => Linking.openURL(`${OWNEWS_URL}/salarios`)} />
        </View>
      </ScrollView>

      {/* ── City Picker Modal ── */}
      <Modal visible={showCityPicker} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowCityPicker(false)}>
        <View style={styles.modalRoot}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Sua cidade</Text>
            <TouchableOpacity onPress={() => setShowCityPicker(false)} hitSlop={12}>
              <Ionicons name="close" size={24} color={colors.muted} />
            </TouchableOpacity>
          </View>
          <Text style={styles.modalSub}>Usamos para buscar o clima. Sem GPS.</Text>
          <ScrollView>
            {CITIES.map(c => (
              <TouchableOpacity
                key={c.name}
                style={[styles.cityRow, state.city?.name === c.name && styles.cityRowActive]}
                onPress={() => selectCity(c)}
              >
                <Text style={[styles.cityName, state.city?.name === c.name && styles.cityNameActive]}>{c.name}</Text>
                <Text style={styles.cityState}>{c.state}</Text>
                {state.city?.name === c.name && (
                  <Ionicons name="checkmark" size={18} color={colors.cyan} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

function CtaCard({
  icon,
  label,
  onPress,
  accent,
  badge,
  badgeColor,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  accent?: string;
  badge?: string;
  badgeColor?: string;
}) {
  return (
    <TouchableOpacity style={styles.ctaCard} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.ctaIconWrap}>
        <Ionicons name={icon} size={iconSize.card} color={accent ?? colors.cyanDim} />
        {badge && (
          <View style={[styles.ctaBadge, { backgroundColor: badgeColor ?? colors.cyan }]}>
            <Text style={styles.ctaBadgeText}>{badge}</Text>
          </View>
        )}
      </View>
      <Text style={styles.ctaLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function OffshoreCard({ icon, label, onPress }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.offshoreCard} onPress={onPress} activeOpacity={0.75}>
      <Ionicons name={icon} size={20} color={colors.muted} />
      <Text style={styles.offshoreLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: surface.bg },
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
    backgroundColor: surface.card,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.line,
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
    backgroundColor: surface.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderLeftWidth: 2,
    borderLeftColor: colors.cyan,
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

  // CTA grid
  ctaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  ctaCard: {
    width: '47.5%',
    backgroundColor: surface.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    gap: spacing.sm,
  },
  ctaIconWrap: { position: 'relative', width: iconSize.card, height: iconSize.card },
  ctaBadge: {
    position: 'absolute',
    top: -6,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  ctaBadgeText: { fontSize: 9, fontWeight: '700', color: colors.navy950 },
  ctaLabel: { fontSize: 13, fontWeight: '600', color: colors.white },

  // Alert cards
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: surface.card,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.line,
  },
  alertCardWarn: { borderColor: colors.amber + '44' },
  alertCardViagem: { borderColor: colors.amber + '44' },
  alertText: { flex: 1, fontSize: 13, color: colors.muted },

  // Offshore info grid
  offshoreGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'flex-start',
  },
  offshoreCard: {
    width: '31%',
    backgroundColor: surface.card,
    borderRadius: radius.md,
    padding: spacing.sm,
    paddingVertical: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.line,
  },
  offshoreLabel: { fontSize: 11, color: colors.muted, fontWeight: '500', textAlign: 'center' },

  // City picker modal
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
  modalSub: { ...typography.small, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
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
