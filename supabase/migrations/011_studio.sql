-- ============================================================
-- 011 — Studio: bookable availability, follows, flashes, guest spots,
--        waitlist, series and artwork labels.
--
-- Booking   an artist publishes weekly opening hours; the database works out
--           the free slots (hours minus booked sessions minus blocked days)
--           and clients attach up to three preferred slots to a request.
-- Social    clients follow artists, are told when they publish or reopen,
--           and can wait for a closed book to reopen.
-- Gallery   every piece can carry a label (title, placement, session length)
--           and belong to a series; flashes are ready-to-book designs.
--
-- Several tables below already exist on the production project (they came
-- from an earlier codebase). They are declared here with the same shape so a
-- fresh database ends up identical; on production the statements are no-ops.
--
-- Idempotent. All times of day are Europe/Paris wall-clock time.
-- ============================================================

-- ── Weekly opening hours ─────────────────────────────────────
-- day_of_week follows Postgres and JavaScript: 0 = Sunday … 6 = Saturday.
create table if not exists public.artist_weekly_schedule (
  id          uuid primary key default gen_random_uuid(),
  artist_id   uuid not null references public.artists(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  opens_at    time not null default '09:00',
  closes_at   time not null default '18:00',
  is_active   boolean not null default true,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  unique (artist_id, day_of_week)
);
alter table public.artist_weekly_schedule enable row level security;
drop policy if exists "schedule_select_public" on public.artist_weekly_schedule;
create policy "schedule_select_public" on public.artist_weekly_schedule for select using (true);
drop policy if exists "schedule_manage_own" on public.artist_weekly_schedule;
create policy "schedule_manage_own" on public.artist_weekly_schedule for all
  using (artist_id in (select id from public.artists where profile_id = auth.uid()))
  with check (artist_id in (select id from public.artists where profile_id = auth.uid()));

-- The artist replaces the whole week in one call:
--   [{"day": 2, "opens": "10:00", "closes": "19:00"}, …]   (missing days = closed)
create or replace function public.set_weekly_schedule(p_days jsonb)
returns setof public.artist_weekly_schedule
language plpgsql security definer set search_path = public as $$
declare
  v_artist uuid;
  d jsonb;
  v_day int;
  v_opens time;
  v_closes time;
begin
  select id into v_artist from public.artists where profile_id = auth.uid();
  if v_artist is null then
    raise exception 'not_artist' using errcode = '42501';
  end if;
  if p_days is null or jsonb_typeof(p_days) <> 'array' or jsonb_array_length(p_days) > 7 then
    raise exception 'invalid_schedule' using errcode = 'P0001';
  end if;

  delete from public.artist_weekly_schedule where artist_id = v_artist;
  for d in select * from jsonb_array_elements(p_days) loop
    begin
      v_day := (d->>'day')::int;
      v_opens := (d->>'opens')::time;
      v_closes := (d->>'closes')::time;
    exception when others then
      raise exception 'invalid_schedule' using errcode = 'P0001';
    end;
    if v_day is null or v_day not between 0 and 6 or v_opens is null or v_closes is null
       or v_closes < v_opens + interval '1 hour' then
      raise exception 'invalid_schedule' using errcode = 'P0001';
    end if;
    begin
      insert into public.artist_weekly_schedule (artist_id, day_of_week, opens_at, closes_at)
      values (v_artist, v_day, v_opens, v_closes);
    exception when unique_violation then
      raise exception 'invalid_schedule' using errcode = 'P0001';
    end;
  end loop;
  return query select * from public.artist_weekly_schedule where artist_id = v_artist order by day_of_week;
end;
$$;
revoke all on function public.set_weekly_schedule(jsonb) from public, anon;
grant execute on function public.set_weekly_schedule(jsonb) to authenticated;

-- ── Free slots ───────────────────────────────────────────────
-- Opening hours, minus sessions already confirmed or on offer, minus blocked
-- periods, starting 24 hours from now. Returns nothing for an artist whose
-- book is not open. It reveals when an artist is free, never who booked what.
create or replace function public.artist_free_slots(
  p_artist_id uuid,
  p_days int default 28,
  p_duration_min int default 120
) returns table (starts_at timestamptz, ends_at timestamptz)
language sql stable security definer set search_path = public as $$
  with params as (
    select
      least(greatest(coalesce(p_days, 28), 1), 90) as days,
      least(greatest(coalesce(p_duration_min, 120), 30), 600) as duration,
      (now() at time zone 'Europe/Paris')::date as today
  ),
  candidates as (
    select
      ((d.day + s.opens_at + make_interval(mins => step.n * 60)) at time zone 'Europe/Paris') as starts_at,
      p.duration
    from params p
    join public.artists a on a.id = p_artist_id and a.booking_status = 'open'
    cross join lateral (
      select (p.today + offs)::date as day from generate_series(0, p.days - 1) as offs
    ) d
    join public.artist_weekly_schedule s
      on s.artist_id = a.id and s.is_active and s.day_of_week = extract(dow from d.day)::int
    cross join lateral generate_series(
      0,
      greatest((extract(epoch from (s.closes_at - s.opens_at))::int / 60 - p.duration) / 60, -1)
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

-- ── Preferred slots on a request ─────────────────────────────
alter table public.tattoo_requests add column if not exists preferred_slots timestamptz[] not null default '{}';
alter table public.tattoo_requests add column if not exists is_flash boolean not null default false;
alter table public.tattoo_requests add column if not exists flash_design_id uuid;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tattoo_requests_preferred_slots_max') then
    alter table public.tattoo_requests
      add constraint tattoo_requests_preferred_slots_max check (cardinality(preferred_slots) <= 3);
  end if;
end $$;

-- ── Follows ──────────────────────────────────────────────────
create table if not exists public.artist_follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  artist_id   uuid not null references public.artists(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, artist_id)
);
create index if not exists artist_follows_artist_idx on public.artist_follows (artist_id);
alter table public.artist_follows enable row level security;
revoke all on public.artist_follows from anon;
revoke update on public.artist_follows from authenticated;

-- A follower list is private: each user reads their own follows only. The
-- public number comes from artist_public_stats().
drop policy if exists "follows_select_own" on public.artist_follows;
create policy "follows_select_own" on public.artist_follows for select using (follower_id = auth.uid());
drop policy if exists "follows_insert_own" on public.artist_follows;
create policy "follows_insert_own" on public.artist_follows for insert with check (
  follower_id = auth.uid()
  and artist_id not in (select id from public.artists where profile_id = auth.uid())
);
drop policy if exists "follows_delete_own" on public.artist_follows;
create policy "follows_delete_own" on public.artist_follows for delete using (follower_id = auth.uid());
drop policy if exists "follows_not_banned" on public.artist_follows;
create policy "follows_not_banned" on public.artist_follows as restrictive for insert with check (not public.is_banned());

-- ── Waitlist: be told when a closed book reopens ─────────────
create table if not exists public.artist_waitlist (
  id          uuid primary key default gen_random_uuid(),
  artist_id   uuid not null references public.artists(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  status      text not null default 'active' check (status in ('active', 'notified', 'cancelled')),
  created_at  timestamptz not null default now(),
  notified_at timestamptz
);
alter table public.artist_waitlist enable row level security;
drop policy if exists "artist_waitlist_select_parties" on public.artist_waitlist;
create policy "artist_waitlist_select_parties" on public.artist_waitlist for select using (
  user_id = auth.uid() or artist_id in (select id from public.artists where profile_id = auth.uid())
);
-- Writes go through set_waitlist(): direct inserts could pile up duplicates.
drop policy if exists "artist_waitlist_insert_own" on public.artist_waitlist;
drop policy if exists "artist_waitlist_update_own" on public.artist_waitlist;
revoke insert, update, delete on public.artist_waitlist from anon, authenticated;

create or replace function public.set_waitlist(p_artist_id uuid, p_join boolean)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or public.is_banned() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if not exists (select 1 from public.artists where id = p_artist_id) then
    raise exception 'artist_not_found' using errcode = 'P0001';
  end if;
  if p_join then
    update public.artist_waitlist set status = 'active', notified_at = null
    where artist_id = p_artist_id and user_id = v_uid;
    if not found then
      insert into public.artist_waitlist (artist_id, user_id) values (p_artist_id, v_uid);
    end if;
  else
    update public.artist_waitlist set status = 'cancelled'
    where artist_id = p_artist_id and user_id = v_uid;
  end if;
  return p_join;
end;
$$;
revoke all on function public.set_waitlist(uuid, boolean) from public, anon;
grant execute on function public.set_waitlist(uuid, boolean) to authenticated;

-- ── Flashes: ready-to-book designs ───────────────────────────
create table if not exists public.flash_designs (
  id                 uuid primary key default gen_random_uuid(),
  artist_id          uuid not null references public.artists(id) on delete cascade,
  title              text not null check (length(trim(title)) > 0),
  style              text not null,
  body_zone          text,
  price              int not null check (price > 0),
  deposit_percent    int not null default 30 check (deposit_percent between 1 and 100),
  total_copies       int not null default 1 check (total_copies > 0),
  sold_copies        int not null default 0 check (sold_copies >= 0),
  image_url          text not null,
  is_color           boolean not null default false,
  estimated_duration int check (estimated_duration is null or estimated_duration > 0),
  tags               text[] not null default '{}',
  is_published       boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  check (sold_copies <= total_copies)
);
create index if not exists flash_designs_artist_idx on public.flash_designs (artist_id, created_at desc);
alter table public.flash_designs enable row level security;
drop policy if exists "flash_designs_select_published" on public.flash_designs;
create policy "flash_designs_select_published" on public.flash_designs for select using (
  is_published = true or artist_id in (select id from public.artists where profile_id = auth.uid())
);
drop policy if exists "flash_designs_insert_own" on public.flash_designs;
create policy "flash_designs_insert_own" on public.flash_designs for insert with check (
  artist_id in (select id from public.artists where profile_id = auth.uid())
);
drop policy if exists "flash_designs_update_own" on public.flash_designs;
create policy "flash_designs_update_own" on public.flash_designs for update
  using (artist_id in (select id from public.artists where profile_id = auth.uid()))
  with check (artist_id in (select id from public.artists where profile_id = auth.uid()));
drop policy if exists "flash_designs_delete_own" on public.flash_designs;
create policy "flash_designs_delete_own" on public.flash_designs for delete using (
  artist_id in (select id from public.artists where profile_id = auth.uid())
);
drop policy if exists "flash_designs_not_banned" on public.flash_designs;
create policy "flash_designs_not_banned" on public.flash_designs as restrictive for insert with check (not public.is_banned());

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tattoo_requests_flash_design_id_fkey') then
    alter table public.tattoo_requests
      add constraint tattoo_requests_flash_design_id_fkey
      foreign key (flash_design_id) references public.flash_designs(id) on delete set null;
  end if;
end $$;

-- A flash request must point at a published flash of the same artist that
-- still has copies left.
create or replace function public.guard_flash_request()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.flash_design_id is null then
    new.is_flash := false;
    return new;
  end if;
  if not exists (
    select 1 from public.flash_designs f
    where f.id = new.flash_design_id and f.artist_id = new.artist_id
      and f.is_published and f.sold_copies < f.total_copies
  ) then
    raise exception 'flash_unavailable' using errcode = 'P0001';
  end if;
  new.is_flash := true;
  return new;
end;
$$;
drop trigger if exists guard_flash_request on public.tattoo_requests;
create trigger guard_flash_request before insert on public.tattoo_requests
  for each row execute function public.guard_flash_request();

-- ── Guest spots: an artist working away for a few days ───────
create table if not exists public.guest_spots (
  id                uuid primary key default gen_random_uuid(),
  artist_id         uuid not null references public.artists(id) on delete cascade,
  artist_city       text,
  artist_country    text,
  host_city         text not null,
  host_studio       text not null,
  studio_address    text,
  date_from         date not null,
  date_to           date not null,
  styles            text[] not null default '{}',
  slots_total       int not null default 1 check (slots_total > 0),
  slots_booked      int not null default 0 check (slots_booked >= 0),
  price_from        int not null check (price_from > 0),
  instagram_handle  text,
  cover_image_url   text not null,
  description       text not null,
  is_published      boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (date_to >= date_from),
  check (slots_booked <= slots_total)
);
create index if not exists guest_spots_dates_idx on public.guest_spots (date_to, date_from);
alter table public.guest_spots enable row level security;
drop policy if exists "guest_spots_select_published" on public.guest_spots;
create policy "guest_spots_select_published" on public.guest_spots for select using (
  is_published = true or artist_id in (select id from public.artists where profile_id = auth.uid())
);
drop policy if exists "guest_spots_insert_own" on public.guest_spots;
create policy "guest_spots_insert_own" on public.guest_spots for insert with check (
  artist_id in (select id from public.artists where profile_id = auth.uid())
);
drop policy if exists "guest_spots_update_own" on public.guest_spots;
create policy "guest_spots_update_own" on public.guest_spots for update
  using (artist_id in (select id from public.artists where profile_id = auth.uid()))
  with check (artist_id in (select id from public.artists where profile_id = auth.uid()));
drop policy if exists "guest_spots_delete_own" on public.guest_spots;
create policy "guest_spots_delete_own" on public.guest_spots for delete using (
  artist_id in (select id from public.artists where profile_id = auth.uid())
);
drop policy if exists "guest_spots_not_banned" on public.guest_spots;
create policy "guest_spots_not_banned" on public.guest_spots as restrictive for insert with check (not public.is_banned());

-- ── Series and artwork labels ────────────────────────────────
create table if not exists public.artist_series (
  id          uuid primary key default gen_random_uuid(),
  artist_id   uuid not null references public.artists(id) on delete cascade,
  title       text not null check (length(trim(title)) between 1 and 60),
  description text check (description is null or length(description) <= 400),
  position    int not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists artist_series_artist_idx on public.artist_series (artist_id, position);
alter table public.artist_series enable row level security;
drop policy if exists "series_select_public" on public.artist_series;
create policy "series_select_public" on public.artist_series for select using (true);
drop policy if exists "series_manage_own" on public.artist_series;
create policy "series_manage_own" on public.artist_series for all
  using (artist_id in (select id from public.artists where profile_id = auth.uid()))
  with check (artist_id in (select id from public.artists where profile_id = auth.uid()));
revoke insert, update, delete on public.artist_series from anon;

alter table public.posts add column if not exists title text;
alter table public.posts add column if not exists body_zone text;
alter table public.posts add column if not exists session_hours numeric(4, 1);
alter table public.posts add column if not exists is_healed boolean not null default false;
alter table public.posts add column if not exists series_id uuid;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'posts_series_id_fkey') then
    alter table public.posts add constraint posts_series_id_fkey
      foreign key (series_id) references public.artist_series(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'posts_label_check') then
    alter table public.posts add constraint posts_label_check check (
      (title is null or length(title) <= 80)
      and (body_zone is null or length(body_zone) <= 60)
      and (session_hours is null or (session_hours > 0 and session_hours <= 99))
    );
  end if;
end $$;
create index if not exists posts_series_idx on public.posts (series_id) where series_id is not null;

-- posts is under column-level privileges since migration 005.
grant select (title, body_zone, session_hours, is_healed, series_id) on public.posts to anon, authenticated;
grant insert (title, body_zone, session_hours, is_healed, series_id) on public.posts to authenticated;
grant update (title, body_zone, session_hours, is_healed, series_id) on public.posts to authenticated;

-- A piece can only join a series of its own artist.
create or replace function public.guard_post_series()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.series_id is not null and not exists (
    select 1 from public.artist_series s where s.id = new.series_id and s.artist_id = new.artist_id
  ) then
    raise exception 'series_not_owned' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
drop trigger if exists guard_post_series on public.posts;
create trigger guard_post_series before insert or update of series_id, artist_id on public.posts
  for each row execute function public.guard_post_series();

-- ── Public numbers shown on cards and profiles ───────────────
-- Rating, followers, flashes left and the next free slot, for up to 60
-- artists at once. Counts only: no follower or reviewer identity leaves here.
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
    (select min(s.starts_at) from public.artist_free_slots(a.id, 45, 120) s)
  from public.artists a
  where a.id = any (p_artist_ids[1:60]);
$$;
grant execute on function public.artist_public_stats(uuid[]) to anon, authenticated;

-- ── Notifications ────────────────────────────────────────────
-- A new piece → the artist's followers (never more than 1,000 at once).
create or replace function public.notify_followers_new_post()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_blaze text;
begin
  if not coalesce(new.is_published, false) then
    return new;
  end if;
  if tg_op = 'UPDATE' and coalesce(old.is_published, false) then
    return new;
  end if;
  select blaze into v_blaze from public.artists where id = new.artist_id;
  insert into public.notifications (user_id, type, title, body, data)
  select f.follower_id, 'new_post', v_blaze,
         case when new.media_type = 'video' then 'a publié une nouvelle vidéo.' else 'a publié une nouvelle pièce.' end,
         jsonb_build_object('post_id', new.id, 'artist_id', new.artist_id, 'media_type', new.media_type)
  from public.artist_follows f
  where f.artist_id = new.artist_id
  order by f.created_at desc
  limit 1000;
  return new;
end;
$$;
drop trigger if exists notify_followers_new_post on public.posts;
create trigger notify_followers_new_post after insert or update of is_published on public.posts
  for each row execute function public.notify_followers_new_post();

-- A new follower → the artist.
create or replace function public.notify_new_follower()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
  v_name text;
begin
  select profile_id into v_owner from public.artists where id = new.artist_id;
  -- First name only: the artist learns someone follows them, not who exactly.
  select nullif(split_part(trim(display_name), ' ', 1), '') into v_name from public.profiles where id = new.follower_id;
  perform public.notify_user(
    v_owner, 'new_follower', coalesce(v_name, 'Quelqu’un'), 'suit désormais votre travail.',
    jsonb_build_object('artist_id', new.artist_id)
  );
  return new;
end;
$$;
drop trigger if exists notify_new_follower on public.artist_follows;
create trigger notify_new_follower after insert on public.artist_follows
  for each row execute function public.notify_new_follower();

-- A book reopens → everyone waiting for it, once.
create or replace function public.notify_waitlist_on_reopen()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.booking_status = 'open' and old.booking_status is distinct from 'open' then
    with told as (
      update public.artist_waitlist set status = 'notified', notified_at = now()
      where artist_id = new.id and status = 'active'
      returning user_id
    )
    insert into public.notifications (user_id, type, title, body, data)
    select user_id, 'book_reopened', new.blaze, 'reprend des projets. Envoyez votre demande.',
           jsonb_build_object('artist_id', new.id)
    from told;
  end if;
  return new;
end;
$$;
drop trigger if exists notify_waitlist_on_reopen on public.artists;
create trigger notify_waitlist_on_reopen after update of booking_status on public.artists
  for each row execute function public.notify_waitlist_on_reopen();
