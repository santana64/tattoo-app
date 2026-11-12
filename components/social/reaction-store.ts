import { create } from 'zustand';
import {
  applyReaction, fetchMyReactions, fetchReactionCounts, setReaction,
  type ReactionCounts, type ReactionKey,
} from '@/lib/care';

/** The counts RPC and the "mine" query both read at most this many posts per call. */
const BATCH = 60;

interface ReactionState {
  counts: Record<string, ReactionCounts>;
  /** The signed-in user's reaction per post (null: none). Only for `mineOwner`. */
  mine: Record<string, ReactionKey | null>;
  mineOwner: string | null;
  pending: Set<string>;
  /**
   * Loads counts (and the user's reactions when `userId` is given) for posts not
   * requested yet. Feeds call it once per page; a lone ReactionBar calls it for
   * its own post, and requests already in flight are never repeated.
   * `fresh` asks again for posts already loaded (pull to refresh).
   */
  load: (postIds: string[], userId?: string | null, fresh?: boolean) => Promise<void>;
  /** Writes server values obtained elsewhere (props), unless a change is in flight. */
  seed: (postId: string, counts?: ReactionCounts, mine?: ReactionKey | null, userId?: string | null) => void;
  /** Optimistic set / change / removal, rolled back when the database refuses. */
  react: (userId: string, postId: string, next: ReactionKey | null) => Promise<boolean>;
}

const chunks = <T,>(list: T[], size: number) =>
  Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size));

export const useReactionStore = create<ReactionState>((set, get) => {
  const countsRequested = new Set<string>();
  const mineRequested = new Set<string>();

  const switchOwner = (userId: string) => {
    if (get().mineOwner === userId) return;
    mineRequested.clear();
    set({ mine: {}, mineOwner: userId });
  };

  return {
    counts: {},
    mine: {},
    mineOwner: null,
    pending: new Set(),

    load: async (postIds, userId, fresh = false) => {
      // Without a user only counts are loaded; the reactions of whoever is signed in stay.
      if (userId) switchOwner(userId);
      const ids = [...new Set(postIds.filter(Boolean))];
      if (fresh) ids.forEach((id) => { countsRequested.delete(id); mineRequested.delete(id); });
      const needCounts = ids.filter((id) => !countsRequested.has(id));
      const needMine = userId ? ids.filter((id) => !mineRequested.has(id)) : [];
      needCounts.forEach((id) => countsRequested.add(id));
      needMine.forEach((id) => mineRequested.add(id));

      const countJobs = chunks(needCounts, BATCH).map(async (batch) => {
        try {
          const result = await fetchReactionCounts(batch);
          set((s) => {
            const counts = { ...s.counts };
            // Posts without any reaction come back absent: record them as empty.
            for (const id of batch) if (!s.pending.has(id)) counts[id] = result[id] ?? {};
            return { counts };
          });
        } catch {
          // Allow a later attempt (next focus, next page) for the posts that failed.
          batch.forEach((id) => countsRequested.delete(id));
        }
      });

      const mineJobs = userId ? chunks(needMine, BATCH).map(async (batch) => {
        try {
          const result = await fetchMyReactions(userId, batch);
          if (get().mineOwner !== userId) return;
          set((s) => {
            const mine = { ...s.mine };
            for (const id of batch) if (!s.pending.has(id)) mine[id] = result[id] ?? null;
            return { mine };
          });
        } catch {
          batch.forEach((id) => mineRequested.delete(id));
        }
      }) : [];

      await Promise.all([...countJobs, ...mineJobs]);
    },

    seed: (postId, counts, mine, userId) => {
      if (get().pending.has(postId)) return;
      if (counts) {
        countsRequested.add(postId);
        if (get().counts[postId] !== counts) set((s) => ({ counts: { ...s.counts, [postId]: counts } }));
      }
      if (mine !== undefined && userId) {
        switchOwner(userId);
        mineRequested.add(postId);
        if (get().mine[postId] !== mine) set((s) => ({ mine: { ...s.mine, [postId]: mine } }));
      }
    },

    react: async (userId, postId, next) => {
      switchOwner(userId);
      if (get().pending.has(postId)) return false;
      const previous = get().mine[postId] ?? null;
      const before = get().counts[postId] ?? {};
      set((s) => ({
        pending: new Set(s.pending).add(postId),
        counts: { ...s.counts, [postId]: applyReaction(before, previous, next) },
        mine: { ...s.mine, [postId]: next },
      }));
      let saved = false;
      try {
        saved = await setReaction(userId, postId, next);
      } catch {
        saved = false;
      }
      set((s) => {
        const pending = new Set(s.pending);
        pending.delete(postId);
        if (saved) return { pending };
        // Undo exactly this change, keeping anything another screen loaded meanwhile.
        const current = s.counts[postId] ?? {};
        return {
          pending,
          counts: { ...s.counts, [postId]: applyReaction(current, next, previous) },
          mine: s.mineOwner === userId ? { ...s.mine, [postId]: previous } : s.mine,
        };
      });
      return saved;
    },
  };
});
