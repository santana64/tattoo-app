import { create } from 'zustand';
import { Session } from '@supabase/supabase-js';
import { supabase, Tables } from '@/lib/supabase';
import { Platform } from 'react-native';
import { authErrorMessage } from '@/lib/auth-errors';

let profileLoadVersion = 0;

function authCallbackUrl() {
  return Platform.OS === 'web' && typeof window !== 'undefined'
    ? `${window.location.origin}/auth/callback`
    : 'inkr://auth/callback';
}

export type UserRole = 'user' | 'artist';
export type ArtistTier = 'normal' | 'premium';

export interface AppUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  role: UserRole;
  city?: string;
  stylePreferences: string[];
  onboardingCompleted: boolean;
  // Artist-specific
  artistId?: string;
  artistTier?: ArtistTier;
  artistBlaze?: string;
  artistBookingStatus?: 'open' | 'paused' | 'closed';
}

interface AuthState {
  session: Session | null;
  user: AppUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  initialize: () => () => void;
  _loadUser: (session: Session) => Promise<void>;
  signInWithEmail: (email: string) => Promise<{ error: string | null }>;
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>;
  /** `needsConfirmation` is true when the project requires e-mail confirmation (no session yet). */
  signUpWithPassword: (email: string, password: string) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  signInWithApple: () => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  setRole: (role: UserRole) => Promise<void>;
  setArtistTier: (tier: ArtistTier) => Promise<void>;
  completeOnboarding: () => Promise<void>;
  updateProfile: (updates: Partial<Pick<AppUser, 'displayName' | 'city' | 'stylePreferences' | 'avatarUrl'>>) => Promise<void>;
  refreshProfile: () => Promise<void>;
  setLoading: (loading: boolean) => void;
}

function mapProfile(
  profile: Tables<'profiles'>,
  artist?: Tables<'artists'> | null
): AppUser {
  return {
    id: profile.id,
    email: profile.email,
    displayName: profile.display_name,
    avatarUrl: profile.avatar_url ?? undefined,
    role: profile.role,
    city: profile.city ?? undefined,
    stylePreferences: profile.style_prefs ?? [],
    onboardingCompleted: profile.onboarding_completed ?? false,
    artistId: artist?.id ?? undefined,
    artistTier: artist?.tier ?? undefined,
    artistBlaze: artist?.blaze ?? undefined,
    artistBookingStatus: artist?.booking_status ?? undefined,
  };
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  initialize: () => {
    let active = true;
    let pending: ReturnType<typeof setTimeout> | undefined;
    set({ isLoading: true, error: null });
    // Supabase emits INITIAL_SESSION itself. Do not await a Supabase query
    // inside this callback: it holds the auth lock until the callback returns.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      clearTimeout(pending);
      profileLoadVersion++;
      if (!session) {
        set({ session: null, user: null, isAuthenticated: false, isLoading: false, error: null });
        return;
      }
      const sameUser = get().user?.id === session.user.id;
      set({ session, isAuthenticated: true, user: sameUser ? get().user : null, isLoading: !sameUser });
      pending = setTimeout(() => {
        if (active) void get()._loadUser(session);
      }, 0);
    });
    return () => {
      active = false;
      clearTimeout(pending);
      profileLoadVersion++;
      subscription.unsubscribe();
    };
  },

  _loadUser: async (session) => {
    const version = ++profileLoadVersion;
    try {
      const { data: profile, error } = await supabase
        .from('profiles').select('*').eq('id', session.user.id).single();
      if (error || !profile) throw new Error('Impossible de charger ton profil. Réessaie dans un instant.');
      let artist: Tables<'artists'> | null = null;
      if (profile.role === 'artist') {
        const result = await supabase.from('artists').select('*').eq('profile_id', profile.id).maybeSingle();
        if (result.error) throw new Error('Impossible de charger ton profil artiste.');
        artist = result.data;
      }
      if (version === profileLoadVersion && get().session?.user.id === session.user.id) {
        set({ user: mapProfile(profile, artist), isLoading: false, error: null });
      }
    } catch (error) {
      if (version === profileLoadVersion) {
        set({ isLoading: false, error: error instanceof Error ? error.message : 'Connexion indisponible.' });
      }
    }
  },

  signInWithEmail: async (email) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: authCallbackUrl() },
    });
    return { error: authErrorMessage(error) };
  },

  signInWithPassword: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: authErrorMessage(error) };
  },

  signUpWithPassword: async (email, password) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: authCallbackUrl() },
    });
    if (error) return { error: authErrorMessage(error), needsConfirmation: false };
    // With e-mail confirmation off, Supabase returns a session immediately and
    // onAuthStateChange takes over. Otherwise the user must confirm first.
    return { error: null, needsConfirmation: !data.session };
  },

  signInWithApple: async () => {
    if (Platform.OS === 'web') {
      const { error } = await supabase.auth.signInWithOAuth({ provider: 'apple', options: { redirectTo: authCallbackUrl() } });
      return { error: authErrorMessage(error) };
    }
    try {
      const AppleAuth = await import('expo-apple-authentication');
      const credential = await AppleAuth.signInAsync({
        requestedScopes: [
          AppleAuth.AppleAuthenticationScope.FULL_NAME,
          AppleAuth.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) return { error: 'No identity token' };
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });
      return { error: authErrorMessage(error) };
    } catch (e: any) {
      if (e.code === 'ERR_REQUEST_CANCELED') return { error: null };
      return { error: authErrorMessage(e) };
    }
  },

  signInWithGoogle: async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: authCallbackUrl() },
    });
    return { error: authErrorMessage(error) };
  },

  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    profileLoadVersion++;
    set({ session: null, user: null, isAuthenticated: false, error: null });
  },

  setRole: async (role) => {
    const { session } = get();
    if (!session) return;
    const { error } = await supabase.from('profiles').update({ role }).eq('id', session.user.id);
    if (error) throw error;
    set((s) => ({ user: s.user ? { ...s.user, role } : null }));
  },

  setArtistTier: async (tier) => {
    const { user } = get();
    if (!user?.artistId) return;
    await supabase.from('artists').update({ tier }).eq('id', user.artistId);
    set((s) => ({ user: s.user ? { ...s.user, artistTier: tier } : null }));
  },

  completeOnboarding: async () => {
    const { session } = get();
    if (!session) return;
    await supabase.from('profiles').update({ onboarding_completed: true }).eq('id', session.user.id);
    set((s) => ({ user: s.user ? { ...s.user, onboardingCompleted: true } : null }));
  },

  updateProfile: async (updates) => {
    const { session } = get();
    if (!session) return;
    const dbUpdates: Record<string, unknown> = {};
    if (updates.displayName) dbUpdates.display_name = updates.displayName;
    if (updates.city !== undefined) dbUpdates.city = updates.city;
    if (updates.stylePreferences) dbUpdates.style_prefs = updates.stylePreferences;
    if (updates.avatarUrl) dbUpdates.avatar_url = updates.avatarUrl;
    await supabase.from('profiles').update(dbUpdates).eq('id', session.user.id);
    set((s) => ({ user: s.user ? { ...s.user, ...updates } : null }));
  },

  refreshProfile: async () => {
    const { session } = get();
    if (session) await get()._loadUser(session);
  },

  setLoading: (isLoading) => set({ isLoading }),

}));
