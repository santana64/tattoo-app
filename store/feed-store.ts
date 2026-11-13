import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { useFollowStore } from '@/store/follow-store';

export interface FeedPost {
  id: string;
  artistId: string;
  artistName: string;
  artistCity: string;
  artistAvatarUrl: string | null;
  artistIsPremium: boolean;
  artistBookingStatus: 'open' | 'paused' | 'closed';
  mediaUrl: string;
  mediaType: 'photo' | 'video';
  /** Poster of an uploaded video, when one exists. */
  thumbnailUrl: string | null;
  /** Set when the video is hosted by TikTok or Instagram. */
  embedProvider: 'tiktok' | 'instagram' | null;
  caption: string | null;
  styles: string[];
  likesCount: number;
  isLiked: boolean;
  isSaved: boolean;
  publishedAt: string;
}

/** "all": every published piece ("Pour vous"). "following": followed artists only ("Abonnements"). */
export type FeedScope = 'all' | 'following';

interface FeedState {
  posts: FeedPost[];
  scope: FeedScope;
  /**
   * The followed artists the "following" pages were built from (see followingKeyOf),
   * '' when the user follows nobody, null outside that scope or before a load.
   */
  followingKey: string | null;
  /** "Sélection de la semaine": the most liked photos of the last 7 days. */
  selection: FeedPost[];
  isLoading: boolean;
  isRefreshing: boolean;
  hasMore: boolean;
  cursor: string | null;
  error: string | null;
  pendingActions: Set<string>;
  likedPostIds: Set<string>;
  savedPostIds: Set<string>;

  /** Loads the first page. `scope` switches the feed; omitted, the current scope is kept. */
  fetchFeed: (userId?: string, scope?: FeedScope) => Promise<void>;
  fetchMore: (userId?: string) => Promise<void>;
  refresh: (userId?: string) => Promise<void>;
  fetchSelection: () => Promise<void>;
  toggleLike: (postId: string, userId: string) => Promise<boolean>;
  toggleSave: (postId: string, userId: string) => Promise<boolean>;
  resetPersonalFeed: () => void;
}

const PAGE_SIZE = 12;
const SELECTION_SIZE = 8;
const SELECTION_DAYS = 7;
const DAY_MS = 86_400_000;

// "*" on purpose: the reel columns (migration 010) are read when they exist
// without making the feed depend on that migration being applied.
const POST_SELECT = `
  *,
  artists!posts_artist_id_fkey!inner (
    id, blaze, city, avatar_url, tier, profile_id, booking_status
  )
`;

/** Order-independent key of a set of artist ids, to tell whether follows changed since a load. */
export const followingKeyOf = (ids: Iterable<string>) => [...ids].sort().join(',');

export const useFeedStore = create<FeedState>((set, get) => {
  // Only the latest first-page load may write: the scope can change while a request is in flight.
  let feedSeq = 0;
  // Artists the current "following" pages are filtered on, so later pages match the first one.
  let followingIds: string[] | null = null;

  return {
    posts: [],
    scope: 'all',
    followingKey: null,
    selection: [],
    isLoading: false,
    isRefreshing: false,
    hasMore: true,
    cursor: null,
    error: null,
    pendingActions: new Set(),
    likedPostIds: new Set(),
    savedPostIds: new Set(),

    resetPersonalFeed: () => {
      feedSeq++;
      followingIds = null;
      set({
        posts: [], scope: 'all', followingKey: null, selection: [],
        isLoading: false, isRefreshing: false, hasMore: true, cursor: null, error: null,
        pendingActions: new Set(), likedPostIds: new Set(), savedPostIds: new Set(),
      });
    },

    fetchFeed: async (userId, nextScope) => {
      const seq = ++feedSeq;
      const scope = nextScope ?? get().scope;
      const switching = scope !== get().scope;
      set({
        scope, isLoading: true, cursor: null, hasMore: true, error: null,
        // Another scope's posts must not linger under the new tab.
        ...(switching ? { posts: [], followingKey: null } : null),
      });
      followingIds = null;

      try {
        if (scope === 'following') {
          // Signed out, or following nobody: nothing to ask the database.
          if (!userId) {
            if (seq === feedSeq) set({ posts: [], followingKey: null, isLoading: false, hasMore: false });
            return;
          }
          if (!await useFollowStore.getState().fetchFollowed(userId)) throw new Error('follows_unavailable');
          const ids = [...useFollowStore.getState().followedIds];
          if (seq !== feedSeq) return;
          if (ids.length === 0) {
            set({ posts: [], followingKey: '', isLoading: false, hasMore: false });
            return;
          }
          followingIds = ids;
        }
        const filterIds = followingIds;

        let query = supabase.from('posts').select(POST_SELECT).eq('is_published', true);
        if (filterIds) query = query.in('artist_id', filterIds);
        const { data, error } = await query.order('published_at', { ascending: false }).limit(PAGE_SIZE);
        if (error) throw error;

        // Load user likes & saves
        let likedSet = new Set<string>();
        let savedSet = new Set<string>();
        if (userId) {
          const [{ data: likes }, { data: saves }] = await Promise.all([
            supabase.from('post_likes').select('post_id').eq('user_id', userId),
            supabase.from('saved_posts').select('post_id').eq('user_id', userId),
          ]);
          likedSet = new Set((likes ?? []).map((l: any) => l.post_id));
          savedSet = new Set((saves ?? []).map((s: any) => s.post_id));
        }
        if (seq !== feedSeq) return;

        const posts = (data ?? []).map(mapPost(likedSet, savedSet));
        set({
          posts,
          isLoading: false,
          likedPostIds: likedSet,
          savedPostIds: savedSet,
          followingKey: filterIds ? followingKeyOf(filterIds) : null,
          cursor: posts.at(-1)?.publishedAt ?? null,
          hasMore: posts.length === PAGE_SIZE,
        });
      } catch {
        if (seq === feedSeq) {
          set({ isLoading: false, error: 'Impossible de charger les publications. Réessaie dans un instant.' });
        }
      }
    },

    fetchMore: async () => {
      const { isLoading, hasMore, cursor, posts, likedPostIds, savedPostIds, scope } = get();
      if (isLoading || !hasMore || !cursor) return;
      if (scope === 'following' && !followingIds?.length) return;
      const seq = feedSeq;
      const filterIds = scope === 'following' ? followingIds : null;
      set({ isLoading: true });
      try {
        let query = supabase.from('posts').select(POST_SELECT).eq('is_published', true);
        if (filterIds) query = query.in('artist_id', filterIds);
        const { data, error } = await query
          .lt('published_at', cursor)
          .order('published_at', { ascending: false })
          .limit(PAGE_SIZE);
        if (error) throw error;
        // A new first page (refresh, other scope) started meanwhile: this page belongs to the old one.
        if (seq !== feedSeq) return;
        const newPosts = (data ?? []).map(mapPost(likedPostIds, savedPostIds));
        set({
          posts: [...posts, ...newPosts],
          isLoading: false,
          cursor: newPosts.at(-1)?.publishedAt ?? cursor,
          hasMore: newPosts.length === PAGE_SIZE,
        });
      } catch {
        if (seq === feedSeq) set({ isLoading: false });
      }
    },

    refresh: async (userId) => {
      const seq = feedSeq + 1;
      set({ isRefreshing: true });
      await Promise.all([
        get().fetchFeed(userId),
        get().scope === 'all' ? get().fetchSelection() : Promise.resolve(),
      ]);
      if (seq === feedSeq) set({ isRefreshing: false });
    },

    fetchSelection: async () => {
      const seq = feedSeq;
      const since = new Date(Date.now() - SELECTION_DAYS * DAY_MS).toISOString();
      try {
        const { data, error } = await supabase
          .from('posts')
          .select(POST_SELECT)
          .eq('is_published', true)
          .eq('media_type', 'photo')
          .gt('likes_count', 0)
          .gte('published_at', since)
          .order('likes_count', { ascending: false })
          .order('published_at', { ascending: false })
          .limit(SELECTION_SIZE);
        if (error) throw error;
        if (seq !== feedSeq) return;
        const { likedPostIds, savedPostIds } = get();
        set({ selection: (data ?? []).map(mapPost(likedPostIds, savedPostIds)) });
      } catch {
        // The selection decorates the feed: on failure, keep whatever is already shown.
      }
    },

    toggleLike: async (postId, userId) => {
      const seq = feedSeq;
      const key = `like:${postId}`;
      if (!userId || get().pendingActions.has(key)) return false;
      set((s) => ({ pendingActions: new Set(s.pendingActions).add(key) }));
      const { likedPostIds } = get();
      const isLiked = likedPostIds.has(postId);
      try {
        const { error } = isLiked
          ? await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', userId)
          : await supabase.from('post_likes').insert({ post_id: postId, user_id: userId });
        if (error) return false;
        if (seq !== feedSeq) return false;
        const newSet = new Set(get().likedPostIds);
        if (isLiked) newSet.delete(postId); else newSet.add(postId);
        set((s) => ({
          likedPostIds: newSet,
          posts: s.posts.map((p) =>
            p.id === postId
              ? { ...p, isLiked: !isLiked, likesCount: Math.max(0, p.likesCount + (isLiked ? -1 : 1)) }
              : p
          ),
        }));
        return true;
      } catch {
        return false;
      } finally {
        if (seq === feedSeq) set((s) => { const pendingActions = new Set(s.pendingActions); pendingActions.delete(key); return { pendingActions }; });
      }
    },

    toggleSave: async (postId, userId) => {
      const seq = feedSeq;
      const key = `save:${postId}`;
      if (!userId || get().pendingActions.has(key)) return false;
      set((s) => ({ pendingActions: new Set(s.pendingActions).add(key) }));
      const { savedPostIds } = get();
      const isSaved = savedPostIds.has(postId);
      try {
        const { error } = isSaved
          ? await supabase.from('saved_posts').delete().eq('user_id', userId).eq('post_id', postId)
          : await supabase.from('saved_posts').insert({ user_id: userId, post_id: postId });
        if (error) return false;
        if (seq !== feedSeq) return false;
        const newSet = new Set(get().savedPostIds);
        if (isSaved) newSet.delete(postId); else newSet.add(postId);
        set((s) => ({
          savedPostIds: newSet,
          posts: s.posts.map((p) => p.id === postId ? { ...p, isSaved: !isSaved } : p),
        }));
        return true;
      } catch {
        return false;
      } finally {
        if (seq === feedSeq) set((s) => { const pendingActions = new Set(s.pendingActions); pendingActions.delete(key); return { pendingActions }; });
      }
    },
  };
});

// ─── Mapper ───────────────────────────────────────────────────────────────────
function mapPost(likedSet: Set<string>, savedSet: Set<string> = new Set()) {
  return (raw: any): FeedPost => ({
    id: raw.id,
    artistId: raw.artist_id,
    artistName: raw.artists?.blaze ?? 'Artiste',
    artistCity: raw.artists?.city ?? '',
    artistAvatarUrl: raw.artists?.avatar_url ?? null,
    artistIsPremium: raw.artists?.tier === 'premium',
    artistBookingStatus: raw.artists?.booking_status ?? 'closed',
    mediaUrl: raw.media_url,
    mediaType: raw.media_type === 'video' ? 'video' : 'photo',
    thumbnailUrl: raw.thumbnail_url ?? null,
    embedProvider: raw.embed_provider === 'tiktok' || raw.embed_provider === 'instagram' ? raw.embed_provider : null,
    caption: raw.caption,
    styles: raw.styles ?? [],
    likesCount: raw.likes_count ?? 0,
    isLiked: likedSet.has(raw.id),
    isSaved: savedSet.has(raw.id),
    publishedAt: raw.published_at,
  });
}
