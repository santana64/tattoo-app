-- ============================================================
-- INKR — Lock down direct updates on tattoo_requests (audit P0)
--
-- Before: requests_update_parties let the CLIENT update any column of
-- their request through the API (status, artist_id, budget…).
-- After:
--   * only the request's artist may UPDATE through the API;
--   * the artist may only touch status / accepted_at / decline_reason /
--     artist_notes / updated_at, and only for the answer transitions;
--   * later transitions (confirmed, completed) happen exclusively inside
--     the SECURITY DEFINER booking functions (they run as the table owner,
--     so this guard does not apply to them).
-- Idempotent.
-- ============================================================

drop policy if exists "requests_update_parties" on public.tattoo_requests;
drop policy if exists "requests_update_artist" on public.tattoo_requests;
create policy "requests_update_artist" on public.tattoo_requests
  for update to authenticated
  using (artist_id in (select id from public.artists where profile_id = auth.uid()))
  with check (artist_id in (select id from public.artists where profile_id = auth.uid()));

create or replace function public.guard_request_update()
returns trigger language plpgsql as $$
begin
  -- Only API callers are constrained; owner-level code (definer functions,
  -- dashboard, migrations) keeps full control.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if (to_jsonb(new) - array['status', 'accepted_at', 'decline_reason', 'artist_notes', 'updated_at'])
     is distinct from
     (to_jsonb(old) - array['status', 'accepted_at', 'decline_reason', 'artist_notes', 'updated_at']) then
    raise exception 'request_fields_locked' using errcode = '42501';
  end if;

  if new.status is distinct from old.status and not (
    old.status in ('submitted', 'clarification_needed')
    and new.status in ('accepted', 'declined', 'clarification_needed')
  ) then
    raise exception 'request_transition_not_allowed' using errcode = '42501';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists guard_request_update on public.tattoo_requests;
create trigger guard_request_update
  before update on public.tattoo_requests
  for each row execute function public.guard_request_update();
