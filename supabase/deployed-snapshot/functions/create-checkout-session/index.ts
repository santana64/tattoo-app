import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.0.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const STRIPE_API_VERSION = '2023-10-16';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function getStripe() {
  const secretKey = Deno.env.get('STRIPE_SECRET_KEY');
  if (!secretKey) return null;
  return new Stripe(secretKey, {
    apiVersion: STRIPE_API_VERSION,
    httpClient: Stripe.createFetchHttpClient(),
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const stripe = getStripe();
    if (!stripe) {
      return json({ error: 'Stripe is not configured', missing: 'STRIPE_SECRET_KEY' }, 500);
    }

    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    if (!serviceRoleKey || !supabaseUrl) {
      return json({ error: 'Supabase service role is not configured' }, 500);
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
    if (authError || !user) return json({ error: 'Unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));
    const period = body.period === 'yearly' ? 'yearly' : 'monthly';
    const priceEnvName = period === 'yearly' ? 'STRIPE_PRICE_YEARLY' : 'STRIPE_PRICE_MONTHLY';
    const priceId = Deno.env.get(priceEnvName);

    if (!priceId) {
      return json({ error: 'Stripe price is not configured', missing: priceEnvName }, 500);
    }

    const { data: artist, error: artistError } = await supabase
      .from('artists')
      .select('id, stripe_customer_id')
      .eq('profile_id', user.id)
      .single();

    if (artistError || !artist) return json({ error: 'Artist not found' }, 404);

    let customerId = artist.stripe_customer_id as string | null;
    if (!customerId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('email, display_name')
        .eq('id', user.id)
        .single();

      const customer = await stripe.customers.create({
        email: profile?.email ?? user.email ?? undefined,
        name: profile?.display_name ?? undefined,
        metadata: { supabase_user_id: user.id, artist_id: artist.id },
      });
      customerId = customer.id;

      const { error: updateError } = await supabase
        .from('artists')
        .update({ stripe_customer_id: customerId })
        .eq('id', artist.id);

      if (updateError) {
        console.error('create-checkout-session customer update failed', {
          artistId: artist.id,
          message: updateError.message,
        });
        return json({ error: 'Unable to save Stripe customer' }, 500);
      }
    }

    // Stripe exige des URLs https — fallback via la fonction payment-return
    const bridgeBase = `${Deno.env.get('SUPABASE_URL')}/functions/v1/payment-return?target=`;
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: body.successUrl ?? `${bridgeBase}${encodeURIComponent('settings/subscription?checkout=success')}`,
      cancel_url: body.cancelUrl ?? `${bridgeBase}${encodeURIComponent('settings/subscription?checkout=cancelled')}`,
      metadata: { artist_id: artist.id, period },
    });

    return json({ url: session.url, sessionId: session.id });
  } catch (error) {
    console.error('create-checkout-session error', {
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    return json({ error: 'Unable to create checkout session' }, 500);
  }
});
