import { useCallback, useState } from 'react';
import {
  Dimensions,
  Modal,
  Pressable,
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
  resumoEscala,
  gerarMesDias,
  getAeroporto,
  datasImportantesDoAno,
  hojeISO,
} from '@owbuddy/domain';
import type {
  EscalaConfig,
  Excecao,
  DataPessoal,
  ViagemFolga,
  DayInfo,
  DayKind,
} from '@owbuddy/domain';
import {
  getEscala,
  setEscala,
  getDatasPessoais,
  setDatasPessoais,
  getViagensFolga,
  setViagensFolga,
} from '../src/storage';
import { colors, spacing, radius, typography, surface } from '../src/theme';
import { formatDateBR } from '../src/format';
import { analytics } from '../src/analytics';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DIAS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

const KIND_STYLE: Record<DayKind, { bg: string; text: string; border?: string }> = {
  EMBARCADO:  { bg: '#0d2b1a', text: '#4caf50', border: '#1a5c30' },
  FOLGA:      { bg: 'transparent', text: colors.white },
  DOBRA:      { bg: '#2d2000', text: '#ffc107', border: '#4a3a00' },
  FERIAS:     { bg: '#0d0d30', text: '#7986cb', border: '#1a1a55' },
  SEM_ESCALA: { bg: 'transparent', text: colors.mutedDim },
};

const { width: SCREEN_W } = Dimensions.get('window');
const CELL_SIZE = Math.floor((SCREEN_W - spacing.md * 2 - 6) / 7);

function chunk<T>(arr: T[], n: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += n) result.push(arr.slice(i, i + n));
  return result;
}

function DayCell({ day, onPress }: { day: DayInfo; onPress: () => void }) {
  const s = KIND_STYLE[day.kind];
  const dayNum = parseInt(day.iso.slice(8));
  const hasMarkers = !!(day.feriado || day.datasPessoais.length || day.viagensFolga.length);
  return (
    <TouchableOpacity
      style={[
        styles.dayCell,
        { backgroundColor: s.bg, borderColor: s.border ?? 'transparent', width: CELL_SIZE, height: CELL_SIZE },
        day.isHoje && styles.dayCellToday,
      ]}
      onPress={onPress}
      activeOpacity={hasMarkers || day.kind !== 'SEM_ESCALA' ? 0.7 : 1}
    >
      {day.isEmbarque && <View style={styles.embarqueBar} />}
      {day.isDesembarque && <View style={styles.desembarqueBar} />}
      <Text style={[styles.dayNum, { color: day.isHoje ? colors.cyan : s.text }]}>{dayNum}</Text>
      <View style={styles.dotRow}>
        {day.feriado?.tipo === 'feriado' && <View style={[styles.dot, { backgroundColor: colors.amber }]} />}
        {day.feriado?.tipo === 'comemorativa' && <View style={[styles.dot, { backgroundColor: colors.mutedDim }]} />}
        {day.datasPessoais.length > 0 && <View style={[styles.dot, { backgroundColor: '#ce93d8' }]} />}
        {day.viagensFolga.length > 0 && <View style={[styles.dot, { backgroundColor: colors.cyan }]} />}
      </View>
    </TouchableOpacity>
  );
}

function CalendarMonth({ config, excecoes, datasPessoais, viagensFolga, ano, mes, onDayPress }: {
  config: EscalaConfig;
  excecoes: Excecao[];
  datasPessoais: DataPessoal[];
  viagensFolga: ViagemFolga[];
  ano: number;
  mes: number;
  onDayPress: (day: DayInfo) => void;
}) {
  const dias = gerarMesDias(config, excecoes, datasPessoais, viagensFolga, ano, mes, hojeISO());
  const firstDow = new Date(Date.UTC(ano, mes - 1, 1)).getUTCDay();
  const cells: (DayInfo | null)[] = [...Array(firstDow).fill(null), ...dias];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = chunk(cells, 7);

  return (
    <View style={styles.calendar}>
      <View style={styles.weekRow}>
        {DIAS_SEMANA.map((d, i) => (
          <View key={i} style={[styles.dayHeaderCell, { width: CELL_SIZE }]}>
            <Text style={styles.dayHeaderText}>{d}</Text>
          </View>
        ))}
      </View>
      {weeks.map((week, wi) => (
        <View key={wi} style={styles.weekRow}>
          {week.map((day, di) => day
            ? <DayCell key={di} day={day} onPress={() => onDayPress(day)} />
            : <View key={di} style={[styles.dayEmpty, { width: CELL_SIZE, height: CELL_SIZE }]} />
          )}
        </View>
      ))}
    </View>
  );
}

function DayDetailModal({ day, onClose }: { day: DayInfo | null; onClose: () => void }) {
  if (!day) return null;
  const kindLabel: Record<DayKind, string> = {
    EMBARCADO:  'Embarcado',
    FOLGA:      'De folga',
    DOBRA:      'Dobra',
    FERIAS:     'Férias',
    SEM_ESCALA: '—',
  };
  const kindColor: Record<DayKind, string> = {
    EMBARCADO:  '#4caf50',
    FOLGA:      colors.muted,
    DOBRA:      '#ffc107',
    FERIAS:     '#7986cb',
    SEM_ESCALA: colors.mutedDim,
  };
  const [d, m, y] = [day.iso.slice(8), day.iso.slice(5, 7), day.iso.slice(0, 4)];
  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.detailCard} onPress={() => {}}>
          <View style={styles.detailHeader}>
            <Text style={styles.detailDate}>{d}/{m}/{y}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={20} color={colors.muted} />
            </TouchableOpacity>
          </View>
          <View style={[styles.detailKindRow, { borderColor: kindColor[day.kind] + '44' }]}>
            <View style={[styles.detailKindDot, { backgroundColor: kindColor[day.kind] }]} />
            <Text style={[styles.detailKindText, { color: kindColor[day.kind] }]}>
              {kindLabel[day.kind]}
              {day.kind !== 'SEM_ESCALA' ? ` · dia ${day.diaDoBloco}` : ''}
            </Text>
          </View>
          {day.isEmbarque && (
            <View style={styles.detailRow}>
              <Ionicons name="airplane" size={14} color={colors.green} />
              <Text style={[styles.detailRowText, { color: colors.green }]}>Dia de embarque</Text>
            </View>
          )}
          {day.isDesembarque && (
            <View style={styles.detailRow}>
              <Ionicons name="airplane" size={14} color={colors.amber} style={{ transform: [{ rotate: '180deg' }] }} />
              <Text style={[styles.detailRowText, { color: colors.amber }]}>Dia de desembarque</Text>
            </View>
          )}
          {day.feriado && (
            <View style={styles.detailRow}>
              <Ionicons name="flag-outline" size={14} color={colors.amber} />
              <Text style={styles.detailRowText}>{day.feriado.nome}</Text>
              <Text style={styles.detailRowSub}>{day.feriado.tipo === 'comemorativa' ? 'comemorativa' : 'feriado'}</Text>
            </View>
          )}
          {day.datasPessoais.map(dp => (
            <View key={dp.id} style={styles.detailRow}>
              <Ionicons name="star-outline" size={14} color="#ce93d8" />
              <Text style={styles.detailRowText}>{dp.nome}</Text>
            </View>
          ))}
          {day.viagensFolga.map(v => (
            <View key={v.id} style={styles.detailRow}>
              <Ionicons name="briefcase-outline" size={14} color={colors.cyan} />
              <Text style={styles.detailRowText}>{v.destino}</Text>
              {v.obs ? <Text style={styles.detailRowSub}>{v.obs}</Text> : null}
            </View>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function EscalaScreen() {
  const [config, setConfig] = useState<EscalaConfig | null>(null);
  const [datasPessoais, setDPState] = useState<DataPessoal[]>([]);
  const [viagensFolga, setVFState] = useState<ViagemFolga[]>([]);
  const [viewMes, setViewMes] = useState(() => { const d = new Date(); return { ano: d.getFullYear(), mes: d.getMonth() + 1 }; });
  const [selectedDay, setSelectedDay] = useState<DayInfo | null>(null);

  useFocusEffect(useCallback(() => {
    analytics.screen('escala');
    Promise.all([getEscala(), getDatasPessoais(), getViagensFolga()]).then(([cfg, dp, vf]) => {
      setConfig(cfg);
      setDPState(dp);
      setVFState(vf);
    });
  }, []));

  const excecoes = config?.excecoes ?? [];
  const resumo = resumoEscala(config);
  const calc = resumo.calc;
  const aeroporto = config?.aeroporto ? getAeroporto(config.aeroporto) : undefined;
  const hoje = resumo.hojeISO;
  const { proximoEmbarqueISO, proximoDesembarqueISO } = resumo;

  const navMes = (delta: number) => {
    setViewMes(vm => {
      let m = vm.mes + delta;
      let a = vm.ano;
      if (m > 12) { m = 1; a++; }
      if (m < 1) { m = 12; a--; }
      return { ano: a, mes: m };
    });
  };

  const removeExcecao = async (id: string) => {
    if (!config) return;
    const updated: EscalaConfig = { ...config, excecoes: excecoes.filter(e => e.id !== id) };
    await setEscala(updated);
    setConfig(updated);
  };

  const removeDataPessoal = async (id: string) => {
    const updated = datasPessoais.filter(d => d.id !== id);
    await setDatasPessoais(updated);
    setDPState(updated);
  };

  const removeViagemFolga = async (id: string) => {
    const updated = viagensFolga.filter(v => v.id !== id);
    await setViagensFolga(updated);
    setVFState(updated);
  };

  if (!config) {
    return (
      <View style={styles.setupRoot}>
        <Ionicons name="calendar-outline" size={64} color={colors.cyanDim} />
        <Text style={styles.setupTitle}>Minha Escala</Text>
        <Text style={styles.setupSub}>Configure sua escala para ver o calendário, os próximos embarques e muito mais.</Text>
        <TouchableOpacity style={styles.setupBtn} onPress={() => router.push('/escala-config')}>
          <Text style={styles.setupBtnText}>Configurar escala</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const progressPct = resumo.progresso;

  // Feriados no mês visível
  const feriadosDoMes = datasImportantesDoAno(viewMes.ano).filter(f => {
    const iso = new Date(f.data).toISOString().slice(0, 10);
    return iso.slice(0, 7) === `${viewMes.ano}-${String(viewMes.mes).padStart(2, '0')}`;
  });

  return (
    <>
      <ScrollView style={styles.root} contentContainerStyle={styles.content}>

        {/* ── Status hero ── */}
        <View style={[styles.heroCard, { borderColor: calc?.embarcado ? '#1a5c30' : colors.line }]}>
          {calc?.embarcado ? (
            <>
              <View style={styles.heroRow}>
                <View>
                  <Text style={styles.heroLabel}>EMBARCADO</Text>
                  <Text style={styles.heroValue}>Dia {calc.diaDoBloco} de {calc.dEm}</Text>
                  {proximoDesembarqueISO && (
                    <Text style={styles.heroDate}>desembarca {formatDateBR(proximoDesembarqueISO)}</Text>
                  )}
                </View>
                <View style={styles.heroRight}>
                  <Text style={styles.heroCountdown}>{calc.diasRestantes}</Text>
                  <Text style={styles.heroCountdownLabel}>dias p/ desembarque</Text>
                </View>
              </View>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${Math.round(progressPct * 100)}%` }]} />
              </View>
              {aeroporto && (
                <Text style={styles.heroBadge}>
                  <Ionicons name="navigate-outline" size={11} /> {aeroporto.code} · {aeroporto.nome}
                </Text>
              )}
            </>
          ) : (
            <>
              <View style={styles.heroRow}>
                <View>
                  <Text style={styles.heroLabel}>DE FOLGA</Text>
                  <Text style={styles.heroValue}>Dia {calc?.diaDoBloco ?? '—'} de {calc?.dFo ?? '—'}</Text>
                  {proximoEmbarqueISO && (
                    <Text style={styles.heroDate}>embarca {formatDateBR(proximoEmbarqueISO)}</Text>
                  )}
                </View>
                <View style={styles.heroRight}>
                  <Text style={[styles.heroCountdown, { color: colors.amber }]}>{calc?.diasRestantes ?? '—'}</Text>
                  <Text style={styles.heroCountdownLabel}>dias p/ embarque</Text>
                </View>
              </View>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${Math.round(progressPct * 100)}%`, backgroundColor: colors.amber }]} />
              </View>
              {aeroporto && (
                <Text style={styles.heroBadge}>
                  <Ionicons name="navigate-outline" size={11} /> {aeroporto.code} · {aeroporto.nome}
                </Text>
              )}
            </>
          )}
        </View>

        {/* ── Action row ── */}
        <View style={styles.actionRow}>
          <ActionBtn icon="settings-outline"      label="Config"  onPress={() => router.push('/escala-config')} />
          <ActionBtn icon="add-circle-outline"    label="Dobra"   onPress={() => router.push({ pathname: '/escala-excecao-form', params: { tipo: 'dobra' } })} />
          <ActionBtn icon="umbrella-outline"      label="Férias"  onPress={() => router.push({ pathname: '/escala-excecao-form', params: { tipo: 'ferias' } })} />
          <ActionBtn icon="star-outline"          label="Data"    onPress={() => router.push('/escala-data-form')} />
          <ActionBtn icon="airplane-outline"      label="Viagem"  onPress={() => router.push('/escala-viagem-form')} />
          <ActionBtn icon="people-outline"        label="Cruzar"  onPress={() => router.push('/escala-cruzar')} />
        </View>

        {/* ── Calendar header ── */}
        <View style={styles.calHeader}>
          <TouchableOpacity onPress={() => navMes(-1)} hitSlop={12}>
            <Ionicons name="chevron-back" size={22} color={colors.muted} />
          </TouchableOpacity>
          <Text style={styles.calTitle}>{MESES[viewMes.mes - 1]} {viewMes.ano}</Text>
          <TouchableOpacity onPress={() => navMes(1)} hitSlop={12}>
            <Ionicons name="chevron-forward" size={22} color={colors.muted} />
          </TouchableOpacity>
        </View>

        {/* ── Calendar grid ── */}
        <CalendarMonth
          config={config}
          excecoes={excecoes}
          datasPessoais={datasPessoais}
          viagensFolga={viagensFolga}
          ano={viewMes.ano}
          mes={viewMes.mes}
          onDayPress={setSelectedDay}
        />

        {/* ── Legend ── */}
        <View style={styles.legend}>
          <LegendItem color="#4caf50" label="Embarcado" />
          <LegendItem color={colors.white} label="Folga" />
          <LegendItem color="#ffc107" label="Dobra" />
          <LegendItem color="#7986cb" label="Férias" />
          <LegendItem color={colors.amber} dot label="Feriado" />
          <LegendItem color={colors.cyan} dot label="Viagem" />
          <LegendItem color="#ce93d8" dot label="Data especial" />
        </View>

        {/* ── Feriados do mês ── */}
        {feriadosDoMes.length > 0 && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionCardTitle}>Feriados em {MESES[viewMes.mes - 1]}</Text>
            {feriadosDoMes.map((f, i) => {
              const iso = new Date(f.data).toISOString().slice(0, 10);
              return (
                <View key={i} style={styles.listRow}>
                  <Ionicons name="flag-outline" size={14} color={colors.amber} />
                  <Text style={styles.listRowText}>{f.nome}</Text>
                  <Text style={styles.listRowDate}>{formatDateBR(iso)}</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* ── Exceções ativas ── */}
        {excecoes.length > 0 && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionCardHeaderRow}>
              <Text style={styles.sectionCardTitle}>Dobras e Férias</Text>
              <TouchableOpacity onPress={() => router.push('/escala-excecao-form')} hitSlop={8}>
                <Ionicons name="add" size={18} color={colors.cyanDim} />
              </TouchableOpacity>
            </View>
            {excecoes.map(e => (
              <View key={e.id} style={styles.listRow}>
                <Ionicons name={e.tipo === 'dobra' ? 'time-outline' : 'umbrella-outline'} size={14} color={e.tipo === 'dobra' ? '#ffc107' : '#7986cb'} />
                <View style={styles.listRowInfo}>
                  <Text style={styles.listRowText}>{e.tipo === 'dobra' ? 'Dobra' : 'Férias'}</Text>
                  <Text style={styles.listRowDate}>{formatDateBR(e.ini)} → {formatDateBR(e.fim)}</Text>
                </View>
                <TouchableOpacity onPress={() => removeExcecao(e.id)} hitSlop={10}>
                  <Ionicons name="trash-outline" size={14} color={colors.mutedDim} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* ── Datas pessoais ── */}
        {datasPessoais.length > 0 && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionCardHeaderRow}>
              <Text style={styles.sectionCardTitle}>Datas Especiais</Text>
              <TouchableOpacity onPress={() => router.push('/escala-data-form')} hitSlop={8}>
                <Ionicons name="add" size={18} color={colors.cyanDim} />
              </TouchableOpacity>
            </View>
            {datasPessoais.map(dp => (
              <View key={dp.id} style={styles.listRow}>
                <Ionicons name="star-outline" size={14} color="#ce93d8" />
                <View style={styles.listRowInfo}>
                  <Text style={styles.listRowText}>{dp.nome}</Text>
                  <Text style={styles.listRowDate}>
                    {formatDateBR(dp.start_date)}{dp.end_date ? ` → ${formatDateBR(dp.end_date)}` : ''}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => router.push({ pathname: '/escala-data-form', params: { id: dp.id, nome: dp.nome, start: dp.start_date, end: dp.end_date ?? '' } })}
                  hitSlop={10}
                >
                  <Ionicons name="pencil-outline" size={14} color={colors.mutedDim} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => removeDataPessoal(dp.id)} hitSlop={10} style={{ marginLeft: 6 }}>
                  <Ionicons name="trash-outline" size={14} color={colors.mutedDim} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* ── Viagens na folga ── */}
        {viagensFolga.length > 0 && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionCardHeaderRow}>
              <Text style={styles.sectionCardTitle}>Viagens na Folga</Text>
              <TouchableOpacity onPress={() => router.push('/escala-viagem-form')} hitSlop={8}>
                <Ionicons name="add" size={18} color={colors.cyanDim} />
              </TouchableOpacity>
            </View>
            {viagensFolga.map(v => (
              <View key={v.id} style={styles.listRow}>
                <Ionicons name="briefcase-outline" size={14} color={colors.cyan} />
                <View style={styles.listRowInfo}>
                  <Text style={styles.listRowText}>{v.destino}</Text>
                  <Text style={styles.listRowDate}>{formatDateBR(v.data_ini)} → {formatDateBR(v.data_fim)}</Text>
                  {v.obs ? <Text style={styles.listRowObs}>{v.obs}</Text> : null}
                </View>
                <TouchableOpacity
                  onPress={() => router.push({ pathname: '/escala-viagem-form', params: { id: v.id, destino: v.destino, ini: v.data_ini, fim: v.data_fim, obs: v.obs ?? '' } })}
                  hitSlop={10}
                >
                  <Ionicons name="pencil-outline" size={14} color={colors.mutedDim} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => removeViagemFolga(v.id)} hitSlop={10} style={{ marginLeft: 6 }}>
                  <Ionicons name="trash-outline" size={14} color={colors.mutedDim} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

      </ScrollView>

      {/* ── Day detail modal ── */}
      <DayDetailModal day={selectedDay} onClose={() => setSelectedDay(null)} />
    </>
  );
}

function ActionBtn({ icon, label, onPress }: { icon: IoniconsName; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.actionBtn} onPress={onPress} activeOpacity={0.7}>
      <Ionicons name={icon} size={20} color={colors.cyanDim} />
      <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function LegendItem({ color, label, dot }: { color: string; label: string; dot?: boolean }) {
  return (
    <View style={styles.legendItem}>
      {dot
        ? <View style={[styles.dot, { backgroundColor: color }]} />
        : <View style={[styles.legendSwatch, { backgroundColor: color }]} />
      }
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: surface.bg },
  content: { padding: spacing.md, paddingBottom: spacing.xxl + spacing.lg },

  setupRoot: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: surface.bg, padding: spacing.xl, gap: spacing.md },
  setupTitle: { ...typography.h1, textAlign: 'center' },
  setupSub: { ...typography.body, textAlign: 'center', color: colors.muted },
  setupBtn: { backgroundColor: colors.cyan, borderRadius: radius.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, marginTop: spacing.sm },
  setupBtnText: { fontWeight: '700', fontSize: 16, color: colors.navy950 },

  // Hero
  heroCard: {
    backgroundColor: surface.card, borderRadius: radius.lg, padding: spacing.md,
    marginBottom: spacing.md, borderWidth: 1, gap: spacing.sm,
  },
  heroRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  heroLabel: { fontSize: 11, fontWeight: '700', color: colors.mutedDim, letterSpacing: 1 },
  heroValue: { fontSize: 18, fontWeight: '700', color: colors.white, marginTop: 2 },
  heroDate: { fontSize: 12, color: colors.mutedDim, marginTop: 2 },
  heroRight: { alignItems: 'flex-end' },
  heroCountdown: { fontSize: 28, fontWeight: '700', color: '#4caf50' },
  heroCountdownLabel: { fontSize: 11, color: colors.mutedDim, marginTop: -2 },
  heroBadge: { fontSize: 12, color: colors.cyanDim, fontWeight: '600' },
  progressBar: { height: 6, backgroundColor: colors.navy800, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#4caf50', borderRadius: 3 },

  // Actions
  actionRow: {
    flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md,
    backgroundColor: surface.card, borderRadius: radius.md, padding: spacing.sm,
    borderWidth: 1, borderColor: colors.line,
  },
  actionBtn: { alignItems: 'center', gap: 3, flex: 1 },
  actionLabel: { fontSize: 10, color: colors.mutedDim, fontWeight: '500' },

  // Calendar header
  calHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  calTitle: { fontSize: 16, fontWeight: '700', color: colors.white },

  // Calendar grid
  calendar: { marginBottom: spacing.md },
  weekRow: { flexDirection: 'row' },
  dayHeaderCell: { alignItems: 'center', justifyContent: 'center', paddingVertical: 4 },
  dayHeaderText: { fontSize: 11, fontWeight: '600', color: colors.mutedDim },
  dayCell: { alignItems: 'center', justifyContent: 'center', borderRadius: 4, borderWidth: 1, margin: 0.5, position: 'relative', paddingTop: 2 },
  dayCellToday: { borderColor: colors.cyan, borderWidth: 1.5 },
  dayEmpty: { margin: 0.5 },
  dayNum: { fontSize: 12, fontWeight: '600' },
  dotRow: { flexDirection: 'row', gap: 2, marginTop: 1, height: 4, alignItems: 'center' },
  dot: { width: 4, height: 4, borderRadius: 2 },
  embarqueBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: '#4caf50', borderTopLeftRadius: 4, borderBottomLeftRadius: 4 },
  desembarqueBar: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 3, backgroundColor: colors.amber, borderTopRightRadius: 4, borderBottomRightRadius: 4 },

  // Legend
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendSwatch: { width: 10, height: 10, borderRadius: 2 },
  legendLabel: { fontSize: 10, color: colors.mutedDim },

  // Section cards (exceções, datas pessoais, viagens)
  sectionCard: {
    backgroundColor: surface.card, borderRadius: radius.md, padding: spacing.md,
    borderWidth: 1, borderColor: colors.line, gap: spacing.sm, marginBottom: spacing.md,
  },
  sectionCardTitle: { ...typography.micro, marginBottom: 2 },
  sectionCardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 4, borderTopWidth: 1, borderTopColor: colors.lineSoft },
  listRowInfo: { flex: 1 },
  listRowText: { fontSize: 13, fontWeight: '600', color: colors.white },
  listRowDate: { fontSize: 11, color: colors.mutedDim, marginTop: 1 },
  listRowObs: { fontSize: 11, color: colors.mutedDim, fontStyle: 'italic', marginTop: 1 },

  // Day detail modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  detailCard: { backgroundColor: surface.elevated, borderRadius: radius.lg, padding: spacing.md, width: '100%', gap: spacing.sm },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailDate: { fontSize: 16, fontWeight: '700', color: colors.white },
  detailKindRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radius.sm, padding: spacing.sm },
  detailKindDot: { width: 10, height: 10, borderRadius: 5 },
  detailKindText: { fontSize: 14, fontWeight: '600' },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  detailRowText: { fontSize: 13, color: colors.white, flex: 1 },
  detailRowSub: { fontSize: 11, color: colors.mutedDim },
});
