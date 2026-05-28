import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@13.10.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

const PRICES = {
  monthly: Deno.env.get('STRIPE_PRICE_MONTHLY') ?? '',
  yearly:  Deno.env.get('STRIPE_PRICE_YEARLY')  ?? '',
};

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response('Unauthorized', { status: 401 });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
    if (authError || !user) return new Response('Unauthorized', { status: 401 });

    const { period = 'monthly', successUrl, cancelUrl } = await req.json();

    // Get or create Stripe customer for this artist
    const { data: artist } = await supabase
      .from('artists')
      .select('id, stripe_customer_id')
      .eq('profile_id', user.id)
      .single();

    if (!artist) return new Response('Artist not found', { status: 404 });

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

      await supabase
        .from('artists')
        .update({ stripe_customer_id: customerId })
        .eq('id', artist.id);
    }

    const priceId = PRICES[period as 'monthly' | 'yearly'];
    if (!priceId) return new Response('Invalid price period', { status: 400 });

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: successUrl ?? 'inkr://subscription/success',
      cancel_url:  cancelUrl  ?? 'inkr://subscription/cancel',
      metadata: { artist_id: artist.id },
    });

    return new Response(
      JSON.stringify({ url: session.url, sessionId: session.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('checkout error', err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
