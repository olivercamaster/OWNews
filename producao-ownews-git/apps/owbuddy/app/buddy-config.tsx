import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getPreviewMensagem, DEFAULT_BUDDY_PREFS } from '@owbuddy/domain';
import type { BuddyPrefs, BuddyTom, BuddyTrat } from '@owbuddy/domain';
import { getBuddyPrefs, setBuddyPrefs } from '../src/storage';
import { colors, spacing, radius, typography, surface } from '../src/theme';
import { analytics } from '../src/analytics';
import { getSession, signInWithPassword, signInWithEmail, signOut, onAuthStateChange } from '../src/auth';
import { syncAll } from '../src/sync';
import type { Session } from '@supabase/supabase-js';

// UI labels — mapped from internal domain values, backwards-compatible
const ESTILOS: { value: BuddyTom; label: string; desc: string }[] = [
  { value: 'discreto', label: 'Direto',    desc: 'Objetivo e sem muita conversa.' },
  { value: 'buddy',    label: 'Parceiro',  desc: 'Próximo, natural e amigável.' },
  { value: 'resenha',  label: 'Resenha',   desc: 'Mais descontraído, com resenha leve.' },
];

const TRATS: { value: BuddyTrat; label: string; sub: string }[] = [
  { value: 'neutro',   label: 'Sem vocativo', sub: 'sem "parceiro" ou "parceira"' },
  { value: 'parceiro', label: 'Parceiro',      sub: 'vocativo masculino' },
  { value: 'parceira', label: 'Parceira',      sub: 'vocativo feminino' },
];

export default function BuddyConfig() {
  const [prefs, setPrefs] = useState<BuddyPrefs>(DEFAULT_BUDDY_PREFS);
  const [saved, setSaved] = useState(false);

  // ── Conta OW ──────────────────────────────────────────────────────────────
  const [session, setSession] = useState<Session | null>(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginSenha, setLoginSenha] = useState('');
  const [loginErro, setLoginErro] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [linkEnviado, setLinkEnviado] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);

  useEffect(() => {
    getSession().then(setSession);
    const sub = onAuthStateChange(s => setSession(s));
    return () => { sub.then(s => s.unsubscribe()); };
  }, []);

  const handleLogin = async () => {
    setLoginErro(null);
    if (!loginEmail.trim()) { setLoginErro('Informe o e-mail.'); return; }
    if (!loginSenha.trim()) { setLoginErro('Informe a senha.'); return; }
    setLoginLoading(true);
    const { error } = await signInWithPassword(loginEmail.trim(), loginSenha);
    setLoginLoading(false);
    if (error) { setLoginErro('E-mail ou senha incorretos.'); return; }
    analytics.track('conta_login_senha');
    setSyncMsg('Sincronizando dados…');
    setSyncLoading(true);
    const sync = await syncAll();
    setSyncLoading(false);
    setSyncMsg(sync.error ? 'Login feito. Sync falhou: ' + sync.error : 'Dados sincronizados.');
  };

  const handleLinkMagico = async () => {
    setLoginErro(null);
    if (!loginEmail.trim()) { setLoginErro('Informe o e-mail para receber o link.'); return; }
    setLoginLoading(true);
    const { error } = await signInWithEmail(loginEmail.trim());
    setLoginLoading(false);
    if (error) { setLoginErro(error); return; }
    analytics.track('conta_login_otp');
    setLinkEnviado(true);
  };

  const handleSync = async () => {
    setSyncMsg(null);
    setSyncLoading(true);
    const { error } = await syncAll();
    setSyncLoading(false);
    setSyncMsg(error ? 'Sync falhou: ' + error : 'Dados sincronizados com a conta OW.');
  };

  const handleSair = async () => {
    await signOut();
    setSession(null);
    setSyncMsg(null);
    analytics.track('conta_logout');
  };
  // ──────────────────────────────────────────────────────────────────────────

  useFocusEffect(useCallback(() => {
    getBuddyPrefs().then(setPrefs);
    setSaved(false);
  }, []));

  const update = (partial: Partial<BuddyPrefs>) => {
    setPrefs(p => ({ ...p, ...partial }));
    setSaved(false);
  };

  const save = async () => {
    await setBuddyPrefs(prefs);
    analytics.track('buddy_prefs_saved');
    setSaved(true);
    setTimeout(() => router.back(), 600);
  };

  const preview = getPreviewMensagem(prefs, 3);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.root} contentContainerStyle={styles.content}>

        {/* Preview */}
        <View style={styles.previewCard}>
          <Text style={styles.previewLabel}>Prévia da mensagem</Text>
          <Text style={styles.previewMsg}>{preview || 'Configure abaixo para ver a prévia.'}</Text>
        </View>

        {/* Estilo */}
        <Text style={styles.sectionTitle}>Como você quer que o Buddy fale com você?</Text>
        <View style={styles.options}>
          {ESTILOS.map(t => (
            <TouchableOpacity
              key={t.value}
              style={[styles.optionCard, prefs.tom === t.value && styles.optionCardActive]}
              onPress={() => update({ tom: t.value })}
              accessibilityRole="radio"
              accessibilityState={{ checked: prefs.tom === t.value }}
            >
              <View style={styles.optionRow}>
                <Text style={[styles.optionTitle, prefs.tom === t.value && styles.optionTitleActive]}>
                  {t.label}
                </Text>
                {prefs.tom === t.value && <Ionicons name="checkmark-circle" size={18} color={colors.cyan} />}
              </View>
              <Text style={styles.optionDesc}>{t.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tratamento */}
        <Text style={styles.sectionTitle}>Como o Buddy pode falar com você?</Text>
        <Text style={styles.sectionNote}>Você escolhe — o Buddy nunca infere gênero.</Text>
        <View style={styles.tratRow}>
          {TRATS.map(t => (
            <TouchableOpacity
              key={t.value}
              style={[styles.tratChip, prefs.trat === t.value && styles.tratChipActive]}
              onPress={() => update({ trat: t.value })}
              accessibilityRole="radio"
              accessibilityState={{ checked: prefs.trat === t.value }}
            >
              <Text style={[styles.tratLabel, prefs.trat === t.value && styles.tratLabelActive]}>
                {t.label}
              </Text>
              <Text style={styles.tratSub}>{t.sub}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Apelido */}
        <Text style={styles.sectionTitle}>Como posso te chamar? (opcional)</Text>
        <TextInput
          style={styles.apelidoInput}
          value={prefs.apelido}
          onChangeText={v => update({ apelido: v })}
          placeholder="Seu apelido ou nome"
          placeholderTextColor={colors.mutedDim}
          maxLength={24}
          returnKeyType="done"
          accessibilityLabel="Apelido para o Buddy usar"
        />
        <View style={styles.privNote}>
          <Ionicons name="lock-closed-outline" size={12} color={colors.mutedDim} />
          <Text style={styles.privText}>Guardado só neste dispositivo. Não vai a analytics.</Text>
        </View>

        {/* Save */}
        <TouchableOpacity
          style={[styles.saveBtn, saved && styles.saveBtnDone]}
          onPress={save}
          accessibilityRole="button"
          accessibilityLabel="Salvar preferências"
        >
          <Text style={styles.saveBtnText}>{saved ? 'Salvo ✓' : 'Salvar preferências'}</Text>
        </TouchableOpacity>

        {/* ── Conta OW ── */}
        <Text style={styles.sectionTitle}>Conta OW</Text>
        {session ? (
          <View style={styles.contaCard}>
            <View style={styles.contaRow}>
              <Ionicons name="person-circle-outline" size={22} color={colors.cyan} />
              <Text style={styles.contaEmail} numberOfLines={1}>{session.user.email}</Text>
            </View>
            {syncMsg ? (
              <Text style={[styles.syncMsg, syncLoading && styles.syncMsgLoading]}>{syncMsg}</Text>
            ) : null}
            <View style={styles.contaAcoes}>
              <TouchableOpacity
                style={styles.syncBtn}
                onPress={handleSync}
                disabled={syncLoading}
                accessibilityLabel="Sincronizar dados com a conta OW"
              >
                {syncLoading
                  ? <ActivityIndicator size="small" color={colors.cyan} />
                  : <><Ionicons name="sync-outline" size={15} color={colors.cyan} /><Text style={styles.syncBtnText}>Sincronizar</Text></>
                }
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.sairBtn}
                onPress={handleSair}
                accessibilityLabel="Sair da conta OW"
              >
                <Text style={styles.sairBtnText}>Sair</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.contaCard}>
            {linkEnviado ? (
              <View style={styles.linkEnviadoBox}>
                <Ionicons name="mail-outline" size={22} color={colors.cyan} />
                <Text style={styles.linkEnviadoText}>
                  Link de acesso enviado para {loginEmail}. Verifique seu e-mail.
                </Text>
              </View>
            ) : (
              <>
                <Text style={styles.contaDesc}>
                  Sincronize sua escala, certificados e preferências com a sua conta OWNews em outros dispositivos.
                </Text>
                <TextInput
                  style={styles.loginInput}
                  value={loginEmail}
                  onChangeText={v => { setLoginEmail(v); setLoginErro(null); }}
                  placeholder="E-mail"
                  placeholderTextColor={colors.mutedDim}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                />
                <TextInput
                  style={styles.loginInput}
                  value={loginSenha}
                  onChangeText={v => { setLoginSenha(v); setLoginErro(null); }}
                  placeholder="Senha"
                  placeholderTextColor={colors.mutedDim}
                  secureTextEntry
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                />
                {loginErro ? <Text style={styles.loginErro}>{loginErro}</Text> : null}
                <TouchableOpacity
                  style={styles.loginBtn}
                  onPress={handleLogin}
                  disabled={loginLoading}
                  accessibilityLabel="Entrar na conta OW"
                >
                  {loginLoading
                    ? <ActivityIndicator size="small" color={colors.navy950} />
                    : <Text style={styles.loginBtnText}>Entrar</Text>
                  }
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.otpBtn}
                  onPress={handleLinkMagico}
                  disabled={loginLoading}
                  accessibilityLabel="Receber link de acesso por e-mail"
                >
                  <Text style={styles.otpBtnText}>Entrar via link mágico</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* Version */}
        <View style={styles.aboutBox}>
          <Text style={styles.aboutApp}>OWBuddy</Text>
          <Text style={styles.aboutVersion}>Versão 0.1.4 · Build 6</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: surface.header },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },

  previewCard: {
    backgroundColor: surface.elevated,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderLeftWidth: 2,
    borderLeftColor: colors.cyan,
  },
  previewLabel: { ...typography.micro, marginBottom: spacing.xs },
  previewMsg: { ...typography.body, fontStyle: 'italic', lineHeight: 22 },

  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.white,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  sectionNote: { ...typography.small, color: colors.mutedDim, marginBottom: spacing.sm, marginTop: -spacing.xs },

  options: { gap: spacing.sm },
  optionCard: {
    backgroundColor: surface.elevated,
    borderRadius: radius.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
  },
  optionCardActive: { borderColor: colors.cyan },
  optionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  optionTitle: { ...typography.h3 },
  optionTitleActive: { color: colors.cyan },
  optionDesc: { ...typography.small },

  tratRow: { gap: spacing.sm },
  tratChip: {
    padding: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: surface.elevated,
  },
  tratChipActive: { borderColor: colors.cyan },
  tratLabel: { fontSize: 14, color: colors.muted, fontWeight: '600', marginBottom: 2 },
  tratLabelActive: { color: colors.cyan },
  tratSub: { ...typography.small, color: colors.mutedDim },

  apelidoInput: {
    backgroundColor: surface.elevated,
    borderRadius: radius.sm,
    padding: spacing.sm,
    paddingHorizontal: 12,
    color: colors.white,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: spacing.xs,
  },
  privNote: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: spacing.xl },
  privText: { ...typography.small, color: colors.mutedDim },

  saveBtn: { backgroundColor: colors.cyan, borderRadius: radius.sm, padding: spacing.md, alignItems: 'center' },
  saveBtnDone: { backgroundColor: colors.green },
  saveBtnText: { color: colors.navy950, fontWeight: '700', fontSize: 16 },
  aboutBox: { alignItems: 'center', marginTop: spacing.xl, paddingBottom: spacing.sm },
  aboutApp: { fontSize: 13, fontWeight: '700', color: colors.mutedDim },
  aboutVersion: { fontSize: 11, color: colors.mutedDim, marginTop: 2 },

  contaCard: {
    backgroundColor: surface.elevated,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.line,
  },
  contaDesc: { ...typography.small, color: colors.muted, lineHeight: 20 },
  contaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  contaEmail: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.white },
  contaAcoes: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  syncBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, borderWidth: 1, borderColor: colors.cyan, borderRadius: radius.sm, padding: 10,
  },
  syncBtnText: { ...typography.small, color: colors.cyan, fontWeight: '600' },
  sairBtn: {
    paddingHorizontal: spacing.md, paddingVertical: 10,
    borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line,
  },
  sairBtnText: { ...typography.small, color: colors.muted },
  syncMsg: { ...typography.small, color: colors.cyan },
  syncMsgLoading: { color: colors.mutedDim },

  loginInput: {
    backgroundColor: surface.card,
    borderRadius: radius.sm,
    padding: spacing.sm,
    paddingHorizontal: 12,
    color: colors.white,
    fontSize: 15,
    borderWidth: 1,
    borderColor: colors.line,
  },
  loginErro: { ...typography.small, color: colors.red, marginTop: -spacing.xs },
  loginBtn: {
    backgroundColor: colors.cyan,
    borderRadius: radius.sm,
    padding: spacing.sm,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  loginBtnText: { color: colors.navy950, fontWeight: '700', fontSize: 15 },
  otpBtn: { alignItems: 'center', paddingVertical: spacing.xs },
  otpBtnText: { ...typography.small, color: colors.cyanDim },

  linkEnviadoBox: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  linkEnviadoText: { flex: 1, ...typography.small, color: colors.muted, lineHeight: 20 },
});
