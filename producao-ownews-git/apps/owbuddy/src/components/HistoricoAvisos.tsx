/**
 * Avisos discretos do Meu Histórico (Home e tela do Histórico): finalizar o embarque cujo
 * desembarque previsto chegou, ou revisar o ciclo atual sugerido pela escala.
 * Nunca bloqueiam nada: sempre há "Agora não". Previsto só vira realizado com um toque explícito.
 */
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { nomeRegistro, periodoCurto } from '@owbuddy/domain';
import type { PendenciaFinalizar, SugestaoCiclo } from '@owbuddy/domain';
import { colors, maritime, radius, spacing, themed } from '../theme';
import { useTema } from '../tema';
import { formatDateBR } from '../format';
import { useAcaoUnica } from '../acoes';
import { avisar } from '../feedback';
import { adiarPendencia, confirmarDesembarquePrevisto, dispensarSugestaoCiclo } from '../historico-acoes';

export function AvisoFinalizar({ p, onFeito }: { p: PendenciaFinalizar; onFeito: () => void }) {
  useTema();
  const hoje = p.diasDesde === 0;
  const dataCurta = formatDateBR(p.desembarquePrevisto).slice(0, 5);
  const [confirmar, ocupado] = useAcaoUnica(async () => {
    await confirmarDesembarquePrevisto(p);
    avisar('Desembarque registrado');
    onFeito();
  });
  const [adiar] = useAcaoUnica(async () => { await adiarPendencia(p); onFeito(); });
  return (
    <View style={styles.card} accessibilityRole="summary">
      <View style={styles.topo}>
        <Ionicons name="log-out-outline" size={16} color={colors.amber} />
        <Text style={styles.kicker}>{hoje ? 'Desembarque previsto para hoje' : 'Finalizar último embarque'}</Text>
      </View>
      <Text style={styles.titulo}>
        {hoje ? 'Quer registrar seu desembarque?' : `Desembarque previsto: ${dataCurta}`}
      </Text>
      <Text style={styles.sub} numberOfLines={1}>{nomeRegistro(p.registro)} · {periodoCurto(p.registro)}</Text>
      <View style={styles.acoes}>
        <TouchableOpacity style={styles.primario} onPress={confirmar} disabled={ocupado} accessibilityRole="button">
          <Text style={styles.primarioTexto}>{hoje ? 'Registrar hoje' : `Confirmar ${dataCurta}`}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secundario}
          onPress={() => router.push({ pathname: '/historico-form', params: { id: p.registro.id, finalizar: '1' } })}
          accessibilityRole="button"
        >
          <Text style={styles.secundarioTexto}>{hoje ? 'Alterar data' : 'Escolher outra data'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secundario} onPress={adiar} accessibilityRole="button">
          <Text style={styles.agoraNao}>Agora não</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export function AvisoSugestao({ s, onFeito, compacto }: { s: SugestaoCiclo; onFeito: () => void; compacto?: boolean }) {
  useTema();
  const [dispensar] = useAcaoUnica(async () => { await dispensarSugestaoCiclo(s); onFeito(); });
  const kicker = s.momento === 'ultimo' ? 'Registrar o último embarque?'
    : s.diaDoBloco === 1 ? 'Registrar embarque de hoje?' : 'Registrar este embarque?';
  return (
    <View style={styles.card}>
      <View style={styles.topo}>
        <Ionicons name="boat-outline" size={16} color={colors.green} />
        <Text style={styles.kicker}>{kicker}</Text>
      </View>
      <Text style={styles.titulo}>{periodoCurto({ embarque: s.embarquePrevisto, desembarque: s.desembarquePrevisto })}</Text>
      <Text style={styles.sub}>{s.dEm} dias previstos pela sua escala. Você confirma o que realmente aconteceu.</Text>
      <View style={styles.acoes}>
        <TouchableOpacity style={styles.primario} onPress={() => router.push({ pathname: '/historico-form', params: { sugestao: '1' } })} accessibilityRole="button">
          <Text style={styles.primarioTexto}>{compacto ? 'Revisar ciclo atual' : 'Revisar e registrar'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secundario} onPress={dispensar} accessibilityRole="button">
          <Text style={styles.agoraNao}>Agora não</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  card: {
    backgroundColor: maritime.glass, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md,
    borderWidth: 1, borderColor: maritime.glassBorder, borderTopColor: maritime.edgeLight, borderBottomColor: maritime.edgeDark,
  },
  topo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kicker: { fontSize: 11, fontWeight: '700', color: colors.kicker, letterSpacing: 0.8, textTransform: 'uppercase', flexShrink: 1 },
  titulo: { fontSize: 17, fontWeight: '700', color: colors.white, marginTop: 6 },
  sub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  acoes: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: spacing.sm, rowGap: 4, marginTop: spacing.sm },
  primario: {
    minHeight: 40, paddingHorizontal: 14, borderRadius: radius.md, justifyContent: 'center',
    backgroundColor: colors.cyan, ...maritime.botaoPrimario,
  },
  primarioTexto: { fontSize: 14, fontWeight: '700', color: colors.onAccent },
  secundario: { minHeight: 40, paddingHorizontal: 8, justifyContent: 'center' },
  secundarioTexto: { fontSize: 14, fontWeight: '700', color: colors.cyanDim },
  agoraNao: { fontSize: 14, fontWeight: '600', color: colors.mutedDim },
}));
