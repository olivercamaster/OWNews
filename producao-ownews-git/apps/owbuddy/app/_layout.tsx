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
      </Stack>
    </>
  );
}
