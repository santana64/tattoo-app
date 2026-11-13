import { create } from 'zustand';
import { supabase, type Tables } from '@/lib/supabase';
import { isUuid } from '@/lib/catalog';
import { normalizePreferredSlots } from '@/lib/studio';

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
  /** Up to three start instants (ISO) the client would like, soonest first. */
  preferredSlots: string[];
  flashDesignId: string | null;
  isFlash: boolean;
  /**
   * A question written to the artist without a project (contact_artist). Its
   * project fields are placeholders and it is answered in the conversation.
   */
  isInquiry: boolean;
}

interface RequestState {
  requests: TattooRequest[];
  isLoading: boolean;
  error: string | null;
  fetchRequest: (id: string, userId: string) => Promise<TattooRequest | null>;

  /** `silent` refreshes in place without toggling the loading state (focus, realtime). */
  fetchRequests: (userId: string, role: 'user' | 'artist', opts?: { silent?: boolean }) => Promise<void>;
  submitRequest: (payload: SubmitPayload, userId: string, requestId?: string) => Promise<{ id: string | null; error: string | null }>;
  updateStatus: (requestId: string, status: RequestStatus, extra?: { declineReason?: string; artistNotes?: string }) => Promise<{ error: string | null }>;
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
  /** Start instants picked from the artist's free slots; normalised to three future ones. */
  preferredSlots?: string[];
  /** A published flash of the same artist; the database refuses it once sold out. */
  flashDesignId?: string | null;
}

type RequestRow = Tables<'tattoo_requests'> & {
  profiles?: { display_name: string; avatar_url: string | null } | null;
  artists?: { blaze: string; avatar_url: string | null; city: string } | null;
  request_references?: { url: string }[];
};
function mapRequest(raw: RequestRow): TattooRequest {
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
    submittedAt: raw.submitted_at ?? raw.created_at ?? '',
    acceptedAt: raw.accepted_at,
    clientName: raw.profiles?.display_name ?? 'Client',
    clientAvatarUrl: raw.profiles?.avatar_url ?? null,
    artistName: raw.artists?.blaze ?? 'Artiste',
    artistAvatarUrl: raw.artists?.avatar_url ?? null,
    artistCity: raw.artists?.city ?? '',
    references: (raw.request_references ?? []).map((r) => r.url),
    preferredSlots: raw.preferred_slots ?? [],
    flashDesignId: raw.flash_design_id ?? null,
    isFlash: raw.is_flash ?? false,
    isInquiry: raw.is_inquiry ?? false,
  };
}

export const useRequestStore = create<RequestState>((set, get) => ({
  requests: [],
  isLoading: false,
  error: null,
  fetchRequest: async (id, userId) => {
    if (!isUuid(id) || !isUuid(userId)) return null;
    const { data, error } = await supabase.from('tattoo_requests')
      .select('*, profiles!client_id(display_name,avatar_url), artists!artist_id(blaze,avatar_url,city), request_references(url)')
      .eq('id', id).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    if (data.client_id !== userId) {
      const { data: owner, error: ownerError } = await supabase.from('artists').select('id').eq('id', data.artist_id).eq('profile_id', userId).maybeSingle();
      if (ownerError) throw ownerError;
      if (!owner) return null;
    }
    const request = mapRequest(data);
    set(s => ({ requests: [...s.requests.filter(r => r.id !== id), request] }));
    return request;
  },

  fetchRequests: async (userId, role, opts) => {
    if (!opts?.silent) set({ isLoading: true, error: null });
    try {
      let query;
      if (role === 'artist') {
        // Get artist id first
        const { data: artist } = await supabase
          .from('artists').select('id').eq('profile_id', userId).single();
        if (!artist) { set({ requests: [], isLoading: false }); return; }
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
      // A failed background refresh keeps what is on screen.
      if (opts?.silent) return;
      set({ requests: [], isLoading: false, error: "Impossible de charger les demandes." });
    }
  },

  submitRequest: async (payload, userId, requestId) => {
    try {
      if (!isUuid(userId) || !isUuid(payload.artistId) || (requestId && !isUuid(requestId))) return { id: null, error: 'Identifiant invalide.' };
      if (!payload.description.trim() || (payload.budgetMin != null && (!Number.isFinite(payload.budgetMin) || payload.budgetMin < 0)) || (payload.budgetMax != null && (!Number.isFinite(payload.budgetMax) || payload.budgetMax < (payload.budgetMin ?? 0)))) return { id: null, error: 'Description ou budget invalide.' };
      const { data: artist, error: artistError } = await supabase.from('artists').select('booking_status').eq('id', payload.artistId).maybeSingle();
      if (artistError || !artist || artist.booking_status !== 'open') return { id: null, error: 'Cet artiste ne peut pas recevoir de demande actuellement.' };
      const { referenceUris, ...rest } = payload;
      // References need an atomic upload workflow; reject before inserting to avoid duplicate requests on retry.
      if (referenceUris?.length) return { id: null, error: 'Les pièces jointes ne sont pas encore disponibles.' };
      const { data, error } = await supabase
        .from('tattoo_requests')
        .insert({
          ...(requestId ? { id: requestId } : {}),
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
          preferred_slots: normalizePreferredSlots(rest.preferredSlots ?? []),
          flash_design_id: rest.flashDesignId ?? null,
          status: 'submitted',
        })
        .select()
        .single();
      if (error) {
        if (requestId && error.code === '23505') {
          const { data: existing, error: lookupError } = await supabase.from('tattoo_requests')
            .select('id,client_id,artist_id').eq('id', requestId).maybeSingle();
          if (!lookupError && existing?.client_id === userId && existing.artist_id === payload.artistId) {
            await get().fetchRequests(userId, 'user');
            return { id: existing.id, error: null };
          }
          return { id: null, error: 'Cette demande existe déjà ou n’est plus accessible.' };
        }
        if (error.message.includes('flash_unavailable')) return { id: null, error: 'Ce flash n’est plus disponible.' };
        return { id: null, error: error.message };
      }

      await get().fetchRequests(userId, 'user');
      return { id: data.id, error: null };
    } catch (e: any) {
      return { id: null, error: e.message };
    }
  },

  updateStatus: async (requestId, status, extra) => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) return { error: 'Reconnectez-vous pour continuer.' };
      const request = await get().fetchRequest(requestId, user.id);
      if (!request) return { error: 'Demande introuvable.' };
      // A question has no project to accept or decline: it is answered in the conversation.
      if (request.isInquiry) return { error: 'Une question se traite dans la conversation.' };
      const { data: owner, error: ownerError } = await supabase.from('artists').select('id').eq('id', request.artistId).eq('profile_id', user.id).maybeSingle();
      if (ownerError || !owner) return { error: 'Seul l’artiste destinataire peut modifier cette demande.' };
      const allowed = (request.status === 'submitted' || request.status === 'clarification_needed') && ['accepted', 'declined', 'clarification_needed'].includes(status) && request.status !== status;
      if (!allowed) return { error: 'Ce changement de statut n’est pas disponible.' };
      const updates: Partial<Tables<'tattoo_requests'>> = { status };
      if (status === 'accepted') updates.accepted_at = new Date().toISOString();
      if (extra?.declineReason) updates.decline_reason = extra.declineReason;
      if (extra?.artistNotes) updates.artist_notes = extra.artistNotes;
      const { data, error } = await supabase.from('tattoo_requests').update(updates).eq('id', requestId).eq('artist_id', owner.id).eq('status', request.status).select('id').maybeSingle();
      if (error || !data) return { error: 'Modification non enregistrée. Rechargez la demande et réessayez.' };
      set(s => ({ requests: s.requests.map(r => r.id === requestId ? { ...r, status, ...extra } : r) }));
      return { error: null };
    } catch { return { error: 'Connexion impossible. La demande n’a pas été modifiée.' }; }
  },

  getRequest: (id) => get().requests.find((r) => r.id === id),
}));
