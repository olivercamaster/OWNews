/**
 * Meu Histórico — o que REALMENTE aconteceu (a escala é o planejado).
 * Lista por ano, mais recente primeiro, com resumo de cada ano e um resumo geral discreto
 * (só com registros concluídos — nada estimado). Fica só neste aparelho.
 */
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, SectionList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  agruparPorAno,
  anosDoHistorico,
  diaRegistrado,
  diasEmbarcado,
  estadoRegistro,
  hojeISO,
  nomeRegistro,
  pendenciaFinalizar,
  periodoCurto,
  planejadoAConfirmar,
  resumoHistorico,
  sugestaoCicloAtual,
  unidadesDoHistorico,
} from '@owbuddy/domain';
import type { AvisosHistorico, EscalaConfig, GrupoAno, HistoricoData, RegistroEmbarque, ResumoHistorico } from '@owbuddy/domain';
import { getAvisosHistorico, getEscala, getHistorico } from '../src/storage';
import { colors, maritime, radius, spacing, typography, themed } from '../src/theme';
import { useTema } from '../src/tema';
import { OWBackground } from '../src/components/OWBackground';
import { AvisoFinalizar, AvisoSugestao } from '../src/components/HistoricoAvisos';
import { formatDateBR } from '../src/format';
import { analytics } from '../src/analytics';
import { PortaoPlus } from '../src/components/PortaoPlus';

type Dados = { hist: HistoricoData; escala: EscalaConfig | null; avisos: AvisosHistorico };

function MeuHistoricoConteudo() {
  useTema();
  const insets = useSafeAreaInsets();
  const [dados, setDados] = useState<Dados | null>(null);
  const [ano, setAno] = useState<number | null>(null);
  const [unidade, setUnidade] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [hist, escala, avisos] = await Promise.all([getHistorico(), getEscala(), getAvisosHistorico()]);
    setDados({ hist, escala, avisos });
  }, []);

  useFocusEffect(useCallback(() => {
    analytics.track('historico_aberto');
    load();
  }, [load]));

  const registros = dados?.hist.registros ?? [];
  const grupos = useMemo(() => agruparPorAno(registros, { ano, unidade }), [registros, ano, unidade]);
  const anos = useMemo(() => anosDoHistorico(registros), [registros]);
  const unidades = useMemo(() => unidadesDoHistorico(registros), [registros]);
  const geral = useMemo(() => resumoHistorico(registros), [registros]);

  if (!dados) return <OWBackground><View style={{ flex: 1 }} /></OWBackground>;

  const hoje = hojeISO();
  const pendencia = pendenciaFinalizar(registros, hoje);
  const aConfirmar = planejadoAConfirmar(registros, hoje);
  // Aqui a sugestão aparece mesmo se dispensada na Home — só some se dispensada para este ciclo.
  const sugestaoBruta = sugestaoCicloAtual(dados.escala, registros, new Date());
  const sugestao = sugestaoBruta && !dados.avisos.dispensadas.includes(sugestaoBruta.chave) ? sugestaoBruta : null;
  const vazio = registros.length === 0;

  const cabecalho = (
    <View>
      {vazio ? (
        <View style={styles.vazio}>
          <Ionicons name="time-outline" size={36} color={colors.iconDefault} />
          <Text style={styles.vazioTitulo}>Meu Histórico</Text>
          <Text style={styles.vazioTexto}>Seus embarques registrados vão aparecer aqui.</Text>
          {sugestaoBruta ? <Text style={styles.vazioTexto}>Quer começar pelo seu embarque atual?</Text> : null}
          {sugestaoBruta ? (
            <TouchableOpacity style={styles.primario} onPress={() => router.push({ pathname: '/historico-form', params: { sugestao: '1' } })} accessibilityRole="button">
              <Text style={styles.primarioTexto}>Revisar ciclo atual</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={sugestaoBruta ? styles.secundarioBloco : styles.primario}
            onPress={() => router.push('/historico-form')}
            accessibilityRole="button"
          >
            <Text style={sugestaoBruta ? styles.secundarioBlocoTexto : styles.primarioTexto}>Registrar primeiro embarque</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {geral.embarques > 0 ? <ResumoGeral r={geral} /> : null}
          {pendencia ? <AvisoFinalizar p={pendencia} onFeito={load} /> : null}
          {!pendencia && aConfirmar ? <AvisoPlanejado r={aConfirmar} /> : null}
          {!pendencia && sugestao ? <AvisoSugestao s={sugestao} onFeito={load} compacto /> : null}
          <TouchableOpacity style={styles.novo} onPress={() => router.push('/historico-form')} accessibilityRole="button">
            <Ionicons name="add" size={20} color={colors.cyanDim} />
            <Text style={styles.novoTexto}>Registrar embarque</Text>
          </TouchableOpacity>
          {anos.length > 1 ? (
            <Filtro opcoes={anos.map(String)} atual={ano ? String(ano) : null} onEscolher={v => setAno(v ? Number(v) : null)} rotulo="Ano" />
          ) : null}
          {unidades.length > 1 ? (
            <Filtro opcoes={unidades} atual={unidade} onEscolher={setUnidade} rotulo="Unidade" />
          ) : null}
          {grupos.length === 0 ? <Text style={styles.semFiltro}>Nenhum registro com esse filtro.</Text> : null}
        </>
      )}
    </View>
  );

  return (
    <OWBackground>
      <SectionList
        sections={vazio ? [] : grupos.map(g => ({ key: String(g.ano), grupo: g, data: g.registros }))}
        keyExtractor={r => r.id}
        ListHeaderComponent={cabecalho}
        renderSectionHeader={({ section }) => <CabecalhoAno g={section.grupo} />}
        renderItem={({ item, index, section }) => (
          <LinhaRegistro r={item} hoje={hoje} primeiro={index === 0} ultimo={index === section.data.length - 1} />
        )}
        ListFooterComponent={vazio ? null : (
          <Text style={styles.rodape}>Registro pessoal, guardado só neste aparelho. Não altera sua escala e não é documento oficial.</Text>
        )}
        stickySectionHeadersEnabled={false}
        initialNumToRender={20}
        windowSize={7}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
      />
    </OWBackground>
  );
}

function ResumoGeral({ r }: { r: ResumoHistorico }) {
  useTema();
  return (
    <View style={styles.resumo} accessibilityLabel={`Desde ${r.desde}: ${r.embarques} embarques, ${r.dias} dias embarcado${r.unidades ? `, ${r.unidades} unidades` : ''}`}>
      {r.desde ? <Text style={styles.resumoKicker}>Desde {r.desde}</Text> : null}
      <View style={styles.resumoLinha}>
        <Numero valor={r.embarques} rotulo={r.embarques === 1 ? 'embarque' : 'embarques'} />
        <Numero valor={r.dias} rotulo="dias embarcado" />
        {r.unidades > 0 ? <Numero valor={r.unidades} rotulo={r.unidades === 1 ? 'unidade' : 'unidades'} /> : null}
      </View>
    </View>
  );
}

function Numero({ valor, rotulo }: { valor: number; rotulo: string }) {
  useTema();
  return (
    <View style={styles.numero}>
      <Text style={styles.numeroValor}>{valor.toLocaleString('pt-BR')}</Text>
      <Text style={styles.numeroRotulo}>{rotulo}</Text>
    </View>
  );
}

function AvisoPlanejado({ r }: { r: RegistroEmbarque }) {
  useTema();
  return (
    <TouchableOpacity
      style={styles.planejado}
      onPress={() => router.push({ pathname: '/historico-registro', params: { id: r.id } })}
      accessibilityRole="button"
    >
      <Ionicons name="help-circle-outline" size={18} color={colors.amber} />
      <View style={{ flex: 1 }}>
        <Text style={styles.planejadoTitulo}>Embarque planejado para {formatDateBR(r.embarque).slice(0, 5)}</Text>
        <Text style={styles.planejadoSub}>Aconteceu? Confirme ou corrija as datas.</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.mutedDim} />
    </TouchableOpacity>
  );
}

function Filtro({ opcoes, atual, onEscolher, rotulo }: { opcoes: string[]; atual: string | null; onEscolher: (v: string | null) => void; rotulo: string }) {
  useTema();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtro} contentContainerStyle={styles.filtroConteudo}>
      <Text style={styles.filtroRotulo}>{rotulo}</Text>
      {[null, ...opcoes].map(o => {
        const ativo = atual === o;
        return (
          <TouchableOpacity key={o ?? '_todos'} style={[styles.chip, ativo && styles.chipAtivo]} onPress={() => onEscolher(o)}
            accessibilityRole="button" accessibilityState={{ selected: ativo }}>
            <Text style={[styles.chipTexto, ativo && styles.chipTextoAtivo]} numberOfLines={1}>{o ?? 'Todos'}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

function CabecalhoAno({ g }: { g: GrupoAno }) {
  useTema();
  const partes: string[] = [];
  if (g.resumo.embarques > 0) {
    partes.push(`${g.resumo.embarques} ${g.resumo.embarques === 1 ? 'embarque' : 'embarques'}`);
    partes.push(`${g.resumo.dias.toLocaleString('pt-BR')} dias embarcado`);
    if (g.resumo.unidades > 0) partes.push(`${g.resumo.unidades} ${g.resumo.unidades === 1 ? 'unidade' : 'unidades'}`);
  }
  if (g.emAndamento > 0) partes.push(`${g.emAndamento} em andamento`);
  return (
    <View style={styles.ano}>
      <Text style={styles.anoTitulo}>{g.ano}</Text>
      {partes.length ? <Text style={styles.anoResumo}>{partes.join(' · ')}</Text> : null}
    </View>
  );
}

function LinhaRegistro({ r, hoje, primeiro, ultimo }: { r: RegistroEmbarque; hoje: string; primeiro: boolean; ultimo: boolean }) {
  useTema();
  const estado = estadoRegistro(r);
  const dias = diasEmbarcado(r);
  // Duas linhas curtas à direita (cabem em 320 px): valor + legenda.
  const andamentoDia = estado === 'EM_ANDAMENTO' && r.embarque <= hoje ? `Dia ${diaRegistrado(r, hoje)}` : null;
  const direita = estado === 'PLANEJADO' ? 'Planejado'
    : estado === 'EM_ANDAMENTO' ? (andamentoDia ?? 'Em andamento')
    : dias === 1 ? '1 dia' : `${dias} dias`;
  const subDias = estado === 'CONCLUIDO' ? 'embarcado' : andamentoDia ? 'em andamento' : null;
  return (
    <TouchableOpacity
      style={[styles.linha, primeiro && styles.linhaPrimeira, ultimo && styles.linhaUltima, !ultimo && styles.linhaBorda]}
      onPress={() => router.push({ pathname: '/historico-registro', params: { id: r.id } })}
      accessibilityRole="button"
      accessibilityLabel={`${nomeRegistro(r)}, ${periodoCurto(r)}, ${direita}${subDias ? ` ${subDias}` : ''}`}
    >
      <View style={styles.linhaEsq}>
        <Text style={styles.linhaNome} numberOfLines={1}>{nomeRegistro(r)}</Text>
        <Text style={styles.linhaPeriodo} numberOfLines={1}>{periodoCurto(r)}</Text>
      </View>
      <View style={styles.linhaDir}>
        <Text style={[styles.linhaDias, estado !== 'CONCLUIDO' && !andamentoDia && styles.linhaEstado]} numberOfLines={1}>{direita}</Text>
        {subDias ? <Text style={[styles.linhaSub, andamentoDia && styles.linhaSubAndamento]}>{subDias}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.mutedDim} />
    </TouchableOpacity>
  );
}

const styles = themed(() => StyleSheet.create({
  content: { padding: spacing.md },

  vazio: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl, paddingHorizontal: spacing.md },
  vazioTitulo: { ...typography.h2, marginTop: spacing.xs },
  vazioTexto: { ...typography.small, textAlign: 'center' },
  primario: {
    minHeight: 48, borderRadius: radius.md, paddingHorizontal: spacing.lg, justifyContent: 'center', alignSelf: 'stretch',
    alignItems: 'center', marginTop: spacing.sm, backgroundColor: colors.cyan, ...maritime.botaoPrimario,
  },
  primarioTexto: { fontSize: 15, fontWeight: '700', color: colors.onAccent },
  secundarioBloco: {
    minHeight: 48, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center', alignSelf: 'stretch',
    borderWidth: 1, borderColor: maritime.glassBorder, borderTopColor: maritime.edgeLight, backgroundColor: maritime.glass,
  },
  secundarioBlocoTexto: { fontSize: 15, fontWeight: '700', color: colors.cyanDim },

  resumo: {
    backgroundColor: maritime.glassElevated, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md,
    borderWidth: 1, borderColor: maritime.glassBorder, borderTopColor: maritime.edgeLight, borderBottomColor: maritime.edgeDark,
    ...maritime.cardShadow,
  },
  resumoKicker: { fontSize: 11, fontWeight: '700', color: colors.kicker, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 },
  resumoLinha: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.lg, rowGap: spacing.sm },
  numero: { minWidth: 72 },
  numeroValor: { fontSize: 26, lineHeight: 30, fontWeight: '700', letterSpacing: -0.5, fontVariant: ['tabular-nums'], color: colors.white },
  numeroRotulo: { fontSize: 12, color: colors.muted },

  planejado: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, marginBottom: spacing.md,
    borderRadius: radius.lg, borderWidth: 1, borderColor: maritime.glassBorder, borderTopColor: maritime.edgeLight, backgroundColor: maritime.glass,
  },
  planejadoTitulo: { fontSize: 14, fontWeight: '700', color: colors.white },
  planejadoSub: { fontSize: 12, color: colors.muted, marginTop: 1 },

  novo: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 46, marginBottom: spacing.sm,
    borderRadius: radius.md, borderWidth: 1, borderColor: maritime.glassBorder, borderTopColor: maritime.edgeLight, backgroundColor: maritime.glass,
  },
  novoTexto: { fontSize: 15, fontWeight: '700', color: colors.cyanDim },

  filtro: { marginTop: spacing.xs, flexGrow: 0 },
  filtroConteudo: { alignItems: 'center', gap: 6, paddingRight: spacing.md },
  filtroRotulo: { ...typography.micro, marginRight: 2 },
  chip: {
    minHeight: 34, paddingHorizontal: 12, borderRadius: radius.xl, justifyContent: 'center', maxWidth: 180,
    borderWidth: 1, borderColor: maritime.glassBorder, backgroundColor: maritime.glass,
  },
  chipAtivo: { borderColor: colors.cyan, backgroundColor: colors.cyanFaint },
  chipTexto: { fontSize: 13, fontWeight: '600', color: colors.muted },
  chipTextoAtivo: { color: colors.cyan },
  semFiltro: { ...typography.small, textAlign: 'center', marginTop: spacing.lg },

  ano: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: spacing.sm, marginTop: spacing.lg, marginBottom: spacing.sm },
  anoTitulo: { fontSize: 20, fontWeight: '700', color: colors.white, fontVariant: ['tabular-nums'] },
  anoResumo: { fontSize: 12, color: colors.muted, flexShrink: 1 },

  linha: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 60, paddingHorizontal: spacing.md, paddingVertical: 10,
    backgroundColor: maritime.glass, borderLeftWidth: 1, borderRightWidth: 1, borderColor: maritime.glassBorder,
  },
  linhaPrimeira: { borderTopWidth: 1, borderTopColor: maritime.edgeLight, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  linhaUltima: { borderBottomWidth: 1, borderBottomColor: maritime.edgeDark, borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg },
  linhaBorda: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: maritime.glassBorder },
  linhaEsq: { flex: 1, minWidth: 0 },
  linhaNome: { fontSize: 15, fontWeight: '700', color: colors.white, textTransform: 'uppercase', letterSpacing: 0.3 },
  linhaPeriodo: { fontSize: 13, color: colors.muted, marginTop: 2, fontVariant: ['tabular-nums'] },
  linhaDir: { alignItems: 'flex-end', maxWidth: '42%' },
  linhaDias: { fontSize: 16, fontWeight: '700', color: colors.white, fontVariant: ['tabular-nums'] },
  linhaEstado: { fontSize: 12, fontWeight: '700', color: colors.amber },
  linhaSub: { fontSize: 11, color: colors.mutedDim },
  linhaSubAndamento: { color: colors.amber, fontWeight: '700' },

  rodape: { fontSize: 12, color: colors.mutedDim, textAlign: 'center', marginTop: spacing.lg, paddingHorizontal: spacing.md },
}));

/** OWBuddy+: sem acesso, a tela nem monta (dados intactos); mostra o recurso e os dados guardados. */
export default function MeuHistorico() {
  useTema();
  return <PortaoPlus recurso="historico"><MeuHistoricoConteudo /></PortaoPlus>;
}
