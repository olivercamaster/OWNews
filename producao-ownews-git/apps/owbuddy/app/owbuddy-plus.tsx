/**
 * OWBuddy Premium — tela informativa e de assinatura.
 *
 * Tudo à vista ANTES de qualquer compra: o que é Free, o que é Premium, o período de boas-vindas
 * de 45 dias (local, sem cobrança), preço e período (da loja),
 * período gratuito (só se a loja disser que a pessoa tem direito), renovação automática, como
 * cancelar, que o Free continua e que nenhum dado é apagado. A compra só abre por toque no botão,
 * e quem confirma é a Google Play / App Store.
 */
import { useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BENEFICIOS_PLUS, CENARIOS_TESTE_PLUS, RECURSOS_FREE, TRIAL_PREMIUM_DIAS, ofertaTexto, textoDiasRestantes } from '@owbuddy/domain';
import type { AcessoPlus, CenarioTestePlus, ProdutoPlus } from '@owbuddy/domain';
import { colors, maritime, radius, spacing, themed, typography } from '../src/theme';
import { useTema } from '../src/tema';
import { OWBackground } from '../src/components/OWBackground';
import { useOwBuddyPlus, reiniciarAcessoPlusTeste } from '../src/plus/acesso';
import type { ResultadoCompra, ResultadoRestaurar } from '../src/plus/loja';
import { useAcaoUnica } from '../src/acoes';
import { formatDateBR } from '../src/format';
import { avisar } from '../src/feedback';
import { analytics } from '../src/analytics';

const URL_PRIVACIDADE = 'https://ownews.com.br/privacidade';
/** Termos de uso do OWBuddy: ainda NÃO publicados (pendência). Enquanto null, só o iOS mostra o EULA padrão da Apple. */
const URL_TERMOS_OWBUDDY: string | null = null;
const URL_EULA_APPLE = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';

// Origem do evento: só valores fixos (nunca o parâmetro cru da URL).
const EVENTO_ORIGEM: Record<string, { origem: string }> = {
  buddy_inteligente: { origem: 'buddy_inteligente' }, alertas_inteligentes: { origem: 'alertas_inteligentes' },
  historico_avancado: { origem: 'historico_avancado' }, 'buddy-config': { origem: 'buddy-config' },
  proximos: { origem: 'proximos' }, fim_periodo: { origem: 'fim_periodo' }, perto_fim: { origem: 'perto_fim' },
};

const MSG_COMPRA: Record<ResultadoCompra, string | null> = {
  concluida: null,
  cancelada: null,
  pendente: 'Pagamento aguardando confirmação da loja. O OWBuddy Premium libera assim que a loja confirmar.',
  ja_assinante: 'Você já tem o OWBuddy Premium nesta conta da loja. Acesso atualizado.',
  offline: 'Sem internet agora. Nada foi cobrado. Tente de novo quando estiver conectado.',
  erro: 'Não foi possível concluir pela loja agora. Nada foi cobrado pelo OWBuddy.',
};

const MSG_RESTAURAR: Record<ResultadoRestaurar, string> = {
  encontrada: 'Assinatura encontrada. OWBuddy Premium ativo.',
  nenhuma: 'Nenhuma assinatura do OWBuddy Premium foi encontrada nesta conta da loja.',
  offline: 'Sem internet agora. Tente de novo quando estiver conectado.',
  erro: 'Não foi possível consultar a loja agora.',
};

function dataCurta(ms: number): string {
  const d = new Date(ms);
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return formatDateBR(iso);
}

export default function TelaOwBuddyPlus() {
  useTema();
  const insets = useSafeAreaInsets();
  const { origem } = useLocalSearchParams<{ origem?: string }>();
  const p = useOwBuddyPlus();
  const [msg, setMsg] = useState<string | null>(null);
  // Assinante da LOJA (o período de 45 dias não é assinatura: durante ele a oferta continua à vista).
  const assinante = p.plus && p.acesso.origem !== 'trial';

  useEffect(() => {
    analytics.track('plus_tela_aberta', (origem && Object.prototype.hasOwnProperty.call(EVENTO_ORIGEM, origem) ? EVENTO_ORIGEM[origem] : null) ?? { origem: 'outra' });
  }, [origem]);

  // Preço e oferta: só da loja, e só para quem ainda não assina.
  useEffect(() => {
    if (!assinante && p.produto.tipo !== 'ok') p.carregarProduto();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assinante]);

  const [comprar, comprando] = useAcaoUnica(async (produto: ProdutoPlus) => {
    setMsg(null);
    analytics.track('plus_cta_tocado', { com_periodo_gratuito: !!produto.gratis });
    const r = await p.comprar(produto);
    analytics.track('plus_compra_resultado', { resultado: r });
    if (r === 'concluida') avisar('OWBuddy Premium ativo');
    setMsg(MSG_COMPRA[r]);
  });

  const [restaurar, restaurando] = useAcaoUnica(async () => {
    setMsg(null);
    const r = await p.restaurar();
    analytics.track('plus_restaurar_resultado', { resultado: r });
    setMsg(MSG_RESTAURAR[r]);
  });

  const [gerenciar] = useAcaoUnica(async () => {
    analytics.track('plus_gerenciar_aberto');
    const ok = await p.gerenciar();
    if (!ok) setMsg('Não foi possível abrir a loja agora. Você também pode gerenciar pela Google Play ou em Ajustes › Assinaturas no iPhone.');
  });

  const sair = () => (router.canGoBack() ? router.back() : router.navigate('/'));
  const semLoja = p.plataforma === 'indisponivel';
  const termos = URL_TERMOS_OWBUDDY ?? (p.plataforma === 'ios' ? URL_EULA_APPLE : null);

  return (
    <OWBackground showWatermark={false}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}>
        {p.modoTeste ? <PainelTeste /> : null}

        <Text style={styles.kicker}>OWBuddy Premium</Text>
        <Text style={styles.titulo} accessibilityRole="header">O Buddy cuidando do seu ciclo</Text>

        <Situacao acesso={p.acesso} lido={p.lido} />

        <View style={styles.cartao}>
          <Text style={styles.secao}>O Premium acrescenta</Text>
          {BENEFICIOS_PLUS.map(b => (
            <View key={b} style={styles.item}>
              <Ionicons name="checkmark" size={18} color={colors.green} />
              <Text style={styles.itemTexto}>{b}</Text>
            </View>
          ))}
        </View>

        {!assinante ? (
          <View style={styles.cartao}>
            {semLoja ? (
              <Text style={styles.corpo}>A assinatura do OWBuddy Premium ainda não está disponível. Quando estiver, será feita pela Google Play ou pela App Store — nunca fora da loja.</Text>
            ) : p.produto.tipo === 'carregando' || !p.lido ? (
              <View style={styles.reserva} accessibilityLabel="Consultando a loja">
                <Text style={styles.corpoApagado}>Consultando a loja…</Text>
              </View>
            ) : p.produto.tipo === 'erro' ? (
              <View style={{ gap: spacing.sm }}>
                <Text style={styles.corpo}>Não foi possível consultar o OWBuddy Premium agora.</Text>
                <TouchableOpacity style={styles.secundario} onPress={() => p.carregarProduto()} accessibilityRole="button">
                  <Text style={styles.secundarioTexto}>Tentar novamente</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Oferta produto={p.produto.produto} teste={p.modoTeste} ocupado={comprando} onComprar={comprar} />
            )}
            {msg ? <Text style={styles.msg} accessibilityLiveRegion="polite" accessibilityRole="alert">{msg}</Text> : null}
            <TouchableOpacity style={styles.terciario} onPress={sair} accessibilityRole="button">
              <Text style={styles.terciarioTexto}>Continuar no Free</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.cartao}>
            <Text style={styles.corpo}>A assinatura é gerenciada pela loja onde foi contratada. Lá você vê a próxima cobrança, troca a forma de pagamento ou cancela.</Text>
            <TouchableOpacity style={styles.secundario} onPress={gerenciar} accessibilityRole="button">
              <Text style={styles.secundarioTexto}>Gerenciar assinatura</Text>
            </TouchableOpacity>
            {msg ? <Text style={styles.msg} accessibilityLiveRegion="polite" accessibilityRole="alert">{msg}</Text> : null}
          </View>
        )}

        <View style={styles.cartao}>
          <Text style={styles.secao}>Do OWBuddy Free, para sempre</Text>
          {RECURSOS_FREE.map(b => (
            <View key={b} style={styles.item}>
              <Ionicons name="checkmark" size={18} color={colors.iconDefault} />
              <Text style={styles.itemTexto}>{b}</Text>
            </View>
          ))}
          <Text style={styles.corpoApagado}>Não precisa de Conta OW para assinar: a assinatura fica na sua conta da Google Play ou da App Store.</Text>
        </View>

        {!semLoja ? (
          <View style={styles.links}>
            {!assinante ? (
              <TouchableOpacity style={styles.link} onPress={restaurar} disabled={restaurando} accessibilityRole="button">
                <Ionicons name="refresh-outline" size={18} color={colors.cyanDim} />
                <Text style={styles.linkTexto}>{restaurando ? 'Consultando a loja…' : 'Restaurar compras'}</Text>
              </TouchableOpacity>
            ) : null}
            {!assinante ? (
              <TouchableOpacity style={styles.link} onPress={gerenciar} accessibilityRole="button">
                <Ionicons name="open-outline" size={18} color={colors.cyanDim} />
                <Text style={styles.linkTexto}>Gerenciar assinatura</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        <Text style={styles.rodape}>
          A assinatura é gerenciada pela loja onde foi contratada (Google Play ou App Store). O OWBuddy não recebe dados do seu cartão
          e não apaga nada quando a assinatura termina.
        </Text>
        <View style={styles.legais}>
          {termos ? (
            <Text style={styles.legal} onPress={() => Linking.openURL(termos).catch(() => {})} accessibilityRole="link">Termos de uso</Text>
          ) : null}
          <Text style={styles.legal} onPress={() => Linking.openURL(URL_PRIVACIDADE).catch(() => {})} accessibilityRole="link">Política de privacidade</Text>
        </View>
      </ScrollView>
    </OWBackground>
  );
}

function Situacao({ acesso, lido }: { acesso: AcessoPlus; lido: boolean }) {
  useTema();
  if (!lido || acesso.estado === 'carregando') {
    return <View style={[styles.situacao, styles.reserva]}><Text style={styles.corpoApagado}>Verificando seu acesso…</Text></View>;
  }
  let icone: React.ComponentProps<typeof Ionicons>['name'] = 'person-outline';
  let titulo = 'Você está no OWBuddy Free';
  let linha: string | null = null;
  let cor: string = colors.iconDefault;
  if (acesso.nivel === 'premium_trial' && acesso.trial) {
    icone = 'star';
    cor = colors.green;
    titulo = `Premium ativo · ${textoDiasRestantes(acesso.trial.diasRestantes)}`;
    linha = `Período de boas-vindas de ${TRIAL_PREMIUM_DIAS} dias, sem cobrança, até ${dataCurta(acesso.trial.fim)}. Depois você continua no Free, com tudo o que é seu.`;
  } else if (acesso.plus) {
    icone = 'checkmark-circle';
    cor = colors.green;
    titulo = 'OWBuddy Premium ativo';
    if (acesso.origem === 'cache' && acesso.motivoErro) linha = 'Sem conexão com a loja agora. Seu acesso continua liberado.';
    else if (acesso.cancelado) linha = acesso.fimDoPeriodo
      ? `Renovação automática desligada. Ativo até ${dataCurta(acesso.fimDoPeriodo)}.`
      : 'Renovação automática desligada. O acesso continua até o fim do período já pago.';
    else if (acesso.fimDoPeriodo) linha = `Próxima renovação: ${dataCurta(acesso.fimDoPeriodo)}.`;
  } else if (acesso.estado === 'erro') {
    icone = 'cloud-offline-outline';
    titulo = 'Não foi possível consultar o OWBuddy Premium agora';
    linha = 'O OWBuddy Free continua funcionando normalmente.';
  } else if (acesso.pendente) {
    icone = 'time-outline';
    cor = colors.amber;
    titulo = 'Pagamento aguardando confirmação';
    linha = 'O OWBuddy Premium libera assim que a loja confirmar.';
  } else if (acesso.expirou) {
    titulo = acesso.trial?.terminou && !acesso.fimDoPeriodo ? 'Seu período Premium terminou' : 'Seu acesso ao OWBuddy Premium terminou';
    linha = 'Sua Escala, Minha Mala e seus dados continuam disponíveis normalmente. Os recursos avançados do Buddy agora fazem parte do Premium.';
  } else if (!acesso.trial) {
    linha = `Configure sua escala e o Premium fica liberado por ${TRIAL_PREMIUM_DIAS} dias, sem cobrança e sem cadastro.`;
  }
  return (
    <View style={styles.situacao} accessibilityLabel={linha ? `${titulo}. ${linha}` : titulo}>
      <Ionicons name={icone} size={22} color={cor} />
      <View style={{ flex: 1 }}>
        <Text style={styles.situacaoTitulo}>{titulo}</Text>
        {linha ? <Text style={styles.situacaoLinha}>{linha}</Text> : null}
      </View>
    </View>
  );
}

function Oferta({ produto, teste, ocupado, onComprar }: { produto: ProdutoPlus; teste: boolean; ocupado: boolean; onComprar: (p: ProdutoPlus) => void }) {
  useTema();
  const o = ofertaTexto(produto);
  return (
    <View style={{ gap: spacing.sm }}>
      {teste ? <Text style={styles.teste}>Modo de teste: preço e período fictícios. Nada é cobrado.</Text> : null}
      <Text style={styles.destaque}>{o.destaque}</Text>
      {o.depois ? <Text style={styles.depois}>{o.depois}</Text> : null}
      <Text style={styles.aviso}>{o.aviso}</Text>
      <TouchableOpacity
        style={[styles.primario, ocupado && { opacity: 0.6 }]}
        onPress={() => onComprar(produto)}
        disabled={ocupado}
        accessibilityRole="button"
        accessibilityHint={o.aviso}
      >
        <Text style={styles.primarioTexto}>{ocupado ? 'Abrindo a loja…' : o.cta}</Text>
      </TouchableOpacity>
      <View style={styles.transparencia}>
        <Linha icone="repeat-outline" texto={o.renovacao} />
        <Linha icone="close-circle-outline" texto={o.cancelamento} />
        <Linha icone="phone-portrait-outline" texto="O OWBuddy Free continua funcionando normalmente." />
        <Linha icone="archive-outline" texto="Se a assinatura terminar, nada é apagado: seus dados ficam guardados neste aparelho." />
      </View>
    </View>
  );
}

function Linha({ icone, texto }: { icone: React.ComponentProps<typeof Ionicons>['name']; texto: string }) {
  useTema();
  return (
    <View style={styles.item}>
      <Ionicons name={icone} size={18} color={colors.iconDefault} />
      <Text style={styles.itemTexto}>{texto}</Text>
    </View>
  );
}

/** SÓ com modo de teste (dev / preview com a flag). Nunca existe no build de produção. */
function PainelTeste() {
  useTema();
  const [atual, setAtual] = useState<CenarioTestePlus | null>(null);
  useEffect(() => {
    (require('../src/plus/loja-teste') as typeof import('../src/plus/loja-teste')).cenarioTesteAtual().then(setAtual);
  }, []);
  const escolher = async (c: CenarioTestePlus) => {
    setAtual(c);
    await (require('../src/plus/loja-teste') as typeof import('../src/plus/loja-teste')).definirCenarioTeste(c);
    reiniciarAcessoPlusTeste();
  };
  return (
    <View style={styles.painel} accessibilityLabel="Modo de teste do OWBuddy Premium">
      <Text style={styles.painelTitulo}>Modo de teste · somente desenvolvimento</Text>
      <View style={styles.painelChips}>
        {CENARIOS_TESTE_PLUS.map(c => (
          <TouchableOpacity key={c.id} onPress={() => escolher(c.id)} style={[styles.chip, atual === c.id && styles.chipAtivo]}
            accessibilityRole="button" accessibilityState={{ selected: atual === c.id }}>
            <Text style={[styles.chipTexto, atual === c.id && styles.chipTextoAtivo]}>{c.rotulo}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  content: { padding: spacing.md, gap: spacing.md },
  kicker: { fontSize: 12, fontWeight: '700', color: colors.kicker, letterSpacing: 0.8, textTransform: 'uppercase', marginTop: spacing.xs },
  titulo: { ...typography.h2, marginTop: -spacing.sm },
  cartao: {
    backgroundColor: maritime.glassElevated, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm,
    borderWidth: 1, borderColor: maritime.glassBorder, borderTopColor: maritime.edgeLight, borderBottomColor: maritime.edgeDark,
    ...maritime.cardShadow,
  },
  secao: { ...typography.label, marginBottom: 2 },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  itemTexto: { flex: 1, fontSize: 15, lineHeight: 21, color: colors.white },
  corpo: { fontSize: 15, lineHeight: 22, color: colors.white },
  corpoApagado: { fontSize: 14, lineHeight: 20, color: colors.muted },
  reserva: { minHeight: 48, justifyContent: 'center' },
  situacao: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg,
    borderWidth: 1, borderColor: maritime.glassBorder, borderTopColor: maritime.edgeLight, backgroundColor: maritime.glass,
  },
  situacaoTitulo: { fontSize: 16, fontWeight: '700', color: colors.white },
  situacaoLinha: { fontSize: 14, lineHeight: 20, color: colors.muted, marginTop: 2 },
  destaque: { fontSize: 26, lineHeight: 32, fontWeight: '700', letterSpacing: -0.4, color: colors.white },
  depois: { fontSize: 16, fontWeight: '600', color: colors.white, marginTop: -spacing.xs },
  aviso: { fontSize: 15, lineHeight: 22, color: colors.white },
  teste: {
    fontSize: 13, fontWeight: '700', color: colors.amber, padding: spacing.sm, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.amber,
  },
  primario: {
    minHeight: 50, borderRadius: radius.md, paddingHorizontal: spacing.lg, justifyContent: 'center', alignItems: 'center',
    backgroundColor: colors.cyan, ...maritime.botaoPrimario,
  },
  primarioTexto: { fontSize: 16, fontWeight: '700', color: colors.onAccent },
  secundario: {
    minHeight: 48, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: maritime.glassBorder, borderTopColor: maritime.edgeLight, backgroundColor: maritime.glass,
  },
  secundarioTexto: { fontSize: 15, fontWeight: '700', color: colors.cyanDim },
  terciario: { minHeight: 46, justifyContent: 'center', alignItems: 'center' },
  terciarioTexto: { fontSize: 15, fontWeight: '700', color: colors.cyanDim },
  transparencia: { gap: spacing.sm, paddingTop: spacing.sm, marginTop: spacing.xs, borderTopWidth: 1, borderTopColor: maritime.glassBorder },
  msg: { fontSize: 14, lineHeight: 20, color: colors.white, textAlign: 'center' },
  links: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm },
  link: {
    flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: spacing.md, borderRadius: radius.md,
    borderWidth: 1, borderColor: maritime.glassBorder, backgroundColor: maritime.glass,
  },
  linkTexto: { fontSize: 14, fontWeight: '700', color: colors.cyanDim },
  rodape: { fontSize: 13, lineHeight: 19, color: colors.muted, textAlign: 'center', paddingHorizontal: spacing.sm },
  legais: { flexDirection: 'row', justifyContent: 'center', gap: spacing.lg },
  legal: { fontSize: 14, fontWeight: '600', color: colors.cyanDim, textDecorationLine: 'underline', paddingVertical: spacing.sm },
  painel: { padding: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.amber, gap: 6 },
  painelTitulo: { fontSize: 12, fontWeight: '700', color: colors.amber, textTransform: 'uppercase', letterSpacing: 0.6 },
  painelChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    minHeight: 32, paddingHorizontal: 10, borderRadius: radius.xl, justifyContent: 'center',
    borderWidth: 1, borderColor: maritime.glassBorder, backgroundColor: maritime.glass,
  },
  chipAtivo: { borderColor: colors.amber },
  chipTexto: { fontSize: 12, fontWeight: '600', color: colors.muted },
  chipTextoAtivo: { color: colors.amber },
}));
