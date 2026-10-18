import { useEffect } from 'react';
import { AppState } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors } from '../src/theme';
import { instalarNotificacoes, replanejarLembretes } from '../src/notifications';
import { aoMudarDadosDoLembrete } from '../src/storage';

export default function RootLayout() {
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
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.navy900 },
          headerTintColor: colors.white,
          headerTitleStyle: { fontWeight: '700', color: colors.white },
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
          name="escala"
          options={{
            title: 'Minha Escala',
            headerStyle: { backgroundColor: colors.navy800 },
          }}
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
            title: 'Cruzar Escalas',
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
            title: 'Evento Pessoal',
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
      </Stack>
    </>
  );
}
