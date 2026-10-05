import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors } from '../src/theme';

export default function RootLayout() {
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
          name="meteorologia"
          options={{
            title: 'Meteorologia',
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
          name="escala-data-form"
          options={{
            title: 'Data Especial',
            headerStyle: { backgroundColor: colors.navy800 },
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="escala-viagem-form"
          options={{
            title: 'Viagem na Folga',
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
            title: 'Nova Escala Secundária',
            headerStyle: { backgroundColor: colors.navy800 },
            presentation: 'modal',
          }}
        />
      </Stack>
    </>
  );
}
