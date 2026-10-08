import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

/** Öffentliche Werte (wie auf der Website); die Daten schützt Row Level Security in der Datenbank. */
const URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
export const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL || 'https://vysnone.com';

export const supabase = createClient(URL, ANON_KEY, {
  auth: { storage: AsyncStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});

// Token nur im Vordergrund erneuern (Empfehlung von Supabase für React Native)
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
