import { useCallback, useState } from 'react';
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
import { router } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { calcularMomento } from '@owbuddy/domain';
import type { EscalaConfig, EscalaTipo, TipoRef } from '@owbuddy/domain';
import { getEscala, setEscala } from '../src/storage';
import { colors, spacing, radius, typography } from '../src/theme';
import { formatDateBR, maskDateBR, parseDateBR } from '../src/format';
import { analytics } from '../src/analytics';

const TIPOS_PRESET: { value: EscalaTipo; label: string }[] = [
  { value: '14x14', label: '14 × 14' },
  { value: '14x21', label: '14 × 21' },
  { value: '28x28', label: '28 × 28' },
  { value: '21x21', label: '21 × 21' },
  { value: '7x7',   label: '7 × 7' },
  { value: 'custom', label: 'Personalizada' },
];

export default function EscalaConfig() {
  const [form, setForm] = useState<Partial<EscalaConfig>>({ tipo: '14x14', tipoRef: 'embarquei' });
  const [preview, setPreview] = useState('');

  useFocusEffect(useCallback(() => {
    getEscala().then(cfg => {
      if (cfg) {
        // Convert ISO date to BR format for display
        setForm({ ...cfg, dataRef: formatDateBR(cfg.dataRef) || cfg.dataRef });
      }
    });
  }, []));

  const update = (partial: Partial<EscalaConfig>) => {
    const updated = { ...form, ...partial };
    setForm(updated);
    // For preview calculation, temporarily convert BR date to ISO
    const isoDataRef = updated.dataRef ? parseDateBR(updated.dataRef) : undefined;
    if (updated.tipo && isoDataRef && updated.tipoRef) {
      try {
        const m = calcularMomento({ ...updated, dataRef: isoDataRef } as EscalaConfig);
        const labels: Record<string, string> = {
          SEM_ESCALA: '', FOLGA: 'De folga', EMBARCADO: 'Embarcado',
          EMBARQUE_DISTANTE: 'Embarque se aproxima', EMBARQUE_PROXIMO: 'Embarque em breve',
          VESPERA_EMBARQUE: 'Véspera do embarque', DESEMBARQUE_PROXIMO: 'Desembarque próximo',
        };
        const label = labels[m.tipo] ?? '';
        const dias = m.diasEmbarque != null
          ? ` · ${m.diasEmbarque} ${m.diasEmbarque === 1 ? 'dia' : 'dias'} pro embarque`
          : m.diasDesembarque != null
          ? ` · ${m.diasDesembarque} ${m.diasDesembarque === 1 ? 'dia' : 'dias'} pro desembarque`
          : '';
        setPreview(label ? `${label}${dias}` : '');
      } catch { setPreview(''); }
    }
  };

  const save = async () => {
    if (!form.tipo || !form.dataRef || !form.tipoRef) return;
    // Convert BR date to ISO for storage
    const isoConfig = { ...form, dataRef: parseDateBR(form.dataRef) } as EscalaConfig;
    await setEscala(isoConfig);
    analytics.track('scale_configured', { tipo: form.tipo });
    router.back();
  };

  const tipo = form.tipo ?? '14x14';
  const isCustom = tipo === 'custom';

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.root} contentContainerStyle={styles.content}>
        {preview ? (
          <View style={styles.previewCard}>
            <Text style={styles.previewText}>{preview}</Text>
          </View>
        ) : null}

        <Text style={styles.sectionLabel}>Ciclo de trabalho</Text>
        <View style={styles.tipoGrid}>
          {TIPOS_PRESET.map(t => (
            <TouchableOpacity
              key={t.value}
              style={[styles.tipoChip, tipo === t.value && styles.tipoChipActive]}
              onPress={() => update({ tipo: t.value })}
            >
              <Text style={[styles.tipoLabel, tipo === t.value && styles.tipoLabelActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {isCustom && (<>
          <Field label="Dias embarcado" value={String(form.diasEmbarcado ?? '')} onChange={v => update({ diasEmbarcado: parseInt(v, 10) || undefined })} keyboardType="numeric" placeholder="Ex: 21" />
          <Field label="Dias de folga" value={String(form.diasFolga ?? '')} onChange={v => update({ diasFolga: parseInt(v, 10) || undefined })} keyboardType="numeric" placeholder="Ex: 28" />
        </>)}

        <Text style={styles.sectionLabel}>Data de referência</Text>
        <Field label="Data de referência (DD/MM/AAAA)" value={maskDateBR(form.dataRef ?? '')} onChange={v => update({ dataRef: maskDateBR(v) })} keyboardType="numeric" placeholder="05/10/2026" maxLength={10} />

        <Text style={styles.sectionLabel}>Nesta data eu estava...</Text>
        <View style={styles.tratRow}>
          {(['embarquei', 'desembarquei'] as TipoRef[]).map(t => (
            <TouchableOpacity
              key={t}
              style={[styles.tratChip, form.tipoRef === t && styles.tratChipActive]}
              onPress={() => update({ tipoRef: t })}
            >
              <Text style={[styles.tratText, form.tipoRef === t && styles.tratTextActive]}>
                {t === 'embarquei' ? 'Embarquei' : 'Desembarquei'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            Invariantes do ciclo: o primeiro dia embarcado é dia 1 do embarque; o primeiro dia de folga é dia 1 da folga. Feriados não alteram o ciclo.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, (!form.tipo || !form.dataRef || !form.tipoRef) && styles.saveBtnDisabled]}
          onPress={save}
          disabled={!form.tipo || !form.dataRef || !form.tipoRef}
        >
          <Text style={styles.saveBtnText}>Salvar escala</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, value, onChange, keyboardType, placeholder, maxLength }: { label: string; value: string; onChange: (v: string) => void; keyboardType?: any; placeholder?: string; maxLength?: number }) {
  return (
    <View style={fStyles.wrap}>
      <Text style={fStyles.label}>{label}</Text>
      <TextInput style={fStyles.input} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={colors.mutedDim} keyboardType={keyboardType} maxLength={maxLength} />
    </View>
  );
}

const fStyles = StyleSheet.create({
  wrap: { marginBottom: spacing.sm },
  label: { ...typography.small, marginBottom: 4 },
  input: { backgroundColor: colors.navy800, borderRadius: radius.sm, padding: spacing.sm, paddingHorizontal: 12, color: colors.white, fontSize: 15, borderWidth: 1, borderColor: colors.line },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.navy950 },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  previewCard: { backgroundColor: colors.navy800, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg, borderLeftWidth: 2, borderLeftColor: colors.green },
  previewText: { ...typography.body, color: colors.green },
  sectionLabel: { ...typography.label, marginBottom: spacing.sm, marginTop: spacing.md },
  tipoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  tipoChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.navy800 },
  tipoChipActive: { borderColor: colors.cyan, backgroundColor: colors.navy700 },
  tipoLabel: { fontSize: 14, color: colors.muted, fontWeight: '500' },
  tipoLabelActive: { color: colors.cyan },
  tratRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  tratChip: { flex: 1, padding: spacing.sm, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, alignItems: 'center', backgroundColor: colors.navy800 },
  tratChipActive: { borderColor: colors.cyan, backgroundColor: colors.navy700 },
  tratText: { fontSize: 14, color: colors.muted },
  tratTextActive: { color: colors.cyan },
  infoBox: { backgroundColor: colors.navy800, borderRadius: radius.sm, padding: spacing.md, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.lineSoft },
  infoText: { ...typography.small, lineHeight: 18 },
  saveBtn: { backgroundColor: colors.cyan, borderRadius: radius.sm, padding: spacing.md, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { color: colors.navy950, fontWeight: '700', fontSize: 16 },
});
