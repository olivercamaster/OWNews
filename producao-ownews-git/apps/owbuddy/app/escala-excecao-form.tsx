import { useCallback, useState } from 'react';
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
import { useFocusEffect } from 'expo-router';
import type { Excecao } from '@owbuddy/domain';
import { getEscala, setEscala } from '../src/storage';
import { colors, spacing, radius, typography, surface } from '../src/theme';
import { maskDateBR, parseDateBR } from '../src/format';
import { TextInput } from 'react-native';

function gerarId(): string {
  return `exc_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
}

export default function EscalaExcecaoForm() {
  const params = useLocalSearchParams<{ tipo?: string; id?: string; ini?: string; fim?: string }>();
  const [tipo, setTipo] = useState<'dobra' | 'ferias'>((params.tipo as 'dobra' | 'ferias') ?? 'dobra');
  const [ini, setIni] = useState(params.ini ? maskDateBR(params.ini.replace(/-/g, '')) : '');
  const [fim, setFim] = useState(params.fim ? maskDateBR(params.fim.replace(/-/g, '')) : '');
  const [erro, setErro] = useState('');

  const save = async () => {
    const iniISO = parseDateBR(ini);
    const fimISO = parseDateBR(fim);
    if (!iniISO || !fimISO) { setErro('Data inválida. Use DD/MM/AAAA.'); return; }
    if (fimISO < iniISO) { setErro('Data final deve ser igual ou posterior à data inicial.'); return; }

    const config = await getEscala();
    if (!config) return;
    const exc: Excecao = { id: params.id ?? gerarId(), tipo, ini: iniISO, fim: fimISO };
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
              A dobra é marcada no calendário mas não altera o ciclo de embarque/folga subsequente — o mesmo comportamento da Minha Escala no OWNews.
            </Text>
          </View>
        )}

        <Text style={styles.sectionLabel}>Data início (DD/MM/AAAA)</Text>
        <TextInput
          style={styles.input}
          value={ini}
          onChangeText={v => { setIni(maskDateBR(v)); setErro(''); }}
          keyboardType="numeric"
          placeholder="01/10/2026"
          placeholderTextColor={colors.mutedDim}
          maxLength={10}
        />

        <Text style={styles.sectionLabel}>Data fim (DD/MM/AAAA)</Text>
        <TextInput
          style={styles.input}
          value={fim}
          onChangeText={v => { setFim(maskDateBR(v)); setErro(''); }}
          keyboardType="numeric"
          placeholder="14/10/2026"
          placeholderTextColor={colors.mutedDim}
          maxLength={10}
        />

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
  input: {
    backgroundColor: surface.card, borderRadius: radius.sm, padding: spacing.sm,
    paddingHorizontal: 12, color: colors.white, fontSize: 15, borderWidth: 1, borderColor: colors.line,
  },
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
