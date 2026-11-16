-- Apply verified Stripe subscription events exactly once, in delivery order.
-- The function is invoker-only and callable exclusively by the Edge Function's
-- service role. A single database transaction covers the event marker, artist
-- entitlement, subscription row and user notification.
create table if not exists public.stripe_subscription_events (
  event_id text primary key,
  artist_id uuid not null references public.artists(id) on delete cascade,
  stripe_subscription_id text not null,
  event_created_at timestamptz not null,
  applied boolean not null,
  created_at timestamptz not null default now()
);

create index if not exists stripe_subscription_events_artist_time_idx
  on public.stripe_subscription_events (artist_id, event_created_at desc);

alter table public.stripe_subscription_events enable row level security;
revoke all on public.stripe_subscription_events from public, anon, authenticated;
grant select, insert on public.stripe_subscription_events to service_role;

create or replace function public.apply_stripe_subscription_event(
  p_event_id text,
  p_event_created_at timestamptz,
  p_artist_id uuid,
  p_subscription_id text,
  p_status text,
  p_price_id text,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_cancel_at_period_end boolean,
  p_deleted boolean
) returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_artist public.artists%rowtype;
  v_latest timestamptz;
  v_applied boolean;
  v_tier text;
begin
  if p_event_id is null or p_subscription_id is null or p_event_created_at is null then
    raise exception 'invalid Stripe event';
  end if;

  -- Serialize concurrent deliveries for the same artist.
  select * into v_artist from public.artists where id = p_artist_id for update;
  if not found then raise exception 'artist not found'; end if;
  if exists (select 1 from public.stripe_subscription_events where event_id = p_event_id) then
    return false;
  end if;

  select max(event_created_at) into v_latest
    from public.stripe_subscription_events where artist_id = p_artist_id and applied;
  v_applied := (v_latest is null or p_event_created_at >= v_latest)
    and (not p_deleted or v_artist.stripe_subscription_id = p_subscription_id)
    and not coalesce((
      not p_deleted and v_artist.stripe_subscription_id = p_subscription_id
      and v_artist.stripe_subscription_status = 'canceled'
    ), false);

  insert into public.stripe_subscription_events
    (event_id, artist_id, stripe_subscription_id, event_created_at, applied)
  values (p_event_id, p_artist_id, p_subscription_id, p_event_created_at, v_applied);
  if not v_applied then return false; end if;

  v_tier := case when not p_deleted and p_status in ('active', 'trialing')
    then 'premium' else 'normal' end;
  update public.artists set
    tier = v_tier,
    stripe_subscription_id = p_subscription_id,
    stripe_subscription_status = case when p_deleted then 'canceled' else p_status end
  where id = p_artist_id;

  insert into public.subscriptions (
    artist_id, stripe_subscription_id, stripe_price_id, tier, status,
    current_period_start, current_period_end, cancel_at_period_end, updated_at
  ) values (
    p_artist_id, p_subscription_id, p_price_id, v_tier,
    case when p_deleted then 'canceled' else p_status end,
    p_period_start, p_period_end, p_cancel_at_period_end, now()
  ) on conflict (artist_id) do update set
    stripe_subscription_id = excluded.stripe_subscription_id,
    stripe_price_id = excluded.stripe_price_id,
    tier = excluded.tier,
    status = excluded.status,
    current_period_start = excluded.current_period_start,
    current_period_end = excluded.current_period_end,
    cancel_at_period_end = excluded.cancel_at_period_end,
    updated_at = now();

  if v_artist.tier is distinct from v_tier then
    insert into public.notifications (user_id, type, title, body)
    values (
      v_artist.profile_id, 'subscription_renewed',
      case when v_tier = 'premium' then 'Abonnement Premium actif' else 'Abonnement Standard actif' end,
      case when v_tier = 'premium'
        then 'Ton abonnement INKR Premium est bien actif.'
        else 'Ton abonnement INKR Premium n’est plus actif.' end
    );
  end if;
  return true;
end;
$$;

revoke all on function public.apply_stripe_subscription_event(
  text, timestamptz, uuid, text, text, text, timestamptz, timestamptz, boolean, boolean
) from public, anon, authenticated;
grant execute on function public.apply_stripe_subscription_event(
  text, timestamptz, uuid, text, text, text, timestamptz, timestamptz, boolean, boolean
) to service_role;
