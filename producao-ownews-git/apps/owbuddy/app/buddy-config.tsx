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
import { getPreviewMensagem, DEFAULT_BUDDY_PREFS } from '@owbuddy/domain';
import type { BuddyPrefs, BuddyTom, BuddyTrat } from '@owbuddy/domain';
import { getBuddyPrefs, setBuddyPrefs } from '../src/storage';
import { colors, spacing, radius, typography } from '../src/theme';

const TOMS: { value: BuddyTom; label: string; desc: string }[] = [
  { value: 'discreto', label: 'Discreto', desc: 'Direto ao ponto.' },
  { value: 'buddy',    label: 'Buddy',    desc: 'Próximo e animado.' },
  { value: 'resenha',  label: 'Resenha',  desc: 'Descontraído, gíria leve.' },
];

const TRATS: { value: BuddyTrat; label: string }[] = [
  { value: 'neutro',   label: 'Neutro' },
  { value: 'parceiro', label: 'Parceiro' },
  { value: 'parceira', label: 'Parceira' },
];

export default function BuddyConfig() {
  const [prefs, setPrefs] = useState<BuddyPrefs>(DEFAULT_BUDDY_PREFS);
  const [saved, setSaved] = useState(false);

  useFocusEffect(useCallback(() => {
    getBuddyPrefs().then(setPrefs);
    setSaved(false);
  }, []));

  const update = (partial: Partial<BuddyPrefs>) => {
    setPrefs(p => ({ ...p, ...partial }));
    setSaved(false);
  };

  const save = async () => {
    await setBuddyPrefs(prefs);
    setSaved(true);
    setTimeout(() => router.back(), 600);
  };

  const preview = getPreviewMensagem(prefs, 3);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.root} contentContainerStyle={styles.content}>
        {/* Preview */}
        <View style={styles.previewCard}>
          <Text style={styles.previewLabel}>Prévia</Text>
          <Text style={styles.previewMsg}>{preview || 'Configure abaixo para ver a prévia.'}</Text>
        </View>

        {/* Tom */}
        <Text style={styles.sectionLabel}>Tom</Text>
        <View style={styles.options}>
          {TOMS.map(t => (
            <TouchableOpacity
              key={t.value}
              style={[styles.optionCard, prefs.tom === t.value && styles.optionCardActive]}
              onPress={() => update({ tom: t.value })}
            >
              <Text style={[styles.optionTitle, prefs.tom === t.value && styles.optionTitleActive]}>{t.label}</Text>
              <Text style={styles.optionDesc}>{t.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tratamento */}
        <Text style={styles.sectionLabel}>Tratamento</Text>
        <View style={styles.tratRow}>
          {TRATS.map(t => (
            <TouchableOpacity
              key={t.value}
              style={[styles.tratChip, prefs.trat === t.value && styles.tratChipActive]}
              onPress={() => update({ trat: t.value })}
            >
              <Text style={[styles.tratText, prefs.trat === t.value && styles.tratTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.tratNote}>
          Neutro: sem marcação de gênero. Parceiro/Parceira: vocativos amigáveis.
          {'\n'}Você escolhe — o Buddy não infere gênero.
        </Text>

        {/* Apelido */}
        <Text style={styles.sectionLabel}>Apelido (opcional)</Text>
        <TextInput
          style={styles.apelidoInput}
          value={prefs.apelido}
          onChangeText={v => update({ apelido: v })}
          placeholder="Como posso te chamar?"
          placeholderTextColor={colors.mutedDim}
          maxLength={24}
          returnKeyType="done"
        />
        <Text style={styles.apelidoNote}>Armazenado apenas neste dispositivo. Não vai a analytics.</Text>

        {/* Save */}
        <TouchableOpacity
          style={[styles.saveBtn, saved && styles.saveBtnDone]}
          onPress={save}
        >
          <Text style={styles.saveBtnText}>{saved ? 'Salvo ✓' : 'Salvar preferências'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.navy800 },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },

  previewCard: { backgroundColor: colors.navy700, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg, borderLeftWidth: 2, borderLeftColor: colors.cyan },
  previewLabel: { ...typography.micro, marginBottom: spacing.xs },
  previewMsg: { ...typography.body, fontStyle: 'italic', lineHeight: 22 },

  sectionLabel: { ...typography.label, marginBottom: spacing.sm, marginTop: spacing.md },

  options: { gap: spacing.sm },
  optionCard: { backgroundColor: colors.navy700, borderRadius: radius.sm, padding: spacing.md, borderWidth: 1, borderColor: colors.line },
  optionCardActive: { borderColor: colors.cyan, backgroundColor: colors.navy700 },
  optionTitle: { ...typography.h3, marginBottom: 2 },
  optionTitleActive: { color: colors.cyan },
  optionDesc: { ...typography.small },

  tratRow: { flexDirection: 'row', gap: spacing.sm },
  tratChip: { flex: 1, padding: spacing.sm, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, alignItems: 'center', backgroundColor: colors.navy700 },
  tratChipActive: { borderColor: colors.cyan, backgroundColor: colors.navy700 },
  tratText: { fontSize: 14, color: colors.muted, fontWeight: '500' },
  tratTextActive: { color: colors.cyan },
  tratNote: { ...typography.small, color: colors.mutedDim, marginTop: spacing.sm, lineHeight: 18 },

  apelidoInput: { backgroundColor: colors.navy700, borderRadius: radius.sm, padding: spacing.sm, paddingHorizontal: 12, color: colors.white, fontSize: 16, borderWidth: 1, borderColor: colors.line, marginBottom: spacing.xs },
  apelidoNote: { ...typography.small, color: colors.mutedDim, marginBottom: spacing.xl },

  saveBtn: { backgroundColor: colors.cyan, borderRadius: radius.sm, padding: spacing.md, alignItems: 'center' },
  saveBtnDone: { backgroundColor: colors.green },
  saveBtnText: { color: colors.navy950, fontWeight: '700', fontSize: 16 },
});
