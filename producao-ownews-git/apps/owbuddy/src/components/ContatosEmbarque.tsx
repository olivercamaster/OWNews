/**
 * Contatos do embarque (aba Viagem) — logística, hotel, agência, supervisor...
 * Ligar abre o discador; WhatsApp abre a conversa (sem mensagem pronta). Nada é enviado
 * automaticamente. Tocar no contato abre a edição (onde fica o Excluir).
 */
import { useCallback, useState } from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { formatarTelefone, labelTipoContato, linkLigar, linkWhatsApp } from '@owbuddy/domain';
import type { ContatoEmbarque } from '@owbuddy/domain';
import { getContatos } from '../storage';
import { colors, maritime, radius, spacing, typography, themed } from '../theme';
import { useTema } from '../tema';
import { OWCard } from './OWCard';

function abrir(url: string | null) {
  if (url) Linking.openURL(url).catch(() => {});
}

export function ContatosEmbarque() {
  useTema();
  const [lista, setLista] = useState<ContatoEmbarque[] | null>(null);
  useFocusEffect(useCallback(() => { getContatos().then(setLista); }, []));
  if (!lista) return null;

  return (
    <OWCard style={styles.card}>
      <View style={styles.topo}>
        <Text style={styles.titulo}>Contatos do embarque</Text>
        {lista.length > 0 && (
          <TouchableOpacity onPress={() => router.push('/contato-form')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Adicionar contato" style={styles.addLink}>
            <Ionicons name="add" size={16} color={colors.cyanDim} />
            <Text style={styles.addLinkTexto}>Adicionar</Text>
          </TouchableOpacity>
        )}
      </View>

      {lista.length === 0 ? (
        <>
          <Text style={styles.vazio}>Nenhum contato ainda. Guarde aqui logística, hotel, agência ou supervisor — fica só neste aparelho.</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/contato-form')} accessibilityRole="button">
            <Ionicons name="person-add-outline" size={16} color={colors.onAccent} />
            <Text style={styles.addBtnTexto}>Adicionar contato</Text>
          </TouchableOpacity>
        </>
      ) : lista.map((c, i) => {
        const tel = linkLigar(c.telefone);
        const wa = linkWhatsApp(c.telefone);
        return (
          <View key={c.id} style={[styles.linha, i > 0 && styles.linhaBorda]}>
            <TouchableOpacity
              style={styles.info}
              onPress={() => router.push({ pathname: '/contato-form', params: { id: c.id } })}
              accessibilityRole="button"
              accessibilityLabel={`${c.nome}, ${labelTipoContato(c.tipo)}. Toque para editar.`}
            >
              <Text style={styles.tipo}>{labelTipoContato(c.tipo)}</Text>
              <Text style={styles.nome} numberOfLines={1}>{c.nome}</Text>
              <Text style={styles.tel}>{formatarTelefone(c.telefone)}</Text>
              {c.obs ? <Text style={styles.obs} numberOfLines={2}>{c.obs}</Text> : null}
            </TouchableOpacity>
            <View style={styles.acoes}>
              {tel ? (
                <TouchableOpacity style={styles.acao} onPress={() => abrir(tel)} accessibilityRole="button" accessibilityLabel={`Ligar para ${c.nome}`}>
                  <Ionicons name="call-outline" size={18} color={colors.cyanDim} />
                  <Text style={styles.acaoTexto}>Ligar</Text>
                </TouchableOpacity>
              ) : null}
              {wa ? (
                <TouchableOpacity style={styles.acao} onPress={() => abrir(wa)} accessibilityRole="button" accessibilityLabel={`WhatsApp de ${c.nome}`}>
                  <Ionicons name="logo-whatsapp" size={18} color={colors.green} />
                  <Text style={styles.acaoTexto}>WhatsApp</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        );
      })}
    </OWCard>
  );
}

const styles = themed(() => StyleSheet.create({
  card: { marginTop: spacing.md },
  topo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  titulo: { ...typography.micro, color: colors.kicker },
  addLink: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 36, paddingHorizontal: 4 },
  addLinkTexto: { color: colors.cyanDim, fontWeight: '700', fontSize: 13 },
  vazio: { fontSize: 13, color: colors.muted, lineHeight: 18, marginTop: 2 },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: colors.cyan, borderRadius: radius.md, paddingHorizontal: spacing.md, minHeight: 42, marginTop: spacing.sm },
  addBtnTexto: { color: colors.onAccent, fontWeight: '700', fontSize: 14 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  linhaBorda: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: maritime.glassBorder },
  info: { flex: 1, minWidth: 0 },
  tipo: { fontSize: 11, fontWeight: '700', color: colors.mutedDim, textTransform: 'uppercase', letterSpacing: 0.5 },
  nome: { fontSize: 15, fontWeight: '600', color: colors.white, marginTop: 1 },
  tel: { fontSize: 13, color: colors.muted, marginTop: 1 },
  obs: { fontSize: 12, color: colors.mutedDim, marginTop: 2 },
  acoes: { flexDirection: 'row', gap: 6 },
  acao: { alignItems: 'center', justifyContent: 'center', minWidth: 58, minHeight: 48, borderRadius: radius.md, borderWidth: 1, borderColor: maritime.glassBorder, backgroundColor: maritime.glass, paddingHorizontal: 6 },
  acaoTexto: { fontSize: 11, fontWeight: '600', color: colors.muted, marginTop: 2 },
}));
