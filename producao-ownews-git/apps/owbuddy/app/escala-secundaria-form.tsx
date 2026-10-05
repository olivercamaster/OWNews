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
import { ESCALA_TIPOS } from '@owbuddy/domain';
import type { EscalaSecundaria, EscalaTipo, TipoRef } from '@owbuddy/domain';
import { getEscalasCruzar, setEscalasCruzar } from '../src/storage';
import { colors, spacing, radius, typography, surface } from '../src/theme';
import { maskDateBR, parseDateBR } from '../src/format';

const TIPOS = ESCALA_TIPOS;

function gerarId(): string {
  return `sec_${Date.now()}`;
}

export default function EscalaSecundariaForm() {
  const params = useLocalSearchParams<{ id?: string }>();
  const isEdit = !!params.id;
  const [nome, setNome] = useState('');
  const [relacao, setRelacao] = useState('');
  const [tipo, setTipo] = useState<EscalaTipo>('14x14');
  const [diasEmb, setDiasEmb] = useState('');
  const [diasFolga, setDiasFolga] = useState('');
  const [dataRef, setDataRef] = useState('');
  const [tipoRef, setTipoRef] = useState<TipoRef>('embarquei');
  const [erro, setErro] = useState('');

  const isCustom = tipo === 'custom';

  const save = async () => {
    if (!nome.trim()) { setErro('Informe o nome da pessoa.'); return; }
    const dataISO = parseDateBR(dataRef);
    if (!dataISO) { setErro('Data de referência inválida.'); return; }

    const escalas = await getEscalasCruzar();
    const sec: EscalaSecundaria = {
      id: params.id ?? gerarId(),
      nome: nome.trim(),
      relacao: relacao.trim() || undefined,
      tipo,
      diasEmbarcado: isCustom ? (parseInt(diasEmb, 10) || undefined) : undefined,
      diasFolga: isCustom ? (parseInt(diasFolga, 10) || undefined) : undefined,
      dataRef: dataISO,
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
        <TextInput
          style={styles.input}
          value={relacao}
          onChangeText={setRelacao}
          placeholder="Ex: Esposa, Companheiro, Amigo..."
          placeholderTextColor={colors.mutedDim}
          maxLength={40}
        />

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

        <Text style={styles.sectionLabel}>Data de referência (DD/MM/AAAA)</Text>
        <TextInput
          style={styles.input}
          value={dataRef}
          onChangeText={v => { setDataRef(maskDateBR(v)); setErro(''); }}
          keyboardType="numeric"
          placeholder="05/10/2026"
          placeholderTextColor={colors.mutedDim}
          maxLength={10}
        />

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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: surface.bg },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.xs },
  sectionLabel: { ...typography.label, marginTop: spacing.md, marginBottom: 4 },
  tipoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  tipoChip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.line, backgroundColor: surface.card,
  },
  tipoChipActive: { borderColor: colors.cyan, backgroundColor: colors.navy700 },
  tipoLabel: { fontSize: 14, color: colors.muted, fontWeight: '500' },
  tipoLabelActive: { color: colors.cyan },
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
