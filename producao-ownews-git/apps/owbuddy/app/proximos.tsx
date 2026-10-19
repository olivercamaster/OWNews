/**
 * Próximos — linha do tempo dos acontecimentos (Buddy Agora): Hoje, Amanhã, Esta semana,
 * Próximos 30 dias, Mais adiante. Não é calendário: o calendário continua na Minha Escala.
 */
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { agruparPorFaixa, gerarAcontecimentos, type Acontecimento } from '@owbuddy/domain';
import type { EscalaConfig, Viagem } from '@owbuddy/domain';
import { getCerts, getChecklist, getEscala, getEventosPessoais, getPagamento, getViagem } from '../src/storage';
import { colors, maritime, radius, spacing, typography } from '../src/theme';
import { OWBackground } from '../src/components/OWBackground';
import { AcontecimentoLinha } from '../src/components/AcontecimentoLinha';
import { TransporteSheet } from '../src/components/TransporteSheet';
import { opcoesTransporte } from '../src/transporte';
import { analytics } from '../src/analytics';

export default function Proximos() {
  const insets = useSafeAreaInsets();
  const [lista, setLista] = useState<Acontecimento[] | null>(null);
  const [temPagamento, setTemPagamento] = useState(true);
  const [ctx, setCtx] = useState<{ viagem: Viagem | null; escala: EscalaConfig | null }>({ viagem: null, escala: null });
  const [transporte, setTransporte] = useState(false);

  useFocusEffect(useCallback(() => {
    analytics.track('proximos_opened');
    (async () => {
      const [escala, checklist, certs, viagem, eventos, pagamento] = await Promise.all([
        getEscala(), getChecklist(), getCerts(), getViagem(), getEventosPessoais(), getPagamento(),
      ]);
      setCtx({ viagem, escala });
      setTemPagamento(!!pagamento);
      setLista(gerarAcontecimentos({ escala, checklist, certs, viagem, eventos, pagamento }));
    })();
  }, []));

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
            <Ionicons name="wallet-outline" size={18} color="#a5d6a7" />
            <View style={{ flex: 1 }}>
              <Text style={styles.pagTitulo}>Meu Pagamento</Text>
              <Text style={styles.pagSub}>Cadastre a regra da sua empresa e veja a data provável aqui.</Text>
            </View>
            <Ionicons name="chevron-forward" size={14} color={colors.mutedDim} />
          </TouchableOpacity>
        )}
      </ScrollView>
      <TransporteSheet visivel={transporte} opcoes={opcoesTransporte(ctx.viagem, ctx.escala)} onFechar={() => setTransporte(false)} />
    </OWBackground>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md },
  novo: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48, paddingHorizontal: spacing.md,
    borderRadius: radius.lg, borderWidth: 1, borderColor: 'rgba(18, 168, 238, 0.35)', backgroundColor: 'rgba(18, 168, 238, 0.10)',
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
  pagTitulo: { fontSize: 14, fontWeight: '700', color: colors.white },
  pagSub: { fontSize: 12, color: colors.muted, marginTop: 1 },
});
