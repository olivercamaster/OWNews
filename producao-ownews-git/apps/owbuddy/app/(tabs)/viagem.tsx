import { useCallback, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
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
import { TIPO_LABELS, TIPO_ICONS, getViagemRota } from '@owbuddy/domain';
import type { Viagem, ViagemTipo } from '@owbuddy/domain';
import { getViagem, setViagem, deleteViagem } from '../../src/storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { bottomNavSpace, colors, maritime, spacing, radius, typography } from '../../src/theme';
import { OWBackground } from '../../src/components/OWBackground';
import { OWCard } from '../../src/components/OWCard';
import { OWEmptyState } from '../../src/components/OWEmptyState';
import { OWTimePicker, normalizeHora } from '../../src/components/OWTimePicker';
import { formatDateBR, maskDateBR, parseDateBR, isValidDateBR } from '../../src/format';
import { analytics } from '../../src/analytics';

const TIPOS: ViagemTipo[] = ['AVIAO', 'ONIBUS', 'CARRO', 'VAN', 'EMPRESA', 'OUTRO'];

// Companhias aéreas comuns — opção rápida + livre
const COMPANHIAS_RAPIDAS = ['LATAM', 'GOL', 'Azul'];

/** Normaliza número de voo para maiúsculas */
function normalizeVoo(v: string): string {
  return v.toUpperCase().replace(/\s+/g, '');
}

export default function MinhaViagem() {
  const [viagem, setViagemState] = useState<Viagem | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<Viagem>>({ tipo: 'AVIAO' });

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
    setEditing(true);
  };

  const startEdit = () => {
    if (viagem) {
      setForm({ ...viagem, data: formatDateBR(viagem.data) || viagem.data });
      setEditing(true);
    }
  };

  const save = async () => {
    if (!form.tipo || !form.data) {
      Alert.alert('Atenção', 'Data e tipo são obrigatórios.');
      return;
    }
    if (!isValidDateBR(form.data)) {
      Alert.alert('Data inválida', 'Use o formato DD/MM/AAAA (ex: 12/10/2026).');
      return;
    }
    const isoData = parseDateBR(form.data) ?? form.data;
    const v: Viagem = {
      ...(form as Viagem),
      tipo: form.tipo as ViagemTipo,
      data: isoData,
      // Garante maiúsculas no voo
      num_voo: form.num_voo ? normalizeVoo(form.num_voo) : undefined,
    };
    await setViagem(v);
    setViagemState(v);
    setEditing(false);
    analytics.track('trip_created', { tipo: form.tipo });
  };

  const del = () => {
    Alert.alert('Remover viagem', 'Remover os dados desta viagem?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          await deleteViagem();
          setViagemState(null);
          setEditing(false);
        },
      },
    ]);
  };

  if (editing) {
    return (
      <OWBackground>
        <ViagemForm
          form={form}
          onChange={setForm}
          onSave={save}
          onCancel={() => setEditing(false)}
        />
      </OWBackground>
    );
  }

  if (!viagem) {
    return (
      <OWBackground>
        <View style={styles.root}>
          <OWEmptyState
            icon="airplane-outline"
            title="Sem viagem cadastrada"
            description="Registre sua viagem de embarque aqui. Fica só neste aparelho."
            actionLabel="+ Adicionar viagem"
            onAction={startNew}
          />
        </View>
      </OWBackground>
    );
  }

  const rota = getViagemRota(viagem);
  const horaDisplay = viagem.hora ? normalizeHora(viagem.hora) : null;

  return (
    <OWBackground>
      <ScrollView style={styles.root} contentContainerStyle={styles.content}>
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

        {/* Detalhes */}
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

        <View style={styles.actions}>
          <TouchableOpacity style={styles.editBtn} onPress={startEdit}>
            <Ionicons name="pencil-outline" size={16} color={colors.white} />
            <Text style={styles.editBtnText}>Editar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.delBtn} onPress={del}>
            <Ionicons name="trash-outline" size={16} color={colors.red} />
            <Text style={styles.delBtnText}>Remover</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.privRow}>
          <Ionicons name="lock-closed-outline" size={11} color={colors.mutedDim} />
          <Text style={styles.privNote}>Dados armazenados apenas neste dispositivo</Text>
        </View>
      </ScrollView>
    </OWBackground>
  );
}

// ─────────────────────── Detail Row ───────────────────────
type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];
function DetailRow({ icon, label, value, private: priv }: {
  icon: IoniconsName; label: string; value: string; private?: boolean;
}) {
  return (
    <View style={detailStyles.row}>
      <Ionicons name={icon} size={15} color={colors.cyanDim} style={detailStyles.rowIcon} />
      <Text style={detailStyles.label}>{label}</Text>
      <Text style={detailStyles.value}>{priv ? '••••••' : value}</Text>
    </View>
  );
}
const detailStyles = StyleSheet.create({
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
});

// ─────────────────────── Formulário ───────────────────────
function ViagemForm({
  form,
  onChange,
  onSave,
  onCancel,
}: {
  form: Partial<Viagem>;
  onChange: (v: Partial<Viagem>) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const tipo = form.tipo ?? 'AVIAO';
  const [showTimePicker, setShowTimePicker] = useState(false);
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: bottomNavSpace(insets.bottom) }]}>

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
            <Field
              label="Data *"
              placeholder="DD/MM/AAAA"
              value={maskDateBR(form.data ?? '')}
              onChange={v => onChange({ ...form, data: maskDateBR(v) })}
              keyboardType="numeric"
              maxLength={10}
            />
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
                  label="Origem"
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
                  placeholder="MAO"
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

        <View style={formStyles.btnRow}>
          <TouchableOpacity style={formStyles.cancelBtn} onPress={onCancel}>
            <Text style={formStyles.cancelText}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={formStyles.saveBtn} onPress={onSave}>
            <Text style={formStyles.saveText}>Salvar viagem</Text>
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
    </KeyboardAvoidingView>
  );
}

// ─────────────────────── Field ───────────────────────
function Field({ label, placeholder, value, onChange, keyboardType, multiline, autoCapitalize, maxLength }: {
  label: string; placeholder?: string; value: string; onChange: (v: string) => void;
  keyboardType?: any; multiline?: boolean; autoCapitalize?: any; maxLength?: number;
}) {
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
const formStyles = StyleSheet.create({
  sectionLabel: { ...typography.micro, color: colors.cyanDim, marginBottom: spacing.sm, marginTop: spacing.md },
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
    backgroundColor: maritime.glass, borderRadius: radius.md, padding: spacing.sm,
    paddingHorizontal: 12, color: colors.white, fontSize: 15, borderWidth: 1, borderColor: maritime.glassBorder,
  },

  horaBtn: {
    backgroundColor: maritime.glass, borderRadius: radius.md, padding: spacing.sm,
    paddingHorizontal: 12, borderWidth: 1, borderColor: maritime.glassBorder,
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
  saveBtn: { flex: 2, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.cyan, alignItems: 'center' },
  saveText: { color: colors.navy950, fontWeight: '700', fontSize: 15 },
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: spacing.md },

  heroSection: { paddingVertical: spacing.lg, paddingHorizontal: spacing.xs },
  heroTipo: { ...typography.micro, color: colors.cyanDim, marginBottom: spacing.xs },
  heroData: { fontSize: 32, fontWeight: '700', color: colors.white, marginBottom: spacing.xs },
  heroHora: { fontSize: 24, fontWeight: '400', color: colors.cyanDim },
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
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
  },
  delBtnText: { color: colors.red, fontWeight: '600' },
  privRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: spacing.sm },
  privNote: { ...typography.small, color: colors.mutedDim },
});
