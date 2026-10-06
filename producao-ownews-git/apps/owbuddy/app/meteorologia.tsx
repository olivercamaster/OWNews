import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography, surface, maritime } from '../src/theme';
import { OWBackground } from '../src/components/OWBackground';
import { CITIES, type City } from '../src/cities';
import { getWeather, type WeatherData, weatherCacheLabel } from '../src/weather';
import { getCityPref, setCityPref } from '../src/storage';
import { analytics } from '../src/analytics';

type CityWeather = { city: City; weather: WeatherData | null; loading: boolean; error: boolean };

function WeatherRow({ item, onSelect, selected }: { item: CityWeather; onSelect: (c: City) => void; selected: boolean }) {
  return (
    <Pressable
      style={[styles.row, selected && styles.rowSelected]}
      onPress={() => onSelect(item.city)}
      accessibilityRole="button"
      accessibilityLabel={`Meteorologia de ${item.city.name}`}
    >
      <View style={styles.rowLeft}>
        <Text style={[styles.cityName, selected && styles.cityNameSelected]}>{item.city.name}</Text>
        <Text style={styles.cityState}>{item.city.state}</Text>
      </View>
      {item.loading ? (
        <ActivityIndicator size="small" color={colors.cyan} />
      ) : item.error || !item.weather ? (
        <Text style={styles.weatherError}>—</Text>
      ) : (
        <View style={styles.weatherInfo}>
          <Text style={styles.temp}>{item.weather.tempC}°C</Text>
          <Text style={styles.desc}>{item.weather.description}</Text>
        </View>
      )}
    </Pressable>
  );
}

export default function MeteorologiaScreen() {
  const [rows, setRows] = useState<CityWeather[]>(
    CITIES.map(c => ({ city: c, weather: null, loading: true, error: false }))
  );
  const [selectedCity, setSelectedCity] = useState<City | null>(null);
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    const pref = await getCityPref();
    setSelectedCity(pref ?? CITIES[0]);

    setRows(CITIES.map(c => ({ city: c, weather: null, loading: true, error: false })));

    CITIES.forEach(async (city, i) => {
      try {
        const weather = await getWeather(city);
        setRows(prev => prev.map((r, j) => j === i ? { ...r, weather, loading: false } : r));
      } catch {
        setRows(prev => prev.map((r, j) => j === i ? { ...r, loading: false, error: true } : r));
      }
    });

    setReady(true);
    analytics.screen('Meteorologia');
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleSelect = async (city: City) => {
    setSelectedCity(city);
    await setCityPref(city);
    analytics.track('weather_city_selected');
  };

  const selected = rows.find(r => r.city.name === selectedCity?.name);

  return (
    <OWBackground>
    <View style={styles.root}>
      {selected && (
        <View style={styles.hero}>
          <Text style={styles.heroCity}>{selected.city.name}, {selected.city.state}</Text>
          {selected.loading ? (
            <ActivityIndicator color={colors.cyan} style={{ marginTop: spacing.md }} />
          ) : selected.error || !selected.weather ? (
            <Text style={styles.heroError}>Dados indisponíveis no momento</Text>
          ) : (
            <>
              <Text style={styles.heroTemp}>{selected.weather.tempC}°C</Text>
              <Text style={styles.heroDesc}>{selected.weather.description}</Text>
              {selected.weather.cachedAt && (
                <Text style={styles.heroCache}>{weatherCacheLabel(selected.weather.cachedAt)}</Text>
              )}
            </>
          )}
        </View>
      )}
      <View style={styles.listHeader}>
        <Ionicons name="location-outline" size={14} color={colors.mutedDim} />
        <Text style={styles.listHeaderText}>Selecionar cidade</Text>
      </View>
      <FlatList
        data={rows}
        keyExtractor={r => r.city.name}
        renderItem={({ item }) => (
          <WeatherRow
            item={item}
            onSelect={handleSelect}
            selected={item.city.name === selectedCity?.name}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        contentContainerStyle={styles.list}
        refreshing={!ready}
        onRefresh={load}
      />
    </View>
    </OWBackground>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  hero: {
    backgroundColor: surface.card,
    padding: spacing.lg,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    gap: 4,
  },
  heroCity: { ...typography.small, color: colors.cyanDim, textTransform: 'uppercase', letterSpacing: 1 },
  heroTemp: { fontSize: 56, fontWeight: '700', color: colors.white, lineHeight: 64 },
  heroDesc: { ...typography.body, color: colors.muted },
  heroCache: { ...typography.micro, color: colors.mutedDim, marginTop: 4 },
  heroError: { ...typography.small, color: colors.mutedDim, marginTop: spacing.md },

  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSoft,
  },
  listHeaderText: { ...typography.micro, color: colors.mutedDim },
  list: { paddingBottom: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  rowSelected: { backgroundColor: colors.cyanFaint },
  rowLeft: { gap: 2 },
  cityName: { ...typography.h3, fontSize: 15 },
  cityNameSelected: { color: colors.cyan },
  cityState: { ...typography.small, color: colors.mutedDim, fontSize: 12 },
  weatherInfo: { alignItems: 'flex-end', gap: 2 },
  temp: { fontSize: 18, fontWeight: '700', color: colors.white },
  desc: { ...typography.small, color: colors.muted, fontSize: 12 },
  weatherError: { ...typography.small, color: colors.mutedDim },
  sep: { height: 1, backgroundColor: colors.lineSoft, marginHorizontal: spacing.md },
});
