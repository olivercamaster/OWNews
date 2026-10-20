/**
 * "Para onde você está indo?" → "Abrir em: Uber / 99". Sheet próprio (Modal) — funciona
 * igual em Android, iOS e web; sem hover. Não pede localização: a origem fica com o app.
 */
import { useEffect, useState } from 'react';
import { Linking, Modal, Platform, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, maritime, radius, spacing, surface, typography, themed, tokens } from '../theme';
import { useTema } from '../tema';
import { link99, linkUber, type OpcaoDestino, type Plataforma } from '../transporte';
import { analytics } from '../analytics';

export type { OpcaoDestino };

const plataforma: Plataforma = Platform.OS === 'android' ? 'android' : Platform.OS === 'ios' ? 'ios' : 'web';

export function TransporteSheet({ visivel, opcoes, onFechar }: { visivel: boolean; opcoes: OpcaoDestino[]; onFechar: () => void }) {
  useTema();
  const insets = useSafeAreaInsets();
  const todas: OpcaoDestino[] = [...opcoes, { id: 'outro', label: 'Outro destino', destino: null }];
  const [escolha, setEscolha] = useState<OpcaoDestino | null>(null);

  // Com um único destino possível ("Outro"), pula direto para "Abrir em".
  useEffect(() => { if (visivel) setEscolha(opcoes.length === 0 ? todas[0]! : null); }, [visivel]); // eslint-disable-line react-hooks/exhaustive-deps

  const abrir = (servico: 'uber' | '99') => {
    const url = servico === 'uber' ? linkUber(escolha?.destino ?? null) : link99(plataforma);
    analytics.track('transport_opened', { servico, com_destino: servico === 'uber' && !!escolha?.destino });
    Linking.openURL(url).catch(() => {});
    onFechar();
  };

  return (
    <Modal visible={visivel} transparent animationType="fade" onRequestClose={onFechar}>
      <Pressable style={styles.fundo} onPress={onFechar} accessibilityLabel="Fechar">
        <Pressable style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.md) }]} onPress={() => {}}>
          {!escolha ? (
            <>
              <Text style={styles.titulo}>Para onde você está indo?</Text>
              {todas.map(o => (
                <TouchableOpacity key={o.id} style={styles.linha} onPress={() => setEscolha(o)} accessibilityRole="button">
                  <Ionicons name={o.destino ? 'location-outline' : 'create-outline'} size={18} color={colors.cyanDim} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.linhaTexto}>{o.label}</Text>
                    {o.destino ? <Text style={styles.linhaSub}>{o.destino.nome}</Text> : <Text style={styles.linhaSub}>Você informa o destino no app</Text>}
                  </View>
                  <Ionicons name="chevron-forward" size={14} color={colors.mutedDim} />
                </TouchableOpacity>
              ))}
            </>
          ) : (
            <>
              <Text style={styles.titulo}>Abrir em</Text>
              <Text style={styles.sub}>{escolha.destino ? `Destino: ${escolha.destino.nome}` : 'Destino: você escolhe no app.'} A origem é a sua localização no próprio app.</Text>
              <TouchableOpacity style={[styles.botao, styles.botaoUber]} onPress={() => abrir('uber')} accessibilityRole="button" accessibilityLabel="Abrir na Uber">
                <Text style={styles.botaoUberTexto}>Uber</Text>
                <Text style={styles.botaoUberSub}>{escolha.destino ? 'com destino preenchido' : 'abre o app'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.botao} onPress={() => abrir('99')} accessibilityRole="button" accessibilityLabel="Abrir a 99">
                <Text style={styles.botaoTexto}>99</Text>
                <Text style={styles.botaoSub}>abre a 99 — informe o destino lá</Text>
              </TouchableOpacity>
              <Text style={styles.nota}>O OWBuddy não pede corrida nem faz pagamento — só abre o app escolhido.</Text>
              {opcoes.length > 0 && (
                <TouchableOpacity style={styles.voltar} onPress={() => setEscolha(null)} accessibilityRole="button">
                  <Text style={styles.voltarTexto}>Trocar destino</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = themed(() => StyleSheet.create({
  fundo: { flex: 1, backgroundColor: maritime.overlay, justifyContent: 'flex-end', alignItems: 'center' },
  sheet: {
    width: '100%', maxWidth: 560, backgroundColor: surface.header,
    borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    borderWidth: 1, borderColor: maritime.glassBorder, borderTopColor: maritime.edgeLight,
    paddingTop: spacing.lg, paddingHorizontal: spacing.md, gap: spacing.xs,
  },
  titulo: { ...typography.h3, paddingHorizontal: spacing.xs, marginBottom: spacing.xs },
  sub: { ...typography.small, paddingHorizontal: spacing.xs, marginBottom: spacing.sm },
  linha: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 56, paddingHorizontal: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: maritime.glassBorder,
  },
  linhaTexto: { fontSize: 15, fontWeight: '600', color: colors.white },
  linhaSub: { fontSize: 12, color: colors.muted, marginTop: 1 },
  botao: {
    minHeight: 56, borderRadius: radius.md, borderWidth: 1, borderColor: maritime.glassBorder,
    backgroundColor: maritime.glass, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.sm,
  },
  botaoUber: { backgroundColor: tokens.brandUberBg, borderColor: tokens.brandUberBorder },
  botaoUberTexto: { fontSize: 17, fontWeight: '800', color: tokens.brandUberText },
  botaoUberSub: { fontSize: 12, color: tokens.brandUberText, opacity: 0.72, marginTop: 1 },
  botaoTexto: { fontSize: 17, fontWeight: '800', color: colors.white },
  botaoSub: { fontSize: 12, color: colors.muted, marginTop: 1 },
  nota: { fontSize: 11, color: colors.mutedDim, textAlign: 'center', marginTop: spacing.xs },
  voltar: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md },
  voltarTexto: { fontSize: 13, color: colors.cyanDim, fontWeight: '600' },
}));
