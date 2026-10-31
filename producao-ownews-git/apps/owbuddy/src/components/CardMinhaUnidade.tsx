/**
 * Início: "Sua unidade · N notícias novas" — só embarcado, com unidade do catálogo do Radar e
 * notícia nova da unidade (cardMinhaUnidadeHome). Sem valor, não aparece. Uma linha, um toque.
 */
import { useCallback, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { cardMinhaUnidadeHome, contextoMinhaUnidade } from '@owbuddy/domain';
import { getMinhaUnidade, getNoticiasUnidadeVistas } from '../storage';
import { fetchPacoteRadar } from '../api';
import { colors, maritime, radius, spacing, themed } from '../theme';
import { useTema } from '../tema';

export function CardMinhaUnidade({ embarcado }: { embarcado: boolean }) {
  useTema();
  const [card, setCard] = useState<{ nome: string; novas: number } | null>(null);
  useFocusEffect(useCallback(() => {
    let vivo = true;
    (async () => {
      if (!embarcado) { setCard(null); return; }
      const mu = await getMinhaUnidade();
      if (!mu?.radar) { setCard(null); return; }
      const [p, vistas] = await Promise.all([fetchPacoteRadar().catch(() => null), getNoticiasUnidadeVistas()]);
      if (vivo) setCard(cardMinhaUnidadeHome(contextoMinhaUnidade(mu, p?.pacote ?? null, vistas), embarcado));
    })();
    return () => { vivo = false; };
  }, [embarcado]));
  if (!card) return null;
  return (
    <TouchableOpacity style={styles.card} onPress={() => router.push('/minha-unidade')} accessibilityRole="button" accessibilityLabel={`Sua unidade, ${card.nome}: ${card.novas} ${card.novas === 1 ? 'notícia nova' : 'notícias novas'}`}>
      <Ionicons name="boat-outline" size={18} color={colors.iconDefault} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.kicker}>SUA UNIDADE</Text>
        <Text style={styles.nome} numberOfLines={1}>{card.nome}</Text>
        <Text style={styles.sub}>{card.novas === 1 ? '1 notícia nova relacionada' : `${card.novas} notícias novas relacionadas`}</Text>
      </View>
      <Text style={styles.ver}>Ver</Text>
    </TouchableOpacity>
  );
}

const styles = themed(() => StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 60, marginTop: spacing.md, padding: spacing.md,
    borderRadius: radius.lg, borderWidth: 1, borderColor: maritime.glassBorder, borderTopColor: maritime.edgeLight, backgroundColor: maritime.glass,
  },
  kicker: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, color: colors.kicker },
  nome: { fontSize: 15, fontWeight: '700', color: colors.white },
  sub: { fontSize: 12, color: colors.muted, marginTop: 1 },
  ver: { fontSize: 14, fontWeight: '700', color: colors.cyanDim, paddingHorizontal: spacing.xs },
}));
