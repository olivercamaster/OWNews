/**
 * Ideias de presente — lista editorial local (ow-domain/presentes.ts). Sem loja, sem preço
 * real, sem compra, sem afiliado. Pessoa/relação vêm do evento e ficam só no aparelho.
 */
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  CATEGORIAS_PRESENTE,
  FAIXAS_PRECO,
  LABEL_CATEGORIA_PRESENTE,
  LABEL_FAIXA_PRECO,
  escalaNaData,
  hojeISO,
  ideiasDePresente,
  proximaOcorrencia,
  tituloEvento,
} from '@owbuddy/domain';
import type { CategoriaPresente, EventoPessoal, FaixaPreco } from '@owbuddy/domain';
import { getEscala, getEventosPessoais } from '../src/storage';
import { colors, maritime, radius, spacing, typography } from '../src/theme';
import { OWBackground } from '../src/components/OWBackground';
import { formatDateBR } from '../src/format';

export default function Presentes() {
  const { evento } = useLocalSearchParams<{ evento?: string }>();
  const [ev, setEv] = useState<EventoPessoal | null>(null);
  const [embarcado, setEmbarcado] = useState(false);
  const [quando, setQuando] = useState<string | null>(null);
  const [faixa, setFaixa] = useState<FaixaPreco | null>(null);
  const [categoria, setCategoria] = useState<CategoriaPresente | null>(null);

  useEffect(() => {
    (async () => {
      const [lista, escala] = await Promise.all([getEventosPessoais(), getEscala()]);
      const e = lista.find(x => x.id === evento) ?? null;
      setEv(e);
      const oc = e ? proximaOcorrencia(e, hojeISO()) : null;
      if (oc) {
        setQuando(oc.iso);
        const est = escalaNaData(escala, oc.iso);
        setEmbarcado(!!est && (est.kind === 'EMBARCADO' || est.kind === 'DOBRA') && !est.isEmbarque);
      }
    })();
  }, [evento]);

  const ideias = ideiasDePresente({ faixa, categoria, embarcadoNaData: embarcado });
  const paraQuem = ev?.pessoa?.trim() || (ev ? tituloEvento(ev) : null);

  return (
    <OWBackground>
      <ScrollView contentContainerStyle={styles.content}>
        {paraQuem ? (
          <View style={styles.topo}>
            <Ionicons name="gift-outline" size={18} color="#f48fb1" />
            <View style={{ flex: 1 }}>
              <Text style={styles.para}>Para {paraQuem}{ev?.relacao ? ` · ${ev.relacao}` : ''}</Text>
              {quando ? <Text style={styles.sub}>{formatDateBR(quando)}{embarcado ? ' · você estará embarcado — prefira algo que chegue sem você' : ''}</Text> : null}
            </View>
          </View>
        ) : null}

        <Text style={styles.label}>Faixa de preço</Text>
        <View style={styles.chips}>
          {FAIXAS_PRECO.map(f => (
            <Chip key={f} ativo={faixa === f} texto={LABEL_FAIXA_PRECO[f]} onPress={() => setFaixa(faixa === f ? null : f)} />
          ))}
        </View>

        <Text style={styles.label}>Tipo de presente</Text>
        <View style={styles.chips}>
          {CATEGORIAS_PRESENTE.map(c => (
            <Chip key={c} ativo={categoria === c} texto={LABEL_CATEGORIA_PRESENTE[c]} onPress={() => setCategoria(categoria === c ? null : c)} />
          ))}
        </View>

        <Text style={styles.label}>Ideias</Text>
        {ideias.length === 0 ? (
          <Text style={styles.vazio}>Nenhuma ideia com esses filtros. Tente outra faixa ou tipo.</Text>
        ) : (
          <View style={styles.cartao}>
            {ideias.map((i, k) => (
              <View key={i.id} style={[styles.ideia, k < ideias.length - 1 && styles.borda]}>
                <Text style={styles.ideiaTitulo}>{i.titulo}</Text>
                <Text style={styles.ideiaDica}>{i.dica}</Text>
              </View>
            ))}
          </View>
        )}
        <Text style={styles.nota}>Sugestões gerais do OWBuddy — sem preço, loja ou compra pelo app.</Text>
      </ScrollView>
    </OWBackground>
  );
}

function Chip({ ativo, texto, onPress }: { ativo: boolean; texto: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.chip, ativo && styles.chipAtivo]} onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: ativo }}>
      <Text style={[styles.chipTexto, ativo && styles.chipTextoAtivo]}>{texto}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  topo: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md,
    borderRadius: radius.lg, borderWidth: 1, borderColor: maritime.glassBorder, backgroundColor: maritime.glass,
  },
  para: { fontSize: 15, fontWeight: '700', color: colors.white },
  sub: { fontSize: 12, color: colors.muted, marginTop: 2, lineHeight: 16 },
  label: { ...typography.micro, marginTop: spacing.md, marginBottom: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { minHeight: 40, paddingHorizontal: 12, justifyContent: 'center', borderRadius: radius.xl, borderWidth: 1, borderColor: maritime.glassBorder, backgroundColor: maritime.glass },
  chipAtivo: { backgroundColor: colors.cyanFaint, borderColor: colors.cyan },
  chipTexto: { fontSize: 13, fontWeight: '600', color: colors.muted },
  chipTextoAtivo: { color: colors.cyan },
  cartao: { borderRadius: radius.lg, borderWidth: 1, borderColor: maritime.glassBorder, backgroundColor: maritime.glass, overflow: 'hidden' },
  ideia: { padding: spacing.md },
  borda: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: maritime.glassBorder },
  ideiaTitulo: { fontSize: 15, fontWeight: '700', color: colors.white },
  ideiaDica: { fontSize: 13, color: colors.muted, marginTop: 2, lineHeight: 18 },
  vazio: { ...typography.small, color: colors.mutedDim },
  nota: { fontSize: 11, color: colors.mutedDim, textAlign: 'center', marginTop: spacing.md },
});
