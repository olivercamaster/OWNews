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
import { getPreviewMensagem, DEFAULT_BUDDY_PREFS } from '@owbuddy/domain';
import type { BuddyPrefs, BuddyTom, BuddyTrat } from '@owbuddy/domain';
import { getBuddyPrefs, setBuddyPrefs } from '../src/storage';
import { colors, spacing, radius, typography, surface } from '../src/theme';
import { analytics } from '../src/analytics';

// UI labels — mapped from internal domain values, backwards-compatible
const ESTILOS: { value: BuddyTom; label: string; desc: string }[] = [
  { value: 'discreto', label: 'Direto',    desc: 'Objetivo e sem muita conversa.' },
  { value: 'buddy',    label: 'Parceiro',  desc: 'Próximo, natural e amigável.' },
  { value: 'resenha',  label: 'Resenha',   desc: 'Mais descontraído, com resenha leve.' },
];

const TRATS: { value: BuddyTrat; label: string; sub: string }[] = [
  { value: 'neutro',   label: 'Sem vocativo', sub: 'sem "parceiro" ou "parceira"' },
  { value: 'parceiro', label: 'Parceiro',      sub: 'vocativo masculino' },
  { value: 'parceira', label: 'Parceira',      sub: 'vocativo feminino' },
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
    analytics.track('buddy_prefs_saved');
    setSaved(true);
    setTimeout(() => router.back(), 600);
  };

  const preview = getPreviewMensagem(prefs, 3);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.root} contentContainerStyle={styles.content}>

        {/* Preview */}
        <View style={styles.previewCard}>
          <Text style={styles.previewLabel}>Prévia da mensagem</Text>
          <Text style={styles.previewMsg}>{preview || 'Configure abaixo para ver a prévia.'}</Text>
        </View>

        {/* Estilo */}
        <Text style={styles.sectionTitle}>Como você quer que o Buddy fale com você?</Text>
        <View style={styles.options}>
          {ESTILOS.map(t => (
            <TouchableOpacity
              key={t.value}
              style={[styles.optionCard, prefs.tom === t.value && styles.optionCardActive]}
              onPress={() => update({ tom: t.value })}
              accessibilityRole="radio"
              accessibilityState={{ checked: prefs.tom === t.value }}
            >
              <View style={styles.optionRow}>
                <Text style={[styles.optionTitle, prefs.tom === t.value && styles.optionTitleActive]}>
                  {t.label}
                </Text>
                {prefs.tom === t.value && <Ionicons name="checkmark-circle" size={18} color={colors.cyan} />}
              </View>
              <Text style={styles.optionDesc}>{t.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tratamento */}
        <Text style={styles.sectionTitle}>Como o Buddy pode falar com você?</Text>
        <Text style={styles.sectionNote}>Você escolhe — o Buddy nunca infere gênero.</Text>
        <View style={styles.tratRow}>
          {TRATS.map(t => (
            <TouchableOpacity
              key={t.value}
              style={[styles.tratChip, prefs.trat === t.value && styles.tratChipActive]}
              onPress={() => update({ trat: t.value })}
              accessibilityRole="radio"
              accessibilityState={{ checked: prefs.trat === t.value }}
            >
              <Text style={[styles.tratLabel, prefs.trat === t.value && styles.tratLabelActive]}>
                {t.label}
              </Text>
              <Text style={styles.tratSub}>{t.sub}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Apelido */}
        <Text style={styles.sectionTitle}>Como posso te chamar? (opcional)</Text>
        <TextInput
          style={styles.apelidoInput}
          value={prefs.apelido}
          onChangeText={v => update({ apelido: v })}
          placeholder="Seu apelido ou nome"
          placeholderTextColor={colors.mutedDim}
          maxLength={24}
          returnKeyType="done"
          accessibilityLabel="Apelido para o Buddy usar"
        />
        <View style={styles.privNote}>
          <Ionicons name="lock-closed-outline" size={12} color={colors.mutedDim} />
          <Text style={styles.privText}>Guardado só neste dispositivo. Não vai a analytics.</Text>
        </View>

        {/* Save */}
        <TouchableOpacity
          style={[styles.saveBtn, saved && styles.saveBtnDone]}
          onPress={save}
          accessibilityRole="button"
          accessibilityLabel="Salvar preferências"
        >
          <Text style={styles.saveBtnText}>{saved ? 'Salvo ✓' : 'Salvar preferências'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: surface.header },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },

  previewCard: {
    backgroundColor: surface.elevated,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderLeftWidth: 2,
    borderLeftColor: colors.cyan,
  },
  previewLabel: { ...typography.micro, marginBottom: spacing.xs },
  previewMsg: { ...typography.body, fontStyle: 'italic', lineHeight: 22 },

  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.white,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  sectionNote: { ...typography.small, color: colors.mutedDim, marginBottom: spacing.sm, marginTop: -spacing.xs },

  options: { gap: spacing.sm },
  optionCard: {
    backgroundColor: surface.elevated,
    borderRadius: radius.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
  },
  optionCardActive: { borderColor: colors.cyan },
  optionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  optionTitle: { ...typography.h3 },
  optionTitleActive: { color: colors.cyan },
  optionDesc: { ...typography.small },

  tratRow: { gap: spacing.sm },
  tratChip: {
    padding: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: surface.elevated,
  },
  tratChipActive: { borderColor: colors.cyan },
  tratLabel: { fontSize: 14, color: colors.muted, fontWeight: '600', marginBottom: 2 },
  tratLabelActive: { color: colors.cyan },
  tratSub: { ...typography.small, color: colors.mutedDim },

  apelidoInput: {
    backgroundColor: surface.elevated,
    borderRadius: radius.sm,
    padding: spacing.sm,
    paddingHorizontal: 12,
    color: colors.white,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: spacing.xs,
  },
  privNote: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: spacing.xl },
  privText: { ...typography.small, color: colors.mutedDim },

  saveBtn: { backgroundColor: colors.cyan, borderRadius: radius.sm, padding: spacing.md, alignItems: 'center' },
  saveBtnDone: { backgroundColor: colors.green },
  saveBtnText: { color: colors.navy950, fontWeight: '700', fontSize: 16 },
});
