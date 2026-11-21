-- Harden external deposit RPCs: suspended artists may not request or acknowledge deposits.
-- Staging only pending G0-G5 approval for active production.
create or replace function public.set_appointment_deposit_request(
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
  if public.is_banned() then
    raise exception 'deposit_account_banned' using errcode = '42501';
  end if;
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

create or replace function public.finalize_appointment_deposit_request(
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
  if public.is_banned() then
    raise exception 'deposit_account_banned' using errcode = '42501';
  end if;
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
