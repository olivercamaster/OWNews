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
import { calcEscalaParaDia } from '@owbuddy/domain';
import type { ViagemFolga } from '@owbuddy/domain';
import { getViagensFolga, setViagensFolga, getEscala } from '../src/storage';
import { OWDatePicker } from '../src/components/OWDatePicker';
import { colors, spacing, radius, typography, surface } from '../src/theme';
import { formatDateBR } from '../src/format';

function gerarId(): string {
  return `vf_${Date.now()}`;
}

export default function EscalaViagemForm() {
  const params = useLocalSearchParams<{ id?: string; destino?: string; ini?: string; fim?: string; obs?: string }>();
  const isEdit = !!params.id;
  const [destino, setDestino] = useState(params.destino ?? '');
  const [ini, setIni] = useState(params.ini ?? ''); // ISO
  const [fim, setFim] = useState(params.fim ?? ''); // ISO
  const [obs, setObs] = useState(params.obs ?? '');
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [showPickerIni, setShowPickerIni] = useState(false);
  const [showPickerFim, setShowPickerFim] = useState(false);

  const verificarConflito = async (iniISO: string, fimISO: string): Promise<string> => {
    const config = await getEscala();
    if (!config) return '';
    let d = new Date(iniISO + 'T12:00:00Z').getTime();
    const endMs = new Date(fimISO + 'T12:00:00Z').getTime();
    while (d <= endMs) {
      const iso = new Date(d).toISOString().slice(0, 10);
      const st = calcEscalaParaDia(config, iso);
      if (st?.embarcado) {
        return 'Esta viagem coincide com um período em que sua escala indica que você estará embarcado. Você ainda pode salvar — a escala real pode mudar.';
      }
      d += 86400000;
    }
    return '';
  };

  const save = async () => {
    if (!destino.trim()) { setErro('Informe um destino.'); return; }
    if (!ini || !fim) { setErro('Selecione as datas de início e fim.'); return; }
    if (fim < ini) { setErro('Data fim deve ser igual ou posterior à data início.'); return; }

    const conflito = await verificarConflito(ini, fim);
    if (conflito && !aviso) { setAviso(conflito); return; }

    const viagens = await getViagensFolga();
    const v: ViagemFolga = {
      id: params.id ?? gerarId(),
      destino: destino.trim(),
      data_ini: ini,
      data_fim: fim,
      obs: obs.trim() || undefined,
    };
    await setViagensFolga([...viagens.filter(x => x.id !== v.id), v]);
    router.replace('/escala');
  };

  const excluir = async () => {
    if (!params.id) return;
    const viagens = await getViagensFolga();
    await setViagensFolga(viagens.filter(x => x.id !== params.id));
    router.replace('/escala');
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.root} contentContainerStyle={styles.content}>
        <Text style={styles.sectionLabel}>Destino</Text>
        <TextInput
          style={styles.input}
          value={destino}
          onChangeText={v => { setDestino(v); setErro(''); setAviso(''); }}
          placeholder="Ex: Santiago, Argentina, Lisboa..."
          placeholderTextColor={colors.mutedDim}
          maxLength={80}
        />

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

        <Text style={styles.sectionLabel}>Observação (opcional)</Text>
        <TextInput
          style={[styles.input, styles.inputMulti]}
          value={obs}
          onChangeText={setObs}
          placeholder="Voo, hotel, contato..."
          placeholderTextColor={colors.mutedDim}
          multiline
          numberOfLines={3}
          maxLength={200}
        />

        {erro ? <Text style={styles.erro}>{erro}</Text> : null}

        {aviso ? (
          <View style={styles.avisoBox}>
            <Ionicons name="warning-outline" size={18} color={colors.amber} />
            <Text style={styles.avisoText}>{aviso}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.saveBtn, (!destino.trim() || !ini || !fim) && styles.saveBtnDisabled]}
          onPress={save}
          disabled={!destino.trim() || !ini || !fim}
        >
          <Text style={styles.saveBtnText}>{aviso ? 'Salvar mesmo assim' : 'Salvar'}</Text>
        </TouchableOpacity>

        {isEdit && (
          <TouchableOpacity style={styles.deleteBtn} onPress={excluir}>
            <Text style={styles.deleteText}>Excluir viagem</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
          <Text style={styles.cancelText}>Cancelar</Text>
        </TouchableOpacity>
      </ScrollView>

      <OWDatePicker visible={showPickerIni} value={ini} title="Data início"
        onConfirm={v => { setIni(v); setShowPickerIni(false); setErro(''); setAviso(''); }}
        onCancel={() => setShowPickerIni(false)} />
      <OWDatePicker visible={showPickerFim} value={fim || ini} title="Data fim"
        onConfirm={v => { setFim(v); setShowPickerFim(false); setErro(''); setAviso(''); }}
        onCancel={() => setShowPickerFim(false)} />
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
  inputMulti: { minHeight: 72, textAlignVertical: 'top' },
  dateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: surface.card, borderRadius: radius.sm, padding: spacing.sm,
    paddingHorizontal: 12, borderWidth: 1, borderColor: colors.line, minHeight: 48,
  },
  dateBtnText: { flex: 1, fontSize: 15, fontWeight: '500', color: colors.white },
  erro: { color: '#f44336', fontSize: 13, marginTop: 4 },
  avisoBox: {
    flexDirection: 'row', gap: spacing.sm, backgroundColor: colors.amber + '18',
    borderRadius: radius.sm, padding: spacing.sm, borderWidth: 1, borderColor: colors.amber + '44',
    marginTop: spacing.sm, alignItems: 'flex-start',
  },
  avisoText: { flex: 1, fontSize: 13, color: colors.amber, lineHeight: 18 },
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
