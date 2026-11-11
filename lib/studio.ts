// Data layer for booking (opening hours, free slots), social (follows,
// waitlist, public numbers) and gallery (flashes, guest spots, series).
// Every write is checked again by the database (migration 011).
import { supabase, type Tables } from './supabase';

export type WeeklyScheduleRow = Tables<'artist_weekly_schedule'>;
export type FlashDesign = Tables<'flash_designs'>;
export type GuestSpot = Tables<'guest_spots'>;
export type ArtistSeries = Tables<'artist_series'>;

// ── Opening hours ────────────────────────────────────────────────────────────

/** 0 = Sunday … 6 = Saturday, as in the database and Date#getDay(). */
export interface DayHours { day: number; opens: string; closes: string }

/** Monday first, the way a French week is read. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
export const DAY_NAMES = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'] as const;

const toMinutes = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
};

/** Mirrors the database rule: a day must stay open for at least one hour. */
export function scheduleError(days: DayHours[]): string | null {
  const seen = new Set<number>();
  for (const d of days) {
    if (!Number.isInteger(d.day) || d.day < 0 || d.day > 6 || seen.has(d.day)) return 'Jour invalide.';
    seen.add(d.day);
    if (!/^\d{2}:\d{2}$/.test(d.opens) || !/^\d{2}:\d{2}$/.test(d.closes)) return 'Horaire invalide.';
    if (toMinutes(d.closes) < toMinutes(d.opens) + 60) {
      return `${DAY_NAMES[d.day]} : la fermeture doit suivre l’ouverture d’au moins une heure.`;
    }
  }
  return null;
}

export async function fetchWeeklySchedule(artistId: string): Promise<DayHours[]> {
  const { data, error } = await supabase
    .from('artist_weekly_schedule')
    .select('day_of_week,opens_at,closes_at,is_active')
    .eq('artist_id', artistId);
  if (error) throw error;
  return (data ?? [])
    .filter((r) => r.is_active)
    .map((r) => ({ day: r.day_of_week, opens: r.opens_at.slice(0, 5), closes: r.closes_at.slice(0, 5) }));
}

export async function saveWeeklySchedule(days: DayHours[]): Promise<string | null> {
  const invalid = scheduleError(days);
  if (invalid) return invalid;
  const { error } = await supabase.rpc('set_weekly_schedule', { p_days: days });
  if (!error) return null;
  if (error.message.includes('not_artist')) return 'Seul un artiste peut régler des horaires.';
  if (error.message.includes('invalid_schedule')) return 'Ces horaires ne sont pas valides.';
  return 'Enregistrement impossible. Réessayez.';
}

// ── Blocked periods (holidays, conventions) ──────────────────────────────────

export type BlockedPeriod = Pick<Tables<'artist_availability'>, 'id' | 'starts_at' | 'ends_at' | 'label'>;

export async function fetchBlockedPeriods(artistId: string): Promise<BlockedPeriod[]> {
  const { data, error } = await supabase
    .from('artist_availability')
    .select('id,starts_at,ends_at,label')
    .eq('artist_id', artistId)
    .eq('is_blocked', true)
    .gte('ends_at', new Date().toISOString())
    .order('starts_at');
  if (error) throw error;
  return data ?? [];
}

/** Blocks whole local days, `from` and `to` included. */
export async function blockDays(artistId: string, from: Date, to: Date, label?: string): Promise<string | null> {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate() + 1);
  if (end <= start) return 'La fin doit suivre le début.';
  const { error } = await supabase.from('artist_availability').insert({
    artist_id: artistId, starts_at: start.toISOString(), ends_at: end.toISOString(),
    is_blocked: true, label: label?.trim() || null,
  });
  return error ? 'Impossible de bloquer cette période. Réessayez.' : null;
}

export async function unblockPeriod(id: string): Promise<string | null> {
  const { error } = await supabase.from('artist_availability').delete().eq('id', id);
  return error ? 'Suppression impossible. Réessayez.' : null;
}

// ── Free slots ───────────────────────────────────────────────────────────────

export interface FreeSlot { start: Date; end: Date }
export interface SlotDay { key: string; date: Date; slots: FreeSlot[] }

export async function fetchFreeSlots(artistId: string, days = 28, durationMin = 120): Promise<FreeSlot[]> {
  const { data, error } = await supabase.rpc('artist_free_slots', {
    p_artist_id: artistId, p_days: days, p_duration_min: durationMin,
  });
  if (error) throw error;
  return (data ?? []).map((s) => ({ start: new Date(s.starts_at), end: new Date(s.ends_at) }));
}

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Groups slots by local calendar day, in chronological order. */
export function groupSlotsByDay(slots: FreeSlot[]): SlotDay[] {
  const days = new Map<string, SlotDay>();
  for (const slot of [...slots].sort((a, b) => a.start.getTime() - b.start.getTime())) {
    const key = dayKey(slot.start);
    let day = days.get(key);
    if (!day) {
      day = { key, date: new Date(slot.start.getFullYear(), slot.start.getMonth(), slot.start.getDate()), slots: [] };
      days.set(key, day);
    }
    day.slots.push(slot);
  }
  return [...days.values()];
}

const DAY_MS = 86_400_000;
const shortDate = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
const hourFmt = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });

export const formatSlotTime = (d: Date) => hourFmt.format(d);

/** "demain", "jeu. 14 nov." — how soon the next session can happen. */
export function formatNextSlot(next: Date | string | null | undefined, now = new Date()): string | null {
  if (!next) return null;
  const date = new Date(next);
  if (Number.isNaN(date.getTime())) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const that = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diff = Math.round((that - today) / DAY_MS);
  if (diff <= 0) return 'aujourd’hui';
  if (diff === 1) return 'demain';
  return shortDate.format(date);
}

/** Keeps at most three future, distinct slots, soonest first — what a request may carry. */
export function normalizePreferredSlots(slots: (Date | string)[], now = new Date()): string[] {
  const unique = new Set<number>();
  for (const s of slots) {
    const t = new Date(s).getTime();
    if (!Number.isNaN(t) && t > now.getTime()) unique.add(t);
  }
  return [...unique].sort((a, b) => a - b).slice(0, 3).map((t) => new Date(t).toISOString());
}

// ── Public numbers ───────────────────────────────────────────────────────────

export interface ArtistStats {
  ratingAvg: number | null;
  ratingCount: number;
  followers: number;
  flashCount: number;
  nextSlot: string | null;
}

export async function fetchArtistStats(artistIds: string[]): Promise<Record<string, ArtistStats>> {
  const ids = [...new Set(artistIds)].slice(0, 60);
  if (ids.length === 0) return {};
  const { data, error } = await supabase.rpc('artist_public_stats', { p_artist_ids: ids });
  if (error) throw error;
  const out: Record<string, ArtistStats> = {};
  for (const r of data ?? []) {
    out[r.artist_id] = {
      ratingAvg: r.rating_avg === null ? null : Number(r.rating_avg),
      ratingCount: r.rating_count, followers: r.followers, flashCount: r.flash_count, nextSlot: r.next_slot,
    };
  }
  return out;
}

/** "4,8" — French decimal comma, one digit. */
export const formatRating = (avg: number) => avg.toFixed(1).replace('.', ',');

export function formatCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10_000) return `${(n / 1000).toFixed(1).replace('.', ',').replace(',0', '')} k`;
  return `${Math.round(n / 1000)} k`;
}

// ── Reviews ──────────────────────────────────────────────────────────────────

export interface PublicReview { id: string; rating: number; comment: string | null; createdAt: string | null; author: string; avatarUrl: string | null }

export async function fetchArtistReviews(artistId: string, limit = 6): Promise<PublicReview[]> {
  const { data, error } = await supabase
    .from('reviews')
    .select('id,rating,comment,created_at,profiles!client_id(display_name,avatar_url)')
    .eq('artist_id', artistId)
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id, rating: r.rating, comment: r.comment, createdAt: r.created_at,
    author: firstNameOnly(r.profiles?.display_name), avatarUrl: r.profiles?.avatar_url ?? null,
  }));
}

/** Reviews are public: show "Camille D." rather than a full name. */
export function firstNameOnly(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Client';
  return parts.length === 1 ? parts[0] : `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

// ── Follows and waitlist ─────────────────────────────────────────────────────

export async function fetchFollowedArtistIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase.from('artist_follows').select('artist_id').eq('follower_id', userId);
  if (error) throw error;
  return (data ?? []).map((r) => r.artist_id);
}

export async function setFollow(userId: string, artistId: string, follow: boolean): Promise<boolean> {
  const { error } = follow
    ? await supabase.from('artist_follows').upsert({ follower_id: userId, artist_id: artistId }, { onConflict: 'follower_id,artist_id', ignoreDuplicates: true })
    : await supabase.from('artist_follows').delete().eq('follower_id', userId).eq('artist_id', artistId);
  return !error;
}

export async function isOnWaitlist(userId: string, artistId: string): Promise<boolean> {
  const { data } = await supabase
    .from('artist_waitlist').select('id').eq('user_id', userId).eq('artist_id', artistId).eq('status', 'active').limit(1);
  return (data ?? []).length > 0;
}

export async function setWaitlist(artistId: string, join: boolean): Promise<boolean> {
  const { error } = await supabase.rpc('set_waitlist', { p_artist_id: artistId, p_join: join });
  return !error;
}

// ── Flashes ──────────────────────────────────────────────────────────────────

export const flashCopiesLeft = (f: Pick<FlashDesign, 'total_copies' | 'sold_copies'>) => Math.max(f.total_copies - f.sold_copies, 0);

export async function fetchArtistFlashes(artistId: string, includeDrafts = false): Promise<FlashDesign[]> {
  let query = supabase.from('flash_designs').select('*').eq('artist_id', artistId).order('created_at', { ascending: false });
  if (!includeDrafts) query = query.eq('is_published', true);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function fetchFlash(id: string): Promise<FlashDesign | null> {
  const { data, error } = await supabase.from('flash_designs').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

/** Latest flashes that can still be booked, across all artists. */
export async function fetchAvailableFlashes(limit = 12): Promise<(FlashDesign & { artist: { id: string; blaze: string; city: string } | null })[]> {
  const { data, error } = await supabase
    .from('flash_designs')
    .select('*, artist:artists!artist_id(id,blaze,city)')
    .eq('is_published', true)
    .order('created_at', { ascending: false })
    .limit(limit * 2);
  if (error) throw error;
  return ((data ?? []) as any[]).filter((f) => flashCopiesLeft(f) > 0).slice(0, limit);
}

export interface FlashInput {
  title: string; style: string; bodyZone?: string; price: number; totalCopies: number;
  imageUrl: string; isColor: boolean; estimatedDurationMin?: number;
}

export function flashInputError(input: Partial<FlashInput>): string | null {
  if (!input.imageUrl) return 'Ajoutez le dessin du flash.';
  if (!input.title?.trim()) return 'Donnez un titre au flash.';
  if (!input.style) return 'Choisissez un style.';
  if (!Number.isInteger(input.price) || (input.price ?? 0) <= 0) return 'Indiquez un prix en euros.';
  if (!Number.isInteger(input.totalCopies) || (input.totalCopies ?? 0) < 1 || (input.totalCopies ?? 0) > 50) return 'Le nombre d’exemplaires va de 1 à 50.';
  return null;
}

export async function createFlash(artistId: string, input: FlashInput): Promise<{ id: string | null; error: string | null }> {
  const invalid = flashInputError(input);
  if (invalid) return { id: null, error: invalid };
  const { data, error } = await supabase.from('flash_designs').insert({
    artist_id: artistId, title: input.title.trim(), style: input.style, body_zone: input.bodyZone?.trim() || null,
    price: input.price, total_copies: input.totalCopies, image_url: input.imageUrl, is_color: input.isColor,
    estimated_duration: input.estimatedDurationMin ?? null,
  }).select('id').single();
  if (error) return { id: null, error: 'Publication impossible. Réessayez.' };
  return { id: data.id, error: null };
}

export async function deleteFlash(id: string): Promise<boolean> {
  const { error } = await supabase.from('flash_designs').delete().eq('id', id);
  return !error;
}

// ── Guest spots ──────────────────────────────────────────────────────────────

const isoDate = (d: Date) => dayKey(d);

export async function fetchArtistGuestSpots(artistId: string): Promise<GuestSpot[]> {
  const { data, error } = await supabase
    .from('guest_spots').select('*').eq('artist_id', artistId).eq('is_published', true)
    .gte('date_to', isoDate(new Date())).order('date_from');
  if (error) throw error;
  return data ?? [];
}

export async function fetchUpcomingGuestSpots(limit = 10): Promise<(GuestSpot & { artist: { id: string; blaze: string } | null })[]> {
  const { data, error } = await supabase
    .from('guest_spots').select('*, artist:artists!artist_id(id,blaze)').eq('is_published', true)
    .gte('date_to', isoDate(new Date())).order('date_from').limit(limit);
  if (error) throw error;
  return (data ?? []) as any[];
}

const guestFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
/** "12 – 16 mars" / "28 févr. – 3 mars" */
export function formatGuestDates(from: string, to: string): string {
  const a = new Date(`${from}T12:00:00`);
  const b = new Date(`${to}T12:00:00`);
  if (from === to) return guestFmt.format(a);
  return a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()
    ? `${a.getDate()} – ${guestFmt.format(b)}`
    : `${guestFmt.format(a)} – ${guestFmt.format(b)}`;
}

export interface GuestSpotInput {
  hostCity: string; hostStudio: string; dateFrom: Date; dateTo: Date; priceFrom: number;
  description: string; coverImageUrl: string; slotsTotal: number; artistCity?: string; styles?: string[];
}

export function guestSpotInputError(input: Partial<GuestSpotInput>, now = new Date()): string | null {
  if (!input.hostCity?.trim()) return 'Indiquez la ville du guest.';
  if (!input.hostStudio?.trim()) return 'Indiquez le studio qui vous accueille.';
  if (!input.dateFrom || !input.dateTo) return 'Indiquez les dates.';
  if (input.dateTo < input.dateFrom) return 'La date de fin précède la date de début.';
  if (isoDate(input.dateTo) < isoDate(now)) return 'Ces dates sont déjà passées.';
  if (!Number.isInteger(input.priceFrom) || (input.priceFrom ?? 0) <= 0) return 'Indiquez un prix de départ en euros.';
  if (!input.description?.trim()) return 'Décrivez ce que vous proposez sur place.';
  if (!input.coverImageUrl) return 'Ajoutez une image.';
  if (!Number.isInteger(input.slotsTotal) || (input.slotsTotal ?? 0) < 1) return 'Indiquez le nombre de places.';
  return null;
}

export async function createGuestSpot(artistId: string, input: GuestSpotInput): Promise<string | null> {
  const invalid = guestSpotInputError(input);
  if (invalid) return invalid;
  const { error } = await supabase.from('guest_spots').insert({
    artist_id: artistId, artist_city: input.artistCity ?? null, host_city: input.hostCity.trim(), host_studio: input.hostStudio.trim(),
    date_from: isoDate(input.dateFrom), date_to: isoDate(input.dateTo), price_from: input.priceFrom,
    description: input.description.trim(), cover_image_url: input.coverImageUrl, slots_total: input.slotsTotal,
    styles: input.styles ?? [],
  });
  return error ? 'Publication impossible. Réessayez.' : null;
}

export async function deleteGuestSpot(id: string): Promise<boolean> {
  const { error } = await supabase.from('guest_spots').delete().eq('id', id);
  return !error;
}

// ── Series ───────────────────────────────────────────────────────────────────

export async function fetchArtistSeries(artistId: string): Promise<ArtistSeries[]> {
  const { data, error } = await supabase.from('artist_series').select('*').eq('artist_id', artistId).order('position').order('created_at');
  if (error) throw error;
  return data ?? [];
}

export async function createSeries(artistId: string, title: string): Promise<{ series: ArtistSeries | null; error: string | null }> {
  const clean = title.trim();
  if (!clean || clean.length > 60) return { series: null, error: 'Le titre de la série fait entre 1 et 60 caractères.' };
  const { data, error } = await supabase.from('artist_series').insert({ artist_id: artistId, title: clean }).select().single();
  if (error) return { series: null, error: 'Création impossible. Réessayez.' };
  return { series: data, error: null };
}

// ── Artwork label ────────────────────────────────────────────────────────────

export interface ArtworkLabel { title: string; lines: string[] }

/** The wall label of a piece: title, then medium / placement / session / year. */
export function artworkLabel(
  post: Pick<Tables<'posts'>, 'title' | 'caption' | 'styles' | 'body_zone' | 'session_hours' | 'is_healed' | 'published_at'>,
  styleLabel: (id: string) => string = (id) => id,
): ArtworkLabel {
  const title = post.title?.trim() || 'Sans titre';
  const lines: string[] = [];
  const styles = (post.styles ?? []).slice(0, 2).map(styleLabel).join(', ');
  if (styles) lines.push(styles);
  if (post.body_zone?.trim()) lines.push(post.body_zone.trim());
  if (post.session_hours) {
    const h = Number(post.session_hours);
    lines.push(`${String(h).replace('.', ',')} h de séance`);
  }
  if (post.is_healed) lines.push('Photographié cicatrisé');
  const year = post.published_at ? new Date(post.published_at).getFullYear() : NaN;
  if (!Number.isNaN(year)) lines.push(String(year));
  return { title, lines };
}
