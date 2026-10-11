-- ============================================================
-- INKR — Storage upload policies
-- Replaces the manual block in seed.sql (which was never a migration).
-- Idempotent: safe to run more than once in the Supabase SQL Editor.
--
-- Paths written by the app (lib/storage.ts):
--   avatars/<auth uid>/...        covers/<auth uid>/...
--   posts-media/<artist id>/...   (artist owned by the uploader)
-- Buckets are public: reads go through public URLs, so only writes are policed.
-- ============================================================

-- Old permissive policies from seed.sql (any signed-in user could write anywhere).
drop policy if exists "avatars_owner_write" on storage.objects;
drop policy if exists "covers_owner_write" on storage.objects;
drop policy if exists "posts_media_owner_write" on storage.objects;

drop policy if exists "inkr_avatars_insert_own" on storage.objects;
create policy "inkr_avatars_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "inkr_covers_insert_own" on storage.objects;
create policy "inkr_covers_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'covers'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "inkr_posts_media_insert_own_artist" on storage.objects;
create policy "inkr_posts_media_insert_own_artist" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'posts-media'
    and exists (
      select 1 from public.artists a
      where a.id::text = (storage.foldername(name))[1]
        and a.profile_id = auth.uid()
    )
  );

-- Owners may replace or remove their own files (upsert needs SELECT + UPDATE).
drop policy if exists "inkr_media_select_own" on storage.objects;
create policy "inkr_media_select_own" on storage.objects
  for select to authenticated
  using (
    bucket_id in ('avatars', 'covers')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "inkr_media_update_own" on storage.objects;
create policy "inkr_media_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id in ('avatars', 'covers')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "inkr_media_delete_own" on storage.objects;
create policy "inkr_media_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('avatars', 'covers')
    and (storage.foldername(name))[1] = auth.uid()::text
  );
