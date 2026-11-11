import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

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

interface FeedState {
  posts: FeedPost[];
  isLoading: boolean;
  isRefreshing: boolean;
  hasMore: boolean;
  cursor: string | null;
  error: string | null;
  pendingActions: Set<string>;
  likedPostIds: Set<string>;
  savedPostIds: Set<string>;

  fetchFeed: (userId?: string) => Promise<void>;
  fetchMore: (userId?: string) => Promise<void>;
  refresh: (userId?: string) => Promise<void>;
  toggleLike: (postId: string, userId: string) => Promise<boolean>;
  toggleSave: (postId: string, userId: string) => Promise<boolean>;
}

const PAGE_SIZE = 12;

export const useFeedStore = create<FeedState>((set, get) => ({
  posts: [],
  isLoading: false,
  isRefreshing: false,
  hasMore: true,
  cursor: null,
  error: null,
  pendingActions: new Set(),
  likedPostIds: new Set(),
  savedPostIds: new Set(),

  fetchFeed: async (userId) => {
    set({ isLoading: true, cursor: null, hasMore: true, error: null });
    try {
      let query = supabase
        .from('posts')
        // "*" on purpose: the reel columns (migration 010) are read when they exist
        // without making the feed depend on that migration being applied.
        .select(`
          *,
          artists!posts_artist_id_fkey!inner (
            id, blaze, city, avatar_url, tier, profile_id, booking_status
          )
        `)
        .eq('is_published', true)
        .order('published_at', { ascending: false })
        .limit(PAGE_SIZE);

      const { data, error } = await query;
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

      const posts = (data ?? []).map(mapPost(likedSet, savedSet));
      set({
        posts,
        isLoading: false,
        likedPostIds: likedSet,
        savedPostIds: savedSet,
        cursor: posts.at(-1)?.publishedAt ?? null,
        hasMore: posts.length === PAGE_SIZE,
      });
    } catch {
      set({ isLoading: false, error: 'Impossible de charger les publications. Réessaie dans un instant.' });
    }
  },

  fetchMore: async (userId) => {
    const { isLoading, hasMore, cursor, posts, likedPostIds, savedPostIds } = get();
    if (isLoading || !hasMore || !cursor) return;
    set({ isLoading: true });
    try {
      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          artists!posts_artist_id_fkey!inner (id, blaze, city, avatar_url, tier, profile_id, booking_status)
        `)
        .eq('is_published', true)
        .lt('published_at', cursor)
        .order('published_at', { ascending: false })
        .limit(PAGE_SIZE);
      if (error) throw error;
      const newPosts = (data ?? []).map(mapPost(likedPostIds, savedPostIds));
      set({
        posts: [...posts, ...newPosts],
        isLoading: false,
        cursor: newPosts.at(-1)?.publishedAt ?? cursor,
        hasMore: newPosts.length === PAGE_SIZE,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  refresh: async (userId) => {
    set({ isRefreshing: true });
    await get().fetchFeed(userId);
    set({ isRefreshing: false });
  },

  toggleLike: async (postId, userId) => {
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
      set((s) => { const pendingActions = new Set(s.pendingActions); pendingActions.delete(key); return { pendingActions }; });
    }
  },

  toggleSave: async (postId, userId) => {
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
      set((s) => { const pendingActions = new Set(s.pendingActions); pendingActions.delete(key); return { pendingActions }; });
    }
  },
}));

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
