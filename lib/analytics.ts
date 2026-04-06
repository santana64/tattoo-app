import { supabase } from './supabase';

export async function trackProfileView(artistId: string, sourceUserId?: string) {
  try {
    await supabase.from('artist_analytics_events').insert({
      artist_id: artistId,
      event_type: 'profile_view',
      source_user: sourceUserId ?? null,
    });
    // stat_profile_views is updated via DB trigger on artist_analytics_events insert
  } catch { /* fire and forget */ }
}

export async function trackPostView(artistId: string, postId: string, sourceUserId?: string) {
  try {
    await supabase.from('artist_analytics_events').insert({
      artist_id: artistId,
      event_type: 'post_view',
      source_user: sourceUserId ?? null,
      metadata: { post_id: postId },
    });
  } catch { /* fire and forget */ }
}

export async function trackRequestSent(artistId: string, sourceUserId: string) {
  try {
    await supabase.from('artist_analytics_events').insert({
      artist_id: artistId,
      event_type: 'request_sent',
      source_user: sourceUserId,
    });
  } catch { /* fire and forget */ }
}

// ─── Aggregate analytics for dashboard ───────────────────────────────────────
export async function getArtistAnalytics(artistId: string, days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('artist_analytics_events')
    .select('event_type, created_at')
    .eq('artist_id', artistId)
    .gte('created_at', since)
    .order('created_at', { ascending: true });

  if (error) throw error;

  // Group by day + event_type
  const byDay: Record<string, Record<string, number>> = {};
  (data ?? []).forEach((ev) => {
    const day = ev.created_at.slice(0, 10);
    if (!byDay[day]) byDay[day] = {};
    byDay[day][ev.event_type] = (byDay[day][ev.event_type] ?? 0) + 1;
  });

  return byDay;
}
