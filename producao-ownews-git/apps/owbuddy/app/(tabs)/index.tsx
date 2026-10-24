import { useCallback, useEffect, useRef, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  calcularMomento,
  resumoEscala,
  gerarMensagemMomento,
  contarPendentes,
  viagemEAmanha,
  viagemEHoje,
  calcCertStatus,
  getAeroporto,
  contextoHome,
  sincronizarChecklistComCiclo,
  cicloAlvoChecklist,
  gerarAcontecimentos,
  acontecimentosParaHome,
  saudacaoTopo,
  fraseDoDia,
  modulosVisiveis,
  tamanhoDe,
  DEF_MODULO,
} from '@owbuddy/domain';
import type {
  EscalaConfig, BuddyPrefs, Viagem, ChecklistData, Certificado, HomeContexto, HomeChecklistContagem,
  EventoPessoal, ConfigPagamento, PrefsHome, ModuloHome, Acontecimento, AcontecimentoTipo,
} from '@owbuddy/domain';
import {
  getEscala, getBuddyPrefs, getViagem, getChecklist, getCerts, getCityPref, setCityPref,
  getEventosPessoais, getPagamento, getPrefsHome, setPrefsHome, getContatos,
} from '../../src/storage';
import { ondePrecisoEstar, linhasPreparacao } from '../../src/onde-estar';
import { OndeEstarCard, PreparacaoCard } from '../../src/components/MomentoEmbarque';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { bottomNavSpace, colors, maritime, spacing, radius, typography, themed } from '../../src/theme';
import { useTema } from '../../src/tema';
import { OWBackground } from '../../src/components/OWBackground';
import { CityPicker } from '../../src/components/CityPicker';
import { TransporteSheet } from '../../src/components/TransporteSheet';
import { formatDateBR, formatHoraBR } from '../../src/format';
import { getWeather, type WeatherData } from '../../src/weather';
import { useConnectivity } from '../../src/connectivity';
import type { City } from '../../src/cities';
import { analytics } from '../../src/analytics';
import { fetchFeed, fetchVagas } from '../../src/api';
import { contadorVagasHome, frescorClima, noticiaRecenteHome } from '../../src/frescor';
import { AcontecimentoLinha } from '../../src/components/AcontecimentoLinha';
import { opcoesTransporte } from '../../src/transporte';
import { LinearGradient } from 'expo-linear-gradient';

// Cor de acento por estado contextual (chip, barra de progresso, borda do hero).
const CONTEXTO_COR: Record<HomeContexto['tipo'], string> = themed(() => ({
  SEM_ESCALA:   colors.cyanDim,
  PRE_EMBARQUE: colors.amber,
  EMBARCADO:    colors.green,
  FOLGA:        colors.cyanDim,
}));

const ROTULO_GRUPO: Partial<Record<string, string>> = { pessoal: 'Meu offshore', offshore: 'Offshore agora' };

type HomeState = {
  escala: EscalaConfig | null;
  prefs: BuddyPrefs;
  viagem: Viagem | null;
  checklist: ChecklistData | null;
  certs: Certificado[];
  city: City | null;
  eventos: EventoPessoal[];
  pagamento: ConfigPagamento | null;
  home: PrefsHome;
  contatos: number;
};

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];
type Peca = { id: ModuloHome; key?: string; forma: 'bloco' | 'tile' | 'linha'; render: () => React.ReactNode; grupo: string };

export default function TelaHoje() {
  useTema();
  const [state, setState] = useState<HomeState | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  // Só número REAL do /api/buddy/vagas (cache 1 h; offline usa o último cache). Sem dado → sem contador.
  const [vagasTotal, setVagasTotal] = useState<number | null>(null);
  // Manchete canônica do OWNews (/api/buddy/feed) só se publicada nas últimas 48 h.
  const [manchete, setManchete] = useState<{ id: string; title: string } | null>(null);
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [transporte, setTransporte] = useState(false);
  const online = useConnectivity();
  const prevOnline = useRef(online);

  const load = useCallback(async () => {
    // Tudo LOCAL e de uma vez (inclusive o layout da Home): a primeira pintura já sai na
    // ordem do usuário — sem cards trocando de lugar depois de carregar.
    const [escala, prefs, viagem, checklist, certs, city, eventos, pagamento, home, contatos] = await Promise.all([
      getEscala(), getBuddyPrefs(), getViagem(), getChecklist(), getCerts(), getCityPref(),
      getEventosPessoais(), getPagamento(), getPrefsHome(), getContatos(),
    ]);
    setState({ escala, prefs, viagem, checklist, certs, city, eventos, pagamento, home, contatos: contatos.length });
    const visiveis = new Set(modulosVisiveis(home));
    // Rede só para o que está visível (e com cache): Vagas, Notícias e clima.
    if (visiveis.has('vagas')) {
      fetchVagas().then(r => {
        if (r.status !== 'ok' && r.status !== 'offline_cached') { setVagasTotal(null); return; }
        const obtidoEm = r.status === 'ok' && !r.fromCache ? Date.now() : r.cachedAt;
        setVagasTotal(contadorVagasHome(r.vagas.length, obtidoEm, r.updatedAt));
      }).catch(() => setVagasTotal(null));
    }
    if (visiveis.has('noticias')) {
      fetchFeed().then(r => {
        const n = r.status === 'ok' || r.status === 'offline_cached' ? noticiaRecenteHome(r.articles) : null;
        setManchete(n ? { id: n.id, title: n.title } : null);
      }).catch(() => setManchete(null));
    }
    if (city && home.clima) setWeather(await getWeather(city));
  }, []);

  useFocusEffect(useCallback(() => {
    analytics.screen('home');
    load();
  }, [load]));

  // Atualiza o clima ao voltar a ficar online
  useEffect(() => {
    if (online && !prevOnline.current && state?.city && state.home.clima) {
      getWeather(state.city).then(setWeather);
      analytics.markOnline();
    }
    if (!online) analytics.markOffline();
    prevOnline.current = online;
  }, [online, state?.city, state?.home.clima]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const selectCity = async (city: City) => {
    await setCityPref(city);
    setShowCityPicker(false);
    setState(s => s ? { ...s, city } : s);
    analytics.track('city_configured');
    setWeather(await getWeather(city));
  };

  const dispensarDica = async (abrir: boolean) => {
    if (!state) return;
    const home = { ...state.home, dicaVista: true };
    setState({ ...state, home });
    await setPrefsHome(home);
    if (abrir) router.push('/personalizar-home');
  };

  // Reserva no fim do scroll para a nav flutuante nunca cobrir o último card (Android + iOS).
  const insets = useSafeAreaInsets();
  const contentStyle = [styles.content, {
    paddingTop: insets.top + spacing.lg,
    paddingBottom: bottomNavSpace(insets.bottom),
  }];

  if (!state) return <OWBackground watermark="home"><View style={styles.root} /></OWBackground>;

  const { escala, prefs, viagem, checklist, certs, eventos, pagamento, home } = state;
  const agora = new Date();
  const momento = calcularMomento(escala);
  const resumo = resumoEscala(escala);
  const aeroporto = escala?.aeroporto ? getAeroporto(escala.aeroporto) : undefined;
  // Contagem da mala do embarque-alvo — mesma regra de ciclo do Meu Embarque
  // (no dia do embarque ainda é a de hoje), só para exibir; quem grava é a tela Meu Embarque.
  const alvoMala = cicloAlvoChecklist(resumo);
  const listaCiclo = sincronizarChecklistComCiclo(checklist, alvoMala, resumo.hojeISO).data;
  const checkCount: HomeChecklistContagem = contarPendentes(listaCiclo);
  const contexto = contextoHome(resumo, momento, checkCount);
  // Voz do Buddy (tom escolhido em Meu Buddy) — no tom "discreto" repetiria o hero.
  const voz = prefs.tom && prefs.tom !== 'discreto' ? gerarMensagemMomento(momento, prefs) : '';
  const critCerts = certs
    .filter(c => !c._deleted && c.validade)
    .filter(c => calcCertStatus(c).critico);
  const totalCerts = certs.filter(c => !c._deleted).length;
  // Momento operacional: véspera/dia da viagem → "onde preciso estar"; últimos 3 dias
  // antes do embarque (sem viagem iminente) → viagem e documentos em uma linha cada.
  const onde = ondePrecisoEstar(viagem, escala, agora, alvoMala);
  const prep = !onde && contexto.tipo === 'PRE_EMBARQUE' && resumo.proximoEmbarqueISO && (resumo.diasParaEmbarque ?? 99) <= 3
    ? linhasPreparacao(viagem, certs, resumo.proximoEmbarqueISO, c => calcCertStatus(c as Certificado))
    : [];
  const viagemBreve = viagem ? (viagemEAmanha(viagem) || viagemEHoje(viagem)) : false;
  const nome = prefs.apelido?.trim();
  const saudacao = saudacaoTopo(agora, home.estiloSaudacao, nome, prefs.trat);
  const frase = home.fraseDoDia ? fraseDoDia(agora, home.estiloSaudacao) : null;
  const tamMomento = tamanhoDe(home, 'momento');

  // Buddy Agora: SEMPRE calculado com todos os dados — ocultar um card não desliga nada.
  const acontecimentos = gerarAcontecimentos({ escala, checklist, certs, viagem, eventos, pagamento, hoje: agora });
  // O card da escala já mostra a data dele (embarcado: desembarque; folga: embarque)
  // e, no pré-embarque, a lista. Só isso sai daqui — embarcado, o próximo
  // embarque (após a folga) continua em Próximos dias.
  const excluir: AcontecimentoTipo[] = contexto.tipo === 'EMBARCADO' ? ['DESEMBARQUE'] : ['EMBARQUE', 'DESEMBARQUE'];
  if (tamMomento === 'NORMAL' && contexto.tipo === 'PRE_EMBARQUE') excluir.push('CHECKLIST');
  const tamProximos = tamanhoDe(home, 'proximos');
  const proximos = acontecimentosParaHome(acontecimentos, { max: tamProximos === 'COMPACTO' ? 1 : 3, excluirTipos: excluir });

  const acionar = (a: Acontecimento) => {
    const acao = a.acao;
    if (!acao) return;
    if (acao.tipo === 'presente') {
      analytics.track('gift_ideas_opened', { origem: 'home' });
      router.push({ pathname: '/presentes', params: { evento: a.meta?.eventoId ?? '' } });
    } else if (acao.tipo === 'transporte') {
      setTransporte(true);
    } else {
      router.push({ pathname: acao.rota as never, params: acao.params ?? {} });
    }
  };

  // ── Peças da Home na ordem do usuário ──
  const pecas: Peca[] = [];
  for (const id of modulosVisiveis(home)) {
    const t = tamanhoDe(home, id);
    const grupo = DEF_MODULO[id].grupo;
    const tileOuLinha = (props: TileProps): Peca => t === 'COMPACTO'
      ? { id, grupo, forma: 'linha', render: () => <ActionRow icon={props.icon} label={props.label} sub={props.sub} onPress={props.onPress} accent={props.accent} /> }
      : { id, grupo, forma: 'tile', render: () => <HomeTile {...props} /> };
    switch (id) {
      case 'momento':
        pecas.push({ id, grupo, forma: 'bloco', render: () => t === 'COMPACTO'
          ? <HeroCompacto contexto={contexto} />
          : <HomeHero
              contexto={contexto}
              progresso={contexto.tipo === 'PRE_EMBARQUE'
                ? (checkCount.total > 0 ? checkCount.feitos / checkCount.total : 0)
                : resumo.progresso}
              dataISO={contexto.tipo === 'EMBARCADO' ? resumo.proximoDesembarqueISO : resumo.proximoEmbarqueISO}
              aeroporto={aeroporto ? `${aeroporto.code} · ${aeroporto.nome}` : null}
              voz={voz}
            /> });
        break;
      case 'proximos':
        pecas.push({ id, grupo, forma: 'bloco', render: () => (
          <ProximosDias itens={proximos.itens} total={proximos.total} onAcao={acionar} />
        ) });
        break;
      case 'escala':
        pecas.push(tileOuLinha({ icon: 'calendar-outline', label: 'Minha Escala',
          sub: resumo.calc ? `${resumo.calc.dEm} × ${resumo.calc.dFo} · calendário` : 'Configurar agora',
          accent: escala ? colors.cyan : colors.mutedDim, onPress: () => router.navigate(escala ? '/escala' : '/escala-config') }));
        break;
      case 'embarque':
        pecas.push(tileOuLinha({ icon: 'checkbox-outline', label: 'Meu Embarque',
          sub: checkCount.total === 0 ? 'Montar minha mala' : checkCount.pendentes === 0 ? 'Mala pronta' : `Mala: ${checkCount.feitos} de ${checkCount.total}`,
          accent: checkCount.total > 0 && checkCount.pendentes === 0 ? colors.green : undefined, onPress: () => router.navigate('/mala') }));
        break;
      case 'viagem':
        pecas.push(tileOuLinha({ icon: 'airplane-outline', label: 'Minha Viagem',
          sub: viagem ? formatDateBR(viagem.data) + (viagem.hora ? ` · ${viagem.hora}` : '') : 'Registrar viagem',
          accent: viagemBreve ? colors.amber : undefined, onPress: () => router.navigate('/viagem') }));
        break;
      case 'certs':
        pecas.push(tileOuLinha({ icon: 'document-text-outline', label: 'Certificados',
          sub: critCerts.length > 0 ? `${critCerts.length} ${critCerts.length === 1 ? 'precisa' : 'precisam'} de atenção` : totalCerts > 0 ? 'Tudo certo' : 'Validades e avisos',
          accent: critCerts.length > 0 ? colors.amber : undefined, onPress: () => router.navigate('/certs') }));
        break;
      case 'vagas': {
        const sub = vagasTotal != null ? `${vagasTotal} ${vagasTotal === 1 ? 'vaga verificada' : 'vagas verificadas'}` : 'Vagas verificadas';
        if (t === 'DESTAQUE') {
          pecas.push({ id, grupo, forma: 'bloco', render: () => (
            <CardDestaque icon="briefcase-outline" titulo="Vagas" numero={vagasTotal}
              texto={vagasTotal != null ? `${vagasTotal === 1 ? 'vaga verificada' : 'vagas verificadas'} nos portais oficiais das empresas` : 'Vagas verificadas nos portais oficiais das empresas'}
              cta="Ver vagas" onPress={() => router.push('/vagas')} />
          ) });
        } else pecas.push(tileOuLinha({ icon: 'briefcase-outline', label: 'Vagas', sub, destaque: true, onPress: () => router.push('/vagas') }));
        break;
      }
      case 'unidades':
        if (t === 'DESTAQUE') {
          pecas.push({ id, grupo, forma: 'bloco', render: () => (
            <CardDestaque icon="boat-outline" titulo="Radar de Unidades" numero={null}
              texto="FPSOs, sondas e navios que operam no Brasil — fotos, operador e campo."
              cta="Explorar unidades" onPress={() => router.push('/unidades')} />
          ) });
        } else pecas.push(tileOuLinha({ icon: 'boat-outline', label: 'Unidades', sub: 'FPSOs, sondas e navios', destaque: true, onPress: () => router.push('/unidades') }));
        break;
      case 'noticias':
        pecas.push({ id, grupo, forma: 'linha', render: () => (
          <ActionRow icon="newspaper-outline" label="Notícias"
            sub={t === 'NORMAL' && manchete ? manchete.title : 'O que importa no setor hoje'}
            subLines={t === 'NORMAL' && manchete ? 2 : 1} onPress={() => router.push('/noticias')} />
        ) });
        break;
      case 'aeroportos':
        pecas.push({ id, grupo, forma: 'linha', render: () => (
          <ActionRow icon="cloudy-outline" label="Aeroportos" sub="Condições nas bases offshore" onPress={() => router.push('/aeroportos')} />
        ) });
        break;
      case 'ferramentas':
        pecas.push({ id, grupo, forma: 'bloco', render: () => <Atalhos /> });
        break;
    }
  }

  // Contexto operacional logo abaixo do card da escala (ou no topo, se ele estiver oculto).
  const contextoOperacional: Peca | null = onde
    ? { id: 'momento', key: 'onde-estar', grupo: 'topo', forma: 'bloco', render: () => <OndeEstarCard onde={onde} mala={checkCount.total > 0 && contexto.tipo !== 'PRE_EMBARQUE' ? checkCount : null} contatos={state.contatos} /> }
    : prep.length > 0
      ? { id: 'momento', key: 'preparacao', grupo: 'topo', forma: 'bloco', render: () => <PreparacaoCard linhas={prep} /> }
      : null;
  if (contextoOperacional) {
    const i = pecas.findIndex(p => p.id === 'momento');
    // Viagem HOJE domina: vem antes do card da escala.
    pecas.splice(i < 0 ? 0 : onde?.quando === 'HOJE' ? i : i + 1, 0, contextoOperacional);
  }

  return (
    <OWBackground watermark="home">
      <ScrollView
        style={styles.root}
        contentContainerStyle={contentStyle}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.cyan} />}
      >
        {/* ── Offline banner ── */}
        {!online && (
          <View style={styles.offlineBanner}>
            <Ionicons name="cloud-offline-outline" size={14} color={colors.amber} />
            <Text style={styles.offlineText}>Offline · suas informações continuam disponíveis</Text>
          </View>
        )}

        {/* ── Topo protegido: saudação, frase do dia, clima da cidade escolhida ── */}
        <View style={styles.greetingRow}>
          <View style={styles.greetingLeft}>
            <Text style={styles.greetingText} numberOfLines={2}>{saudacao}</Text>
            {frase ? <Text style={styles.frase} numberOfLines={2}>“{frase}”</Text> : null}
            {home.clima && (
              <TouchableOpacity onPress={() => setShowCityPicker(true)} activeOpacity={0.7} style={styles.weatherInline} accessibilityLabel="Cidade e clima">
                <LinhaClima city={state.city} weather={weather} />
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.topoAcoes}>
            <TouchableOpacity
              style={styles.topoBtn}
              onPress={() => { analytics.track('home_customize_open'); router.push('/personalizar-home'); }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Personalizar Home"
            >
              <Ionicons name="options-outline" size={24} color={colors.muted} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.topoBtn}
              onPress={() => router.push('/buddy-config')}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Meu Buddy (configurações)"
            >
              <Ionicons name="person-circle-outline" size={30} color={colors.muted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Descoberta (uma vez) ── */}
        {!home.dicaVista && (
          <View style={styles.dica}>
            <Ionicons name="color-wand-outline" size={16} color={colors.cyanDim} />
            <Text style={styles.dicaTexto}>Agora você pode deixar o Buddy do seu jeito.</Text>
            <TouchableOpacity onPress={() => dispensarDica(true)} accessibilityRole="button" style={styles.dicaBtn}>
              <Text style={styles.dicaBtnTexto}>Personalizar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => dispensarDica(false)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Dispensar dica">
              <Ionicons name="close" size={16} color={colors.mutedDim} />
            </TouchableOpacity>
          </View>
        )}

        {/* ── Alertas pontuais ── */}
        {critCerts.length > 0 && (
          <TouchableOpacity style={[styles.alertCard, styles.alertCardWarn]} onPress={() => router.navigate('/certs')}>
            <Ionicons name="warning-outline" size={18} color={colors.amber} />
            <Text style={[styles.alertText, { color: colors.amber }]}>
              {critCerts.length === 1
                ? `${critCerts[0]!.nome} · ${calcCertStatus(critCerts[0]!).label}`
                : `${critCerts.length} documentos precisam de atenção`}
            </Text>
            <Ionicons name="chevron-forward" size={14} color={colors.mutedDim} />
          </TouchableOpacity>
        )}

        <Composicao pecas={pecas} />
      </ScrollView>

      <CityPicker visivel={showCityPicker} cidadeAtual={state.city} onEscolher={selectCity} onFechar={() => setShowCityPicker(false)} />
      <TransporteSheet visivel={transporte} opcoes={opcoesTransporte(viagem, escala)} onFechar={() => setTransporte(false)} />
    </OWBackground>
  );
}

/**
 * Monta a Home a partir das peças: tiles consecutivos do mesmo grupo viram grade 2 × 2,
 * linhas consecutivas viram um cartão de lista; rótulo de seção quando o grupo muda.
 */
function Composicao({ pecas }: { pecas: Peca[] }) {
  useTema();
  const out: React.ReactNode[] = [];
  let i = 0;
  let ultimoRotulo: string | null = null;
  while (i < pecas.length) {
    const p = pecas[i]!;
    const rotulo = ROTULO_GRUPO[p.grupo] ?? null;
    if (rotulo && rotulo !== ultimoRotulo) out.push(<Text key={`r-${p.id}`} style={styles.sectionLabel}>{rotulo}</Text>);
    ultimoRotulo = rotulo ?? (p.grupo === 'topo' ? ultimoRotulo : null);
    if (p.forma === 'bloco') { out.push(<View key={p.key ?? p.id}>{p.render()}</View>); i++; continue; }
    const run: Peca[] = [];
    while (i < pecas.length && pecas[i]!.forma === p.forma && pecas[i]!.grupo === p.grupo) run.push(pecas[i++]!);
    if (p.forma === 'tile') {
      out.push(
        <View key={`g-${p.id}`} style={styles.grid}>
          {run.map((x, k) => (
            <View key={x.id} style={run.length % 2 === 1 && k === run.length - 1 ? styles.tileCheio : styles.tileMeio}>{x.render()}</View>
          ))}
        </View>,
      );
    } else {
      out.push(
        <View key={`l-${p.id}`} style={styles.actionList}>
          {run.map((x, k) => (
            <View key={x.id} style={k < run.length - 1 ? styles.actionRowBorder : undefined}>{x.render()}</View>
          ))}
        </View>,
      );
    }
  }
  return <>{out}</>;
}

/** Clima da CIDADE escolhida (pessoal/urbano — não é meteorologia offshore). */
function LinhaClima({ city, weather }: { city: City | null; weather: WeatherData | null }) {
  useTema();
  if (!city) {
    return (
      <>
        <Ionicons name="partly-sunny-outline" size={13} color={colors.mutedDim} />
        <Text style={styles.weatherInlineText}>Escolher cidade para ver o clima</Text>
      </>
    );
  }
  const f = weather && weather.city === city.name ? frescorClima(weather.cachedAt) : 'antigo';
  return (
    <>
      <Ionicons name="location-outline" size={12} color={colors.cyanDim} />
      <Text style={styles.weatherInlineText} numberOfLines={1}>
        {city.name}
        {weather && f !== 'antigo'
          ? <> · <Text style={styles.weatherInlineTemp}>{weather.tempC}°</Text> · {weather.description}{f === 'armazenado' ? ` · às ${formatHoraBR(weather.cachedAt)}` : ''}</>
          : ' · clima sem atualização recente'}
      </Text>
    </>
  );
}

/** Card da escala em uma linha (tamanho COMPACTO). */
function HeroCompacto({ contexto }: { contexto: HomeContexto }) {
  useTema();
  const cor = CONTEXTO_COR[contexto.tipo];
  if (contexto.tipo === 'SEM_ESCALA') {
    return (
      <TouchableOpacity style={[styles.alertCard]} onPress={() => router.push('/escala-config')} accessibilityRole="button">
        <Ionicons name="calendar-outline" size={18} color={colors.cyanDim} />
        <Text style={styles.alertText}>Configure sua escala para eu acompanhar seu ciclo.</Text>
        <Ionicons name="chevron-forward" size={14} color={colors.mutedDim} />
      </TouchableOpacity>
    );
  }
  return (
    <TouchableOpacity
      style={[styles.heroMini, { borderColor: cor + '40' }]}
      onPress={() => router.navigate(contexto.tipo === 'PRE_EMBARQUE' ? '/mala' : '/escala')}
      accessibilityRole="button"
      accessibilityLabel={`${contexto.titulo}. ${contexto.destaque ?? ''}. ${contexto.detalhe}`}
    >
      <Sheen />
      <View style={[styles.heroDot, { backgroundColor: cor }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.heroMiniTitulo} numberOfLines={1}>{contexto.destaque ? `${contexto.kicker} · ${contexto.destaque}` : contexto.titulo}</Text>
        <Text style={styles.heroMiniSub} numberOfLines={1}>{contexto.destaque ? contexto.detalhe : contexto.detalhe}</Text>
      </View>
      <Ionicons name="chevron-forward" size={14} color={colors.mutedDim} />
    </TouchableOpacity>
  );
}

/** Próximos dias — no máximo 3 (ou 1 no compacto); "Ver todos" abre a lista completa. */
function ProximosDias({ itens, total, onAcao }: { itens: Acontecimento[]; total: number; onAcao: (a: Acontecimento) => void }) {
  useTema();
  return (
    <View>
      <View style={styles.proxHeader}>
        <Text style={[styles.sectionLabel, { marginTop: 0, marginBottom: 0 }]}>Próximos dias</Text>
        {total > 0 && (
          <TouchableOpacity onPress={() => router.push('/proximos')} hitSlop={8} accessibilityRole="button" style={styles.verTodos}>
            <Text style={styles.verTodosTexto}>{total > itens.length ? `Ver todos (${total})` : 'Ver todos'}</Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.actionList}>
        {itens.map(a => <AcontecimentoLinha key={a.id} a={a} onAcao={onAcao} />)}
        <TouchableOpacity style={styles.lembrarRow} onPress={() => router.push('/escala-evento-form')} accessibilityRole="button">
          <View style={[styles.actionIconWrap, { backgroundColor: colors.cyan + '22' }]}>
            <Ionicons name="add" size={18} color={colors.cyan} />
          </View>
          <View style={styles.actionContent}>
            <Text style={styles.lembrarTexto}>Lembrar de algo</Text>
            {itens.length === 0 && <Text style={styles.actionSub}>Aniversários, cursos, consultas, compromissos…</Text>}
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/** Módulo em DESTAQUE (Vagas/Unidades): título + dado + contexto. */
function CardDestaque({ icon, titulo, numero, texto, cta, onPress }: {
  icon: IoniconsName; titulo: string; numero: number | null; texto: string; cta: string; onPress: () => void;
}) {
  useTema();
  return (
    <TouchableOpacity style={[styles.tile, styles.tileDestaque, styles.cardDestaque]} onPress={onPress} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={`${titulo}. ${texto}`}>
      <Sheen />
      <View style={styles.destaqueTopo}>
        <View style={styles.tileIcon}>
          <Ionicons name={icon} size={19} color={colors.cyanDim} />
        </View>
        <Text style={styles.tileLabel}>{titulo}</Text>
      </View>
      <View style={styles.destaqueCorpo}>
        {numero != null && <Text style={styles.destaqueNumero}>{numero}</Text>}
        <Text style={styles.destaqueTexto}>{texto}</Text>
      </View>
      <Text style={styles.destaqueCta}>{cta} ›</Text>
    </TouchableOpacity>
  );
}

/** Atalhos secundários: Preciso de…, Ferramentas e Loja (Loja fora da barra no 1.0). */
function Atalhos() {
  useTema();
  return (
    <View style={styles.secondaryRow}>
      <TouchableOpacity style={styles.toolsLink} onPress={() => { analytics.track('preciso_de_opened', { origem: 'home' }); router.push('/preciso-de'); }} activeOpacity={0.7} accessibilityRole="button">
        <Ionicons name="flash-outline" size={15} color={colors.cyanDim} />
        <Text style={styles.toolsLinkText} numberOfLines={1}>Preciso de…</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.toolsLink} onPress={() => router.push('/ferramentas')} activeOpacity={0.7} accessibilityRole="button">
        <Ionicons name="hammer-outline" size={15} color={colors.cyanDim} />
        <Text style={styles.toolsLinkText} numberOfLines={1}>Ferramentas</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.toolsLink} onPress={() => router.push('/loja')} activeOpacity={0.7} accessibilityRole="button">
        <Ionicons name="storefront-outline" size={15} color={colors.cyanDim} />
        <Text style={styles.toolsLinkText} numberOfLines={1}>Loja</Text>
      </TouchableOpacity>
    </View>
  );
}

type TileProps = {
  icon: IoniconsName;
  label: string;
  sub: string;
  onPress: () => void;
  accent?: string;
  destaque?: boolean;
};

/** Reflexo frio no topo da superfície — acabamento "marítimo", nunca cromado. */
function Sheen() {
  useTema();
  return (
    <LinearGradient
      pointerEvents="none"
      colors={maritime.sheenGradient as unknown as [string, string, ...string[]]}
      locations={maritime.sheenLocations as unknown as [number, number, ...number[]]}
      style={StyleSheet.absoluteFill}
    />
  );
}

/**
 * Hero contextual da Home. Todo o texto vem de contextoHome() (ow-domain),
 * que só lê resumoEscala()/calcularMomento() — nenhuma aritmética de datas aqui.
 */
function HomeHero({
  contexto, progresso, dataISO, aeroporto, voz,
}: {
  contexto: HomeContexto;
  progresso: number;
  dataISO: string | null;
  aeroporto: string | null;
  voz: string;
}) {
  useTema();
  const cor = CONTEXTO_COR[contexto.tipo];

  if (contexto.tipo === 'SEM_ESCALA') {
    return (
      <TouchableOpacity style={[styles.hero, styles.heroVazio]} onPress={() => router.push('/escala-config')} activeOpacity={0.85}>
        <Sheen />
        <Text style={styles.heroTitulo}>{contexto.titulo}</Text>
        <Text style={styles.heroDetalhe}>{contexto.detalhe}</Text>
        <View style={styles.heroCta}>
          <Text style={styles.heroCtaText}>Configurar escala</Text>
          <Ionicons name="arrow-forward" size={15} color={colors.onAccent} />
        </View>
      </TouchableOpacity>
    );
  }

  const destino = contexto.tipo === 'PRE_EMBARQUE' ? '/mala' : '/escala';
  const pct = `${Math.round(Math.min(1, Math.max(0, progresso)) * 100)}%` as `${number}%`;
  return (
    <TouchableOpacity
      style={[styles.hero, { borderColor: cor + '40' }]}
      onPress={() => router.navigate(destino)}
      activeOpacity={0.88}
      accessibilityRole="button"
      accessibilityLabel={`${contexto.titulo}. ${contexto.destaque ?? ''}. ${contexto.detalhe}`}
    >
      <LinearGradient
        pointerEvents="none"
        colors={maritime.heroGradient as unknown as [string, string, ...string[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Sheen />
      <View style={styles.heroTop}>
        <View style={[styles.heroChip, { backgroundColor: cor + '1f' }]}>
          <View style={[styles.heroDot, { backgroundColor: cor }]} />
          <Text style={[styles.heroChipText, { color: cor }]}>{contexto.kicker.toUpperCase()}</Text>
        </View>
        {dataISO ? (
          <Text style={styles.heroData}>
            {contexto.tipo === 'EMBARCADO' ? 'Desembarque ' : 'Embarque '}{formatDateBR(dataISO)}
          </Text>
        ) : null}
      </View>
      <Text style={styles.heroTitulo}>{contexto.titulo}</Text>
      {contexto.destaque ? <Text style={[styles.heroDestaque, { color: cor }]}>{contexto.destaque}</Text> : null}
      <View style={styles.heroBar}>
        <View style={[styles.heroBarFill, { width: pct, backgroundColor: cor }]} />
      </View>
      <View style={styles.heroBottom}>
        <Text style={styles.heroDetalhe}>{contexto.detalhe}</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.mutedDim} />
      </View>
      {aeroporto ? (
        <View style={styles.heroAero}>
          <Ionicons name="location-outline" size={12} color={colors.cyanDim} />
          <Text style={styles.heroAeroText}>{aeroporto}</Text>
        </View>
      ) : null}
      {voz ? <Text style={styles.heroVoz}>“{voz}”</Text> : null}
    </TouchableOpacity>
  );
}

/** Bloco compacto da grade 2 × 2 (núcleo pessoal e Offshore agora). */
function HomeTile({
  icon, label, sub, onPress, accent, badge, badgeColor, destaque,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  sub: string;
  onPress: () => void;
  accent?: string;
  badge?: string;
  badgeColor?: string;
  destaque?: boolean;
}) {
  useTema();
  const cor = accent ?? colors.cyanDim;
  // 320–349 dp: tipografia e respiro um pouco menores para o título caber inteiro.
  const estreita = useWindowDimensions().width < 350;
  return (
    <TouchableOpacity
      style={[styles.tile, destaque && styles.tileDestaque, estreita && styles.tileEstreita]}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${sub}`}
    >
      <Sheen />
      <View style={styles.tileTop}>
        <View style={styles.tileIcon}>
          <Ionicons name={icon} size={19} color={cor} />
        </View>
        {badge ? (
          <View style={[styles.actionBadge, { backgroundColor: badgeColor ?? colors.cyan }]}>
            <Text style={styles.actionBadgeText}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.tileLabel, estreita && styles.tileLabelEstreita]} numberOfLines={1}>{label}</Text>
      <Text style={[styles.tileSub, estreita && styles.tileSubEstreita]} numberOfLines={2}>{sub}</Text>
    </TouchableOpacity>
  );
}

/** Linha de lista compacta (Notícias, Aeroportos). */
function ActionRow({
  icon, label, sub, subLines = 1, onPress, last = true, accent,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  sub?: string;
  subLines?: number;
  onPress: () => void;
  last?: boolean;
  accent?: string;
}) {
  useTema();
  return (
    <TouchableOpacity
      style={[styles.actionRow, !last && styles.actionRowBorder]}
      onPress={onPress}
      activeOpacity={0.72}
    >
      <View style={styles.actionIconWrap}>
        <Ionicons name={icon} size={17} color={accent ?? colors.cyanDim} />
      </View>
      <View style={styles.actionContent}>
        <Text style={styles.actionLabel}>{label}</Text>
        {sub ? <Text style={styles.actionSub} numberOfLines={subLines}>{sub}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={14} color={colors.mutedDim} />
    </TouchableOpacity>
  );
}

const styles = themed(() => StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  // paddingBottom real é calculado em runtime (bottomNavSpace) — este é só o fallback.
  content: { padding: spacing.md, paddingBottom: spacing.xxl + spacing.lg },

  // Offline
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.amber + '18',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.amber + '33',
  },
  offlineText: { fontSize: 12, color: colors.amber, flex: 1 },

  // Greeting + clima inline
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  greetingLeft: { flex: 1, marginRight: spacing.sm },
  greetingText: { fontSize: 28, fontWeight: '700', color: colors.white, letterSpacing: -0.3 },
  weatherInline: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, alignSelf: 'flex-start', minHeight: 24 },
  weatherInlineText: { fontSize: 13, color: colors.muted, flexShrink: 1 },
  weatherInlineTemp: { fontWeight: '700', color: colors.white },
  topoAcoes: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  topoBtn: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  frase: { fontSize: 14, color: colors.muted, fontStyle: 'italic', marginTop: 4, lineHeight: 19 },

  // Dica de descoberta (uma vez)
  dica: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: maritime.accentSoft, borderRadius: radius.md,
    borderWidth: 1, borderColor: maritime.accentBorder,
    paddingHorizontal: spacing.sm + 4, paddingVertical: 6, marginBottom: spacing.md,
  },
  dicaTexto: { flex: 1, fontSize: 13, color: colors.white, lineHeight: 18 },
  dicaBtn: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 6 },
  dicaBtnTexto: { fontSize: 13, fontWeight: '700', color: colors.cyan },

  // Escala compacta
  heroMini: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 56,
    borderRadius: radius.lg, borderWidth: 1, borderTopColor: maritime.edgeLight, borderBottomColor: maritime.edgeDark,
    backgroundColor: maritime.glassElevated, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    marginBottom: spacing.md, overflow: 'hidden',
  },
  heroMiniTitulo: { fontSize: 15, fontWeight: '700', color: colors.white },
  heroMiniSub: { fontSize: 12, color: colors.muted, marginTop: 1 },

  // Próximos dias
  proxHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md, marginBottom: spacing.sm },
  verTodos: { minHeight: 32, justifyContent: 'center' },
  verTodosTexto: { fontSize: 13, fontWeight: '700', color: colors.cyanDim },
  lembrarRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: 10, minHeight: 52 },
  lembrarTexto: { fontSize: 14, fontWeight: '700', color: colors.cyan },

  // Grade: metade ou largura inteira (tile ímpar no fim)
  tileMeio: { width: '48.5%' },
  tileCheio: { width: '100%' },

  // Destaque
  cardDestaque: { marginBottom: spacing.sm + 2, minHeight: 0 },
  destaqueTopo: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  destaqueCorpo: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  destaqueNumero: { fontSize: 32, fontWeight: '800', color: colors.white },
  destaqueTexto: { flex: 1, fontSize: 13, color: colors.muted, lineHeight: 18 },
  destaqueCta: { fontSize: 13, fontWeight: '700', color: colors.cyanDim, marginTop: spacing.sm },

  // Hero contextual
  hero: {
    borderRadius: radius.lg,
    padding: spacing.md + 2,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: maritime.glassBorder,
    borderTopColor: maritime.edgeLight,
    borderBottomColor: maritime.edgeDark,
    backgroundColor: maritime.glassElevated,
    overflow: 'hidden',
    ...maritime.cardShadow,
  },
  heroVazio: { gap: spacing.sm },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm + 2 },
  heroChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.xl, paddingHorizontal: 10, paddingVertical: 4 },
  heroDot: { width: 6, height: 6, borderRadius: 3 },
  heroChipText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.9 },
  heroData: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  heroTitulo: { fontSize: 23, fontWeight: '700', color: colors.white, letterSpacing: -0.2 },
  heroDestaque: { fontSize: 16, fontWeight: '700', marginTop: 4 },
  heroBar: { height: 4, backgroundColor: maritime.sunken, borderRadius: 2, overflow: 'hidden', marginTop: spacing.md },
  heroBarFill: { height: '100%', borderRadius: 2 },
  heroBottom: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm + 2 },
  heroDetalhe: { flex: 1, fontSize: 14, color: colors.muted, lineHeight: 20 },
  heroAero: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm },
  heroAeroText: { fontSize: 12, color: colors.cyanDim, fontWeight: '600' },
  heroVoz: { fontSize: 13, color: colors.mutedDim, fontStyle: 'italic', marginTop: spacing.sm },
  heroCta: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    backgroundColor: colors.cyan, borderRadius: radius.xl, paddingHorizontal: spacing.md, paddingVertical: 9, marginTop: spacing.xs,
  },
  heroCtaText: { fontSize: 14, fontWeight: '700', color: colors.onAccent },

  // Section titles
  sectionLabel: {
    ...typography.micro,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },

  // Grade 2 × 2
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.sm + 2,
    marginBottom: spacing.sm + 2,
  },
  tile: {
    width: '100%',
    minHeight: 104,
    backgroundColor: maritime.glass,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: maritime.glassBorder,
    borderTopColor: maritime.edgeLight,
    borderBottomColor: maritime.edgeDark,
    padding: spacing.sm + 6,
    overflow: 'hidden',
    ...maritime.cardShadow,
  },
  // N2: o card importante ganha um pouco mais de presença na borda, nunca contorno neon.
  tileDestaque: { borderColor: maritime.accentBorder, borderTopColor: maritime.tileHighlight },
  tileTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.sm + 2 },
  // Pastilha neutra (grafite): o ícone leva a cor, a área não.
  tileIcon: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: maritime.iconTile, borderWidth: StyleSheet.hairlineWidth, borderColor: maritime.glassBorder },
  tileLabel: { fontSize: 15, fontWeight: '700', color: colors.white },
  tileSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  tileEstreita: { padding: spacing.sm + 3 },
  tileLabelEstreita: { fontSize: 13 },
  tileSubEstreita: { fontSize: 11 },

  // Lista compacta (Notícias, Aeroportos)
  actionList: {
    backgroundColor: maritime.glass,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: maritime.glassBorder,
    borderTopColor: maritime.edgeLight,
    borderBottomColor: maritime.edgeDark,
    marginBottom: spacing.xs,
    overflow: 'hidden',
    ...maritime.cardShadow,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    gap: spacing.sm,
  },
  actionRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: maritime.glassBorder,
  },
  actionIconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: maritime.iconTile,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionContent: { flex: 1 },
  actionLabel: { fontSize: 14, fontWeight: '600', color: colors.white },
  actionSub: { fontSize: 12, color: colors.muted, marginTop: 1, lineHeight: 16 },
  actionBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  actionBadgeText: { fontSize: 11, fontWeight: '700', color: colors.onAccent },

  // Ferramentas — prioridade menor, link discreto
  secondaryRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  toolsLink: {
    // largura pelo conteúdo ("Loja" cede espaço a "Ferramentas"); nunca estoura a borda
    flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, minHeight: 48,
    paddingHorizontal: 8, borderRadius: radius.md,
    borderWidth: 1, borderColor: maritime.glassBorder, borderTopColor: maritime.edgeLight, backgroundColor: maritime.glass,
  },
  toolsLinkText: { fontSize: 13, color: colors.muted, fontWeight: '600', flexShrink: 1 },

  // Alert cards
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: maritime.glass,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: maritime.glassBorder,
    borderTopColor: maritime.edgeLight,
  },
  alertCardWarn: { borderColor: colors.amber + '40', borderTopColor: colors.amber + '55' },
  alertText: { flex: 1, fontSize: 13, color: colors.muted },

}));
