/**
 * OWBuddy Premium na interface — upgrade, nunca punição.
 *
 *  - Nenhuma TELA é trancada: Escala, Mala, Viagem, Certificados, Contatos e o Histórico básico
 *    são do Free para sempre (docs/OWBUDDY-FREE-PREMIUM.md).
 *  - Um recurso Premium sem acesso aparece como um cartão discreto no lugar dele (nunca some).
 *    Ao tocar, o Buddy explica o valor e oferece [Conhecer Premium] (tela informativa, nunca a
 *    compra direto) ou [Agora não]. Nada de pop-up ao abrir, contagem regressiva ou cadeado em fila.
 *  - Nada é lido para editar, gravado ou apagado aqui.
 */
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RECURSO_PLUS } from '@owbuddy/domain';
import type { RecursoPlus } from '@owbuddy/domain';
import { colors, maritime, radius, spacing, surface, themed, typography } from '../theme';
import { useTema } from '../tema';
import { useOwBuddyPlus } from '../plus/acesso';
import { analytics } from '../analytics';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const ICONE: Record<RecursoPlus, IoniconsName> = {
  buddy_inteligente: 'compass-outline',
  alertas_inteligentes: 'notifications-outline',
  historico_avancado: 'stats-chart-outline',
};

/**
 * Cartão no lugar de um recurso Premium. Com Premium (assinatura ou período de 45 dias)
 * não aparece — quem chama mostra o recurso. Enquanto o acesso ainda carrega, não pisca nada.
 */
export function CartaoPremium({ recurso, texto }: { recurso: RecursoPlus; texto?: string }) {
  useTema();
  const insets = useSafeAreaInsets();
  const { plus, lido, acesso } = useOwBuddyPlus();
  const [aberto, setAberto] = useState(false);
  if (plus || !lido || acesso.estado === 'carregando') return null;
  const def = RECURSO_PLUS[recurso];

  const abrir = () => {
    analytics.track('plus_bloqueio_visto', { recurso });
    setAberto(true);
  };
  const conhecer = () => {
    setAberto(false);
    router.push({ pathname: '/owbuddy-plus', params: { origem: recurso } });
  };
  const agoraNao = () => {
    analytics.track('plus_agora_nao', { recurso });
    setAberto(false);
  };

  return (
    <>
      <TouchableOpacity style={styles.cartao} onPress={abrir} accessibilityRole="button" accessibilityLabel={`${def.titulo}. Recurso do OWBuddy Premium`}>
        <View style={styles.icone}>
          <Ionicons name={ICONE[recurso]} size={18} color={colors.iconDefault} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.titulo}>{def.titulo}</Text>
          <Text style={styles.texto} numberOfLines={2}>{texto ?? def.beneficio}</Text>
        </View>
        <SeloPremium compacto />
      </TouchableOpacity>

      <Modal visible={aberto} transparent animationType="fade" onRequestClose={agoraNao}>
        <Pressable style={styles.fundo} onPress={agoraNao} accessibilityLabel="Fechar">
          <Pressable style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.md) }]} onPress={() => {}}>
            <View style={styles.sheetTopo}>
              <Ionicons name={ICONE[recurso]} size={22} color={colors.iconDefault} />
              <SeloPremium />
            </View>
            <Text style={styles.sheetTitulo} accessibilityRole="header">{def.titulo}</Text>
            <Text style={styles.sheetTexto}>{def.beneficio}</Text>
            <Text style={styles.sheetNota}>
              {acesso.expirou
                ? 'Faz parte do OWBuddy Premium. Seus dados continuam aqui e o que é do Free continua funcionando normalmente.'
                : 'Faz parte do OWBuddy Premium. Seus dados e tudo o que é do Free continuam funcionando normalmente.'}
            </Text>
            <TouchableOpacity style={styles.primario} onPress={conhecer} accessibilityRole="button">
              <Text style={styles.primarioTexto}>Conhecer Premium</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.terciario} onPress={agoraNao} accessibilityRole="button">
              <Text style={styles.terciarioTexto}>Agora não</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

/** Selo discreto "Premium" (sem cadeado). Um por recurso, nunca em fila. */
export function SeloPremium({ compacto = false }: { compacto?: boolean }) {
  useTema();
  return (
    <View style={[styles.selo, compacto && styles.seloCompacto]} accessibilityLabel="Recurso do OWBuddy Premium">
      <Ionicons name="star" size={compacto ? 9 : 10} color={colors.kicker} />
      <Text style={[styles.seloTexto, compacto && styles.seloTextoCompacto]}>Premium</Text>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  cartao: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 56, padding: spacing.md, marginBottom: spacing.md,
    borderRadius: radius.lg, borderWidth: 1, borderColor: maritime.glassBorder, borderTopColor: maritime.edgeLight, backgroundColor: maritime.glass,
  },
  icone: {
    width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center',
    backgroundColor: maritime.iconTile, borderWidth: 1, borderColor: maritime.glassBorder,
  },
  titulo: { fontSize: 14, fontWeight: '700', color: colors.white },
  texto: { fontSize: 12, lineHeight: 17, color: colors.muted, marginTop: 1 },
  fundo: { flex: 1, backgroundColor: maritime.overlay, justifyContent: 'flex-end', alignItems: 'center' },
  sheet: {
    width: '100%', maxWidth: 560,
    backgroundColor: surface.header, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    padding: spacing.lg, gap: spacing.sm, borderWidth: 1, borderColor: maritime.glassBorder, borderTopColor: maritime.edgeLight,
  },
  sheetTopo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitulo: { ...typography.h2 },
  sheetTexto: { fontSize: 15, lineHeight: 22, color: colors.muted },
  sheetNota: { fontSize: 13, lineHeight: 19, color: colors.white, marginTop: spacing.xs },
  primario: {
    minHeight: 48, borderRadius: radius.md, paddingHorizontal: spacing.lg, justifyContent: 'center', alignItems: 'center',
    marginTop: spacing.sm, backgroundColor: colors.cyan, ...maritime.botaoPrimario,
  },
  primarioTexto: { fontSize: 15, fontWeight: '700', color: colors.onAccent },
  terciario: { minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  terciarioTexto: { fontSize: 15, fontWeight: '600', color: colors.muted },
  selo: {
    flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.xl,
    borderWidth: 1, borderColor: maritime.glassBorder, backgroundColor: maritime.glass,
  },
  seloCompacto: { paddingHorizontal: 6, paddingVertical: 2 },
  seloTexto: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3, color: colors.kicker },
  seloTextoCompacto: { fontSize: 10 },
}));
