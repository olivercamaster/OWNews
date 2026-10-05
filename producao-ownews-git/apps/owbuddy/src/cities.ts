export type City = {
  name: string;
  state: string;
  lat: number;
  lon: number;
};

// Major cities relevant to offshore workers in Brazil
export const CITIES: City[] = [
  { name: 'Macaé',                   state: 'RJ', lat: -22.3708, lon: -41.7869 },
  { name: 'Campos dos Goytacazes',   state: 'RJ', lat: -21.7542, lon: -41.3244 },
  { name: 'Cabo Frio',               state: 'RJ', lat: -22.8791, lon: -42.0186 },
  { name: 'Angra dos Reis',          state: 'RJ', lat: -23.0067, lon: -44.3181 },
  { name: 'Rio de Janeiro',          state: 'RJ', lat: -22.9068, lon: -43.1729 },
  { name: 'Niterói',                 state: 'RJ', lat: -22.8832, lon: -43.1042 },
  { name: 'Vitória',                 state: 'ES', lat: -20.2976, lon: -40.2960 },
  { name: 'São Paulo',               state: 'SP', lat: -23.5505, lon: -46.6333 },
  { name: 'Santos',                  state: 'SP', lat: -23.9618, lon: -46.3322 },
  { name: 'Maceió',                  state: 'AL', lat: -9.6658,  lon: -35.7353 },
  { name: 'Salvador',                state: 'BA', lat: -12.9714, lon: -38.5014 },
  { name: 'Natal',                   state: 'RN', lat: -5.7945,  lon: -35.2110 },
  { name: 'Fortaleza',               state: 'CE', lat: -3.7172,  lon: -38.5434 },
  { name: 'Recife',                  state: 'PE', lat: -8.0476,  lon: -34.8770 },
  { name: 'Manaus',                  state: 'AM', lat: -3.1190,  lon: -60.0217 },
  { name: 'Belém',                   state: 'PA', lat: -1.4558,  lon: -48.4902 },
  { name: 'Belo Horizonte',          state: 'MG', lat: -19.9191, lon: -43.9386 },
  { name: 'Brasília',                state: 'DF', lat: -15.7942, lon: -47.8825 },
  { name: 'Curitiba',                state: 'PR', lat: -25.4284, lon: -49.2733 },
  { name: 'Porto Alegre',            state: 'RS', lat: -30.0346, lon: -51.2177 },
];

export function findCity(name: string): City | undefined {
  return CITIES.find(c => c.name === name);
}
