import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { Tables } from '@/lib/supabase';

export type RequestStatus =
  | 'submitted' | 'accepted' | 'declined'
  | 'clarification_needed' | 'confirmed' | 'completed' | 'archived';

export interface TattooRequest {
  id: string;
  clientId: string | null;
  artistId: string;
  projectType: 'new' | 'cover_up' | 'touch_up' | 'extension';
  bodyZone: string;
  sizeCategory: 'xs' | 's' | 'm' | 'l' | 'xl';
  budgetMin: number | null;
  budgetMax: number | null;
  budgetUnknown: boolean;
  colorPreference: 'black_grey' | 'color' | 'artist_choice';
  stylePreference: string | null;
  description: string;
  flexibilityLevel: 'precise' | 'open' | 'full_trust';
  isFirstTattoo: boolean;
  status: RequestStatus;
  declineReason: string | null;
  artistNotes: string | null;
  submittedAt: string;
  acceptedAt: string | null;
  // Joined
  clientName?: string;
  clientAvatarUrl?: string | null;
  artistName?: string;
  artistAvatarUrl?: string | null;
  artistCity?: string;
  references?: string[];
  unreadCount?: number;
}

interface RequestState {
  requests: TattooRequest[];
  isLoading: boolean;

  fetchRequests: (userId: string, role: 'user' | 'artist') => Promise<void>;
  submitRequest: (payload: SubmitPayload, userId: string) => Promise<{ id: string | null; error: string | null }>;
  updateStatus: (requestId: string, status: RequestStatus, extra?: { declineReason?: string; artistNotes?: string }) => Promise<void>;
  getRequest: (id: string) => TattooRequest | undefined;
}

export interface SubmitPayload {
  artistId: string;
  projectType: 'new' | 'cover_up' | 'touch_up' | 'extension';
  bodyZone: string;
  sizeCategory: 'xs' | 's' | 'm' | 'l' | 'xl';
  budgetMin?: number;
  budgetMax?: number;
  budgetUnknown?: boolean;
  colorPreference: 'black_grey' | 'color' | 'artist_choice';
  stylePreference?: string;
  description: string;
  flexibilityLevel: 'precise' | 'open' | 'full_trust';
  isFirstTattoo?: boolean;
  referenceUris?: string[];
}

function mapRequest(raw: any): TattooRequest {
  return {
    id: raw.id,
    clientId: raw.client_id,
    artistId: raw.artist_id,
    projectType: raw.project_type,
    bodyZone: raw.body_zone,
    sizeCategory: raw.size_category,
    budgetMin: raw.budget_min,
    budgetMax: raw.budget_max,
    budgetUnknown: raw.budget_unknown ?? false,
    colorPreference: raw.color_preference,
    stylePreference: raw.style_preference,
    description: raw.description,
    flexibilityLevel: raw.flexibility_level,
    isFirstTattoo: raw.is_first_tattoo ?? false,
    status: raw.status,
    declineReason: raw.decline_reason,
    artistNotes: raw.artist_notes,
    submittedAt: raw.submitted_at,
    acceptedAt: raw.accepted_at,
    clientName: raw.profiles?.display_name ?? raw.client_name,
    clientAvatarUrl: raw.profiles?.avatar_url ?? null,
    artistName: raw.artists?.blaze ?? raw.artist_name,
    artistAvatarUrl: raw.artists?.avatar_url ?? null,
    artistCity: raw.artists?.city ?? '',
    references: (raw.request_references ?? []).map((r: any) => r.url),
  };
}

export const useRequestStore = create<RequestState>((set, get) => ({
  requests: [],
  isLoading: false,

  fetchRequests: async (userId, role) => {
    set({ isLoading: true });
    try {
      let query;
      if (role === 'artist') {
        // Get artist id first
        const { data: artist } = await supabase
          .from('artists').select('id').eq('profile_id', userId).single();
        if (!artist) { set({ isLoading: false }); return; }
        query = supabase
          .from('tattoo_requests')
          .select(`*, profiles!client_id(display_name, avatar_url), request_references(url)`)
          .eq('artist_id', artist.id)
          .order('submitted_at', { ascending: false });
      } else {
        query = supabase
          .from('tattoo_requests')
          .select(`*, artists!artist_id(blaze, avatar_url, city), request_references(url)`)
          .eq('client_id', userId)
          .order('submitted_at', { ascending: false });
      }
      const { data, error } = await query;
      if (error) throw error;
      set({ requests: (data ?? []).map(mapRequest), isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  submitRequest: async (payload, userId) => {
    try {
      const { referenceUris, ...rest } = payload;
      const { data, error } = await supabase
        .from('tattoo_requests')
        .insert({
          client_id: userId,
          artist_id: rest.artistId,
          project_type: rest.projectType,
          body_zone: rest.bodyZone,
          size_category: rest.sizeCategory,
          budget_min: rest.budgetMin ?? null,
          budget_max: rest.budgetMax ?? null,
          budget_unknown: rest.budgetUnknown ?? false,
          color_preference: rest.colorPreference,
          style_preference: rest.stylePreference ?? null,
          description: rest.description,
          flexibility_level: rest.flexibilityLevel,
          is_first_tattoo: rest.isFirstTattoo ?? false,
          status: 'submitted',
        })
        .select()
        .single();
      if (error) return { id: null, error: error.message };

      // Upload references if any
      if (referenceUris?.length) {
        const { uploadReference } = await import('@/lib/storage');
        const uploads = await Promise.all(
          referenceUris.map((uri, i) => uploadReference(uri, data.id, i))
        );
        await supabase.from('request_references').insert(
          uploads.map((u) => ({ request_id: data.id, url: u.url }))
        );
      }

      await get().fetchRequests(userId, 'user');
      return { id: data.id, error: null };
    } catch (e: any) {
      return { id: null, error: e.message };
    }
  },

  updateStatus: async (requestId, status, extra) => {
    const updates: Record<string, unknown> = { status };
    if (status === 'accepted') updates.accepted_at = new Date().toISOString();
    if (status === 'confirmed') updates.confirmed_at = new Date().toISOString();
    if (status === 'completed') updates.completed_at = new Date().toISOString();
    if (extra?.declineReason) updates.decline_reason = extra.declineReason;
    if (extra?.artistNotes) updates.artist_notes = extra.artistNotes;
    await supabase.from('tattoo_requests').update(updates).eq('id', requestId);
    set((s) => ({
      requests: s.requests.map((r) =>
        r.id === requestId ? { ...r, status, ...extra } : r
      ),
    }));
  },

  getRequest: (id) => get().requests.find((r) => r.id === id),
}));
