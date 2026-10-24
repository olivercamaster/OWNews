import { Platform, Text, View, useWindowDimensions, type ColorValue } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, maritime, radius, tokens } from '../../src/theme';
import { useTema } from '../../src/tema';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({ name, focused }: { name: IoniconsName; focused: boolean }) {
  useTema();
  return (
    <View style={{ alignItems: 'center' }}>
      {/* Aba ativa: filete de luz ambiente na aresta da barra (cockpit), sem glow em volta do ícone */}
      {focused ? (
        <View
          style={{
            position: 'absolute', top: -9, width: 18, height: 2, borderRadius: 1,
            backgroundColor: tokens.navigationActive,
            shadowColor: tokens.navigationActive, shadowOffset: { width: 0, height: 0 },
            shadowOpacity: maritime.progressGlow, shadowRadius: 4,
          }}
        />
      ) : null}
      <Ionicons
        name={focused ? name : (`${name}-outline` as IoniconsName)}
        size={24}
        color={focused ? tokens.navigationActive : tokens.navigationInactive}
      />
    </View>
  );
}

// Largura útil da barra. Web: o app vive na coluna de 560 px (app/_layout.tsx).
function larguraApp(width: number): number {
  return Platform.OS === 'web' ? Math.min(width, 560) : width;
}

/**
 * Rótulo que cabe inteiro ("Certificados") de 320 a 430 dp. A fonte sai da largura REAL
 * de cada aba (5 abas) — igual em Android, iOS e web; adjustsFontSizeToFit fica como rede
 * extra no nativo (na web ele não existe). Um View com a largura da aba devolve ao texto o padding
 * interno de 5 px do item do react-navigation, que sobrava vazio.
 */
function TabLabel({ children, color }: { children: string; color: ColorValue }) {
  useTema();
  const { width } = useWindowDimensions();
  const larg = larguraApp(width);
  const aba = (larg - 2 * margemBarra(larg) - 2) / 5;
  const fontSize = Math.max(8.5, Math.min(11, Math.floor((aba / 6.9) * 2) / 2));
  return (
    <View style={{ width: Math.floor(aba), alignSelf: 'center', alignItems: 'center' }}>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        allowFontScaling={false}
        style={{ color, fontSize, lineHeight: 14, fontWeight: '600', textAlign: 'center' }}
      >
        {children}
      </Text>
    </View>
  );
}

function margemBarra(larg: number): number {
  return larg < 340 ? 4 : 8;
}

export default function TabLayout() {
  useTema();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const margem = margemBarra(larguraApp(width));
  const bottomSafe = Math.max(insets.bottom, 8);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: tokens.navigationActive,
        tabBarInactiveTintColor: tokens.navigationInactive,
        tabBarStyle: {
          // Nav flutuante — preto azulado quase opaco, linha fina fria, sem glow
          // (Premium Material Pass). Ativo = ciano OW; inativo = cinza azulado.
          // As telas reservam `bottomNavSpace(insets.bottom)` no fim do scroll para
          // que ela nunca cubra conteúdo (Android + iOS).
          position: 'absolute',
          backgroundColor: maritime.navBg,
          borderWidth: 1,
          borderTopWidth: 1,
          borderColor: maritime.navBorder,
          borderTopColor: maritime.edgeLight,
          marginHorizontal: margem,
          marginBottom: bottomSafe + maritime.navMarginBottom,
          borderRadius: radius.xl,
          height: maritime.navHeight,
          paddingBottom: 8,
          paddingTop: 6,
          paddingHorizontal: 0,
          // Sombra por tema: profunda no escuro, quase só contato no claro
          ...maritime.navShadow,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          lineHeight: 14,
          fontWeight: '600',
          letterSpacing: 0,
        },
        tabBarItemStyle: { paddingHorizontal: 0 },
        tabBarLabel: ({ children, color }) => <TabLabel color={color}>{children}</TabLabel>,
        tabBarAllowFontScaling: false,
        // Stack header style — gradient background (no LinearGradient in header, use solid)
        headerStyle: { backgroundColor: colors.navy900 },
        headerTintColor: colors.white,
        headerTitleStyle: { fontWeight: '700' },
        headerShadowVisible: false,
        // Use Platform-specific blur on iOS if desired — keep simple for now
        tabBarBackground: undefined,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          headerShown: false,
          title: 'Início',
          tabBarIcon: ({ focused }) => <TabIcon name="home" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="escala"
        options={{
          title: 'Escala',
          headerTitle: 'Minha Escala',
          tabBarIcon: ({ focused }) => <TabIcon name="calendar" focused={focused} />,
          headerStyle: { backgroundColor: colors.navy900 },
        }}
      />
      <Tabs.Screen
        name="mala"
        options={{
          title: 'Embarque',
          tabBarIcon: ({ focused }) => <TabIcon name="checkbox" focused={focused} />,
          headerStyle: { backgroundColor: colors.navy900 },
        }}
      />
      <Tabs.Screen
        name="viagem"
        options={{
          title: 'Viagem',
          tabBarIcon: ({ focused }) => <TabIcon name="airplane" focused={focused} />,
          headerStyle: { backgroundColor: colors.navy900 },
        }}
      />
      <Tabs.Screen
        name="certs"
        options={{
          title: 'Certificados',
          headerTitle: 'Certificados e documentos',
          tabBarIcon: ({ focused }) => <TabIcon name="document-text" focused={focused} />,
          headerStyle: { backgroundColor: colors.navy900 },
        }}
      />
      <Tabs.Screen
        name="loja"
        options={{
          title: 'Loja',
          // OWBuddy 1.0: Loja fora da barra (as 5 posições são da ferramenta pessoal).
          // A rota /loja continua existindo — acesso pelo link secundário da Home.
          href: null,
          headerShown: false,
        }}
      />
    </Tabs>
  );
}
