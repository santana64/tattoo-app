import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

interface SavedArtistsState {
  ownerId: string | null;
  savedArtistIds: Set<string>;
  pendingIds: Set<string>;
  isLoading: boolean;
  isLoaded: boolean;
  error: string | null;
  fetchSaved: (userId?: string) => Promise<boolean>;
  toggle: (userId: string, artistId: string) => Promise<boolean>;
  reset: () => void;
}

export const useSavedArtistsStore = create<SavedArtistsState>((set, get) => {
  let generation = 0;
  let loading: Promise<boolean> | null = null;
  const emptyState = () => ({
    ownerId: null,
    savedArtistIds: new Set<string>(),
    pendingIds: new Set<string>(),
    isLoading: false,
    isLoaded: false,
    error: null,
  });

  return {
    ...emptyState(),
    reset: () => {
      generation++;
      loading = null;
      set(emptyState());
    },
    fetchSaved: async (userId) => {
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
          const { data, error } = await supabase.from('saved_artists').select('artist_id').eq('user_id', userId);
          if (error) throw error;
          if (version !== generation) return false;
          set({ savedArtistIds: new Set((data ?? []).map(row => row.artist_id)), isLoaded: true });
          return true;
        } catch {
          if (version === generation) set({ error: 'Impossible de charger les artistes enregistrés.' });
          return false;
        } finally {
          if (version === generation) { loading = null; set({ isLoading: false }); }
        }
      })();
      return loading;
    },
    toggle: async (userId, artistId) => {
      if (!userId || !artistId || !await get().fetchSaved(userId)) return false;
      if (get().ownerId !== userId || get().pendingIds.has(artistId)) return false;
      const version = generation;
      const wasSaved = get().savedArtistIds.has(artistId);
      set({ pendingIds: new Set(get().pendingIds).add(artistId), error: null });
      try {
        const result = wasSaved
          ? await supabase.from('saved_artists').delete().eq('user_id', userId).eq('artist_id', artistId).select('artist_id')
          : await supabase.from('saved_artists').insert({ user_id: userId, artist_id: artistId }).select('artist_id').single();
        if (result.error) throw result.error;
        if (version !== generation) return false;
        const savedArtistIds = new Set(get().savedArtistIds);
        if (wasSaved) savedArtistIds.delete(artistId);
        else savedArtistIds.add(artistId);
        set({ savedArtistIds });
        return true;
      } catch {
        if (version === generation) set({ error: 'Impossible de modifier vos artistes enregistrés. Réessayez.' });
        return false;
      } finally {
        if (version === generation) {
          const pendingIds = new Set(get().pendingIds);
          pendingIds.delete(artistId);
          set({ pendingIds });
        }
      }
    },
  };
});
