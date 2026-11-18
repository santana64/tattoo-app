import { createClient, processLock } from '@supabase/supabase-js';
import { Database } from './supabase.types';
import { Platform } from 'react-native';
import { authStorage } from './auth-storage';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
    // Keep Supabase's browser multi-tab lock; use its process lock only on native.
    ...(Platform.OS !== 'web' ? { lock: processLock } : {}),
  },
});

export type SupabaseClient = typeof supabase;
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type Enums<T extends keyof Database['public']['Enums']> =
  Database['public']['Enums'][T];
