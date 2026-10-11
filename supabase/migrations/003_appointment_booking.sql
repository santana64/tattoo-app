-- ============================================================
-- INKR — Appointment booking flow
--   artist proposes a slot  → client accepts / declines → artist marks it done
--
-- All state changes go through SECURITY DEFINER functions that check who is
-- calling and which transition is allowed; clients never get a raw UPDATE.
-- Idempotent: safe to run more than once in the Supabase SQL Editor.
-- ============================================================

create extension if not exists btree_gist;

-- ── Integrity ────────────────────────────────────────────────
alter table public.appointments drop constraint if exists appointments_time_order;
alter table public.appointments
  add constraint appointments_time_order check (ends_at > starts_at);

-- One artist cannot hold two overlapping confirmed sessions, even under
-- concurrent confirmations (enforced by the database, not the app).
alter table public.appointments drop constraint if exists appointments_no_overlap;
alter table public.appointments
  add constraint appointments_no_overlap
  exclude using gist (artist_id with =, tstzrange(starts_at, ends_at, '[)') with &&)
  where (status = 'confirmed');

create index if not exists appointments_request_idx on public.appointments (request_id, starts_at desc);

-- ── Artist proposes a slot ───────────────────────────────────
create or replace function public.propose_appointment(
  p_request_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_notes text default null
) returns public.appointments
language plpgsql security definer set search_path = public as $$
declare
  req public.tattoo_requests;
  appt public.appointments;
begin
  select r.* into req
  from public.tattoo_requests r
  join public.artists a on a.id = r.artist_id
  where r.id = p_request_id and a.profile_id = auth.uid();
  if not found then
    raise exception 'not_request_artist' using errcode = '42501';
  end if;
  if req.status not in ('accepted', 'confirmed') then
    raise exception 'request_not_accepted' using errcode = 'P0001';
  end if;
  if p_ends_at <= p_starts_at or p_starts_at < now() then
    raise exception 'invalid_slot' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.appointments
    where artist_id = req.artist_id and status = 'confirmed'
      and tstzrange(starts_at, ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')
  ) then
    raise exception 'slot_taken' using errcode = 'P0001';
  end if;

  -- A new proposal replaces any pending one for this request.
  update public.appointments set status = 'canceled', updated_at = now()
  where request_id = req.id and status = 'proposed';

  insert into public.appointments (request_id, artist_id, client_id, starts_at, ends_at, body_zone, notes, status)
  values (req.id, req.artist_id, req.client_id, p_starts_at, p_ends_at, req.body_zone, nullif(trim(p_notes), ''), 'proposed')
  returning * into appt;
  return appt;
end;
$$;

-- ── Client accepts or declines ───────────────────────────────
create or replace function public.respond_to_appointment(
  p_appointment_id uuid,
  p_accept boolean
) returns public.appointments
language plpgsql security definer set search_path = public as $$
declare
  appt public.appointments;
begin
  select * into appt from public.appointments
  where id = p_appointment_id and client_id = auth.uid()
  for update;
  if not found then
    raise exception 'not_appointment_client' using errcode = '42501';
  end if;
  if appt.status <> 'proposed' then
    raise exception 'not_pending' using errcode = 'P0001';
  end if;

  if p_accept then
    if appt.starts_at < now() then
      raise exception 'invalid_slot' using errcode = 'P0001';
    end if;
    -- The exclusion constraint rejects a slot confirmed elsewhere meanwhile.
    update public.appointments set status = 'confirmed', updated_at = now()
    where id = appt.id returning * into appt;
    update public.tattoo_requests set status = 'confirmed', confirmed_at = now(), updated_at = now()
    where id = appt.request_id and status in ('accepted', 'confirmed');
  else
    update public.appointments set status = 'canceled', updated_at = now()
    where id = appt.id returning * into appt;
  end if;
  return appt;
end;
$$;

-- ── Artist marks the session as done ─────────────────────────
create or replace function public.complete_appointment(
  p_appointment_id uuid
) returns public.appointments
language plpgsql security definer set search_path = public as $$
declare
  appt public.appointments;
begin
  select ap.* into appt
  from public.appointments ap
  join public.artists a on a.id = ap.artist_id
  where ap.id = p_appointment_id and a.profile_id = auth.uid()
  for update of ap;
  if not found then
    raise exception 'not_appointment_artist' using errcode = '42501';
  end if;
  if appt.status <> 'confirmed' then
    raise exception 'not_confirmed' using errcode = 'P0001';
  end if;
  if appt.starts_at > now() then
    raise exception 'not_started' using errcode = 'P0001';
  end if;

  update public.appointments set status = 'completed', updated_at = now()
  where id = appt.id returning * into appt;
  update public.tattoo_requests set status = 'completed', completed_at = now(), updated_at = now()
  where id = appt.request_id;
  return appt;
end;
$$;

revoke all on function public.propose_appointment(uuid, timestamptz, timestamptz, text) from public, anon;
revoke all on function public.respond_to_appointment(uuid, boolean) from public, anon;
revoke all on function public.complete_appointment(uuid) from public, anon;
grant execute on function public.propose_appointment(uuid, timestamptz, timestamptz, text) to authenticated;
grant execute on function public.respond_to_appointment(uuid, boolean) to authenticated;
grant execute on function public.complete_appointment(uuid) to authenticated;
