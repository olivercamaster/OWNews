import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { DataPessoal } from '@owbuddy/domain';
import { getDatasPessoais, setDatasPessoais } from '../src/storage';
import { OWDatePicker } from '../src/components/OWDatePicker';
import { colors, spacing, radius, typography, surface } from '../src/theme';
import { formatDateBR } from '../src/format';

function gerarId(): string {
  return `dp_${Date.now()}`;
}

export default function EscalaDataForm() {
  const params = useLocalSearchParams<{ id?: string; nome?: string; start?: string; end?: string }>();
  const isEdit = !!params.id;
  const [nome, setNome] = useState(params.nome ?? '');
  const [startDate, setStartDate] = useState(params.start ?? ''); // ISO
  const [endDate, setEndDate] = useState(params.end ?? '');       // ISO
  const [erro, setErro] = useState('');
  const [showPickerStart, setShowPickerStart] = useState(false);
  const [showPickerEnd, setShowPickerEnd] = useState(false);

  const save = async () => {
    if (!nome.trim()) { setErro('Informe um nome para a data.'); return; }
    if (!startDate) { setErro('Selecione a data.'); return; }

    const datas = await getDatasPessoais();
    const dp: DataPessoal = {
      id: params.id ?? gerarId(),
      nome: nome.trim(),
      start_date: startDate,
      end_date: endDate || undefined,
    };
    await setDatasPessoais([...datas.filter(d => d.id !== dp.id), dp]);
    router.replace('/escala');
  };

  const excluir = async () => {
    if (!params.id) return;
    const datas = await getDatasPessoais();
    await setDatasPessoais(datas.filter(d => d.id !== params.id));
    router.replace('/escala');
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.root} contentContainerStyle={styles.content}>
        <Text style={styles.sectionLabel}>Nome / Descrição</Text>
        <TextInput
          style={styles.input}
          value={nome}
          onChangeText={v => { setNome(v); setErro(''); }}
          placeholder="Ex: Aniversário da Ana"
          placeholderTextColor={colors.mutedDim}
          maxLength={60}
        />

        <Text style={styles.sectionLabel}>Data</Text>
        <TouchableOpacity style={styles.dateBtn} onPress={() => setShowPickerStart(true)}>
          <Ionicons name="calendar-outline" size={18} color={colors.cyanDim} />
          <Text style={[styles.dateBtnText, !startDate && { color: colors.mutedDim }]}>
            {startDate ? formatDateBR(startDate) : 'Selecionar'}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.mutedDim} />
        </TouchableOpacity>

        <Text style={styles.sectionLabel}>Data fim (opcional)</Text>
        <TouchableOpacity style={styles.dateBtn} onPress={() => setShowPickerEnd(true)}>
          <Ionicons name="calendar-outline" size={18} color={colors.mutedDim} />
          <Text style={[styles.dateBtnText, !endDate && { color: colors.mutedDim }]}>
            {endDate ? formatDateBR(endDate) : 'Deixar vazio = evento de um dia'}
          </Text>
          {endDate ? (
            <TouchableOpacity onPress={() => setEndDate('')} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={colors.mutedDim} />
            </TouchableOpacity>
          ) : (
            <Ionicons name="chevron-forward" size={16} color={colors.mutedDim} />
          )}
        </TouchableOpacity>

        {erro ? <Text style={styles.erro}>{erro}</Text> : null}

        <TouchableOpacity
          style={[styles.saveBtn, (!nome.trim() || !startDate) && styles.saveBtnDisabled]}
          onPress={save}
          disabled={!nome.trim() || !startDate}
        >
          <Text style={styles.saveBtnText}>Salvar</Text>
        </TouchableOpacity>

        {isEdit && (
          <TouchableOpacity style={styles.deleteBtn} onPress={excluir}>
            <Text style={styles.deleteText}>Excluir data</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
          <Text style={styles.cancelText}>Cancelar</Text>
        </TouchableOpacity>
      </ScrollView>

      <OWDatePicker visible={showPickerStart} value={startDate} title="Data"
        onConfirm={v => { setStartDate(v); setShowPickerStart(false); setErro(''); }}
        onCancel={() => setShowPickerStart(false)} />
      <OWDatePicker visible={showPickerEnd} value={endDate || startDate} title="Data fim (opcional)"
        onConfirm={v => { setEndDate(v); setShowPickerEnd(false); }}
        onCancel={() => setShowPickerEnd(false)} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: surface.bg },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.xs },
  sectionLabel: { ...typography.label, marginTop: spacing.md, marginBottom: 4 },
  input: {
    backgroundColor: surface.card, borderRadius: radius.sm, padding: spacing.sm,
    paddingHorizontal: 12, color: colors.white, fontSize: 15, borderWidth: 1, borderColor: colors.line,
  },
  dateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: surface.card, borderRadius: radius.sm, padding: spacing.sm,
    paddingHorizontal: 12, borderWidth: 1, borderColor: colors.line, minHeight: 48,
  },
  dateBtnText: { flex: 1, fontSize: 15, fontWeight: '500', color: colors.white },
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
