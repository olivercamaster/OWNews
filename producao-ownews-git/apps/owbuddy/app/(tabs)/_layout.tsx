import { Tabs } from 'expo-router';
import { colors } from '../../src/theme';

const TAB_BAR_STYLE = {
  backgroundColor: colors.navy900,
  borderTopColor: colors.line,
  borderTopWidth: 1,
  paddingTop: 4,
  height: 58,
};

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.cyan,
        tabBarInactiveTintColor: colors.mutedDim,
        tabBarStyle: TAB_BAR_STYLE,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginBottom: 4 },
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
          tabBarIcon: ({ color }) => <TabIcon glyph="⚓" color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="mala"
        options={{
          title: 'Mala',
          tabBarIcon: ({ color }) => <TabIcon glyph="🧳" color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="viagem"
        options={{
          title: 'Viagem',
          tabBarIcon: ({ color }) => <TabIcon glyph="✈️" color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="certs"
        options={{
          title: 'Docs',
          tabBarIcon: ({ color }) => <TabIcon glyph="📋" color={color as string} />,
        }}
      />
    </Tabs>
  );
}

function TabIcon({ glyph, color }: { glyph: string; color: string }) {
  const { Text } = require('react-native');
  return <Text style={{ fontSize: 20, color }}>{glyph}</Text>;
}
