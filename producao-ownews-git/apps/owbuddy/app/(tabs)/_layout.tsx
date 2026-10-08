import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, maritime, radius } from '../../src/theme';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({ name, focused }: { name: IoniconsName; focused: boolean }) {
  return (
    <Ionicons
      name={focused ? name : (`${name}-outline` as IoniconsName)}
      size={24}
      color={focused ? colors.cyan : colors.mutedDim}
    />
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const bottomSafe = Math.max(insets.bottom, 8);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.cyan,
        tabBarInactiveTintColor: colors.mutedDim,
        tabBarStyle: {
          // Nav flutuante — quase opaca (contraste garantido), borda fina luminosa.
          // As telas reservam `bottomNavSpace(insets.bottom)` no fim do scroll para
          // que ela nunca cubra conteúdo (Android + iOS).
          position: 'absolute',
          backgroundColor: maritime.navBg,
          borderTopWidth: 0,
          borderWidth: 1,
          borderColor: maritime.navBorder,
          marginHorizontal: 16,
          marginBottom: bottomSafe + maritime.navMarginBottom,
          borderRadius: radius.xl,
          height: maritime.navHeight,
          paddingBottom: 10,
          paddingTop: 8,
          paddingHorizontal: 8,
          // Elevation (Android)
          elevation: 16,
          // Shadow (iOS)
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.4,
          shadowRadius: 12,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          letterSpacing: 0.2,
        },
        // Stack header style — gradient background (no LinearGradient in header, use solid)
        headerStyle: { backgroundColor: '#08283a' },
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
        name="mala"
        options={{
          title: 'Embarque',
          tabBarIcon: ({ focused }) => <TabIcon name="checkbox" focused={focused} />,
          headerStyle: { backgroundColor: '#07223a' },
        }}
      />
      <Tabs.Screen
        name="viagem"
        options={{
          title: 'Viagem',
          tabBarIcon: ({ focused }) => <TabIcon name="airplane" focused={focused} />,
          headerStyle: { backgroundColor: '#07223a' },
        }}
      />
      <Tabs.Screen
        name="certs"
        options={{
          title: 'Certificados',
          tabBarIcon: ({ focused }) => <TabIcon name="document-text" focused={focused} />,
          headerStyle: { backgroundColor: '#07223a' },
        }}
      />
      <Tabs.Screen
        name="loja"
        options={{
          title: 'Loja',
          tabBarIcon: ({ focused }) => <TabIcon name="storefront" focused={focused} />,
          headerShown: false,
        }}
      />
    </Tabs>
  );
}
