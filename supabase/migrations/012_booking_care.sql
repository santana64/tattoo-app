-- ============================================================
-- 012 — Booking care, proximity, stories, healed photos, error reports.
--
-- Booking   each artist chooses their time zone, session lengths, notice
--           period; clients cancel or ask for another date within the
--           notice; both sides are reminded 48 h and 24 h before a session.
-- Nearby    artists carry coordinates and are searched by distance.
-- Social    24-hour stories, and healed photos sent by clients after a
--           finished session.
-- Care      crashes on a user's device are reported to the administrators.
--
-- stories, story_views and healed_photos already exist on the
-- production project; they are declared with the same shape so a fresh
-- database ends up identical. Idempotent.
-- ============================================================

-- ── Artist booking settings ──────────────────────────────────
alter table public.artists add column if not exists timezone text not null default 'Europe/Paris';
alter table public.artists add column if not exists session_durations int[] not null default '{120}';
alter table public.artists add column if not exists cancel_notice_hours int not null default 48;
alter table public.artists add column if not exists latitude double precision;
alter table public.artists add column if not exists longitude double precision;

-- artists is under column-level privileges since migration 005: these are
-- public to read and written only through the two functions below.
grant select (timezone, session_durations, cancel_notice_hours, latitude, longitude)
  on public.artists to anon, authenticated;

create or replace function public.set_booking_settings(
  p_timezone text,
  p_session_durations int[],
  p_cancel_notice_hours int
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_artist uuid;
  v_durations int[];
begin
  select id into v_artist from public.artists where profile_id = auth.uid();
  if v_artist is null then
    raise exception 'not_artist' using errcode = '42501';
  end if;
  if p_timezone is null or not exists (select 1 from pg_timezone_names where name = p_timezone) then
    raise exception 'invalid_timezone' using errcode = 'P0001';
  end if;
  select array_agg(distinct d order by d) into v_durations from unnest(p_session_durations) as d;
  if v_durations is null or cardinality(v_durations) > 6
     or exists (select 1 from unnest(v_durations) as d where d is null or d < 30 or d > 600 or d % 30 <> 0) then
    raise exception 'invalid_durations' using errcode = 'P0001';
  end if;
  if p_cancel_notice_hours is null or p_cancel_notice_hours < 0 or p_cancel_notice_hours > 336 then
    raise exception 'invalid_notice' using errcode = 'P0001';
  end if;
  update public.artists set
    timezone = p_timezone, session_durations = v_durations,
    cancel_notice_hours = p_cancel_notice_hours, updated_at = now()
  where id = v_artist;
end;
$$;
revoke all on function public.set_booking_settings(text, int[], int) from public, anon;
grant execute on function public.set_booking_settings(text, int[], int) to authenticated;

-- Coordinates of the artist's city (never a precise address): null clears them.
create or replace function public.set_artist_location(p_latitude double precision, p_longitude double precision)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_artist uuid;
begin
  select id into v_artist from public.artists where profile_id = auth.uid();
  if v_artist is null then
    raise exception 'not_artist' using errcode = '42501';
  end if;
  if (p_latitude is null) <> (p_longitude is null)
     or p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then
    raise exception 'invalid_location' using errcode = 'P0001';
  end if;
  -- Two decimals (about a kilometre): enough to rank by distance, not to find a door.
  update public.artists set
    latitude = round(p_latitude::numeric, 2), longitude = round(p_longitude::numeric, 2), updated_at = now()
  where id = v_artist;
end;
$$;
revoke all on function public.set_artist_location(double precision, double precision) from public, anon;
grant execute on function public.set_artist_location(double precision, double precision) to authenticated;

-- ── Nearby artists (great-circle distance, no extension needed) ─
create or replace function public.artists_nearby(
  p_latitude double precision,
  p_longitude double precision,
  p_radius_km int default 50,
  p_limit int default 24
) returns table (artist_id uuid, distance_km numeric)
language sql stable security definer set search_path = public as $$
  select id, round(d::numeric, 1)
  from (
    select a.id,
      6371 * 2 * asin(sqrt(least(1,
        power(sin(radians(a.latitude - p_latitude) / 2), 2)
        + cos(radians(p_latitude)) * cos(radians(a.latitude))
          * power(sin(radians(a.longitude - p_longitude) / 2), 2)
      ))) as d
    from public.artists a
    join public.profiles p on p.id = a.profile_id and not coalesce(p.is_banned, false)
    where a.latitude is not null and a.longitude is not null
      and p_latitude between -90 and 90 and p_longitude between -180 and 180
  ) s
  where d <= least(greatest(coalesce(p_radius_km, 50), 1), 500)
  order by d
  limit least(greatest(coalesce(p_limit, 24), 1), 60);
$$;
grant execute on function public.artists_nearby(double precision, double precision, int, int) to anon, authenticated;

-- ── Free slots, now in the artist's own time zone and session length ─
-- Same signature as migration 011; a null duration means the artist's
-- shortest session.
create or replace function public.artist_free_slots(
  p_artist_id uuid,
  p_days int default 28,
  p_duration_min int default null
) returns table (starts_at timestamptz, ends_at timestamptz)
language sql stable security definer set search_path = public as $$
  with artist as (
    select a.id, a.timezone as tz,
      least(greatest(coalesce(p_duration_min, a.session_durations[1], 120), 30), 600) as duration,
      least(greatest(coalesce(p_days, 28), 1), 90) as days
    from public.artists a
    where a.id = p_artist_id and a.booking_status = 'open'
  ),
  candidates as (
    select
      ((d.day + s.opens_at + make_interval(mins => step.n * 60)) at time zone a.tz) as starts_at,
      a.duration
    from artist a
    cross join lateral (
      select ((now() at time zone a.tz)::date + offs)::date as day from generate_series(0, a.days - 1) as offs
    ) d
    join public.artist_weekly_schedule s
      on s.artist_id = a.id and s.is_active and s.day_of_week = extract(dow from d.day)::int
    cross join lateral generate_series(
      0,
      greatest((extract(epoch from (s.closes_at - s.opens_at))::int / 60 - a.duration) / 60, -1)
    ) as step(n)
  )
  select c.starts_at, c.starts_at + make_interval(mins => c.duration) as ends_at
  from candidates c
  where c.starts_at >= now() + interval '24 hours'
    and not exists (
      select 1 from public.appointments ap
      where ap.artist_id = p_artist_id and ap.status in ('confirmed', 'proposed')
        and tstzrange(ap.starts_at, ap.ends_at, '[)')
            && tstzrange(c.starts_at, c.starts_at + make_interval(mins => c.duration), '[)')
    )
    and not exists (
      select 1 from public.artist_availability av
      where av.artist_id = p_artist_id and av.is_blocked
        and tstzrange(av.starts_at, av.ends_at, '[)')
            && tstzrange(c.starts_at, c.starts_at + make_interval(mins => c.duration), '[)')
    )
  order by c.starts_at
  limit 400;
$$;
grant execute on function public.artist_free_slots(uuid, int, int) to anon, authenticated;

create or replace function public.artist_public_stats(p_artist_ids uuid[])
returns table (
  artist_id uuid,
  rating_avg numeric,
  rating_count int,
  followers int,
  flash_count int,
  next_slot timestamptz
)
language sql stable security definer set search_path = public as $$
  select
    a.id,
    (select round(avg(r.rating)::numeric, 1) from public.reviews r where r.artist_id = a.id and r.is_public),
    (select count(*)::int from public.reviews r where r.artist_id = a.id and r.is_public),
    (select count(*)::int from public.artist_follows f where f.artist_id = a.id),
    (select count(*)::int from public.flash_designs fd
      where fd.artist_id = a.id and fd.is_published and fd.sold_copies < fd.total_copies),
    (select min(s.starts_at) from public.artist_free_slots(a.id, 45, null) s)
  from public.artists a
  where a.id = any (p_artist_ids[1:60]);
$$;
grant execute on function public.artist_public_stats(uuid[]) to anon, authenticated;

-- ── Cancel, or ask for another date ──────────────────────────
alter table public.appointments add column if not exists canceled_by text;
alter table public.appointments add column if not exists cancel_reason text;
alter table public.appointments add column if not exists reminded_48h_at timestamptz;
alter table public.appointments add column if not exists reminded_24h_at timestamptz;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'appointments_canceled_by_check') then
    alter table public.appointments add constraint appointments_canceled_by_check
      check (canceled_by is null or canceled_by in ('client', 'artist'));
  end if;
end $$;

-- Either party cancels an upcoming session. A client must respect the
-- artist's notice period once the session is confirmed; passing new slots
-- turns the cancellation into a request for another date. The request goes
-- back to "accepted" so a new slot can be proposed.
create or replace function public.cancel_appointment(
  p_appointment_id uuid,
  p_reason text default null,
  p_new_slots timestamptz[] default '{}'
) returns public.appointments
language plpgsql security definer set search_path = public as $$
declare
  appt public.appointments;
  v_artist public.artists;
  v_is_client boolean;
  v_slots timestamptz[];
  v_name text;
begin
  select * into appt from public.appointments where id = p_appointment_id for update;
  if not found then
    raise exception 'not_appointment_party' using errcode = '42501';
  end if;
  select * into v_artist from public.artists where id = appt.artist_id;
  v_is_client := appt.client_id = auth.uid();
  if not v_is_client and (v_artist.profile_id is null or v_artist.profile_id <> auth.uid()) then
    raise exception 'not_appointment_party' using errcode = '42501';
  end if;
  if appt.status not in ('proposed', 'confirmed') then
    raise exception 'not_cancelable' using errcode = 'P0001';
  end if;
  if appt.starts_at <= now() then
    raise exception 'already_started' using errcode = 'P0001';
  end if;
  if v_is_client and appt.status = 'confirmed'
     and appt.starts_at < now() + make_interval(hours => v_artist.cancel_notice_hours) then
    raise exception 'notice_too_short' using errcode = 'P0001';
  end if;

  select coalesce(array_agg(s order by s), '{}') into v_slots
  from (select distinct s from unnest(coalesce(p_new_slots, '{}')) as s where s > now() limit 3) t;

  update public.appointments set
    status = 'canceled', canceled_by = case when v_is_client then 'client' else 'artist' end,
    cancel_reason = nullif(left(trim(coalesce(p_reason, '')), 300), ''), updated_at = now()
  where id = appt.id returning * into appt;

  update public.tattoo_requests set
    status = 'accepted', confirmed_at = null, updated_at = now(),
    preferred_slots = case when cardinality(v_slots) > 0 then v_slots else preferred_slots end
  where id = appt.request_id and status in ('accepted', 'confirmed');

  if v_is_client then
    select nullif(split_part(trim(display_name), ' ', 1), '') into v_name from public.profiles where id = appt.client_id;
    perform public.notify_user(
      v_artist.profile_id,
      case when cardinality(v_slots) > 0 then 'appointment_reschedule' else 'appointment_canceled' end,
      case when cardinality(v_slots) > 0 then 'Report demandé' else 'Rendez-vous annulé' end,
      coalesce(v_name, 'Votre client')
        || case when cardinality(v_slots) > 0 then ' souhaite déplacer le rendez-vous.' else ' a annulé le rendez-vous.' end,
      jsonb_build_object('appointment_id', appt.id, 'request_id', appt.request_id)
    );
  else
    perform public.notify_user(
      appt.client_id, 'appointment_canceled', 'Rendez-vous annulé',
      coalesce(v_artist.blaze, 'L’artiste') || ' a annulé le rendez-vous. Un nouveau créneau peut vous être proposé.',
      jsonb_build_object('appointment_id', appt.id, 'request_id', appt.request_id)
    );
  end if;
  return appt;
end;
$$;
revoke all on function public.cancel_appointment(uuid, text, timestamptz[]) from public, anon;
grant execute on function public.cancel_appointment(uuid, text, timestamptz[]) to authenticated;

-- cancel_appointment() writes its own notification: the status trigger of
-- migration 006 keeps its "slot refused" message for a plain refusal only.
create or replace function public.notify_appointment_change()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_artist_profile uuid;
  v_artist_name text;
  v_client_name text;
  v_data jsonb := jsonb_build_object('appointment_id', new.id);
begin
  select a.profile_id, a.blaze into v_artist_profile, v_artist_name
  from public.artists a where a.id = new.artist_id;

  if tg_op = 'INSERT' then
    if new.status = 'proposed' then
      perform public.notify_user(
        new.client_id, 'appointment_proposed', 'Créneau proposé',
        coalesce(v_artist_name, 'L’artiste') || ' vous propose un rendez-vous.', v_data
      );
    end if;
    return null;
  end if;

  if new.status is not distinct from old.status then
    return null;
  end if;

  select p.display_name into v_client_name from public.profiles p where p.id = new.client_id;

  if new.status = 'confirmed' then
    perform public.notify_user(
      v_artist_profile, 'appointment_confirmed', 'Rendez-vous confirmé',
      coalesce(v_client_name, 'Votre client') || ' a confirmé le créneau.', v_data
    );
  elsif new.status = 'canceled' and old.status = 'proposed' and auth.uid() = new.client_id
        and new.canceled_by is null then
    -- Only a refusal by the client: a new proposal by the artist also cancels the previous one.
    perform public.notify_user(
      v_artist_profile, 'appointment_canceled', 'Créneau refusé',
      coalesce(v_client_name, 'Votre client') || ' a refusé le créneau proposé.', v_data
    );
  elsif new.status = 'completed' then
    perform public.notify_user(
      new.client_id, 'appointment_completed', 'Séance terminée',
      'Donnez votre avis sur votre séance avec ' || coalesce(v_artist_name, 'votre artiste') || '.', v_data
    );
  end if;
  return null;
end;
$$;

-- ── Reminders, 48 h and 24 h before a confirmed session ──────
-- Safe to run as often as wanted: each reminder is sent once.
create or replace function public.send_appointment_reminders()
returns int
language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_sent int := 0;
  v_when text;
  v_kind text;
begin
  for r in
    select ap.id, ap.client_id, ap.starts_at, ap.reminded_48h_at, ap.reminded_24h_at,
           a.profile_id as artist_profile, a.blaze, a.timezone,
           nullif(split_part(trim(p.display_name), ' ', 1), '') as client_name
    from public.appointments ap
    join public.artists a on a.id = ap.artist_id
    left join public.profiles p on p.id = ap.client_id
    where ap.status = 'confirmed' and ap.starts_at > now() and ap.starts_at <= now() + interval '48 hours'
      and (ap.reminded_48h_at is null or (ap.reminded_24h_at is null and ap.starts_at <= now() + interval '24 hours'))
    for update of ap skip locked
  loop
    if r.starts_at <= now() + interval '24 hours' then
      v_kind := '24h';
      update public.appointments set reminded_24h_at = now(), reminded_48h_at = coalesce(reminded_48h_at, now()) where id = r.id;
    else
      v_kind := '48h';
      update public.appointments set reminded_48h_at = now() where id = r.id;
    end if;
    v_when := case when v_kind = '24h' then 'demain' else 'dans deux jours' end
      || ' à ' || to_char(r.starts_at at time zone r.timezone, 'HH24"h"MI');
    perform public.notify_user(
      r.client_id, 'appointment_reminder', 'Rappel de rendez-vous',
      'Votre séance avec ' || coalesce(r.blaze, 'votre artiste') || ' a lieu ' || v_when || '.',
      jsonb_build_object('appointment_id', r.id, 'kind', v_kind)
    );
    perform public.notify_user(
      r.artist_profile, 'appointment_reminder', 'Rappel de rendez-vous',
      'Séance avec ' || coalesce(r.client_name, 'votre client') || ' ' || v_when || '.',
      jsonb_build_object('appointment_id', r.id, 'kind', v_kind)
    );
    v_sent := v_sent + 1;
  end loop;
  return v_sent;
end;
$$;
revoke all on function public.send_appointment_reminders() from public, anon, authenticated;

-- Hourly, where pg_cron is available (it is on Supabase). Elsewhere this
-- block does nothing and the function can be called by any scheduler.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.unschedule(jobid) from cron.job where jobname = 'inkr_appointment_reminders';
    perform cron.schedule('inkr_appointment_reminders', '7 * * * *', 'select public.send_appointment_reminders()');
  end if;
exception when others then
  raise notice 'appointment reminders not scheduled: %', sqlerrm;
end $$;

-- ── Stories: one image, gone after 24 hours ──────────────────
create table if not exists public.stories (
  id          uuid primary key default gen_random_uuid(),
  artist_id   uuid not null references public.artists(id) on delete cascade,
  media_url   text not null,
  caption     text,
  view_count  int not null default 0,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists stories_artist_idx on public.stories (artist_id, expires_at desc);
alter table public.stories enable row level security;
drop policy if exists "anyone_read_active_stories" on public.stories;
create policy "anyone_read_active_stories" on public.stories for select using (expires_at > now());
drop policy if exists "artists_insert_own_stories" on public.stories;
create policy "artists_insert_own_stories" on public.stories for insert with check (
  artist_id in (select id from public.artists where profile_id = auth.uid())
);
drop policy if exists "artists_manage_own_stories" on public.stories;
create policy "artists_manage_own_stories" on public.stories for all
  using (artist_id in (select id from public.artists where profile_id = auth.uid()))
  with check (artist_id in (select id from public.artists where profile_id = auth.uid()));
-- A story cannot be made to last: at most 24 hours (plus a minute of clock drift).
drop policy if exists "stories_short_lived" on public.stories;
create policy "stories_short_lived" on public.stories as restrictive for insert with check (
  expires_at > now() and expires_at <= now() + interval '24 hours 1 minute'
  and (caption is null or length(caption) <= 200)
);
drop policy if exists "stories_no_extension" on public.stories;
create policy "stories_no_extension" on public.stories as restrictive for update with check (
  expires_at <= created_at + interval '24 hours 1 minute'
);
drop policy if exists "stories_not_banned" on public.stories;
create policy "stories_not_banned" on public.stories as restrictive for insert with check (not public.is_banned());
revoke insert, update, delete on public.stories from anon;
-- Column privileges: an artist may reword or shorten a story, never touch its counter.
revoke update on public.stories from authenticated;
grant update (caption, expires_at) on public.stories to authenticated;

create table if not exists public.story_views (
  id         uuid primary key default gen_random_uuid(),
  story_id   uuid not null references public.stories(id) on delete cascade,
  viewer_id  uuid references public.profiles(id) on delete cascade,
  viewed_at  timestamptz not null default now()
);
create index if not exists story_views_story_viewer_idx on public.story_views (story_id, viewer_id);
alter table public.story_views enable row level security;
drop policy if exists "artists_read_own_story_views" on public.story_views;
create policy "artists_read_own_story_views" on public.story_views for select using (
  story_id in (
    select s.id from public.stories s join public.artists a on a.id = s.artist_id where a.profile_id = auth.uid()
  )
);
drop policy if exists "viewers_read_own_views" on public.story_views;
create policy "viewers_read_own_views" on public.story_views for select using (viewer_id = auth.uid());
-- Views are recorded by record_story_view() so each viewer counts once.
drop policy if exists "authenticated_insert_story_views" on public.story_views;
revoke insert, update, delete on public.story_views from anon, authenticated;

create or replace function public.record_story_view(p_story_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return;
  end if;
  if not exists (
    select 1 from public.stories s join public.artists a on a.id = s.artist_id
    where s.id = p_story_id and s.expires_at > now() and a.profile_id <> v_uid
  ) then
    return;
  end if;
  if exists (select 1 from public.story_views where story_id = p_story_id and viewer_id = v_uid) then
    return;
  end if;
  insert into public.story_views (story_id, viewer_id) values (p_story_id, v_uid);
  update public.stories set view_count = view_count + 1 where id = p_story_id;
end;
$$;
revoke all on function public.record_story_view(uuid) from public, anon;
grant execute on function public.record_story_view(uuid) to authenticated;

-- ── Healed photos, sent by the client after the session ──────
create table if not exists public.healed_photos (
  id              uuid primary key default gen_random_uuid(),
  appointment_id  uuid not null references public.appointments(id) on delete cascade,
  artist_id       uuid references public.artists(id) on delete cascade,
  client_id       uuid references public.profiles(id) on delete cascade,
  photo_url       text not null,
  note            text,
  is_public       boolean not null default false,
  created_at      timestamptz not null default now()
);
create index if not exists healed_photos_artist_idx on public.healed_photos (artist_id, created_at desc);
alter table public.healed_photos enable row level security;

-- The parties come from the appointment, never from the caller.
create or replace function public.guard_healed_photo()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  appt public.appointments;
begin
  select * into appt from public.appointments where id = new.appointment_id;
  if not found or appt.client_id is distinct from auth.uid() or appt.status <> 'completed' then
    raise exception 'not_completed_session' using errcode = '42501';
  end if;
  new.artist_id := appt.artist_id;
  new.client_id := appt.client_id;
  new.note := nullif(left(trim(coalesce(new.note, '')), 300), '');
  return new;
end;
$$;
drop trigger if exists guard_healed_photo on public.healed_photos;
create trigger guard_healed_photo before insert on public.healed_photos
  for each row execute function public.guard_healed_photo();

drop policy if exists "healed_photos_select_parties_or_public" on public.healed_photos;
create policy "healed_photos_select_parties_or_public" on public.healed_photos for select using (
  is_public = true or client_id = auth.uid()
  or artist_id in (select id from public.artists where profile_id = auth.uid())
);
drop policy if exists "healed_photos_insert_client" on public.healed_photos;
create policy "healed_photos_insert_client" on public.healed_photos for insert to authenticated with check (
  appointment_id in (select id from public.appointments where client_id = auth.uid() and status = 'completed')
);
drop policy if exists "healed_photos_update_client" on public.healed_photos;
create policy "healed_photos_update_client" on public.healed_photos for update to authenticated
  using (client_id = auth.uid()) with check (client_id = auth.uid());
drop policy if exists "healed_photos_delete_client" on public.healed_photos;
create policy "healed_photos_delete_client" on public.healed_photos for delete to authenticated using (client_id = auth.uid());
drop policy if exists "healed_photos_not_banned" on public.healed_photos;
create policy "healed_photos_not_banned" on public.healed_photos as restrictive for insert with check (not public.is_banned());
revoke insert, update, delete on public.healed_photos from anon;
-- A client decides whether the photo is public and may reword the note, nothing else.
revoke update on public.healed_photos from authenticated;
grant update (is_public, note) on public.healed_photos to authenticated;

-- A healed photo → the artist.
create or replace function public.notify_healed_photo()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
  v_name text;
begin
  select profile_id into v_owner from public.artists where id = new.artist_id;
  select nullif(split_part(trim(display_name), ' ', 1), '') into v_name from public.profiles where id = new.client_id;
  perform public.notify_user(
    v_owner, 'healed_photo', coalesce(v_name, 'Votre client'), 'a envoyé une photo de son tatouage cicatrisé.',
    jsonb_build_object('appointment_id', new.appointment_id, 'artist_id', new.artist_id)
  );
  return new;
end;
$$;
drop trigger if exists notify_healed_photo on public.healed_photos;
create trigger notify_healed_photo after insert on public.healed_photos
  for each row execute function public.notify_healed_photo();

-- Public bucket; each client writes under their own folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('healed-photos', 'healed-photos', true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
drop policy if exists "inkr_healed_photos_insert_own" on storage.objects;
create policy "inkr_healed_photos_insert_own" on storage.objects for insert to authenticated with check (
  bucket_id = 'healed-photos' and (storage.foldername(name))[1] = auth.uid()::text
);
drop policy if exists "inkr_healed_photos_delete_own" on storage.objects;
create policy "inkr_healed_photos_delete_own" on storage.objects for delete to authenticated using (
  bucket_id = 'healed-photos' and (storage.foldername(name))[1] = auth.uid()::text
);

-- ── Error reports from devices ───────────────────────────────
create table if not exists public.client_errors (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profiles(id) on delete set null,
  message     text not null,
  stack       text,
  route       text,
  platform    text,
  app_version text,
  created_at  timestamptz not null default now()
);
create index if not exists client_errors_created_idx on public.client_errors (created_at desc);
alter table public.client_errors enable row level security;
revoke all on public.client_errors from anon, authenticated;
grant select, delete on public.client_errors to authenticated;
drop policy if exists "client_errors_admin_read" on public.client_errors;
create policy "client_errors_admin_read" on public.client_errors for select to authenticated using (public.is_admin());
drop policy if exists "client_errors_admin_delete" on public.client_errors;
create policy "client_errors_admin_delete" on public.client_errors for delete to authenticated using (public.is_admin());

-- Anyone may report a crash, signed in or not. Sizes are capped and the
-- table refuses more than 60 reports a minute overall, so it cannot be
-- used to fill the database.
create or replace function public.report_client_error(
  p_message text,
  p_stack text default null,
  p_route text default null,
  p_platform text default null,
  p_app_version text default null
) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if p_message is null or length(trim(p_message)) = 0 then
    return false;
  end if;
  if (select count(*) from public.client_errors where created_at > now() - interval '1 minute') >= 60 then
    return false;
  end if;
  insert into public.client_errors (user_id, message, stack, route, platform, app_version)
  values (
    auth.uid(), left(trim(p_message), 500), nullif(left(coalesce(p_stack, ''), 4000), ''),
    nullif(left(coalesce(p_route, ''), 200), ''), nullif(left(coalesce(p_platform, ''), 40), ''),
    nullif(left(coalesce(p_app_version, ''), 40), '')
  );
  return true;
end;
$$;
grant execute on function public.report_client_error(text, text, text, text, text) to anon, authenticated;

-- ── Emoji reactions on a piece ───────────────────────────────
-- One reaction per person and per piece, from a fixed set. Like likes, who
-- reacted is public; the counts come from post_reaction_counts().
create table if not exists public.post_reactions (
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  emoji      text not null check (emoji in ('fire', 'heart_eyes', 'clap', 'mind_blown', 'black_heart')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index if not exists post_reactions_post_idx on public.post_reactions (post_id, emoji);
alter table public.post_reactions enable row level security;
revoke insert, update, delete on public.post_reactions from anon;
drop policy if exists "reactions_select_all" on public.post_reactions;
create policy "reactions_select_all" on public.post_reactions for select using (true);
drop policy if exists "reactions_insert_own" on public.post_reactions;
create policy "reactions_insert_own" on public.post_reactions for insert to authenticated with check (
  user_id = auth.uid() and post_id in (select id from public.posts where is_published)
);
drop policy if exists "reactions_update_own" on public.post_reactions;
create policy "reactions_update_own" on public.post_reactions for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "reactions_delete_own" on public.post_reactions;
create policy "reactions_delete_own" on public.post_reactions for delete to authenticated using (user_id = auth.uid());
drop policy if exists "reactions_not_banned" on public.post_reactions;
create policy "reactions_not_banned" on public.post_reactions as restrictive for insert with check (not public.is_banned());

create or replace function public.post_reaction_counts(p_post_ids uuid[])
returns table (post_id uuid, emoji text, total int)
language sql stable security definer set search_path = public as $$
  select r.post_id, r.emoji, count(*)::int
  from public.post_reactions r
  where r.post_id = any (p_post_ids[1:60])
  group by r.post_id, r.emoji;
$$;
grant execute on function public.post_reaction_counts(uuid[]) to anon, authenticated;

-- ── Write to an artist without a project ─────────────────────
-- A question is a light request (is_inquiry) so it lives in the same inbox
-- and conversation screens. One open thread per person and artist: writing
-- again adds to it. At most five new threads a day per person.
alter table public.tattoo_requests add column if not exists is_inquiry boolean not null default false;

create or replace function public.contact_artist(p_artist_id uuid, p_message text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_text text := trim(coalesce(p_message, ''));
  v_request uuid;
begin
  if v_uid is null or public.is_banned() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if length(v_text) < 2 or length(v_text) > 1000 then
    raise exception 'invalid_message' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.artists where id = p_artist_id and profile_id <> v_uid) then
    raise exception 'artist_not_found' using errcode = 'P0001';
  end if;

  select id into v_request from public.tattoo_requests
  where client_id = v_uid and artist_id = p_artist_id and is_inquiry
    and status in ('submitted', 'accepted', 'clarification_needed')
  order by created_at desc limit 1;

  if v_request is null then
    if (select count(*) from public.tattoo_requests
        where client_id = v_uid and is_inquiry and created_at > now() - interval '1 day') >= 5 then
      raise exception 'too_many_threads' using errcode = 'P0001';
    end if;
    insert into public.tattoo_requests
      (client_id, artist_id, project_type, body_zone, size_category, color_preference, description,
       flexibility_level, budget_unknown, is_inquiry)
    values (v_uid, p_artist_id, 'new', 'Non précisé', 'm', 'artist_choice', left(v_text, 280), 'open', true, true)
    returning id into v_request;
  end if;

  insert into public.messages (request_id, sender_id, content) values (v_request, v_uid, v_text);
  return v_request;
end;
$$;
revoke all on function public.contact_artist(uuid, text) from public, anon;
grant execute on function public.contact_artist(uuid, text) to authenticated;

-- A question is announced by its first message ("Nouveau message"), not as
-- a project: the request trigger of migration 006 stays silent for it.
create or replace function public.notify_request_change()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_artist_profile uuid;
  v_artist_name text;
  v_client_name text;
begin
  if new.is_inquiry then
    return null;
  end if;

  select a.profile_id, a.blaze into v_artist_profile, v_artist_name
  from public.artists a where a.id = new.artist_id;

  if tg_op = 'INSERT' then
    select p.display_name into v_client_name from public.profiles p where p.id = new.client_id;
    perform public.notify_user(
      v_artist_profile, 'new_request', 'Nouvelle demande',
      coalesce(v_client_name, 'Un client') || ' vous a envoyé un projet.',
      jsonb_build_object('request_id', new.id)
    );
  elsif new.status is distinct from old.status then
    if new.status = 'accepted' then
      perform public.notify_user(
        new.client_id, 'accepted', 'Projet accepté',
        coalesce(v_artist_name, 'L’artiste') || ' a accepté votre projet.',
        jsonb_build_object('request_id', new.id)
      );
    elsif new.status = 'declined' then
      perform public.notify_user(
        new.client_id, 'declined', 'Projet décliné',
        coalesce(v_artist_name, 'L’artiste') || ' ne peut pas donner suite à votre projet.',
        jsonb_build_object('request_id', new.id)
      );
    elsif new.status = 'clarification_needed' then
      perform public.notify_user(
        new.client_id, 'new_message', 'Précisions demandées',
        coalesce(v_artist_name, 'L’artiste') || ' a besoin de précisions sur votre projet.',
        jsonb_build_object('request_id', new.id)
      );
    end if;
  end if;
  return null;
end;
$$;
