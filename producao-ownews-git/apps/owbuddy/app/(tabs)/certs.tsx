/**
 * Certificados e documentos — a mesma lista de sempre (chave ownews_certificados, sync
 * da Conta OW por id), agora com tipo (Certificado, Passaporte, CNH, ASO, Outro) e
 * "Avisar antes". Sem foto do documento: só nome, validade, aviso e observação curta.
 *
 * Padrão de CRUD do app: "Adicionar" visível no topo; tocar no card abre a edição;
 * "Excluir" fica dentro da edição, com confirmação.
 */
import { useCallback, useState } from 'react';
import {
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
import {
  AVISO_DOCUMENTO_OPCOES,
  AVISO_DOCUMENTO_PADRAO,
  DOCUMENTO_TIPOS,
  avisoDiasDocumento,
  calcCertStatus,
  nomePadraoDocumento,
  tipoDocumento,
  validarDocumento,
} from '@owbuddy/domain';
import type { Certificado, CertCalc, DocumentoTipo } from '@owbuddy/domain';
import { getCerts, setCerts } from '../../src/storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { bottomNavSpace, colors, maritime, spacing, radius, typography, themed } from '../../src/theme';
import { useTema } from '../../src/tema';
import { OWBackground } from '../../src/components/OWBackground';
import { OWDatePicker } from '../../src/components/OWDatePicker';
import { OWEmptyState } from '../../src/components/OWEmptyState';
import { formatDateBR } from '../../src/format';
import { analytics } from '../../src/analytics';
import { confirmarRemocao } from '../../src/confirmar';
import { avisar } from '../../src/feedback';
import { useAcaoUnica, useVoltarAndroid } from '../../src/acoes';

const STATUS_COLOR: Record<string, string> = themed(() => ({
  valido:      colors.green,
  atencao:     colors.amber,
  'vence-hoje': colors.red,
  vencido:     colors.red,
  'sem-data':  colors.mutedDim,
}));

const LABEL_TIPO: Record<DocumentoTipo, string> = Object.fromEntries(DOCUMENTO_TIPOS.map(t => [t.value, t.label])) as Record<DocumentoTipo, string>;

/** Mais urgente primeiro: vencido → vence antes → sem data por último. */
function ordenar(certs: Certificado[]): Certificado[] {
  return [...certs].sort((a, b) => {
    const da = a.validade ?? '9999-99-99';
    const db = b.validade ?? '9999-99-99';
    return da.localeCompare(db) || a.nome.localeCompare(b.nome, 'pt-BR');
  });
}

export default function MeusCerts() {
  useTema();
  const [certs, setCertsState] = useState<Certificado[]>([]);
  const [form, setForm] = useState<Partial<Certificado> | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

  const load = useCallback(async () => {
    const c = await getCerts();
    setCertsState(ordenar(c.filter(x => !x._deleted)));
  }, []);

  useFocusEffect(useCallback(() => { analytics.screen('certificados'); load(); }, [load]));

  const abrirNovo = () => { setErro(null); setForm({ tipo: 'CERTIFICADO', aviso_dias: AVISO_DOCUMENTO_PADRAO }); };
  const abrirEdicao = (c: Certificado) => { setErro(null); setForm({ ...c }); };
  const fechar = () => { setForm(null); setErro(null); };
  useVoltarAndroid(form !== null, fechar);

  const [save, salvando] = useAcaoUnica(async () => {
    if (!form) return;
    const msg = validarDocumento(form);
    if (msg) { setErro(msg); return; }
    const all = await getCerts();
    const agora = new Date().toISOString();
    const limpo: Partial<Certificado> = {
      ...form,
      nome: form.nome!.trim(),
      instituicao: form.instituicao?.trim() || undefined,
      obs: form.obs?.trim() || undefined,
      updated_at: agora,
    };
    if (limpo.id && all.some(c => c.id === limpo.id)) {
      await setCerts(all.map(c => (c.id === limpo.id ? ({ ...c, ...limpo } as Certificado) : c)));
      avisar('Documento atualizado');
    } else {
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      await setCerts([...all, { ...limpo, id, nome: limpo.nome! } as Certificado]);
      analytics.track('certificate_created', { tipo: tipoDocumento(limpo) });
      avisar('Documento salvo');
    }
    fechar();
    await load();
  });

  const del = (id: string, nome: string) => {
    confirmarRemocao(`Excluir "${nome}"?`, 'Ele sai da sua lista e os avisos de vencimento param.', async () => {
      const all = await getCerts();
      await setCerts(all.map(c => (c.id === id ? { ...c, _deleted: true, updated_at: new Date().toISOString() } : c)));
      analytics.track('certificate_deleted');
      avisar('Excluído');
      fechar();
      await load();
    });
  };

  if (form !== null) return (
    <OWBackground>
      <CertForm
        form={form}
        erro={erro}
        salvando={salvando}
        onChange={f => { setForm(f); if (erro) setErro(null); }}
        onSave={save}
        onCancel={fechar}
        onDelete={form.id ? () => del(form.id!, form.nome ?? '') : undefined}
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
        ListHeaderComponent={
          <View style={styles.topo}>
            <Text style={[styles.subtitulo, { flex: 1 }]}>Passaporte, CNH, ASO e certificados — eu aviso antes de vencer.</Text>
            {certs.length > 0 && (
              <TouchableOpacity style={styles.addTopo} onPress={abrirNovo} accessibilityRole="button" accessibilityLabel="Adicionar documento">
                <Ionicons name="add" size={18} color={colors.onAccent} />
                <Text style={styles.addTopoText}>Adicionar</Text>
              </TouchableOpacity>
            )}
          </View>
        }
        ListEmptyComponent={
          <OWEmptyState
            icon="document-text-outline"
            title="Nenhum documento ainda"
            description="Passaporte, CNH, ASO, certificados… Eu aviso antes de vencer."
            actionLabel="+ Adicionar documento"
            onAction={abrirNovo}
          />
        }
        renderItem={({ item }) => (
          <CertCard cert={item} calc={calcCertStatus(item)} onEdit={() => abrirEdicao(item)} />
        )}
      />
    </View>
    </OWBackground>
  );
}

function CertCard({ cert, calc, onEdit }: { cert: Certificado; calc: CertCalc; onEdit: () => void }) {
  useTema();
  const accentColor = STATUS_COLOR[calc.status] ?? colors.mutedDim;
  const tipo = tipoDocumento(cert);
  const mostrarTipo = tipo !== 'CERTIFICADO' || !!cert.tipo;
  return (
    <TouchableOpacity
      style={[styles.card, { borderLeftColor: accentColor, borderLeftWidth: 3 }]}
      onPress={onEdit}
      accessibilityRole="button"
      accessibilityLabel={`${cert.nome}. ${calc.label}. Toque para editar.`}
    >
      <View style={styles.cardTop}>
        <View style={{ flex: 1, marginRight: spacing.sm }}>
          {mostrarTipo && LABEL_TIPO[tipo] !== cert.nome ? <Text style={styles.certTipo}>{LABEL_TIPO[tipo]}</Text> : null}
          <Text style={styles.certNome}>{cert.nome}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: accentColor + '22' }]}>
          <Text style={[styles.badgeText, { color: accentColor }]}>{calc.label}</Text>
        </View>
      </View>
      {cert.instituicao ? <Text style={styles.certSub}>{cert.instituicao}</Text> : null}
      <View style={styles.cardRodape}>
        <Text style={styles.certValidade}>
          {cert.validade ? `Validade ${formatDateBR(cert.validade) || cert.validade}` : 'Sem validade informada'}
          {cert.validade && cert.aviso_dias != null ? ` · aviso ${avisoDiasDocumento(cert)} dias antes` : ''}
        </Text>
        <Ionicons name="create-outline" size={15} color={colors.mutedDim} />
      </View>
      {calc.critico && <Text style={[styles.certAlert, { color: accentColor }]}>{calc.status === 'vencido' ? 'Renove antes do próximo embarque.' : 'Renove antes de embarcar.'}</Text>}
    </TouchableOpacity>
  );
}

function CertForm({ form, erro, salvando, onChange, onSave, onCancel, onDelete }: {
  form: Partial<Certificado>; erro: string | null; salvando: boolean;
  onChange: (v: Partial<Certificado>) => void; onSave: () => void; onCancel: () => void; onDelete?: () => void;
}) {
  useTema();
  const insets = useSafeAreaInsets();
  const [showPickerValidade, setShowPickerValidade] = useState(false);
  const [showPickerEmissao, setShowPickerEmissao] = useState(false);
  const tipo = tipoDocumento(form);
  const ehCert = tipo === 'CERTIFICADO';
  const aviso = form.aviso_dias != null ? avisoDiasDocumento(form) : null;

  const escolherTipo = (t: DocumentoTipo) => {
    // Troca o nome só se ainda é o nome automático do tipo anterior (não apaga o que a pessoa digitou).
    const nomeAuto = !form.nome || form.nome === nomePadraoDocumento(tipo);
    onChange({ ...form, tipo: t, nome: nomeAuto ? nomePadraoDocumento(t) : form.nome });
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.root} contentContainerStyle={[styles.formContent, { paddingTop: insets.top + spacing.md, paddingBottom: bottomNavSpace(insets.bottom) }]} keyboardShouldPersistTaps="handled">
        <View style={fStyles.cabecalho}>
          <TouchableOpacity onPress={onCancel} hitSlop={10} accessibilityRole="button" accessibilityLabel="Voltar sem salvar" style={fStyles.voltar}>
            <Ionicons name="chevron-back" size={22} color={colors.white} />
          </TouchableOpacity>
          <Text style={fStyles.titulo}>{form.id ? 'Editar documento' : 'Novo documento'}</Text>
        </View>

        <Text style={fStyles.label}>Documento</Text>
        <View style={fStyles.chips}>
          {DOCUMENTO_TIPOS.map(t => (
            <TouchableOpacity
              key={t.value}
              style={[fStyles.chip, tipo === t.value && fStyles.chipAtivo]}
              onPress={() => escolherTipo(t.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected: tipo === t.value }}
            >
              <Text style={[fStyles.chipTexto, tipo === t.value && fStyles.chipTextoAtivo]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Field
          label={ehCert ? 'Nome do certificado' : 'Nome'}
          value={form.nome ?? ''}
          onChange={v => onChange({ ...form, nome: v })}
          placeholder={ehCert ? 'Ex.: BOSIET, HUET, NR-35' : tipo === 'OUTRO' ? 'Ex.: Carteira do conselho' : ''}
          maxLength={60}
        />

        <Text style={fStyles.label}>Validade</Text>
        <TouchableOpacity style={fStyles.dateBtn} onPress={() => setShowPickerValidade(true)} accessibilityRole="button" accessibilityLabel={form.validade ? `Validade ${formatDateBR(form.validade)}. Alterar` : 'Escolher validade'}>
          <Ionicons name="calendar-outline" size={16} color={colors.cyanDim} />
          <Text style={[fStyles.dateBtnText, !form.validade && { color: colors.mutedDim }]}>
            {form.validade ? formatDateBR(form.validade) : 'Escolher data'}
          </Text>
          {form.validade ? (
            <TouchableOpacity onPress={() => onChange({ ...form, validade: undefined })} hitSlop={8} accessibilityLabel="Limpar validade">
              <Ionicons name="close-circle" size={16} color={colors.mutedDim} />
            </TouchableOpacity>
          ) : <Ionicons name="chevron-forward" size={14} color={colors.mutedDim} />}
        </TouchableOpacity>

        {form.validade ? (
          <>
            <Text style={fStyles.label}>Avisar antes</Text>
            <View style={fStyles.chips}>
              {AVISO_DOCUMENTO_OPCOES.map(d => (
                <TouchableOpacity
                  key={d}
                  style={[fStyles.chip, (aviso ?? AVISO_DOCUMENTO_PADRAO) === d && fStyles.chipAtivo]}
                  onPress={() => onChange({ ...form, aviso_dias: d })}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: (aviso ?? AVISO_DOCUMENTO_PADRAO) === d }}
                >
                  <Text style={[fStyles.chipTexto, (aviso ?? AVISO_DOCUMENTO_PADRAO) === d && fStyles.chipTextoAtivo]}>{d} dias</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        ) : null}

        {ehCert ? (
          <>
            <Field label="Instituição (opcional)" value={form.instituicao ?? ''} onChange={v => onChange({ ...form, instituicao: v })} placeholder="SENAI, Falck, Relyon…" maxLength={60} />
            <Text style={fStyles.label}>Emissão (opcional)</Text>
            <TouchableOpacity style={fStyles.dateBtn} onPress={() => setShowPickerEmissao(true)} accessibilityRole="button">
              <Ionicons name="calendar-outline" size={16} color={colors.mutedDim} />
              <Text style={[fStyles.dateBtnText, !form.emissao && { color: colors.mutedDim }]}>
                {form.emissao ? formatDateBR(form.emissao) : 'Escolher data'}
              </Text>
              {form.emissao ? (
                <TouchableOpacity onPress={() => onChange({ ...form, emissao: undefined })} hitSlop={8} accessibilityLabel="Limpar emissão">
                  <Ionicons name="close-circle" size={16} color={colors.mutedDim} />
                </TouchableOpacity>
              ) : <Ionicons name="chevron-forward" size={14} color={colors.mutedDim} />}
            </TouchableOpacity>
          </>
        ) : null}

        <Field label="Observação (opcional)" value={form.obs ?? ''} onChange={v => onChange({ ...form, obs: v })} placeholder="Ex.: renovar na clínica da base" maxLength={80} />

        {erro ? (
          <View style={fStyles.erro} accessibilityRole="alert">
            <Ionicons name="alert-circle-outline" size={16} color={colors.amber} />
            <Text style={fStyles.erroTexto}>{erro}</Text>
          </View>
        ) : null}

        <View style={fStyles.btnRow}>
          <TouchableOpacity style={fStyles.cancelBtn} onPress={onCancel} accessibilityRole="button"><Text style={fStyles.cancelText}>Cancelar</Text></TouchableOpacity>
          <TouchableOpacity style={[fStyles.saveBtn, salvando && { opacity: 0.6 }]} onPress={onSave} disabled={salvando} accessibilityRole="button" accessibilityState={{ disabled: salvando }}>
            <Text style={fStyles.saveText}>{salvando ? 'Salvando…' : 'Salvar'}</Text>
          </TouchableOpacity>
        </View>
        {onDelete ? (
          <TouchableOpacity style={fStyles.deleteBtn} onPress={onDelete} accessibilityRole="button">
            <Ionicons name="trash-outline" size={16} color={colors.red} />
            <Text style={fStyles.deleteText}>Excluir documento</Text>
          </TouchableOpacity>
        ) : null}
        <Text style={fStyles.privNote}>
          Lembrete pessoal: a validade oficial é a do documento emitido. Não guardamos foto nem número do documento. Fica neste aparelho; com Conta OW, sincroniza com a sua conta.
        </Text>
      </ScrollView>

      <OWDatePicker visible={showPickerValidade} value={form.validade} title="Validade"
        onConfirm={v => { onChange({ ...form, validade: v, aviso_dias: form.aviso_dias ?? AVISO_DOCUMENTO_PADRAO }); setShowPickerValidade(false); }}
        onCancel={() => setShowPickerValidade(false)} />
      <OWDatePicker visible={showPickerEmissao} value={form.emissao} title="Data de emissão"
        onConfirm={v => { onChange({ ...form, emissao: v }); setShowPickerEmissao(false); }}
        onCancel={() => setShowPickerEmissao(false)} />
    </KeyboardAvoidingView>
  );
}

function Field({ label, value, onChange, placeholder, maxLength }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; maxLength?: number }) {
  useTema();
  return (
    <View style={fStyles.fieldWrap}>
      <Text style={fStyles.label}>{label}</Text>
      <TextInput style={fStyles.input} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={colors.mutedDim} maxLength={maxLength} accessibilityLabel={label} />
    </View>
  );
}

const fStyles = themed(() => StyleSheet.create({
  cabecalho: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  voltar: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginLeft: -spacing.xs },
  titulo: { ...typography.h2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.xs },
  chip: { paddingHorizontal: 12, minHeight: 38, justifyContent: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: maritime.glassBorder, backgroundColor: maritime.glass },
  chipAtivo: { borderColor: colors.cyan, backgroundColor: maritime.glassActive },
  chipTexto: { fontSize: 13, fontWeight: '600', color: colors.muted },
  chipTextoAtivo: { color: colors.cyan },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, marginTop: spacing.md },
  deleteText: { color: colors.red, fontWeight: '600', fontSize: 14 },
  privNote: { fontSize: 12, color: colors.mutedDim, textAlign: 'center', marginTop: spacing.md, lineHeight: 17 },
  fieldWrap: { marginBottom: spacing.xs },
  label: { ...typography.small, marginBottom: 4, marginTop: spacing.sm },
  input: { backgroundColor: maritime.field, borderRadius: radius.sm, padding: spacing.sm, paddingHorizontal: 12, color: colors.white, fontSize: 15, borderWidth: 1, borderColor: maritime.fieldBorder, minHeight: 44 },
  dateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: maritime.field, borderRadius: radius.sm, padding: spacing.sm,
    paddingHorizontal: 12, borderWidth: 1, borderColor: maritime.fieldBorder,
    minHeight: 44, marginBottom: spacing.xs,
  },
  dateBtnText: { flex: 1, fontSize: 15, color: colors.white, fontWeight: '500' },
  erro: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm },
  erroTexto: { color: colors.amber, fontSize: 13, fontWeight: '600', flex: 1 },
  btnRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  cancelBtn: { flex: 1, padding: spacing.md, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, alignItems: 'center' },
  cancelText: { color: colors.muted, fontWeight: '600' },
  saveBtn: { flex: 2, padding: spacing.md, borderRadius: radius.sm, backgroundColor: colors.cyan, alignItems: 'center', ...maritime.botaoPrimario },
  saveText: { color: colors.onAccent, fontWeight: '700' },
}));

const styles = themed(() => StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  list: { padding: spacing.md, paddingBottom: 100 },
  formContent: { padding: spacing.md },
  topo: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  titulo: { ...typography.h2 },
  subtitulo: { ...typography.small, color: colors.mutedDim, marginTop: 2 },
  addTopo: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.cyan, borderRadius: radius.md, paddingHorizontal: 12, minHeight: 40, ...maritime.botaoPrimario },
  addTopoText: { color: colors.onAccent, fontWeight: '700', fontSize: 14 },
  card: { backgroundColor: maritime.glass, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: maritime.glassBorder, ...maritime.cardShadow },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.xs },
  certTipo: { ...typography.micro, color: colors.kicker, marginBottom: 2 },
  certNome: { ...typography.h3 },
  badge: { borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  certSub: { ...typography.small, marginBottom: 2 },
  cardRodape: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, gap: spacing.sm },
  certValidade: { ...typography.small, color: colors.muted, flex: 1 },
  certAlert: { fontSize: 12, fontWeight: '600', marginTop: spacing.sm },
}));
