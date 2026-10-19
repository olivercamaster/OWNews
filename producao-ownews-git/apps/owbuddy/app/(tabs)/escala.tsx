import { useCallback, useRef, useState } from 'react';
import {
  Animated,
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
  msParaISO,
  ESCALA_TIPOS,
} from '@owbuddy/domain';
import type {
  EscalaConfig,
  Excecao,
  EventoPessoal,
  EventoTipo,
  DayInfo,
  DayKind,
} from '@owbuddy/domain';
import {
  getEscala,
  setEscala,
  getEventosPessoais,
  setEventosPessoais,
} from '../../src/storage';
import { bottomNavSpace, colors, spacing, radius, typography, surface, maritime } from '../../src/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OWBackground } from '../../src/components/OWBackground';
import { formatDateBR } from '../../src/format';
import { analytics } from '../../src/analytics';
import { confirmarRemocao } from '../../src/confirmar';

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

const TIPO_META: Record<EventoTipo, { icon: IoniconsName; color: string; label: string }> = {
  VIAGEM:       { icon: 'airplane-outline',                   color: colors.cyan,     label: 'Viagem'       },
  CURSO:        { icon: 'school-outline',                     color: colors.amber,    label: 'Curso'        },
  DATA_ESPECIAL:{ icon: 'star-outline',                       color: '#ce93d8',       label: 'Data Especial'},
  COMPROMISSO:  { icon: 'calendar-outline',                   color: colors.orange,   label: 'Compromisso'  },
  OUTRO:        { icon: 'ellipsis-horizontal-circle-outline', color: colors.mutedDim, label: 'Outro'        },
};

// Calendário: 7 colunas de largura FIXA calculada da largura REAL do container (onLayout) —
// celular, tablet, rotação e coluna web de 560 px. Antes vinha de Dimensions lido uma vez no
// load do módulo (no navegador largo: células gigantes). Conteúdo nenhum (EMB/DEB, hoje,
// ícones) altera o tamanho: a célula tem width/height explícitos e overflow escondido.
const CELL_GAP = 1;
const COMPACTA = StyleSheet.create({
  tag: { height: 10, paddingHorizontal: 2, marginBottom: 0 },
  tagText: { fontSize: 7.5, lineHeight: 9 },
  spacer: { height: 10 },
  num: { fontSize: 13, lineHeight: 15 },
  icons: { height: 10, marginTop: 0 },
});

function chunk<T>(arr: T[], n: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += n) result.push(arr.slice(i, i + n));
  return result;
}

const MESES_EXTENSO = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];

/** Leitor de tela: "12 de outubro, embarque, embarcado dia 1, viagem". */
function rotuloDia(day: DayInfo): string {
  const partes = [`${parseInt(day.iso.slice(8), 10)} de ${MESES_EXTENSO[parseInt(day.iso.slice(5, 7), 10) - 1]}`];
  if (day.isHoje) partes.push('hoje');
  if (day.isEmbarque) partes.push('embarque');
  if (day.isDesembarque) partes.push('desembarque');
  const k: Record<DayKind, string> = { EMBARCADO: 'embarcado', FOLGA: 'folga', DOBRA: 'dobra', FERIAS: 'férias', SEM_ESCALA: '' };
  if (k[day.kind]) partes.push(`${k[day.kind]} dia ${day.diaDoBloco}`);
  if (day.feriado) partes.push(day.feriado.nome);
  for (const t of new Set(day.eventosPessoais.map(e => e.tipo))) partes.push(TIPO_META[t].label);
  return partes.join(', ');
}

function DayCell({ day, size, onPress }: { day: DayInfo; size: number; onPress: () => void }) {
  const s = KIND_STYLE[day.kind];
  const dayNum = parseInt(day.iso.slice(8));
  const numColor = day.isEmbarque ? '#6de88a' : day.isDesembarque ? colors.amber : s.text;
  const tipos = [...new Set(day.eventosPessoais.map(e => e.tipo))];
  // Célula pequena (320–360 dp): mesma estrutura, só escala tipografia/etiqueta — nunca o tamanho.
  const c = size < 46 ? COMPACTA : null;
  return (
    <TouchableOpacity
      style={[
        styles.dayCell,
        { backgroundColor: s.bg, borderColor: s.border ?? 'transparent', width: size, height: size },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={rotuloDia(day)}
    >
      {/* Marcador de transição: etiqueta sólida e legível (antes: texto de 7px) */}
      {day.isEmbarque ? (
        <View style={[styles.transitionTag, c?.tag, { backgroundColor: colors.green }]}><Text style={[styles.transitionTagText, c?.tagText]}>EMB</Text></View>
      ) : day.isDesembarque ? (
        <View style={[styles.transitionTag, c?.tag, { backgroundColor: colors.amber }]}><Text style={[styles.transitionTagText, c?.tagText]}>DEB</Text></View>
      ) : (
        <View style={[styles.transitionSpacer, c?.spacer]} />
      )}
      {day.isHoje ? (
        <View style={styles.hojeRing}>
          <Text style={[styles.dayNum, c?.num, { color: numColor }]} maxFontSizeMultiplier={1.2}>{dayNum}</Text>
        </View>
      ) : (
        <Text style={[styles.dayNum, c?.num, { color: numColor }]} maxFontSizeMultiplier={1.2}>{dayNum}</Text>
      )}
      <View style={[styles.iconRow, c?.icons]}>
        {day.feriado?.tipo === 'feriado'     && <View style={[styles.dot, { backgroundColor: colors.orange }]} />}
        {day.feriado?.tipo === 'comemorativa' && <View style={[styles.dot, { backgroundColor: colors.mutedDim }]} />}
        {tipos.slice(0, 2).map(t => {
          const m = TIPO_META[t];
          return <Ionicons key={t} name={m.icon} size={c ? 9 : 11} color={m.color} />;
        })}
        {tipos.length > 2 && <Text style={styles.maisEventos}>+</Text>}
      </View>
    </TouchableOpacity>
  );
}

function CalendarMonth({ config, excecoes, eventosPessoais, ano, mes, onDayPress }: {
  config: EscalaConfig;
  excecoes: Excecao[];
  eventosPessoais: EventoPessoal[];
  ano: number;
  mes: number;
  onDayPress: (day: DayInfo) => void;
}) {
  const dias = gerarMesDias(config, excecoes, eventosPessoais, ano, mes, hojeISO());
  const firstDow = new Date(Date.UTC(ano, mes - 1, 1)).getUTCDay();
  const cells: (DayInfo | null)[] = [...Array(firstDow).fill(null), ...dias];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = chunk(cells, 7);
  const [largura, setLargura] = useState(0);
  const size = largura > 0 ? Math.floor((largura - CELL_GAP * 6) / 7) : 0;

  return (
    <View style={styles.calendar} onLayout={e => setLargura(e.nativeEvent.layout.width)}>
      {size > 0 && (<>
        <View style={styles.weekRow}>
          {DIAS_SEMANA.map((d, i) => (
            <View key={i} style={[styles.dayHeaderCell, { width: size }]}>
              <Text style={styles.dayHeaderText}>{d}</Text>
            </View>
          ))}
        </View>
        {weeks.map((week, wi) => (
          <View key={wi} style={styles.weekRow}>
            {week.map((day, di) => day
              ? <DayCell key={di} day={day} size={size} onPress={() => onDayPress(day)} />
              : <View key={di} style={{ width: size, height: size }} />
            )}
          </View>
        ))}
      </>)}
    </View>
  );
}

// Bottom sheet deslizante — sem dependências nativas
function DayBottomSheet({
  day,
  onClose,
  onAddEvento,
  onEditEvento,
  onDeleteEvento,
}: {
  day: DayInfo | null;
  onClose: () => void;
  onAddEvento: (iso: string) => void;
  onEditEvento: (ev: EventoPessoal) => void;
  onDeleteEvento: (id: string) => void;
}) {
  const translateY = useRef(new Animated.Value(400)).current;

  const open = useCallback(() => {
    Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }).start();
  }, [translateY]);

  const close = useCallback(() => {
    Animated.timing(translateY, { toValue: 400, duration: 220, useNativeDriver: true }).start(onClose);
  }, [translateY, onClose]);

  useFocusEffect(useCallback(() => { if (day) open(); }, [day, open]));

  if (!day) return null;

  const kindLabel: Record<DayKind, string> = {
    EMBARCADO: 'Embarcado', FOLGA: 'De folga', DOBRA: 'Dobra', FERIAS: 'Férias', SEM_ESCALA: '—',
  };
  const kindColor: Record<DayKind, string> = {
    EMBARCADO: '#4caf50', FOLGA: colors.muted, DOBRA: '#ffc107', FERIAS: '#7986cb', SEM_ESCALA: colors.mutedDim,
  };
  const [d, m, y] = [day.iso.slice(8), day.iso.slice(5, 7), day.iso.slice(0, 4)];

  return (
    <Modal transparent animationType="none" visible onRequestClose={close}>
      <Pressable style={styles.sheetOverlay} onPress={close}>
        <Animated.View style={[styles.sheetContainer, { transform: [{ translateY }] }]}>
          <Pressable onPress={() => {}}>
            {/* Handle */}
            <View style={styles.sheetHandle} />

            {/* Data + status */}
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetDate}>{d}/{m}/{y}</Text>
                <View style={[styles.kindPill, { borderColor: kindColor[day.kind] + '55' }]}>
                  <View style={[styles.kindDot, { backgroundColor: kindColor[day.kind] }]} />
                  <Text style={[styles.kindText, { color: kindColor[day.kind] }]}>
                    {kindLabel[day.kind]}{day.kind !== 'SEM_ESCALA' ? ` · dia ${day.diaDoBloco}` : ''}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.addEventoBtn}
                onPress={() => { close(); setTimeout(() => onAddEvento(day.iso), 240); }}
              >
                <Ionicons name="add" size={16} color={colors.navy950} />
                <Text style={styles.addEventoBtnText}>Evento</Text>
              </TouchableOpacity>
            </View>

            {/* Transições */}
            {day.isEmbarque && (
              <View style={styles.sheetRow}>
                <Ionicons name="airplane" size={14} color={colors.green} />
                <Text style={[styles.sheetRowText, { color: colors.green }]}>Dia de embarque</Text>
              </View>
            )}
            {day.isDesembarque && (
              <View style={styles.sheetRow}>
                <Ionicons name="airplane" size={14} color={colors.amber} style={{ transform: [{ rotate: '180deg' }] }} />
                <Text style={[styles.sheetRowText, { color: colors.amber }]}>Dia de desembarque</Text>
              </View>
            )}

            {/* Feriado */}
            {day.feriado && (
              <View style={styles.sheetRow}>
                <Ionicons name="flag-outline" size={14} color={colors.orange} />
                <Text style={styles.sheetRowText}>{day.feriado.nome}</Text>
                <Text style={styles.sheetRowSub}>{day.feriado.tipo === 'comemorativa' ? 'comemorativa' : 'feriado'}</Text>
              </View>
            )}

            {/* Eventos pessoais */}
            {day.eventosPessoais.map(ev => {
              const m = TIPO_META[ev.tipo];
              return (
                <View key={ev.id} style={styles.sheetRow}>
                  <Ionicons name={m.icon} size={14} color={m.color} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sheetRowText}>{ev.nome}</Text>
                    {ev.hora_ini && (
                      <Text style={styles.sheetRowSub}>{ev.hora_ini}{ev.hora_fim ? ` → ${ev.hora_fim}` : ''}</Text>
                    )}
                    {ev.obs && <Text style={styles.sheetRowSub}>{ev.obs}</Text>}
                  </View>
                  <TouchableOpacity
                    onPress={() => { close(); setTimeout(() => onEditEvento(ev), 240); }}
                    hitSlop={10}
                  >
                    <Ionicons name="pencil-outline" size={14} color={colors.mutedDim} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => confirmarRemocao('Remover evento?', ev.nome, () => onDeleteEvento(ev.id))}
                    hitSlop={10}
                    style={{ marginLeft: 6 }}
                    accessibilityLabel={`Remover ${ev.nome}`}
                  >
                    <Ionicons name="trash-outline" size={14} color={colors.mutedDim} />
                  </TouchableOpacity>
                </View>
              );
            })}

            {day.eventosPessoais.length === 0 && day.kind === 'SEM_ESCALA' && !day.feriado && (
              <Text style={styles.sheetEmpty}>Nenhum evento neste dia.</Text>
            )}
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

export default function EscalaScreen() {
  const [config, setConfig] = useState<EscalaConfig | null>(null);
  const [eventosPessoais, setEPState] = useState<EventoPessoal[]>([]);
  const [viewMes, setViewMes] = useState(() => { const d = new Date(); return { ano: d.getFullYear(), mes: d.getMonth() + 1 }; });
  const [selectedDay, setSelectedDay] = useState<DayInfo | null>(null);
  // Agora é tab: reserva o espaço da nav flutuante no fim do scroll (Android + iOS).
  const insets = useSafeAreaInsets();

  const load = useCallback(async () => {
    const [cfg, ep] = await Promise.all([getEscala(), getEventosPessoais()]);
    setConfig(cfg);
    setEPState(ep);
  }, []);

  useFocusEffect(useCallback(() => {
    analytics.screen('escala');
    load();
  }, [load]));

  const excecoes = config?.excecoes ?? [];
  const resumo = resumoEscala(config);
  const calc = resumo.calc;
  const aeroporto = config?.aeroporto ? getAeroporto(config.aeroporto) : undefined;
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

  const deleteEvento = async (id: string) => {
    const all = await getEventosPessoais();
    const updated = all.map(e => e.id === id ? { ...e, _deleted: true, updated_at: new Date().toISOString() } : e);
    await setEventosPessoais(updated);
    const fresh = updated.filter(e => !e._deleted);
    setEPState(fresh);
    // Atualiza o dia selecionado se o evento era dele
    if (selectedDay) {
      setSelectedDay(prev => prev ? {
        ...prev,
        eventosPessoais: prev.eventosPessoais.filter(e => e.id !== id),
      } : null);
    }
  };

  if (!config || !calc) {
    return (
      <View style={[styles.setupRoot, { paddingBottom: bottomNavSpace(insets.bottom) }]}>
        <Ionicons name="calendar-outline" size={64} color={colors.cyanDim} />
        <Text style={styles.setupTitle}>Minha Escala</Text>
        <Text style={styles.setupSub}>
          {config
            ? 'Sua escala salva está incompleta (ciclo ou data). Revise os ajustes — nada foi apagado.'
            : 'Configure sua escala para ver o calendário, os próximos embarques e muito mais.'}
        </Text>
        <TouchableOpacity style={styles.setupBtn} onPress={() => router.push('/escala-config')}>
          <Text style={styles.setupBtnText}>{config ? 'Revisar escala' : 'Configurar escala'}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const progressPct = resumo.progresso;

  const feriadosDoMes = datasImportantesDoAno(viewMes.ano).filter(f => {
    const iso = msParaISO(f.data);
    return iso.slice(0, 7) === `${viewMes.ano}-${String(viewMes.mes).padStart(2, '0')}`;
  });

  return (
    <OWBackground>
      <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: bottomNavSpace(insets.bottom) }]}>

        {/* ── Status hero ── */}
        <View style={[styles.heroCard, { borderColor: calc?.embarcado ? '#1a5c30' : colors.line }]}>
          {calc?.embarcado ? (
            <>
              <View style={styles.heroRow}>
                <View style={styles.heroLeft}>
                  <Text style={styles.heroLabel}>EMBARCADO</Text>
                  <Text style={styles.heroValue}>Dia {calc.diaDoBloco} de {calc.dEm}</Text>
                  {proximoDesembarqueISO && (
                    <Text style={styles.heroDate}>desembarca {formatDateBR(proximoDesembarqueISO)}</Text>
                  )}
                </View>
                <View style={styles.heroRight}>
                  <Text style={styles.heroCountdown}>{calc.diasRestantes}</Text>
                  <Text style={styles.heroCountdownLabel}>{calc.diasRestantes === 1 ? 'dia p/ desembarque' : 'dias p/ desembarque'}</Text>
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
                <View style={styles.heroLeft}>
                  <Text style={styles.heroLabel}>DE FOLGA</Text>
                  <Text style={styles.heroValue}>Dia {calc?.diaDoBloco ?? '—'} de {calc?.dFo ?? '—'}</Text>
                  {proximoEmbarqueISO && (
                    <Text style={styles.heroDate}>embarca {formatDateBR(proximoEmbarqueISO)}</Text>
                  )}
                </View>
                <View style={styles.heroRight}>
                  <Text style={[styles.heroCountdown, { color: colors.amber }]}>{calc?.diasRestantes ?? '—'}</Text>
                  <Text style={styles.heroCountdownLabel}>{calc?.diasRestantes === 1 ? 'dia p/ embarque' : 'dias p/ embarque'}</Text>
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

        <Text style={styles.auditLine} numberOfLines={2}>
          Base: {ESCALA_TIPOS.find(t => t.value === config.tipo)?.label ?? config.tipo}
          {config.tipo === 'custom' && config.diasEmbarcado && config.diasFolga ? ` (${config.diasEmbarcado}×${config.diasFolga})` : ''}
          {' · '}{config.tipoRef === 'desembarquei' ? 'desembarquei' : 'embarquei'} em {formatDateBR(config.dataRef)}
          {config.origem === 'conta' ? ' · da conta OW' : config.origem === 'dispositivo' ? ' · deste aparelho' : ''}
          {config.updated_at ? ` · ${formatDateBR(config.updated_at)}` : ''}
        </Text>

        {/* ── Action row ── */}
        <View style={styles.actionRow}>
          <ActionBtn icon="settings-outline"   label="Ajustes"  onPress={() => router.push('/escala-config')} />
          <ActionBtn icon="add-circle-outline"  label="Dobra"   onPress={() => router.push({ pathname: '/escala-excecao-form', params: { tipo: 'dobra' } })} />
          <ActionBtn icon="umbrella-outline"    label="Férias"  onPress={() => router.push({ pathname: '/escala-excecao-form', params: { tipo: 'ferias' } })} />
          <ActionBtn icon="calendar-outline"    label="Evento"  onPress={() => router.push('/escala-evento-form')} />
          <ActionBtn icon="people-outline"      label="Cruzar"  onPress={() => router.push('/escala-cruzar')} />
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
          eventosPessoais={eventosPessoais}
          ano={viewMes.ano}
          mes={viewMes.mes}
          onDayPress={setSelectedDay}
        />

        {/* ── Legend ── */}
        <View style={styles.legend}>
          <LegendItem color={colors.green} tag="EMB" label="Embarque" />
          <LegendItem color="#4caf50" label="Embarcado" />
          <LegendItem color={colors.amber} tag="DEB" label="Desembarque" />
          <LegendItem color={colors.white} label="Folga" />
          <LegendItem color="#ffc107" label="Dobra" />
          <LegendItem color="#7986cb" label="Férias" />
          <LegendItem color={colors.orange} dot label="Feriado" />
          {(['VIAGEM','CURSO','DATA_ESPECIAL','COMPROMISSO'] as EventoTipo[]).map(t => {
            const m = TIPO_META[t];
            return <LegendItem key={t} icon={m.icon} color={m.color} label={m.label} />;
          })}
        </View>

        {/* ── Feriados do mês ── */}
        {feriadosDoMes.length > 0 && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionCardTitle}>Feriados em {MESES[viewMes.mes - 1]}</Text>
            {feriadosDoMes.map((f, i) => {
              const iso = msParaISO(f.data);
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
                <TouchableOpacity
                  onPress={() => confirmarRemocao(e.tipo === 'dobra' ? 'Remover dobra?' : 'Remover férias?', `${formatDateBR(e.ini)} → ${formatDateBR(e.fim)}`, () => removeExcecao(e.id))}
                  hitSlop={10}
                  accessibilityLabel={e.tipo === 'dobra' ? 'Remover dobra' : 'Remover férias'}
                >
                  <Ionicons name="trash-outline" size={14} color={colors.mutedDim} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* ── Eventos pessoais ── */}
        {eventosPessoais.length > 0 && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionCardHeaderRow}>
              <Text style={styles.sectionCardTitle}>Meus Eventos</Text>
              <TouchableOpacity onPress={() => router.push('/escala-evento-form')} hitSlop={8}>
                <Ionicons name="add" size={18} color={colors.cyanDim} />
              </TouchableOpacity>
            </View>
            {eventosPessoais.map(ev => {
              const m = TIPO_META[ev.tipo];
              return (
                <View key={ev.id} style={styles.listRow}>
                  <Ionicons name={m.icon} size={14} color={m.color} />
                  <View style={styles.listRowInfo}>
                    <Text style={styles.listRowText}>{ev.nome}</Text>
                    <Text style={styles.listRowDate}>
                      {formatDateBR(ev.data_ini)}{ev.data_fim ? ` → ${formatDateBR(ev.data_fim)}` : ''}
                    </Text>
                    {ev.obs ? <Text style={styles.listRowObs}>{ev.obs}</Text> : null}
                  </View>
                  <TouchableOpacity
                    onPress={() => router.push({ pathname: '/escala-evento-form', params: { id: ev.id } })}
                    hitSlop={10}
                  >
                    <Ionicons name="pencil-outline" size={14} color={colors.mutedDim} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => confirmarRemocao('Remover evento?', ev.nome, () => deleteEvento(ev.id))}
                    hitSlop={10}
                    style={{ marginLeft: 6 }}
                    accessibilityLabel={`Remover ${ev.nome}`}
                  >
                    <Ionicons name="trash-outline" size={14} color={colors.mutedDim} />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}

      </ScrollView>

      {/* ── Bottom sheet com detalhe do dia ── */}
      <DayBottomSheet
        day={selectedDay}
        onClose={() => setSelectedDay(null)}
        onAddEvento={(iso) => router.push({ pathname: '/escala-evento-form', params: { data: iso } })}
        onEditEvento={(ev) => router.push({ pathname: '/escala-evento-form', params: { id: ev.id } })}
        onDeleteEvento={deleteEvento}
      />
    </OWBackground>
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

function LegendItem({ color, label, dot, tag, icon }: { color: string; label: string; dot?: boolean; tag?: string; icon?: IoniconsName }) {
  return (
    <View style={styles.legendItem}>
      {tag
        ? <View style={[styles.legendTag, { backgroundColor: color }]}><Text style={styles.transitionTagText}>{tag}</Text></View>
        : icon
          ? <Ionicons name={icon} size={13} color={color} />
          : dot
            ? <View style={[styles.dot, { backgroundColor: color }]} />
            : <View style={[styles.legendSwatch, { backgroundColor: color }]} />
      }
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: spacing.md, paddingBottom: spacing.xxl + spacing.lg },

  setupRoot: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: surface.bg, padding: spacing.xl, gap: spacing.md },
  setupTitle: { ...typography.h1, textAlign: 'center' },
  setupSub: { ...typography.body, textAlign: 'center', color: colors.muted },
  setupBtn: { backgroundColor: colors.cyan, borderRadius: radius.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, marginTop: spacing.sm },
  setupBtnText: { fontWeight: '700', fontSize: 16, color: colors.navy950 },

  heroCard: {
    backgroundColor: surface.card, borderRadius: radius.lg, padding: spacing.md,
    marginBottom: spacing.md, borderWidth: 1, gap: spacing.sm,
  },
  heroRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm },
  heroLeft: { flex: 1, minWidth: 0 },
  heroLabel: { fontSize: 11, fontWeight: '700', color: colors.mutedDim, letterSpacing: 1 },
  heroValue: { fontSize: 18, fontWeight: '700', color: colors.white, marginTop: 2 },
  heroDate: { fontSize: 12, color: colors.mutedDim, marginTop: 2 },
  heroRight: { alignItems: 'flex-end', maxWidth: 104 },
  heroCountdown: { fontSize: 28, fontWeight: '700', color: '#4caf50' },
  heroCountdownLabel: { fontSize: 11, color: colors.mutedDim, marginTop: -2, textAlign: 'right' },
  heroBadge: { fontSize: 12, color: colors.cyanDim, fontWeight: '600' },
  progressBar: { height: 6, backgroundColor: colors.navy800, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#4caf50', borderRadius: 3 },
  auditLine: { fontSize: 11, color: colors.mutedDim, marginTop: -spacing.sm, marginBottom: spacing.md, paddingHorizontal: 2 },

  actionRow: {
    flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md,
    backgroundColor: surface.card, borderRadius: radius.md, padding: spacing.sm,
    borderWidth: 1, borderColor: colors.line,
  },
  actionBtn: { alignItems: 'center', gap: 3, flex: 1, minHeight: 44, justifyContent: 'center' },
  actionLabel: { fontSize: 12, color: colors.muted, fontWeight: '600' },

  calHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  calTitle: { fontSize: 16, fontWeight: '700', color: colors.white },

  weekRow: { flexDirection: 'row', justifyContent: 'center', columnGap: CELL_GAP, marginBottom: CELL_GAP },
  dayHeaderCell: { alignItems: 'center', justifyContent: 'center', paddingVertical: 4 },
  dayHeaderText: { fontSize: 11, fontWeight: '600', color: colors.mutedDim },
  dayCell: { alignItems: 'center', justifyContent: 'center', borderRadius: 4, borderWidth: 1, overflow: 'hidden' },
  calendar: { marginBottom: spacing.md },
  dayNum: { fontSize: 15, fontWeight: '700', lineHeight: 18 },
  iconRow: { flexDirection: 'row', gap: 2, marginTop: 1, height: 12, alignItems: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3 },
  maisEventos: { fontSize: 10, fontWeight: '800', color: colors.muted, lineHeight: 12 },
  hojeRing: { borderWidth: 2, borderColor: colors.white, borderRadius: 11, paddingHorizontal: 3, alignItems: 'center', justifyContent: 'center' },
  transitionTag: { borderRadius: 3, paddingHorizontal: 3, height: 12, justifyContent: 'center', marginBottom: 1 },
  transitionTagText: { fontSize: 9, lineHeight: 11, fontWeight: '800', color: colors.navy950, letterSpacing: 0.3 },
  transitionSpacer: { height: 13 },

  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.md, rowGap: spacing.sm, marginBottom: spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendSwatch: { width: 12, height: 12, borderRadius: 3 },
  legendLabel: { fontSize: 12, color: colors.muted },
  legendTag: { borderRadius: 3, paddingHorizontal: 3, height: 13, justifyContent: 'center' },

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

  // Bottom sheet
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheetContainer: {
    backgroundColor: '#071e2e', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: spacing.md, paddingBottom: spacing.xl,
    borderTopWidth: 1, borderColor: maritime.glassBorder,
    maxHeight: '70%',
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line, alignSelf: 'center', marginBottom: spacing.md },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.sm },
  sheetDate: { fontSize: 18, fontWeight: '700', color: colors.white, marginBottom: 6 },
  kindPill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start' },
  kindDot: { width: 8, height: 8, borderRadius: 4 },
  kindText: { fontSize: 13, fontWeight: '600' },
  addEventoBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.cyan, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 6 },
  addEventoBtnText: { fontSize: 12, fontWeight: '700', color: colors.navy950 },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.lineSoft },
  sheetRowText: { fontSize: 13, color: colors.white, flex: 1 },
  sheetRowSub: { fontSize: 11, color: colors.mutedDim },
  sheetEmpty: { fontSize: 13, color: colors.mutedDim, textAlign: 'center', paddingVertical: spacing.sm },
});
