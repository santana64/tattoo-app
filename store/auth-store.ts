import { create } from 'zustand';
import { Session } from '@supabase/supabase-js';
import { supabase, Tables } from '@/lib/supabase';
import { fetchIsAdmin } from '@/lib/moderation';
import { Platform } from 'react-native';
import { authErrorMessage } from '@/lib/auth-errors';

let profileLoadVersion = 0;

function authCallbackUrl() {
  return Platform.OS === 'web' && typeof window !== 'undefined'
    ? `${window.location.origin}/auth/callback`
    : 'inkr://auth/callback';
}

export type UserRole = 'user' | 'artist';

export interface ArtistUpdates {
  blaze?: string;
  city?: string;
  styles?: string[];
  bookingStatus?: 'open' | 'paused' | 'closed';
  minBudget?: number | null;
  exclusions?: string[];
  avatarUrl?: string;
  coverUrl?: string;
}

// Postgres / PostgREST errors from profile writes, in French.
function writeErrorMessage(error: { code?: string; message?: string } | null): string | null {
  if (!error) return null;
  if (error.code === '42501') return 'Enregistrement refusé par les règles de sécurité de la base. Reconnectez-vous puis réessayez.';
  if (error.code === '23505') return 'Ce profil existe déjà.';
  if (error.code === '23514' || error.code === '22P02') return 'Une des valeurs saisies n’est pas acceptée.';
  return 'Enregistrement impossible. Vérifiez votre connexion puis réessayez.';
}
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
  artistIsVerified?: boolean;
  artistVerificationStatus?: 'pending' | 'submitted' | 'approved' | 'rejected';
  /** Moderator. Display only: every moderation action is checked again by the database. */
  isAdmin?: boolean;
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
  /** Permanently deletes the account server-side, then clears the local session. */
  deleteAccount: () => Promise<{ error: string | null }>;
  completeOnboarding: () => Promise<void>;
  updateProfile: (updates: Partial<Pick<AppUser, 'displayName' | 'city' | 'stylePreferences' | 'avatarUrl'>>) => Promise<{ error: string | null }>;
  /** Creates the artist row if needed, then saves the public artist fields. */
  saveArtist: (updates: ArtistUpdates) => Promise<{ error: string | null }>;
  refreshProfile: () => Promise<void>;
  setLoading: (loading: boolean) => void;
}

// Explicit column lists: the API only exposes these columns (migration 005).
// The e-mail is private and comes from the auth session, never from `profiles`.
const PROFILE_COLUMNS = 'id,display_name,avatar_url,role,city,style_prefs,onboarding_completed' as const;
const OWN_ARTIST_COLUMNS = 'id,tier,blaze,booking_status,is_verified,verification_status' as const;

type ProfileRow = Pick<Tables<'profiles'>, 'id' | 'display_name' | 'avatar_url' | 'role' | 'city' | 'style_prefs' | 'onboarding_completed'>;
type OwnArtistRow = Pick<Tables<'artists'>, 'id' | 'tier' | 'blaze' | 'booking_status' | 'is_verified' | 'verification_status'>;

function mapProfile(
  profile: ProfileRow,
  email: string,
  artist?: OwnArtistRow | null,
  isAdmin = false,
): AppUser {
  return {
    id: profile.id,
    email,
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
    artistIsVerified: artist?.is_verified ?? undefined,
    artistVerificationStatus: artist?.verification_status ?? undefined,
    isAdmin,
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
        .from('profiles').select(PROFILE_COLUMNS).eq('id', session.user.id).single();
      if (error || !profile) throw new Error('Impossible de charger ton profil. Réessaie dans un instant.');
      let artist: OwnArtistRow | null = null;
      if (profile.role === 'artist') {
        const result = await supabase.from('artists').select(OWN_ARTIST_COLUMNS).eq('profile_id', profile.id).maybeSingle();
        if (result.error) throw new Error('Impossible de charger ton profil artiste.');
        artist = result.data;
      }
      // Absent before migration 009, or on a network error: simply not an administrator.
      const isAdmin = await fetchIsAdmin().catch(() => false);
      if (version === profileLoadVersion && get().session?.user.id === session.user.id) {
        set({ user: mapProfile(profile, session.user.email ?? '', artist, isAdmin), isLoading: false, error: null });
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
    // Becoming an artist reopens onboarding so the artist steps can run (and pass routing).
    const becomesArtist = role === 'artist' && get().user?.role !== 'artist';
    const changes = becomesArtist ? { role, onboarding_completed: false } : { role };
    const { error } = await supabase.from('profiles').update(changes).eq('id', session.user.id);
    if (error) {
      console.warn('[auth] role update failed', error.code, error.message);
      throw new Error(writeErrorMessage(error) ?? 'Enregistrement impossible.');
    }
    set((s) => ({ user: s.user ? { ...s.user, role, ...(becomesArtist ? { onboardingCompleted: false } : {}) } : null }));
  },

  deleteAccount: async () => {
    if (!get().session) return { error: 'Session expirée. Reconnectez-vous.' };
    const { data, error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
    if (error || !data?.deleted) {
      let code: string | undefined;
      try {
        code = (await (error as { context?: Response } | null)?.context?.json())?.error;
      } catch { /* no readable body */ }
      console.warn('[auth] account deletion failed', code ?? error?.message);
      return {
        error: code === 'subscription_cancel_failed'
          ? 'Votre abonnement Premium n’a pas pu être résilié. Votre compte n’a pas été supprimé : réessayez ou contactez le support.'
          : 'La suppression a échoué. Votre compte est intact : vérifiez votre connexion puis réessayez.',
      };
    }
    // The user no longer exists server-side: only the local session is left to clear.
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
    profileLoadVersion++;
    set({ session: null, user: null, isAuthenticated: false, error: null });
    return { error: null };
  },

  completeOnboarding: async () => {
    const { session } = get();
    if (!session) return;
    await supabase.from('profiles').update({ onboarding_completed: true }).eq('id', session.user.id);
    set((s) => ({ user: s.user ? { ...s.user, onboardingCompleted: true } : null }));
  },

  updateProfile: async (updates) => {
    const { session } = get();
    if (!session) return { error: 'Session expirée. Reconnectez-vous.' };
    const dbUpdates: Record<string, unknown> = {};
    if (updates.displayName) dbUpdates.display_name = updates.displayName;
    if (updates.city !== undefined) dbUpdates.city = updates.city;
    if (updates.stylePreferences) dbUpdates.style_prefs = updates.stylePreferences;
    if (updates.avatarUrl) dbUpdates.avatar_url = updates.avatarUrl;
    const { error } = await supabase.from('profiles').update(dbUpdates).eq('id', session.user.id);
    if (error) {
      console.warn('[auth] profile update failed', error.code, error.message);
      return { error: writeErrorMessage(error) };
    }
    set((s) => ({ user: s.user ? { ...s.user, ...updates } : null }));
    return { error: null };
  },

  saveArtist: async (updates) => {
    const { session, user } = get();
    if (!session) return { error: 'Session expirée. Reconnectez-vous.' };
    const profileId = session.user.id;

    // The row is normally created at role selection; recover if that step failed.
    let artistId = user?.artistId;
    if (!artistId) {
      const existing = await supabase.from('artists').select('id').eq('profile_id', profileId).maybeSingle();
      if (existing.error) return { error: writeErrorMessage(existing.error) };
      artistId = existing.data?.id;
    }
    if (!artistId) {
      const created = await supabase
        .from('artists')
        .insert({ profile_id: profileId, blaze: updates.blaze ?? user?.displayName ?? 'Artiste', city: updates.city ?? user?.city ?? '' })
        .select('id')
        .single();
      if (created.error) {
        console.warn('[auth] artist insert failed', created.error.code, created.error.message);
        return { error: writeErrorMessage(created.error) };
      }
      artistId = created.data.id;
    }

    const row: Record<string, unknown> = {};
    if (updates.blaze !== undefined) row.blaze = updates.blaze;
    if (updates.city !== undefined) row.city = updates.city;
    if (updates.styles !== undefined) row.styles = updates.styles;
    if (updates.bookingStatus !== undefined) row.booking_status = updates.bookingStatus;
    if (updates.minBudget !== undefined) {
      row.min_budget = updates.minBudget;
      row.show_min_budget = !!updates.minBudget;
    }
    if (updates.exclusions !== undefined) row.exclusions = updates.exclusions;
    if (updates.avatarUrl !== undefined) row.avatar_url = updates.avatarUrl;
    if (updates.coverUrl !== undefined) row.cover_url = updates.coverUrl;

    if (Object.keys(row).length) {
      const { error } = await supabase.from('artists').update(row).eq('id', artistId).eq('profile_id', profileId);
      if (error) {
        console.warn('[auth] artist update failed', error.code, error.message);
        return { error: writeErrorMessage(error) };
      }
    }
    set((s) => ({
      user: s.user ? {
        ...s.user,
        artistId,
        artistBlaze: updates.blaze ?? s.user.artistBlaze,
        artistBookingStatus: updates.bookingStatus ?? s.user.artistBookingStatus,
      } : null,
    }));
    return { error: null };
  },

  refreshProfile: async () => {
    const { session } = get();
    if (session) await get()._loadUser(session);
  },

  setLoading: (isLoading) => set({ isLoading }),

}));
