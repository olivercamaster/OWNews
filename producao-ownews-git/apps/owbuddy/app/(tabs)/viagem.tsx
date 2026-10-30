import { useCallback, useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { TIPO_LABELS, TIPO_ICONS, getViagemRota, hojeISO } from '@owbuddy/domain';
import { abrirNoMapa } from '../../src/mapa';
import { ondePrecisoEstar, type LocalMapa } from '../../src/onde-estar';
import type { Viagem, ViagemTipo } from '@owbuddy/domain';
import { getViagem, setViagem, deleteViagem } from '../../src/storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { bottomNavSpace, colors, maritime, spacing, radius, typography, themed, tokens } from '../../src/theme';
import { useTema } from '../../src/tema';
import { OWBackground } from '../../src/components/OWBackground';
import { confirmarRemocao } from '../../src/confirmar';
import { destinoDaViagem, link99, linkUber } from '../../src/transporte';
import { OWCard } from '../../src/components/OWCard';
import { OWEmptyState } from '../../src/components/OWEmptyState';
import { OWDatePicker } from '../../src/components/OWDatePicker';
import { OWTimePicker, normalizeHora } from '../../src/components/OWTimePicker';
import { formatDateBR } from '../../src/format';
import { analytics } from '../../src/analytics';
import { avisar } from '../../src/feedback';
import { useAcaoUnica, useVoltarAndroid } from '../../src/acoes';
import { ContatosEmbarque } from '../../src/components/ContatosEmbarque';

const TIPOS: ViagemTipo[] = ['AVIAO', 'ONIBUS', 'CARRO', 'VAN', 'EMPRESA', 'OUTRO'];

// Companhias aéreas comuns — opção rápida + livre
const COMPANHIAS_RAPIDAS = ['LATAM', 'GOL', 'Azul'];

/** Normaliza número de voo para maiúsculas */
function normalizeVoo(v: string): string {
  return v.toUpperCase().replace(/\s+/g, '');
}

function MinhaViagemConteudo() {
  useTema();
  const insetsTela = useSafeAreaInsets();
  const [viagem, setViagemState] = useState<Viagem | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<Viagem>>({ tipo: 'AVIAO' });
  const [erro, setErro] = useState<string | null>(null);
  useVoltarAndroid(editing, () => setEditing(false));

  const load = useCallback(async () => {
    const v = await getViagem();
    // Normaliza hora legada ao carregar
    if (v?.hora) v.hora = normalizeHora(v.hora);
    setViagemState(v);
  }, []);

  useFocusEffect(useCallback(() => {
    analytics.screen('minha_viagem');
    load();
  }, [load]));

  const startNew = () => {
    setForm({ tipo: 'AVIAO' });
    setErro(null);
    setEditing(true);
  };

  const startEdit = () => {
    if (viagem) {
      setForm({ ...viagem });
      setErro(null);
      setEditing(true);
    }
  };

  const [save, salvando] = useAcaoUnica(async () => {
    if (!form.tipo) { setErro('Escolha o tipo de transporte.'); return; }
    if (!form.data) { setErro('Escolha a data da viagem.'); return; }
    const v: Viagem = {
      ...(form as Viagem),
      tipo: form.tipo as ViagemTipo,
      data: form.data,
      num_voo: form.num_voo ? normalizeVoo(form.num_voo) : undefined,
    };
    const nova = !viagem;
    await setViagem(v);
    setViagemState(v);
    setEditing(false);
    analytics.track(nova ? 'trip_created' : 'trip_updated', { tipo: form.tipo });
    avisar(nova ? 'Viagem salva' : 'Viagem atualizada');
  });

  // confirmarRemocao: Alert nativo; no navegador, window.confirm (Alert com botões não existe na web).
  const del = () => {
    confirmarRemocao('Excluir esta viagem?', 'Os dados da viagem saem deste aparelho. Seus contatos continuam salvos.', async () => {
      await deleteViagem();
      setViagemState(null);
      setEditing(false);
      analytics.track('trip_deleted');
      avisar('Viagem excluída');
    });
  };

  if (editing) {
    return (
      <OWBackground>
        <ViagemForm
          form={form}
          erro={erro}
          salvando={salvando}
          novo={!viagem}
          onChange={f => { setForm(f); if (erro) setErro(null); }}
          onSave={save}
          onCancel={() => setEditing(false)}
        />
      </OWBackground>
    );
  }

  if (!viagem) {
    return (
      <OWBackground>
        <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingTop: insetsTela.top + spacing.lg, paddingBottom: bottomNavSpace(insetsTela.bottom) }]}>
          <OWEmptyState
            icon="airplane-outline"
            title="Nenhuma viagem cadastrada"
            description="Voo, ônibus, van ou carro até a base. No dia, eu mostro na Home onde você precisa estar. Fica só neste aparelho."
            actionLabel="+ Adicionar viagem"
            onAction={startNew}
          />
          <ContatosEmbarque />
        </ScrollView>
      </OWBackground>
    );
  }

  const rota = getViagemRota(viagem);
  const mapa = localDaViagem(viagem);
  const horaDisplay = viagem.hora ? normalizeHora(viagem.hora) : null;

  return (
    <OWBackground>
      <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: bottomNavSpace(insetsTela.bottom) }]}>
        {/* Hero da viagem */}
        <View style={styles.heroSection}>
          <Text style={styles.heroTipo}>
            {TIPO_ICONS[viagem.tipo]} {TIPO_LABELS[viagem.tipo] ?? viagem.tipo}
          </Text>
          <Text style={styles.heroData}>
            {formatDateBR(viagem.data)}
            {horaDisplay ? <Text style={styles.heroHora}> · {horaDisplay}</Text> : null}
          </Text>
          {rota ? <Text style={styles.heroRota}>{rota}</Text> : null}
        </View>

        {/* Detalhes (sem nenhum campo preenchido o card não aparece — era uma caixa vazia) */}
        {viagem.num_voo || viagem.empresa || viagem.localizador || viagem.assento || viagem.poltrona || viagem.ponto || viagem.obs ? (
        <OWCard style={styles.detailCard}>
          {viagem.num_voo ? <DetailRow icon="airplane" label="Voo" value={viagem.num_voo} /> : null}
          {viagem.empresa && (viagem.tipo === 'AVIAO' || viagem.tipo === 'ONIBUS' || viagem.tipo === 'EMPRESA') ? (
            <DetailRow icon="business-outline" label="Empresa" value={viagem.empresa} />
          ) : null}
          {viagem.localizador ? <DetailRow icon="barcode-outline" label="Localizador" value={viagem.localizador} private /> : null}
          {(viagem.assento ?? viagem.poltrona) ? (
            <DetailRow icon="person-outline" label="Assento" value={(viagem.assento ?? viagem.poltrona)!} />
          ) : null}
          {viagem.ponto ? <DetailRow icon="location-outline" label="Ponto" value={viagem.ponto} /> : null}
          {viagem.obs ? <DetailRow icon="document-text-outline" label="Obs." value={viagem.obs} private /> : null}
        </OWCard>
        ) : null}

        <View style={styles.actions}>
          <TouchableOpacity style={styles.editBtn} onPress={startEdit} accessibilityRole="button">
            <Ionicons name="create-outline" size={16} color={colors.white} />
            <Text style={styles.editBtnText}>Editar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.delBtn} onPress={del} accessibilityRole="button">
            <Ionicons name="trash-outline" size={16} color={colors.red} />
            <Text style={styles.delBtnText}>Excluir</Text>
          </TouchableOpacity>
        </View>

        {mapa ? (
          <TouchableOpacity style={styles.mapaBtn} onPress={() => abrirNoMapa(mapa)} accessibilityRole="button">
            <Ionicons name="map-outline" size={16} color={colors.cyanDim} />
            <Text style={styles.mapaTexto} numberOfLines={1}>Abrir no mapa · {mapa.nome}</Text>
          </TouchableOpacity>
        ) : null}

        {/* Transporte terrestre — só encaminha para o app oficial (sem corrida, sem pagamento, sem GPS) */}
        <TransporteTerrestre viagem={viagem} />

        <ContatosEmbarque />

        <View style={styles.privRow}>
          <Ionicons name="lock-closed-outline" size={11} color={colors.mutedDim} />
          <Text style={styles.privNote}>Dados armazenados apenas neste dispositivo</Text>
        </View>
      </ScrollView>
    </OWBackground>
  );
}

/** Lugar do mapa: o mesmo de "Onde preciso estar?" (sem geocodificar). */
function localDaViagem(v: Viagem): LocalMapa | null {
  return ondePrecisoEstar({ ...v, data: hojeISO() }, null)?.mapa ?? null;
}

// ─────────────────────── Transporte terrestre ───────────────────────

function TransporteTerrestre({ viagem }: { viagem: Viagem }) {
  useTema();
  const destino = destinoDaViagem(viagem);
  const abrir = (servico: 'uber' | '99') => {
    const url = servico === 'uber'
      ? linkUber(destino)
      : link99(Platform.OS === 'android' ? 'android' : Platform.OS === 'ios' ? 'ios' : 'web');
    analytics.track('transport_opened', { servico, com_destino: servico === 'uber' && !!destino, origem: 'viagem' });
    Linking.openURL(url).catch(() => {});
  };
  return (
    <OWCard style={styles.transporte}>
      <Text style={styles.transporteTitulo}>Transporte terrestre</Text>
      <Text style={styles.transporteSub}>
        {destino
          ? `Até ${destino.nome}. A origem é a sua localização no próprio app.`
          : viagem.tipo === 'AVIAO'
            ? 'Coloque o aeroporto de partida em "Origem" (ex.: GIG, Santos Dumont) para o Uber já abrir com o destino.'
            : 'Abre o app para você pedir o carro até o ponto de embarque.'}
      </Text>
      <View style={styles.transporteBotoes}>
        <TouchableOpacity style={[styles.transporteBtn, styles.uberBtn]} onPress={() => abrir('uber')} accessibilityRole="button" accessibilityLabel="Abrir na Uber">
          <Text style={styles.uberTexto}>Uber</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.transporteBtn} onPress={() => abrir('99')} accessibilityRole="button" accessibilityLabel="Abrir a 99">
          <Text style={styles.noventaTexto}>99</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.transporteNota}>A 99 não tem link oficial com destino: o app abre e você informa o destino lá. O OWBuddy não pede corrida nem faz pagamento.</Text>
    </OWCard>
  );
}

// ─────────────────────── Detail Row ───────────────────────
type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];
function DetailRow({ icon, label, value, private: priv }: {
  icon: IoniconsName; label: string; value: string; private?: boolean;
}) {
  useTema();
  return (
    <View style={detailStyles.row}>
      <Ionicons name={icon} size={15} color={colors.cyanDim} style={detailStyles.rowIcon} />
      <Text style={detailStyles.label}>{label}</Text>
      <Text style={detailStyles.value}>{priv ? '••••••' : value}</Text>
    </View>
  );
}
const detailStyles = themed(() => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: maritime.glassBorder,
    gap: spacing.sm,
  },
  rowIcon: { width: 18 },
  label: { ...typography.small, flex: 1, color: colors.muted },
  value: { ...typography.small, color: colors.white, fontWeight: '600', maxWidth: '60%', textAlign: 'right' },
}));

// ─────────────────────── Formulário ───────────────────────
function ViagemForm({
  form,
  erro,
  salvando,
  novo,
  onChange,
  onSave,
  onCancel,
}: {
  form: Partial<Viagem>;
  erro: string | null;
  salvando: boolean;
  novo: boolean;
  onChange: (v: Partial<Viagem>) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  useTema();
  const tipo = form.tipo ?? 'AVIAO';
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md, paddingBottom: bottomNavSpace(insets.bottom) }]} keyboardShouldPersistTaps="handled">
        <View style={formStyles.cabecalho}>
          <TouchableOpacity onPress={onCancel} hitSlop={10} accessibilityRole="button" accessibilityLabel="Voltar sem salvar" style={formStyles.voltar}>
            <Ionicons name="chevron-back" size={22} color={colors.white} />
          </TouchableOpacity>
          <Text style={formStyles.titulo}>{novo ? 'Nova viagem' : 'Editar viagem'}</Text>
        </View>

        {/* Tipo */}
        <Text style={formStyles.sectionLabel}>Tipo de transporte</Text>
        <View style={formStyles.tipoGrid}>
          {TIPOS.map(t => (
            <TouchableOpacity
              key={t}
              style={[formStyles.tipoChip, tipo === t && formStyles.tipoChipActive]}
              onPress={() => onChange({ ...form, tipo: t })}
            >
              <Text style={formStyles.tipoEmoji}>{TIPO_ICONS[t]}</Text>
              <Text style={[formStyles.tipoLabel, tipo === t && formStyles.tipoLabelActive]}>
                {TIPO_LABELS[t]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Data + Hora na mesma linha */}
        <Text style={formStyles.sectionLabel}>Data e horário</Text>
        <View style={formStyles.dateTimeRow}>
          <View style={{ flex: 1 }}>
            <Text style={formStyles.fieldLabel}>Data *</Text>
            <TouchableOpacity style={formStyles.horaBtn} onPress={() => setShowDatePicker(true)}>
              <Ionicons name="calendar-outline" size={16} color={colors.cyanDim} />
              <Text style={[formStyles.horaBtnText, !form.data && { color: colors.mutedDim }]}>
                {form.data ? formatDateBR(form.data) : 'Selecionar'}
              </Text>
            </TouchableOpacity>
          </View>
          {/* Botão de hora — abre OWTimePicker */}
          <View style={{ width: 110 }}>
            <Text style={formStyles.fieldLabel}>Hora</Text>
            <TouchableOpacity
              style={formStyles.horaBtn}
              onPress={() => setShowTimePicker(true)}
            >
              <Ionicons name="time-outline" size={16} color={colors.cyanDim} />
              <Text style={[formStyles.horaBtnText, !form.hora && { color: colors.mutedDim }]}>
                {form.hora ? normalizeHora(form.hora) : 'Selecionar'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Companhia aérea com atalhos */}
        {tipo === 'AVIAO' && (
          <>
            <Text style={formStyles.sectionLabel}>Companhia aérea</Text>
            <View style={formStyles.companhiaRow}>
              {COMPANHIAS_RAPIDAS.map(c => (
                <TouchableOpacity
                  key={c}
                  style={[formStyles.compChip, form.empresa === c && formStyles.compChipActive]}
                  onPress={() => onChange({ ...form, empresa: form.empresa === c ? '' : c })}
                >
                  <Text style={[formStyles.compChipText, form.empresa === c && formStyles.compChipTextActive]}>
                    {c}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Field
              label="Outra companhia"
              placeholder="Nome da companhia"
              value={COMPANHIAS_RAPIDAS.includes(form.empresa ?? '') ? '' : (form.empresa ?? '')}
              onChange={v => onChange({ ...form, empresa: v })}
            />
          </>
        )}

        {/* Campos por tipo */}
        {tipo === 'AVIAO' && (
          <>
            <Field
              label="Número do voo"
              placeholder="LA1234"
              value={form.num_voo ?? ''}
              onChange={v => onChange({ ...form, num_voo: normalizeVoo(v) })}
              autoCapitalize="characters"
            />
            <Field
              label="Localizador / código de reserva"
              placeholder="ABC123"
              value={form.localizador ?? ''}
              onChange={v => onChange({ ...form, localizador: v.toUpperCase() })}
              autoCapitalize="characters"
            />
            <View style={formStyles.rowFields}>
              <View style={{ flex: 1 }}>
                <Field
                  label="Aeroporto de saída"
                  placeholder="GRU"
                  value={form.origem ?? ''}
                  onChange={v => onChange({ ...form, origem: v.toUpperCase().slice(0, 4) })}
                  autoCapitalize="characters"
                  maxLength={4}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Field
                  label="Destino"
                  placeholder="MEA"
                  value={form.destino ?? ''}
                  onChange={v => onChange({ ...form, destino: v.toUpperCase().slice(0, 4) })}
                  autoCapitalize="characters"
                  maxLength={4}
                />
              </View>
            </View>
            <Field
              label="Assento"
              placeholder="12A"
              value={form.assento ?? ''}
              onChange={v => onChange({ ...form, assento: v.toUpperCase() })}
            />
          </>
        )}

        {tipo === 'ONIBUS' && (
          <>
            <Field label="Empresa" value={form.empresa ?? ''} onChange={v => onChange({ ...form, empresa: v })} />
            <View style={formStyles.rowFields}>
              <View style={{ flex: 1 }}>
                <Field label="Origem" value={form.origem ?? ''} onChange={v => onChange({ ...form, origem: v })} />
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Destino" value={form.destino ?? ''} onChange={v => onChange({ ...form, destino: v })} />
              </View>
            </View>
            <Field label="Poltrona" value={form.poltrona ?? ''} onChange={v => onChange({ ...form, poltrona: v })} />
          </>
        )}

        {tipo === 'CARRO' && (
          <Field label="Destino" value={form.destino ?? ''} onChange={v => onChange({ ...form, destino: v })} />
        )}

        {(tipo === 'VAN' || tipo === 'EMPRESA') && (
          <>
            <Field label="Ponto de encontro" value={form.ponto ?? ''} onChange={v => onChange({ ...form, ponto: v })} />
            <Field label="Destino" value={form.destino ?? ''} onChange={v => onChange({ ...form, destino: v })} />
          </>
        )}

        <Field
          label="Observação (privada)"
          placeholder="..."
          value={form.obs ?? ''}
          onChange={v => onChange({ ...form, obs: v })}
          multiline
        />

        <View style={styles.privRow}>
          <Ionicons name="lock-closed-outline" size={11} color={colors.mutedDim} />
          <Text style={styles.privNote}>Localizador e observações ficam apenas neste dispositivo</Text>
        </View>

        {erro ? (
          <View style={formStyles.erro} accessibilityRole="alert">
            <Ionicons name="alert-circle-outline" size={16} color={colors.amber} />
            <Text style={formStyles.erroTexto}>{erro}</Text>
          </View>
        ) : null}

        <View style={formStyles.btnRow}>
          <TouchableOpacity style={formStyles.cancelBtn} onPress={onCancel} accessibilityRole="button">
            <Text style={formStyles.cancelText}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[formStyles.saveBtn, salvando && { opacity: 0.6 }]} onPress={onSave} disabled={salvando} accessibilityRole="button">
            <Text style={formStyles.saveText}>{salvando ? 'Salvando…' : 'Salvar viagem'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <OWTimePicker
        visible={showTimePicker}
        value={form.hora}
        onConfirm={(v) => {
          onChange({ ...form, hora: v });
          setShowTimePicker(false);
        }}
        onCancel={() => setShowTimePicker(false)}
      />
      <OWDatePicker
        visible={showDatePicker}
        value={form.data}
        title="Data da viagem"
        onConfirm={(v) => {
          onChange({ ...form, data: v });
          setShowDatePicker(false);
        }}
        onCancel={() => setShowDatePicker(false)}
      />
    </KeyboardAvoidingView>
  );
}

// ─────────────────────── Field ───────────────────────
function Field({ label, placeholder, value, onChange, keyboardType, multiline, autoCapitalize, maxLength }: {
  label: string; placeholder?: string; value: string; onChange: (v: string) => void;
  keyboardType?: any; multiline?: boolean; autoCapitalize?: any; maxLength?: number;
}) {
  useTema();
  return (
    <View style={formStyles.fieldWrap}>
      <Text style={formStyles.fieldLabel}>{label}</Text>
      <TextInput
        style={[formStyles.input, multiline && { height: 80, textAlignVertical: 'top' }]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedDim}
        keyboardType={keyboardType}
        multiline={multiline}
        autoCapitalize={autoCapitalize}
        maxLength={maxLength}
      />
    </View>
  );
}

// ─────────────────────── Styles ───────────────────────
const formStyles = themed(() => StyleSheet.create({
  cabecalho: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  voltar: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginLeft: -spacing.xs },
  titulo: { ...typography.h2 },
  erro: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm },
  erroTexto: { color: colors.amber, fontSize: 13, fontWeight: '600', flex: 1 },
  sectionLabel: { ...typography.micro, color: colors.muted, marginBottom: spacing.sm, marginTop: spacing.md },
  tipoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  tipoChip: {
    flexBasis: '30%', backgroundColor: maritime.glass, borderRadius: radius.md,
    padding: spacing.sm, alignItems: 'center', borderWidth: 1, borderColor: maritime.glassBorder,
  },
  tipoChipActive: { borderColor: colors.cyan, backgroundColor: maritime.glassActive },
  tipoEmoji: { fontSize: 22, marginBottom: 3 },
  tipoLabel: { fontSize: 11, color: colors.muted, textAlign: 'center' },
  tipoLabelActive: { color: colors.cyan, fontWeight: '600' },

  dateTimeRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-end', marginBottom: spacing.xs },
  fieldWrap: { marginBottom: spacing.sm },
  fieldLabel: { ...typography.small, color: colors.muted, marginBottom: 5, fontSize: 12 },
  input: {
    backgroundColor: maritime.field, borderRadius: radius.md, padding: spacing.sm,
    paddingHorizontal: 12, color: colors.white, fontSize: 15, borderWidth: 1, borderColor: maritime.fieldBorder,
  },

  horaBtn: {
    backgroundColor: maritime.field, borderRadius: radius.md, padding: spacing.sm,
    paddingHorizontal: 12, borderWidth: 1, borderColor: maritime.fieldBorder,
    flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44,
  },
  horaBtnText: { color: colors.white, fontSize: 15, fontWeight: '600' },

  companhiaRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  compChip: {
    paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.md,
    borderWidth: 1, borderColor: maritime.glassBorder, backgroundColor: maritime.glass,
  },
  compChipActive: { borderColor: colors.cyan, backgroundColor: maritime.glassActive },
  compChipText: { fontSize: 13, fontWeight: '600', color: colors.muted },
  compChipTextActive: { color: colors.cyan },

  rowFields: { flexDirection: 'row', gap: spacing.sm },

  privNote: { ...typography.small, color: colors.mutedDim, textAlign: 'center' },
  btnRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  cancelBtn: {
    flex: 1, padding: spacing.md, borderRadius: radius.md,
    borderWidth: 1, borderColor: maritime.glassBorder, alignItems: 'center',
  },
  cancelText: { color: colors.muted, fontWeight: '600' },
  saveBtn: { flex: 2, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.cyan, alignItems: 'center', ...maritime.botaoPrimario },
  saveText: { color: colors.onAccent, fontWeight: '700', fontSize: 15 },
}));

const styles = themed(() => StyleSheet.create({
  root: { flex: 1 },
  content: { padding: spacing.md },

  heroSection: { paddingVertical: spacing.lg, paddingHorizontal: spacing.xs },
  heroTipo: { ...typography.micro, color: colors.cyanDim, marginBottom: spacing.xs },
  heroData: { fontSize: 28, fontWeight: '700', color: colors.white, marginBottom: spacing.xs },
  heroHora: { fontSize: 22, fontWeight: '400', color: colors.cyanDim },
  heroRota: { fontSize: 17, color: colors.muted, fontWeight: '500' },

  detailCard: { marginBottom: spacing.md },
  actions: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  editBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    backgroundColor: maritime.glass, borderRadius: radius.md, padding: spacing.md,
    borderWidth: 1, borderColor: maritime.glassBorder,
  },
  editBtnText: { color: colors.white, fontWeight: '600' },
  delBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    backgroundColor: maritime.glass, borderRadius: radius.md, padding: spacing.md,
    borderWidth: 1, borderColor: colors.red + '4d',
  },
  delBtnText: { color: colors.red, fontWeight: '600' },
  privRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: spacing.sm },
  privNote: { ...typography.small, color: colors.mutedDim },
  mapaBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 48,
    backgroundColor: maritime.glass, borderRadius: radius.md, paddingHorizontal: spacing.md,
    borderWidth: 1, borderColor: maritime.glassBorder,
  },
  mapaTexto: { color: colors.cyanDim, fontWeight: '600', flexShrink: 1 },
  transporte: { marginTop: spacing.md, gap: 6 },
  transporteTitulo: { ...typography.micro, color: colors.kicker },
  transporteSub: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  transporteBotoes: { flexDirection: 'row', gap: spacing.sm, marginTop: 4 },
  transporteBtn: {
    flex: 1, minHeight: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: maritime.glassBorder, backgroundColor: maritime.glass,
  },
  uberBtn: { backgroundColor: tokens.brandUberBg, borderColor: tokens.brandUberBorder },
  uberTexto: { fontSize: 16, fontWeight: '800', color: tokens.brandUberText },
  noventaTexto: { fontSize: 16, fontWeight: '800', color: colors.white },
  transporteNota: { fontSize: 11, color: colors.mutedDim, lineHeight: 15 },
}));

/** Minha Viagem é do OWBuddy Free para sempre: sem portão, sem conta, funciona offline. */
export default function MinhaViagem() {
  useTema();
  return <MinhaViagemConteudo />;
}
