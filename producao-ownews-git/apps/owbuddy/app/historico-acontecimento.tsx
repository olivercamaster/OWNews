/**
 * Registrar / editar um acontecimento da linha do tempo (Meu Histórico).
 * Tipo, data (obrigatória), horário opcional, título curto opcional, campos simples do tipo
 * (trecho do voo, nome do hotel/base) e observação. Data futura = "Planejado", com aviso.
 */
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  LABEL_ACONTECIMENTO_HIST,
  TIPOS_ACONTECIMENTO_HIST,
  TIPOS_COM_LOCAL,
  TIPOS_COM_TRECHO,
  hojeISO,
  removerAcontecimento,
  salvarAcontecimento,
} from '@owbuddy/domain';
import type { AcontecimentoHist, RegistroEmbarque, TipoAcontecimentoHist } from '@owbuddy/domain';
import { alterarHistorico, getHistorico } from '../src/storage';
import { OWBackground } from '../src/components/OWBackground';
import { OWDatePicker } from '../src/components/OWDatePicker';
import { OWTimePicker } from '../src/components/OWTimePicker';
import { colors, maritime, radius, spacing, typography, themed } from '../src/theme';
import { useTema } from '../src/tema';
import { formatDateBR } from '../src/format';
import { confirmarRemocao, perguntar } from '../src/confirmar';
import { useAcaoUnica } from '../src/acoes';
import { avisar } from '../src/feedback';
import { analytics } from '../src/analytics';
import { novoIdHistorico } from '../src/historico-acoes';
import { HIST_VISUAL } from '../src/historico-visual';

const ROTULO_LOCAL: Partial<Record<TipoAcontecimentoHist, string>> = {
  HOTEL: 'Hotel / local (opcional)', BASE: 'Base (opcional)', TREINAMENTO: 'Local (opcional)',
};

function FormAcontecimentoConteudo() {
  useTema();
  const params = useLocalSearchParams<{ registro: string; id?: string }>();
  const edicao = !!params.id;
  const [acId] = useState(() => params.id ?? novoIdHistorico('ha'));
  const [registro, setRegistro] = useState<RegistroEmbarque | null>(null);
  const [atual, setAtual] = useState<AcontecimentoHist | null>(null);

  const [tipo, setTipo] = useState<TipoAcontecimentoHist>('VOO');
  const [data, setData] = useState('');
  const [hora, setHora] = useState('');
  const [titulo, setTitulo] = useState('');
  const [local, setLocal] = useState('');
  const [origem, setOrigem] = useState('');
  const [destino, setDestino] = useState('');
  const [numero, setNumero] = useState('');
  const [obs, setObs] = useState('');
  const [planejado, setPlanejado] = useState(false);
  const [erro, setErro] = useState('');
  const [pick, setPick] = useState<'data' | 'hora' | null>(null);

  useEffect(() => {
    getHistorico().then(h => {
      const r = h.registros.find(x => x.id === params.registro) ?? null;
      setRegistro(r);
      const a = params.id ? h.acontecimentos.find(x => x.id === params.id) ?? null : null;
      if (a) {
        setAtual(a);
        setTipo(a.tipo); setData(a.data); setHora(a.hora ?? ''); setTitulo(a.titulo ?? ''); setLocal(a.local ?? '');
        setOrigem(a.origem ?? ''); setDestino(a.destino ?? ''); setNumero(a.numero ?? ''); setObs(a.obs ?? '');
        setPlanejado(!!a.planejado);
      } else if (r) {
        // Ponto de partida: hoje se o embarque está em curso; senão, o dia do embarque.
        const hoje = hojeISO();
        setData(!r.desembarque && r.embarque <= hoje ? hoje : r.embarque);
      }
    });
  }, [params.registro, params.id]);

  const auto = atual?.auto === 'embarque' || atual?.auto === 'desembarque' ? atual.auto : null;
  const comTrecho = TIPOS_COM_TRECHO.includes(tipo);
  const comLocal = TIPOS_COM_LOCAL.includes(tipo);

  const [salvar, ocupado] = useAcaoUnica(async () => {
    setErro('');
    if (!registro) return;
    if (!data) { setErro('Escolha a data.'); return; }
    const hoje = hojeISO();
    let plan = planejado;
    if (data > hoje && !planejado) {
      if (!(await perguntar('Essa data ainda não chegou.', 'Deseja salvar mesmo assim? Fica marcado como Planejado até você confirmar que aconteceu.', 'Salvar'))) return;
      plan = true;
    }
    if (auto && data !== atual?.data) {
      const campo = auto === 'embarque' ? 'embarque' : 'desembarque';
      const outro = auto === 'embarque' ? registro.desembarque : registro.embarque;
      if (outro && (campo === 'embarque' ? data > outro : data < outro)) {
        setErro(campo === 'embarque' ? 'O embarque não pode ser depois do desembarque.' : 'O desembarque não pode ser antes do embarque.');
        return;
      }
    }
    const agora = new Date().toISOString();
    await alterarHistorico(h => salvarAcontecimento(h, {
      id: acId,
      registroId: registro.id,
      tipo,
      data,
      hora: hora || undefined,
      titulo: titulo.trim() || undefined,
      local: comLocal ? (local.trim() || undefined) : undefined,
      origem: comTrecho ? (origem.trim() || undefined) : undefined,
      destino: comTrecho ? (destino.trim() || undefined) : undefined,
      numero: tipo === 'VOO' ? (numero.trim() || undefined) : undefined,
      obs: obs.trim() || undefined,
      planejado: plan || undefined,
      auto: atual?.auto,
      importadoDe: atual?.importadoDe,
    }, agora));
    analytics.track(edicao ? 'acontecimento_editado' : 'acontecimento_registrado', { tipo });
    avisar(edicao ? 'Atualizado' : 'Registrado');
    if (router.canGoBack()) router.back(); else router.replace({ pathname: '/historico-registro', params: { id: registro.id } });
  });

  const excluir = () => {
    confirmarRemocao('Excluir este acontecimento?', 'Ele sai da linha do tempo deste embarque.', async () => {
      await alterarHistorico(h => removerAcontecimento(h, acId));
      analytics.track('acontecimento_excluido', { tipo });
      avisar('Excluído');
      if (router.canGoBack()) router.back(); else router.replace('/historico');
    });
  };

  const v = HIST_VISUAL[tipo];

  return (
    <OWBackground>
      <Stack.Screen options={{ title: edicao ? 'Editar acontecimento' : 'Registrar acontecimento' }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          <Text style={styles.label}>O que aconteceu?</Text>
          {auto ? (
            <Text style={styles.nota}>Data principal deste registro: mudar aqui também corrige o {auto} no histórico. Sua escala não muda.</Text>
          ) : (
            <View style={styles.chipRow}>
              {TIPOS_ACONTECIMENTO_HIST.map(t => {
                const m = HIST_VISUAL[t];
                const ativo = tipo === t;
                return (
                  <TouchableOpacity key={t} style={[styles.chip, ativo && styles.chipAtivo]} onPress={() => { setTipo(t); setErro(''); }}
                    accessibilityRole="button" accessibilityState={{ selected: ativo }}>
                    <Ionicons name={m.icon} size={14} color={ativo ? colors.cyan : m.color} />
                    <Text style={[styles.chipText, ativo && styles.chipTextAtivo]}>{LABEL_ACONTECIMENTO_HIST[t]}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <Text style={styles.label}>Data</Text>
          <TouchableOpacity style={styles.pickerBtn} onPress={() => setPick('data')} accessibilityRole="button" accessibilityLabel="Data do acontecimento">
            <Ionicons name="calendar-outline" size={16} color={v.color} />
            <Text style={[styles.pickerText, !data && styles.pickerPlaceholder]}>{data ? formatDateBR(data) : 'Selecionar data'}</Text>
          </TouchableOpacity>

          <Text style={styles.label}>Horário (opcional)</Text>
          <TouchableOpacity style={styles.pickerBtn} onPress={() => setPick('hora')} accessibilityRole="button" accessibilityLabel="Horário do acontecimento">
            <Ionicons name="time-outline" size={16} color={colors.mutedDim} />
            <Text style={[styles.pickerText, !hora && styles.pickerPlaceholder]}>{hora || 'Sem horário'}</Text>
            {hora ? (
              <TouchableOpacity onPress={() => setHora('')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Limpar horário">
                <Ionicons name="close-circle" size={16} color={colors.mutedDim} />
              </TouchableOpacity>
            ) : null}
          </TouchableOpacity>

          {comTrecho ? (
            <View style={styles.dupla}>
              <View style={{ flex: 1 }}><Campo label="Origem (opcional)" value={origem} onChange={setOrigem} placeholder="Ex.: GRU" /></View>
              <View style={{ flex: 1 }}><Campo label="Destino (opcional)" value={destino} onChange={setDestino} placeholder="Ex.: Macaé" /></View>
            </View>
          ) : null}
          {tipo === 'VOO' ? <Campo label="Número do voo (opcional)" value={numero} onChange={setNumero} placeholder="Ex.: AD 4512" curto /> : null}
          {comLocal ? <Campo label={ROTULO_LOCAL[tipo] ?? 'Local (opcional)'} value={local} onChange={setLocal} placeholder={tipo === 'HOTEL' ? 'Ex.: Hotel perto da base' : 'Ex.: Macaé'} /> : null}
          <Campo label="Título ou descrição curta (opcional)" value={titulo} onChange={setTitulo} placeholder={tipo === 'OUTRO' ? 'Ex.: Troca de aeroporto' : LABEL_ACONTECIMENTO_HIST[tipo]} />
          <Campo label="Observação (opcional)" value={obs} onChange={setObs} placeholder="Só você vê" multiline />

          {planejado || (data && data > hojeISO()) ? (
            <>
              <Text style={styles.label}>Situação</Text>
              <View style={styles.chipRow}>
                <TouchableOpacity style={[styles.chip, !planejado && styles.chipAtivo]} onPress={() => setPlanejado(false)} accessibilityRole="button" accessibilityState={{ selected: !planejado }}>
                  <Text style={[styles.chipText, !planejado && styles.chipTextAtivo]}>Aconteceu</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.chip, planejado && styles.chipAtivo]} onPress={() => setPlanejado(true)} accessibilityRole="button" accessibilityState={{ selected: planejado }}>
                  <Text style={[styles.chipText, planejado && styles.chipTextAtivo]}>Planejado</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : null}

          {erro ? <Text style={styles.erro} accessibilityLiveRegion="polite">{erro}</Text> : null}

          <TouchableOpacity style={[styles.saveBtn, ocupado && { opacity: 0.6 }]} onPress={salvar} disabled={ocupado || !registro} accessibilityRole="button">
            <Ionicons name="checkmark" size={18} color={colors.onAccent} />
            <Text style={styles.saveBtnText}>{edicao ? 'Salvar alterações' : 'Registrar'}</Text>
          </TouchableOpacity>

          {edicao && !auto ? (
            <TouchableOpacity style={styles.secundario} onPress={excluir} accessibilityRole="button">
              <Ionicons name="trash-outline" size={16} color={colors.red} />
              <Text style={[styles.secundarioTexto, { color: colors.red }]}>Excluir acontecimento</Text>
            </TouchableOpacity>
          ) : null}
          {auto ? <Text style={styles.nota}>Para remover, edite ou exclua o embarque.</Text> : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <OWDatePicker visible={pick === 'data'} value={data} title="Data" anosAtras={40}
        onConfirm={d => { setData(d); setPick(null); setErro(''); if (d <= hojeISO()) setPlanejado(false); }} onCancel={() => setPick(null)} />
      <OWTimePicker visible={pick === 'hora'} value={hora}
        onConfirm={h => { setHora(h); setPick(null); }} onCancel={() => setPick(null)} />
    </OWBackground>
  );
}

function Campo({ label, value, onChange, placeholder, multiline, curto }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean; curto?: boolean;
}) {
  useTema();
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && { minHeight: 64, textAlignVertical: 'top' }]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedDim}
        multiline={multiline}
        maxLength={multiline ? 200 : curto ? 20 : 60}
        accessibilityLabel={label}
      />
    </>
  );
}

const styles = themed(() => StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: spacing.xxl * 2 },
  label: { ...typography.micro, marginTop: spacing.md, marginBottom: spacing.sm },
  nota: { fontSize: 12, color: colors.muted, marginTop: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 40,
    paddingHorizontal: 11, paddingVertical: 8, borderRadius: radius.xl,
    borderWidth: 1, borderColor: maritime.glassBorder, backgroundColor: maritime.glass,
  },
  chipAtivo: { backgroundColor: colors.cyanFaint, borderColor: colors.cyan },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.muted },
  chipTextAtivo: { color: colors.cyan },
  pickerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48,
    backgroundColor: maritime.field, borderRadius: radius.md, borderWidth: 1, borderColor: maritime.fieldBorder,
    paddingHorizontal: spacing.md,
  },
  pickerText: { flex: 1, fontSize: 15, color: colors.white, fontVariant: ['tabular-nums'] },
  pickerPlaceholder: { color: colors.mutedDim },
  dupla: { flexDirection: 'row', gap: spacing.sm },
  input: {
    backgroundColor: maritime.field, borderRadius: radius.md, borderWidth: 1, borderColor: maritime.fieldBorder,
    paddingHorizontal: spacing.md, paddingVertical: 12, color: colors.white, fontSize: 15,
  },
  erro: { color: colors.red, fontSize: 13, marginTop: spacing.md, fontWeight: '600' },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    minHeight: 52, borderRadius: radius.md, marginTop: spacing.lg, backgroundColor: colors.cyan, ...maritime.botaoPrimario,
  },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: colors.onAccent },
  secundario: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 48, marginTop: spacing.sm },
  secundarioTexto: { fontSize: 14, fontWeight: '600', color: colors.cyanDim },
}));

/** Meu Histórico é do OWBuddy Free para sempre: sem portão, sem conta, funciona offline. */
export default function FormAcontecimento() {
  useTema();
  return <FormAcontecimentoConteudo />;
}
