-- V5.1: optional deposit tracking. INKR never collects or verifies these funds.
-- This is additive and MUST NOT be applied to the active production project without G0-G5 approval.
create table public.appointment_deposit_requests (
  appointment_id uuid primary key references public.appointments(id) on delete cascade,
  artist_id uuid not null references public.artists(id),
  client_id uuid not null references public.profiles(id),
  amount_cents integer not null check (amount_cents between 100 and 1000000),
  currency text not null default 'EUR' check (currency = 'EUR'),
  method text not null check (method in ('manual', 'external')),
  external_url text,
  status text not null default 'requested'
    check (status in ('requested', 'declared_received', 'waived', 'cancelled')),
  declared_received_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint deposit_external_link_consistency check (
    (method = 'manual' and external_url is null)
    or (method = 'external' and (
      external_url is not null or status in ('waived', 'cancelled')
    ))
  )
);
create index appointment_deposit_requests_artist_idx
  on public.appointment_deposit_requests (artist_id, updated_at desc);
alter table public.appointment_deposit_requests enable row level security;

-- Client and artist may read; nobody may write directly through the Data API.
revoke all on table public.appointment_deposit_requests from public, anon, authenticated;
grant select on table public.appointment_deposit_requests to authenticated;
create policy appointment_deposits_parties_read
on public.appointment_deposit_requests for select to authenticated
using (
  client_id = (select auth.uid())
  or exists (
    select 1 from public.artists a
    where a.id = artist_id and a.profile_id = (select auth.uid())
  )
);

-- The artist owns the appointment; clients cannot forge an amount, a link or a received status.
create function public.set_appointment_deposit_request(
  p_appointment_id uuid,
  p_amount_cents integer,
  p_method text,
  p_external_url text default null
) returns public.appointment_deposit_requests
language plpgsql security definer set search_path = ''
as $$
declare
  v_appointment public.appointments;
  v_artist_profile uuid;
  v_url text;
  v_host text;
  v_existing public.appointment_deposit_requests;
  v_result public.appointment_deposit_requests;
begin
  select * into v_appointment from public.appointments
  where id = p_appointment_id for update;
  if not found then
    raise exception 'deposit_appointment_not_found' using errcode = '42501';
  end if;
  select profile_id into v_artist_profile from public.artists
  where id = v_appointment.artist_id;
  if v_artist_profile is distinct from auth.uid() then
    raise exception 'deposit_not_artist' using errcode = '42501';
  end if;
  if v_appointment.status <> 'confirmed'
     or v_appointment.starts_at <= now()
     or v_appointment.client_id is null then
    raise exception 'deposit_appointment_not_open' using errcode = 'P0001';
  end if;
  if p_amount_cents is null or p_amount_cents not between 100 and 1000000
     or p_method not in ('manual', 'external') or p_method is null then
    raise exception 'deposit_invalid_details' using errcode = 'P0001';
  end if;

  v_url := nullif(btrim(p_external_url), '');
  if p_method = 'manual' then
    if v_url is not null then
      raise exception 'deposit_manual_has_link' using errcode = 'P0001';
    end if;
  else
    -- Only vetted payment-provider hosts, exact hostname matches and HTTPS.
    -- Never open untrusted artist-supplied destinations by automatic redirect.
    if v_url is null or length(v_url) > 1600
       or left(v_url, 8) <> 'https://'
       or v_url ~ '[[:space:]<>"@]' then
      raise exception 'deposit_invalid_payment_link' using errcode = 'P0001';
    end if;
    v_host := lower(split_part(substring(v_url from 9), '/', 1));
    if v_host not in ('buy.stripe.com', 'paypal.me', 'www.paypal.com',
                      'pay.sumup.com', 'my.sumup.com', 'revolut.me')
       or position('/' in substring(v_url from 9)) = 0 then
      raise exception 'deposit_unapproved_payment_provider' using errcode = 'P0001';
    end if;
  end if;

  select * into v_existing from public.appointment_deposit_requests
  where appointment_id = p_appointment_id for update;
  if found and v_existing.status <> 'requested' then
    raise exception 'deposit_already_finalized' using errcode = 'P0001';
  end if;

  insert into public.appointment_deposit_requests
    (appointment_id, artist_id, client_id, amount_cents, method, external_url)
  values
    (p_appointment_id, v_appointment.artist_id, v_appointment.client_id,
     p_amount_cents, p_method, v_url)
  on conflict (appointment_id) do update set
    amount_cents = excluded.amount_cents,
    method = excluded.method,
    external_url = excluded.external_url,
    updated_at = now()
  returning * into v_result;
  return v_result;
end;
$$;
revoke all on function public.set_appointment_deposit_request(uuid, integer, text, text)
from public, anon, authenticated;
grant execute on function public.set_appointment_deposit_request(uuid, integer, text, text)
to authenticated;

-- The artist reports a received payment; no platform-side payment verification is claimed.
create function public.finalize_appointment_deposit_request(
  p_appointment_id uuid,
  p_status text
) returns public.appointment_deposit_requests
language plpgsql security definer set search_path = ''
as $$
declare
  v_row public.appointment_deposit_requests;
  v_appointment public.appointments;
  v_owner uuid;
begin
  select * into v_appointment from public.appointments
  where id = p_appointment_id for update;
  if not found then
    raise exception 'deposit_appointment_not_found' using errcode = '42501';
  end if;
  select profile_id into v_owner from public.artists where id = v_appointment.artist_id;
  if v_owner is distinct from auth.uid() then
    raise exception 'deposit_not_artist' using errcode = '42501';
  end if;
  if p_status not in ('declared_received', 'waived') or p_status is null then
    raise exception 'deposit_invalid_status' using errcode = 'P0001';
  end if;
  select * into v_row from public.appointment_deposit_requests
    where appointment_id = p_appointment_id for update;
  if not found then
    raise exception 'deposit_not_requested' using errcode = 'P0001';
  end if;
  if v_row.status = p_status then return v_row; end if;
  if v_row.status <> 'requested' or v_appointment.status = 'canceled' then
    raise exception 'deposit_already_finalized' using errcode = 'P0001';
  end if;
  update public.appointment_deposit_requests
  set status = p_status,
      declared_received_at = case when p_status = 'declared_received' then now() else null end,
      external_url = case when p_status = 'waived' then null else external_url end,
      updated_at = now()
  where appointment_id = p_appointment_id
  returning * into v_row;
  return v_row;
end;
$$;
revoke all on function public.finalize_appointment_deposit_request(uuid, text)
from public, anon, authenticated;
grant execute on function public.finalize_appointment_deposit_request(uuid, text)
to authenticated;

-- Stop showing pending payment links when the associated appointment is cancelled.
create function public.close_cancelled_appointment_deposit()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.status = 'canceled' and old.status is distinct from 'canceled' then
    update public.appointment_deposit_requests
    set status = 'cancelled', external_url = null, updated_at = now()
    where appointment_id = new.id and status = 'requested';
  end if;
  return new;
end;
$$;
revoke all on function public.close_cancelled_appointment_deposit()
from public, anon, authenticated;
drop trigger if exists appointment_deposit_cancelled on public.appointments;
create trigger appointment_deposit_cancelled
  after update of status on public.appointments
  for each row execute function public.close_cancelled_appointment_deposit();

comment on table public.appointment_deposit_requests is
'Voluntary external/manual deposit tracking. No money held, verified or settled by INKR.';
