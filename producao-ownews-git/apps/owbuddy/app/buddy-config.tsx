import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Switch,
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
import Constants from 'expo-constants';
import { getPreviewMensagem, DEFAULT_BUDDY_PREFS, PREFS_LEMBRETES_PADRAO } from '@owbuddy/domain';
import type { BuddyPrefs, BuddyTom, BuddyTrat, PrefsLembretes } from '@owbuddy/domain';
import { getBuddyPrefs, setBuddyPrefs } from '../src/storage';
import { colors, spacing, radius, typography, surface, maritime } from '../src/theme';
import { OWBackground } from '../src/components/OWBackground';
import { analytics } from '../src/analytics';
import { getSession, signInWithPassword, signUp, recuperarSenha, signOut, onAuthStateChange } from '../src/auth';
import { syncAll } from '../src/sync';
import {
  estadoPermissao,
  getPrefsLembretes,
  notificacoesDisponiveis,
  pedirPermissao,
  replanejarLembretes,
  setPrefsLembretes,
  type EstadoPermissao,
} from '../src/notifications';

const VERSAO_APP = Constants.expoConfig?.version ?? '';
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
  const [aviso, setAviso] = useState<string | null>(null);
  const [modoConta, setModoConta] = useState<'entrar' | 'criar'>('entrar');

  // ── Lembretes (notificações locais) ──
  const [lembretes, setLembretes] = useState<PrefsLembretes>(PREFS_LEMBRETES_PADRAO);
  const [permissao, setPermissao] = useState<EstadoPermissao>('nao_perguntada');
  const [agendados, setAgendados] = useState<number | null>(null);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);

  useEffect(() => {
    getSession().then(setSession);
    const sub = onAuthStateChange(s => setSession(s));
    return () => { sub.then(s => s.unsubscribe()); };
  }, []);

  const emailValido = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

  const sincronizarAgora = async (prefixo: string) => {
    setSyncMsg('Sincronizando…');
    setSyncLoading(true);
    const sync = await syncAll();
    setSyncLoading(false);
    setSyncMsg(sync.error ? `${prefixo}${sync.error}` : 'Escala, certificados e preferências sincronizados com a Conta OW.');
    analytics.track(sync.error ? 'sync_failed' : 'sync_completed');
  };

  const handleLogin = async () => {
    setLoginErro(null); setAviso(null);
    if (!emailValido(loginEmail)) { setLoginErro('Informe um e-mail válido.'); return; }
    if (!loginSenha) { setLoginErro('Informe a senha.'); return; }
    setLoginLoading(true);
    const { error } = await signInWithPassword(loginEmail.trim(), loginSenha);
    setLoginLoading(false);
    if (error) { setLoginErro(error); return; }
    setLoginSenha('');
    analytics.track('conta_login_senha');
    await sincronizarAgora('Você entrou, mas a sincronização falhou: ');
  };

  const handleCriar = async () => {
    setLoginErro(null); setAviso(null);
    if (!emailValido(loginEmail)) { setLoginErro('Informe um e-mail válido.'); return; }
    if (loginSenha.length < 6) { setLoginErro('A senha precisa ter pelo menos 6 caracteres.'); return; }
    setLoginLoading(true);
    const r = await signUp(loginEmail.trim(), loginSenha);
    setLoginLoading(false);
    if (r.error) { setLoginErro(r.error); return; }
    setLoginSenha('');
    analytics.track('conta_cadastro');
    if (r.precisaConfirmar) {
      setAviso('Conta criada! Confirme pelo link enviado ao seu e-mail e depois entre aqui.');
      setModoConta('entrar');
    } else {
      await sincronizarAgora('Conta criada, mas a sincronização falhou: ');
    }
  };

  const handleRecuperar = async () => {
    setLoginErro(null); setAviso(null);
    if (!emailValido(loginEmail)) { setLoginErro('Digite seu e-mail acima para receber o link.'); return; }
    setLoginLoading(true);
    const { error } = await recuperarSenha(loginEmail.trim());
    setLoginLoading(false);
    if (error) { setLoginErro(error); return; }
    analytics.track('conta_recuperar_senha');
    setAviso('Se o e-mail tiver conta, chega um link para criar uma nova senha (abre no site do OWNews).');
  };

  const handleSync = async () => {
    setSyncMsg(null);
    await sincronizarAgora('A sincronização falhou: ');
  };

  // ── Lembretes ──
  const carregarLembretes = useCallback(async () => {
    const [p, perm] = await Promise.all([getPrefsLembretes(), estadoPermissao()]);
    setLembretes(p);
    setPermissao(perm);
  }, []);

  const salvarLembretes = async (p: PrefsLembretes) => {
    setLembretes(p);
    await setPrefsLembretes(p);
    setAgendados(await replanejarLembretes());
  };

  const alternarLembretes = async (ligar: boolean) => {
    if (!ligar) {
      await salvarLembretes({ ...lembretes, ativo: false });
      analytics.track('lembretes_desativados');
      return;
    }
    const perm = await pedirPermissao();
    setPermissao(perm);
    if (perm !== 'concedida') {
      await salvarLembretes({ ...lembretes, ativo: false });
      return;
    }
    await salvarLembretes({ ...lembretes, ativo: true });
    analytics.track('lembretes_ativados');
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
    carregarLembretes();
  }, [carregarLembretes]));

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
    <OWBackground>
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
          <Text style={styles.privText}>Fica neste aparelho (e na Conta OW, se você entrar). Nunca vai para analytics.</Text>
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

        {/* ── Lembretes (notificações locais) ── */}
        <Text style={styles.sectionTitle}>Lembretes</Text>
        <View style={styles.contaCard}>
          {!notificacoesDisponiveis() ? (
            <Text style={styles.contaDesc}>Os avisos no celular chegam na versão instalada do app (não aqui no navegador). Você já pode escolher abaixo sobre o que quer ser avisado — fica salvo neste aparelho.</Text>
          ) : (
            <>
              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.switchLabel}>Lembrar no celular</Text>
                  <Text style={styles.switchSub}>Poucos avisos, criados neste aparelho. Nada é enviado a servidor.</Text>
                </View>
                <Switch
                  value={lembretes.ativo}
                  onValueChange={alternarLembretes}
                  trackColor={{ true: colors.cyan, false: colors.line }}
                  accessibilityLabel="Ativar lembretes"
                />
              </View>
              {permissao === 'negada' && (
                <View style={styles.avisoBox}>
                  <Text style={styles.avisoText}>As notificações estão bloqueadas para o OWBuddy. O app funciona normalmente; para receber lembretes, libere nas configurações do celular.</Text>
                  <TouchableOpacity onPress={() => Linking.openSettings().catch(() => {})} accessibilityRole="button">
                    <Text style={styles.linkText}>Abrir configurações</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
          {/* Categorias: separadas da Home — ocultar um card não desliga aviso, e vice-versa. */}
          {(lembretes.ativo || !notificacoesDisponiveis()) && (
            <>
              {([
                ['embarque', 'Escala', 'próximo embarque: 3 dias antes e na véspera'],
                ['viagem', 'Viagem', 'na véspera e 3 h antes'],
                ['checklist', 'Checklist', '2 dias antes do embarque, se faltar item'],
                ['certificados', 'Certificados', '30 e 7 dias antes do vencimento'],
                ['datas', 'Datas importantes', 'aniversário e curso: 7 e 1 dia antes; compromisso: 1 dia antes'],
                ['pagamento', 'Pagamento', 'conforme o aviso em Meu Pagamento (padrão 7 dias)'],
              ] as const).map(([k, label, sub]) => (
                <View key={k} style={styles.switchRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.switchLabelSm}>{label}</Text>
                    <Text style={styles.switchSub}>{sub}</Text>
                  </View>
                  <Switch
                    value={lembretes[k]}
                    onValueChange={v => salvarLembretes({ ...lembretes, [k]: v })}
                    trackColor={{ true: colors.cyan, false: colors.line }}
                    accessibilityLabel={`Lembrete: ${label}`}
                  />
                </View>
              ))}
              <Text style={styles.switchSub}>No máximo um aviso por acontecimento por dia. O texto na tela bloqueada nunca mostra nomes, destino ou detalhes.</Text>
              {notificacoesDisponiveis() && agendados != null && (
                <Text style={styles.switchSub}>{agendados === 0 ? 'Nenhum lembrete pendente agora.' : `${agendados} lembrete(s) agendado(s).`}</Text>
              )}
            </>
          )}
        </View>

        {/* ── Atalhos pessoais ── */}
        <Text style={styles.sectionTitle}>Atalhos</Text>
        <View style={styles.contaCard}>
          {([
            ['/personalizar-home', 'options-outline', 'Personalizar Home'],
            ['/pagamento', 'wallet-outline', 'Meu Pagamento'],
            ['/proximos', 'calendar-number-outline', 'Próximos dias'],
            ['/preciso-de', 'flash-outline', 'Preciso de…'],
            ['/ferramentas', 'hammer-outline', 'Ferramentas offshore'],
            ['/loja', 'storefront-outline', 'Loja OffshoreWorks'],
          ] as const).map(([rota, icone, label]) => (
            <TouchableOpacity key={rota} style={styles.atalho} onPress={() => router.push(rota)} accessibilityRole="button">
              <Ionicons name={icone} size={18} color={colors.cyanDim} />
              <Text style={styles.atalhoTexto}>{label}</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.mutedDim} />
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Conta OW (opcional) ── */}
        <Text style={styles.sectionTitle}>Conta OW <Text style={styles.opcional}>· opcional</Text></Text>
        {session ? (
          <View style={styles.contaCard}>
            <View style={styles.contaRow}>
              <Ionicons name="person-circle-outline" size={22} color={colors.cyan} />
              <Text style={styles.contaEmail} numberOfLines={1}>{session.user.email}</Text>
            </View>
            <Text style={styles.contaDesc}>
              Sincroniza escala, certificados, lista do Meu Embarque e estas preferências com o OWNews. Viagem, eventos, Cruzar e notícias ficam só neste aparelho.
            </Text>
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
            <Text style={styles.switchSub}>Sair não apaga nada deste aparelho.</Text>
          </View>
        ) : (
          <View style={styles.contaCard}>
            <Text style={styles.contaDesc}>
              O OWBuddy funciona sem conta. Com a Conta OW (a mesma do OWNews), sua escala, certificados e preferências aparecem também em outros aparelhos.
            </Text>
            <View style={styles.modoRow}>
              {(['entrar', 'criar'] as const).map(m => (
                <TouchableOpacity
                  key={m}
                  style={[styles.modoChip, modoConta === m && styles.modoChipAtivo]}
                  onPress={() => { setModoConta(m); setLoginErro(null); setAviso(null); }}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: modoConta === m }}
                >
                  <Text style={[styles.modoText, modoConta === m && styles.modoTextAtivo]}>{m === 'entrar' ? 'Entrar' : 'Criar conta'}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.loginInput}
              value={loginEmail}
              onChangeText={v => { setLoginEmail(v); setLoginErro(null); }}
              placeholder="E-mail"
              placeholderTextColor={colors.mutedDim}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="next"
              accessibilityLabel="E-mail da Conta OW"
            />
            <TextInput
              style={styles.loginInput}
              value={loginSenha}
              onChangeText={v => { setLoginSenha(v); setLoginErro(null); }}
              placeholder={modoConta === 'criar' ? 'Senha (mín. 6 caracteres)' : 'Senha'}
              placeholderTextColor={colors.mutedDim}
              secureTextEntry
              autoComplete={modoConta === 'criar' ? 'new-password' : 'current-password'}
              textContentType={modoConta === 'criar' ? 'newPassword' : 'password'}
              returnKeyType="done"
              onSubmitEditing={modoConta === 'criar' ? handleCriar : handleLogin}
              accessibilityLabel="Senha da Conta OW"
            />
            {loginErro ? <Text style={styles.loginErro}>{loginErro}</Text> : null}
            {aviso ? <Text style={styles.avisoText}>{aviso}</Text> : null}
            <TouchableOpacity
              style={styles.loginBtn}
              onPress={modoConta === 'criar' ? handleCriar : handleLogin}
              disabled={loginLoading}
              accessibilityRole="button"
              accessibilityLabel={modoConta === 'criar' ? 'Criar Conta OW' : 'Entrar na Conta OW'}
            >
              {loginLoading
                ? <ActivityIndicator size="small" color={colors.navy950} />
                : <Text style={styles.loginBtnText}>{modoConta === 'criar' ? 'Criar conta' : 'Entrar'}</Text>
              }
            </TouchableOpacity>
            {modoConta === 'entrar' && (
              <TouchableOpacity style={styles.otpBtn} onPress={handleRecuperar} disabled={loginLoading} accessibilityRole="button">
                <Text style={styles.otpBtnText}>Esqueci minha senha</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Version */}
        <View style={styles.aboutBox}>
          <Text style={styles.aboutApp}>OWBuddy</Text>
          <Text style={styles.aboutVersion}>Versão {VERSAO_APP}</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
    </OWBackground>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48 },
  switchLabel: { fontSize: 15, fontWeight: '600', color: colors.white },
  switchLabelSm: { fontSize: 14, fontWeight: '600', color: colors.white },
  switchSub: { fontSize: 12, color: colors.mutedDim, marginTop: 2, lineHeight: 16 },
  avisoBox: { gap: 6, paddingVertical: spacing.xs },
  avisoText: { fontSize: 13, color: colors.amber, lineHeight: 18 },
  linkText: { fontSize: 14, color: colors.cyan, fontWeight: '700', paddingVertical: 6 },
  opcional: { fontSize: 13, fontWeight: '400', color: colors.mutedDim },
  modoRow: { flexDirection: 'row', gap: spacing.sm },
  modoChip: { flex: 1, minHeight: 40, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  modoChipAtivo: { borderColor: colors.cyan, backgroundColor: colors.cyanFaint },
  modoText: { fontSize: 14, color: colors.muted, fontWeight: '600' },
  modoTextAtivo: { color: colors.cyan },
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
  atalho: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48 },
  atalhoTexto: { flex: 1, fontSize: 15, color: colors.white, fontWeight: '600' },
});
