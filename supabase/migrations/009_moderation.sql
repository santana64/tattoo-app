-- ============================================================
-- INKR — Moderation: administrators, reports, artist verification, bans
--
--   1. profiles.is_admin marks moderators. It is not readable or writable
--      through the API; grant it from the SQL Editor:
--        update public.profiles set is_admin = true where id = '<user id>';
--   2. Administrators list and resolve reports, and approve or reject artist
--      verification, only through SECURITY DEFINER functions that check the
--      caller. They never get raw access to the tables.
--   3. Artists ask for verification with request_verification().
--   4. A banned account can no longer publish, send requests or write messages.
--
-- Idempotent: safe to run more than once.
-- ============================================================

alter table public.profiles add column if not exists is_admin boolean not null default false;

alter table public.reports add column if not exists resolved_at timestamptz;
alter table public.reports add column if not exists resolved_by uuid references public.profiles(id) on delete set null;
alter table public.reports add column if not exists resolution_note text;

create index if not exists reports_status_idx on public.reports (status, created_at desc);

-- ── Helpers ──────────────────────────────────────────────────
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false);
$$;

create or replace function public.is_banned()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select p.is_banned from public.profiles p where p.id = auth.uid()), false);
$$;

create or replace function public.assert_admin()
returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.is_admin() from public, anon;
revoke all on function public.is_banned() from public, anon;
revoke all on function public.assert_admin() from public, anon, authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_banned() to authenticated;

-- ── Bans are enforced by the database ────────────────────────
-- Restrictive policies are ANDed with the existing ones: a banned account
-- keeps reading its data but cannot create new content.
drop policy if exists "posts_not_banned" on public.posts;
create policy "posts_not_banned" on public.posts
  as restrictive for insert to authenticated
  with check (not public.is_banned());

drop policy if exists "requests_not_banned" on public.tattoo_requests;
create policy "requests_not_banned" on public.tattoo_requests
  as restrictive for insert to authenticated
  with check (not public.is_banned());

drop policy if exists "messages_not_banned" on public.messages;
create policy "messages_not_banned" on public.messages
  as restrictive for insert to authenticated
  with check (not public.is_banned());

drop policy if exists "reviews_not_banned" on public.reviews;
create policy "reviews_not_banned" on public.reviews
  as restrictive for insert to authenticated
  with check (not public.is_banned());

-- ── Reports ──────────────────────────────────────────────────
-- One row per report with what the moderator needs to decide, whatever the
-- target type. `target_owner_id` is the account behind the reported content.
create or replace function public.admin_list_reports(p_status text default 'pending')
returns table (
  id uuid,
  created_at timestamptz,
  status text,
  reason text,
  description text,
  target_type text,
  target_id uuid,
  reporter_name text,
  target_label text,
  target_excerpt text,
  target_media_url text,
  target_owner_id uuid,
  target_owner_name text,
  target_owner_banned boolean,
  resolution_note text
)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.assert_admin();
  return query
  select
    r.id, r.created_at, r.status, r.reason, r.description, r.target_type, r.target_id,
    rp.display_name,
    case r.target_type
      when 'post' then 'Publication de ' || coalesce(pa.blaze, 'artiste supprimé')
      when 'artist' then 'Profil de ' || coalesce(a.blaze, 'artiste supprimé')
      when 'message' then 'Message de ' || coalesce(mp.display_name, 'compte supprimé')
      when 'review' then 'Avis de ' || coalesce(vp.display_name, 'compte supprimé')
    end,
    case r.target_type
      when 'post' then po.caption
      when 'artist' then a.bio
      when 'message' then m.content
      when 'review' then v.comment
    end,
    case r.target_type when 'post' then po.media_url when 'artist' then a.avatar_url end,
    owner.id, owner.display_name, coalesce(owner.is_banned, false),
    r.resolution_note
  from public.reports r
  left join public.profiles rp on rp.id = r.reporter_id
  left join public.posts po on r.target_type = 'post' and po.id = r.target_id
  left join public.artists pa on pa.id = po.artist_id
  left join public.artists a on r.target_type = 'artist' and a.id = r.target_id
  left join public.messages m on r.target_type = 'message' and m.id = r.target_id
  left join public.profiles mp on mp.id = m.sender_id
  left join public.reviews v on r.target_type = 'review' and v.id = r.target_id
  left join public.profiles vp on vp.id = v.client_id
  left join public.profiles owner on owner.id = coalesce(pa.profile_id, a.profile_id, m.sender_id, v.client_id)
  where r.status = coalesce(p_status, 'pending')
  order by r.created_at desc
  limit 200;
end;
$$;

-- Closes a report. With p_remove_content, the reported content is taken down
-- (post unpublished, review hidden); with p_ban_owner, its author is banned.
create or replace function public.admin_resolve_report(
  p_report_id uuid,
  p_status text,
  p_remove_content boolean default false,
  p_ban_owner boolean default false,
  p_note text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  rep public.reports;
  v_owner uuid;
begin
  perform public.assert_admin();
  if p_status not in ('reviewed', 'dismissed', 'actioned') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;

  select * into rep from public.reports where id = p_report_id for update;
  if not found then
    raise exception 'report_not_found' using errcode = 'P0002';
  end if;

  if p_remove_content then
    if rep.target_type = 'post' then
      update public.posts set is_published = false where id = rep.target_id;
    elsif rep.target_type = 'review' then
      update public.reviews set is_public = false where id = rep.target_id;
    end if;
  end if;

  if p_ban_owner then
    select coalesce(
      (select a.profile_id from public.posts po join public.artists a on a.id = po.artist_id
        where rep.target_type = 'post' and po.id = rep.target_id),
      (select a.profile_id from public.artists a where rep.target_type = 'artist' and a.id = rep.target_id),
      (select m.sender_id from public.messages m where rep.target_type = 'message' and m.id = rep.target_id),
      (select v.client_id from public.reviews v where rep.target_type = 'review' and v.id = rep.target_id)
    ) into v_owner;
    -- An administrator cannot be banned from the moderation screen.
    update public.profiles set is_banned = true
    where id = v_owner and not is_admin;
  end if;

  update public.reports
  set status = p_status,
      resolved_at = now(),
      resolved_by = auth.uid(),
      resolution_note = nullif(trim(p_note), '')
  where id = rep.id;
end;
$$;

create or replace function public.admin_set_ban(p_profile_id uuid, p_banned boolean)
returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_admin();
  update public.profiles set is_banned = p_banned
  where id = p_profile_id and not is_admin;
  if not found then
    raise exception 'profile_not_found_or_admin' using errcode = 'P0002';
  end if;
end;
$$;

-- ── Artist verification ──────────────────────────────────────
create or replace function public.request_verification()
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_status text;
begin
  update public.artists
  set verification_status = 'submitted', verification_submitted_at = now()
  where profile_id = auth.uid()
    and not coalesce(is_verified, false)
    and coalesce(verification_status, 'pending') in ('pending', 'rejected')
  returning verification_status into v_status;
  if v_status is null then
    select verification_status into v_status from public.artists where profile_id = auth.uid();
    if v_status is null then
      raise exception 'not_an_artist' using errcode = '42501';
    end if;
  end if;
  return v_status;
end;
$$;

create or replace function public.admin_list_verifications()
returns table (
  artist_id uuid,
  blaze text,
  city text,
  avatar_url text,
  bio text,
  stat_posts integer,
  submitted_at timestamptz,
  account_created_at timestamptz
)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.assert_admin();
  return query
  select a.id, a.blaze, a.city, a.avatar_url, a.bio, a.stat_posts, a.verification_submitted_at, a.created_at
  from public.artists a
  where a.verification_status = 'submitted'
  order by a.verification_submitted_at asc nulls last
  limit 200;
end;
$$;

create or replace function public.admin_review_verification(p_artist_id uuid, p_approve boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_profile uuid;
begin
  perform public.assert_admin();
  update public.artists
  set is_verified = p_approve,
      verification_status = case when p_approve then 'approved' else 'rejected' end
  where id = p_artist_id and verification_status = 'submitted'
  returning profile_id into v_profile;
  if v_profile is null then
    raise exception 'verification_not_pending' using errcode = 'P0002';
  end if;

  perform public.notify_user(
    v_profile,
    'system',
    case when p_approve then 'Profil vérifié' else 'Vérification refusée' end,
    case when p_approve
      then 'Votre profil d’artiste affiche désormais le badge vérifié.'
      else 'Votre demande de vérification n’a pas été retenue. Complétez votre profil puis renouvelez-la.'
    end,
    '{}'::jsonb
  );
end;
$$;

revoke all on function public.admin_list_reports(text) from public, anon;
revoke all on function public.admin_resolve_report(uuid, text, boolean, boolean, text) from public, anon;
revoke all on function public.admin_set_ban(uuid, boolean) from public, anon;
revoke all on function public.request_verification() from public, anon;
revoke all on function public.admin_list_verifications() from public, anon;
revoke all on function public.admin_review_verification(uuid, boolean) from public, anon;
grant execute on function public.admin_list_reports(text) to authenticated;
grant execute on function public.admin_resolve_report(uuid, text, boolean, boolean, text) to authenticated;
grant execute on function public.admin_set_ban(uuid, boolean) to authenticated;
grant execute on function public.request_verification() to authenticated;
grant execute on function public.admin_list_verifications() to authenticated;
grant execute on function public.admin_review_verification(uuid, boolean) to authenticated;
