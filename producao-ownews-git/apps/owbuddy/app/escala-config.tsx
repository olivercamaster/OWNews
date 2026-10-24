import { useCallback, useMemo, useState } from 'react';
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
import { confirmacaoEscala, diasDoCiclo, AEROPORTOS_ESCALA, DIAS_BLOCO_MAX, ESCALA_TIPOS } from '@owbuddy/domain';
import type { EscalaConfig, TipoRef } from '@owbuddy/domain';
import { getEscala, setEscala } from '../src/storage';
import { colors, maritime, spacing, radius, typography, surface, themed } from '../src/theme';
import { useTema } from '../src/tema';
import { OWDatePicker } from '../src/components/OWDatePicker';
import { formatDateBR } from '../src/format';
import { analytics } from '../src/analytics';
import { useAcaoUnica } from '../src/acoes';
import { avisar } from '../src/feedback';

export default function EscalaConfigScreen() {
  useTema();
  const [form, setForm] = useState<Partial<EscalaConfig>>({ tipo: '14x14', tipoRef: 'embarquei' });
  const [erro, setErro] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [editando, setEditando] = useState(false);

  // Edição: abre com a escala salva (o picker abre na data salva). Nova
  // configuração: nenhuma data até o usuário escolher — o picker só
  // COMEÇA em hoje; nada é gravado antes de "Confirmar escala".
  useFocusEffect(useCallback(() => {
    getEscala().then(cfg => {
      if (cfg) { setForm({ ...cfg }); setEditando(true); }
    });
  }, []));

  const update = (partial: Partial<EscalaConfig>) => {
    setForm(f => ({ ...f, ...partial }));
    setErro('');
  };

  // Resumo pela regra canônica (resumoEscala → calcEscalaISO), recalculado a cada mudança.
  const confirmacao = useMemo(() => {
    if (!form.tipo || !form.dataRef || !form.tipoRef || !diasDoCiclo(form as EscalaConfig)) return null;
    return confirmacaoEscala(form as EscalaConfig);
  }, [form]);

  const [save] = useAcaoUnica(async () => {
    if (!form.tipo || !form.dataRef || !form.tipoRef) return;
    if (!diasDoCiclo(form as EscalaConfig)) {
      setErro(`Informe dias embarcado e de folga entre 1 e ${DIAS_BLOCO_MAX}.`);
      return;
    }
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
    avisar(editando ? 'Escala atualizada' : 'Escala salva');
    // Go to main escala view if it exists in stack, otherwise back
    router.replace('/escala');
  });

  const tipo = form.tipo ?? '14x14';
  const isCustom = tipo === 'custom';

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.root} contentContainerStyle={styles.content}>
        <Text style={styles.sectionLabel}>Qual é a sua escala?</Text>
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
          <Field label="Dias embarcado" value={String(form.diasEmbarcado ?? '')} onChange={v => update({ diasEmbarcado: parseInt(v.replace(/\D/g, ''), 10) || undefined })} keyboardType="numeric" placeholder="Ex: 21" maxLength={3} />
          <Field label="Dias de folga" value={String(form.diasFolga ?? '')} onChange={v => update({ diasFolga: parseInt(v.replace(/\D/g, ''), 10) || undefined })} keyboardType="numeric" placeholder="Ex: 28" maxLength={3} />
        </>)}

        <Text style={styles.sectionLabel}>Qual data você sabe?</Text>
        <View style={styles.tratRow}>
          {(['embarquei', 'desembarquei'] as TipoRef[]).map(t => (
            <TouchableOpacity
              key={t}
              style={[styles.tratChip, form.tipoRef === t && styles.tratChipActive]}
              onPress={() => update({ tipoRef: t })}
              accessibilityRole="radio"
              accessibilityState={{ checked: form.tipoRef === t }}
            >
              <Text style={[styles.tratText, form.tipoRef === t && styles.tratTextActive]}>
                {t === 'embarquei' ? 'Último embarque' : 'Último desembarque'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionLabel}>
          {form.tipoRef === 'desembarquei' ? 'Quando foi seu último desembarque?' : 'Quando foi seu último embarque?'}
        </Text>
        <TouchableOpacity
          style={styles.dateBtn}
          onPress={() => setShowDatePicker(true)}
          accessibilityRole="button"
          accessibilityLabel={form.dataRef ? `Data escolhida ${formatDateBR(form.dataRef)}. Alterar` : 'Escolher data'}
        >
          <Ionicons name="calendar-outline" size={18} color={colors.cyanDim} />
          <Text style={[styles.dateBtnText, !form.dataRef && { color: colors.muted }]}>
            {form.dataRef ? formatDateBR(form.dataRef) : 'Escolher data'}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.muted} />
        </TouchableOpacity>
        <Text style={styles.sectionHint}>
          {form.tipoRef === 'desembarquei'
            ? 'O dia do desembarque conta como o 1º dia de folga.'
            : 'O dia do embarque conta como o Dia 1 a bordo — mesmo que você esteja configurando o app dias depois.'}
        </Text>

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

        {confirmacao ? (
          <View style={styles.resumo} accessibilityLabel="Confira sua escala">
            <Text style={styles.resumoTitulo}>Confira antes de salvar</Text>
            <Linha rotulo="Sua escala" valor={confirmacao.ciclo} />
            <Linha rotulo={form.tipoRef === 'desembarquei' ? 'Último desembarque' : 'Último embarque'} valor={formatDateBR(confirmacao.dataRefISO)} />
            <Linha rotulo="Hoje" valor={confirmacao.hoje} destaque />
            <Linha rotulo="Próximo desembarque" valor={formatDateBR(confirmacao.proximoDesembarqueISO)} />
            <Linha rotulo="Próximo embarque" valor={formatDateBR(confirmacao.proximoEmbarqueISO)} />
            {confirmacao.futura ? (
              <Text style={styles.resumoAviso}>Essa data ainda não chegou. Se for o seu próximo embarque, tudo certo: o ciclo foi calculado a partir dela.</Text>
            ) : null}
          </View>
        ) : (
          <Text style={styles.sectionHint}>Escolha a escala e a data para ver o resumo.</Text>
        )}

        <Text style={styles.nota}>Feriados, dobras e férias não alteram o ciclo.</Text>

        {erro ? <Text style={styles.erroText}>{erro}</Text> : null}

        <TouchableOpacity
          style={[styles.saveBtn, !confirmacao && styles.saveBtnDisabled]}
          onPress={save}
          disabled={!confirmacao}
          accessibilityRole="button"
        >
          <Text style={styles.saveBtnText}>{editando ? 'Salvar alterações' : 'Confirmar escala'}</Text>
        </TouchableOpacity>
      </ScrollView>

      <OWDatePicker
        visible={showDatePicker}
        value={form.dataRef}
        title={form.tipoRef === 'desembarquei' ? 'Último desembarque' : 'Último embarque'}
        onConfirm={v => { update({ dataRef: v }); setShowDatePicker(false); }}
        onCancel={() => setShowDatePicker(false)}
      />
    </KeyboardAvoidingView>
  );
}

function Linha({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) {
  useTema();
  return (
    <View style={styles.linha}>
      <Text style={styles.linhaRotulo}>{rotulo}</Text>
      <Text style={[styles.linhaValor, destaque && styles.linhaDestaque]}>{valor}</Text>
    </View>
  );
}

function Field({ label, value, onChange, keyboardType, placeholder, maxLength }: {
  label: string; value: string; onChange: (v: string) => void;
  keyboardType?: 'numeric' | 'default'; placeholder?: string; maxLength?: number;
}) {
  useTema();
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

const fStyles = themed(() => StyleSheet.create({
  wrap: { marginBottom: spacing.sm },
  label: { ...typography.small, marginBottom: 4 },
  input: {
    backgroundColor: maritime.field, borderRadius: radius.sm, padding: spacing.sm,
    paddingHorizontal: 12, color: colors.white, fontSize: 15, borderWidth: 1, borderColor: maritime.fieldBorder,
  },
}));

const styles = themed(() => StyleSheet.create({
  root: { flex: 1, backgroundColor: surface.bg },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  resumo: {
    backgroundColor: surface.card, borderRadius: radius.md, padding: spacing.md,
    marginTop: spacing.sm, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.line,
  },
  resumoTitulo: { ...typography.label, color: colors.cyan, marginBottom: spacing.sm },
  linha: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: spacing.sm, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  linhaRotulo: { ...typography.small, color: colors.muted, flexShrink: 1 },
  linhaValor: { fontSize: 15, fontWeight: '600', color: colors.white, textAlign: 'right', flexShrink: 1 },
  linhaDestaque: { color: colors.green },
  resumoAviso: { ...typography.small, color: colors.amber, marginTop: spacing.sm, lineHeight: 18 },
  nota: { ...typography.small, color: colors.muted, marginBottom: spacing.md },
  sectionLabel: { ...typography.label, marginBottom: 4, marginTop: spacing.md },
  sectionHint: { ...typography.small, color: colors.muted, marginBottom: spacing.sm, lineHeight: 18 },
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
  aeroCode: { fontSize: 12, fontWeight: '700', color: colors.muted, fontFamily: 'monospace' },
  aeroCodeActive: { color: colors.cyan },
  aeroNome: { fontSize: 11, color: colors.muted, marginTop: 2, textAlign: 'center' },
  aeroNomeActive: { color: colors.white },
  saveBtn: {
    backgroundColor: colors.cyan, borderRadius: radius.sm, padding: spacing.md, alignItems: 'center',
    ...maritime.botaoPrimario,
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
  saveBtnText: { color: colors.onAccent, fontWeight: '700', fontSize: 16 },
}));
