import { useEffect, useState } from 'react';
import {
  Alert,
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
import type { EventoTipo, EventoPessoal } from '@owbuddy/domain';
import { getEventosPessoais, setEventosPessoais } from '../src/storage';
import { OWDatePicker } from '../src/components/OWDatePicker';
import { OWTimePicker } from '../src/components/OWTimePicker';
import { OWBackground } from '../src/components/OWBackground';
import { colors, spacing, radius, typography, surface, maritime } from '../src/theme';
import { formatDateBR } from '../src/format';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const TIPOS: { tipo: EventoTipo; label: string; icon: IoniconsName; color: string }[] = [
  { tipo: 'VIAGEM',       label: 'Viagem',      icon: 'airplane-outline',                   color: colors.cyan },
  { tipo: 'CURSO',        label: 'Curso',        icon: 'school-outline',                     color: colors.amber },
  { tipo: 'DATA_ESPECIAL',label: 'Data Especial',icon: 'star-outline',                       color: '#ce93d8' },
  { tipo: 'COMPROMISSO',  label: 'Compromisso',  icon: 'calendar-outline',                   color: colors.orange },
  { tipo: 'OUTRO',        label: 'Outro',        icon: 'ellipsis-horizontal-circle-outline', color: colors.mutedDim },
];

function tipoMeta(tipo: EventoTipo) {
  return TIPOS.find(t => t.tipo === tipo) ?? TIPOS[4]!;
}

export default function EscalaEventoForm() {
  const params = useLocalSearchParams<{ data?: string; id?: string }>();
  const isEdit = !!params.id;

  const [tipo, setTipo]         = useState<EventoTipo>('DATA_ESPECIAL');
  const [nome, setNome]         = useState('');
  const [dataIni, setDataIni]   = useState(params.data ?? '');
  const [dataFim, setDataFim]   = useState('');
  const [horaIni, setHoraIni]   = useState('');
  const [horaFim, setHoraFim]   = useState('');
  const [destino, setDestino]   = useState('');
  const [inst, setInst]         = useState('');
  const [local, setLocal]       = useState('');
  const [obs, setObs]           = useState('');
  const [editId, setEditId]     = useState<string | null>(null);

  const [showDateIni, setShowDateIni] = useState(false);
  const [showDateFim, setShowDateFim] = useState(false);
  const [showTimeIni, setShowTimeIni] = useState(false);
  const [showTimeFim, setShowTimeFim] = useState(false);

  useEffect(() => {
    if (!params.id) return;
    getEventosPessoais().then(all => {
      const ev = all.find(e => e.id === params.id);
      if (!ev) return;
      setEditId(ev.id);
      setTipo(ev.tipo);
      setNome(ev.nome);
      setDataIni(ev.data_ini);
      setDataFim(ev.data_fim ?? '');
      setHoraIni(ev.hora_ini ?? '');
      setHoraFim(ev.hora_fim ?? '');
      setDestino(ev.destino ?? '');
      setInst(ev.instituicao ?? '');
      setLocal(ev.local ?? '');
      setObs(ev.obs ?? '');
    });
  }, [params.id]);

  const save = async () => {
    if (!nome.trim()) { Alert.alert('Atenção', 'Nome é obrigatório.'); return; }
    if (!dataIni)      { Alert.alert('Atenção', 'Data de início é obrigatória.'); return; }

    const ev: EventoPessoal = {
      id:          editId ?? `ep_${Date.now()}`,
      tipo,
      nome:        nome.trim(),
      data_ini:    dataIni,
      data_fim:    dataFim || undefined,
      hora_ini:    horaIni || undefined,
      hora_fim:    horaFim || undefined,
      destino:     tipo === 'VIAGEM'       ? (destino.trim() || undefined) : undefined,
      instituicao: tipo === 'CURSO'        ? (inst.trim()    || undefined) : undefined,
      local:       tipo === 'COMPROMISSO'  ? (local.trim()   || undefined) : undefined,
      obs:         obs.trim() || undefined,
      updated_at:  new Date().toISOString(),
    };

    const all = await getEventosPessoais();
    if (editId) {
      await setEventosPessoais(all.map(e => e.id === editId ? ev : e));
    } else {
      await setEventosPessoais([...all, ev]);
    }
    router.back();
  };

  const del = () => {
    Alert.alert('Remover evento', `Remover "${nome}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover', style: 'destructive',
        onPress: async () => {
          if (!editId) { router.back(); return; }
          const all = await getEventosPessoais();
          await setEventosPessoais(
            all.map(e => e.id === editId ? { ...e, _deleted: true, updated_at: new Date().toISOString() } : e)
          );
          router.back();
        },
      },
    ]);
  };

  const meta = tipoMeta(tipo);

  return (
    <OWBackground>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          {/* Header */}
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
              <Ionicons name="arrow-back" size={22} color={colors.muted} />
            </TouchableOpacity>
            <Text style={styles.title}>{isEdit ? 'Editar evento' : 'Novo evento'}</Text>
            {isEdit
              ? <TouchableOpacity onPress={del} hitSlop={12}><Ionicons name="trash-outline" size={20} color={colors.mutedDim} /></TouchableOpacity>
              : <View style={{ width: 22 }} />
            }
          </View>

          {/* Tipo chips */}
          <Text style={styles.fieldLabel}>Tipo</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tipoScroll}>
            {TIPOS.map(t => (
              <TouchableOpacity
                key={t.tipo}
                style={[styles.tipoChip, tipo === t.tipo && { borderColor: t.color, backgroundColor: t.color + '22' }]}
                onPress={() => setTipo(t.tipo)}
              >
                <Ionicons name={t.icon} size={14} color={tipo === t.tipo ? t.color : colors.mutedDim} />
                <Text style={[styles.tipoChipText, tipo === t.tipo && { color: t.color }]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Nome */}
          <Field
            label="Nome *"
            value={nome}
            onChange={setNome}
            placeholder={
              tipo === 'VIAGEM' ? 'Ex: Viagem ao Rio'
              : tipo === 'CURSO' ? 'Ex: OPITO BOSIET'
              : tipo === 'COMPROMISSO' ? 'Ex: Reunião médica'
              : 'Ex: Aniversário da mãe'
            }
          />

          {/* Destino — só VIAGEM */}
          {tipo === 'VIAGEM' && (
            <Field label="Destino" value={destino} onChange={setDestino} placeholder="Ex: Rio de Janeiro" />
          )}

          {/* Instituição — só CURSO */}
          {tipo === 'CURSO' && (
            <Field label="Instituição" value={inst} onChange={setInst} placeholder="Ex: SENAI, PETROBRAS..." />
          )}

          {/* Local — só COMPROMISSO */}
          {tipo === 'COMPROMISSO' && (
            <Field label="Local" value={local} onChange={setLocal} placeholder="Ex: Hospital, Cartório..." />
          )}

          {/* Datas */}
          <View style={styles.dateRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Data início *</Text>
              <TouchableOpacity style={styles.dateBtn} onPress={() => setShowDateIni(true)}>
                <Ionicons name="calendar-outline" size={14} color={colors.cyanDim} />
                <Text style={[styles.dateBtnText, !dataIni && { color: colors.mutedDim }]}>
                  {dataIni ? formatDateBR(dataIni) : 'Selecionar'}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Data fim</Text>
              <TouchableOpacity style={styles.dateBtn} onPress={() => setShowDateFim(true)}>
                <Ionicons name="calendar-outline" size={14} color={colors.mutedDim} />
                <Text style={[styles.dateBtnText, !dataFim && { color: colors.mutedDim }]}>
                  {dataFim ? formatDateBR(dataFim) : 'Opcional'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Horários */}
          <View style={styles.dateRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Hora início</Text>
              <TouchableOpacity style={styles.dateBtn} onPress={() => setShowTimeIni(true)}>
                <Ionicons name="time-outline" size={14} color={colors.mutedDim} />
                <Text style={[styles.dateBtnText, !horaIni && { color: colors.mutedDim }]}>
                  {horaIni || 'Opcional'}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Hora fim</Text>
              <TouchableOpacity style={styles.dateBtn} onPress={() => setShowTimeFim(true)}>
                <Ionicons name="time-outline" size={14} color={colors.mutedDim} />
                <Text style={[styles.dateBtnText, !horaFim && { color: colors.mutedDim }]}>
                  {horaFim || 'Opcional'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Obs */}
          <Field label="Observações" value={obs} onChange={setObs} placeholder="Notas livres..." multiline />

          {/* Botões */}
          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.btnCancel} onPress={() => router.back()}>
              <Text style={styles.btnCancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btnSave, { backgroundColor: meta.color }]} onPress={save}>
              <Ionicons name={meta.icon} size={16} color={colors.navy950} />
              <Text style={styles.btnSaveText}>Salvar</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      <OWDatePicker visible={showDateIni} value={dataIni} title="Data início"
        onConfirm={v => { setDataIni(v); setShowDateIni(false); }} onCancel={() => setShowDateIni(false)} />
      <OWDatePicker visible={showDateFim} value={dataFim || dataIni} title="Data fim"
        onConfirm={v => { setDataFim(v); setShowDateFim(false); }} onCancel={() => setShowDateFim(false)} />
      <OWTimePicker visible={showTimeIni} value={horaIni}
        onConfirm={v => { setHoraIni(v); setShowTimeIni(false); }} onCancel={() => setShowTimeIni(false)} />
      <OWTimePicker visible={showTimeFim} value={horaFim}
        onConfirm={v => { setHoraFim(v); setShowTimeFim(false); }} onCancel={() => setShowTimeFim(false)} />
    </OWBackground>
  );
}

function Field({
  label, value, onChange, placeholder, multiline,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMulti]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedDim}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: spacing.xxl },

  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  title: { ...typography.h2 },

  tipoScroll: { marginBottom: spacing.md },
  tipoChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: spacing.sm, paddingVertical: 6,
    borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line,
    marginRight: spacing.sm, backgroundColor: surface.card,
  },
  tipoChipText: { fontSize: 12, fontWeight: '600', color: colors.mutedDim },

  fieldWrap: { marginBottom: spacing.sm },
  fieldLabel: { ...typography.micro, marginBottom: 4 },
  input: {
    backgroundColor: surface.card, borderRadius: radius.sm,
    padding: spacing.sm, paddingHorizontal: 12,
    color: colors.white, fontSize: 15,
    borderWidth: 1, borderColor: colors.line,
  },
  inputMulti: { minHeight: 72, textAlignVertical: 'top' },

  dateRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  dateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: surface.card, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.line,
    padding: spacing.sm, paddingHorizontal: 12,
  },
  dateBtnText: { fontSize: 14, fontWeight: '500', color: colors.white, flex: 1 },

  btnRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  btnCancel: {
    flex: 1, padding: spacing.md, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.line, alignItems: 'center',
  },
  btnCancelText: { color: colors.muted, fontWeight: '600' },
  btnSave: {
    flex: 2, padding: spacing.md, borderRadius: radius.md,
    alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8,
  },
  btnSaveText: { color: colors.navy950, fontWeight: '700', fontSize: 16 },
});
