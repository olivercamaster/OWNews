import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Chave PUBLICÁVEL (anon) do mesmo projeto do OWNews web — já é pública no HTML
// do site e só faz o que as políticas RLS permitem. NUNCA usar service_role aqui.
const SUPABASE_URL = 'https://awyowuhwkqfyhwgdpepp.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_9cRatirjls8SQIoHdTUkLQ_8jt6psGt';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// React Native: o refresh automático do token só deve rodar com o app em
// primeiro plano (recomendação do supabase-js). Em segundo plano para; ao
// voltar, renova antes de qualquer sync — sessão não "expira" com o app aberto.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', estado => {
    if (estado === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
