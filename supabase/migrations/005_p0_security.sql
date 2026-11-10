-- ============================================================
-- INKR — P0 security hardening (audit 2026-11)
--
--   1. profiles : e-mail, trust_score and is_banned are no longer readable
--                 through the API; only harmless columns can be written.
--   2. artists  : Stripe ids are no longer readable; tier, verification and
--                 counters can no longer be written through the API.
--   3. posts    : likes_count / views_count can no longer be written.
--   4. counters : trigger functions run as the table owner, so they keep
--                 working once the columns above are locked.
--   5. messages : no raw UPDATE any more; the recipient marks messages as
--                 read through mark_messages_read().
--   6. analytics: only signed-in users, as themselves, de-duplicated.
--   7. storage  : request references and verification documents are scoped
--                 to their owner (they were readable by any signed-in user).
--   8. deletion : foreign keys no longer block deleting an account.
--
-- Column privileges are used on purpose: RLS decides WHICH ROWS a caller
-- may touch, privileges decide WHICH COLUMNS. Edge functions use the
-- service role and are not affected.
-- Idempotent: safe to run more than once in the Supabase SQL Editor.
-- ============================================================

-- ── 1. profiles ──────────────────────────────────────────────
revoke select, insert, update on public.profiles from anon, authenticated;

grant select (
  id, display_name, avatar_url, role, city, style_prefs,
  onboarding_completed, created_at, updated_at
) on public.profiles to anon, authenticated;

grant update (
  display_name, avatar_url, role, city, style_prefs,
  onboarding_completed, updated_at
) on public.profiles to authenticated;

-- Rows are created by the handle_new_user() trigger only.
drop policy if exists "profiles_insert_own" on public.profiles;

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

alter function public.handle_new_user() set search_path = public;

-- ── 2. artists ───────────────────────────────────────────────
revoke select, insert, update on public.artists from anon, authenticated;

-- Everything except stripe_customer_id / stripe_subscription_id / stripe_subscription_status.
grant select (
  id, profile_id, blaze, city, bio, cover_url, avatar_url, styles, specialties,
  booking_status, min_budget, tier, is_verified, exclusions, rules, process,
  visual_preset, show_availability, show_stats, show_min_budget, sections_config,
  stat_posts, stat_profile_views, stat_requests_month,
  verification_status, verification_submitted_at, created_at, updated_at
) on public.artists to anon, authenticated;

-- tier, is_verified, verification_*, stat_* and stripe_* are server-side only.
grant insert (
  profile_id, blaze, city, bio, cover_url, avatar_url, styles, specialties,
  booking_status, min_budget, exclusions, rules, process,
  visual_preset, show_availability, show_stats, show_min_budget, sections_config
) on public.artists to authenticated;

grant update (
  blaze, city, bio, cover_url, avatar_url, styles, specialties,
  booking_status, min_budget, exclusions, rules, process,
  visual_preset, show_availability, show_stats, show_min_budget, sections_config,
  updated_at
) on public.artists to authenticated;

drop policy if exists "artists_update_own" on public.artists;
create policy "artists_update_own" on public.artists
  for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- ── 3. posts ─────────────────────────────────────────────────
revoke insert, update on public.posts from anon, authenticated;

grant insert (artist_id, media_url, media_type, caption, styles, is_published, published_at)
  on public.posts to authenticated;
grant update (media_url, media_type, caption, styles, is_published, published_at)
  on public.posts to authenticated;

-- ── 4. counters run as the table owner ───────────────────────
-- Before: they ran as the caller, so a client liking a post or sending a
-- request silently updated zero rows (RLS), and the counters never moved.
alter function public.update_artist_post_count() security definer;
alter function public.update_artist_post_count() set search_path = public;
alter function public.update_post_likes_count() security definer;
alter function public.update_post_likes_count() set search_path = public;
alter function public.update_artist_requests_count() security definer;
alter function public.update_artist_requests_count() set search_path = public;

-- ── 5. messages ──────────────────────────────────────────────
-- Before: only the SENDER could update a message, so "mark as read" by the
-- recipient did nothing, and a sender could rewrite a sent message.
drop policy if exists "messages_update_own" on public.messages;
revoke update on public.messages from anon, authenticated;

create or replace function public.mark_messages_read(p_request_id uuid)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  n integer;
begin
  if not exists (
    select 1 from public.tattoo_requests r
    where r.id = p_request_id
      and (
        r.client_id = auth.uid()
        or r.artist_id in (select id from public.artists where profile_id = auth.uid())
      )
  ) then
    raise exception 'not_request_party' using errcode = '42501';
  end if;

  update public.messages
  set is_read = true
  where request_id = p_request_id
    and sender_id is distinct from auth.uid()
    and is_read is not true;
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.mark_messages_read(uuid) from public, anon;
grant execute on function public.mark_messages_read(uuid) to authenticated;

-- ── 6. analytics events ──────────────────────────────────────
-- Before: anyone, signed in or not, could insert any event for any artist.
drop policy if exists "analytics_insert_any" on public.artist_analytics_events;
drop policy if exists "analytics_insert_self" on public.artist_analytics_events;
create policy "analytics_insert_self" on public.artist_analytics_events
  for insert to authenticated
  with check (source_user = auth.uid());

revoke insert on public.artist_analytics_events from anon;

create index if not exists artist_analytics_dedupe_idx
  on public.artist_analytics_events (artist_id, source_user, event_type, created_at desc);

-- Drops an artist's own views and the same event repeated within the hour,
-- so one account cannot inflate another artist's (or its own) statistics.
create or replace function public.guard_analytics_event()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Only API callers are constrained; the service role, the dashboard and
  -- migrations keep full control. current_user is the function owner inside a
  -- SECURITY DEFINER function, so the caller is read from the JWT instead.
  if coalesce(auth.role(), '') not in ('authenticated', 'anon') then
    return new;
  end if;

  new.created_at := now();

  if exists (
    select 1 from public.artists a
    where a.id = new.artist_id and a.profile_id = new.source_user
  ) then
    return null;
  end if;

  if exists (
    select 1 from public.artist_analytics_events e
    where e.artist_id = new.artist_id
      and e.source_user = new.source_user
      and e.event_type = new.event_type
      and e.created_at > now() - interval '1 hour'
      and (e.metadata ->> 'post_id') is not distinct from (new.metadata ->> 'post_id')
  ) then
    return null;
  end if;

  return new;
end;
$$;

drop trigger if exists guard_analytics_event on public.artist_analytics_events;
create trigger guard_analytics_event
  before insert on public.artist_analytics_events
  for each row execute function public.guard_analytics_event();

-- The profile-view counter the app relies on (it had no trigger until now).
create or replace function public.update_artist_profile_views()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.event_type = 'profile_view' then
    update public.artists
    set stat_profile_views = coalesce(stat_profile_views, 0) + 1
    where id = new.artist_id;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_artist_profile_views on public.artist_analytics_events;
create trigger trg_artist_profile_views
  after insert on public.artist_analytics_events
  for each row execute function public.update_artist_profile_views();

-- ── 7. storage: private buckets scoped to their owner ────────
-- seed.sql policies let ANY signed-in user read and write every file of
-- these two private buckets.
drop policy if exists "request_refs_owner" on storage.objects;
drop policy if exists "verification_docs_owner" on storage.objects;

-- request-references/<request id>/...
drop policy if exists "inkr_request_refs_insert_client" on storage.objects;
create policy "inkr_request_refs_insert_client" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'request-references'
    and exists (
      select 1 from public.tattoo_requests r
      where r.id::text = (storage.foldername(name))[1]
        and r.client_id = auth.uid()
    )
  );

drop policy if exists "inkr_request_refs_update_client" on storage.objects;
create policy "inkr_request_refs_update_client" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'request-references'
    and exists (
      select 1 from public.tattoo_requests r
      where r.id::text = (storage.foldername(name))[1]
        and r.client_id = auth.uid()
    )
  );

drop policy if exists "inkr_request_refs_select_parties" on storage.objects;
create policy "inkr_request_refs_select_parties" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'request-references'
    and exists (
      select 1 from public.tattoo_requests r
      where r.id::text = (storage.foldername(name))[1]
        and (
          r.client_id = auth.uid()
          or r.artist_id in (select id from public.artists where profile_id = auth.uid())
        )
    )
  );

-- verification-docs/<auth uid>/...
drop policy if exists "inkr_verification_docs_own" on storage.objects;
create policy "inkr_verification_docs_own" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'verification-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'verification-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── 8. account deletion ──────────────────────────────────────
-- Three foreign keys were declared "on delete set null" on NOT NULL columns,
-- so deleting an account failed as soon as it had a request, a review or a
-- report. Deleting an account now removes its requests (with their messages,
-- references and appointments) and its reviews; reports are kept, anonymised.
-- Drop whatever foreign key currently sits on these columns, whatever its name.
do $$
declare
  fk record;
begin
  for fk in
    select c.conrelid::regclass as tbl, c.conname
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
    where c.contype = 'f'
      and array_length(c.conkey, 1) = 1
      and (
        (c.conrelid = 'public.tattoo_requests'::regclass and a.attname in ('artist_id', 'client_id'))
        or (c.conrelid = 'public.reviews'::regclass and a.attname = 'client_id')
      )
  loop
    execute format('alter table %s drop constraint %I', fk.tbl, fk.conname);
  end loop;
end;
$$;

alter table public.tattoo_requests
  add constraint tattoo_requests_artist_id_fkey
  foreign key (artist_id) references public.artists(id) on delete cascade;

alter table public.tattoo_requests
  add constraint tattoo_requests_client_id_fkey
  foreign key (client_id) references public.profiles(id) on delete cascade;

alter table public.reviews
  add constraint reviews_client_id_fkey
  foreign key (client_id) references public.profiles(id) on delete cascade;

alter table public.reports alter column reporter_id drop not null;
