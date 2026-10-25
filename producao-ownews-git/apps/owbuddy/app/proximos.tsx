/**
 * Próximos — linha do tempo dos acontecimentos (Buddy Agora): Hoje, Amanhã, Esta semana,
 * Próximos 30 dias, Mais adiante. Não é calendário: o calendário continua na Minha Escala.
 */
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { agruparPorFaixa, gerarAcontecimentos, hojeISO, pendenciaFinalizar, recorteFree, semAtalhoPlus, type Acontecimento } from '@owbuddy/domain';
import type { EscalaConfig, PendenciaFinalizar, Viagem } from '@owbuddy/domain';
import { getCerts, getChecklist, getEscala, getEventosPessoais, getHistorico, getPagamento, getViagem } from '../src/storage';
import { colors, maritime, radius, spacing, typography, themed, tokens } from '../src/theme';
import { useTema } from '../src/tema';
import { OWBackground } from '../src/components/OWBackground';
import { AcontecimentoLinha } from '../src/components/AcontecimentoLinha';
import { TransporteSheet } from '../src/components/TransporteSheet';
import { opcoesTransporte } from '../src/transporte';
import { analytics } from '../src/analytics';
import { formatDateBR } from '../src/format';
import { useOwBuddyPlus } from '../src/plus/acesso';
import { SeloPlus } from '../src/components/PortaoPlus';

export default function Proximos() {
  useTema();
  const insets = useSafeAreaInsets();
  const [lista, setLista] = useState<Acontecimento[] | null>(null);
  const [temPagamento, setTemPagamento] = useState(true);
  const [ctx, setCtx] = useState<{ viagem: Viagem | null; escala: EscalaConfig | null }>({ viagem: null, escala: null });
  const [transporte, setTransporte] = useState(false);
  // Meu Histórico: ação contextual só quando o desembarque previsto de um registro em andamento chegou.
  const [pendencia, setPendencia] = useState<PendenciaFinalizar | null>(null);
  // Buddy Agora completo (mala, viagem, documentos, histórico) é OWBuddy+; o básico (escala,
  // lembretes pessoais, pagamento) é Free. Os dados Plus não são apagados: só não entram aqui.
  const { plus, lido, acesso } = useOwBuddyPlus();

  useFocusEffect(useCallback(() => {
    if (!lido) return;
    analytics.track('proximos_opened');
    (async () => {
      const [escala, checklistT, certsT, viagemT, eventos, pagamento, historico] = await Promise.all([
        getEscala(), getChecklist(), getCerts(), getViagem(), getEventosPessoais(), getPagamento(), getHistorico(),
      ]);
      const { checklist, certs, viagem } = recorteFree(plus, { checklist: checklistT, certs: certsT, viagem: viagemT });
      setPendencia(plus ? pendenciaFinalizar(historico.registros, hojeISO()) : null);
      setCtx({ viagem, escala });
      setTemPagamento(!!pagamento);
      setLista(semAtalhoPlus(plus, gerarAcontecimentos({ escala, checklist, certs, viagem, eventos, pagamento })));
    })();
  }, [plus, lido]));

  const acionar = (a: Acontecimento) => {
    if (!a.acao) return;
    if (a.acao.tipo === 'presente') {
      analytics.track('gift_ideas_opened', { origem: 'proximos' });
      router.push({ pathname: '/presentes', params: { evento: a.meta?.eventoId ?? '' } });
    } else if (a.acao.tipo === 'transporte') setTransporte(true);
    else router.push({ pathname: a.acao.rota as never, params: a.acao.params ?? {} });
  };

  const grupos = lista ? agruparPorFaixa(lista) : [];

  return (
    <OWBackground>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}>
        <TouchableOpacity style={styles.novo} onPress={() => router.push('/escala-evento-form')} accessibilityRole="button">
          <Ionicons name="add-circle-outline" size={20} color={colors.cyan} />
          <Text style={styles.novoTexto}>Lembrar de algo</Text>
        </TouchableOpacity>

        {pendencia ? (
          <TouchableOpacity
            style={styles.historico}
            onPress={() => router.push({ pathname: '/historico-registro', params: { id: pendencia.registro.id } })}
            accessibilityRole="button"
          >
            <Ionicons name="log-out-outline" size={18} color={colors.amber} />
            <View style={{ flex: 1 }}>
              <Text style={styles.pagTitulo}>{pendencia.diasDesde === 0 ? 'Desembarque previsto para hoje' : `Desembarque previsto: ${formatDateBR(pendencia.desembarquePrevisto).slice(0, 5)}`}</Text>
              <Text style={styles.pagSub}>Registrar desembarque no Meu Histórico</Text>
            </View>
            <Ionicons name="chevron-forward" size={14} color={colors.mutedDim} />
          </TouchableOpacity>
        ) : null}

        {lista && grupos.length === 0 && (
          <Text style={styles.vazio}>Nada nos próximos dias. Cadastre aniversários, cursos e compromissos em “Lembrar de algo”.</Text>
        )}

        {grupos.map(g => (
          <View key={g.faixa}>
            <Text style={styles.secao}>{g.label}</Text>
            <View style={styles.cartao}>
              {g.itens.map((a, i) => <AcontecimentoLinha key={a.id} a={a} onAcao={acionar} ultimo={i === g.itens.length - 1} />)}
            </View>
          </View>
        ))}

        {lista && !temPagamento && (
          <TouchableOpacity style={styles.pagamento} onPress={() => router.push('/pagamento')} accessibilityRole="button">
            <Ionicons name="wallet-outline" size={18} color={tokens.eventoPagamento} />
            <View style={{ flex: 1 }}>
              <Text style={styles.pagTitulo}>Meu Pagamento</Text>
              <Text style={styles.pagSub}>Cadastre a regra da sua empresa e veja a data provável aqui.</Text>
            </View>
            <Ionicons name="chevron-forward" size={14} color={colors.mutedDim} />
          </TouchableOpacity>
        )}

        {lista && !plus && acesso.estado !== 'carregando' ? (
          <TouchableOpacity style={styles.pagamento} onPress={() => router.push({ pathname: '/owbuddy-plus', params: { origem: 'proximos' } })} accessibilityRole="button">
            <Ionicons name="sparkles-outline" size={18} color={colors.iconDefault} />
            <View style={{ flex: 1 }}>
              <Text style={styles.pagTitulo}>Buddy Agora completo</Text>
              <Text style={styles.pagSub}>Mala, viagem e documentos também entram aqui.</Text>
            </View>
            <SeloPlus compacto />
          </TouchableOpacity>
        ) : null}
      </ScrollView>
      <TransporteSheet visivel={transporte} opcoes={opcoesTransporte(ctx.viagem, ctx.escala)} onFechar={() => setTransporte(false)} />
    </OWBackground>
  );
}

const styles = themed(() => StyleSheet.create({
  content: { padding: spacing.md },
  novo: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48, paddingHorizontal: spacing.md,
    borderRadius: radius.lg, borderWidth: 1, borderColor: maritime.accentBorder, backgroundColor: maritime.accentSoft,
  },
  novoTexto: { fontSize: 15, fontWeight: '700', color: colors.cyan },
  vazio: { ...typography.small, textAlign: 'center', marginTop: spacing.lg, paddingHorizontal: spacing.md },
  secao: { ...typography.micro, marginTop: spacing.lg, marginBottom: spacing.sm },
  cartao: {
    backgroundColor: maritime.glass, borderRadius: radius.lg, borderWidth: 1, borderColor: maritime.glassBorder,
    borderTopColor: maritime.edgeLight, overflow: 'hidden',
  },
  pagamento: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg, padding: spacing.md,
    borderRadius: radius.lg, borderWidth: 1, borderColor: maritime.glassBorder, backgroundColor: maritime.glass,
  },
  historico: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md, padding: spacing.md,
    borderRadius: radius.lg, borderWidth: 1, borderColor: maritime.glassBorder, borderTopColor: maritime.edgeLight, backgroundColor: maritime.glass,
  },
  pagTitulo: { fontSize: 14, fontWeight: '700', color: colors.white },
  pagSub: { fontSize: 12, color: colors.muted, marginTop: 1 },
}));
