// Supabase Edge Function: create-checkout-session
// Starts a Stripe Checkout session for the signed-in artist's Premium plan.
//
// Deploy: supabase functions deploy create-checkout-session
// Secrets: STRIPE_SECRET_KEY, STRIPE_PRICE_MONTHLY, STRIPE_PRICE_YEARLY, ALLOWED_ORIGINS
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@13.10.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { bearerToken, corsHeaders, isAllowedReturnUrl, json } from '../_shared/http.ts';

// Stripe only accepts https return URLs. Without one from an allowed web
// origin, the session returns through the payment-return function, which
// forwards to the app's inkr:// deep link.
const bridgeUrl = (target: string) =>
  `${Deno.env.get('SUPABASE_URL') ?? ''}/functions/v1/payment-return?target=${encodeURIComponent(target)}`;
const isWebReturnUrl = (url: unknown): url is string =>
  isAllowedReturnUrl(url) && /^https?:\/\//i.test(url);

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, { error: 'method_not_allowed' }, 405);

  try {
    const jwt = bearerToken(req);
    if (!jwt) return json(req, { error: 'unauthorized' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
    if (authError || !user) return json(req, { error: 'unauthorized' }, 401);

    let body: Record<string, unknown> = {};
    try {
      const parsed = await req.json();
      if (parsed && typeof parsed === 'object') body = parsed as Record<string, unknown>;
    } catch {
      return json(req, { error: 'invalid_body' }, 400);
    }

    const period = typeof body.period === 'string' ? body.period : 'monthly';
    if (period !== 'monthly' && period !== 'yearly') return json(req, { error: 'invalid_period' }, 400);
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    const priceId = Deno.env.get(period === 'monthly' ? 'STRIPE_PRICE_MONTHLY' : 'STRIPE_PRICE_YEARLY');
    if (!stripeKey || !priceId) return json(req, { error: 'checkout_unavailable' }, 503);
    const stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    // Return URLs come from the client: only the app itself is accepted, so a
    // crafted request cannot turn Stripe's redirect into an open redirect.
    const successUrl = isWebReturnUrl(body.successUrl)
      ? body.successUrl
      : bridgeUrl('settings/subscription?checkout=success');
    const cancelUrl = isWebReturnUrl(body.cancelUrl)
      ? body.cancelUrl
      : bridgeUrl('settings/subscription?checkout=cancelled');

    const { data: artist } = await supabase
      .from('artists')
      .select('id, stripe_customer_id')
      .eq('profile_id', user.id)
      .single();
    if (!artist) return json(req, { error: 'artist_not_found' }, 404);

    // Get or create the Stripe customer for this artist.
    let customerId = artist.stripe_customer_id;
    if (!customerId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('email, display_name')
        .eq('id', user.id)
        .single();

      const customer = await stripe.customers.create({
        email: profile?.email ?? user.email,
        name: profile?.display_name,
        metadata: { supabase_user_id: user.id, artist_id: artist.id },
      });
      customerId = customer.id;

      const { error: saveError } = await supabase
        .from('artists')
        .update({ stripe_customer_id: customerId })
        .eq('id', artist.id);
      if (saveError) throw new Error(`customer id not saved: ${saveError.message}`);
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { artist_id: artist.id, period },
    });

    return json(req, { url: session.url, sessionId: session.id });
  } catch (err) {
    // Details stay in the function logs; the caller gets a stable code.
    console.error('checkout error', err);
    return json(req, { error: 'checkout_failed' }, 500);
  }
});
