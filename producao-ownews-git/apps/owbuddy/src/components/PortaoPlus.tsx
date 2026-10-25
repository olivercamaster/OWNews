/**
 * Portão do OWBuddy+ — envolve uma tela Plus.
 *
 *  - Plus → a tela, sem mudança nenhuma.
 *  - Ainda lendo a última confirmação → carregamento discreto (nunca cadeado que some depois).
 *  - Sem Plus → explica o recurso, diz que os dados continuam guardados e oferece CONHECER o
 *    OWBuddy+ (abre a tela informativa; nunca a compra direto) ou "Agora não".
 * A tela Plus nem monta sem acesso: nada é lido para editar, nada é gravado, nada é apagado.
 */
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RECURSO_PLUS, textoDadosGuardados } from '@owbuddy/domain';
import type { RecursoPlus } from '@owbuddy/domain';
import { getCerts, getChecklist, getContatos, getHistorico, getViagem } from '../storage';
import { bottomNavSpace, colors, maritime, radius, spacing, themed, typography } from '../theme';
import { useTema } from '../tema';
import { OWBackground } from './OWBackground';
import { useOwBuddyPlus } from '../plus/acesso';
import { analytics } from '../analytics';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const ICONE: Record<RecursoPlus, IoniconsName> = {
  mala: 'checkbox-outline',
  viagem: 'airplane-outline',
  documentos: 'document-text-outline',
  historico: 'time-outline',
  contatos: 'call-outline',
};

/** Quantos itens a pessoa já guardou neste recurso (só leitura, só para o texto). */
async function contarDados(r: RecursoPlus): Promise<number> {
  switch (r) {
    case 'historico': return (await getHistorico()).registros.length;
    case 'mala': return (await getChecklist())?.items?.length ?? 0;
    case 'viagem': return (await getViagem()) ? 1 : 0;
    case 'documentos': return (await getCerts()).filter(c => !c._deleted).length;
    case 'contatos': return (await getContatos()).length;
  }
}

/** `aba`: tela de aba (reserva espaço da nav; "Agora não" volta ao Início). */
export function PortaoPlus({ recurso, aba = false, children }: { recurso: RecursoPlus; aba?: boolean; children: React.ReactNode }) {
  useTema();
  const { plus, lido, acesso } = useOwBuddyPlus();
  if (plus) return <>{children}</>;
  if (!lido || acesso.estado === 'carregando') return <CarregandoPlus />;
  return <BloqueioPlus recurso={recurso} aba={aba} />;
}

function CarregandoPlus() {
  useTema();
  return (
    <OWBackground showWatermark={false}>
      <View style={styles.carregando} accessibilityLabel="Carregando">
        <ActivityIndicator color={colors.mutedDim} />
      </View>
    </OWBackground>
  );
}

function BloqueioPlus({ recurso, aba }: { recurso: RecursoPlus; aba: boolean }) {
  useTema();
  const insets = useSafeAreaInsets();
  const { acesso, atualizar } = useOwBuddyPlus();
  const [qtd, setQtd] = useState<number | null>(null);
  const [tentando, setTentando] = useState(false);
  const def = RECURSO_PLUS[recurso];

  useEffect(() => {
    analytics.track('plus_bloqueio_visto', { recurso });
    contarDados(recurso).then(setQtd, () => setQtd(0));
  }, [recurso]);

  const guardados = qtd != null ? textoDadosGuardados(recurso, qtd) : null;
  const erro = acesso.estado === 'erro';

  const agoraNao = () => {
    analytics.track('plus_agora_nao', { recurso });
    if (aba) router.navigate('/');
    else if (router.canGoBack()) router.back();
    else router.navigate('/');
  };

  const tentar = async () => {
    setTentando(true);
    try { await atualizar(); } finally { setTentando(false); }
  };

  return (
    <OWBackground showWatermark={false}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: aba ? bottomNavSpace(insets.bottom) : insets.bottom + spacing.xl }]}>
        <View style={styles.cartao}>
          <View style={styles.topo}>
            <View style={styles.icone}>
              <Ionicons name={ICONE[recurso]} size={24} color={colors.iconDefault} />
            </View>
            <SeloPlus />
          </View>
          <Text style={styles.titulo} accessibilityRole="header">{def.titulo}</Text>
          <Text style={styles.beneficio}>{def.beneficio}</Text>

          {guardados ? (
            <View style={styles.guardados}>
              <Ionicons name="archive-outline" size={18} color={colors.cyanDim} />
              <Text style={styles.guardadosTexto}>{guardados} Nada foi apagado: tudo fica neste aparelho.</Text>
            </View>
          ) : null}

          {erro ? (
            <Text style={styles.situacao}>Não foi possível confirmar o OWBuddy+ agora.</Text>
          ) : acesso.pendente ? (
            <Text style={styles.situacao}>Seu pagamento está aguardando a confirmação da loja. O OWBuddy+ libera assim que a loja confirmar.</Text>
          ) : acesso.expirou ? (
            <Text style={styles.situacao}>Seu acesso ao OWBuddy+ terminou. Assine novamente para acessar e continuar usando {recurso === 'historico' ? 'seu histórico' : 'este recurso'}.</Text>
          ) : (
            <Text style={styles.situacao}>Faz parte do OWBuddy+.</Text>
          )}

          <TouchableOpacity
            style={styles.primario}
            onPress={() => router.push({ pathname: '/owbuddy-plus', params: { origem: recurso } })}
            accessibilityRole="button"
          >
            <Text style={styles.primarioTexto}>Conhecer OWBuddy+</Text>
          </TouchableOpacity>
          {erro ? (
            <TouchableOpacity style={styles.secundario} onPress={tentar} disabled={tentando} accessibilityRole="button">
              <Text style={styles.secundarioTexto}>{tentando ? 'Consultando…' : 'Tentar novamente'}</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={styles.terciario} onPress={agoraNao} accessibilityRole="button">
            <Text style={styles.terciarioTexto}>Agora não</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.rodape}>O OWBuddy Free continua funcionando normalmente: escala, calendário, Início e compartilhar.</Text>
      </ScrollView>
    </OWBackground>
  );
}

/** Selo discreto "OWBuddy+" com cadeado pequeno. Um por recurso, nunca em fila. */
export function SeloPlus({ compacto = false }: { compacto?: boolean }) {
  useTema();
  return (
    <View style={[styles.selo, compacto && styles.seloCompacto]} accessibilityLabel="Recurso do OWBuddy+">
      <Ionicons name="lock-closed" size={compacto ? 10 : 11} color={colors.kicker} />
      <Text style={[styles.seloTexto, compacto && styles.seloTextoCompacto]}>OWBuddy+</Text>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  carregando: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.md, paddingTop: spacing.lg },
  cartao: {
    backgroundColor: maritime.glassElevated, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm,
    borderWidth: 1, borderColor: maritime.glassBorder, borderTopColor: maritime.edgeLight, borderBottomColor: maritime.edgeDark,
    ...maritime.cardShadow,
  },
  topo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs },
  icone: {
    width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center',
    backgroundColor: maritime.iconTile, borderWidth: 1, borderColor: maritime.glassBorder,
  },
  titulo: { ...typography.h2 },
  beneficio: { fontSize: 15, lineHeight: 22, color: colors.muted },
  guardados: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, padding: spacing.md, marginTop: spacing.xs,
    borderRadius: radius.md, backgroundColor: colors.cyanFaint, borderWidth: 1, borderColor: maritime.accentBorder,
  },
  guardadosTexto: { flex: 1, fontSize: 14, lineHeight: 20, color: colors.white },
  situacao: { fontSize: 14, lineHeight: 20, color: colors.white, marginTop: spacing.xs },
  primario: {
    minHeight: 48, borderRadius: radius.md, paddingHorizontal: spacing.lg, justifyContent: 'center', alignItems: 'center',
    marginTop: spacing.sm, backgroundColor: colors.cyan, ...maritime.botaoPrimario,
  },
  primarioTexto: { fontSize: 15, fontWeight: '700', color: colors.onAccent },
  secundario: {
    minHeight: 48, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: maritime.glassBorder, borderTopColor: maritime.edgeLight, backgroundColor: maritime.glass,
  },
  secundarioTexto: { fontSize: 15, fontWeight: '700', color: colors.cyanDim },
  terciario: { minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  terciarioTexto: { fontSize: 15, fontWeight: '600', color: colors.muted },
  rodape: { ...typography.small, textAlign: 'center', marginTop: spacing.md, paddingHorizontal: spacing.md },
  selo: {
    flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.xl,
    borderWidth: 1, borderColor: maritime.glassBorder, backgroundColor: maritime.glass,
  },
  seloCompacto: { paddingHorizontal: 6, paddingVertical: 2 },
  seloTexto: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3, color: colors.kicker },
  seloTextoCompacto: { fontSize: 10 },
}));
