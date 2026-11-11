// Supabase Edge Function: create-billing-portal-session
// Lets an authenticated artist manage/cancel their Stripe subscription.
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
    if (!stripe) return json({ error: 'Stripe is not configured', missing: 'STRIPE_SECRET_KEY' }, 500);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: 'Supabase service role is not configured' }, 500);
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
    if (authError || !user) return json({ error: 'Unauthorized' }, 401);

    const { data: artist, error: artistError } = await supabase
      .from('artists')
      .select('id, stripe_customer_id')
      .eq('profile_id', user.id)
      .single();

    if (artistError || !artist) return json({ error: 'Artist not found' }, 404);
    if (!artist.stripe_customer_id) {
      return json({ error: 'No Stripe customer exists for this artist' }, 404);
    }

    const body = await req.json().catch(() => ({}));
    const session = await stripe.billingPortal.sessions.create({
      customer: artist.stripe_customer_id,
      return_url: body.returnUrl ?? 'inkr://settings/subscription',
    });

    return json({ url: session.url });
  } catch (error) {
    console.error('create-billing-portal-session error', {
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    return json({ error: 'Unable to create billing portal session' }, 500);
  }
});
