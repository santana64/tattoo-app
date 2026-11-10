// Supabase Edge Function: stripe-webhook
// Keeps artists.tier and the subscriptions table in sync with Stripe.
//
// Deploy: supabase functions deploy stripe-webhook --no-verify-jwt
// Secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_MONTHLY, STRIPE_PRICE_YEARLY
//          (STRIPE_PREMIUM_PRICE_ID is still honoured for older setups)
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.0.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

// The same prices the checkout sells: monthly and yearly are both Premium.
const PREMIUM_PRICE_IDS = new Set(
  [
    Deno.env.get('STRIPE_PRICE_MONTHLY'),
    Deno.env.get('STRIPE_PRICE_YEARLY'),
    Deno.env.get('STRIPE_PREMIUM_PRICE_ID'),
  ].filter((id): id is string => !!id),
);

// Premium is granted only while Stripe considers the subscription paid.
const PAID_STATUSES = new Set(['active', 'trialing']);

type Tier = 'normal' | 'premium';

const toIso = (seconds: number | null | undefined) =>
  typeof seconds === 'number' ? new Date(seconds * 1000).toISOString() : null;

async function getArtistByCustomer(customerId: string) {
  const { data, error } = await supabase
    .from('artists')
    .select('id, profile_id, tier')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();
  if (error) throw new Error(`artist lookup failed: ${error.message}`);
  return data;
}

async function notifyTierChange(profileId: string, tier: Tier) {
  const premium = tier === 'premium';
  const { error } = await supabase.from('notifications').insert({
    user_id: profileId,
    type: premium ? 'subscription_active' : 'subscription_ended',
    title: premium ? 'INKR Premium actif' : 'INKR Premium terminé',
    body: premium
      ? 'Votre abonnement Premium est actif. Merci de votre confiance.'
      : 'Votre abonnement Premium n’est plus actif. Votre profil repasse en formule standard.',
  });
  // A missed notification must not make Stripe retry the whole event.
  if (error) console.error('stripe-webhook: notification failed', error.message);
}

async function syncSubscription(sub: Stripe.Subscription) {
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  const artist = await getArtistByCustomer(customerId);
  if (!artist) {
    console.warn('stripe-webhook: no artist for customer', customerId);
    return;
  }

  const priceId = sub.items.data[0]?.price.id ?? null;
  const ended = sub.status === 'canceled' || sub.status === 'incomplete_expired';
  const tier: Tier = !ended && priceId !== null && PREMIUM_PRICE_IDS.has(priceId) && PAID_STATUSES.has(sub.status)
    ? 'premium'
    : 'normal';

  const { error: artistError } = await supabase
    .from('artists')
    .update({
      tier,
      stripe_subscription_id: sub.id,
      stripe_subscription_status: sub.status,
    })
    .eq('id', artist.id);
  if (artistError) throw new Error(`artist update failed: ${artistError.message}`);

  // One row per artist: later events update it instead of failing on the unique key.
  const { error: subscriptionError } = await supabase.from('subscriptions').upsert(
    {
      artist_id: artist.id,
      stripe_subscription_id: sub.id,
      stripe_price_id: priceId,
      tier,
      status: sub.status,
      current_period_start: toIso(sub.current_period_start),
      current_period_end: toIso(sub.current_period_end),
      cancel_at_period_end: sub.cancel_at_period_end,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'artist_id' },
  );
  if (subscriptionError) throw new Error(`subscription upsert failed: ${subscriptionError.message}`);

  // Stripe sends many updates per subscription: only tell the user when the plan actually changes.
  if (artist.tier !== tier) await notifyTierChange(artist.profile_id, tier);
}

serve(async (req) => {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature') ?? '';
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    console.error('stripe-webhook: signature verification failed', err);
    return new Response('invalid signature', { status: 400 });
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await syncSubscription(event.data.object as Stripe.Subscription);
        break;
    }
  } catch (err) {
    // A 5xx makes Stripe retry later instead of silently losing the change.
    console.error('stripe-webhook: handling failed', event.type, err);
    return new Response('handler error', { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
