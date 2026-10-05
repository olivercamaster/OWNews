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
import type { DataPessoal } from '@owbuddy/domain';
import { getDatasPessoais, setDatasPessoais } from '../src/storage';
import { colors, spacing, radius, typography, surface } from '../src/theme';
import { maskDateBR, parseDateBR } from '../src/format';

function gerarId(): string {
  return `dp_${Date.now()}`;
}

export default function EscalaDataForm() {
  const params = useLocalSearchParams<{ id?: string; nome?: string; start?: string; end?: string }>();
  const isEdit = !!params.id;
  const [nome, setNome] = useState(params.nome ?? '');
  const [startDate, setStartDate] = useState(params.start ? maskDateBR(params.start.replace(/-/g, '')) : '');
  const [endDate, setEndDate] = useState(params.end ? maskDateBR(params.end.replace(/-/g, '')) : '');
  const [erro, setErro] = useState('');

  const save = async () => {
    if (!nome.trim()) { setErro('Informe um nome para a data.'); return; }
    const startISO = parseDateBR(startDate);
    if (!startISO) { setErro('Data inicial inválida. Use DD/MM/AAAA.'); return; }
    const endISO = endDate ? parseDateBR(endDate) : undefined;
    if (endDate && !endISO) { setErro('Data final inválida. Use DD/MM/AAAA.'); return; }

    const datas = await getDatasPessoais();
    const dp: DataPessoal = {
      id: params.id ?? gerarId(),
      nome: nome.trim(),
      start_date: startISO,
      end_date: endISO,
    };
    const updated = [...datas.filter(d => d.id !== dp.id), dp];
    await setDatasPessoais(updated);
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

        <Text style={styles.sectionLabel}>Data (DD/MM/AAAA)</Text>
        <TextInput
          style={styles.input}
          value={startDate}
          onChangeText={v => { setStartDate(maskDateBR(v)); setErro(''); }}
          keyboardType="numeric"
          placeholder="15/12/2026"
          placeholderTextColor={colors.mutedDim}
          maxLength={10}
        />

        <Text style={styles.sectionLabel}>Data fim (opcional, DD/MM/AAAA)</Text>
        <TextInput
          style={styles.input}
          value={endDate}
          onChangeText={v => { setEndDate(maskDateBR(v)); setErro(''); }}
          keyboardType="numeric"
          placeholder="Deixar vazio = evento de um dia"
          placeholderTextColor={colors.mutedDim}
          maxLength={10}
        />

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
