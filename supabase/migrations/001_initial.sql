-- ============================================================
-- TATTOO App — Supabase Migration 001
-- Run this in the Supabase SQL Editor or via CLI:
--   supabase db push
-- ============================================================

-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";

-- ============================================================
-- TABLE: profiles
-- ============================================================
create table if not exists public.profiles (
  id            uuid references auth.users(id) on delete cascade primary key,
  display_name  text not null,
  email         text not null,
  avatar_url    text,
  role          text not null check (role in ('user', 'artist')) default 'user',
  city          text,
  style_prefs   text[] default '{}',
  onboarding_completed boolean default false,
  trust_score   int default 0 check (trust_score >= 0 and trust_score <= 100),
  is_banned     boolean default false,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

alter table public.profiles enable row level security;
create policy "profiles_select_all" on public.profiles for select using (true);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, display_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email
  );
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- TABLE: artists
-- ============================================================
create table if not exists public.artists (
  id              uuid primary key default uuid_generate_v4(),
  profile_id      uuid references public.profiles(id) on delete cascade unique not null,
  blaze           text not null,
  city            text not null,
  bio             text,
  cover_url       text,
  avatar_url      text,
  styles          text[] default '{}',
  specialties     text[] default '{}',
  booking_status  text not null check (booking_status in ('open', 'paused', 'closed')) default 'open',
  min_budget      int default 0,
  tier            text not null check (tier in ('normal', 'premium')) default 'normal',
  is_verified     boolean default false,
  exclusions      text[] default '{}',
  rules           text,
  process         text,
  visual_preset   text default 'minimal',
  show_availability boolean default true,
  show_stats      boolean default true,
  show_min_budget boolean default true,
  sections_config jsonb default '{"gallery":true,"bio":true,"styles":true,"rules":true,"process":false,"faq":false}'::jsonb,
  stripe_customer_id        text,
  stripe_subscription_id    text,
  stripe_subscription_status text,
  stat_posts          int default 0,
  stat_profile_views  int default 0,
  stat_requests_month int default 0,
  verification_status text default 'pending' check (verification_status in ('pending','submitted','approved','rejected')),
  verification_submitted_at timestamptz,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

alter table public.artists enable row level security;
create policy "artists_select_all" on public.artists for select using (true);
create policy "artists_update_own" on public.artists for update using (profile_id = auth.uid());
create policy "artists_insert_own" on public.artists for insert with check (profile_id = auth.uid());

-- ============================================================
-- TABLE: artist_faq
-- ============================================================
create table if not exists public.artist_faq (
  id          uuid primary key default uuid_generate_v4(),
  artist_id   uuid references public.artists(id) on delete cascade not null,
  question    text not null,
  answer      text not null,
  position    int not null default 0,
  created_at  timestamptz default now()
);

alter table public.artist_faq enable row level security;
create policy "faq_select_all" on public.artist_faq for select using (true);
create policy "faq_manage_own" on public.artist_faq for all using (
  artist_id in (select id from public.artists where profile_id = auth.uid())
);

-- ============================================================
-- TABLE: posts
-- ============================================================
create table if not exists public.posts (
  id          uuid primary key default uuid_generate_v4(),
  artist_id   uuid references public.artists(id) on delete cascade not null,
  media_url   text not null,
  media_type  text not null check (media_type in ('photo', 'video')) default 'photo',
  caption     text,
  styles      text[] default '{}',
  likes_count int default 0,
  views_count int default 0,
  is_published boolean default true,
  published_at timestamptz default now(),
  created_at  timestamptz default now()
);

alter table public.posts enable row level security;
create policy "posts_select_published" on public.posts for select using (is_published = true);
create policy "posts_manage_own" on public.posts for all using (
  artist_id in (select id from public.artists where profile_id = auth.uid())
);

-- Trigger: update stat_posts
create or replace function update_artist_post_count()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update public.artists set stat_posts = stat_posts + 1 where id = new.artist_id;
  elsif tg_op = 'DELETE' then
    update public.artists set stat_posts = greatest(0, stat_posts - 1) where id = old.artist_id;
  end if;
  return null;
end;
$$;
create trigger trg_artist_post_count after insert or delete on public.posts
  for each row execute function update_artist_post_count();

-- ============================================================
-- TABLE: post_likes
-- ============================================================
create table if not exists public.post_likes (
  post_id    uuid references public.posts(id) on delete cascade not null,
  user_id    uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz default now(),
  primary key (post_id, user_id)
);

alter table public.post_likes enable row level security;
create policy "likes_select_all" on public.post_likes for select using (true);
create policy "likes_manage_own" on public.post_likes for all using (user_id = auth.uid());

create or replace function update_post_likes_count()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set likes_count = likes_count + 1 where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update public.posts set likes_count = greatest(0, likes_count - 1) where id = old.post_id;
  end if;
  return null;
end;
$$;
create trigger trg_post_likes after insert or delete on public.post_likes
  for each row execute function update_post_likes_count();

-- ============================================================
-- TABLE: saved_artists
-- ============================================================
create table if not exists public.saved_artists (
  user_id    uuid references public.profiles(id) on delete cascade not null,
  artist_id  uuid references public.artists(id) on delete cascade not null,
  created_at timestamptz default now(),
  primary key (user_id, artist_id)
);

alter table public.saved_artists enable row level security;
create policy "saved_artists_own" on public.saved_artists for all using (user_id = auth.uid());

-- ============================================================
-- TABLE: saved_posts
-- ============================================================
create table if not exists public.saved_posts (
  user_id    uuid references public.profiles(id) on delete cascade not null,
  post_id    uuid references public.posts(id) on delete cascade not null,
  created_at timestamptz default now(),
  primary key (user_id, post_id)
);

alter table public.saved_posts enable row level security;
create policy "saved_posts_own" on public.saved_posts for all using (user_id = auth.uid());

-- ============================================================
-- TABLE: tattoo_requests
-- ============================================================
create table if not exists public.tattoo_requests (
  id                uuid primary key default uuid_generate_v4(),
  client_id         uuid references public.profiles(id) on delete set null,
  artist_id         uuid references public.artists(id) on delete set null not null,
  project_type      text not null check (project_type in ('new','cover_up','touch_up','extension')),
  body_zone         text not null,
  size_category     text not null check (size_category in ('xs','s','m','l','xl')),
  budget_min        int,
  budget_max        int,
  budget_unknown    boolean default false,
  color_preference  text not null check (color_preference in ('black_grey','color','artist_choice')),
  style_preference  text,
  description       text not null,
  flexibility_level text not null check (flexibility_level in ('precise','open','full_trust')),
  is_first_tattoo   boolean default false,
  status            text not null default 'submitted' check (
    status in ('submitted','accepted','declined','clarification_needed','confirmed','completed','archived')
  ),
  decline_reason    text,
  artist_notes      text,
  submitted_at      timestamptz default now(),
  accepted_at       timestamptz,
  confirmed_at      timestamptz,
  completed_at      timestamptz,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

alter table public.tattoo_requests enable row level security;
create policy "requests_select_parties" on public.tattoo_requests for select using (
  client_id = auth.uid()
  or artist_id in (select id from public.artists where profile_id = auth.uid())
);
create policy "requests_insert_client" on public.tattoo_requests for insert with check (client_id = auth.uid());
create policy "requests_update_parties" on public.tattoo_requests for update using (
  client_id = auth.uid()
  or artist_id in (select id from public.artists where profile_id = auth.uid())
);

-- Trigger: update stat_requests_month
create or replace function update_artist_requests_count()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update public.artists set stat_requests_month = stat_requests_month + 1 where id = new.artist_id;
  end if;
  return null;
end;
$$;
create trigger trg_artist_requests after insert on public.tattoo_requests
  for each row execute function update_artist_requests_count();

-- ============================================================
-- TABLE: request_references
-- ============================================================
create table if not exists public.request_references (
  id          uuid primary key default uuid_generate_v4(),
  request_id  uuid references public.tattoo_requests(id) on delete cascade not null,
  url         text not null,
  created_at  timestamptz default now()
);

alter table public.request_references enable row level security;
create policy "refs_select_parties" on public.request_references for select using (
  request_id in (
    select id from public.tattoo_requests
    where client_id = auth.uid()
    or artist_id in (select id from public.artists where profile_id = auth.uid())
  )
);
create policy "refs_insert_client" on public.request_references for insert with check (
  request_id in (select id from public.tattoo_requests where client_id = auth.uid())
);

-- ============================================================
-- TABLE: messages
-- ============================================================
create table if not exists public.messages (
  id           uuid primary key default uuid_generate_v4(),
  request_id   uuid references public.tattoo_requests(id) on delete cascade not null,
  sender_id    uuid references public.profiles(id) on delete set null,
  content      text not null,
  message_type text not null default 'text' check (
    message_type in ('text','system','slot_proposal','appointment_confirmed','image')
  ),
  metadata     jsonb,
  is_read      boolean default false,
  created_at   timestamptz default now()
);

alter table public.messages enable row level security;
create policy "messages_select_parties" on public.messages for select using (
  request_id in (
    select id from public.tattoo_requests
    where client_id = auth.uid()
    or artist_id in (select id from public.artists where profile_id = auth.uid())
  )
);
create policy "messages_insert_parties" on public.messages for insert with check (
  request_id in (
    select id from public.tattoo_requests
    where client_id = auth.uid()
    or artist_id in (select id from public.artists where profile_id = auth.uid())
  )
  and sender_id = auth.uid()
);
create policy "messages_update_own" on public.messages for update using (sender_id = auth.uid());

-- ============================================================
-- TABLE: appointments
-- ============================================================
create table if not exists public.appointments (
  id          uuid primary key default uuid_generate_v4(),
  request_id  uuid references public.tattoo_requests(id) on delete cascade not null,
  artist_id   uuid references public.artists(id) on delete set null,
  client_id   uuid references public.profiles(id) on delete set null,
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  status      text not null default 'proposed' check (
    status in ('proposed','confirmed','completed','canceled')
  ),
  body_zone   text,
  notes       text,
  deposit_paid boolean default false,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

alter table public.appointments enable row level security;
create policy "appointments_select_parties" on public.appointments for select using (
  client_id = auth.uid()
  or artist_id in (select id from public.artists where profile_id = auth.uid())
);
create policy "appointments_manage_artist" on public.appointments for all using (
  artist_id in (select id from public.artists where profile_id = auth.uid())
);

-- ============================================================
-- TABLE: artist_availability
-- ============================================================
create table if not exists public.artist_availability (
  id          uuid primary key default uuid_generate_v4(),
  artist_id   uuid references public.artists(id) on delete cascade not null,
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  is_blocked  boolean default false,
  label       text,
  created_at  timestamptz default now()
);

alter table public.artist_availability enable row level security;
create policy "availability_select_public" on public.artist_availability for select using (
  is_blocked = false
  or artist_id in (select id from public.artists where profile_id = auth.uid())
);
create policy "availability_manage_own" on public.artist_availability for all using (
  artist_id in (select id from public.artists where profile_id = auth.uid())
);

-- ============================================================
-- TABLE: reviews
-- ============================================================
create table if not exists public.reviews (
  id              uuid primary key default uuid_generate_v4(),
  appointment_id  uuid references public.appointments(id) on delete cascade unique not null,
  artist_id       uuid references public.artists(id) on delete cascade not null,
  client_id       uuid references public.profiles(id) on delete set null not null,
  rating          int not null check (rating >= 1 and rating <= 5),
  comment         text,
  is_public       boolean default true,
  created_at      timestamptz default now()
);

alter table public.reviews enable row level security;
create policy "reviews_select_public" on public.reviews for select using (is_public = true);
create policy "reviews_select_own" on public.reviews for select using (client_id = auth.uid());
create policy "reviews_insert_client" on public.reviews for insert with check (
  client_id = auth.uid()
  and appointment_id in (
    select id from public.appointments where client_id = auth.uid() and status = 'completed'
  )
);

-- ============================================================
-- TABLE: notifications
-- ============================================================
create table if not exists public.notifications (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid references public.profiles(id) on delete cascade not null,
  type          text not null,
  title         text not null,
  body          text not null,
  data          jsonb,
  is_read       boolean default false,
  created_at    timestamptz default now()
);

alter table public.notifications enable row level security;
create policy "notifications_own" on public.notifications for all using (user_id = auth.uid());

-- ============================================================
-- TABLE: push_tokens
-- ============================================================
create table if not exists public.push_tokens (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references public.profiles(id) on delete cascade not null,
  token       text not null unique,
  platform    text check (platform in ('ios','android')),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

alter table public.push_tokens enable row level security;
create policy "push_tokens_own" on public.push_tokens for all using (user_id = auth.uid());

-- ============================================================
-- TABLE: reports
-- ============================================================
create table if not exists public.reports (
  id              uuid primary key default uuid_generate_v4(),
  reporter_id     uuid references public.profiles(id) on delete set null not null,
  target_type     text not null check (target_type in ('post','artist','message','review')),
  target_id       uuid not null,
  reason          text not null check (reason in ('spam','inappropriate','fake','harassment','other')),
  description     text,
  status          text default 'pending' check (status in ('pending','reviewed','dismissed','actioned')),
  created_at      timestamptz default now()
);

alter table public.reports enable row level security;
create policy "reports_insert_auth" on public.reports for insert with check (reporter_id = auth.uid());
create policy "reports_select_own" on public.reports for select using (reporter_id = auth.uid());

-- ============================================================
-- TABLE: artist_analytics_events
-- ============================================================
create table if not exists public.artist_analytics_events (
  id          uuid primary key default uuid_generate_v4(),
  artist_id   uuid references public.artists(id) on delete cascade not null,
  event_type  text not null check (event_type in ('profile_view','post_view','request_sent')),
  source_user uuid references public.profiles(id) on delete set null,
  metadata    jsonb,
  created_at  timestamptz default now()
);

alter table public.artist_analytics_events enable row level security;
create policy "analytics_insert_any" on public.artist_analytics_events for insert with check (true);
create policy "analytics_select_own" on public.artist_analytics_events for select using (
  artist_id in (select id from public.artists where profile_id = auth.uid())
);

-- ============================================================
-- TABLE: subscriptions
-- ============================================================
create table if not exists public.subscriptions (
  id                      uuid primary key default uuid_generate_v4(),
  artist_id               uuid references public.artists(id) on delete cascade unique not null,
  stripe_subscription_id  text unique,
  stripe_price_id         text,
  tier                    text check (tier in ('normal','premium')),
  status                  text,
  current_period_start    timestamptz,
  current_period_end      timestamptz,
  cancel_at_period_end    boolean default false,
  created_at              timestamptz default now(),
  updated_at              timestamptz default now()
);

alter table public.subscriptions enable row level security;
create policy "subscriptions_own" on public.subscriptions for select using (
  artist_id in (select id from public.artists where profile_id = auth.uid())
);

-- ============================================================
-- REALTIME — Enable on key tables
-- ============================================================
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.tattoo_requests;
alter publication supabase_realtime add table public.appointments;

-- ============================================================
-- STORAGE BUCKETS (run separately or via Supabase dashboard)
-- ============================================================
-- insert into storage.buckets (id, name, public) values ('posts-media', 'posts-media', true);
-- insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true);
-- insert into storage.buckets (id, name, public) values ('covers', 'covers', true);
-- insert into storage.buckets (id, name, public) values ('request-references', 'request-references', false);
-- insert into storage.buckets (id, name, public) values ('verification-docs', 'verification-docs', false);
