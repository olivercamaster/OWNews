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
import { apagarDadosDoAparelho, getBuddyPrefs, setBuddyPrefs } from '../src/storage';
import { confirmar } from '../src/confirmar';
import { avisar } from '../src/feedback';
import { colors, spacing, radius, typography, surface, maritime, themed, tokens } from '../src/theme';
import { useTema } from '../src/tema';
import { OPCOES_APARENCIA } from '../src/aparencia';
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
  { value: 'neutro',   label: 'Sem vocativo', sub: '"Bom dia, Buddy!"' },
  { value: 'parceiro', label: 'Parceiro',      sub: 'irmão, parça, brother, bro…' },
  { value: 'parceira', label: 'Parceira',      sub: 'parceira, guerreira, campeã…' },
];

const URL_EXCLUIR_CONTA = 'https://ownews.com.br/excluir-conta';
const URL_PRIVACIDADE = 'https://ownews.com.br/privacidade';

export default function BuddyConfig() {
  const { modo: modoAparencia, setModo: setModoAparencia } = useTema();
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

  // Exclusão da Conta OW: página pública do OWNews (exige a senha de novo e apaga a
  // conta na hora, pelo servidor). Os dados deste aparelho ficam até "Apagar dados".
  const pedirExclusaoConta = () => {
    Linking.openURL(URL_EXCLUIR_CONTA).catch(() => avisar('Abra ownews.com.br/excluir-conta no navegador'));
  };

  const apagarAparelho = () => {
    confirmar(
      'Apagar dados deste aparelho?',
      'Escala, mala, documentos, viagem, contatos, datas, Meu Histórico e preferências saem deste aparelho. Não dá para desfazer. A Conta OW (se você tiver) não é apagada.',
      'Apagar tudo',
      async () => {
        await apagarDadosDoAparelho();
        await signOut();
        setSession(null);
        avisar('Dados deste aparelho apagados');
        router.replace('/');
      },
      true,
    );
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

        {/* ── Aparência: vale na hora, sem Salvar (fica neste aparelho) ── */}
        <Text style={[styles.sectionTitle, styles.sectionTitleFirst]}>Aparência</Text>
        <View style={styles.aparenciaCard} accessibilityRole="radiogroup" accessibilityLabel="Aparência do app">
          {OPCOES_APARENCIA.map((o, i) => {
            const ativo = modoAparencia === o.modo;
            return (
              <TouchableOpacity
                key={o.modo}
                style={[styles.aparenciaLinha, i > 0 && styles.aparenciaLinhaSep]}
                onPress={() => { setModoAparencia(o.modo); analytics.track('aparencia_alterada', { modo: o.modo }); }}
                accessibilityRole="radio"
                accessibilityState={{ checked: ativo }}
                aria-checked={ativo}
                accessibilityLabel={`${o.titulo}. ${o.sub}`}
                testID={`aparencia-${o.modo}`}
              >
                <View style={[styles.aparenciaIcone, ativo && styles.aparenciaIconeAtivo]}>
                  <Ionicons name={o.icone} size={18} color={ativo ? colors.cyan : colors.muted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.aparenciaTitulo, ativo && styles.aparenciaTituloAtivo]}>{o.titulo}</Text>
                  <Text style={styles.aparenciaSub}>{o.sub}</Text>
                </View>
                <View style={[styles.radio, ativo && styles.radioAtivo]}>
                  {ativo && <View style={styles.radioPonto} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

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
                  trackColor={{ true: colors.cyan, false: tokens.controlBorder }}
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
                    trackColor={{ true: colors.cyan, false: tokens.controlBorder }}
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
              Sincroniza escala, certificados e documentos (sem foto nem número), a mala e estas preferências com o OWNews. Viagem, contatos, datas, Meu Histórico, Cruzar e pagamento ficam só neste aparelho.
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
            <TouchableOpacity onPress={pedirExclusaoConta} accessibilityRole="button" style={styles.linkPerigo}>
              <Text style={styles.linkPerigoTexto}>Excluir minha Conta OW</Text>
            </TouchableOpacity>
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
                ? <ActivityIndicator size="small" color={colors.onAccent} />
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
        {/* ── Privacidade e dados ── */}
        <Text style={styles.sectionTitle}>Privacidade e dados</Text>
        <View style={styles.contaCard}>
          <Text style={styles.contaDesc}>
            Seus dados ficam neste aparelho. Com a Conta OW, só escala, certificados e documentos (sem foto nem número), a mala e estas preferências sincronizam. Viagem, contatos, datas e pagamento nunca saem daqui. Nada pessoal vai para estatísticas de uso.
          </Text>
          <TouchableOpacity onPress={() => Linking.openURL(URL_PRIVACIDADE).catch(() => {})} accessibilityRole="link" style={styles.linkLinha}>
            <Ionicons name="shield-checkmark-outline" size={16} color={colors.cyanDim} />
            <Text style={styles.linkLinhaTexto}>Política de privacidade</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={apagarAparelho} accessibilityRole="button" style={styles.linkLinha}>
            <Ionicons name="trash-outline" size={16} color={colors.red} />
            <Text style={[styles.linkLinhaTexto, { color: colors.red }]}>Apagar dados deste aparelho</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.aboutBox}>
          <Text style={styles.aboutApp}>OWBuddy</Text>
          <Text style={styles.aboutVersion}>Versão {VERSAO_APP}</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
    </OWBackground>
  );
}

const styles = themed(() => StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  sectionTitleFirst: { marginTop: 0 },
  aparenciaCard: {
    backgroundColor: maritime.glass, borderRadius: radius.lg, borderWidth: 1,
    borderColor: maritime.glassBorder, borderTopColor: maritime.edgeLight, overflow: 'hidden',
    marginBottom: spacing.lg, ...maritime.cardShadow,
  },
  aparenciaLinha: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 4, paddingHorizontal: spacing.md, minHeight: 60, paddingVertical: 10 },
  aparenciaLinhaSep: { borderTopWidth: 1, borderTopColor: colors.lineSoft },
  aparenciaIcone: {
    width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center',
    backgroundColor: maritime.iconTile, borderWidth: 1, borderColor: maritime.glassBorder,
  },
  aparenciaIconeAtivo: { backgroundColor: maritime.accentSoft, borderColor: maritime.accentBorder },
  aparenciaTitulo: { fontSize: 15, fontWeight: '600', color: colors.white },
  aparenciaTituloAtivo: { color: colors.white, fontWeight: '700' },
  aparenciaSub: { fontSize: 12.5, color: colors.muted, marginTop: 1 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: tokens.controlBorder, alignItems: 'center', justifyContent: 'center' },
  radioAtivo: { borderColor: colors.cyan },
  radioPonto: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.cyan },
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
    backgroundColor: maritime.field,
    borderRadius: radius.sm,
    padding: spacing.sm,
    paddingHorizontal: 12,
    color: colors.white,
    fontSize: 16,
    borderWidth: 1,
    borderColor: maritime.fieldBorder,
    marginBottom: spacing.xs,
  },
  privNote: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: spacing.xl },
  privText: { ...typography.small, color: colors.mutedDim },

  saveBtn: { backgroundColor: colors.cyan, borderRadius: radius.sm, padding: spacing.md, alignItems: 'center', ...maritime.botaoPrimario },
  saveBtnDone: { backgroundColor: colors.green },
  saveBtnText: { color: colors.onAccent, fontWeight: '700', fontSize: 16 },
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
  linkPerigo: { minHeight: 40, justifyContent: 'center', alignSelf: 'flex-start' },
  linkPerigoTexto: { fontSize: 13, color: colors.red, fontWeight: '600' },
  linkLinha: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  linkLinhaTexto: { fontSize: 14, color: colors.cyanDim, fontWeight: '600' },
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
    backgroundColor: maritime.field,
    borderRadius: radius.sm,
    padding: spacing.sm,
    paddingHorizontal: 12,
    color: colors.white,
    fontSize: 15,
    borderWidth: 1,
    borderColor: maritime.fieldBorder,
  },
  loginErro: { ...typography.small, color: colors.red, marginTop: -spacing.xs },
  loginBtn: {
    backgroundColor: colors.cyan,
    borderRadius: radius.sm,
    padding: spacing.sm,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  loginBtnText: { color: colors.onAccent, fontWeight: '700', fontSize: 15 },
  otpBtn: { alignItems: 'center', paddingVertical: spacing.xs },
  otpBtnText: { ...typography.small, color: colors.cyanDim },

  linkEnviadoBox: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  linkEnviadoText: { flex: 1, ...typography.small, color: colors.muted, lineHeight: 20 },
  atalho: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48 },
  atalhoTexto: { flex: 1, fontSize: 15, color: colors.white, fontWeight: '600' },
}));
