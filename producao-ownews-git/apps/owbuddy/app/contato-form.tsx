/**
 * Contato do embarque — adicionar / editar / excluir. Três campos: nome, tipo e telefone
 * (observação opcional). Local e privado: nunca sincroniza nem vai para analytics.
 */
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CONTATO_TIPOS, removerContato, salvarContato, validarContato } from '@owbuddy/domain';
import type { ContatoTipo } from '@owbuddy/domain';
import { getContatos, setContatos } from '../src/storage';
import { OWBackground } from '../src/components/OWBackground';
import { colors, maritime, radius, spacing, typography, themed } from '../src/theme';
import { useTema } from '../src/tema';
import { confirmarRemocao } from '../src/confirmar';
import { avisar } from '../src/feedback';
import { useAcaoUnica } from '../src/acoes';
import { analytics } from '../src/analytics';

export default function ContatoForm() {
  useTema();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<ContatoTipo>('LOGISTICA');
  const [telefone, setTelefone] = useState('');
  const [obs, setObs] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [existe, setExiste] = useState(false);

  useEffect(() => {
    if (!id) return;
    getContatos().then(l => {
      const c = l.find(x => x.id === id);
      if (!c) return;
      setExiste(true);
      setNome(c.nome); setTipo(c.tipo); setTelefone(c.telefone); setObs(c.obs ?? '');
    });
  }, [id]);

  const voltar = () => (router.canGoBack() ? router.back() : router.replace('/viagem'));

  const [salvar, salvando] = useAcaoUnica(async () => {
    const msg = validarContato({ nome, telefone });
    if (msg) { setErro(msg); return; }
    const lista = await getContatos();
    await setContatos(salvarContato(lista, { id: existe ? id : undefined, nome, tipo, telefone, obs }));
    analytics.track(existe ? 'contact_updated' : 'contact_created');
    avisar(existe ? 'Contato atualizado' : 'Contato salvo');
    voltar();
  });

  const excluir = () => {
    if (!id) return;
    confirmarRemocao('Excluir este contato?', `${nome || 'O contato'} sai da sua lista.`, async () => {
      await setContatos(removerContato(await getContatos(), id));
      analytics.track('contact_deleted');
      avisar('Contato excluído');
      voltar();
    });
  };

  return (
    <OWBackground showWatermark={false}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Nome</Text>
          <TextInput style={styles.input} value={nome} onChangeText={t => { setNome(t); setErro(null); }} placeholder="Ex.: Logística Macaé" placeholderTextColor={colors.mutedDim} maxLength={50} accessibilityLabel="Nome do contato" />

          <Text style={styles.label}>Tipo</Text>
          <View style={styles.chips}>
            {CONTATO_TIPOS.map(t => (
              <TouchableOpacity key={t.value} style={[styles.chip, tipo === t.value && styles.chipAtivo]} onPress={() => setTipo(t.value)} accessibilityRole="radio" accessibilityState={{ selected: tipo === t.value }}>
                <Text style={[styles.chipTexto, tipo === t.value && styles.chipTextoAtivo]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Telefone</Text>
          <TextInput style={styles.input} value={telefone} onChangeText={t => { setTelefone(t); setErro(null); }} placeholder="(22) 99999-1234" placeholderTextColor={colors.mutedDim} keyboardType="phone-pad" maxLength={20} accessibilityLabel="Telefone" />

          <Text style={styles.label}>Observação (opcional)</Text>
          <TextInput style={styles.input} value={obs} onChangeText={setObs} placeholder="Ex.: falar com a Carla, 7h às 17h" placeholderTextColor={colors.mutedDim} maxLength={80} accessibilityLabel="Observação" />

          {erro ? (
            <View style={styles.erro} accessibilityRole="alert">
              <Ionicons name="alert-circle-outline" size={16} color={colors.amber} />
              <Text style={styles.erroTexto}>{erro}</Text>
            </View>
          ) : null}

          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={voltar} accessibilityRole="button"><Text style={styles.cancelText}>Cancelar</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.saveBtn, salvando && { opacity: 0.6 }]} onPress={salvar} disabled={salvando} accessibilityRole="button">
              <Text style={styles.saveText}>{salvando ? 'Salvando…' : 'Salvar contato'}</Text>
            </TouchableOpacity>
          </View>

          {existe ? (
            <TouchableOpacity style={styles.deleteBtn} onPress={excluir} accessibilityRole="button">
              <Ionicons name="trash-outline" size={16} color={colors.red} />
              <Text style={styles.deleteText}>Excluir contato</Text>
            </TouchableOpacity>
          ) : null}

          <View style={styles.privRow}>
            <Ionicons name="lock-closed-outline" size={11} color={colors.mutedDim} />
            <Text style={styles.priv}>Fica só neste aparelho. Não sincroniza e não é enviado a ninguém.</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </OWBackground>
  );
}

const styles = themed(() => StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  label: { ...typography.small, marginBottom: 4, marginTop: spacing.sm },
  input: { backgroundColor: maritime.field, borderRadius: radius.sm, padding: spacing.sm, paddingHorizontal: 12, color: colors.white, fontSize: 15, borderWidth: 1, borderColor: maritime.fieldBorder, minHeight: 44 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { paddingHorizontal: 12, minHeight: 38, justifyContent: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: maritime.glassBorder, backgroundColor: maritime.glass },
  chipAtivo: { borderColor: colors.cyan, backgroundColor: maritime.glassActive },
  chipTexto: { fontSize: 13, fontWeight: '600', color: colors.muted },
  chipTextoAtivo: { color: colors.cyan },
  erro: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm },
  erroTexto: { color: colors.amber, fontSize: 13, fontWeight: '600', flex: 1 },
  btnRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  cancelBtn: { flex: 1, padding: spacing.md, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, alignItems: 'center' },
  cancelText: { color: colors.muted, fontWeight: '600' },
  saveBtn: { flex: 2, padding: spacing.md, borderRadius: radius.sm, backgroundColor: colors.cyan, alignItems: 'center' },
  saveText: { color: colors.onAccent, fontWeight: '700' },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, marginTop: spacing.md },
  deleteText: { color: colors.red, fontWeight: '600', fontSize: 14 },
  privRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: spacing.md },
  priv: { fontSize: 12, color: colors.mutedDim, flexShrink: 1, textAlign: 'center' },
}));
