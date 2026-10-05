import type { City } from './cities';

interface GeoResult {
  name: string;
  admin1?: string;
  country?: string;
  country_code?: string;
  latitude: number;
  longitude: number;
}

export async function searchCities(query: string): Promise<City[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=10&language=pt&format=json`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const data = await res.json() as { results?: GeoResult[] };
    if (!data.results?.length) return [];
    return data.results.map(r => ({
      name: r.name,
      state: r.admin1 ?? r.country ?? '',
      lat: r.latitude,
      lon: r.longitude,
    }));
  } catch {
    return [];
  }
}
