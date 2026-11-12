// Data layer for migration 012: booking settings, cancellation and moving,
// nearby search, stories, healed photos, reactions, direct
// messages to an artist and crash reports. The database re-checks every rule.
import { supabase, type Tables } from './supabase';

// ── Booking settings ─────────────────────────────────────────────────────────

export interface BookingSettings {
  timezone: string;
  sessionDurations: number[];
  cancelNoticeHours: number;
  latitude: number | null;
  longitude: number | null;
}

/** Session lengths an artist can offer, in minutes. */
export const DURATION_CHOICES = [60, 120, 180, 240, 360, 480] as const;
export const NOTICE_CHOICES = [0, 24, 48, 72, 168] as const;

/** A short list for the picker; any IANA zone the database knows is accepted. */
export const TIMEZONE_CHOICES = [
  { id: 'Europe/Paris', label: 'Paris, Bruxelles, Genève' },
  { id: 'Europe/London', label: 'Londres, Lisbonne' },
  { id: 'Europe/Berlin', label: 'Berlin, Rome, Madrid' },
  { id: 'America/Toronto', label: 'Montréal, Toronto, New York' },
  { id: 'America/Los_Angeles', label: 'Los Angeles, Vancouver' },
  { id: 'Indian/Reunion', label: 'La Réunion' },
  { id: 'America/Martinique', label: 'Martinique, Guadeloupe' },
  { id: 'Pacific/Noumea', label: 'Nouméa' },
  { id: 'Asia/Tokyo', label: 'Tokyo, Séoul' },
] as const;

export function bookingSettingsError(s: Pick<BookingSettings, 'sessionDurations' | 'cancelNoticeHours'>): string | null {
  const d = s.sessionDurations;
  if (d.length === 0) return 'Choisissez au moins une durée de séance.';
  if (d.length > 6 || d.some((m) => !Number.isInteger(m) || m < 30 || m > 600 || m % 30 !== 0)) return 'Durée de séance invalide.';
  if (!Number.isInteger(s.cancelNoticeHours) || s.cancelNoticeHours < 0 || s.cancelNoticeHours > 336) return 'Délai d’annulation invalide.';
  return null;
}

export async function fetchBookingSettings(artistId: string): Promise<BookingSettings | null> {
  const { data, error } = await supabase
    .from('artists')
    .select('timezone,session_durations,cancel_notice_hours,latitude,longitude')
    .eq('id', artistId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    timezone: data.timezone, sessionDurations: data.session_durations ?? [120], cancelNoticeHours: data.cancel_notice_hours,
    latitude: data.latitude, longitude: data.longitude,
  };
}

export async function saveBookingSettings(s: Pick<BookingSettings, 'timezone' | 'sessionDurations' | 'cancelNoticeHours'>): Promise<string | null> {
  const invalid = bookingSettingsError(s);
  if (invalid) return invalid;
  const { error } = await supabase.rpc('set_booking_settings', {
    p_timezone: s.timezone, p_session_durations: s.sessionDurations,
    p_cancel_notice_hours: s.cancelNoticeHours,
  });
  if (!error) return null;
  if (error.message.includes('invalid_timezone')) return 'Fuseau horaire inconnu.';
  return 'Enregistrement impossible. Réessayez.';
}

/** "2 h", "1 h 30", "Journée (8 h)" */
export function durationLabel(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const base = m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
  return min >= 480 ? `Journée (${base})` : base;
}

export function noticeLabel(hours: number): string {
  if (hours === 0) return 'Sans délai';
  if (hours % 168 === 0) return hours === 168 ? '1 semaine' : `${hours / 168} semaines`;
  if (hours % 24 === 0) return hours === 24 ? '24 h' : `${hours / 24} jours`;
  return `${hours} h`;
}

// ── Location and nearby search ───────────────────────────────────────────────

export interface Coordinates { latitude: number; longitude: number }

/**
 * Looks a city up on Photon (OpenStreetMap data, no key). Only the city name
 * is sent, never the user's position.
 */
export async function geocodeCity(city: string, signal?: AbortSignal): Promise<(Coordinates & { label: string }) | null> {
  const query = city.trim();
  if (query.length < 2 || query.length > 80) return null;
  const response = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=1&layer=city&lang=fr`, { signal });
  if (!response.ok) throw new Error(`geocoding failed: ${response.status}`);
  return parseGeocodeResult(await response.json());
}

export function parseGeocodeResult(json: unknown): (Coordinates & { label: string }) | null {
  const feature = (json as { features?: unknown[] } | null)?.features?.[0] as
    { geometry?: { coordinates?: unknown }; properties?: { name?: unknown; country?: unknown } } | undefined;
  const coords = feature?.geometry?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const [longitude, latitude] = coords as number[];
  if (typeof latitude !== 'number' || typeof longitude !== 'number'
    || !Number.isFinite(latitude) || !Number.isFinite(longitude)
    || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  const name = typeof feature?.properties?.name === 'string' ? feature.properties.name : '';
  const country = typeof feature?.properties?.country === 'string' ? feature.properties.country : '';
  return { latitude, longitude, label: [name, country].filter(Boolean).join(', ') };
}

export async function saveArtistLocation(coords: Coordinates | null): Promise<boolean> {
  const { error } = await supabase.rpc('set_artist_location', {
    p_latitude: coords?.latitude ?? null, p_longitude: coords?.longitude ?? null,
  });
  return !error;
}

export async function fetchNearbyArtistIds(coords: Coordinates, radiusKm = 50): Promise<{ artistId: string; distanceKm: number }[]> {
  const { data, error } = await supabase.rpc('artists_nearby', {
    p_latitude: coords.latitude, p_longitude: coords.longitude, p_radius_km: radiusKm,
  });
  if (error) throw error;
  return (data ?? []).map((r) => ({ artistId: r.artist_id, distanceKm: Number(r.distance_km) }));
}

/** "à 800 m", "à 12 km" */
export function formatDistance(km: number): string {
  if (km < 1) return `à ${Math.max(Math.round(km * 10) * 100, 100)} m`;
  return `à ${Math.round(km).toLocaleString('fr-FR')} km`;
}

// ── Cancel or move a session ─────────────────────────────────────────────────

/** Whether a client may still cancel a confirmed session, given the artist's notice. */
export function canClientCancel(startsAt: string | Date, noticeHours: number, now = new Date()): boolean {
  const start = new Date(startsAt).getTime();
  return start - now.getTime() >= noticeHours * 3_600_000 && start > now.getTime();
}

const CANCEL_ERRORS: Record<string, string> = {
  notice_too_short: 'Le délai d’annulation est dépassé. Écrivez à l’artiste pour trouver une solution.',
  not_cancelable: 'Ce rendez-vous ne peut plus être annulé.',
  already_started: 'La séance a déjà commencé.',
  not_appointment_party: 'Ce rendez-vous ne vous concerne pas.',
};

export async function cancelAppointment(appointmentId: string, reason?: string, newSlots: string[] = []): Promise<string | null> {
  const { error } = await supabase.rpc('cancel_appointment', {
    p_appointment_id: appointmentId, p_reason: reason?.trim() || null, p_new_slots: newSlots,
  });
  if (!error) return null;
  const known = Object.keys(CANCEL_ERRORS).find((k) => error.message.includes(k));
  return known ? CANCEL_ERRORS[known] : 'Action impossible pour le moment. Réessayez.';
}

// ── Stories ──────────────────────────────────────────────────────────────────

export type Story = Tables<'stories'>;
export interface StoryGroup { artistId: string; blaze: string; avatarUrl: string | null; stories: Story[] }

const STORY_LIFETIME_MS = 24 * 3_600_000;

export async function fetchActiveStories(artistIds?: string[]): Promise<StoryGroup[]> {
  let query = supabase
    .from('stories').select('*, artist:artists!artist_id(id,blaze,avatar_url)')
    .gt('expires_at', new Date().toISOString()).order('created_at', { ascending: true }).limit(200);
  if (artistIds) {
    if (artistIds.length === 0) return [];
    query = query.in('artist_id', artistIds);
  }
  const { data, error } = await query;
  if (error) throw error;
  return groupStories((data ?? []) as any[]);
}

/** One ring per artist, the artist with the freshest story first. */
export function groupStories(rows: (Story & { artist?: { id: string; blaze: string; avatar_url: string | null } | null })[]): StoryGroup[] {
  const groups = new Map<string, StoryGroup>();
  for (const row of rows) {
    let group = groups.get(row.artist_id);
    if (!group) {
      group = { artistId: row.artist_id, blaze: row.artist?.blaze ?? 'Artiste', avatarUrl: row.artist?.avatar_url ?? null, stories: [] };
      groups.set(row.artist_id, group);
    }
    group.stories.push(row);
  }
  const latest = (g: StoryGroup) => Math.max(...g.stories.map((s) => new Date(s.created_at).getTime()));
  return [...groups.values()]
    .map((g) => ({ ...g, stories: [...g.stories].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) }))
    .sort((a, b) => latest(b) - latest(a));
}

export async function publishStory(artistId: string, mediaUrl: string, caption?: string): Promise<string | null> {
  const text = caption?.trim() ?? '';
  if (text.length > 200) return 'La légende fait 200 caractères au plus.';
  const { error } = await supabase.from('stories').insert({
    artist_id: artistId, media_url: mediaUrl, caption: text || null,
    expires_at: new Date(Date.now() + STORY_LIFETIME_MS).toISOString(),
  });
  return error ? 'Publication impossible. Réessayez.' : null;
}

export async function deleteStory(id: string): Promise<boolean> {
  const { error } = await supabase.from('stories').delete().eq('id', id);
  return !error;
}

export function recordStoryView(storyId: string): void {
  void supabase.rpc('record_story_view', { p_story_id: storyId }).then(() => {}, () => {});
}

/** "il y a 3 h", "il y a 12 min" */
export function storyAge(createdAt: string, now = new Date()): string {
  const min = Math.max(Math.floor((now.getTime() - new Date(createdAt).getTime()) / 60_000), 0);
  if (min < 1) return 'à l’instant';
  if (min < 60) return `il y a ${min} min`;
  return `il y a ${Math.floor(min / 60)} h`;
}

// ── Healed photos ────────────────────────────────────────────────────────────

export type HealedPhoto = Tables<'healed_photos'>;

export async function fetchArtistHealedPhotos(artistId: string, limit = 12): Promise<HealedPhoto[]> {
  const { data, error } = await supabase
    .from('healed_photos').select('*').eq('artist_id', artistId).eq('is_public', true)
    .order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function fetchAppointmentHealedPhoto(appointmentId: string): Promise<HealedPhoto | null> {
  const { data, error } = await supabase
    .from('healed_photos').select('*').eq('appointment_id', appointmentId).order('created_at', { ascending: false }).limit(1);
  if (error) throw error;
  return data?.[0] ?? null;
}

export async function sendHealedPhoto(appointmentId: string, photoUrl: string, note: string | undefined, isPublic: boolean): Promise<string | null> {
  const { error } = await supabase.from('healed_photos').insert({
    appointment_id: appointmentId, photo_url: photoUrl, note: note?.trim() || null, is_public: isPublic,
  });
  if (!error) return null;
  if (error.message.includes('not_completed_session')) return 'La photo cicatrisée s’envoie une fois la séance terminée.';
  return 'Envoi impossible. Réessayez.';
}

export async function setHealedPhotoPublic(id: string, isPublic: boolean): Promise<boolean> {
  const { error } = await supabase.from('healed_photos').update({ is_public: isPublic }).eq('id', id);
  return !error;
}

// ── Reactions ────────────────────────────────────────────────────────────────

export type ReactionKey = Tables<'post_reactions'>['emoji'];
export const REACTIONS: { key: ReactionKey; emoji: string; label: string }[] = [
  { key: 'fire', emoji: '🔥', label: 'Incroyable' },
  { key: 'heart_eyes', emoji: '😍', label: 'J’adore' },
  { key: 'clap', emoji: '👏', label: 'Bravo' },
  { key: 'mind_blown', emoji: '🤯', label: 'Bluffant' },
  { key: 'black_heart', emoji: '🖤', label: 'Coup de cœur' },
];

export type ReactionCounts = Partial<Record<ReactionKey, number>>;

export async function fetchReactionCounts(postIds: string[]): Promise<Record<string, ReactionCounts>> {
  const ids = [...new Set(postIds)].slice(0, 60);
  if (ids.length === 0) return {};
  const { data, error } = await supabase.rpc('post_reaction_counts', { p_post_ids: ids });
  if (error) throw error;
  const out: Record<string, ReactionCounts> = {};
  for (const r of data ?? []) (out[r.post_id] ??= {})[r.emoji] = r.total;
  return out;
}

export async function fetchMyReactions(userId: string, postIds: string[]): Promise<Record<string, ReactionKey>> {
  if (postIds.length === 0) return {};
  const { data, error } = await supabase.from('post_reactions').select('post_id,emoji').eq('user_id', userId).in('post_id', postIds.slice(0, 60));
  if (error) throw error;
  return Object.fromEntries((data ?? []).map((r) => [r.post_id, r.emoji]));
}

/** Sets, changes or (with null) removes the caller's reaction. */
export async function setReaction(userId: string, postId: string, emoji: ReactionKey | null): Promise<boolean> {
  const { error } = emoji
    ? await supabase.from('post_reactions').upsert({ post_id: postId, user_id: userId, emoji }, { onConflict: 'post_id,user_id' })
    : await supabase.from('post_reactions').delete().eq('post_id', postId).eq('user_id', userId);
  return !error;
}

/** Counts after the caller moves from `previous` to `next`, without waiting for the server. */
export function applyReaction(counts: ReactionCounts, previous: ReactionKey | null, next: ReactionKey | null): ReactionCounts {
  const out: ReactionCounts = { ...counts };
  if (previous === next) return out;
  if (previous) {
    const left = (out[previous] ?? 0) - 1;
    if (left > 0) out[previous] = left; else delete out[previous];
  }
  if (next) out[next] = (out[next] ?? 0) + 1;
  return out;
}

export const totalReactions = (counts: ReactionCounts | undefined) =>
  Object.values(counts ?? {}).reduce((sum, n) => sum + (n ?? 0), 0);

// ── Write to an artist ───────────────────────────────────────────────────────

export const MESSAGE_MAX = 1000;

export async function contactArtist(artistId: string, message: string): Promise<{ requestId: string | null; error: string | null }> {
  const text = message.trim();
  if (text.length < 2) return { requestId: null, error: 'Écrivez votre message.' };
  if (text.length > MESSAGE_MAX) return { requestId: null, error: `Le message fait ${MESSAGE_MAX} caractères au plus.` };
  const { data, error } = await supabase.rpc('contact_artist', { p_artist_id: artistId, p_message: text });
  if (!error && data) return { requestId: data, error: null };
  if (error?.message.includes('too_many_threads')) return { requestId: null, error: 'Vous avez ouvert beaucoup de conversations aujourd’hui. Réessayez demain.' };
  if (error?.message.includes('artist_not_found')) return { requestId: null, error: 'Cet artiste est introuvable.' };
  return { requestId: null, error: 'Envoi impossible. Réessayez.' };
}

// ── Crash reports ────────────────────────────────────────────────────────────

const reported = new Set<string>();

/** Sends a crash once per message and per session; never throws. */
export function reportError(error: unknown, context: { route?: string; platform?: string; appVersion?: string } = {}): void {
  try {
    const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    if (!message.trim() || reported.has(message) || reported.size >= 10) return;
    reported.add(message);
    const stack = error instanceof Error ? error.stack ?? null : null;
    void supabase.rpc('report_client_error', {
      p_message: message, p_stack: stack, p_route: context.route ?? null,
      p_platform: context.platform ?? null, p_app_version: context.appVersion ?? null,
    }).then(() => {}, () => {});
  } catch {
    // Reporting must never break the app.
  }
}

export type ClientError = Tables<'client_errors'>;

export async function fetchClientErrors(limit = 50): Promise<ClientError[]> {
  const { data, error } = await supabase.from('client_errors').select('*').order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function clearClientErrors(): Promise<boolean> {
  const { error } = await supabase.from('client_errors').delete().lt('created_at', new Date().toISOString());
  return !error;
}
