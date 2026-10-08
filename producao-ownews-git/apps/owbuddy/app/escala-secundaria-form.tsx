import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ESCALA_TIPOS } from '@owbuddy/domain';
import type { EscalaSecundaria, EscalaTipo, TipoRef } from '@owbuddy/domain';
import { getEscalasCruzar, setEscalasCruzar } from '../src/storage';
import { OWDatePicker } from '../src/components/OWDatePicker';
import { colors, spacing, radius, typography, surface } from '../src/theme';
import { formatDateBR } from '../src/format';

const TIPOS = ESCALA_TIPOS;

const IC_OPTS = ['❤️', '🤜🤛', '🤝', '👥', '⚓', '🔗', '⭐', '🛳️'];

type RelacaoChip = { label: string; icon: string; value: string };
const RELACAO_OPTS: RelacaoChip[] = [
  { label: 'Companheira/o', icon: '❤️',   value: 'Companheira/o' },
  { label: 'Irmão/ã',       icon: '🤜🤛', value: 'Irmão/ã' },
  { label: 'Amigo/a',       icon: '🤝',   value: 'Amigo/a' },
  { label: 'Familiar',      icon: '👥',   value: 'Familiar' },
  { label: 'Colega',        icon: '⚓',   value: 'Colega' },
  { label: 'Outro',         icon: '🔗',   value: 'Outro' },
];

function gerarId(): string {
  return `sec_${Date.now()}`;
}

export default function EscalaSecundariaForm() {
  const params = useLocalSearchParams<{ id?: string }>();
  const isEdit = !!params.id;

  const [nome, setNome] = useState('');
  const [relacaoChip, setRelacaoChip] = useState('');
  const [relacaoCustom, setRelacaoCustom] = useState('');
  const [icon, setIcon] = useState('❤️');
  const [tipo, setTipo] = useState<EscalaTipo>('14x14');
  const [diasEmb, setDiasEmb] = useState('');
  const [diasFolga, setDiasFolga] = useState('');
  const [dataRef, setDataRef] = useState(''); // ISO YYYY-MM-DD
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tipoRef, setTipoRef] = useState<TipoRef>('embarquei');
  const [erro, setErro] = useState('');

  const isCustom = tipo === 'custom';
  const isOutro = relacaoChip === 'Outro';

  const onSelectRelacao = (opt: RelacaoChip) => {
    setRelacaoChip(opt.value);
    setIcon(opt.icon);
  };

  const relacaoFinal = (): string | undefined => {
    if (!relacaoChip) return undefined;
    if (isOutro) return relacaoCustom.trim() || undefined;
    return relacaoChip;
  };

  const save = async () => {
    if (!nome.trim()) { setErro('Informe o nome da pessoa.'); return; }
    if (!dataRef) { setErro('Selecione a data de referência.'); return; }

    const escalas = await getEscalasCruzar();
    const sec: EscalaSecundaria = {
      id: params.id ?? gerarId(),
      nome: nome.trim(),
      relacao: relacaoFinal(),
      icon,
      tipo,
      diasEmbarcado: isCustom ? (parseInt(diasEmb, 10) || undefined) : undefined,
      diasFolga: isCustom ? (parseInt(diasFolga, 10) || undefined) : undefined,
      dataRef,
      tipoRef,
    };
    await setEscalasCruzar([...escalas.filter(s => s.id !== sec.id), sec]);
    router.replace('/escala-cruzar');
  };

  const excluir = async () => {
    if (!params.id) return;
    const escalas = await getEscalasCruzar();
    await setEscalasCruzar(escalas.filter(s => s.id !== params.id));
    router.replace('/escala-cruzar');
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.root} contentContainerStyle={styles.content}>

        <Text style={styles.sectionLabel}>Nome</Text>
        <TextInput
          style={styles.input}
          value={nome}
          onChangeText={v => { setNome(v); setErro(''); }}
          placeholder="Ex: Ana"
          placeholderTextColor={colors.mutedDim}
          maxLength={50}
        />

        <Text style={styles.sectionLabel}>Relação (opcional)</Text>
        <View style={styles.tipoGrid}>
          {RELACAO_OPTS.map(opt => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.tipoChip, relacaoChip === opt.value && styles.tipoChipActive]}
              onPress={() => onSelectRelacao(opt)}
            >
              <Text style={styles.chipEmoji}>{opt.icon}</Text>
              <Text style={[styles.tipoLabel, relacaoChip === opt.value && styles.tipoLabelActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {isOutro && (
          <TextInput
            style={[styles.input, { marginTop: 4 }]}
            value={relacaoCustom}
            onChangeText={setRelacaoCustom}
            placeholder="Ex: Padrinho, Vizinho..."
            placeholderTextColor={colors.mutedDim}
            maxLength={40}
          />
        )}

        <Text style={styles.sectionLabel}>Ícone</Text>
        <View style={styles.iconRow}>
          {IC_OPTS.map(ic => (
            <TouchableOpacity
              key={ic}
              style={[styles.iconBtn, icon === ic && styles.iconBtnActive]}
              onPress={() => setIcon(ic)}
            >
              <Text style={styles.iconEmoji}>{ic}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Ciclo de trabalho</Text>
        <View style={styles.tipoGrid}>
          {TIPOS.map(t => (
            <TouchableOpacity
              key={t.value}
              style={[styles.tipoChip, tipo === t.value && styles.tipoChipActive]}
              onPress={() => setTipo(t.value)}
            >
              <Text style={[styles.tipoLabel, tipo === t.value && styles.tipoLabelActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {isCustom && (<>
          <Text style={styles.sectionLabel}>Dias embarcado</Text>
          <TextInput
            style={styles.input}
            value={diasEmb}
            onChangeText={setDiasEmb}
            keyboardType="numeric"
            placeholder="Ex: 21"
            placeholderTextColor={colors.mutedDim}
          />
          <Text style={styles.sectionLabel}>Dias de folga</Text>
          <TextInput
            style={styles.input}
            value={diasFolga}
            onChangeText={setDiasFolga}
            keyboardType="numeric"
            placeholder="Ex: 28"
            placeholderTextColor={colors.mutedDim}
          />
        </>)}

        <Text style={styles.sectionLabel}>Data de referência</Text>
        <TouchableOpacity
          style={[styles.input, styles.dateBtn]}
          onPress={() => { setShowDatePicker(true); setErro(''); }}
        >
          <Ionicons name="calendar-outline" size={16} color={colors.cyanDim} />
          <Text style={[styles.dateBtnText, !dataRef && { color: colors.mutedDim }]}>
            {dataRef ? formatDateBR(dataRef) : 'Selecionar data'}
          </Text>
        </TouchableOpacity>

        <Text style={styles.sectionLabel}>Nesta data estava...</Text>
        <View style={styles.refRow}>
          {(['embarquei', 'desembarquei'] as TipoRef[]).map(t => (
            <TouchableOpacity
              key={t}
              style={[styles.refChip, tipoRef === t && styles.refChipActive]}
              onPress={() => setTipoRef(t)}
            >
              <Text style={[styles.refText, tipoRef === t && styles.refTextActive]}>
                {t === 'embarquei' ? 'Embarcando' : 'Desembarcando'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {erro ? <Text style={styles.erro}>{erro}</Text> : null}

        <TouchableOpacity
          style={[styles.saveBtn, (!nome.trim() || !dataRef) && styles.saveBtnDisabled]}
          onPress={save}
          disabled={!nome.trim() || !dataRef}
        >
          <Text style={styles.saveBtnText}>Salvar escala</Text>
        </TouchableOpacity>

        {isEdit && (
          <TouchableOpacity style={styles.deleteBtn} onPress={excluir}>
            <Text style={styles.deleteText}>Excluir escala</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
          <Text style={styles.cancelText}>Cancelar</Text>
        </TouchableOpacity>
      </ScrollView>

      <OWDatePicker
        visible={showDatePicker}
        value={dataRef}
        title="Data de referência"
        onConfirm={v => { setDataRef(v); setShowDatePicker(false); }}
        onCancel={() => setShowDatePicker(false)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: surface.bg },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.xs },
  sectionLabel: { ...typography.label, marginTop: spacing.md, marginBottom: 4 },

  tipoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  tipoChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.line, backgroundColor: surface.card,
  },
  tipoChipActive: { borderColor: colors.cyan, backgroundColor: colors.navy700 },
  chipEmoji: { fontSize: 14 },
  tipoLabel: { fontSize: 13, color: colors.muted, fontWeight: '500' },
  tipoLabelActive: { color: colors.cyan },

  iconRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  iconBtn: {
    width: 44, height: 44, borderRadius: radius.sm, borderWidth: 1,
    borderColor: colors.line, backgroundColor: surface.card,
    alignItems: 'center', justifyContent: 'center',
  },
  iconBtnActive: { borderColor: colors.cyan, backgroundColor: colors.navy700 },
  iconEmoji: { fontSize: 22 },

  refRow: { flexDirection: 'row', gap: spacing.sm },
  refChip: {
    flex: 1, padding: spacing.sm, borderRadius: radius.sm, borderWidth: 1,
    borderColor: colors.line, alignItems: 'center', backgroundColor: surface.card,
  },
  refChipActive: { borderColor: colors.cyan, backgroundColor: colors.navy700 },
  refText: { fontSize: 14, color: colors.muted },
  refTextActive: { color: colors.cyan },

  input: {
    backgroundColor: surface.card, borderRadius: radius.sm, padding: spacing.sm,
    paddingHorizontal: 12, color: colors.white, fontSize: 15, borderWidth: 1, borderColor: colors.line,
  },
  dateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  dateBtnText: { fontSize: 15, color: colors.white, fontWeight: '500', flex: 1 },

  erro: { color: '#f44336', fontSize: 13, marginTop: 4 },
  saveBtn: {
    backgroundColor: colors.cyan, borderRadius: radius.sm, padding: spacing.md,
    alignItems: 'center', marginTop: spacing.md,
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { color: colors.navy950, fontWeight: '700', fontSize: 16 },
  deleteBtn: { padding: spacing.md, alignItems: 'center', marginTop: spacing.sm },
  deleteText: { color: '#f44336', fontSize: 15 },
  cancelBtn: { padding: spacing.md, alignItems: 'center' },
  cancelText: { color: colors.mutedDim, fontSize: 15 },
});
