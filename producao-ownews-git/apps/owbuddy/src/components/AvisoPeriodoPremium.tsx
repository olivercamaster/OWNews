/**
 * Os DOIS únicos avisos do período Premium de 45 dias, só no Início, cada um uma vez na vida:
 *  - perto do fim (≤ 3 dias): o que muda e o que NÃO muda;
 *  - no fim: Escala, Mala e dados continuam; [Conhecer Premium] ou [Continuar no Free].
 * Fora disso o período só aparece discreto em Meu Buddy. Sem pop-up, contagem regressiva ou spam.
 */
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { TRIAL_AVISO_FIM_DIAS } from '@owbuddy/domain';
import { colors, maritime, radius, spacing, themed } from '../theme';
import { useTema } from '../tema';
import { marcarAvisoTrial, trialPremiumAtual, useOwBuddyPlus } from '../plus/acesso';
import { analytics } from '../analytics';

export function AvisoPeriodoPremium() {
  useTema();
  const { acesso, lido } = useOwBuddyPlus();
  const registro = trialPremiumAtual();
  if (!lido || !registro || !acesso.trial) return null;

  const perto = acesso.nivel === 'premium_trial' && acesso.trial.diasRestantes <= TRIAL_AVISO_FIM_DIAS && !registro.avisoPerto;
  const fim = acesso.nivel === 'premium_expired' && acesso.trial.terminou && !registro.avisoFim;
  if (!perto && !fim) return null;

  const conhecer = () => {
    analytics.track(fim ? 'premium_fim_conhecer' : 'premium_perto_conhecer');
    marcarAvisoTrial(fim ? 'fim' : 'perto');
    router.push({ pathname: '/owbuddy-plus', params: { origem: fim ? 'fim_periodo' : 'perto_fim' } });
  };
  const fechar = () => {
    analytics.track(fim ? 'premium_fim_continuar_free' : 'premium_perto_ok');
    marcarAvisoTrial(fim ? 'fim' : 'perto');
  };
  const dias = acesso.trial.diasRestantes;

  return (
    <View style={styles.cartao} accessibilityRole="summary">
      <View style={styles.topo}>
        <Ionicons name="star-outline" size={16} color={colors.kicker} />
        <Text style={styles.titulo}>
          {fim ? 'Seu período Premium terminou' : dias === 1 ? 'Seu período Premium termina amanhã' : `Seu período Premium termina em ${dias} dias`}
        </Text>
      </View>
      <Text style={styles.texto}>
        {fim
          ? 'Sua Escala, Minha Mala e seus dados continuam disponíveis normalmente. Os recursos avançados do Buddy agora fazem parte do Premium.'
          : 'Depois, sua Escala, Minha Mala, viagem, documentos e histórico continuam iguais. Só os recursos avançados do Buddy passam a ser do Premium.'}
      </Text>
      <View style={styles.acoes}>
        <TouchableOpacity style={styles.primario} onPress={conhecer} accessibilityRole="button">
          <Text style={styles.primarioTexto}>Conhecer Premium</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secundario} onPress={fechar} accessibilityRole="button">
          <Text style={styles.secundarioTexto}>{fim ? 'Continuar no Free' : 'Entendi'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  cartao: {
    marginTop: spacing.md, padding: spacing.md, gap: spacing.sm, borderRadius: radius.lg,
    borderWidth: 1, borderColor: maritime.glassBorder, borderTopColor: maritime.edgeLight, backgroundColor: maritime.glass,
  },
  topo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titulo: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.white },
  texto: { fontSize: 13, lineHeight: 19, color: colors.muted },
  acoes: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: 2 },
  primario: {
    flexGrow: 1, minHeight: 44, borderRadius: radius.md, paddingHorizontal: spacing.md, justifyContent: 'center', alignItems: 'center',
    backgroundColor: colors.cyan, ...maritime.botaoPrimario,
  },
  primarioTexto: { fontSize: 14, fontWeight: '700', color: colors.onAccent },
  secundario: {
    flexGrow: 1, minHeight: 44, borderRadius: radius.md, paddingHorizontal: spacing.md, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: maritime.glassBorder, backgroundColor: maritime.glass,
  },
  secundarioTexto: { fontSize: 14, fontWeight: '700', color: colors.cyanDim },
}));
