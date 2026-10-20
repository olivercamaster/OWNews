import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { quandoTexto, type Acontecimento } from '@owbuddy/domain';
import { colors, maritime, radius, spacing, tone, themed } from '../theme';
import { useTema } from '../tema';
import { visualAcontecimento } from '../evento-visual';

/**
 * Uma linha de acontecimento (Home e Próximos): ícone + título + quando + detalhe da escala,
 * e no máximo UMA ação principal. Toque na linha abre a origem.
 */
export function AcontecimentoLinha({ a, onAcao, ultimo }: { a: Acontecimento; onAcao: (a: Acontecimento) => void; ultimo?: boolean }) {
  useTema();
  const v = visualAcontecimento(a.tipo, a.subtipo);
  const quando = quandoTexto(a.dias, a.dataISO, a.hora);
  return (
    <View style={[styles.row, !ultimo && styles.borda]}>
      <TouchableOpacity
        style={styles.main}
        onPress={() => router.push({ pathname: a.rota as never, params: a.rotaParams ?? {} })}
        accessibilityRole="button"
        accessibilityLabel={`${a.titulo}. ${quando}. ${a.detalhe ?? ''}`}
      >
        <View style={[styles.icone, { backgroundColor: v.color + '18' }]}>
          <Ionicons name={v.icon} size={17} color={v.color} />
        </View>
        <View style={styles.conteudo}>
          <Text style={styles.titulo} numberOfLines={1}>{a.titulo}</Text>
          <Text style={[styles.quando, a.dias <= 1 && styles.quandoPerto]} numberOfLines={2}>{quando}</Text>
          {a.detalhe ? <Text style={styles.detalhe} numberOfLines={2}>{a.detalhe}</Text> : null}
        </View>
      </TouchableOpacity>
      {a.acao && (
        <TouchableOpacity style={styles.pill} onPress={() => onAcao(a)} accessibilityRole="button" accessibilityLabel={a.acao.label}>
          <Text style={styles.pillTexto} numberOfLines={2}>{a.acao.label}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingRight: spacing.sm },
  borda: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: maritime.glassBorder },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingLeft: spacing.md, paddingVertical: 10, minHeight: 56 },
  icone: { width: 32, height: 32, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  conteudo: { flex: 1, minWidth: 0 },
  titulo: { fontSize: 14, fontWeight: '600', color: colors.white },
  // Ciano é acento: a data fica clara e com peso; só hoje/amanhã ganham o ciano.
  quando: { fontSize: 12, color: tone.textEmphasis, fontWeight: '600', marginTop: 1 },
  quandoPerto: { color: colors.cyanDim },
  detalhe: { fontSize: 12, color: colors.muted, marginTop: 1, lineHeight: 16 },
  pill: {
    maxWidth: 104, minHeight: 36, borderRadius: radius.xl, paddingHorizontal: 10, paddingVertical: 4,
    // Ação secundária: material escuro + borda sutil; o rótulo é que leva o ciano.
    backgroundColor: maritime.iconTile, borderWidth: 1, borderColor: tone.border,
    alignItems: 'center', justifyContent: 'center', marginLeft: 4,
  },
  pillTexto: { fontSize: 11.5, fontWeight: '700', color: colors.cyan, textAlign: 'center' },
}));
