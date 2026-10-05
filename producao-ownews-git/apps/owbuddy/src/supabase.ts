import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Supabase anon/publishable key — same project as OWNews web.
// This key is already public (it's in the worker.js HTML sent to browsers).
// NEVER use service_role key here.
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
