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
import { TIPO_LABELS, TIPO_ICONS, getViagemRota } from '@owbuddy/domain';
import type { Viagem, ViagemTipo } from '@owbuddy/domain';
import { getViagem, setViagem, deleteViagem } from '../../src/storage';
import { colors, spacing, radius, typography } from '../../src/theme';

const TIPOS: ViagemTipo[] = ['AVIAO', 'ONIBUS', 'CARRO', 'VAN', 'EMPRESA', 'OUTRO'];

export default function MinhaViagem() {
  const [viagem, setViagemState] = useState<Viagem | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<Viagem>>({ tipo: 'AVIAO' });

  const load = useCallback(async () => {
    const v = await getViagem();
    setViagemState(v);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const startNew = () => {
    setForm({ tipo: 'AVIAO' });
    setEditing(true);
  };

  const startEdit = () => {
    if (viagem) { setForm(viagem); setEditing(true); }
  };

  const save = async () => {
    if (!form.tipo || !form.data) {
      Alert.alert('Atenção', 'Data e tipo são obrigatórios.');
      return;
    }
    const v: Viagem = { ...(form as Viagem), tipo: form.tipo as ViagemTipo };
    await setViagem(v);
    setViagemState(v);
    setEditing(false);
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

  if (editing) return (
    <ViagemForm
      form={form}
      onChange={setForm}
      onSave={save}
      onCancel={() => { setEditing(false); }}
    />
  );

  if (!viagem) return (
    <View style={styles.root}>
      <View style={styles.empty}>
        <Text style={styles.emptyIcon}>✈️</Text>
        <Text style={styles.emptyTitle}>Sem viagem cadastrada</Text>
        <Text style={styles.emptySub}>Registre sua viagem de embarque aqui. Fica só aqui, não vai a lugar nenhum.</Text>
        <TouchableOpacity style={styles.addBtn} onPress={startNew}>
          <Text style={styles.addBtnText}>+ Adicionar viagem</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const rota = getViagemRota(viagem);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.cardTipo}>
          {TIPO_ICONS[viagem.tipo]} {TIPO_LABELS[viagem.tipo] ?? viagem.tipo}
        </Text>
        <Text style={styles.cardData}>
          {viagem.data}{viagem.hora ? `  ·  ${viagem.hora}` : ''}
        </Text>
        {rota ? <Text style={styles.cardRota}>{rota}</Text> : null}
        {viagem.num_voo ? <FieldRow label="Voo" value={viagem.num_voo} /> : null}
        {viagem.localizador ? <FieldRow label="Localizador" value={viagem.localizador} /> : null}
        {viagem.assento ?? viagem.poltrona
          ? <FieldRow label="Assento" value={(viagem.assento ?? viagem.poltrona)!} />
          : null}
        {viagem.empresa && viagem.tipo !== 'AVIAO'
          ? <FieldRow label="Empresa" value={viagem.empresa} />
          : null}
        {viagem.ponto ? <FieldRow label="Ponto" value={viagem.ponto} /> : null}
        {viagem.obs ? <FieldRow label="Obs." value={viagem.obs} private /> : null}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.editBtn} onPress={startEdit}>
          <Text style={styles.editBtnText}>Editar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.delBtn} onPress={del}>
          <Text style={styles.delBtnText}>Remover</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.privNote}>🔒 Dados armazenados apenas neste dispositivo</Text>
    </ScrollView>
  );
}

function FieldRow({ label, value, private: priv }: { label: string; value: string; private?: boolean }) {
  return (
    <View style={fieldStyles.row}>
      <Text style={fieldStyles.label}>{label}</Text>
      <Text style={fieldStyles.value}>{priv ? '••••••' : value}</Text>
    </View>
  );
}
const fieldStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.lineSoft },
  label: { ...typography.small },
  value: { ...typography.small, color: colors.white, fontWeight: '500' },
});

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

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: 120 }]}>
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

        {/* Data / hora */}
        <Field label="Data *" placeholder="AAAA-MM-DD" value={form.data ?? ''} onChange={v => onChange({ ...form, data: v })} keyboardType="numeric" />
        <Field label="Hora" placeholder="HH:MM" value={form.hora ?? ''} onChange={v => onChange({ ...form, hora: v })} keyboardType="numeric" />

        {/* Avião */}
        {tipo === 'AVIAO' && (<>
          <Field label="Companhia aérea" placeholder="LATAM, Gol, Azul..." value={form.empresa ?? ''} onChange={v => onChange({ ...form, empresa: v })} />
          <Field label="Número do voo" placeholder="LA1234" value={form.num_voo ?? ''} onChange={v => onChange({ ...form, num_voo: v })} />
          <Field label="Localizador / código de reserva" placeholder="ABC123" value={form.localizador ?? ''} onChange={v => onChange({ ...form, localizador: v })} />
          <Field label="Origem" placeholder="GRU, GIG, MCP..." value={form.origem ?? ''} onChange={v => onChange({ ...form, origem: v })} autoCapitalize="characters" />
          <Field label="Destino" placeholder="MAO, MCZ..." value={form.destino ?? ''} onChange={v => onChange({ ...form, destino: v })} autoCapitalize="characters" />
          <Field label="Assento" placeholder="12A" value={form.assento ?? ''} onChange={v => onChange({ ...form, assento: v })} />
        </>)}

        {/* Ônibus */}
        {tipo === 'ONIBUS' && (<>
          <Field label="Empresa" value={form.empresa ?? ''} onChange={v => onChange({ ...form, empresa: v })} />
          <Field label="Origem" value={form.origem ?? ''} onChange={v => onChange({ ...form, origem: v })} />
          <Field label="Destino" value={form.destino ?? ''} onChange={v => onChange({ ...form, destino: v })} />
          <Field label="Poltrona" value={form.poltrona ?? ''} onChange={v => onChange({ ...form, poltrona: v })} />
        </>)}

        {/* Carro */}
        {tipo === 'CARRO' && (
          <Field label="Destino" value={form.destino ?? ''} onChange={v => onChange({ ...form, destino: v })} />
        )}

        {/* Van / Empresa */}
        {(tipo === 'VAN' || tipo === 'EMPRESA') && (<>
          <Field label="Ponto de encontro" value={form.ponto ?? ''} onChange={v => onChange({ ...form, ponto: v })} />
          <Field label="Destino" value={form.destino ?? ''} onChange={v => onChange({ ...form, destino: v })} />
        </>)}

        <Field label="Observação (privada)" placeholder="..." value={form.obs ?? ''} onChange={v => onChange({ ...form, obs: v })} multiline />

        <Text style={formStyles.privNote}>🔒 Localizador e observações ficam apenas neste dispositivo</Text>

        <View style={formStyles.btnRow}>
          <TouchableOpacity style={formStyles.cancelBtn} onPress={onCancel}>
            <Text style={formStyles.cancelText}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={formStyles.saveBtn} onPress={onSave}>
            <Text style={formStyles.saveText}>Salvar viagem</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, placeholder, value, onChange, keyboardType, multiline, autoCapitalize }: {
  label: string; placeholder?: string; value: string; onChange: (v: string) => void;
  keyboardType?: any; multiline?: boolean; autoCapitalize?: any;
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
      />
    </View>
  );
}

const formStyles = StyleSheet.create({
  sectionLabel: { ...typography.micro, marginBottom: spacing.sm },
  tipoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  tipoChip: { flexBasis: '30%', backgroundColor: colors.navy800, borderRadius: radius.sm, padding: spacing.sm, alignItems: 'center', borderWidth: 1, borderColor: colors.line },
  tipoChipActive: { borderColor: colors.cyan, backgroundColor: colors.navy700 },
  tipoEmoji: { fontSize: 22, marginBottom: 3 },
  tipoLabel: { fontSize: 11, color: colors.muted, textAlign: 'center' },
  tipoLabelActive: { color: colors.cyan },
  fieldWrap: { marginBottom: spacing.sm },
  fieldLabel: { ...typography.small, marginBottom: 4 },
  input: { backgroundColor: colors.navy800, borderRadius: radius.sm, padding: spacing.sm, paddingHorizontal: 12, color: colors.white, fontSize: 15, borderWidth: 1, borderColor: colors.line },
  privNote: { ...typography.small, color: colors.mutedDim, textAlign: 'center', marginVertical: spacing.md },
  btnRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  cancelBtn: { flex: 1, padding: spacing.md, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, alignItems: 'center' },
  cancelText: { color: colors.muted, fontWeight: '600' },
  saveBtn: { flex: 2, padding: spacing.md, borderRadius: radius.sm, backgroundColor: colors.cyan, alignItems: 'center' },
  saveText: { color: colors.navy950, fontWeight: '700' },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.navy950 },
  content: { padding: spacing.md },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emptyIcon: { fontSize: 48, marginBottom: spacing.md },
  emptyTitle: { ...typography.h2, marginBottom: spacing.sm },
  emptySub: { ...typography.small, textAlign: 'center', lineHeight: 20, marginBottom: spacing.lg },
  addBtn: { backgroundColor: colors.cyan, borderRadius: radius.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  addBtnText: { color: colors.navy950, fontWeight: '700' },
  card: { backgroundColor: colors.navy800, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  cardTipo: { ...typography.label, marginBottom: spacing.xs },
  cardData: { fontSize: 22, fontWeight: '700', color: colors.white, marginBottom: spacing.xs },
  cardRota: { ...typography.body, color: colors.cyanDim, marginBottom: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  editBtn: { flex: 1, backgroundColor: colors.navy800, borderRadius: radius.sm, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: colors.line },
  editBtnText: { color: colors.white, fontWeight: '600' },
  delBtn: { flex: 1, backgroundColor: colors.navy800, borderRadius: radius.sm, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: colors.red + '55' },
  delBtnText: { color: colors.red, fontWeight: '600' },
  privNote: { ...typography.small, color: colors.mutedDim, textAlign: 'center', marginTop: spacing.lg },
});
