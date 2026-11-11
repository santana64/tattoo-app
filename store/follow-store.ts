import { create } from 'zustand';
import { fetchFollowedArtistIds, setFollow } from '@/lib/studio';

interface FollowState {
  ownerId: string | null;
  followedIds: Set<string>;
  pendingIds: Set<string>;
  isLoading: boolean;
  isLoaded: boolean;
  error: string | null;
  /** Loads the artists the user follows. Signed out (no id): clears everything. */
  fetchFollowed: (userId?: string) => Promise<boolean>;
  /** Follows or unfollows at once, then rolls back if the database refuses. */
  toggle: (userId: string, artistId: string) => Promise<boolean>;
  reset: () => void;
}

export const useFollowStore = create<FollowState>((set, get) => {
  // Bumped on reset: answers that arrive for a previous user are dropped.
  let generation = 0;
  let loading: Promise<boolean> | null = null;
  const emptyState = () => ({
    ownerId: null,
    followedIds: new Set<string>(),
    pendingIds: new Set<string>(),
    isLoading: false,
    isLoaded: false,
    error: null,
  });

  const withMembership = (ids: Set<string>, artistId: string, member: boolean) => {
    const next = new Set(ids);
    if (member) next.add(artistId);
    else next.delete(artistId);
    return next;
  };

  return {
    ...emptyState(),
    reset: () => {
      generation++;
      loading = null;
      set(emptyState());
    },
    fetchFollowed: async (userId) => {
      if (!userId) { get().reset(); return false; }
      if (get().ownerId !== userId) {
        get().reset();
        set({ ownerId: userId });
      }
      if (get().isLoaded) return true;
      if (loading) return loading;
      const version = generation;
      set({ isLoading: true, error: null });
      loading = (async () => {
        try {
          const ids = await fetchFollowedArtistIds(userId);
          if (version !== generation) return false;
          set({ followedIds: new Set(ids), isLoaded: true });
          return true;
        } catch {
          if (version === generation) set({ error: 'Impossible de charger vos abonnements.' });
          return false;
        } finally {
          if (version === generation) { loading = null; set({ isLoading: false }); }
        }
      })();
      return loading;
    },
    toggle: async (userId, artistId) => {
      if (!userId || !artistId || !await get().fetchFollowed(userId)) return false;
      if (get().ownerId !== userId || get().pendingIds.has(artistId)) return false;
      const version = generation;
      const wasFollowing = get().followedIds.has(artistId);
      set({
        followedIds: withMembership(get().followedIds, artistId, !wasFollowing),
        pendingIds: new Set(get().pendingIds).add(artistId),
        error: null,
      });
      let saved = false;
      try {
        saved = await setFollow(userId, artistId, !wasFollowing);
      } catch {
        saved = false;
      }
      if (version !== generation) return false;
      const pendingIds = new Set(get().pendingIds);
      pendingIds.delete(artistId);
      if (saved) {
        set({ pendingIds });
        return true;
      }
      set({
        followedIds: withMembership(get().followedIds, artistId, wasFollowing),
        pendingIds,
        error: 'Impossible de modifier vos abonnements. Réessayez.',
      });
      return false;
    },
  };
});
