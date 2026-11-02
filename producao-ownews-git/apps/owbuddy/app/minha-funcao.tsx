/**
 * Minha Função — o que a pessoa faz no offshore (ou quer fazer).
 *
 * Opcional e só neste aparelho: o catálogo é o de Carreiras do OWNews (público, igual para todos)
 * e o match com vagas e conteúdos acontece aqui. Informar a função não liga aviso nenhum — os
 * alertas são uma escolha à parte. "Quero embarcar" não é exercer a função.
 */
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { buscarFuncoes, conteudosParaFuncao, definirMinhaFuncao, rotuloMinhaFuncao } from '@owbuddy/domain';
import type { CatalogoFuncoes, FuncaoCatalogo, MinhaFuncao, SituacaoFuncao } from '@owbuddy/domain';
import { getMinhaFuncao, setMinhaFuncao } from '../src/storage';
import { fetchCatalogoFuncoes } from '../src/api';
import { colors, maritime, radius, spacing, themed, typography } from '../src/theme';
import { useTema } from '../src/tema';
import { OWBackground } from '../src/components/OWBackground';
import { abrirLinkExterno } from '../src/links';
import { analytics } from '../src/analytics';
import { avisar } from '../src/feedback';
import { confirmar } from '../src/confirmar';

export default function MinhaFuncaoTela() {
  useTema();
  const insets = useSafeAreaInsets();
  const [mf, setMf] = useState<MinhaFuncao | null>(null);
  const [cat, setCat] = useState<CatalogoFuncoes | null>(null);
  const [lido, setLido] = useState(false);
  const [editando, setEditando] = useState(false);
  // Rascunho do formulário
  const [situacao, setSituacao] = useState<SituacaoFuncao>('trabalho');
  const [area, setArea] = useState<string | null>(null);
  const [funcao, setFuncao] = useState<FuncaoCatalogo | null>(null);
  const [busca, setBusca] = useState('');
  const [livre, setLivre] = useState<string | null>(null);
  const [alertas, setAlertas] = useState(false);

  const preencher = (m: MinhaFuncao | null, c: CatalogoFuncoes | null) => {
    setSituacao(m?.situacao ?? 'trabalho');
    setArea(m?.area ?? null);
    setFuncao(m?.funcao && c ? c.funcoes.find((f) => f.slug === m.funcao!.slug) ?? null : null);
    setBusca('');
    setLivre(m?.texto_livre ?? null);
    setAlertas(m?.alertas ?? false);
  };

  const carregar = useCallback(async () => {
    const [m, c] = await Promise.all([getMinhaFuncao(), fetchCatalogoFuncoes().catch(() => null)]);
    setMf(m); setCat(c);
    if (!m) { preencher(null, c); setEditando(true); }
    setLido(true);
  }, []);
  useFocusEffect(useCallback(() => { analytics.track('my_role_opened'); carregar(); }, [carregar]));

  // Com texto digitado, busca em todas as áreas (quem troca de função costuma mudar de área); sem texto, lista a área escolhida.
  const sugestoes = useMemo(() => (funcao || livre !== null ? [] : buscarFuncoes(cat, busca, busca.trim() ? null : area, 8)), [cat, busca, area, funcao, livre]);
  const podeSalvar = situacao === 'quero_embarcar' || !!funcao || !!(livre && livre.trim()) || !!area;

  const salvar = async () => {
    const nova = definirMinhaFuncao({ situacao, area, funcao, texto_livre: livre, alertas }, new Date().toISOString());
    if (!nova) return;
    await setMinhaFuncao(nova);
    analytics.track('my_role_set'); // sem área, função nem situação: nada da pessoa vai para o analytics
    avisar('Função salva');
    setMf(nova); setEditando(false);
  };
  const remover = () => confirmar('Remover sua função?', 'Vagas e conteúdos voltam a aparecer sem prioridade. Seu histórico não muda.', 'Remover', async () => {
    await setMinhaFuncao(null);
    analytics.track('my_role_removed');
    setMf(null); preencher(null, cat); setEditando(true);
  });
  const alternarAlertas = async (v: boolean) => {
    if (!mf) return;
    const nova = { ...mf, alertas: v };
    await setMinhaFuncao(nova); setMf(nova);
  };

  if (!lido) return <OWBackground showWatermark={false}><View style={{ flex: 1 }} /></OWBackground>;

  const conteudos = conteudosParaFuncao(mf, cat);
  const areaNome = (id: string | null) => (id ? cat?.areas.find((a) => a.id === id)?.nome ?? null : null);

  return (
    <OWBackground showWatermark={false}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]} keyboardShouldPersistTaps="handled">
        {editando ? (
          <View style={styles.cartao}>
            <Text style={styles.kicker}>DEIXE O BUDDY MAIS SEU</Text>
            <Text style={styles.titulo} accessibilityRole="header">Qual é a sua função no offshore?</Text>
            <Text style={styles.texto}>Isso ajuda o Buddy a priorizar vagas, conteúdos e informações relacionadas à sua área. Você pode alterar ou remover quando quiser. Fica só neste aparelho.</Text>

            <View style={styles.segmento} accessibilityRole="radiogroup">
              {([['trabalho', 'Trabalho offshore'], ['quero_embarcar', 'Ainda não trabalho offshore']] as const).map(([v, t]) => (
                <TouchableOpacity key={v} style={[styles.segItem, situacao === v && styles.segAtivo]} onPress={() => { setSituacao(v); setFuncao(null); setLivre(null); }}
                  accessibilityRole="radio" accessibilityState={{ selected: situacao === v }}>
                  <Text style={[styles.segTexto, situacao === v && styles.segTextoAtivo]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {situacao === 'quero_embarcar' ? (
              <Text style={styles.texto}>Quero embarcar. Se quiser, diga em qual área você tem interesse — o Buddy pode priorizar conteúdos e oportunidades para começar.</Text>
            ) : null}

            {cat ? (
              <>
                <Text style={styles.rotulo}>{situacao === 'quero_embarcar' ? 'ÁREA DE INTERESSE (OPCIONAL)' : 'ÁREA'}</Text>
                <View style={styles.chips}>
                  {cat.areas.map((a) => (
                    <TouchableOpacity key={a.id} style={[styles.chip, area === a.id && styles.chipAtivo]} accessibilityRole="button" accessibilityState={{ selected: area === a.id }}
                      onPress={() => { setArea(area === a.id ? null : a.id); if (funcao && funcao.area !== a.id) setFuncao(null); }}>
                      <Text style={[styles.chipTexto, area === a.id && styles.chipTextoAtivo]}>{a.nome}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.rotulo}>{situacao === 'quero_embarcar' ? 'FUNÇÃO DE INTERESSE (OPCIONAL)' : 'FUNÇÃO'}</Text>
                {funcao ? (
                  <View style={styles.escolhida}>
                    <Ionicons name="checkmark-circle" size={18} color={colors.cyanDim} />
                    <Text style={styles.escolhidaTexto}>{funcao.nome} · {areaNome(funcao.area)}</Text>
                    <TouchableOpacity style={styles.desfazer} onPress={() => setFuncao(null)} accessibilityRole="button" accessibilityLabel="Trocar função"><Text style={styles.desfazerTexto}>Trocar</Text></TouchableOpacity>
                  </View>
                ) : livre !== null ? (
                  <>
                    <TextInput style={styles.input} value={livre} onChangeText={setLivre} placeholder="Escreva sua função" placeholderTextColor={colors.mutedDim}
                      accessibilityLabel="Sua função (texto livre)" maxLength={80} autoFocus />
                    <Text style={styles.nota}>Função escrita à mão: o Buddy guarda, mas só usa a área para priorizar vagas.</Text>
                    <TouchableOpacity style={styles.desfazer} onPress={() => setLivre(null)} accessibilityRole="button"><Text style={styles.desfazerTexto}>Voltar para a lista</Text></TouchableOpacity>
                  </>
                ) : (
                  <>
                    <TextInput style={styles.input} value={busca} onChangeText={setBusca} placeholder="Ex.: Deck Pusher, Torrista, Técnico de Segurança" placeholderTextColor={colors.mutedDim}
                      accessibilityLabel="Buscar função" autoCorrect={false} />
                    {sugestoes.length ? (
                      <View style={styles.lista}>
                        {sugestoes.map((f) => (
                          <TouchableOpacity key={f.slug} style={styles.item} onPress={() => { setFuncao(f); setArea(f.area); }} accessibilityRole="button" accessibilityLabel={`${f.nome}, ${areaNome(f.area) ?? ''}`}>
                            <Text style={styles.itemNome}>{f.nome}</Text>
                            <Text style={styles.itemSub}>{areaNome(f.area)}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    ) : null}
                    <TouchableOpacity style={styles.desfazer} onPress={() => setLivre(busca)} accessibilityRole="button"><Text style={styles.desfazerTexto}>Não encontrei minha função</Text></TouchableOpacity>
                  </>
                )}
              </>
            ) : (
              <>
                <Text style={styles.texto}>Sem conexão para carregar a lista de funções. Você pode escrever a sua agora ou configurar depois.</Text>
                <TextInput style={styles.input} value={livre ?? ''} onChangeText={setLivre} placeholder="Escreva sua função" placeholderTextColor={colors.mutedDim} accessibilityLabel="Sua função (texto livre)" maxLength={80} />
              </>
            )}

            <View style={styles.alerta}>
              <View style={{ flex: 1 }}>
                <Text style={styles.alertaTitulo}>Quero receber avisos relacionados à minha função</Text>
                <Text style={styles.alertaSub}>Por enquanto os avisos aparecem dentro do app (Home e Vagas).</Text>
              </View>
              <Switch value={alertas} onValueChange={setAlertas} accessibilityLabel="Avisos relacionados à minha função" trackColor={{ true: colors.cyanDim, false: maritime.fieldBorder }} />
            </View>

            <TouchableOpacity style={[styles.primario, !podeSalvar && styles.off]} disabled={!podeSalvar} onPress={salvar} accessibilityRole="button">
              <Text style={styles.primarioTexto}>Salvar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.terciario} onPress={() => (mf ? setEditando(false) : router.back())} accessibilityRole="button">
              <Text style={styles.terciarioTexto}>{mf ? 'Cancelar' : 'Pular'}</Text>
            </TouchableOpacity>
          </View>
        ) : mf ? (
          <>
            <View style={styles.cartao}>
              <Text style={styles.kicker}>MINHA FUNÇÃO</Text>
              <Text style={styles.titulo} accessibilityRole="header">{rotuloMinhaFuncao(mf, cat)}</Text>
              {mf.area && areaNome(mf.area) ? <Text style={styles.texto}>{mf.situacao === 'quero_embarcar' ? 'Área de interesse' : 'Área'}: {areaNome(mf.area)}</Text> : null}
              {mf.texto_livre ? <Text style={styles.nota}>Função escrita à mão — só a área é usada para priorizar.</Text> : null}
              <TouchableOpacity style={styles.secundario} onPress={() => router.push('/vagas')} accessibilityRole="button">
                <Text style={styles.secundarioTexto}>{mf.situacao === 'quero_embarcar' ? 'Vagas para começar' : 'Vagas para minha função'}</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.cyanDim} />
              </TouchableOpacity>
              <View style={styles.alerta}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.alertaTitulo}>Avisos relacionados à minha função</Text>
                  <Text style={styles.alertaSub}>Dentro do app: vagas novas da sua função na Home e em Vagas.</Text>
                </View>
                <Switch value={mf.alertas} onValueChange={alternarAlertas} accessibilityLabel="Avisos relacionados à minha função" trackColor={{ true: colors.cyanDim, false: maritime.fieldBorder }} />
              </View>
              <View style={styles.acoes}>
                <TouchableOpacity style={styles.terciario} onPress={() => { preencher(mf, cat); setEditando(true); }} accessibilityRole="button"><Text style={styles.terciarioTexto}>Alterar</Text></TouchableOpacity>
                <TouchableOpacity style={styles.terciario} onPress={remover} accessibilityRole="button"><Text style={styles.terciarioTexto}>Remover</Text></TouchableOpacity>
              </View>
            </View>
            {conteudos.length ? (
              <View style={styles.secao}>
                <Text style={styles.secaoTitulo}>{mf.situacao === 'quero_embarcar' ? 'PARA COMEÇAR' : 'NO OWNEWS'}</Text>
                {conteudos.map((c) => (
                  <TouchableOpacity key={c.url} style={styles.conteudo} onPress={() => { analytics.track('my_role_content_opened'); abrirLinkExterno(c.url); }} accessibilityRole="link">
                    <Text style={styles.conteudoTitulo}>{c.titulo}</Text>
                    {c.tipo === 'relacionada' ? <Text style={styles.conteudoSub}>Função relacionada</Text> : null}
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
            <Text style={styles.nota}>Sua função fica só neste aparelho. Não aparece para ninguém e não é enviada ao OWNews.</Text>
          </>
        ) : null}
      </ScrollView>
    </OWBackground>
  );
}

const styles = themed(() => StyleSheet.create({
  content: { padding: spacing.md, gap: spacing.md },
  cartao: {
    backgroundColor: maritime.glassElevated, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm,
    borderWidth: 1, borderColor: maritime.glassBorder, borderTopColor: maritime.edgeLight,
  },
  kicker: { ...typography.micro, color: colors.kicker },
  titulo: { ...typography.h2 },
  texto: { fontSize: 14, lineHeight: 20, color: colors.muted },
  rotulo: { ...typography.micro, marginTop: spacing.sm },
  segmento: { flexDirection: 'row', gap: 6, marginTop: spacing.xs },
  segItem: { flex: 1, minHeight: 44, borderRadius: radius.md, borderWidth: 1, borderColor: maritime.glassBorder, backgroundColor: maritime.glass, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 8 },
  segAtivo: { borderColor: colors.cyanDim, backgroundColor: maritime.field },
  segTexto: { fontSize: 13, fontWeight: '600', color: colors.muted, textAlign: 'center' },
  segTextoAtivo: { color: colors.white },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { minHeight: 36, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, borderColor: maritime.glassBorder, backgroundColor: maritime.glass, justifyContent: 'center' },
  chipAtivo: { borderColor: colors.cyanDim, backgroundColor: maritime.field },
  chipTexto: { fontSize: 13, color: colors.muted },
  chipTextoAtivo: { color: colors.white, fontWeight: '700' },
  input: {
    minHeight: 48, borderRadius: radius.md, paddingHorizontal: spacing.md, fontSize: 16, color: colors.white,
    backgroundColor: maritime.field, borderWidth: 1, borderColor: maritime.fieldBorder,
  },
  lista: { borderRadius: radius.md, borderWidth: 1, borderColor: maritime.glassBorder, backgroundColor: maritime.glassElevated, overflow: 'hidden' },
  item: { minHeight: 52, paddingHorizontal: spacing.md, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: maritime.glassBorder, justifyContent: 'center' },
  itemNome: { fontSize: 15, fontWeight: '700', color: colors.white },
  itemSub: { fontSize: 12, color: colors.muted, marginTop: 1 },
  escolhida: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 },
  escolhidaTexto: { flex: 1, fontSize: 15, color: colors.white, fontWeight: '600' },
  desfazer: { minHeight: 40, justifyContent: 'center', alignSelf: 'flex-start', paddingHorizontal: 2 },
  desfazerTexto: { fontSize: 13, fontWeight: '700', color: colors.cyanDim },
  alerta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: maritime.glassBorder },
  alertaTitulo: { fontSize: 14, fontWeight: '600', color: colors.white },
  alertaSub: { fontSize: 12, color: colors.mutedDim, marginTop: 2 },
  primario: { minHeight: 48, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center', marginTop: spacing.md, backgroundColor: colors.cyan, ...maritime.botaoPrimario },
  primarioTexto: { fontSize: 15, fontWeight: '700', color: colors.onAccent },
  off: { opacity: 0.45 },
  secundario: {
    flexDirection: 'row', gap: 6, minHeight: 46, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center', marginTop: spacing.sm,
    borderWidth: 1, borderColor: maritime.glassBorder, backgroundColor: maritime.glass,
  },
  secundarioTexto: { fontSize: 15, fontWeight: '700', color: colors.cyanDim },
  acoes: { flexDirection: 'row', justifyContent: 'center', gap: spacing.lg },
  terciario: { minHeight: 44, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.md },
  terciarioTexto: { fontSize: 15, fontWeight: '600', color: colors.muted },
  nota: { fontSize: 12, color: colors.mutedDim, textAlign: 'center', marginTop: spacing.xs },
  secao: { gap: 2 },
  secaoTitulo: { ...typography.micro, marginBottom: spacing.xs },
  conteudo: { minHeight: 48, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: maritime.glassBorder, justifyContent: 'center' },
  conteudoTitulo: { fontSize: 15, lineHeight: 21, color: colors.white, fontWeight: '600' },
  conteudoSub: { fontSize: 12, color: colors.mutedDim, marginTop: 2 },
}));
