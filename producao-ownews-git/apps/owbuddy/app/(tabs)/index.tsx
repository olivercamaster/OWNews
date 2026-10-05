import { useCallback, useEffect, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import {
  calcularMomento,
  gerarMensagemMomento,
  contarPendentes,
  viagemEAmanha,
  viagemEHoje,
  TIPO_LABELS,
  getViagemRota,
  calcCertStatus,
} from '@owbuddy/domain';
import type { EscalaConfig, Momento, BuddyPrefs, Viagem, ChecklistData, Certificado } from '@owbuddy/domain';
import { getEscala, getBuddyPrefs, getViagem, getChecklist, getCerts } from '../../src/storage';
import { colors, spacing, radius, typography } from '../../src/theme';

const MOMENTO_LABELS: Record<string, string> = {
  SEM_ESCALA:           '',
  FOLGA:                'DE FOLGA',
  EMBARQUE_DISTANTE:    'EMBARQUE SE APROXIMA',
  EMBARQUE_PROXIMO:     'EMBARQUE EM BREVE',
  VESPERA_EMBARQUE:     'VÉSPERA DO EMBARQUE',
  EMBARCADO:            'EMBARCADO',
  DESEMBARQUE_PROXIMO:  'DESEMBARQUE PRÓXIMO',
};

const MOMENTO_ACCENT: Record<string, string> = {
  FOLGA:               colors.cyanDim,
  EMBARQUE_DISTANTE:   colors.cyanDim,
  EMBARQUE_PROXIMO:    colors.cyan,
  VESPERA_EMBARQUE:    colors.amber,
  EMBARCADO:           colors.green,
  DESEMBARQUE_PROXIMO: colors.amber,
  SEM_ESCALA:          colors.mutedDim,
};

interface HojeState {
  escala: EscalaConfig | null;
  momento: Momento;
  prefs: BuddyPrefs;
  viagem: Viagem | null;
  checklist: ChecklistData | null;
  certs: Certificado[];
}

export default function TelaHoje() {
  const [state, setState] = useState<HojeState | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [escala, prefs, viagem, checklist, certs] = await Promise.all([
      getEscala(),
      getBuddyPrefs(),
      getViagem(),
      getChecklist(),
      getCerts(),
    ]);
    setState({
      escala,
      momento: calcularMomento(escala),
      prefs,
      viagem,
      checklist,
      certs,
    });
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  if (!state) return <View style={styles.loading} />;

  const { momento, prefs, viagem, checklist, certs } = state;
  const msg = gerarMensagemMomento(momento, prefs);
  const accentColor = MOMENTO_ACCENT[momento.tipo] ?? colors.mutedDim;
  const checkCount = checklist ? contarPendentes(checklist) : null;
  const critCerts = certs.filter(c => !c._deleted && c.validade).filter(c => {
    const calc = calcCertStatus(c);
    return calc.critico;
  });
  const viagemAmanha = viagem ? (viagemEAmanha(viagem) || viagemEHoje(viagem)) : false;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.cyan} />}
    >
      {/* Header hero */}
      <View style={styles.hero}>
        <Text style={styles.heroWordmark}>OWBuddy</Text>
        <TouchableOpacity
          style={styles.configBtn}
          onPress={() => router.push('/buddy-config')}
          hitSlop={12}
        >
          <Text style={styles.configBtnText}>⚙</Text>
        </TouchableOpacity>
      </View>

      {/* Status pill */}
      {momento.tipo !== 'SEM_ESCALA' && (
        <View style={[styles.statusPill, { borderColor: accentColor }]}>
          <Text style={[styles.statusPillText, { color: accentColor }]}>
            {MOMENTO_LABELS[momento.tipo]}
          </Text>
        </View>
      )}

      {/* Buddy message */}
      {msg ? (
        <View style={styles.msgBubble}>
          <Text style={styles.msgText}>{msg}</Text>
        </View>
      ) : null}

      {/* No escala state */}
      {momento.tipo === 'SEM_ESCALA' && (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>⚙️</Text>
          <Text style={styles.emptyTitle}>Configure sua escala</Text>
          <Text style={styles.emptyBody}>
            Acesse o OWNews no navegador, configure sua escala e o OWBuddy calcula tudo aqui.
          </Text>
          <TouchableOpacity
            style={styles.emptyBtn}
            onPress={() => router.push('/escala-config')}
          >
            <Text style={styles.emptyBtnText}>Configurar escala →</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Cards grid */}
      {momento.tipo !== 'SEM_ESCALA' && (
        <View style={styles.cardsRow}>
          {momento.diasEmbarque != null && (
            <InfoCard
              label="Próximo embarque"
              value={`${momento.diasEmbarque}`}
              unit={momento.diasEmbarque === 1 ? 'dia' : 'dias'}
              accent={accentColor}
            />
          )}
          {momento.diasDesembarque != null && (
            <InfoCard
              label="Desembarque em"
              value={`${momento.diasDesembarque}`}
              unit={momento.diasDesembarque === 1 ? 'dia' : 'dias'}
              accent={accentColor}
            />
          )}
        </View>
      )}

      {/* Viagem card */}
      {viagem && (
        <TouchableOpacity style={styles.card} onPress={() => router.push('/viagem')}>
          <Text style={styles.cardLabel}>
            {TIPO_LABELS[viagem.tipo] ?? viagem.tipo}
            {viagemAmanha ? '  ·  AMANHÃ' : ''}
          </Text>
          <Text style={styles.cardValue}>
            {viagem.data}{viagem.hora ? ` · ${viagem.hora}` : ''}
          </Text>
          {getViagemRota(viagem) ? (
            <Text style={styles.cardSub}>{getViagemRota(viagem)}</Text>
          ) : null}
        </TouchableOpacity>
      )}

      {/* Mala card */}
      {checkCount && checkCount.total > 0 && (
        <TouchableOpacity style={styles.card} onPress={() => router.push('/mala')}>
          <Text style={styles.cardLabel}>Minha mala</Text>
          <Text style={styles.cardValue}>
            {checkCount.feitos} <Text style={{ color: colors.mutedDim, fontSize: 18 }}>de</Text> {checkCount.total}
          </Text>
          <Text style={styles.cardSub}>
            {checkCount.pendentes === 0
              ? 'Tudo preparado ✓'
              : `${checkCount.pendentes} ${checkCount.pendentes === 1 ? 'item pendente' : 'itens pendentes'}`}
          </Text>
          {/* progress bar */}
          <View style={styles.progressBg}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.round((checkCount.feitos / checkCount.total) * 100)}%` as any,
                  backgroundColor: checkCount.pendentes === 0 ? colors.green : colors.cyan,
                },
              ]}
            />
          </View>
        </TouchableOpacity>
      )}

      {/* Cert warnings */}
      {critCerts.length > 0 && (
        <TouchableOpacity style={[styles.card, styles.alertCard]} onPress={() => router.push('/certs')}>
          <Text style={styles.alertLabel}>⚠ DOCUMENTOS</Text>
          {critCerts.slice(0, 2).map(c => (
            <Text key={c.id} style={styles.alertItem}>
              {c.nome} · {calcCertStatus(c).label}
            </Text>
          ))}
          {critCerts.length > 2 && (
            <Text style={styles.alertMore}>+{critCerts.length - 2} mais</Text>
          )}
        </TouchableOpacity>
      )}

      {/* Footer nav */}
      <View style={styles.footer}>
        <Text style={styles.footerLink}>
          Dados sincronizados via{' '}
          <Text style={{ color: colors.cyan }}>OWNews</Text>
        </Text>
      </View>
    </ScrollView>
  );
}

function InfoCard({ label, value, unit, accent }: { label: string; value: string; unit: string; accent: string }) {
  return (
    <View style={[styles.infoCard, { borderTopColor: accent, borderTopWidth: 2 }]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, { color: accent }]}>{value}</Text>
      <Text style={styles.infoUnit}>{unit}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.navy950 },
  loading: { flex: 1, backgroundColor: colors.navy950 },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },

  hero: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg, marginTop: spacing.sm },
  heroWordmark: { fontSize: 26, fontWeight: '800', color: colors.cyan, letterSpacing: -0.5 },
  configBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.navy800, alignItems: 'center', justifyContent: 'center' },
  configBtnText: { fontSize: 18, color: colors.muted },

  statusPill: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 3, marginBottom: spacing.md },
  statusPillText: { ...typography.micro, fontSize: 10 },

  msgBubble: { backgroundColor: colors.navy800, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg, borderLeftWidth: 2, borderLeftColor: colors.cyan },
  msgText: { ...typography.body, lineHeight: 22 },

  cardsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  infoCard: { flex: 1, backgroundColor: colors.navy800, borderRadius: radius.md, padding: spacing.md, alignItems: 'flex-start' },
  infoLabel: { ...typography.micro, marginBottom: spacing.xs },
  infoValue: { fontSize: 32, fontWeight: '700', lineHeight: 38 },
  infoUnit: { ...typography.small, marginTop: 2 },

  card: { backgroundColor: colors.navy800, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  cardLabel: { ...typography.label, marginBottom: spacing.xs },
  cardValue: { fontSize: 20, fontWeight: '700', color: colors.white, marginBottom: 2 },
  cardSub: { ...typography.small, marginTop: 2 },
  progressBg: { height: 3, backgroundColor: colors.line, borderRadius: 2, marginTop: spacing.sm, overflow: 'hidden' },
  progressFill: { height: 3, borderRadius: 2 },

  alertCard: { borderWidth: 1, borderColor: colors.amber + '55' },
  alertLabel: { ...typography.micro, color: colors.amber, marginBottom: spacing.xs },
  alertItem: { ...typography.small, color: colors.white, marginBottom: 2 },
  alertMore: { ...typography.small, color: colors.mutedDim, marginTop: spacing.xs },

  emptyCard: { backgroundColor: colors.navy800, borderRadius: radius.lg, padding: spacing.lg, alignItems: 'center', marginTop: spacing.lg },
  emptyIcon: { fontSize: 36, marginBottom: spacing.md },
  emptyTitle: { ...typography.h3, marginBottom: spacing.sm },
  emptyBody: { ...typography.small, textAlign: 'center', lineHeight: 20, marginBottom: spacing.lg },
  emptyBtn: { backgroundColor: colors.cyan, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  emptyBtnText: { fontSize: 14, fontWeight: '600', color: colors.navy950 },

  footer: { alignItems: 'center', marginTop: spacing.xl },
  footerLink: { ...typography.small, color: colors.mutedDim },
});
