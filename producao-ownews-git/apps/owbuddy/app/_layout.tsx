import { useEffect, useMemo } from 'react';
import { AppState, Platform, StyleSheet, View } from 'react-native';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, type Theme } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { colors, tone, themed } from '../src/theme';
import { TemaProvider, useTema } from '../src/tema';
import { estiloStatusBar } from '../src/aparencia';
import { instalarNotificacoes, replanejarLembretes } from '../src/notifications';
import { aoMudarDadosDoLembrete } from '../src/storage';
import { OWToastHost } from '../src/feedback';
import { analytics } from '../src/analytics';
import { aoMudarAcessoPlus, useIniciarPlus } from '../src/plus/acesso';

// Premium Material Pass: foco de campo elegante no web (borda ciano + halo fino).
// Regra única para todos os TextInput — no Android/iOS vale o foco nativo.
// Recalculada a cada troca de tema (tokens do tema ativo).
function instalarFocoWeb() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  let s = document.getElementById('ow-foco');
  if (!s) {
    s = document.createElement('style');
    s.id = 'ow-foco';
    document.head.appendChild(s);
  }
  s.textContent = 'input:focus,textarea:focus{outline:none;border-color:' + tone.borderActive + '!important;box-shadow:0 0 0 3px ' + tone.accentSoft + '}' +
    'input::placeholder,textarea::placeholder{color:' + tone.textMuted + ';opacity:1}';
}

// Nativo: segura o splash até ler a aparência salva (sem piscar o tema errado ao abrir).
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  return (
    <TemaProvider>
      <AppShell />
    </TemaProvider>
  );
}

/** Tema da navegação (fundo atrás das transições, cards de modal, cabeçalhos) = tokens do app. */
function temaNavegacao(tema: 'escuro' | 'claro'): Theme {
  const base = tema === 'claro' ? DefaultTheme : DarkTheme;
  return {
    ...base,
    dark: tema === 'escuro',
    colors: {
      ...base.colors,
      primary: colors.cyan,
      background: colors.navy950,
      card: colors.navy900,
      text: colors.white,
      border: colors.lineSoft,
      notification: colors.red,
    },
  };
}

function AppShell() {
  const { tema, pronto } = useTema();
  const navTema = useMemo(() => temaNavegacao(tema), [tema]);
  useEffect(instalarFocoWeb, [tema]);
  useEffect(() => {
    if (pronto) SplashScreen.hideAsync().catch(() => {});
  }, [pronto]);
  // Rede de segurança: nunca deixar o splash preso se a leitura do armazenamento travar.
  useEffect(() => {
    const t = setTimeout(() => { SplashScreen.hideAsync().catch(() => {}); }, 2500);
    return () => clearTimeout(t);
  }, []);
  // Lembretes locais: handler + toque → rota; replaneja ao abrir, ao voltar
  // para o app e quando escala/checklist/certificados/viagem mudam.
  useEffect(() => {
    const limpar = instalarNotificacoes();
    replanejarLembretes();
    analytics.track('app_open');
    const app = AppState.addEventListener('change', s => { if (s === 'active') { replanejarLembretes(); analytics.track('app_open'); } });
    const dados = aoMudarDadosDoLembrete(() => { replanejarLembretes(); });
    // OWBuddy+ mudou (confirmado, terminou, voltou): lembretes de mala/viagem/documentos acompanham.
    const plus = aoMudarAcessoPlus(() => { replanejarLembretes(); });
    return () => { limpar(); app.remove(); dados(); plus(); };
  }, []);
  // OWBuddy+: lê a última confirmação e consulta a loja (uma camada só para o app inteiro).
  useIniciarPlus();

  return (
    <View style={styles.webFrame}>
      <View style={styles.webColumn}>
      <StatusBar style={estiloStatusBar(tema)} />
      <ThemeProvider value={navTema}>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.navy900 },
          headerTintColor: colors.white,
          // Telas empilhadas e modais: mesmo fundo do tema (nunca "app claro + modal escuro").
          headerTitleStyle: { fontWeight: '700', color: colors.white },
          // Sem a linha clara padrão sob o cabeçalho: separação tonal (Premium Material Pass).
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.navy950 },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="buddy-config"
          options={{
            title: 'Meu Buddy',
            presentation: 'modal',
            headerStyle: { backgroundColor: colors.navy800 },
          }}
        />
        <Stack.Screen
          name="escala-config"
          options={{
            title: 'Minha Escala',
            headerStyle: { backgroundColor: colors.navy800 },
          }}
        />
        <Stack.Screen
          name="noticias"
          options={{
            title: 'Notícias Offshore',
            headerStyle: { backgroundColor: colors.navy800 },
          }}
        />
        <Stack.Screen
          name="vagas"
          options={{
            title: 'Vagas Verificadas',
            headerStyle: { backgroundColor: colors.navy800 },
          }}
        />
        <Stack.Screen
          name="aeroportos"
          options={{
            title: 'Aeroportos',
            headerStyle: { backgroundColor: colors.navy800 },
          }}
        />
        <Stack.Screen
          name="ferramentas"
          options={{
            title: 'Ferramentas Offshore',
            headerStyle: { backgroundColor: colors.navy800 },
          }}
        />
        <Stack.Screen
          name="noticia/[id]"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="escala-excecao-form"
          options={{
            title: 'Adicionar Dobra / Férias',
            headerStyle: { backgroundColor: colors.navy800 },
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="escala-cruzar"
          options={{
            title: 'Escalas cruzadas',
            headerStyle: { backgroundColor: colors.navy800 },
          }}
        />
        <Stack.Screen
          name="escala-secundaria-form"
          options={{
            title: 'Escala secundária',
            headerStyle: { backgroundColor: colors.navy800 },
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="escala-evento-form"
          options={{
            title: 'Lembrar de algo',
            headerStyle: { backgroundColor: colors.navy800 },
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="unidades"
          options={{
            title: 'Radar de Unidades',
            headerStyle: { backgroundColor: colors.navy800 },
          }}
        />
        <Stack.Screen
          name="unidade/[slug]"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="proximos"
          options={{
            title: 'Próximos dias',
            headerStyle: { backgroundColor: colors.navy800 },
          }}
        />
        <Stack.Screen
          name="pagamento"
          options={{
            title: 'Meu Pagamento',
            headerStyle: { backgroundColor: colors.navy800 },
          }}
        />
        <Stack.Screen
          name="presentes"
          options={{
            title: 'Ideias de presente',
            headerStyle: { backgroundColor: colors.navy800 },
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="preciso-de"
          options={{
            title: 'Preciso de…',
            headerStyle: { backgroundColor: colors.navy800 },
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="personalizar-home"
          options={{
            title: 'Personalizar Home',
            headerStyle: { backgroundColor: colors.navy800 },
          }}
        />
        <Stack.Screen
          name="historico"
          options={{
            title: 'Meu Histórico',
            headerStyle: { backgroundColor: colors.navy800 },
          }}
        />
        <Stack.Screen
          name="historico-registro"
          options={{
            title: 'Embarque',
            headerStyle: { backgroundColor: colors.navy800 },
          }}
        />
        <Stack.Screen
          name="historico-form"
          options={{
            title: 'Registrar embarque',
            headerStyle: { backgroundColor: colors.navy800 },
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="historico-acontecimento"
          options={{
            title: 'Acontecimento',
            headerStyle: { backgroundColor: colors.navy800 },
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="owbuddy-plus"
          options={{
            title: 'OWBuddy Premium',
            headerStyle: { backgroundColor: colors.navy800 },
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="contato-form"
          options={{
            title: 'Contato do embarque',
            headerStyle: { backgroundColor: colors.navy800 },
            presentation: 'modal',
          }}
        />
      </Stack>
      <OWToastHost />
      </ThemeProvider>
      </View>
    </View>
  );
}

// Web em monitor largo: o app continua mobile — coluna central com largura de
// celular grande, fundo navy nas laterais. No Android/iOS é um View neutro (flex:1).
const styles = themed(() => StyleSheet.create({
  webFrame: Platform.OS === 'web'
    ? { flex: 1, backgroundColor: tone.bg0, alignItems: 'center' }
    : { flex: 1 },
  webColumn: Platform.OS === 'web'
    ? { flex: 1, width: '100%', maxWidth: 560, overflow: 'hidden' }
    : { flex: 1 },
}));
