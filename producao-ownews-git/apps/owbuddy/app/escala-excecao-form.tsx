import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { Excecao } from '@owbuddy/domain';
import { getEscala, setEscala } from '../src/storage';
import { OWDatePicker } from '../src/components/OWDatePicker';
import { colors, spacing, radius, typography, surface } from '../src/theme';
import { formatDateBR } from '../src/format';

function gerarId(): string {
  return `exc_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
}

export default function EscalaExcecaoForm() {
  const params = useLocalSearchParams<{ tipo?: string; id?: string; ini?: string; fim?: string }>();
  const [tipo, setTipo] = useState<'dobra' | 'ferias'>((params.tipo as 'dobra' | 'ferias') ?? 'dobra');
  const [ini, setIni] = useState(params.ini ?? ''); // ISO
  const [fim, setFim] = useState(params.fim ?? ''); // ISO
  const [erro, setErro] = useState('');
  const [showPickerIni, setShowPickerIni] = useState(false);
  const [showPickerFim, setShowPickerFim] = useState(false);

  const save = async () => {
    if (!ini || !fim) { setErro('Selecione as duas datas.'); return; }
    if (fim < ini) { setErro('Data final deve ser igual ou posterior à data inicial.'); return; }

    const config = await getEscala();
    if (!config) return;
    const exc: Excecao = { id: params.id ?? gerarId(), tipo, ini, fim };
    const updated = { ...config, excecoes: [...(config.excecoes ?? []).filter(e => e.id !== exc.id), exc] };
    await setEscala(updated);
    router.replace('/escala');
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.root} contentContainerStyle={styles.content}>
        <Text style={styles.sectionLabel}>Tipo</Text>
        <View style={styles.tipoRow}>
          {(['dobra', 'ferias'] as const).map(t => (
            <TouchableOpacity
              key={t}
              style={[styles.tipoChip, tipo === t && styles.tipoChipActive]}
              onPress={() => setTipo(t)}
            >
              <Text style={[styles.tipoLabel, tipo === t && styles.tipoLabelActive]}>
                {t === 'dobra' ? 'Dobra' : 'Férias'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {tipo === 'dobra' && (
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              A dobra é marcada no calendário mas não altera o ciclo de embarque/folga subsequente.
            </Text>
          </View>
        )}

        <Text style={styles.sectionLabel}>Data início</Text>
        <TouchableOpacity style={styles.dateBtn} onPress={() => setShowPickerIni(true)}>
          <Ionicons name="calendar-outline" size={18} color={colors.cyanDim} />
          <Text style={[styles.dateBtnText, !ini && { color: colors.mutedDim }]}>
            {ini ? formatDateBR(ini) : 'Selecionar'}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.mutedDim} />
        </TouchableOpacity>

        <Text style={styles.sectionLabel}>Data fim</Text>
        <TouchableOpacity style={styles.dateBtn} onPress={() => setShowPickerFim(true)}>
          <Ionicons name="calendar-outline" size={18} color={colors.cyanDim} />
          <Text style={[styles.dateBtnText, !fim && { color: colors.mutedDim }]}>
            {fim ? formatDateBR(fim) : 'Selecionar'}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.mutedDim} />
        </TouchableOpacity>

        {erro ? <Text style={styles.erro}>{erro}</Text> : null}

        <TouchableOpacity
          style={[styles.saveBtn, (!ini || !fim) && styles.saveBtnDisabled]}
          onPress={save}
          disabled={!ini || !fim}
        >
          <Text style={styles.saveBtnText}>Salvar</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
          <Text style={styles.cancelText}>Cancelar</Text>
        </TouchableOpacity>
      </ScrollView>

      <OWDatePicker visible={showPickerIni} value={ini} title="Data início"
        onConfirm={v => { setIni(v); setShowPickerIni(false); setErro(''); }}
        onCancel={() => setShowPickerIni(false)} />
      <OWDatePicker visible={showPickerFim} value={fim || ini} title="Data fim"
        onConfirm={v => { setFim(v); setShowPickerFim(false); setErro(''); }}
        onCancel={() => setShowPickerFim(false)} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: surface.bg },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.xs },
  sectionLabel: { ...typography.label, marginTop: spacing.md, marginBottom: 4 },
  tipoRow: { flexDirection: 'row', gap: spacing.sm },
  tipoChip: {
    flex: 1, padding: spacing.sm, borderRadius: radius.sm, borderWidth: 1,
    borderColor: colors.line, alignItems: 'center', backgroundColor: surface.card,
  },
  tipoChipActive: { borderColor: colors.cyan, backgroundColor: colors.navy700 },
  tipoLabel: { fontSize: 15, color: colors.muted, fontWeight: '500' },
  tipoLabelActive: { color: colors.cyan },
  infoBox: {
    backgroundColor: surface.card, borderRadius: radius.sm, padding: spacing.sm,
    borderWidth: 1, borderColor: colors.lineSoft, marginTop: spacing.sm,
  },
  infoText: { ...typography.small, lineHeight: 18, color: colors.mutedDim },
  dateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: surface.card, borderRadius: radius.sm, padding: spacing.sm,
    paddingHorizontal: 12, borderWidth: 1, borderColor: colors.line, minHeight: 48,
  },
  dateBtnText: { flex: 1, fontSize: 15, fontWeight: '500', color: colors.white },
  erro: { color: colors.red ?? '#f44336', fontSize: 13, marginTop: 4 },
  saveBtn: {
    backgroundColor: colors.cyan, borderRadius: radius.sm, padding: spacing.md,
    alignItems: 'center', marginTop: spacing.md,
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { color: colors.navy950, fontWeight: '700', fontSize: 16 },
  cancelBtn: { padding: spacing.md, alignItems: 'center', marginTop: spacing.sm },
  cancelText: { color: colors.mutedDim, fontSize: 15 },
});
