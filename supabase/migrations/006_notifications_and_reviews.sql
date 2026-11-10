-- ============================================================
-- INKR — In-app notifications, review integrity, storage buckets
--
--   1. Notifications are written by the database when something happens
--      (new request, answer, message, appointment). Until now nothing
--      created them, so the notification centre stayed empty.
--   2. A review must target the artist of the appointment it refers to.
--   3. Storage buckets are created here instead of the manual seed.sql block.
--
-- Notification `type` values match app/notifications.tsx (resolveNotifType)
-- and `data` carries the id the screen navigates to.
-- Idempotent: safe to run more than once in the Supabase SQL Editor.
-- ============================================================

-- ── 1. Notifications ─────────────────────────────────────────
-- Users may read, mark as read and delete their own notifications, but only
-- the database writes them.
drop policy if exists "notifications_own" on public.notifications;
drop policy if exists "notifications_select_own" on public.notifications;
drop policy if exists "notifications_update_own" on public.notifications;
drop policy if exists "notifications_delete_own" on public.notifications;

create policy "notifications_select_own" on public.notifications
  for select to authenticated using (user_id = auth.uid());
create policy "notifications_update_own" on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notifications_delete_own" on public.notifications
  for delete to authenticated using (user_id = auth.uid());

revoke insert, update on public.notifications from anon, authenticated;
grant update (is_read) on public.notifications to authenticated;

create index if not exists notifications_user_idx
  on public.notifications (user_id, created_at desc);

create or replace function public.notify_user(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_data jsonb
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_user_id is null then
    return;
  end if;
  insert into public.notifications (user_id, type, title, body, data)
  values (p_user_id, p_type, p_title, p_body, p_data);
end;
$$;
revoke all on function public.notify_user(uuid, text, text, text, jsonb) from public, anon, authenticated;

-- New request → the artist. Answer → the client.
create or replace function public.notify_request_change()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_artist_profile uuid;
  v_artist_name text;
  v_client_name text;
begin
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

drop trigger if exists trg_notify_request_change on public.tattoo_requests;
create trigger trg_notify_request_change
  after insert or update of status on public.tattoo_requests
  for each row execute function public.notify_request_change();

-- New message → the other party, at most one unread notification per conversation.
create or replace function public.notify_new_message()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_client uuid;
  v_artist_profile uuid;
  v_artist_name text;
  v_recipient uuid;
  v_sender_name text;
begin
  if new.sender_id is null or new.message_type = 'system' then
    return null;
  end if;

  select r.client_id, a.profile_id, a.blaze into v_client, v_artist_profile, v_artist_name
  from public.tattoo_requests r
  join public.artists a on a.id = r.artist_id
  where r.id = new.request_id;

  if new.sender_id = v_client then
    v_recipient := v_artist_profile;
    select p.display_name into v_sender_name from public.profiles p where p.id = v_client;
  else
    v_recipient := v_client;
    v_sender_name := v_artist_name;
  end if;

  if v_recipient is null or exists (
    select 1 from public.notifications n
    where n.user_id = v_recipient
      and n.type = 'new_message'
      and n.is_read is not true
      and n.data ->> 'request_id' = new.request_id::text
  ) then
    return null;
  end if;

  perform public.notify_user(
    v_recipient, 'new_message', 'Nouveau message',
    coalesce(v_sender_name, 'Votre interlocuteur') || ' vous a écrit.',
    jsonb_build_object('request_id', new.request_id)
  );
  return null;
end;
$$;

drop trigger if exists trg_notify_new_message on public.messages;
create trigger trg_notify_new_message
  after insert on public.messages
  for each row execute function public.notify_new_message();

-- Appointment proposed / answered / completed.
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
  elsif new.status = 'canceled' and old.status = 'proposed' and auth.uid() = new.client_id then
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

drop trigger if exists trg_notify_appointment_change on public.appointments;
create trigger trg_notify_appointment_change
  after insert or update of status on public.appointments
  for each row execute function public.notify_appointment_change();

-- ── 2. Reviews ───────────────────────────────────────────────
-- Before: a client with one completed appointment could attach the review
-- to ANY artist.
drop policy if exists "reviews_insert_client" on public.reviews;
create policy "reviews_insert_client" on public.reviews
  for insert to authenticated
  with check (
    client_id = auth.uid()
    and exists (
      select 1 from public.appointments ap
      where ap.id = appointment_id
        and ap.client_id = auth.uid()
        and ap.artist_id = reviews.artist_id
        and ap.status = 'completed'
    )
  );

-- ── 3. Storage buckets ───────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('posts-media',        'posts-media',        true,  52428800, array['image/jpeg','image/png','image/webp','video/mp4']),
  ('avatars',            'avatars',            true,  5242880,  array['image/jpeg','image/png','image/webp']),
  ('covers',             'covers',             true,  10485760, array['image/jpeg','image/png','image/webp']),
  ('request-references', 'request-references', false, 10485760, array['image/jpeg','image/png','image/webp']),
  ('verification-docs',  'verification-docs',  false, 10485760, array['image/jpeg','image/png','application/pdf'])
on conflict (id) do nothing;
