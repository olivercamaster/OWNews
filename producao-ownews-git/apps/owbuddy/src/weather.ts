// Weather cache-first service via Open-Meteo (free, no API key required)
// Storage key is defined here; actual AsyncStorage calls use storage.ts helpers

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { City } from './cities';
import { formatHoraBR } from './format';

const WEATHER_KEY = 'owbuddy_weather_cache';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min

export type WeatherData = {
  city: string;
  state: string;
  tempC: number;
  description: string;
  cachedAt: number;
};

// WMO weather interpretation codes → pt-BR descriptions
const WMO: Record<number, string> = {
  0: 'Céu limpo', 1: 'Quase limpo', 2: 'Parcialmente nublado', 3: 'Nublado',
  45: 'Neblina', 48: 'Neblina com geada',
  51: 'Garoa fraca', 53: 'Garoa', 55: 'Garoa intensa',
  56: 'Garoa gelada', 57: 'Garoa gelada intensa',
  61: 'Chuva fraca', 63: 'Chuva', 65: 'Chuva forte',
  66: 'Chuva gelada', 67: 'Chuva gelada forte',
  71: 'Neve fraca', 73: 'Neve', 75: 'Neve forte', 77: 'Granizo',
  80: 'Pancadas fracas', 81: 'Pancadas', 82: 'Pancadas fortes',
  85: 'Neve com pancadas', 86: 'Neve com pancadas fortes',
  95: 'Tempestade', 96: 'Tempestade c/ granizo', 99: 'Tempestade forte',
};

export async function getCachedWeather(): Promise<WeatherData | null> {
  try {
    const raw = await AsyncStorage.getItem(WEATHER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as WeatherData;
  } catch {
    return null;
  }
}

async function saveCache(data: WeatherData): Promise<void> {
  try {
    await AsyncStorage.setItem(WEATHER_KEY, JSON.stringify(data));
  } catch {}
}

export async function fetchWeather(city: City): Promise<WeatherData | null> {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${city.lat}&longitude=${city.lon}` +
      `&current=temperature_2m,weathercode` +
      `&timezone=America%2FSao_Paulo`;

    const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!resp.ok) return null;

    const json = (await resp.json()) as {
      current: { temperature_2m: number; weathercode: number };
    };

    const data: WeatherData = {
      city: city.name,
      state: city.state,
      tempC: Math.round(json.current.temperature_2m),
      description: WMO[json.current.weathercode] ?? 'Condições variáveis',
      cachedAt: Date.now(),
    };

    await saveCache(data);
    return data;
  } catch {
    return null;
  }
}

/** Returns fresh or cached weather. Falls back to stale cache when offline. */
export async function getWeather(city: City | null): Promise<WeatherData | null> {
  if (!city) return null;
  const cached = await getCachedWeather();
  const isFreshAndSameCity =
    cached &&
    cached.city === city.name &&
    Date.now() - cached.cachedAt < CACHE_TTL_MS;
  if (isFreshAndSameCity) return cached;
  const fresh = await fetchWeather(city);
  return fresh ?? cached ?? null;
}

export function isCacheStale(cachedAt: number): boolean {
  return Date.now() - cachedAt > CACHE_TTL_MS;
}

/** "Atualizado às 14:32" or "14:32" */
export function weatherCacheLabel(cachedAt: number): string {
  return `Atualizado às ${formatHoraBR(cachedAt)}`;
}
