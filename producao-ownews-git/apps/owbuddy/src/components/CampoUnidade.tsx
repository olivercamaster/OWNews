/**
 * Campo de unidade com sugestões do Radar Offshore (OWNews).
 *
 *  - O texto é da pessoa: dá para salvar qualquer nome, sem internet e sem catálogo.
 *  - Com o catálogo guardado no aparelho, aparecem até 6 sugestões enquanto digita; tocar em uma
 *    guarda a referência estável (id + slug) e o nome do catálogo.
 *  - Editar o texto depois de escolher desfaz só a referência (o texto continua).
 *  - Nenhuma letra digitada vai para a rede: o filtro roda sobre o pacote público já baixado.
 */
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { sugerirUnidades, unidadeDaRef } from '@owbuddy/domain';
import type { PacoteRadar, RefRadar, UnidadeCatalogo } from '@owbuddy/domain';
import { fetchPacoteRadar } from '../api';
import { colors, maritime, radius, spacing, themed, typography } from '../theme';
import { useTema } from '../tema';

export function usePacoteRadar(): PacoteRadar | null {
  const [pacote, setPacote] = useState<PacoteRadar | null>(null);
  useEffect(() => {
    let vivo = true;
    fetchPacoteRadar().then((r) => { if (vivo && r) setPacote(r.pacote); }).catch(() => {});
    return () => { vivo = false; };
  }, []);
  return pacote;
}

export function CampoUnidade({ rotulo, texto, refRadar, onChange, placeholder }: {
  rotulo: string;
  texto: string;
  refRadar: RefRadar | null;
  onChange: (texto: string, ref: RefRadar | null) => void;
  placeholder?: string;
}) {
  useTema();
  const pacote = usePacoteRadar();
  const [focado, setFocado] = useState(false);
  const escolhida = pacote ? unidadeDaRef(pacote.unidades, refRadar) : null;
  const sugestoes = useMemo(
    () => (pacote && focado && !refRadar ? sugerirUnidades(pacote.unidades, texto) : []),
    [pacote, focado, refRadar, texto],
  );
  const escolher = (u: UnidadeCatalogo) => { onChange(u.nome, { id: u.id, slug: u.slug }); setFocado(false); };

  return (
    <View>
      <Text style={styles.label}>{rotulo}</Text>
      <TextInput
        style={styles.input}
        value={texto}
        onChangeText={(t) => onChange(t, null)}
        onFocus={() => setFocado(true)}
        onBlur={() => setTimeout(() => setFocado(false), 200)}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedDim}
        maxLength={80}
        autoCorrect={false}
        accessibilityLabel={rotulo}
      />
      {refRadar ? (
        <View style={styles.escolhida} accessibilityLabel="Unidade do Radar Offshore">
          <Ionicons name="checkmark-circle" size={16} color={colors.green} />
          <Text style={styles.escolhidaTexto} numberOfLines={2}>
            Radar Offshore{escolhida ? ` · ${escolhida.tipo || (escolhida.categoria === 'sonda' ? 'Sonda' : 'Unidade de produção')}` : ''}
          </Text>
          <TouchableOpacity onPress={() => onChange(texto, null)} accessibilityRole="button" accessibilityLabel="Desfazer associação com o Radar" style={styles.desfazer}>
            <Text style={styles.desfazerTexto}>Desfazer</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      {sugestoes.length ? (
        <View style={styles.lista} accessibilityLabel="Sugestões do Radar Offshore">
          {sugestoes.map((u) => (
            <TouchableOpacity key={u.id} style={styles.item} onPress={() => escolher(u)} accessibilityRole="button" accessibilityLabel={`${u.nome}, ${u.tipo || ''}`}>
              <Text style={styles.itemNome} numberOfLines={1}>{u.nome}</Text>
              <Text style={styles.itemSub} numberOfLines={1}>{[u.tipo || (u.categoria === 'sonda' ? 'Sonda' : 'Unidade de produção'), u.operador?.nome].filter(Boolean).join(' · ')}</Text>
            </TouchableOpacity>
          ))}
          <Text style={styles.rodape}>Não achou? Pode escrever o nome do seu jeito e salvar.</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  label: { ...typography.micro, marginTop: spacing.md, marginBottom: spacing.sm },
  input: {
    minHeight: 48, borderRadius: radius.md, paddingHorizontal: spacing.md, fontSize: 16, color: colors.white,
    backgroundColor: maritime.field, borderWidth: 1, borderColor: maritime.fieldBorder,
  },
  escolhida: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, minHeight: 36 },
  escolhidaTexto: { flex: 1, fontSize: 13, color: colors.muted },
  desfazer: { minHeight: 36, justifyContent: 'center', paddingHorizontal: spacing.sm },
  desfazerTexto: { fontSize: 13, fontWeight: '700', color: colors.cyanDim },
  lista: {
    marginTop: 6, borderRadius: radius.md, borderWidth: 1, borderColor: maritime.glassBorder, backgroundColor: maritime.glassElevated, overflow: 'hidden',
  },
  item: { minHeight: 52, paddingHorizontal: spacing.md, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: maritime.glassBorder, justifyContent: 'center' },
  itemNome: { fontSize: 15, fontWeight: '700', color: colors.white },
  itemSub: { fontSize: 12, color: colors.muted, marginTop: 1 },
  rodape: { fontSize: 12, color: colors.mutedDim, padding: spacing.sm, paddingHorizontal: spacing.md },
}));
