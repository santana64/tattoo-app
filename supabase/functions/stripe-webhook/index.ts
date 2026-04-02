// Supabase Edge Function: stripe-webhook
// Deploy: supabase functions deploy stripe-webhook
// Set env: supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.0.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req) => {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature') ?? '';
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret);
  } catch (err) {
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  const getArtistByCustomer = async (customerId: string) => {
    const { data } = await supabase
      .from('artists')
      .select('id, profile_id')
      .eq('stripe_customer_id', customerId)
      .single();
    return data;
  };

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      const artist = await getArtistByCustomer(sub.customer as string);
      if (!artist) break;

      const priceId = sub.items.data[0]?.price.id;
      const isPremium = priceId === Deno.env.get('STRIPE_PREMIUM_PRICE_ID');
      const tier = isPremium ? 'premium' : 'normal';

      await supabase.from('artists').update({
        tier,
        stripe_subscription_id: sub.id,
        stripe_subscription_status: sub.status,
      }).eq('id', artist.id);

      await supabase.from('subscriptions').upsert({
        artist_id: artist.id,
        stripe_subscription_id: sub.id,
        stripe_price_id: priceId,
        tier,
        status: sub.status,
        current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
        current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
        cancel_at_period_end: sub.cancel_at_period_end,
        updated_at: new Date().toISOString(),
      });

      // Notify user
      await supabase.from('notifications').insert({
        user_id: artist.profile_id,
        type: 'subscription_renewed',
        title: `Abonnement ${tier === 'premium' ? 'Premium' : 'Normal'} actif`,
        body: `Ton abonnement TATTOO ${tier === 'premium' ? 'Premium' : 'Normal'} est bien actif.`,
      });
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      const artist = await getArtistByCustomer(sub.customer as string);
      if (!artist) break;
      await supabase.from('artists').update({
        tier: 'normal',
        stripe_subscription_status: 'canceled',
      }).eq('id', artist.id);
      await supabase.from('subscriptions').update({
        status: 'canceled',
        updated_at: new Date().toISOString(),
      }).eq('artist_id', artist.id);
      break;
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
