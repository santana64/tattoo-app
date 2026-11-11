-- ============================================================
-- INKR — Reels: short videos uploaded by artists, or linked from
-- TikTok / Instagram
--
-- A reel is a post with media_type = 'video':
--   * uploaded  : media_url is the file in the posts-media bucket,
--                 thumbnail_url an optional poster image;
--   * linked    : embed_provider is 'tiktok' or 'instagram' and media_url is
--                 the canonical page of the video on that platform.
--
-- The link format is enforced here, not only in the app: the app turns it
-- into an <iframe> address, so nothing but a real TikTok / Instagram video
-- page may ever be stored.
-- Idempotent: safe to run more than once.
-- ============================================================

alter table public.posts add column if not exists embed_provider text;
alter table public.posts add column if not exists thumbnail_url text;

alter table public.posts drop constraint if exists posts_embed_provider_check;
alter table public.posts add constraint posts_embed_provider_check
  check (embed_provider is null or embed_provider in ('tiktok', 'instagram'));

alter table public.posts drop constraint if exists posts_embed_url_check;
alter table public.posts add constraint posts_embed_url_check check (
  embed_provider is null
  or (
    media_type = 'video'
    and (
      (embed_provider = 'tiktok'
        and media_url ~ '^https://www\.tiktok\.com/@[A-Za-z0-9._]{1,64}/video/[0-9]{8,24}$')
      or (embed_provider = 'instagram'
        and media_url ~ '^https://www\.instagram\.com/reel/[A-Za-z0-9_-]{5,32}/$')
    )
  )
);

alter table public.posts drop constraint if exists posts_thumbnail_https_check;
alter table public.posts add constraint posts_thumbnail_https_check
  check (thumbnail_url is null or thumbnail_url ~ '^https://');

-- Column privileges (see migration 005): the two new columns are writable by the owner.
grant insert (embed_provider, thumbnail_url) on public.posts to authenticated;
grant update (embed_provider, thumbnail_url) on public.posts to authenticated;

create index if not exists posts_video_feed_idx
  on public.posts (published_at desc)
  where media_type = 'video' and is_published;

-- Phones record .mov (QuickTime) and browsers often produce .webm.
update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm']
where id = 'posts-media';
