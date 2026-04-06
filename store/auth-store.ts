import { create } from 'zustand';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { Tables } from '@/lib/supabase';

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

  initialize: () => Promise<void>;
  _loadUser: (session: Session) => Promise<void>;
  signInWithEmail: (email: string) => Promise<{ error: string | null }>;
  signInWithApple: () => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  setRole: (role: UserRole) => Promise<void>;
  setArtistTier: (tier: ArtistTier) => Promise<void>;
  completeOnboarding: () => Promise<void>;
  updateProfile: (updates: Partial<Pick<AppUser, 'displayName' | 'city' | 'stylePreferences' | 'avatarUrl'>>) => Promise<void>;
  refreshProfile: () => Promise<void>;
  setLoading: (loading: boolean) => void;
  _devSignIn: (role: UserRole) => void;
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
    onboardingCompleted: profile.onboarding_completed,
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

  initialize: async () => {
    set({ isLoading: true });
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) await get()._loadUser(session);
      supabase.auth.onAuthStateChange(async (_event, session) => {
        if (session) {
          await get()._loadUser(session);
        } else {
          set({ session: null, user: null, isAuthenticated: false });
        }
      });
    } finally {
      set({ isLoading: false });
    }
  },

  _loadUser: async (session) => {
    const { data: profile } = await supabase
      .from('profiles').select('*').eq('id', session.user.id).single();
    if (!profile) {
      set({ session, isAuthenticated: true, user: null });
      return;
    }
    let artist: Tables<'artists'> | null = null;
    if (profile.role === 'artist') {
      const { data } = await supabase
        .from('artists').select('*').eq('profile_id', profile.id).single();
      artist = data;
    }
    set({ session, isAuthenticated: true, user: mapProfile(profile, artist) });
  },

  signInWithEmail: async (email) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: 'inkr://auth/callback' },
    });
    return { error: error?.message ?? null };
  },

  signInWithApple: async () => {
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
      return { error: error?.message ?? null };
    } catch (e: any) {
      if (e.code === 'ERR_REQUEST_CANCELED') return { error: null };
      return { error: e.message };
    }
  },

  signInWithGoogle: async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: 'inkr://auth/callback' },
    });
    return { error: error?.message ?? null };
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, user: null, isAuthenticated: false });
  },

  setRole: async (role) => {
    const { session } = get();
    if (!session) return;
    await supabase.from('profiles').update({ role }).eq('id', session.user.id);
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

  _devSignIn: (role) => {
    if (!__DEV__) return; // No-op in production builds
    set({
      isAuthenticated: true,
      isLoading: false,
      user: {
        id: 'dev-user-id',
        email: 'dev@tattoo.app',
        displayName: role === 'artist' ? 'Marco Ink' : 'Alex Client',
        role,
        stylePreferences: ['blackwork', 'neo-trad'],
        onboardingCompleted: false,
        artistId: role === 'artist' ? 'dev-artist-id' : undefined,
        artistTier: role === 'artist' ? 'premium' : undefined,
        artistBlaze: role === 'artist' ? 'Marco Ink' : undefined,
        artistBookingStatus: role === 'artist' ? 'open' : undefined,
      },
    });
  },
}));
