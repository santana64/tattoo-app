import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

export interface FeedPost {
  id: string;
  artistId: string;
  artistName: string;
  artistCity: string;
  artistAvatarUrl: string | null;
  artistIsPremium: boolean;
  mediaUrl: string;
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
  likedPostIds: Set<string>;
  savedPostIds: Set<string>;

  fetchFeed: (userId?: string) => Promise<void>;
  fetchMore: (userId?: string) => Promise<void>;
  refresh: (userId?: string) => Promise<void>;
  toggleLike: (postId: string, userId: string) => Promise<void>;
  toggleSave: (postId: string, userId: string) => Promise<void>;
}

const PAGE_SIZE = 12;

export const useFeedStore = create<FeedState>((set, get) => ({
  posts: [],
  isLoading: false,
  isRefreshing: false,
  hasMore: true,
  cursor: null,
  likedPostIds: new Set(),
  savedPostIds: new Set(),

  fetchFeed: async (userId) => {
    set({ isLoading: true, cursor: null, hasMore: true });
    try {
      let query = supabase
        .from('posts')
        .select(`
          id, media_url, caption, styles, likes_count, published_at, artist_id,
          artists!inner (
            id, blaze, city, avatar_url, tier, profile_id
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
      set({ isLoading: false });
    }
  },

  fetchMore: async (userId) => {
    const { isLoading, hasMore, cursor, posts, likedPostIds } = get();
    if (isLoading || !hasMore || !cursor) return;
    set({ isLoading: true });
    try {
      const { data, error } = await supabase
        .from('posts')
        .select(`
          id, media_url, caption, styles, likes_count, published_at, artist_id,
          artists!inner (id, blaze, city, avatar_url, tier, profile_id)
        `)
        .eq('is_published', true)
        .lt('published_at', cursor)
        .order('published_at', { ascending: false })
        .limit(PAGE_SIZE);
      if (error) throw error;
      const newPosts = (data ?? []).map(mapPost(likedPostIds));
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
    const { likedPostIds } = get();
    const isLiked = likedPostIds.has(postId);
    // Optimistic update
    const newSet = new Set(likedPostIds);
    if (isLiked) newSet.delete(postId); else newSet.add(postId);
    set((s) => ({
      likedPostIds: newSet,
      posts: s.posts.map((p) =>
        p.id === postId
          ? { ...p, isLiked: !isLiked, likesCount: p.likesCount + (isLiked ? -1 : 1) }
          : p
      ),
    }));
    // Persist
    if (isLiked) {
      await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', userId);
    } else {
      await supabase.from('post_likes').insert({ post_id: postId, user_id: userId });
    }
  },

  toggleSave: async (postId, userId) => {
    const { savedPostIds, posts } = get();
    const isSaved = savedPostIds.has(postId);
    const newSet = new Set(savedPostIds);
    if (isSaved) newSet.delete(postId); else newSet.add(postId);
    set({
      savedPostIds: newSet,
      posts: posts.map((p) => p.id === postId ? { ...p, isSaved: !isSaved } : p),
    });
    if (isSaved) {
      await supabase.from('saved_posts').delete().eq('user_id', userId).eq('post_id', postId);
    } else {
      await supabase.from('saved_posts').insert({ user_id: userId, post_id: postId });
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
    mediaUrl: raw.media_url,
    caption: raw.caption,
    styles: raw.styles ?? [],
    likesCount: raw.likes_count ?? 0,
    isLiked: likedSet.has(raw.id),
    isSaved: savedSet.has(raw.id),
    publishedAt: raw.published_at,
  });
}
