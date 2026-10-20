/**
 * "Preciso de…" — atalhos para o que JÁ existe. Nenhuma tela duplicada: cada opção
 * leva à função atual; Transporte abre o sheet Uber/99 (sem localização no OWBuddy).
 */
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { EscalaConfig, Viagem } from '@owbuddy/domain';
import { getEscala, getViagem } from '../src/storage';
import { colors, maritime, radius, spacing, themed } from '../src/theme';
import { useTema } from '../src/tema';
import { OWBackground } from '../src/components/OWBackground';
import { TransporteSheet } from '../src/components/TransporteSheet';
import { opcoesTransporte } from '../src/transporte';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const OPCOES: { id: string; label: string; sub: string; icon: IoniconsName; rota?: string }[] = [
  { id: 'transporte', label: 'Transporte', sub: 'Uber ou 99 até o aeroporto ou a base', icon: 'car-outline' },
  { id: 'aeroporto', label: 'Aeroporto', sub: 'Condições nas bases offshore', icon: 'cloudy-outline', rota: '/aeroportos' },
  { id: 'viagem', label: 'Minha Viagem', sub: 'Voo, ônibus, horário', icon: 'airplane-outline', rota: '/viagem' },
  { id: 'checklist', label: 'Checklist', sub: 'Meu Embarque', icon: 'checkbox-outline', rota: '/mala' },
  { id: 'certs', label: 'Certificados', sub: 'Validades', icon: 'document-text-outline', rota: '/certs' },
  { id: 'vagas', label: 'Vagas', sub: 'Verificadas nos portais oficiais', icon: 'briefcase-outline', rota: '/vagas' },
  { id: 'unidades', label: 'Unidades', sub: 'FPSOs, sondas e navios', icon: 'boat-outline', rota: '/unidades' },
  { id: 'lembrar', label: 'Lembrar de algo', sub: 'Aniversário, curso, consulta…', icon: 'add-circle-outline', rota: '/escala-evento-form' },
  { id: 'pagamento', label: 'Meu Pagamento', sub: 'Data provável pela regra da empresa', icon: 'wallet-outline', rota: '/pagamento' },
];

export default function PrecisoDe() {
  useTema();
  const [ctx, setCtx] = useState<{ viagem: Viagem | null; escala: EscalaConfig | null }>({ viagem: null, escala: null });
  const [transporte, setTransporte] = useState(false);

  useEffect(() => {
    Promise.all([getViagem(), getEscala()]).then(([viagem, escala]) => setCtx({ viagem, escala }));
  }, []);

  return (
    <OWBackground>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.lista}>
          {OPCOES.map((o, i) => (
            <TouchableOpacity
              key={o.id}
              style={[styles.linha, i < OPCOES.length - 1 && styles.borda]}
              onPress={() => (o.rota ? router.push(o.rota as never) : setTransporte(true))}
              accessibilityRole="button"
              accessibilityLabel={`${o.label}. ${o.sub}`}
            >
              <View style={styles.icone}><Ionicons name={o.icon} size={19} color={colors.cyanDim} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>{o.label}</Text>
                <Text style={styles.sub}>{o.sub}</Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color={colors.mutedDim} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
      <TransporteSheet visivel={transporte} opcoes={opcoesTransporte(ctx.viagem, ctx.escala)} onFechar={() => setTransporte(false)} />
    </OWBackground>
  );
}

const styles = themed(() => StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  lista: { borderRadius: radius.lg, borderWidth: 1, borderColor: maritime.glassBorder, borderTopColor: maritime.edgeLight, backgroundColor: maritime.glass, overflow: 'hidden' },
  linha: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 60, paddingHorizontal: spacing.md, paddingVertical: 10 },
  borda: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: maritime.glassBorder },
  icone: { width: 36, height: 36, borderRadius: radius.md, backgroundColor: colors.cyanDim + '1c', alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 15, fontWeight: '700', color: colors.white },
  sub: { fontSize: 12, color: colors.muted, marginTop: 1 },
}));
