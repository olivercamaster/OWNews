import { useEffect } from 'react';
import { AppState, Platform, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors, tone } from '../src/theme';
import { instalarNotificacoes, replanejarLembretes } from '../src/notifications';
import { aoMudarDadosDoLembrete } from '../src/storage';

// Premium Material Pass: foco de campo elegante no web (borda ciano + halo fino).
// Regra única para todos os TextInput — no Android/iOS vale o foco nativo.
function instalarFocoWeb() {
  if (Platform.OS !== 'web' || typeof document === 'undefined' || document.getElementById('ow-foco')) return;
  const s = document.createElement('style');
  s.id = 'ow-foco';
  s.textContent = 'input:focus,textarea:focus{outline:none;border-color:' + tone.borderActive + '!important;box-shadow:0 0 0 3px ' + tone.accentSoft + '}' +
    'input::placeholder,textarea::placeholder{color:' + tone.textMuted + ';opacity:1}';
  document.head.appendChild(s);
}

export default function RootLayout() {
  useEffect(instalarFocoWeb, []);
  // Lembretes locais: handler + toque → rota; replaneja ao abrir, ao voltar
  // para o app e quando escala/checklist/certificados/viagem mudam.
  useEffect(() => {
    const limpar = instalarNotificacoes();
    replanejarLembretes();
    const app = AppState.addEventListener('change', s => { if (s === 'active') replanejarLembretes(); });
    const dados = aoMudarDadosDoLembrete(() => { replanejarLembretes(); });
    return () => { limpar(); app.remove(); dados(); };
  }, []);

  return (
    <View style={styles.webFrame}>
      <View style={styles.webColumn}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.navy900 },
          headerTintColor: colors.white,
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
      </Stack>
      </View>
    </View>
  );
}

// Web em monitor largo: o app continua mobile — coluna central com largura de
// celular grande, fundo navy nas laterais. No Android/iOS é um View neutro (flex:1).
const styles = StyleSheet.create({
  webFrame: Platform.OS === 'web'
    ? { flex: 1, backgroundColor: tone.bg0, alignItems: 'center' }
    : { flex: 1 },
  webColumn: Platform.OS === 'web'
    ? { flex: 1, width: '100%', maxWidth: 560, overflow: 'hidden' }
    : { flex: 1 },
});
