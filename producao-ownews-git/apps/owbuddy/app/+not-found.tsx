import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '../src/theme';

/** Link desconhecido (ex.: owbuddy://auth/callback de builds antigos) — nunca tela crua de erro. */
export default function NaoEncontrado() {
  return (
    <>
      <Stack.Screen options={{ title: 'OWBuddy', headerStyle: { backgroundColor: colors.navy800 } }} />
      <View style={styles.root}>
        <Ionicons name="compass-outline" size={48} color={colors.cyanDim} />
        <Text style={styles.titulo}>Este link não abre nada no app.</Text>
        <Text style={styles.sub}>Seus dados continuam aqui. Volte para o início.</Text>
        <TouchableOpacity style={styles.btn} onPress={() => router.replace('/')} accessibilityRole="button">
          <Text style={styles.btnText}>Ir para o início</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md, backgroundColor: colors.navy950 },
  titulo: { ...typography.h3, textAlign: 'center' },
  sub: { ...typography.small, textAlign: 'center' },
  btn: { backgroundColor: colors.cyan, borderRadius: radius.md, paddingHorizontal: spacing.lg, minHeight: 44, justifyContent: 'center', marginTop: spacing.sm },
  btnText: { color: colors.navy950, fontWeight: '700' },
});
