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
import { encontrarJanelasJuntos, secundariaParaConfig, hojeISO } from '@owbuddy/domain';
import type { EscalaSecundaria, JanelaJuntos } from '@owbuddy/domain';
import { getEscala, getEscalasCruzar, setEscalasCruzar } from '../src/storage';
import { colors, spacing, radius, typography, surface } from '../src/theme';

const MESES_CURTO = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];

function fmtData(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${parseInt(d)} ${MESES_CURTO[parseInt(m) - 1]}`;
}

export default function EscalaCruzarScreen() {
  const [escalas, setEscalas] = useState<EscalaSecundaria[]>([]);
  const [janelas, setJanelas] = useState<{ nome: string; janelas: JanelaJuntos[] }[]>([]);

  useFocusEffect(useCallback(() => {
    load();
  }, []));

  const load = async () => {
    const [config, secs] = await Promise.all([getEscala(), getEscalasCruzar()]);
    setEscalas(secs);

    if (!config) { setJanelas([]); return; }
    const hoje = hojeISO();
    const resultados = secs.map(sec => ({
      nome: sec.nome,
      janelas: encontrarJanelasJuntos(config, secundariaParaConfig(sec), hoje, 180, 3),
    }));
    setJanelas(resultados);
  };

  const remover = async (id: string) => {
    const updated = escalas.filter(s => s.id !== id);
    await setEscalasCruzar(updated);
    setEscalas(updated);
    setJanelas(j => j.filter((_, i) => escalas[i]?.id !== id));
    load();
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.addRow}>
        <Text style={styles.subtitle}>Compare sua escala com outra pessoa</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/escala-secundaria-form')}>
          <Ionicons name="add" size={18} color={colors.navy950} />
          <Text style={styles.addBtnText}>Adicionar</Text>
        </TouchableOpacity>
      </View>

      {escalas.length === 0 && (
        <View style={styles.emptyCard}>
          <Ionicons name="people-outline" size={40} color={colors.mutedDim} />
          <Text style={styles.emptyText}>Nenhuma escala adicionada ainda.</Text>
          <Text style={styles.emptyHint}>Adicione a escala de um familiar, parceiro ou colega para descobrir as próximas folgas em comum.</Text>
        </View>
      )}

      {escalas.map((sec, i) => {
        const resultado = janelas[i];
        return (
          <View key={sec.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardLeft}>
                <Text style={styles.cardIcon}>{sec.icon ?? '🔗'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardNome}>{sec.nome}</Text>
                  {sec.relacao && <Text style={styles.cardRelacao}>{sec.relacao}</Text>}
                  <Text style={styles.cardEscala}>{sec.tipo === 'custom' ? `${sec.diasEmbarcado}×${sec.diasFolga}` : sec.tipo}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => remover(sec.id)} hitSlop={10}>
                <Ionicons name="trash-outline" size={18} color={colors.mutedDim} />
              </TouchableOpacity>
            </View>

            {resultado?.janelas.length === 0 ? (
              <Text style={styles.semJanela}>Nenhuma folga em comum nos próximos 6 meses.</Text>
            ) : (
              <>
                <Text style={styles.janelasTitulo}>Próximas folgas em comum:</Text>
                {resultado?.janelas.map((j, ji) => (
                  <View key={ji} style={styles.janelaRow}>
                    <Ionicons name="people" size={14} color={colors.green} />
                    <Text style={styles.janelaTexto}>
                      {fmtData(j.inicio)} → {fmtData(j.fim)} · <Text style={styles.janelasDias}>{j.dias} {j.dias === 1 ? 'dia' : 'dias'}</Text>
                    </Text>
                  </View>
                ))}
              </>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: surface.bg },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },

  addRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  subtitle: { ...typography.small, color: colors.muted, flex: 1 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.cyan, borderRadius: radius.sm,
    paddingHorizontal: spacing.sm, paddingVertical: 6,
  },
  addBtnText: { fontSize: 13, fontWeight: '700', color: colors.navy950 },

  emptyCard: {
    backgroundColor: surface.card, borderRadius: radius.lg, padding: spacing.xl,
    alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.line,
  },
  emptyText: { ...typography.body, textAlign: 'center' },
  emptyHint: { ...typography.small, textAlign: 'center', color: colors.mutedDim, lineHeight: 18 },

  card: {
    backgroundColor: surface.card, borderRadius: radius.lg, padding: spacing.md,
    borderWidth: 1, borderColor: colors.line, gap: spacing.sm,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, flex: 1 },
  cardIcon: { fontSize: 24, marginTop: 2 },
  cardNome: { fontSize: 16, fontWeight: '700', color: colors.white },
  cardRelacao: { fontSize: 12, color: colors.cyanDim, marginTop: 1 },
  cardEscala: { fontSize: 11, color: colors.mutedDim, marginTop: 2 },

  semJanela: { ...typography.small, color: colors.mutedDim, fontStyle: 'italic' },
  janelasTitulo: { ...typography.micro, marginBottom: 4 },
  janelaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  janelaTexto: { fontSize: 13, color: colors.white },
  janelasDias: { color: colors.green, fontWeight: '700' },

  green: { color: colors.green },
});
