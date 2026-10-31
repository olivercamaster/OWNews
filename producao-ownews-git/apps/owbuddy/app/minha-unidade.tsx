/**
 * Minha Unidade — onde a pessoa embarca, com contexto do Radar Offshore do OWNews.
 *
 * Contexto pessoal, não portal de dados: nome, tipo, operador, campos, o dia do embarque (da
 * escala) e poucas notícias realmente relacionadas — da UNIDADE e, separadas, da EMPRESA.
 * Tudo fica no aparelho; o pacote do Radar é público e filtrado aqui. Sem internet: o nome
 * escrito e o último pacote guardado continuam.
 */
import { useCallback, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { contextoMinhaUnidade, definirMinhaUnidade, resumoEscala } from '@owbuddy/domain';
import type { ContextoMinhaUnidade, MinhaUnidade, NoticiaRadar, RefRadar } from '@owbuddy/domain';
import { getEscala, getMinhaUnidade, getNoticiasUnidadeVistas, marcarNoticiasUnidadeVistas, setMinhaUnidade } from '../src/storage';
import { fetchPacoteRadar, noticiaLocal } from '../src/api';
import { colors, maritime, radius, spacing, themed, typography } from '../src/theme';
import { useTema } from '../src/tema';
import { OWBackground } from '../src/components/OWBackground';
import { CampoUnidade } from '../src/components/CampoUnidade';
import { analytics } from '../src/analytics';
import { avisar } from '../src/feedback';
import { confirmar } from '../src/confirmar';

const dataBr = (iso: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso); return m ? `${m[3]}/${m[2]}/${m[1]}` : ''; };

export default function MinhaUnidadeTela() {
  useTema();
  const insets = useSafeAreaInsets();
  const [mu, setMu] = useState<MinhaUnidade | null>(null);
  const [ctx, setCtx] = useState<ContextoMinhaUnidade | null>(null);
  const [dia, setDia] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState('');
  const [ref, setRef] = useState<RefRadar | null>(null);
  const [atualizado, setAtualizado] = useState<string | null>(null);
  const [lido, setLido] = useState(false);

  const carregar = useCallback(async () => {
    const [m, escala, vistas] = await Promise.all([getMinhaUnidade(), getEscala(), getNoticiasUnidadeVistas()]);
    setMu(m);
    const r = resumoEscala(escala);
    setDia(r.estado === 'EMBARCADO' && r.calc ? `Você está no Dia ${r.calc.diaDoBloco} de ${r.calc.dEm}` : null);
    const p = await fetchPacoteRadar().catch(() => null);
    const c = contextoMinhaUnidade(m, p?.pacote ?? null, vistas);
    setCtx(c);
    setAtualizado(p?.pacote.atualizado_em ?? null);
    if (c?.noticiasUnidade.length) marcarNoticiasUnidadeVistas(c.noticiasUnidade.map((n) => n.id));
    if (!m) { setEditando(true); setTexto(''); setRef(null); }
    setLido(true);
  }, []);

  useFocusEffect(useCallback(() => { analytics.track('my_unit_opened'); carregar(); }, [carregar]));

  const salvar = async () => {
    const nova = definirMinhaUnidade(texto, ref, new Date().toISOString());
    if (!nova) return;
    await setMinhaUnidade(nova);
    analytics.track('my_unit_set', { catalogo: !!nova.radar });
    avisar('Unidade salva');
    setEditando(false);
    carregar();
  };
  const remover = () => confirmar('Remover sua unidade?', 'Sua escala e seu histórico não mudam.', 'Remover', async () => {
    await setMinhaUnidade(null);
    setCtx(null); setMu(null); setEditando(true); setTexto(''); setRef(null);
  });
  const abrirOwnews = () => { if (ctx?.url) { analytics.track('my_unit_radar_opened'); Linking.openURL(ctx.url).catch(() => {}); } };
  // Matéria guardada no aparelho abre no app; as mais antigas abrem no OWNews.
  const abrirNoticia = async (n: NoticiaRadar) => {
    if (await noticiaLocal(n.id).catch(() => null)) router.push(`/noticia/${n.id}`);
    else Linking.openURL(`https://ownews.com.br/noticia?id=${encodeURIComponent(n.id)}`).catch(() => {});
  };

  if (!lido) return <OWBackground showWatermark={false}><View style={{ flex: 1 }} /></OWBackground>;

  return (
    <OWBackground showWatermark={false}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]} keyboardShouldPersistTaps="handled">
        {editando ? (
          <View style={styles.cartao}>
            <Text style={styles.titulo} accessibilityRole="header">{mu ? 'Trocar unidade' : 'Onde você embarca?'}</Text>
            <Text style={styles.texto}>Escreva o nome da unidade. Se ela estiver no Radar Offshore do OWNews, o Buddy mostra o contexto e as notícias dela. Fica só neste aparelho.</Text>
            <CampoUnidade rotulo="Unidade" texto={texto} refRadar={ref} onChange={(t, r) => { setTexto(t); setRef(r); }} placeholder="Ex.: West Jupiter, P-80, FPSO Almirante Barroso" />
            <TouchableOpacity style={[styles.primario, !texto.trim() && styles.off]} disabled={!texto.trim()} onPress={salvar} accessibilityRole="button">
              <Text style={styles.primarioTexto}>Salvar</Text>
            </TouchableOpacity>
            {mu ? (
              <TouchableOpacity style={styles.terciario} onPress={() => setEditando(false)} accessibilityRole="button"><Text style={styles.terciarioTexto}>Cancelar</Text></TouchableOpacity>
            ) : null}
            <Text style={styles.nota}>Isso não muda sua escala, seus embarques nem seu histórico.</Text>
          </View>
        ) : ctx ? (
          <>
            <View style={styles.cartao}>
              <Text style={styles.kicker}>MINHA UNIDADE</Text>
              <Text style={styles.titulo} accessibilityRole="header">{ctx.nome}</Text>
              {dia ? <Text style={styles.dia}>{dia}</Text> : null}
              {ctx.unidade ? (
                <View style={styles.dados}>
                  <Linha icone="boat-outline" texto={ctx.unidade.tipo || (ctx.unidade.categoria === 'sonda' ? 'Sonda' : 'Unidade de produção')} />
                  {ctx.unidade.operador ? <Linha icone="business-outline" texto={`${ctx.unidade.categoria === 'sonda' ? 'Operador da sonda' : 'Operador'}: ${ctx.unidade.operador.nome}`} /> : null}
                  {ctx.unidade.bacia ? <Linha icone="water-outline" texto={`Bacia de ${ctx.unidade.bacia}`} /> : null}
                  {ctx.unidade.campos.length ? <Linha icone="location-outline" texto={`${ctx.unidade.campos.length === 1 ? 'Campo' : 'Campos'}: ${ctx.unidade.campos.join(', ')}`} /> : null}
                </View>
              ) : (
                <Text style={styles.texto}>Esta unidade não está ligada ao Radar Offshore. Toque em “Trocar” e escolha uma sugestão para ver o contexto e as notícias.</Text>
              )}
              {ctx.url ? (
                <TouchableOpacity style={styles.secundario} onPress={abrirOwnews} accessibilityRole="link">
                  <Text style={styles.secundarioTexto}>Ver unidade no OWNews</Text>
                  <Ionicons name="open-outline" size={16} color={colors.cyanDim} />
                </TouchableOpacity>
              ) : null}
              <View style={styles.acoes}>
                <TouchableOpacity style={styles.terciario} onPress={() => { setTexto(ctx.nome); setRef(mu?.radar ?? null); setEditando(true); }} accessibilityRole="button"><Text style={styles.terciarioTexto}>Trocar</Text></TouchableOpacity>
                <TouchableOpacity style={styles.terciario} onPress={remover} accessibilityRole="button"><Text style={styles.terciarioTexto}>Remover</Text></TouchableOpacity>
              </View>
            </View>

            {ctx.unidade ? (
              <Secao titulo={`Notícias sobre ${ctx.nome}`} vazio="Nenhuma notícia recente do OWNews cita esta unidade." itens={ctx.noticiasUnidade} onAbrir={abrirNoticia} />
            ) : null}
            {ctx.unidade?.operador && ctx.noticiasOperador.length ? (
              <Secao titulo={`Notícias de ${ctx.unidade.operador.nome} (empresa)`} itens={ctx.noticiasOperador} onAbrir={abrirNoticia} />
            ) : null}
            {ctx.unidade ? <Text style={styles.nota}>Dados públicos da ANP consolidados pelo OWNews{atualizado ? ` · atualizados em ${dataBr(atualizado)}` : ''}.</Text> : null}
          </>
        ) : null}
      </ScrollView>
    </OWBackground>
  );
}

function Linha({ icone, texto }: { icone: React.ComponentProps<typeof Ionicons>['name']; texto: string }) {
  useTema();
  return (
    <View style={styles.linha}>
      <Ionicons name={icone} size={16} color={colors.iconDefault} />
      <Text style={styles.linhaTexto}>{texto}</Text>
    </View>
  );
}

function Secao({ titulo, itens, vazio, onAbrir }: { titulo: string; itens: NoticiaRadar[]; vazio?: string; onAbrir: (n: NoticiaRadar) => void }) {
  useTema();
  return (
    <View style={styles.secao}>
      <Text style={styles.secaoTitulo}>{titulo}</Text>
      {itens.length ? itens.map((n) => (
        <TouchableOpacity key={n.id} style={styles.noticia} onPress={() => onAbrir(n)} accessibilityRole="link">
          <Text style={styles.noticiaTitulo}>{n.titulo}</Text>
          <Text style={styles.noticiaData}>{dataBr(n.data)}</Text>
        </TouchableOpacity>
      )) : vazio ? <Text style={styles.texto}>{vazio}</Text> : null}
    </View>
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
  dia: { fontSize: 15, fontWeight: '700', color: colors.cyanDim },
  texto: { fontSize: 14, lineHeight: 20, color: colors.muted },
  dados: { gap: 6, marginTop: 2 },
  linha: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  linhaTexto: { flex: 1, fontSize: 14, lineHeight: 20, color: colors.white },
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
  nota: { fontSize: 12, color: colors.mutedDim, textAlign: 'center', marginTop: spacing.sm },
  secao: { gap: 2 },
  secaoTitulo: { ...typography.micro, marginBottom: spacing.xs },
  noticia: { minHeight: 52, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: maritime.glassBorder },
  noticiaTitulo: { fontSize: 15, lineHeight: 21, color: colors.white, fontWeight: '600' },
  noticiaData: { fontSize: 12, color: colors.mutedDim, marginTop: 2 },
}));
