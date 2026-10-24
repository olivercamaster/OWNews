/**
 * Registrar / editar embarque do Meu Histórico.
 *   ?sugestao=1  → revisão do ciclo atual sugerido pela escala (pré-preenchido, a pessoa confirma).
 *   ?id=…        → edição (corrigir datas recalcula dias, ano e ordem — a escala não muda).
 *   ?finalizar=1 → edição focada no desembarque real.
 * Essencial primeiro (datas e unidade); "Adicionar detalhes" abre função, empresa e observação.
 */
import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  diasEmbarcado,
  diasEntreISO,
  getAeroporto,
  getViagemResumo,
  hojeISO,
  importarViagem,
  nomeRegistro,
  periodoCurto,
  registrarDobra,
  registroDuplicado,
  registroSobreposto,
  removerRegistro,
  salvarAcontecimento,
  salvarRegistro,
  sugestaoCicloAtual,
  sugestoesCampo,
  textoDias,
  viagemDoRegistro,
} from '@owbuddy/domain';
import type { EscalaConfig, HistoricoData, RegistroEmbarque, Viagem } from '@owbuddy/domain';
import { alterarHistorico, getEscala, getHistorico, getViagem } from '../src/storage';
import { OWBackground } from '../src/components/OWBackground';
import { OWDatePicker } from '../src/components/OWDatePicker';
import { colors, maritime, radius, spacing, typography, themed } from '../src/theme';
import { useTema } from '../src/tema';
import { formatDateBR } from '../src/format';
import { confirmarRemocao, perguntar } from '../src/confirmar';
import { useAcaoUnica } from '../src/acoes';
import { avisar } from '../src/feedback';
import { analytics } from '../src/analytics';
import { novoIdHistorico } from '../src/historico-acoes';

const ddmm = (iso: string) => formatDateBR(iso).slice(0, 5);

export default function FormEmbarque() {
  useTema();
  const params = useLocalSearchParams<{ id?: string; sugestao?: string; finalizar?: string }>();
  const edicao = !!params.id;
  const daSugestao = params.sugestao === '1' && !edicao;

  const [regId, setRegId] = useState(() => params.id ?? novoIdHistorico('he'));
  const [hist, setHist] = useState<HistoricoData | null>(null);
  const [escala, setEscalaCfg] = useState<EscalaConfig | null>(null);
  const [viagem, setViagem] = useState<Viagem | null>(null);
  const [original, setOriginal] = useState<RegistroEmbarque | null>(null);

  const [embarque, setEmbarque] = useState('');
  const [desembarque, setDesembarque] = useState('');
  const [unidade, setUnidade] = useState('');
  const [funcao, setFuncao] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [obs, setObs] = useState('');
  const [detalhes, setDetalhes] = useState(false);
  const [previsto, setPrevisto] = useState<RegistroEmbarque['previsto']>(undefined);
  const [usarViagem, setUsarViagem] = useState(true);
  const [usarBase, setUsarBase] = useState(false);
  const [dobra, setDobra] = useState<boolean | null>(null);
  const [erro, setErro] = useState('');
  const [salvo, setSalvo] = useState<RegistroEmbarque | null>(null);
  const [pick, setPick] = useState<'emb' | 'des' | null>(null);

  useEffect(() => {
    (async () => {
      const [h, esc, v] = await Promise.all([getHistorico(), getEscala(), getViagem()]);
      setHist(h); setEscalaCfg(esc); setViagem(v);
      if (params.id) {
        const r = h.registros.find(x => x.id === params.id);
        if (!r) return;
        setOriginal(r);
        setEmbarque(r.embarque);
        setDesembarque(r.desembarque ?? (params.finalizar === '1' ? (r.previsto?.desembarque ?? hojeISO()) : ''));
        setUnidade(r.unidade ?? ''); setFuncao(r.funcao ?? ''); setEmpresa(r.empresa ?? ''); setObs(r.obs ?? '');
        setDetalhes(!!(r.funcao || r.empresa || r.obs));
        setPrevisto(r.previsto);
        if (params.finalizar === '1') setPick('des');
      } else if (params.sugestao === '1') {
        const s = sugestaoCicloAtual(esc, h.registros, new Date());
        if (s) {
          setEmbarque(s.embarquePrevisto);
          // Ciclo em curso: desembarque fica em aberto (em andamento). Ciclo que acabou: sugere o previsto.
          setDesembarque(s.momento === 'ultimo' ? s.desembarquePrevisto : '');
          setPrevisto({ embarque: s.embarquePrevisto, desembarque: s.desembarquePrevisto });
        }
      }
    })();
  }, [params.id, params.sugestao, params.finalizar]);

  const registros = hist?.registros ?? [];
  const aeroporto = escala?.aeroporto ? getAeroporto(escala.aeroporto) : undefined;
  const rascunho = useMemo(() => ({
    id: regId, embarque, desembarque: desembarque || null, previsto,
  }), [regId, embarque, desembarque, previsto]);
  const viagemDoCiclo = daSugestao && viagem && embarque
    ? viagemDoRegistro(viagem, { ...rascunho, fonte: 'escala', criado_em: '', updated_at: '' })
    : false;
  const dias = embarque && desembarque && desembarque >= embarque ? diasEmbarcado({ embarque, desembarque }) : null;
  const atraso = previsto?.desembarque && desembarque ? diasEntreISO(previsto.desembarque, desembarque) : 0;
  const jaTemDobra = !!hist?.acontecimentos.some(a => a.registroId === regId && a.tipo === 'DOBRA');

  const limpar = () => {
    setRegId(novoIdHistorico('he'));
    setEmbarque(''); setDesembarque(''); setUnidade(''); setFuncao(''); setEmpresa(''); setObs('');
    setDetalhes(false); setPrevisto(undefined); setDobra(null); setErro(''); setSalvo(null); setOriginal(null);
  };

  const [salvar, ocupado] = useAcaoUnica(async () => {
    setErro('');
    if (!embarque) { setErro('Escolha a data do embarque.'); return; }
    if (desembarque && desembarque < embarque) { setErro('O desembarque não pode ser antes do embarque.'); return; }
    const hoje = hojeISO();
    let des: string | null = desembarque || null;
    let prev = previsto ? { ...previsto } : undefined;
    let planejado = false;

    // Data futura: nunca vira "realizado" em silêncio.
    if (embarque > hoje) {
      if (!(await perguntar('Essa data ainda não chegou.', 'O registro fica como Planejado até você confirmar que aconteceu. Salvar mesmo assim?', 'Salvar'))) return;
      planejado = true;
    } else if (des && des > hoje) {
      if (!(await perguntar('Essa data ainda não chegou.', `O desembarque de ${ddmm(des)} fica como previsto e o embarque segue em andamento até você confirmar. Salvar mesmo assim?`, 'Salvar'))) return;
      prev = { ...(prev ?? {}), desembarque: des };
      des = null;
    }

    const atual = await getHistorico();
    const dup = registroDuplicado(atual, { id: regId, embarque, desembarque: des, unidade });
    if (dup) {
      if (!(await perguntar('Esse embarque já parece estar no histórico.', `${nomeRegistro(dup)} · ${periodoCurto(dup)}. Salvar outro mesmo assim?`, 'Salvar mesmo assim', 'Revisar'))) return;
    } else {
      const sob = registroSobreposto(atual, { id: regId, embarque, desembarque: des }, hoje);
      if (sob && !(await perguntar('Esse período se sobrepõe a outro registro.', `${nomeRegistro(sob)} · ${periodoCurto(sob)}.`, 'Salvar mesmo assim', 'Revisar'))) return;
    }

    const agora = new Date().toISOString();
    const reg: RegistroEmbarque = {
      id: regId,
      embarque,
      desembarque: des,
      unidade: unidade.trim() || undefined,
      funcao: funcao.trim() || undefined,
      empresa: empresa.trim() || undefined,
      obs: obs.trim() || undefined,
      planejado: planejado || undefined,
      previsto: prev && (prev.embarque || prev.desembarque) ? prev : undefined,
      fonte: original?.fonte ?? (daSugestao ? 'escala' : 'manual'),
      criado_em: original?.criado_em ?? agora,
      updated_at: agora,
    };

    const final = await alterarHistorico(h => {
      let n = salvarRegistro(h, reg, agora);
      if (daSugestao && usarViagem && viagem && viagemDoCiclo) n = importarViagem(n, regId, viagem, hoje, agora);
      if (daSugestao && usarBase && aeroporto) {
        n = salvarAcontecimento(n, { id: `${regId}_base`, registroId: regId, tipo: 'BASE', data: embarque, local: `${aeroporto.code} · ${aeroporto.nome}` }, agora);
      }
      if (dobra === true) n = registrarDobra(n, regId, agora);
      return n;
    });
    setHist(final);

    if (edicao) {
      analytics.track('embarque_editado', { origem: 'formulario' });
      avisar('Atualizado');
      if (router.canGoBack()) router.back(); else router.replace({ pathname: '/historico-registro', params: { id: regId } });
      return;
    }
    if (daSugestao) analytics.track('embarque_registrado', { origem: 'sugestao' });
    else analytics.track('embarque_registrado', { origem: 'manual' });
    avisar('Registrado');
    setSalvo(final.registros.find(r => r.id === regId) ?? reg);
  });

  const excluir = () => {
    confirmarRemocao('Excluir este registro do histórico?', 'Isso não altera sua escala atual.', async () => {
      await alterarHistorico(h => removerRegistro(h, regId));
      analytics.track('embarque_excluido');
      avisar('Excluído');
      router.dismissTo('/historico');
    });
  };

  const titulo = edicao ? (params.finalizar === '1' ? 'Registrar desembarque' : 'Editar embarque') : daSugestao ? 'Revisar ciclo atual' : 'Registrar embarque';

  if (salvo) {
    return (
      <OWBackground>
        <Stack.Screen options={{ title: titulo }} />
        <View style={styles.salvo}>
          <Ionicons name="checkmark-circle-outline" size={40} color={colors.green} />
          <Text style={styles.salvoTitulo}>{nomeRegistro(salvo)}</Text>
          <Text style={styles.salvoSub}>
            {periodoCurto(salvo)}{salvo.desembarque ? ` · ${textoDias(diasEmbarcado(salvo) ?? 0)}` : salvo.planejado ? ' · planejado' : ' · em andamento'}
          </Text>
          <TouchableOpacity style={styles.saveBtn} onPress={() => router.replace({ pathname: '/historico-registro', params: { id: salvo.id } })} accessibilityRole="button">
            <Text style={styles.saveBtnText}>Ver registro</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secundario} onPress={limpar} accessibilityRole="button">
            <Ionicons name="add" size={18} color={colors.cyanDim} />
            <Text style={styles.secundarioTexto}>Registrar outro</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secundario} onPress={() => router.dismissTo('/historico')} accessibilityRole="button">
            <Text style={[styles.secundarioTexto, { color: colors.muted }]}>Voltar ao histórico</Text>
          </TouchableOpacity>
        </View>
      </OWBackground>
    );
  }

  const sugUnidade = sugestoesCampo(registros, 'unidade').filter(u => u !== unidade.trim());
  const sugFuncao = sugestoesCampo(registros, 'funcao').filter(u => u !== funcao.trim());
  const sugEmpresa = sugestoesCampo(registros, 'empresa').filter(u => u !== empresa.trim());

  return (
    <OWBackground>
      <Stack.Screen options={{ title: titulo }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          {daSugestao && previsto?.embarque ? (
            <View style={styles.encontrado}>
              <Text style={styles.encontradoKicker}>O Buddy já sabe</Text>
              <Check texto={`Embarque previsto · ${ddmm(previsto.embarque)}`} />
              {previsto.desembarque ? <Check texto={`Desembarque previsto · ${ddmm(previsto.desembarque)}`} /> : null}
              {viagem && viagemDoCiclo ? (
                <Opcao ativo={usarViagem} onPress={() => setUsarViagem(v => !v)}
                  texto={`Viagem · ${getViagemResumo(viagem)} · ${ddmm(viagem.data)}${viagem.hora ? ` ${viagem.hora}` : ''}`} />
              ) : null}
              {aeroporto ? (
                <Opcao ativo={usarBase} onPress={() => setUsarBase(v => !v)} texto={`Base · ${aeroporto.code} ${aeroporto.nome}`} />
              ) : null}
              <Text style={styles.encontradoNota}>Previsto não é realizado: confira as datas reais abaixo. Sua escala não muda.</Text>
            </View>
          ) : null}

          <Text style={styles.label}>Embarque</Text>
          <TouchableOpacity style={styles.pickerBtn} onPress={() => setPick('emb')} accessibilityRole="button" accessibilityLabel="Data real do embarque">
            <Ionicons name="calendar-outline" size={16} color={colors.green} />
            <Text style={[styles.pickerText, !embarque && styles.pickerPlaceholder]}>{embarque ? formatDateBR(embarque) : 'Data do embarque'}</Text>
          </TouchableOpacity>
          {previsto?.embarque && embarque && embarque !== previsto.embarque ? (
            <Text style={styles.nota}>Previsto pela escala: {ddmm(previsto.embarque)}. Aqui fica a data real.</Text>
          ) : null}

          <Text style={styles.label}>Desembarque</Text>
          <TouchableOpacity style={styles.pickerBtn} onPress={() => setPick('des')} accessibilityRole="button" accessibilityLabel="Data real do desembarque">
            <Ionicons name="calendar-outline" size={16} color={colors.amber} />
            <Text style={[styles.pickerText, !desembarque && styles.pickerPlaceholder]}>{desembarque ? formatDateBR(desembarque) : 'Ainda embarcado'}</Text>
            {desembarque ? (
              <TouchableOpacity onPress={() => { setDesembarque(''); setDobra(null); }} hitSlop={8} accessibilityRole="button" accessibilityLabel="Ainda embarcado (limpar desembarque)">
                <Ionicons name="close-circle" size={16} color={colors.mutedDim} />
              </TouchableOpacity>
            ) : null}
          </TouchableOpacity>
          {!desembarque && previsto?.desembarque ? (
            <Text style={styles.nota}>Desembarque previsto: {ddmm(previsto.desembarque)}. Você registra quando acontecer.</Text>
          ) : null}
          {dias != null ? <Text style={styles.dias}>{textoDias(dias)}</Text> : null}

          {atraso > 0 && !jaTemDobra ? (
            <View style={styles.dobra}>
              <Text style={styles.dobraTexto}>Seu desembarque foi {atraso === 1 ? '1 dia' : `${atraso} dias`} depois do previsto.</Text>
              <View style={styles.chipRow}>
                <Chip ativo={dobra === true} onPress={() => setDobra(true)} texto="Registrar como dobra" />
                <Chip ativo={dobra === false} onPress={() => setDobra(false)} texto="Não" />
              </View>
            </View>
          ) : null}

          <Campo label="Unidade / local (opcional)" value={unidade} onChange={setUnidade} placeholder="Ex.: West Jupiter, P-80" />
          {sugUnidade.length ? <Sugestoes itens={sugUnidade} onEscolher={setUnidade} /> : null}

          {!detalhes ? (
            <TouchableOpacity style={styles.detalhesBtn} onPress={() => setDetalhes(true)} accessibilityRole="button">
              <Ionicons name="add" size={16} color={colors.cyanDim} />
              <Text style={styles.detalhesTexto}>Adicionar detalhes (função, empresa, observação)</Text>
            </TouchableOpacity>
          ) : (
            <>
              <Campo label="Função neste embarque (opcional)" value={funcao} onChange={setFuncao} placeholder="Ex.: Guindasteiro" />
              {sugFuncao.length ? <Sugestoes itens={sugFuncao} onEscolher={setFuncao} /> : null}
              <Campo label="Empresa (opcional)" value={empresa} onChange={setEmpresa} placeholder="Ex.: a empresa deste embarque" />
              {sugEmpresa.length ? <Sugestoes itens={sugEmpresa} onEscolher={setEmpresa} /> : null}
              <Campo label="Observação (opcional)" value={obs} onChange={setObs} placeholder="Ex.: Desembarque atrasado por meteorologia" multiline />
            </>
          )}

          {erro ? <Text style={styles.erro} accessibilityLiveRegion="polite">{erro}</Text> : null}

          <TouchableOpacity style={[styles.saveBtn, ocupado && { opacity: 0.6 }]} onPress={salvar} disabled={ocupado} accessibilityRole="button">
            <Ionicons name="checkmark" size={18} color={colors.onAccent} />
            <Text style={styles.saveBtnText}>{edicao ? 'Salvar alterações' : 'Registrar'}</Text>
          </TouchableOpacity>
          <Text style={styles.rodape}>Fica só neste aparelho. Registrar aqui não altera sua escala.</Text>

          {edicao ? (
            <TouchableOpacity style={styles.secundario} onPress={excluir} accessibilityRole="button">
              <Ionicons name="trash-outline" size={16} color={colors.red} />
              <Text style={[styles.secundarioTexto, { color: colors.red }]}>Excluir registro</Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <OWDatePicker visible={pick === 'emb'} value={embarque} title="Embarque" anosAtras={40}
        onConfirm={v => { setEmbarque(v); setPick(null); setErro(''); }} onCancel={() => setPick(null)} />
      <OWDatePicker visible={pick === 'des'} value={desembarque || embarque} title="Desembarque" anosAtras={40}
        onConfirm={v => { setDesembarque(v); setPick(null); setErro(''); }} onCancel={() => setPick(null)} />
    </OWBackground>
  );
}

function Check({ texto }: { texto: string }) {
  useTema();
  return (
    <View style={styles.checkLinha}>
      <Ionicons name="checkmark" size={15} color={colors.green} />
      <Text style={styles.checkTexto}>{texto}</Text>
    </View>
  );
}

function Opcao({ ativo, onPress, texto }: { ativo: boolean; onPress: () => void; texto: string }) {
  useTema();
  return (
    <TouchableOpacity style={styles.checkLinha} onPress={onPress} accessibilityRole="checkbox" accessibilityState={{ checked: ativo }}>
      <Ionicons name={ativo ? 'checkbox' : 'square-outline'} size={17} color={ativo ? colors.cyan : colors.mutedDim} />
      <Text style={styles.checkTexto}>{texto}</Text>
    </TouchableOpacity>
  );
}

function Chip({ ativo, onPress, texto }: { ativo: boolean; onPress: () => void; texto: string }) {
  useTema();
  return (
    <TouchableOpacity style={[styles.chip, ativo && styles.chipAtivo]} onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: ativo }}>
      <Text style={[styles.chipText, ativo && styles.chipTextAtivo]}>{texto}</Text>
    </TouchableOpacity>
  );
}

function Sugestoes({ itens, onEscolher }: { itens: string[]; onEscolher: (v: string) => void }) {
  useTema();
  return (
    <View style={[styles.chipRow, { marginTop: 6 }]}>
      {itens.map(i => (
        <TouchableOpacity key={i} style={styles.sugestao} onPress={() => onEscolher(i)} accessibilityRole="button" accessibilityLabel={`Usar ${i}`}>
          <Text style={styles.sugestaoTexto} numberOfLines={1}>{i}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function Campo({ label, value, onChange, placeholder, multiline }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean;
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
        maxLength={multiline ? 200 : 80}
        accessibilityLabel={label}
      />
    </>
  );
}

const styles = themed(() => StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: spacing.xxl * 2 },
  label: { ...typography.micro, marginTop: spacing.md, marginBottom: spacing.sm },
  encontrado: {
    backgroundColor: maritime.glass, borderRadius: radius.lg, padding: spacing.md, gap: 6,
    borderWidth: 1, borderColor: maritime.glassBorder, borderTopColor: maritime.edgeLight,
  },
  encontradoKicker: { fontSize: 11, fontWeight: '700', color: colors.kicker, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 2 },
  encontradoNota: { fontSize: 12, color: colors.mutedDim, marginTop: 4 },
  checkLinha: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 32 },
  checkTexto: { flex: 1, fontSize: 14, color: colors.white },
  pickerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48,
    backgroundColor: maritime.field, borderRadius: radius.md, borderWidth: 1, borderColor: maritime.fieldBorder,
    paddingHorizontal: spacing.md,
  },
  pickerText: { flex: 1, fontSize: 15, color: colors.white, fontVariant: ['tabular-nums'] },
  pickerPlaceholder: { color: colors.mutedDim },
  nota: { fontSize: 12, color: colors.muted, marginTop: 6, paddingHorizontal: 2 },
  dias: { fontSize: 15, fontWeight: '700', color: colors.white, marginTop: spacing.sm, fontVariant: ['tabular-nums'] },
  dobra: {
    marginTop: spacing.sm, padding: spacing.md, borderRadius: radius.md, gap: spacing.sm,
    backgroundColor: maritime.glass, borderWidth: 1, borderColor: maritime.glassBorder,
  },
  dobraTexto: { fontSize: 14, color: colors.white },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minHeight: 40, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.xl, justifyContent: 'center',
    borderWidth: 1, borderColor: maritime.glassBorder, backgroundColor: maritime.glass,
  },
  chipAtivo: { backgroundColor: colors.cyanFaint, borderColor: colors.cyan },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.muted },
  chipTextAtivo: { color: colors.cyan },
  sugestao: {
    minHeight: 32, paddingHorizontal: 10, borderRadius: radius.xl, justifyContent: 'center', maxWidth: 200,
    borderWidth: 1, borderColor: maritime.glassBorder, borderStyle: 'dashed',
  },
  sugestaoTexto: { fontSize: 13, color: colors.muted },
  input: {
    backgroundColor: maritime.field, borderRadius: radius.md, borderWidth: 1, borderColor: maritime.fieldBorder,
    paddingHorizontal: spacing.md, paddingVertical: 12, color: colors.white, fontSize: 15,
  },
  detalhesBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, marginTop: spacing.sm },
  detalhesTexto: { fontSize: 14, fontWeight: '600', color: colors.cyanDim, flexShrink: 1 },
  erro: { color: colors.red, fontSize: 13, marginTop: spacing.md, fontWeight: '600' },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, alignSelf: 'stretch',
    minHeight: 52, borderRadius: radius.md, marginTop: spacing.lg, backgroundColor: colors.cyan, ...maritime.botaoPrimario,
  },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: colors.onAccent },
  rodape: { fontSize: 12, color: colors.mutedDim, textAlign: 'center', marginTop: spacing.sm },
  secundario: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 48, marginTop: spacing.sm },
  secundarioTexto: { fontSize: 14, fontWeight: '600', color: colors.cyanDim },
  salvo: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.xs },
  salvoTitulo: { ...typography.h2, textAlign: 'center', marginTop: spacing.sm },
  salvoSub: { ...typography.small, textAlign: 'center', fontVariant: ['tabular-nums'] },
}));
