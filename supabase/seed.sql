-- ============================================================
-- INKR — Demo Seed Data
-- Run AFTER 001_initial.sql
-- Use placeholder UUIDs — replace with real auth user IDs
-- from your Supabase dashboard after creating test accounts.
-- ============================================================

-- ============================================================
-- DEMO ARTISTS (linked to profiles)
-- ============================================================
-- Step 1: Create the profiles manually in Supabase Auth dashboard
-- (or via supabase CLI: supabase auth create-user)
-- Then insert the artist rows below, replacing the UUIDs.

-- Example: after creating user with email inkr.demo.artist1@inkr.app
-- paste the resulting auth user UUID below:

/*
insert into public.artists (
  profile_id,
  blaze,
  city,
  bio,
  styles,
  specialties,
  booking_status,
  min_budget,
  tier,
  is_verified
) values
(
  'REPLACE_WITH_ARTIST1_PROFILE_UUID',
  'BLADE',
  'Paris',
  'Spécialiste blackwork et géométrie sacrée. 8 ans d''expérience, ancien tatoueur à Tokyo.',
  array['blackwork', 'geometrique', 'japonais'],
  array['geometrie_sacree', 'mandalas'],
  'open',
  150,
  'premium',
  true
),
(
  'REPLACE_WITH_ARTIST2_PROFILE_UUID',
  'INÈS K.',
  'Lyon',
  'Réalisme couleur et portraits. Chaque tatouage est une œuvre unique.',
  array['realisme', 'aquarelle'],
  array['portraits', 'animaux'],
  'open',
  200,
  'normal',
  true
),
(
  'REPLACE_WITH_ARTIST3_PROFILE_UUID',
  'MARCUS',
  'Bordeaux',
  'Fine line et minimalisme. Discret, précis, élégant.',
  array['fineline', 'minimaliste'],
  array['script', 'botanique'],
  'paused',
  120,
  'normal',
  false
);
*/

-- ============================================================
-- STORAGE BUCKETS
-- Run these in the Supabase SQL Editor (as service_role)
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('posts-media',          'posts-media',          true,  52428800, array['image/jpeg','image/png','image/webp','video/mp4']),
  ('avatars',              'avatars',              true,  5242880,  array['image/jpeg','image/png','image/webp']),
  ('covers',               'covers',               true,  10485760, array['image/jpeg','image/png','image/webp']),
  ('request-references',   'request-references',   false, 10485760, array['image/jpeg','image/png','image/webp']),
  ('verification-docs',    'verification-docs',    false, 10485760, array['image/jpeg','image/png','application/pdf'])
on conflict (id) do nothing;

-- Storage RLS policies
create policy "posts_media_public_read" on storage.objects
  for select using (bucket_id = 'posts-media');
create policy "posts_media_owner_write" on storage.objects
  for insert with check (
    bucket_id = 'posts-media'
    and auth.uid() is not null
  );
create policy "avatars_public_read" on storage.objects
  for select using (bucket_id = 'avatars');
create policy "avatars_owner_write" on storage.objects
  for insert with check (
    bucket_id = 'avatars'
    and auth.uid() is not null
  );
create policy "covers_public_read" on storage.objects
  for select using (bucket_id = 'covers');
create policy "covers_owner_write" on storage.objects
  for insert with check (
    bucket_id = 'covers'
    and auth.uid() is not null
  );
create policy "request_refs_owner" on storage.objects
  for all using (
    bucket_id = 'request-references'
    and auth.uid() is not null
  );
create policy "verification_docs_owner" on storage.objects
  for all using (
    bucket_id = 'verification-docs'
    and auth.uid() is not null
  );
