import { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { calcCertStatus } from '@owbuddy/domain';
import type { Certificado, CertCalc } from '@owbuddy/domain';
import { getCerts, setCerts } from '../../src/storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { bottomNavSpace, colors, maritime, spacing, radius, typography } from '../../src/theme';
import { OWBackground } from '../../src/components/OWBackground';
import { formatDateBR, maskDateBR, parseDateBR } from '../../src/format';
import { analytics } from '../../src/analytics';

const STATUS_COLOR: Record<string, string> = {
  valido:      colors.green,
  atencao:     colors.amber,
  'vence-hoje': colors.red,
  vencido:     colors.red,
  'sem-data':  colors.mutedDim,
};

export default function MeusCerts() {
  const [certs, setCertsState] = useState<Certificado[]>([]);
  const [form, setForm] = useState<Partial<Certificado> | null>(null);
  const insets = useSafeAreaInsets();

  const load = useCallback(async () => {
    const c = await getCerts();
    setCertsState(c.filter(x => !x._deleted));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const save = async () => {
    if (!form?.nome) { Alert.alert('Atenção', 'Nome do certificado é obrigatório.'); return; }
    const all = await getCerts();
    // Convert BR dates to ISO before storing
    const saveForm = {
      ...form,
      validade: form.validade ? parseDateBR(form.validade) : form.validade,
      emissao:  form.emissao  ? parseDateBR(form.emissao)  : form.emissao,
      // Mesmo campo que o web grava — permite merge por id (mais recente vence) na sincronização
      updated_at: new Date().toISOString(),
    };
    if (saveForm.id) {
      const updated = all.map(c => c.id === saveForm.id ? { ...c, ...saveForm } as Certificado : c);
      await setCerts(updated);
    } else {
      const novo: Certificado = { ...saveForm, id: Date.now().toString(), nome: saveForm.nome } as Certificado;
      await setCerts([...all, novo]);
      analytics.track('certificate_created');
    }
    setForm(null);
    await load();
  };

  const del = (id: string, nome: string) => {
    Alert.alert('Remover', `Remover "${nome}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          const all = await getCerts();
          await setCerts(all.map(c => c.id === id ? { ...c, _deleted: true, updated_at: new Date().toISOString() } : c));
          await load();
        },
      },
    ]);
  };

  if (form !== null) return (
    <OWBackground>
      <CertForm
        form={form.id ? { ...form, validade: formatDateBR(form.validade) || form.validade, emissao: formatDateBR(form.emissao) || form.emissao } : form}
        onChange={setForm}
        onSave={save}
        onCancel={() => setForm(null)}
      />
    </OWBackground>
  );

  return (
    <OWBackground>
    <View style={styles.root}>
      <FlatList
        data={certs}
        keyExtractor={c => c.id}
        contentContainerStyle={[styles.list, { paddingTop: insets.top + spacing.md, paddingBottom: bottomNavSpace(insets.bottom) }]}
        ListEmptyComponent={<EmptyState onAdd={() => setForm({})} />}
        renderItem={({ item }) => {
          const calc = calcCertStatus(item);
          return (
            <CertCard
              cert={item}
              calc={calc}
              onEdit={() => setForm({ ...item })}
              onDelete={() => del(item.id, item.nome)}
            />
          );
        }}
      />
      {certs.length > 0 && (
        <TouchableOpacity style={[styles.fab, { bottom: bottomNavSpace(insets.bottom) - spacing.lg }]} onPress={() => setForm({})}>
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}
    </View>
    </OWBackground>
  );
}

function CertCard({ cert, calc, onEdit, onDelete }: { cert: Certificado; calc: CertCalc; onEdit: () => void; onDelete: () => void }) {
  const accentColor = STATUS_COLOR[calc.status] ?? colors.mutedDim;
  return (
    <TouchableOpacity style={[styles.card, { borderLeftColor: accentColor, borderLeftWidth: 3 }]} onPress={onEdit} onLongPress={onDelete} delayLongPress={600}>
      <View style={styles.cardTop}>
        <Text style={styles.certNome}>{cert.nome}</Text>
        <View style={[styles.badge, { backgroundColor: accentColor + '22' }]}>
          <Text style={[styles.badgeText, { color: accentColor }]}>{calc.label}</Text>
        </View>
      </View>
      {cert.instituicao ? <Text style={styles.certSub}>{cert.instituicao}</Text> : null}
      {cert.validade ? <Text style={styles.certValidade}>Validade: {formatDateBR(cert.validade) || cert.validade}</Text> : null}
      {calc.critico && <Text style={[styles.certAlert, { color: accentColor }]}>Renove antes de embarcar →</Text>}
    </TouchableOpacity>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <View style={styles.empty}>
      <Ionicons name="document-text-outline" size={48} color={colors.mutedDim} style={{ marginBottom: spacing.md }} />
      <Text style={styles.emptyTitle}>Sem certificados</Text>
      <Text style={styles.emptySub}>Adicione seus certificados offshore para receber alertas de vencimento.</Text>
      <TouchableOpacity style={styles.addBtn} onPress={onAdd}>
        <Text style={styles.addBtnText}>+ Adicionar certificado</Text>
      </TouchableOpacity>
    </View>
  );
}

function CertForm({ form, onChange, onSave, onCancel }: { form: Partial<Certificado>; onChange: (v: Partial<Certificado>) => void; onSave: () => void; onCancel: () => void }) {
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.root} contentContainerStyle={styles.formContent}>
        <Text style={fStyles.sectionLabel}>Certificado</Text>
        <Field label="Nome *" value={form.nome ?? ''} onChange={v => onChange({ ...form, nome: v })} placeholder="OPITO BOSIET, HUET, H2S..." />
        <Field label="Instituição" value={form.instituicao ?? ''} onChange={v => onChange({ ...form, instituicao: v })} placeholder="SENAI, PETROBRAS..." />
        <Field label="Data de validade" value={maskDateBR(form.validade ?? '')} onChange={v => onChange({ ...form, validade: maskDateBR(v) })} placeholder="DD/MM/AAAA" keyboardType="numeric" maxLength={10} />
        <Field label="Data de emissão" value={maskDateBR(form.emissao ?? '')} onChange={v => onChange({ ...form, emissao: maskDateBR(v) })} placeholder="DD/MM/AAAA" keyboardType="numeric" maxLength={10} />
        <View style={fStyles.btnRow}>
          <TouchableOpacity style={fStyles.cancelBtn} onPress={onCancel}><Text style={fStyles.cancelText}>Cancelar</Text></TouchableOpacity>
          <TouchableOpacity style={fStyles.saveBtn} onPress={onSave}><Text style={fStyles.saveText}>Salvar</Text></TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, value, onChange, placeholder, keyboardType, maxLength }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; keyboardType?: any; maxLength?: number }) {
  return (
    <View style={fStyles.fieldWrap}>
      <Text style={fStyles.label}>{label}</Text>
      <TextInput style={fStyles.input} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={colors.mutedDim} keyboardType={keyboardType} maxLength={maxLength} />
    </View>
  );
}

const fStyles = StyleSheet.create({
  sectionLabel: { ...typography.micro, marginBottom: spacing.md },
  fieldWrap: { marginBottom: spacing.sm },
  label: { ...typography.small, marginBottom: 4 },
  input: { backgroundColor: colors.navy800, borderRadius: radius.sm, padding: spacing.sm, paddingHorizontal: 12, color: colors.white, fontSize: 15, borderWidth: 1, borderColor: colors.line },
  btnRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  cancelBtn: { flex: 1, padding: spacing.md, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, alignItems: 'center' },
  cancelText: { color: colors.muted, fontWeight: '600' },
  saveBtn: { flex: 2, padding: spacing.md, borderRadius: radius.sm, backgroundColor: colors.cyan, alignItems: 'center' },
  saveText: { color: colors.navy950, fontWeight: '700' },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  list: { padding: spacing.md, paddingBottom: 100 },
  formContent: { padding: spacing.md },
  card: { backgroundColor: maritime.glass, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: maritime.glassBorder, ...maritime.cardShadow },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.xs },
  certNome: { ...typography.h3, flex: 1, marginRight: spacing.sm },
  badge: { borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  certSub: { ...typography.small, marginBottom: 2 },
  certValidade: { ...typography.micro, marginTop: 4 },
  certAlert: { fontSize: 12, fontWeight: '600', marginTop: spacing.sm },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, paddingTop: spacing.xxl },

  emptyTitle: { ...typography.h2, marginBottom: spacing.sm },
  emptySub: { ...typography.small, textAlign: 'center', lineHeight: 20, marginBottom: spacing.lg },
  addBtn: { backgroundColor: colors.cyan, borderRadius: radius.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  addBtnText: { color: colors.navy950, fontWeight: '700' },
  fab: { position: 'absolute', bottom: 80, right: spacing.md, width: 52, height: 52, borderRadius: 26, backgroundColor: colors.cyan, alignItems: 'center', justifyContent: 'center', elevation: 4 },
  fabText: { fontSize: 28, fontWeight: '300', color: colors.navy950 },
});
