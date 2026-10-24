import { useCallback, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  definirOcultaSecundaria,
  diasDoCiclo,
  encontrarJanelasJuntos,
  hojeISO,
  proximoEmbarqueSecundaria,
  removerEscalaSecundaria,
  rotuloCicloSecundaria,
  secundariaParaConfig,
} from '@owbuddy/domain';
import type { EscalaConfig, EscalaSecundaria } from '@owbuddy/domain';
import { getEscala, getEscalasCruzar, setEscalasCruzar } from '../src/storage';
import { colors, maritime, spacing, radius, typography, surface, tone, themed } from '../src/theme';
import { useTema } from '../src/tema';
import { confirmar } from '../src/confirmar';
import { ioniconRelacao } from '../src/relacao-icones';

const MESES_CURTO = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];

function fmtData(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${parseInt(d)} ${MESES_CURTO[parseInt(m) - 1]}`;
}

function fmtDiaMes(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

/**
 * Escalas cruzadas — lista + gerenciamento (Cruzar 2.1).
 * Cada pessoa: ícone, nome, relação · ciclo, próximo embarque e as ações
 * Editar / Ocultar|Mostrar / Excluir à vista (antes só um lápis e uma lixeira soltos).
 */
export default function EscalaCruzarScreen() {
  useTema();
  const [escalas, setEscalas] = useState<EscalaSecundaria[]>([]);
  const [config, setConfig] = useState<EscalaConfig | null>(null);
  const [carregado, setCarregado] = useState(false);

  const load = useCallback(async () => {
    const [cfg, secs] = await Promise.all([getEscala(), getEscalasCruzar()]);
    setConfig(cfg);
    setEscalas(secs);
    setCarregado(true);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const salvarLista = async (nova: EscalaSecundaria[]) => {
    setEscalas(nova);
    await setEscalasCruzar(nova);
  };

  const alternarOculta = (sec: EscalaSecundaria) => salvarLista(definirOcultaSecundaria(escalas, sec.id, !sec.oculta));

  const excluir = (sec: EscalaSecundaria) => confirmar(
    `Excluir a escala de ${sec.nome}?`,
    'Isso remove apenas o cruzamento desta pessoa. Sua escala principal não será alterada.',
    'Excluir',
    () => salvarLista(removerEscalaSecundaria(escalas, sec.id)),
    true,
  );

  const editar = (sec: EscalaSecundaria) => router.push({ pathname: '/escala-secundaria-form', params: { id: sec.id } });

  const hoje = hojeISO();

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.subtitle}>
        {escalas.length > 0
          ? 'Toque em Editar para mudar nome, relação, ícone, ciclo ou data de embarque.'
          : 'Compare sua escala com a de outra pessoa e veja as folgas em comum.'}
      </Text>

      {carregado && escalas.length === 0 && (
        <View style={styles.emptyCard}>
          <Ionicons name="people-outline" size={40} color={colors.mutedDim} />
          <Text style={styles.emptyText}>Nenhuma escala cruzada ainda.</Text>
          <Text style={styles.emptyHint}>Adicione a escala de um familiar, companheira/o ou colega para descobrir as próximas folgas em comum.</Text>
        </View>
      )}

      {carregado && !config && escalas.length > 0 && (
        <TouchableOpacity style={styles.avisoCard} onPress={() => router.push('/escala-config')}>
          <Text style={styles.emptyHint}>Configure a sua escala para ver as folgas em comum.</Text>
        </TouchableOpacity>
      )}

      {escalas.map(sec => {
        const invalida = !diasDoCiclo(secundariaParaConfig(sec));
        const proxEmb = invalida ? null : proximoEmbarqueSecundaria(sec);
        const janelas = config && !invalida && !sec.oculta
          ? encontrarJanelasJuntos(config, secundariaParaConfig(sec), hoje, 180, 3)
          : [];
        return (
          <View key={sec.id} style={[styles.card, sec.oculta && styles.cardOculto]} testID={`cruzada-${sec.id}`}>
            <TouchableOpacity
              style={styles.cardHeader}
              activeOpacity={0.8}
              onPress={() => editar(sec)}
              accessibilityRole="button"
              accessibilityLabel={`Editar escala de ${sec.nome}`}
            >
              <View style={styles.cardIcon}>
                <Ionicons name={ioniconRelacao(sec.icon)} size={20} color={sec.oculta ? colors.mutedDim : colors.cyanDim} />
              </View>
              <View style={styles.cardInfo}>
                <Text style={styles.cardNome} numberOfLines={1}>{sec.nome}</Text>
                <Text style={styles.cardMeta} numberOfLines={1}>
                  {sec.relacao ? `${sec.relacao} · ` : ''}{rotuloCicloSecundaria(sec)}
                </Text>
                {invalida ? (
                  <Text style={styles.cardAviso}>Ciclo incompleto — toque em Editar para corrigir.</Text>
                ) : proxEmb ? (
                  <Text style={styles.cardProx}>Próximo embarque: <Text style={styles.cardProxData}>{fmtDiaMes(proxEmb)}</Text></Text>
                ) : null}
                {sec.oculta && <Text style={styles.cardOcultaTag}>Oculta no calendário</Text>}
              </View>
            </TouchableOpacity>

            {!sec.oculta && config && !invalida && (
              janelas.length === 0 ? (
                <Text style={styles.semJanela}>Nenhuma folga em comum nos próximos 6 meses.</Text>
              ) : (
                <View style={styles.janelas}>
                  <Text style={styles.janelasTitulo}>Próximas folgas em comum</Text>
                  {janelas.map((j, ji) => (
                    <View key={ji} style={styles.janelaRow}>
                      <Ionicons name="people" size={14} color={colors.green} />
                      <Text style={styles.janelaTexto}>
                        {fmtData(j.inicio)} → {fmtData(j.fim)} · <Text style={styles.janelasDias}>{j.dias} {j.dias === 1 ? 'dia' : 'dias'}</Text>
                      </Text>
                    </View>
                  ))}
                </View>
              )
            )}

            <View style={styles.acoes}>
              <Acao icon="create-outline" label="Editar" onPress={() => editar(sec)} a11y={`Editar escala de ${sec.nome}`} />
              <Acao
                icon={sec.oculta ? 'eye-outline' : 'eye-off-outline'}
                label={sec.oculta ? 'Mostrar' : 'Ocultar'}
                onPress={() => alternarOculta(sec)}
                a11y={sec.oculta ? `Mostrar ${sec.nome} no calendário` : `Ocultar ${sec.nome} do calendário`}
              />
              <Acao icon="trash-outline" label="Excluir" onPress={() => excluir(sec)} a11y={`Excluir escala de ${sec.nome}`} perigo />
            </View>
          </View>
        );
      })}

      <TouchableOpacity
        style={styles.addBtn}
        onPress={() => router.push('/escala-secundaria-form')}
        accessibilityRole="button"
      >
        <Ionicons name="add" size={18} color={colors.onAccent} />
        <Text style={styles.addBtnText}>{escalas.length > 0 ? 'Cruzar outra escala' : 'Cruzar uma escala'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

function Acao({ icon, label, onPress, a11y, perigo }: { icon: IoniconsName; label: string; onPress: () => void; a11y: string; perigo?: boolean }) {
  useTema();
  return (
    <TouchableOpacity style={styles.acao} onPress={onPress} accessibilityRole="button" accessibilityLabel={a11y} activeOpacity={0.7}>
      <Ionicons name={icon} size={16} color={perigo ? colors.red : colors.cyanDim} />
      <Text style={[styles.acaoTexto, perigo && { color: colors.red }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = themed(() => StyleSheet.create({
  root: { flex: 1, backgroundColor: surface.bg },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },

  subtitle: { ...typography.small, color: colors.muted },

  emptyCard: {
    backgroundColor: surface.card, borderRadius: radius.lg, padding: spacing.xl,
    alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.line,
  },
  avisoCard: {
    backgroundColor: surface.card, borderRadius: radius.md, padding: spacing.md,
    borderWidth: 1, borderColor: maritime.accentBorder,
  },
  emptyText: { ...typography.body, textAlign: 'center' },
  emptyHint: { ...typography.small, textAlign: 'center', color: colors.mutedDim, lineHeight: 18 },

  card: {
    backgroundColor: surface.card, borderRadius: radius.lg, padding: spacing.md,
    borderWidth: 1, borderColor: colors.line, borderTopColor: tone.edgeLight, gap: spacing.sm,
  },
  cardOculto: { opacity: 0.72 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  cardIcon: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: maritime.iconTile,
    borderWidth: 1, borderColor: tone.borderSubtle,
    alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  cardInfo: { flex: 1, minWidth: 0 },
  cardNome: { fontSize: 16, fontWeight: '700', color: colors.white },
  cardMeta: { fontSize: 13, color: colors.muted, marginTop: 1 },
  cardProx: { fontSize: 12, color: colors.mutedDim, marginTop: 3 },
  cardProxData: { color: tone.textEmphasis, fontWeight: '700' },
  cardAviso: { fontSize: 12, color: colors.amber, marginTop: 3 },
  cardOcultaTag: { fontSize: 11, color: colors.mutedDim, marginTop: 3, fontStyle: 'italic' },

  semJanela: { ...typography.small, color: colors.mutedDim, fontStyle: 'italic' },
  janelas: { gap: 4 },
  janelasTitulo: { ...typography.micro, marginBottom: 2 },
  janelaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  janelaTexto: { fontSize: 13, color: colors.white },
  janelasDias: { color: colors.green, fontWeight: '700' },

  acoes: {
    flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.lineSoft,
    paddingTop: spacing.sm, marginTop: 2, gap: spacing.xs,
  },
  acao: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    minHeight: 40, borderRadius: radius.sm, backgroundColor: maritime.iconTile,
    borderWidth: 1, borderColor: tone.borderSubtle,
  },
  acaoTexto: { fontSize: 13, fontWeight: '600', color: tone.accentText },

  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: colors.cyan, borderRadius: radius.md, minHeight: 48,
  },
  addBtnText: { fontSize: 15, fontWeight: '700', color: colors.onAccent },
}));
