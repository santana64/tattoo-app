import { create } from 'zustand';
import type { UserRole, ArtistTier } from '@/constants/mock-data';

export interface AuthUser {
  id: string;
  displayName: string;
  email: string;
  avatarUrl?: string;
  role: UserRole;
  artistTier?: ArtistTier;
  artistId?: string;
  city?: string;
  stylePreferences?: string[];
  onboardingCompleted: boolean;
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  signIn: (user: AuthUser) => void;
  signOut: () => void;
  setRole: (role: UserRole) => void;
  setArtistTier: (tier: ArtistTier) => void;
  completeOnboarding: () => void;
  updateProfile: (updates: Partial<AuthUser>) => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,

  signIn: (user) => set({ user, isAuthenticated: true }),

  signOut: () => set({ user: null, isAuthenticated: false }),

  setRole: (role) =>
    set((state) => ({
      user: state.user ? { ...state.user, role } : null,
    })),

  setArtistTier: (tier) =>
    set((state) => ({
      user: state.user ? { ...state.user, artistTier: tier } : null,
    })),

  completeOnboarding: () =>
    set((state) => ({
      user: state.user ? { ...state.user, onboardingCompleted: true } : null,
    })),

  updateProfile: (updates) =>
    set((state) => ({
      user: state.user ? { ...state.user, ...updates } : null,
    })),

  setLoading: (loading) => set({ isLoading: loading }),
}));
