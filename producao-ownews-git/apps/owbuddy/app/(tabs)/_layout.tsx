import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, iconSize } from '../../src/theme';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({ name, focused }: { name: IoniconsName; focused: boolean }) {
  return (
    <Ionicons
      name={focused ? name : (`${name}-outline` as IoniconsName)}
      size={iconSize.tab}
      color={focused ? colors.cyan : colors.mutedDim}
    />
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  // Respect Android navigation bar + iPhone home indicator
  const tabBarHeight = 56 + insets.bottom;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.cyan,
        tabBarInactiveTintColor: colors.mutedDim,
        tabBarStyle: {
          backgroundColor: colors.navy900,
          borderTopColor: colors.line,
          borderTopWidth: 1,
          height: tabBarHeight,
          paddingBottom: insets.bottom + 4,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginBottom: 0,
        },
        headerStyle: { backgroundColor: colors.navy900 },
        headerTintColor: colors.white,
        headerTitleStyle: { fontWeight: '700' },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Hoje',
          tabBarIcon: ({ focused }) => <TabIcon name="home" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="mala"
        options={{
          title: 'Lista',
          tabBarIcon: ({ focused }) => <TabIcon name="checkbox" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="viagem"
        options={{
          title: 'Viagem',
          tabBarIcon: ({ focused }) => <TabIcon name="airplane" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="certs"
        options={{
          title: 'Docs',
          tabBarIcon: ({ focused }) => <TabIcon name="document-text" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
