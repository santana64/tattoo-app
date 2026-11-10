import { supabase, type Tables } from './supabase';
import type { Artist } from '@/constants/tattoo';

export const isUuid = (value: string | undefined): value is string =>
  !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export const PUBLIC_ARTIST_COLUMNS = 'id,blaze,city,bio,cover_url,avatar_url,styles,specialties,booking_status,min_budget,tier,is_verified,exclusions,rules,process,show_min_budget,stat_posts,stat_profile_views,stat_requests_month' as const;

type PublicArtistRow = Pick<Tables<'artists'>, 'id' | 'blaze' | 'city' | 'bio' | 'cover_url' | 'avatar_url' | 'styles' | 'specialties' | 'booking_status' | 'min_budget' | 'tier' | 'is_verified' | 'exclusions' | 'rules' | 'process' | 'show_min_budget' | 'stat_posts' | 'stat_profile_views' | 'stat_requests_month'>;

export function mapArtist(row: PublicArtistRow): Artist {
  return {
    id: row.id, blaze: row.blaze, city: row.city, bio: row.bio ?? '',
    coverUrl: row.cover_url ?? '', avatarUrl: row.avatar_url ?? '',
    styles: row.styles ?? [], specialties: row.specialties ?? [],
    bookingStatus: row.booking_status, minBudget: row.show_min_budget ? row.min_budget ?? 0 : 0,
    tier: row.tier, isVerified: row.is_verified ?? false, exclusions: row.exclusions ?? [],
    rules: row.rules ?? '', process: row.process ?? '', faq: [],
    stats: { posts: row.stat_posts ?? 0, profileViews: row.stat_profile_views ?? 0, requestsThisMonth: row.stat_requests_month ?? 0 },
  };
}

export async function fetchArtist(id: string): Promise<Artist | null> {
  if (!isUuid(id)) return null;
  const { data, error } = await supabase.from('artists').select(PUBLIC_ARTIST_COLUMNS).eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? mapArtist(data) : null;
}

export async function fetchArtistPortfolio(id: string) {
  const [posts, faq] = await Promise.all([
    supabase.from('posts').select('*').eq('artist_id', id).eq('is_published', true).order('published_at', { ascending: false }),
    supabase.from('artist_faq').select('question,answer').eq('artist_id', id).order('position'),
  ]);
  if (posts.error) throw posts.error;
  if (faq.error) throw faq.error;
  return { posts: posts.data ?? [], faq: faq.data ?? [] };
}
