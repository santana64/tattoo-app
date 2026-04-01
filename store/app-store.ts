import { create } from 'zustand';
import { POSTS, REQUESTS, APPOINTMENTS } from '@/constants/mock-data';
import type { Post, TattooRequest, Appointment } from '@/constants/mock-data';

interface AppState {
  posts: Post[];
  requests: TattooRequest[];
  appointments: Appointment[];
  savedPostIds: Set<string>;
  savedArtistIds: Set<string>;

  // Feed actions
  toggleLike: (postId: string) => void;
  toggleSavePost: (postId: string) => void;
  toggleSaveArtist: (artistId: string) => void;

  // Request actions
  submitRequest: (request: TattooRequest) => void;
  updateRequestStatus: (requestId: string, status: TattooRequest['status']) => void;
}

export const useAppStore = create<AppState>((set) => ({
  posts: POSTS,
  requests: REQUESTS,
  appointments: APPOINTMENTS,
  savedPostIds: new Set(['p2']),
  savedArtistIds: new Set(),

  toggleLike: (postId) =>
    set((state) => ({
      posts: state.posts.map((p) =>
        p.id === postId
          ? { ...p, isLiked: !p.isLiked, likes: p.isLiked ? p.likes - 1 : p.likes + 1 }
          : p
      ),
    })),

  toggleSavePost: (postId) =>
    set((state) => {
      const next = new Set(state.savedPostIds);
      next.has(postId) ? next.delete(postId) : next.add(postId);
      return { savedPostIds: next };
    }),

  toggleSaveArtist: (artistId) =>
    set((state) => {
      const next = new Set(state.savedArtistIds);
      next.has(artistId) ? next.delete(artistId) : next.add(artistId);
      return { savedArtistIds: next };
    }),

  submitRequest: (request) =>
    set((state) => ({ requests: [request, ...state.requests] })),

  updateRequestStatus: (requestId, status) =>
    set((state) => ({
      requests: state.requests.map((r) =>
        r.id === requestId ? { ...r, status } : r
      ),
    })),
}));
