/**
 * Um registro do Meu Histórico: datas reais, dias embarcado e a LINHA DO TEMPO (antes do
 * embarque, durante e depois do desembarque). Editar, excluir e voltar sempre visíveis —
 * nada depende de gesto escondido.
 */
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  LABEL_ACONTECIMENTO_HIST,
  diaRegistrado,
  diasEmbarcado,
  estadoRegistro,
  getViagemResumo,
  hojeISO,
  importarViagem,
  linhaDoTempo,
  nomeRegistro,
  pendenciaFinalizar,
  removerRegistro,
  tituloAcontecimentoHist,
  viagemDoRegistro,
  viagemJaImportada,
} from '@owbuddy/domain';
import type { AcontecimentoHist, HistoricoData, RegistroEmbarque, Viagem } from '@owbuddy/domain';
import { alterarHistorico, getHistorico, getViagem } from '../src/storage';
import { OWBackground } from '../src/components/OWBackground';
import { AvisoFinalizar } from '../src/components/HistoricoAvisos';
import { colors, maritime, radius, spacing, typography, themed } from '../src/theme';
import { useTema } from '../src/tema';
import { formatDateBR } from '../src/format';
import { confirmarRemocao } from '../src/confirmar';
import { useAcaoUnica } from '../src/acoes';
import { avisar } from '../src/feedback';
import { analytics } from '../src/analytics';
import { HIST_VISUAL } from '../src/historico-visual';

const ddmm = (iso: string) => formatDateBR(iso).slice(0, 5);

export default function RegistroHistorico() {
  useTema();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [hist, setHist] = useState<HistoricoData | null>(null);
  const [viagem, setViagem] = useState<Viagem | null>(null);

  const load = useCallback(async () => {
    const [h, v] = await Promise.all([getHistorico(), getViagem()]);
    setHist(h); setViagem(v);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const r = hist?.registros.find(x => x.id === id) ?? null;

  const [importar] = useAcaoUnica(async () => {
    if (!r || !viagem) return;
    const h = await alterarHistorico(x => importarViagem(x, r.id, viagem, hojeISO(), new Date().toISOString()));
    setHist(h);
    analytics.track('acontecimento_registrado', { origem: 'viagem' });
    avisar('Adicionado à linha do tempo');
  });

  if (!hist) return <OWBackground><View style={{ flex: 1 }} /></OWBackground>;
  if (!r) {
    return (
      <OWBackground>
        <Stack.Screen options={{ title: 'Registro' }} />
        <View style={styles.sumiu}>
          <Text style={typography.small}>Este registro não existe mais.</Text>
          <TouchableOpacity style={styles.botao} onPress={() => router.dismissTo('/historico')} accessibilityRole="button">
            <Text style={styles.botaoTexto}>Voltar ao histórico</Text>
          </TouchableOpacity>
        </View>
      </OWBackground>
    );
  }

  const hoje = hojeISO();
  const estado = estadoRegistro(r);
  const dias = diasEmbarcado(r);
  const linha = linhaDoTempo(hist, r.id);
  const pend = pendenciaFinalizar([r], hoje);
  const podeImportar = viagem && viagemDoRegistro(viagem, r) && !viagemJaImportada(hist, r.id, viagem);
  const previstoDifere = r.previsto?.embarque && (r.previsto.embarque !== r.embarque
    || (r.desembarque && r.previsto.desembarque && r.previsto.desembarque !== r.desembarque));

  const excluir = () => {
    confirmarRemocao('Excluir este registro do histórico?', 'Isso não altera sua escala atual.', async () => {
      await alterarHistorico(h => removerRegistro(h, r.id));
      analytics.track('embarque_excluido');
      avisar('Excluído');
      if (router.canGoBack()) router.back(); else router.replace('/historico');
    });
  };

  return (
    <OWBackground>
      <Stack.Screen options={{ title: nomeRegistro(r) }} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}>

        <View style={styles.cabecalho}>
          <View style={styles.cabTopo}>
            <Text style={styles.nome} numberOfLines={2}>{nomeRegistro(r)}</Text>
            {estado !== 'CONCLUIDO' ? (
              <View style={styles.selo}><Text style={styles.seloTexto}>{estado === 'PLANEJADO' ? 'Planejado' : 'Em andamento'}</Text></View>
            ) : null}
          </View>

          <View style={styles.datas}>
            <View style={styles.dataBloco}>
              <Text style={styles.dataValor}>{formatDateBR(r.embarque)}</Text>
              <Text style={styles.dataRotulo}>Embarque</Text>
            </View>
            <Ionicons name="arrow-forward" size={16} color={colors.mutedDim} />
            <View style={styles.dataBloco}>
              <Text style={[styles.dataValor, !r.desembarque && styles.dataPendente]}>
                {r.desembarque ? formatDateBR(r.desembarque) : r.previsto?.desembarque ? `prev. ${ddmm(r.previsto.desembarque)}` : '—'}
              </Text>
              <Text style={styles.dataRotulo}>Desembarque</Text>
            </View>
          </View>

          {estado === 'CONCLUIDO' && dias != null ? (
            <Text style={styles.instrumento} accessibilityLabel={`${dias} dias embarcado`}>
              <Text style={styles.instrumentoNumero}>{dias}</Text>
              <Text style={styles.instrumentoRotulo}>  {dias === 1 ? 'dia embarcado' : 'dias embarcado'}</Text>
            </Text>
          ) : estado === 'EM_ANDAMENTO' && r.embarque <= hoje ? (
            <Text style={styles.instrumento} accessibilityLabel={`Dia ${diaRegistrado(r, hoje)} registrado`}>
              <Text style={styles.instrumentoRotulo}>Dia </Text>
              <Text style={styles.instrumentoNumero}>{diaRegistrado(r, hoje)}</Text>
              <Text style={styles.instrumentoRotulo}>  registrado</Text>
            </Text>
          ) : null}

          {previstoDifere ? (
            <Text style={styles.previsto}>
              Previsto pela escala: {ddmm(r.previsto!.embarque!)}{r.previsto!.desembarque ? ` → ${ddmm(r.previsto!.desembarque)}` : ''}
            </Text>
          ) : null}
          {r.funcao ? <Info icone="person-outline" texto={r.funcao} /> : null}
          {r.empresa ? <Info icone="briefcase-outline" texto={r.empresa} /> : null}
          {r.obs ? <Info icone="chatbox-ellipses-outline" texto={r.obs} /> : null}

          <View style={styles.acoes}>
            <TouchableOpacity style={styles.botao} onPress={() => router.push({ pathname: '/historico-form', params: { id: r.id } })} accessibilityRole="button">
              <Ionicons name="create-outline" size={17} color={colors.cyanDim} />
              <Text style={styles.botaoTexto}>{estado === 'PLANEJADO' ? 'Confirmar ou editar' : 'Editar embarque'}</Text>
            </TouchableOpacity>
            {estado === 'EM_ANDAMENTO' && !pend ? (
              <TouchableOpacity style={styles.botao} onPress={() => router.push({ pathname: '/historico-form', params: { id: r.id, finalizar: '1' } })} accessibilityRole="button">
                <Ionicons name="log-out-outline" size={17} color={colors.cyanDim} />
                <Text style={styles.botaoTexto}>Registrar desembarque</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {pend ? <AvisoFinalizar p={pend} onFeito={load} /> : null}

        {podeImportar ? (
          <View style={styles.importar}>
            <Ionicons name="airplane-outline" size={17} color={colors.iconDefault} />
            <View style={{ flex: 1 }}>
              <Text style={styles.importarTitulo}>Minha Viagem</Text>
              <Text style={styles.importarSub} numberOfLines={2}>{getViagemResumo(viagem!)} · {ddmm(viagem!.data)}{viagem!.hora ? ` · ${viagem!.hora}` : ''}</Text>
            </View>
            <TouchableOpacity onPress={importar} style={styles.importarBtn} accessibilityRole="button">
              <Text style={styles.importarBtnTexto}>Adicionar ao histórico</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <Text style={styles.secao}>Linha do tempo</Text>
        <View style={styles.timeline}>
          {linha.length === 0 ? <Text style={styles.vazio}>Nada registrado ainda. Hotel, voo, base, transferido…</Text> : null}
          {linha.map((a, i) => (
            <ItemLinha key={a.id} a={a} primeiro={i === 0} ultimo={i === linha.length - 1} />
          ))}
          <TouchableOpacity
            style={styles.novo}
            onPress={() => router.push({ pathname: '/historico-acontecimento', params: { registro: r.id } })}
            accessibilityRole="button"
          >
            <Ionicons name="add" size={18} color={colors.cyanDim} />
            <Text style={styles.novoTexto}>Registrar acontecimento</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.excluir} onPress={excluir} accessibilityRole="button">
          <Ionicons name="trash-outline" size={16} color={colors.red} />
          <Text style={styles.excluirTexto}>Excluir registro</Text>
        </TouchableOpacity>
        <Text style={styles.rodape}>Registro pessoal, só neste aparelho. Não altera sua escala.</Text>
      </ScrollView>
    </OWBackground>
  );
}

function Info({ icone, texto }: { icone: React.ComponentProps<typeof Ionicons>['name']; texto: string }) {
  useTema();
  return (
    <View style={styles.info}>
      <Ionicons name={icone} size={14} color={colors.mutedDim} />
      <Text style={styles.infoTexto}>{texto}</Text>
    </View>
  );
}

function ItemLinha({ a, primeiro, ultimo }: { a: AcontecimentoHist; primeiro: boolean; ultimo: boolean }) {
  useTema();
  const v = HIST_VISUAL[a.tipo];
  const detalhe = [a.numero, a.titulo && a.local ? a.local : null, a.obs].filter(Boolean).join(' · ');
  const titulo = tituloAcontecimentoHist(a);
  return (
    <TouchableOpacity
      style={styles.item}
      onPress={() => router.push({ pathname: '/historico-acontecimento', params: { registro: a.registroId, id: a.id } })}
      accessibilityRole="button"
      accessibilityLabel={`${formatDateBR(a.data)}${a.hora ? ` ${a.hora}` : ''}, ${titulo}${a.planejado ? ', planejado' : ''}. Tocar para editar`}
    >
      <View style={styles.quando}>
        <Text style={styles.quandoData}>{ddmm(a.data)}</Text>
        {a.hora ? <Text style={styles.quandoHora}>{a.hora}</Text> : null}
      </View>
      <View style={styles.trilho}>
        {primeiro && ultimo ? null : <View style={[styles.trilhoLinha, primeiro && styles.trilhoTopo, ultimo && styles.trilhoFim]} />}
        <View style={[styles.marcador, { borderColor: v.color }, a.planejado && styles.marcadorPlanejado]} />
      </View>
      <View style={styles.itemCorpo}>
        <View style={styles.itemTopo}>
          <Ionicons name={v.icon} size={15} color={v.color} />
          <Text style={[styles.itemTitulo, a.planejado && styles.itemPlanejado]} numberOfLines={2}>{titulo}</Text>
        </View>
        {a.titulo && a.titulo !== LABEL_ACONTECIMENTO_HIST[a.tipo] ? <Text style={styles.itemTipo}>{LABEL_ACONTECIMENTO_HIST[a.tipo]}</Text> : null}
        {detalhe ? <Text style={styles.itemDetalhe} numberOfLines={2}>{detalhe}</Text> : null}
        {a.planejado ? <Text style={styles.itemSelo}>Planejado</Text> : null}
      </View>
      <Ionicons name="create-outline" size={15} color={colors.mutedDim} style={styles.itemEditar} />
    </TouchableOpacity>
  );
}

const MARCADOR = 11;

const styles = themed(() => StyleSheet.create({
  content: { padding: spacing.md },
  sumiu: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },

  cabecalho: {
    backgroundColor: maritime.glassElevated, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm, marginBottom: spacing.md,
    borderWidth: 1, borderColor: maritime.glassBorder, borderTopColor: maritime.edgeLight, borderBottomColor: maritime.edgeDark,
    ...maritime.cardShadow,
  },
  cabTopo: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, flexWrap: 'wrap' },
  nome: { flex: 1, minWidth: 160, fontSize: 21, fontWeight: '700', color: colors.white, textTransform: 'uppercase', letterSpacing: 0.4 },
  selo: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.amber + '66' },
  seloTexto: { fontSize: 11, fontWeight: '700', color: colors.amber, textTransform: 'uppercase', letterSpacing: 0.6 },
  datas: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  dataBloco: { minWidth: 104 },
  dataValor: { fontSize: 16, fontWeight: '700', color: colors.white, fontVariant: ['tabular-nums'] },
  dataPendente: { color: colors.muted },
  dataRotulo: { fontSize: 11, color: colors.mutedDim, textTransform: 'uppercase', letterSpacing: 0.6 },
  instrumento: { marginTop: 2 },
  instrumentoNumero: { fontSize: 38, lineHeight: 44, fontWeight: '700', letterSpacing: -1, fontVariant: ['tabular-nums'], color: colors.cyan },
  instrumentoRotulo: { fontSize: 15, fontWeight: '600', color: colors.muted },
  previsto: { fontSize: 12, color: colors.mutedDim },
  info: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  infoTexto: { flex: 1, fontSize: 14, color: colors.muted },
  acoes: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  botao: {
    flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 42, paddingHorizontal: 12, borderRadius: radius.md,
    borderWidth: 1, borderColor: maritime.glassBorder, borderTopColor: maritime.edgeLight, backgroundColor: maritime.glass,
  },
  botaoTexto: { fontSize: 14, fontWeight: '700', color: colors.cyanDim },

  importar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap', padding: spacing.md, marginBottom: spacing.md,
    borderRadius: radius.lg, borderWidth: 1, borderColor: maritime.glassBorder, borderTopColor: maritime.edgeLight, backgroundColor: maritime.glass,
  },
  importarTitulo: { fontSize: 14, fontWeight: '700', color: colors.white },
  importarSub: { fontSize: 12, color: colors.muted, marginTop: 1 },
  importarBtn: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 4 },
  importarBtnTexto: { fontSize: 14, fontWeight: '700', color: colors.cyanDim },

  secao: { fontSize: 11, fontWeight: '700', color: colors.kicker, letterSpacing: 0.8, textTransform: 'uppercase', marginTop: spacing.sm, marginBottom: spacing.sm },
  timeline: {
    backgroundColor: maritime.glass, borderRadius: radius.lg, paddingVertical: spacing.sm, paddingHorizontal: spacing.sm,
    borderWidth: 1, borderColor: maritime.glassBorder, borderTopColor: maritime.edgeLight, borderBottomColor: maritime.edgeDark,
  },
  vazio: { ...typography.small, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
  item: { flexDirection: 'row', alignItems: 'stretch', minHeight: 56 },
  quando: { width: 50, paddingTop: 10, alignItems: 'flex-end' },
  quandoData: { fontSize: 13, fontWeight: '700', color: colors.white, fontVariant: ['tabular-nums'] },
  quandoHora: { fontSize: 12, color: colors.muted, fontVariant: ['tabular-nums'] },
  trilho: { width: 26, alignItems: 'center' },
  trilhoLinha: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: maritime.glassBorder },
  trilhoTopo: { top: 14 },
  trilhoFim: { bottom: undefined, height: 14 },
  marcador: {
    marginTop: 13, width: MARCADOR, height: MARCADOR, borderRadius: MARCADOR / 2, borderWidth: 2,
    backgroundColor: maritime.glassElevated,
  },
  marcadorPlanejado: { borderStyle: 'dashed' },
  itemCorpo: { flex: 1, minWidth: 0, paddingVertical: 9, paddingRight: 4 },
  itemTopo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  itemTitulo: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.white },
  itemPlanejado: { color: colors.muted },
  itemTipo: { fontSize: 11, color: colors.mutedDim, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 1 },
  itemDetalhe: { fontSize: 13, color: colors.muted, marginTop: 2 },
  itemSelo: { fontSize: 11, fontWeight: '700', color: colors.amber, marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.5 },
  itemEditar: { alignSelf: 'center', marginLeft: 2 },
  novo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 46, marginTop: spacing.xs },
  novoTexto: { fontSize: 14, fontWeight: '700', color: colors.cyanDim },

  excluir: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 48, marginTop: spacing.lg },
  excluirTexto: { fontSize: 14, fontWeight: '600', color: colors.red },
  rodape: { fontSize: 12, color: colors.mutedDim, textAlign: 'center' },
}));
