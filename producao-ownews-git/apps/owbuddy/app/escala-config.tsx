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
import { Ionicons } from '@expo/vector-icons';
import { calcularMomento, descreverMomento, AEROPORTOS_ESCALA, ESCALA_TIPOS } from '@owbuddy/domain';
import type { EscalaConfig, TipoRef } from '@owbuddy/domain';
import { getEscala, setEscala } from '../src/storage';
import { colors, spacing, radius, typography, surface } from '../src/theme';
import { OWDatePicker } from '../src/components/OWDatePicker';
import { formatDateBR } from '../src/format';
import { analytics } from '../src/analytics';

export default function EscalaConfigScreen() {
  const [form, setForm] = useState<Partial<EscalaConfig>>({ tipo: '14x14', tipoRef: 'embarquei' });
  const [preview, setPreview] = useState('');
  const [erro, setErro] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  useFocusEffect(useCallback(() => {
    getEscala().then(cfg => {
      if (cfg) setForm({ ...cfg });
    });
  }, []));

  const update = (partial: Partial<EscalaConfig>) => {
    const updated = { ...form, ...partial };
    setForm(updated);
    setErro('');
    if (updated.tipo && updated.dataRef && updated.tipoRef) {
      try {
        const m = calcularMomento(updated as EscalaConfig);
        setPreview(descreverMomento(m));
      } catch { setPreview(''); }
    }
  };

  const save = async () => {
    if (!form.tipo || !form.dataRef || !form.tipoRef) return;
    const existing = await getEscala();
    const { updated_at: _u, origem: _o, ...editavel } = form;
    const isoConfig: EscalaConfig = {
      ...editavel,
      dataRef: form.dataRef,
      excecoes: existing?.excecoes ?? [],
    } as EscalaConfig;
    if (isoConfig.tipo !== 'custom') {
      delete isoConfig.diasEmbarcado;
      delete isoConfig.diasFolga;
    }
    await setEscala(isoConfig);
    analytics.track('scale_configured', { tipo: form.tipo });
    // Go to main escala view if it exists in stack, otherwise back
    router.replace('/escala');
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
          {ESCALA_TIPOS.map(t => (
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
        <TouchableOpacity
          style={styles.dateBtn}
          onPress={() => setShowDatePicker(true)}
        >
          <Ionicons name="calendar-outline" size={18} color={colors.cyanDim} />
          <Text style={[styles.dateBtnText, !form.dataRef && { color: colors.mutedDim }]}>
            {form.dataRef ? formatDateBR(form.dataRef) : 'Selecionar data'}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.mutedDim} />
        </TouchableOpacity>

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

        <Text style={styles.sectionLabel}>Aeroporto / Base de embarque</Text>
        <Text style={styles.sectionHint}>Usado para exibir o clima do seu próximo embarque.</Text>
        <View style={styles.aeroGrid}>
          {AEROPORTOS_ESCALA.map(a => (
            <TouchableOpacity
              key={a.code}
              style={[styles.aeroChip, form.aeroporto === a.code && styles.aeroChipActive]}
              onPress={() => update({ aeroporto: form.aeroporto === a.code ? undefined : a.code })}
            >
              <Text style={[styles.aeroCode, form.aeroporto === a.code && styles.aeroCodeActive]}>{a.code}</Text>
              <Text style={[styles.aeroNome, form.aeroporto === a.code && styles.aeroNomeActive]}>{a.nome}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={16} color={colors.mutedDim} />
          <Text style={styles.infoText}>
            O primeiro dia embarcado é dia 1 do embarque. Feriados não alteram o ciclo.
          </Text>
        </View>

        {erro ? <Text style={styles.erroText}>{erro}</Text> : null}

        <TouchableOpacity
          style={[styles.saveBtn, (!form.tipo || !form.dataRef || !form.tipoRef) && styles.saveBtnDisabled]}
          onPress={save}
          disabled={!form.tipo || !form.dataRef || !form.tipoRef}
        >
          <Text style={styles.saveBtnText}>Salvar escala</Text>
        </TouchableOpacity>
      </ScrollView>

      <OWDatePicker
        visible={showDatePicker}
        value={form.dataRef}
        title="Data de referência"
        onConfirm={v => { update({ dataRef: v }); setShowDatePicker(false); }}
        onCancel={() => setShowDatePicker(false)}
      />
    </KeyboardAvoidingView>
  );
}

function Field({ label, value, onChange, keyboardType, placeholder, maxLength }: {
  label: string; value: string; onChange: (v: string) => void;
  keyboardType?: 'numeric' | 'default'; placeholder?: string; maxLength?: number;
}) {
  return (
    <View style={fStyles.wrap}>
      <Text style={fStyles.label}>{label}</Text>
      <TextInput
        style={fStyles.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedDim}
        keyboardType={keyboardType}
        maxLength={maxLength}
      />
    </View>
  );
}

const fStyles = StyleSheet.create({
  wrap: { marginBottom: spacing.sm },
  label: { ...typography.small, marginBottom: 4 },
  input: {
    backgroundColor: colors.navy800, borderRadius: radius.sm, padding: spacing.sm,
    paddingHorizontal: 12, color: colors.white, fontSize: 15, borderWidth: 1, borderColor: colors.line,
  },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: surface.bg },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  previewCard: {
    backgroundColor: colors.navy800, borderRadius: radius.md, padding: spacing.md,
    marginBottom: spacing.lg, borderLeftWidth: 2, borderLeftColor: colors.green,
  },
  previewText: { ...typography.body, color: colors.green },
  sectionLabel: { ...typography.label, marginBottom: 4, marginTop: spacing.md },
  sectionHint: { ...typography.small, color: colors.mutedDim, marginBottom: spacing.sm },
  tipoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  tipoChip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.line, backgroundColor: colors.navy800,
  },
  tipoChipActive: { borderColor: colors.cyan, backgroundColor: colors.navy700 },
  tipoLabel: { fontSize: 14, color: colors.muted, fontWeight: '500' },
  tipoLabelActive: { color: colors.cyan },
  tratRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  tratChip: {
    flex: 1, padding: spacing.sm, borderRadius: radius.sm, borderWidth: 1,
    borderColor: colors.line, alignItems: 'center', backgroundColor: colors.navy800,
  },
  tratChipActive: { borderColor: colors.cyan, backgroundColor: colors.navy700 },
  tratText: { fontSize: 14, color: colors.muted },
  tratTextActive: { color: colors.cyan },
  aeroGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  aeroChip: {
    paddingHorizontal: spacing.sm, paddingVertical: 8, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.line, backgroundColor: colors.navy800,
    alignItems: 'center', minWidth: '30%',
  },
  aeroChipActive: { borderColor: colors.cyan, backgroundColor: colors.navy700 },
  aeroCode: { fontSize: 12, fontWeight: '700', color: colors.mutedDim, fontFamily: 'monospace' },
  aeroCodeActive: { color: colors.cyan },
  aeroNome: { fontSize: 11, color: colors.mutedDim, marginTop: 2, textAlign: 'center' },
  aeroNomeActive: { color: colors.white },
  infoBox: {
    flexDirection: 'row', gap: spacing.sm, backgroundColor: surface.card,
    borderRadius: radius.sm, padding: spacing.sm, marginBottom: spacing.lg,
    borderWidth: 1, borderColor: colors.lineSoft, alignItems: 'flex-start',
  },
  infoText: { ...typography.small, flex: 1, lineHeight: 18 },
  saveBtn: {
    backgroundColor: colors.cyan, borderRadius: radius.sm, padding: spacing.md, alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.4 },
  dateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.navy800, borderRadius: radius.sm, padding: spacing.sm,
    paddingHorizontal: 12, borderWidth: 1, borderColor: colors.line,
    marginBottom: spacing.md, minHeight: 48,
  },
  dateBtnText: { flex: 1, fontSize: 16, fontWeight: '500', color: colors.white },
  erroText: { ...typography.small, color: colors.red, marginBottom: spacing.sm },
  saveBtnText: { color: colors.navy950, fontWeight: '700', fontSize: 16 },
});
