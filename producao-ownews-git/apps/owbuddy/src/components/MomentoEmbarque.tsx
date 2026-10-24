/**
 * Cards de contexto da Home (abaixo do card da escala, mesma linguagem visual):
 *  - OndeEstarCard: véspera e dia da viagem — "onde preciso estar?" com o que a pessoa
 *    cadastrou (nunca inventa horário/local) + Abrir no mapa + mala + contatos.
 *  - PreparacaoCard: últimos dias antes do embarque — viagem e documentos em 1 linha cada.
 */
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, maritime, radius, spacing, themed, typography } from '../theme';
import { useTema } from '../tema';
import { abrirNoMapa } from '../mapa';
import type { LinhaPreparacao, OndeEstar } from '../onde-estar';

export function OndeEstarCard({ onde, mala, contatos }: {
  onde: OndeEstar;
  mala: { total: number; pendentes: number } | null;
  contatos: number;
}) {
  useTema();
  const cor = onde.quando === 'HOJE' ? colors.amber : colors.cyanDim;
  const malaTexto = !mala || mala.total === 0 ? null
    : mala.pendentes === 0 ? 'Pronta'
    : mala.pendentes === 1 ? 'Falta 1 item' : `Faltam ${mala.pendentes} itens`;
  return (
    <View style={[styles.card, { borderColor: cor + '55' }]} accessibilityLabel={onde.titulo}>
      <Text style={[styles.kicker, { color: cor }]}>{onde.quando === 'HOJE' ? 'HOJE' : 'AMANHÃ'}</Text>
      <Text style={styles.titulo}>{onde.titulo}</Text>
      <View style={styles.linhas}>
        {onde.linhas.map(l => (
          <View key={l.rotulo} style={styles.linha}>
            <Text style={styles.rotulo}>{l.rotulo}</Text>
            <Text style={styles.valor}>{l.valor}</Text>
          </View>
        ))}
        {malaTexto ? (
          <TouchableOpacity style={styles.linha} onPress={() => router.navigate('/mala')} accessibilityRole="button">
            <Text style={styles.rotulo}>Mala</Text>
            <Text style={[styles.valor, mala!.pendentes > 0 ? { color: colors.amber } : { color: colors.green }]}>{malaTexto} ›</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {onde.linhas.length === 0 ? (
        <Text style={styles.dica}>Complete a viagem com horário e local para eu mostrar aqui.</Text>
      ) : null}
      <View style={styles.botoes}>
        {onde.mapa ? (
          <TouchableOpacity style={styles.botao} onPress={() => abrirNoMapa(onde.mapa!)} accessibilityRole="button" accessibilityLabel={`Abrir no mapa: ${onde.mapa.nome}`}>
            <Ionicons name="map-outline" size={16} color={colors.cyanDim} />
            <Text style={styles.botaoTexto}>Abrir no mapa</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={styles.botao} onPress={() => router.navigate('/viagem')} accessibilityRole="button">
          <Ionicons name={contatos > 0 ? 'call-outline' : 'airplane-outline'} size={16} color={colors.cyanDim} />
          <Text style={styles.botaoTexto} numberOfLines={1}>{contatos > 0 ? 'Contatos' : 'Ver viagem'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export function PreparacaoCard({ linhas }: { linhas: LinhaPreparacao[] }) {
  useTema();
  if (linhas.length === 0) return null;
  return (
    <View style={styles.lista}>
      {linhas.map((l, i) => (
        <TouchableOpacity
          key={l.chave}
          style={[styles.prepLinha, i > 0 && styles.prepBorda]}
          onPress={() => router.navigate(l.rota)}
          accessibilityRole="button"
          accessibilityLabel={`${l.rotulo}: ${l.valor}`}
        >
          <Ionicons name={l.chave === 'viagem' ? 'airplane-outline' : 'document-text-outline'} size={17} color={l.atencao ? colors.amber : colors.cyanDim} />
          <Text style={styles.prepRotulo}>{l.rotulo}</Text>
          <Text style={[styles.prepValor, l.atencao && { color: colors.amber }]} numberOfLines={1}>{l.valor}</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.mutedDim} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  card: {
    borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1,
    backgroundColor: maritime.glassElevated, ...maritime.cardShadow,
  },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 0.9 },
  titulo: { fontSize: 20, fontWeight: '700', color: colors.white, marginTop: 2 },
  linhas: { marginTop: spacing.sm },
  linha: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm, minHeight: 34, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: maritime.glassBorder },
  rotulo: { fontSize: 13, color: colors.muted },
  valor: { fontSize: 15, fontWeight: '700', color: colors.white, flexShrink: 1, textAlign: 'right' },
  dica: { ...typography.small, color: colors.mutedDim, marginTop: spacing.xs },
  botoes: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  botao: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, borderRadius: radius.md, borderWidth: 1, borderColor: maritime.glassBorder, backgroundColor: maritime.glass, paddingHorizontal: 8 },
  botaoTexto: { fontSize: 13, fontWeight: '700', color: colors.cyanDim, flexShrink: 1 },
  lista: { backgroundColor: maritime.glass, borderRadius: radius.lg, borderWidth: 1, borderColor: maritime.glassBorder, marginBottom: spacing.md, overflow: 'hidden' },
  prepLinha: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, minHeight: 46 },
  prepBorda: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: maritime.glassBorder },
  prepRotulo: { fontSize: 14, color: colors.muted, width: 92 },
  prepValor: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.white, textAlign: 'right' },
}));
