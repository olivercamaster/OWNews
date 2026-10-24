/**
 * Compartilhar minha escala — gera uma IMAGEM do mês (só a escala) para mandar à família.
 * Quem recebe não precisa do OWBuddy. Nada pessoal entra na imagem: os dados vêm de
 * mesCompartilhado(), que recebe apenas o ciclo (sem nome, empresa, voo, contatos...).
 *
 * Nativo: react-native-view-shot gera o PNG e expo-sharing abre o menu do sistema
 * (WhatsApp, Instagram...). Web (preview): Web Share com arquivo quando o navegador
 * suporta; senão baixa o PNG. A imagem tem paleta fixa (igual em tema claro/escuro).
 */
import { useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { mesCompartilhado, nomeArquivoEscala } from '@owbuddy/domain';
import type { EscalaConfig } from '@owbuddy/domain';
import { PALETA_COMPARTILHAR, colors, maritime, radius, spacing, themed } from '../theme';
import { useTema } from '../tema';
import { analytics } from '../analytics';
import { avisar } from '../feedback';

// Paleta da IMAGEM (independe do tema do app — a imagem é sempre a mesma): theme.ts.
const P = PALETA_COMPARTILHAR;
const SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const LARGURA = 340;

export function CompartilharEscala({ visivel, config, ano, mes, onFechar }: {
  visivel: boolean; config: EscalaConfig; ano: number; mes: number; onFechar: () => void;
}) {
  useTema();
  const { width, height } = useWindowDimensions();
  const [vm, setVm] = useState({ ano, mes });
  const [gerando, setGerando] = useState(false);
  const cartao = useRef<View>(null);
  useEffect(() => { if (visivel) setVm({ ano, mes }); }, [visivel, ano, mes]);

  const dados = mesCompartilhado(config, vm.ano, vm.mes);
  const escala = Math.min(1, (Math.min(width, 560) - 2 * spacing.md) / LARGURA);
  const nav = (d: number) => setVm(v => {
    let m = v.mes + d, a = v.ano;
    if (m > 12) { m = 1; a++; } else if (m < 1) { m = 12; a--; }
    return { ano: a, mes: m };
  });

  const compartilhar = async () => {
    if (!cartao.current || gerando) return;
    setGerando(true);
    try {
      if (Platform.OS === 'web') {
        const dataUri = await captureRef(cartao, { format: 'png', quality: 1, result: 'data-uri' });
        const blob = await (await fetch(dataUri)).blob();
        const nome = nomeArquivoEscala(vm.ano, vm.mes);
        const file = typeof File !== 'undefined' ? new File([blob], nome, { type: 'image/png' }) : null;
        const nav2 = typeof navigator !== 'undefined' ? (navigator as Navigator & { canShare?: (d: unknown) => boolean }) : null;
        if (file && nav2?.share && nav2.canShare?.({ files: [file] })) {
          await nav2.share({ files: [file], title: 'Minha escala' } as ShareData);
          analytics.track('share_scale', { modo: 'web_share' });
        } else {
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = nome;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(a.href), 4000);
          analytics.track('share_scale', { modo: 'download' });
          avisar('Imagem salva — é só enviar');
        }
      } else {
        const uri = await captureRef(cartao, { format: 'png', quality: 1, result: 'tmpfile', width: LARGURA * 3 });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Compartilhar escala', UTI: 'public.png' });
          analytics.track('share_scale', { modo: 'nativo' });
        } else {
          avisar('Compartilhamento indisponível neste aparelho');
        }
      }
    } catch (e) {
      // Cancelar o menu de compartilhar não é erro para o usuário.
      const nome = e instanceof Error ? e.name : '';
      if (nome !== 'AbortError') avisar('Não consegui gerar a imagem agora. Tente de novo.');
    } finally {
      setGerando(false);
    }
  };

  return (
    <Modal visible={visivel} transparent animationType="fade" onRequestClose={onFechar}>
      <Pressable style={styles.fundo} onPress={onFechar} accessibilityLabel="Fechar">
        <Pressable style={[styles.sheet, { maxHeight: height - 24 }]} onPress={() => {}}>
          <ScrollView contentContainerStyle={styles.sheetConteudo} bounces={false}>
            <View style={styles.topo}>
              <Text style={styles.titulo}>Compartilhar escala</Text>
              <TouchableOpacity onPress={onFechar} hitSlop={10} accessibilityRole="button" accessibilityLabel="Fechar">
                <Ionicons name="close" size={22} color={colors.muted} />
              </TouchableOpacity>
            </View>
            <Text style={styles.sub}>Só a escala vai na imagem — sem nome, empresa, voo ou contatos.</Text>

            <View style={styles.navMes}>
              <TouchableOpacity onPress={() => nav(-1)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Mês anterior" style={styles.navBtn}>
                <Ionicons name="chevron-back" size={20} color={colors.muted} />
              </TouchableOpacity>
              <Text style={styles.navTexto}>{dados?.titulo ?? ''}</Text>
              <TouchableOpacity onPress={() => nav(1)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Próximo mês" style={styles.navBtn}>
                <Ionicons name="chevron-forward" size={20} color={colors.muted} />
              </TouchableOpacity>
            </View>

            {dados ? (
              <View style={{ alignItems: 'center', height: (230 + dados.semanas.length * 44) * escala, overflow: 'hidden' }}>
                <View style={escala < 1 ? ({ transform: [{ scale: escala }], transformOrigin: 'top center' } as never) : undefined}>
                  <View ref={cartao} collapsable={false} style={img.cartao}>
                    <Text style={img.kicker}>MINHA ESCALA</Text>
                    <Text style={img.mes}>{dados.titulo}</Text>
                    <Text style={img.ciclo}>Escala {dados.ciclo}</Text>
                    <View style={img.semana}>
                      {SEMANA.map((d, i) => <Text key={i} style={img.semanaTx}>{d}</Text>)}
                    </View>
                    {dados.semanas.map((sem, si) => (
                      <View key={si} style={img.linha}>
                        {sem.map((c, ci) => c ? (
                          <View key={ci} style={[img.cel, { backgroundColor: c.tipo === 'EMBARCADO' ? P.embBg : P.folgaBg },
                            c.embarque && { borderColor: P.embarque, borderWidth: 2 },
                            c.desembarque && { borderColor: P.desembarque, borderWidth: 2 }]}>
                            <Text style={[img.celTx, { color: c.tipo === 'EMBARCADO' ? P.embTx : P.folgaTx }]}>{c.dia}</Text>
                          </View>
                        ) : <View key={ci} style={img.celVazia} />)}
                      </View>
                    ))}
                    <View style={img.legenda}>
                      <Legenda cor={P.embBg} texto={`Embarcado · ${dados.diasEmbarcado}`} />
                      <Legenda cor={P.folgaBg} texto={`Folga · ${dados.diasFolga}`} />
                      <Legenda cor="transparent" borda={P.embarque} texto="Embarque" />
                      <Legenda cor="transparent" borda={P.desembarque} texto="Desembarque" />
                    </View>
                    <View style={img.marca}>
                      <Text style={img.marcaNome}>OWBuddy</Text>
                      <Text style={img.marcaFrase}>Seu parceiro na vida offshore.</Text>
                    </View>
                  </View>
                </View>
              </View>
            ) : null}

            <TouchableOpacity style={[styles.botao, gerando && { opacity: 0.6 }]} onPress={compartilhar} disabled={gerando || !dados} accessibilityRole="button">
              <Ionicons name="share-social-outline" size={18} color={colors.onAccent} />
              <Text style={styles.botaoTexto}>{gerando ? 'Gerando imagem…' : 'Compartilhar imagem'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.fechar} onPress={onFechar} accessibilityRole="button">
              <Text style={styles.fecharTexto}>Fechar</Text>
            </TouchableOpacity>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Legenda({ cor, borda, texto }: { cor: string; borda?: string; texto: string }) {
  useTema();
  return (
    <View style={img.legItem}>
      <View style={[img.legCor, { backgroundColor: cor }, borda ? { borderColor: borda, borderWidth: 2 } : null]} />
      <Text style={img.legTx}>{texto}</Text>
    </View>
  );
}

const CEL = 40;
// Paleta fixa, mas no padrão themed() do app (lint de tema).
const img = themed(() => StyleSheet.create({
  cartao: { width: LARGURA, backgroundColor: P.fundo, borderRadius: 18, borderWidth: 1, borderColor: P.borda, padding: 18 },
  kicker: { color: P.marca, fontSize: 11, fontWeight: '800', letterSpacing: 1.6 },
  mes: { color: P.texto, fontSize: 24, fontWeight: '800', marginTop: 2 },
  ciclo: { color: P.apagado, fontSize: 13, marginTop: 2, marginBottom: 12 },
  semana: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  semanaTx: { width: CEL, textAlign: 'center', color: P.apagado, fontSize: 11, fontWeight: '700' },
  linha: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  cel: { width: CEL, height: CEL, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  celVazia: { width: CEL, height: CEL },
  celTx: { fontSize: 14, fontWeight: '700' },
  legenda: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  legItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legCor: { width: 14, height: 14, borderRadius: 4 },
  legTx: { color: P.apagado, fontSize: 11, fontWeight: '600' },
  marca: { marginTop: 14, borderTopWidth: 1, borderTopColor: P.borda, paddingTop: 10, flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  marcaNome: { color: P.texto, fontSize: 13, fontWeight: '800' },
  marcaFrase: { color: P.apagado, fontSize: 11 },
}));

const styles = themed(() => StyleSheet.create({
  fundo: { flex: 1, backgroundColor: maritime.overlay, justifyContent: 'center', alignItems: 'center', padding: 12 },
  sheet: { width: '100%', maxWidth: 520, backgroundColor: maritime.navBg, borderRadius: radius.xl, borderWidth: 1, borderColor: maritime.glassBorder, overflow: 'hidden' },
  sheetConteudo: { padding: spacing.md },
  topo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titulo: { fontSize: 18, fontWeight: '700', color: colors.white },
  sub: { fontSize: 12, color: colors.mutedDim, marginTop: 2 },
  navMes: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginVertical: spacing.sm },
  navBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  navTexto: { fontSize: 14, fontWeight: '700', color: colors.white, minWidth: 150, textAlign: 'center' },
  botao: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.cyan, borderRadius: radius.md, minHeight: 48, marginTop: spacing.sm },
  botaoTexto: { color: colors.onAccent, fontWeight: '700', fontSize: 15 },
  fechar: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  fecharTexto: { color: colors.muted, fontWeight: '600' },
}));
