/**
 * "Lembrar de algo" — cadastro único de Datas importantes (EventoPessoal). O mesmo
 * evento aparece no calendário da Minha Escala, em Próximos dias e nos lembretes.
 * Simples de propósito: tipo, título, data, hora, recorrência, lembrete, observação.
 */
import { useCallback, useEffect, useState } from 'react';
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
import {
  LEMBRETE_PADRAO_DIAS,
  RELACOES_PESSOA,
  TIPOS_EVENTO_CADASTRO,
  escalaNaData,
  fraseEscalaNaData,
  hojeISO,
  recorrenciaPadrao,
} from '@owbuddy/domain';
import type { EscalaConfig, EventoPessoal, EventoRecorrencia, EventoTipo } from '@owbuddy/domain';
import { getEscala, getEventosPessoais, setEventosPessoais } from '../src/storage';
import { OWDatePicker } from '../src/components/OWDatePicker';
import { OWTimePicker } from '../src/components/OWTimePicker';
import { OWBackground } from '../src/components/OWBackground';
import { colors, spacing, radius, typography, maritime } from '../src/theme';
import { formatDateBR } from '../src/format';
import { confirmarRemocao } from '../src/confirmar';
import { EVENTO_VISUAL } from '../src/evento-visual';
import { analytics } from '../src/analytics';

const PLACEHOLDER: Partial<Record<EventoTipo, string>> = {
  ANIVERSARIO: 'Ex.: Aniversário da Ana',
  CURSO: 'Ex.: Curso NR-35',
  CONSULTA: 'Ex.: Dentista',
  COMPROMISSO: 'Ex.: Banco, reunião da escola',
  TRABALHO: 'Ex.: Treinamento na base',
  DOCUMENTO: 'Ex.: Renovar CNH',
  PESSOAL: 'Ex.: Churrasco da família',
};

function descreverPadrao(tipo: EventoTipo): string {
  const d = LEMBRETE_PADRAO_DIAS[tipo] ?? [1];
  return d.map(n => (n === 1 ? '1 dia antes' : `${n} dias antes`)).join(' e ');
}

export default function LembrarDeAlgo() {
  const params = useLocalSearchParams<{ data?: string; id?: string }>();
  const isEdit = !!params.id;

  const [tipo, setTipo]         = useState<EventoTipo>('ANIVERSARIO');
  const [nome, setNome]         = useState('');
  const [pessoa, setPessoa]     = useState('');
  const [relacao, setRelacao]   = useState('');
  const [dataIni, setDataIni]   = useState(params.data ?? '');
  const [dataFim, setDataFim]   = useState('');
  const [horaIni, setHoraIni]   = useState('');
  const [inst, setInst]         = useState('');
  const [local, setLocal]       = useState('');
  const [destino, setDestino]   = useState('');
  const [obs, setObs]           = useState('');
  const [recorrencia, setRec]   = useState<EventoRecorrencia>('anual');
  const [lembrete, setLembrete] = useState(true);
  const [editId, setEditId]     = useState<string | null>(null);
  const [erro, setErro]         = useState('');
  const [escala, setEscala]     = useState<EscalaConfig | null>(null);

  const [showDateIni, setShowDateIni] = useState(false);
  const [showDateFim, setShowDateFim] = useState(false);
  const [showTimeIni, setShowTimeIni] = useState(false);

  useEffect(() => { getEscala().then(setEscala); }, []);

  useEffect(() => {
    if (!params.id) return;
    getEventosPessoais().then(all => {
      const ev = all.find(e => e.id === params.id);
      if (!ev) return;
      setEditId(ev.id);
      setTipo(ev.tipo);
      setNome(ev.nome ?? '');
      setPessoa(ev.pessoa ?? '');
      setRelacao(ev.relacao ?? '');
      setDataIni(ev.data_ini);
      setDataFim(ev.data_fim ?? '');
      setHoraIni(ev.hora_ini ?? '');
      setInst(ev.instituicao ?? '');
      setLocal(ev.local ?? '');
      setDestino(ev.destino ?? '');
      setObs(ev.obs ?? '');
      setRec(ev.recorrencia ?? 'nenhuma');
      setLembrete(!(Array.isArray(ev.lembrete_dias) && ev.lembrete_dias.length === 0));
    });
  }, [params.id]);

  const escolherTipo = useCallback((t: EventoTipo) => {
    setTipo(t);
    setErro('');
    if (!isEdit) setRec(recorrenciaPadrao(t)); // aniversário nasce anual
  }, [isEdit]);

  const aniversario = tipo === 'ANIVERSARIO';
  const temFim = tipo === 'CURSO' || tipo === 'TRABALHO' || tipo === 'VIAGEM';
  const tiposVisiveis: EventoTipo[] = TIPOS_EVENTO_CADASTRO.includes(tipo) ? TIPOS_EVENTO_CADASTRO : [...TIPOS_EVENTO_CADASTRO, tipo];
  const fraseEscala = dataIni ? fraseEscalaNaData(escalaNaData(escala, dataIni), dataIni === hojeISO()) : null;

  const save = async () => {
    if (!nome.trim() && !(aniversario && pessoa.trim())) {
      setErro(aniversario ? 'Informe um título ou o nome da pessoa.' : 'Informe um título.');
      return;
    }
    if (!dataIni) { setErro('Escolha a data.'); return; }
    if (dataFim && dataFim < dataIni) { setErro('A data final não pode ser antes da inicial.'); return; }

    const ev: EventoPessoal = {
      id:           editId ?? `ep_${Date.now()}`,
      tipo,
      nome:         nome.trim(),
      data_ini:     dataIni,
      data_fim:     temFim && dataFim ? dataFim : undefined,
      hora_ini:     !aniversario && horaIni ? horaIni : undefined,
      recorrencia,
      pessoa:       aniversario ? (pessoa.trim() || undefined) : undefined,
      relacao:      aniversario ? (relacao || undefined) : undefined,
      lembrete_dias: lembrete ? undefined : [],
      instituicao:  tipo === 'CURSO' ? (inst.trim() || undefined) : undefined,
      local:        tipo === 'COMPROMISSO' || tipo === 'CONSULTA' ? (local.trim() || undefined) : undefined,
      destino:      tipo === 'VIAGEM' ? (destino.trim() || undefined) : undefined,
      obs:          obs.trim() || undefined,
      updated_at:   new Date().toISOString(),
    };

    const all = await getEventosPessoais();
    await setEventosPessoais(editId ? all.map(e => (e.id === editId ? ev : e)) : [...all, ev]);
    analytics.track(editId ? 'event_updated' : 'event_created', { event_type: tipo, recorrencia });
    if (router.canGoBack()) router.back(); else router.replace('/proximos');
  };

  const del = () => {
    confirmarRemocao('Remover?', nome || pessoa || 'Este lembrete', async () => {
      if (editId) {
        const all = await getEventosPessoais();
        await setEventosPessoais(all.map(e => (e.id === editId ? { ...e, _deleted: true, updated_at: new Date().toISOString() } : e)));
        analytics.track('event_deleted', { event_type: tipo });
      }
      if (router.canGoBack()) router.back(); else router.replace('/proximos');
    });
  };

  const meta = EVENTO_VISUAL[tipo];

  return (
    <OWBackground>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          <Text style={styles.sectionLabel}>O que é?</Text>
          <View style={styles.chipRow}>
            {tiposVisiveis.map(t => {
              const m = EVENTO_VISUAL[t];
              const ativo = tipo === t;
              return (
                <TouchableOpacity
                  key={t}
                  style={[styles.chip, ativo && { backgroundColor: m.color + '22', borderColor: m.color }]}
                  onPress={() => escolherTipo(t)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: ativo }}
                >
                  <Ionicons name={m.icon} size={14} color={ativo ? m.color : colors.mutedDim} />
                  <Text style={[styles.chipText, ativo && { color: m.color }]}>{m.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Field label={aniversario ? 'Título (opcional)' : 'Título'} value={nome} onChange={v => { setNome(v); setErro(''); }} placeholder={PLACEHOLDER[tipo] ?? 'Ex.: Lembrar de…'} />

          {aniversario && (
            <>
              <Field label="Nome da pessoa (opcional)" value={pessoa} onChange={v => { setPessoa(v); setErro(''); }} placeholder="Ex.: Ana" />
              <Text style={styles.sectionLabel}>Relação (opcional)</Text>
              <View style={styles.chipRow}>
                {RELACOES_PESSOA.map(r => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.chip, relacao === r && styles.chipAtivo]}
                    onPress={() => setRelacao(relacao === r ? '' : r)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: relacao === r }}
                  >
                    <Text style={[styles.chipText, relacao === r && styles.chipTextAtivo]}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          <Text style={styles.sectionLabel}>{aniversario ? 'Data do aniversário' : temFim ? 'Início' : 'Data'}</Text>
          <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowDateIni(true)} accessibilityRole="button" accessibilityLabel="Escolher data">
            <Ionicons name="calendar-outline" size={16} color={meta.color} />
            <Text style={[styles.pickerText, !dataIni && styles.pickerPlaceholder]}>
              {dataIni ? (aniversario && recorrencia === 'anual' ? formatDateBR(dataIni).slice(0, 5) + ' · todo ano' : formatDateBR(dataIni)) : 'Selecionar data'}
            </Text>
          </TouchableOpacity>
          {fraseEscala ? (
            <View style={styles.escalaInfo}>
              <Ionicons name="boat-outline" size={13} color={colors.cyanDim} />
              <Text style={styles.escalaInfoText}>{fraseEscala}</Text>
            </View>
          ) : null}

          {temFim && (
            <>
              <Text style={styles.sectionLabel}>Até (opcional)</Text>
              <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowDateFim(true)} accessibilityRole="button">
                <Ionicons name="calendar-outline" size={16} color={colors.mutedDim} />
                <Text style={[styles.pickerText, !dataFim && styles.pickerPlaceholder]}>{dataFim ? formatDateBR(dataFim) : 'Mesmo dia'}</Text>
                {dataFim ? (
                  <TouchableOpacity onPress={() => setDataFim('')} hitSlop={8} accessibilityLabel="Limpar data final">
                    <Ionicons name="close-circle" size={16} color={colors.mutedDim} />
                  </TouchableOpacity>
                ) : null}
              </TouchableOpacity>
            </>
          )}

          {!aniversario && (
            <>
              <Text style={styles.sectionLabel}>Hora (opcional)</Text>
              <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowTimeIni(true)} accessibilityRole="button">
                <Ionicons name="time-outline" size={16} color={colors.mutedDim} />
                <Text style={[styles.pickerText, !horaIni && styles.pickerPlaceholder]}>{horaIni || 'Sem horário'}</Text>
                {horaIni ? (
                  <TouchableOpacity onPress={() => setHoraIni('')} hitSlop={8} accessibilityLabel="Limpar hora">
                    <Ionicons name="close-circle" size={16} color={colors.mutedDim} />
                  </TouchableOpacity>
                ) : null}
              </TouchableOpacity>
            </>
          )}

          {tipo === 'CURSO' && <Field label="Instituição (opcional)" value={inst} onChange={setInst} placeholder="Ex.: Falck, Senai" />}
          {(tipo === 'COMPROMISSO' || tipo === 'CONSULTA') && <Field label="Local (opcional)" value={local} onChange={setLocal} placeholder="Ex.: Clínica, endereço" />}
          {tipo === 'VIAGEM' && <Field label="Destino (opcional)" value={destino} onChange={setDestino} placeholder="Ex.: Búzios" />}

          <Text style={styles.sectionLabel}>Repetir</Text>
          <View style={styles.chipRow}>
            {([['nenhuma', 'Não repetir'], ['anual', 'Todo ano']] as const).map(([v, l]) => (
              <TouchableOpacity key={v} style={[styles.chip, recorrencia === v && styles.chipAtivo]} onPress={() => setRec(v)} accessibilityRole="button" accessibilityState={{ selected: recorrencia === v }}>
                <Text style={[styles.chipText, recorrencia === v && styles.chipTextAtivo]}>{l}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.sectionLabel}>Lembrete</Text>
          <View style={styles.chipRow}>
            <TouchableOpacity style={[styles.chip, lembrete && styles.chipAtivo]} onPress={() => setLembrete(true)} accessibilityRole="button" accessibilityState={{ selected: lembrete }}>
              <Text style={[styles.chipText, lembrete && styles.chipTextAtivo]}>{descreverPadrao(tipo)}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.chip, !lembrete && styles.chipAtivo]} onPress={() => setLembrete(false)} accessibilityRole="button" accessibilityState={{ selected: !lembrete }}>
              <Text style={[styles.chipText, !lembrete && styles.chipTextAtivo]}>Sem lembrete</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.hint}>Os avisos no celular seguem Meu Buddy → Lembretes (Datas importantes).</Text>

          <Field label="Observação (opcional)" value={obs} onChange={setObs} placeholder="Só você vê" multiline />

          {erro ? <Text style={styles.erro} accessibilityLiveRegion="polite">{erro}</Text> : null}

          <TouchableOpacity style={[styles.saveBtn, { backgroundColor: meta.color }]} onPress={save} accessibilityRole="button">
            <Ionicons name="checkmark" size={18} color={colors.navy950} />
            <Text style={styles.saveBtnText}>{isEdit ? 'Salvar alterações' : 'Salvar'}</Text>
          </TouchableOpacity>

          {isEdit && aniversario && (
            <TouchableOpacity style={styles.secundario} onPress={() => { analytics.track('gift_ideas_opened', { origem: 'cadastro' }); router.push({ pathname: '/presentes', params: { evento: editId ?? '' } }); }} accessibilityRole="button">
              <Ionicons name="gift-outline" size={16} color={colors.cyanDim} />
              <Text style={styles.secundarioTexto}>Ver ideias de presente</Text>
            </TouchableOpacity>
          )}
          {isEdit && (
            <TouchableOpacity style={styles.secundario} onPress={del} accessibilityRole="button">
              <Ionicons name="trash-outline" size={16} color={colors.red} />
              <Text style={[styles.secundarioTexto, { color: colors.red }]}>Remover</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <OWDatePicker visible={showDateIni} value={dataIni} title={aniversario ? 'Data do aniversário' : 'Data'}
        onConfirm={v => { setDataIni(v); setShowDateIni(false); setErro(''); }} onCancel={() => setShowDateIni(false)} />
      <OWDatePicker visible={showDateFim} value={dataFim || dataIni} title="Até"
        onConfirm={v => { setDataFim(v); setShowDateFim(false); }} onCancel={() => setShowDateFim(false)} />
      <OWTimePicker visible={showTimeIni} value={horaIni}
        onConfirm={v => { setHoraIni(v); setShowTimeIni(false); }} onCancel={() => setShowTimeIni(false)} />
    </OWBackground>
  );
}

function Field({
  label, value, onChange, placeholder, multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  return (
    <>
      <Text style={styles.sectionLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && { minHeight: 72, textAlignVertical: 'top' }]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedDim}
        multiline={multiline}
        maxLength={multiline ? 300 : 80}
        accessibilityLabel={label}
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: spacing.xxl * 2 },
  sectionLabel: { ...typography.micro, marginTop: spacing.md, marginBottom: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 40,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.xl,
    borderWidth: 1, borderColor: maritime.glassBorder, backgroundColor: maritime.glass,
  },
  chipAtivo: { backgroundColor: colors.cyanFaint, borderColor: colors.cyan },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.muted },
  chipTextAtivo: { color: colors.cyan },
  input: {
    backgroundColor: maritime.sunken, borderRadius: radius.md, borderWidth: 1, borderColor: maritime.fieldBorder,
    paddingHorizontal: spacing.md, paddingVertical: 12, color: colors.white, fontSize: 15,
  },
  pickerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48,
    backgroundColor: maritime.sunken, borderRadius: radius.md, borderWidth: 1, borderColor: maritime.fieldBorder,
    paddingHorizontal: spacing.md,
  },
  pickerText: { flex: 1, fontSize: 15, color: colors.white },
  pickerPlaceholder: { color: colors.mutedDim },
  escalaInfo: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, paddingHorizontal: 4 },
  escalaInfoText: { fontSize: 13, color: colors.cyanDim, fontWeight: '600' },
  hint: { fontSize: 12, color: colors.mutedDim, marginTop: 6 },
  erro: { color: colors.red, fontSize: 13, marginTop: spacing.md, fontWeight: '600' },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    minHeight: 52, borderRadius: radius.md, marginTop: spacing.lg,
  },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: colors.navy950 },
  secundario: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 48, marginTop: spacing.sm },
  secundarioTexto: { fontSize: 14, fontWeight: '600', color: colors.cyanDim },
});
