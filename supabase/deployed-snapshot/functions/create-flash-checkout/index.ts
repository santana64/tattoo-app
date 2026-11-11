// Supabase Edge Function: create-flash-checkout
// Creates a Stripe Checkout session for a flash booking deposit.
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

async function sendInternalPush(
  supabaseUrl: string,
  userId: string | null | undefined,
  title: string,
  body: string,
  data: Record<string, unknown>,
) {
  const internalSecret = Deno.env.get('INTERNAL_FUNCTION_SECRET');
  if (!internalSecret || !userId) return;

  const response = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-INKR-INTERNAL-SECRET': internalSecret,
    },
    body: JSON.stringify({ userId, title, body, data, category: 'deposit' }),
  });

  if (!response.ok && response.status !== 404) {
    console.error('create-flash-checkout push failed', { userId, status: response.status });
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const stripe = getStripe();
    if (!stripe) return json({ error: 'Stripe is not configured', missing: 'STRIPE_SECRET_KEY' }, 500);

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
    const flashDesignId = body.flashDesignId;
    const successUrl = body.successUrl;
    const cancelUrl = body.cancelUrl;
    const currency = typeof body.currency === 'string' ? body.currency.toLowerCase() : 'eur';

    if (typeof flashDesignId !== 'string') {
      return json({ error: 'flashDesignId is required' }, 400);
    }
    if (typeof successUrl !== 'string' || typeof cancelUrl !== 'string') {
      return json({ error: 'successUrl and cancelUrl are required' }, 400);
    }

    const { data: design, error: designError } = await supabase
      .from('flash_designs')
      .select('id, artist_id, title, price, deposit_percent, total_copies, sold_copies, is_published, artists!inner(profile_id, blaze)')
      .eq('id', flashDesignId)
      .single();

    if (designError || !design) return json({ error: 'Flash design not found' }, 404);
    if (!design.is_published) return json({ error: 'Flash design is not published' }, 400);
    if (design.sold_copies >= design.total_copies) return json({ error: 'Flash design is sold out' }, 409);

    const { data: profile } = await supabase
      .from('profiles')
      .select('email, display_name')
      .eq('id', user.id)
      .maybeSingle();

    const { data: existing, error: existingError } = await supabase
      .from('flash_bookings')
      .select('id, status, checkout_url, expires_at')
      .eq('flash_design_id', flashDesignId)
      .eq('client_id', user.id)
      .in('status', ['pending_deposit', 'confirmed'])
      .maybeSingle();

    if (existingError) return json({ error: 'Unable to inspect existing flash booking' }, 500);
    if (existing?.status === 'confirmed') return json({ error: 'Flash already booked by this client' }, 409);
    if (
      existing?.status === 'pending_deposit'
      && existing.checkout_url
      && existing.expires_at
      && new Date(existing.expires_at).getTime() > Date.now()
    ) {
      return json({ bookingId: existing.id, checkoutUrl: existing.checkout_url, reused: true });
    }
    if (existing?.id) {
      await supabase.from('flash_bookings').update({ status: 'expired' }).eq('id', existing.id);
    }

    const artists = Array.isArray(design.artists) ? design.artists[0] : design.artists;
    const artistBlaze = artists?.blaze ?? 'INKR';
    const depositAmountCents = Math.max(
      100,
      Math.round(design.price * 100 * ((design.deposit_percent ?? 30) / 100)),
    );

    const { data: booking, error: bookingError } = await supabase
      .from('flash_bookings')
      .insert({
        flash_design_id: flashDesignId,
        artist_id: design.artist_id,
        client_id: user.id,
        status: 'pending_deposit',
        deposit_amount_cents: depositAmountCents,
        currency,
      })
      .select('id')
      .single();

    if (bookingError || !booking) {
      return json({ error: 'Unable to create flash booking' }, 500);
    }

    try {
      const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60 * 24;
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'payment',
        line_items: [
          {
            price_data: {
              currency,
              product_data: {
                name: `Acompte flash - ${design.title}`,
                description: `Reservation flash avec ${artistBlaze}`,
              },
              unit_amount: depositAmountCents,
            },
            quantity: 1,
          },
        ],
        customer_email: profile?.email ?? undefined,
        success_url: successUrl,
        cancel_url: cancelUrl,
        expires_at: expiresAt,
        metadata: {
          flash_booking_id: booking.id,
          flash_design_id: flashDesignId,
          artist_id: design.artist_id,
          client_id: user.id,
        },
      });

      const expiresIso = new Date(expiresAt * 1000).toISOString();
      const { error: updateError } = await supabase
        .from('flash_bookings')
        .update({
          stripe_session_id: session.id,
          checkout_url: session.url,
          expires_at: expiresIso,
        })
        .eq('id', booking.id);

      if (updateError) throw updateError;

      const { error: notificationError } = await supabase.from('notifications').insert({
        user_id: user.id,
        type: 'flash_deposit_requested',
        title: 'Acompte flash',
        body: `Paiement de l'acompte requis pour reserver "${design.title}".`,
        data: { flash_booking_id: booking.id, flash_design_id: flashDesignId, checkout_url: session.url },
      });
      if (notificationError) {
        console.error('create-flash-checkout notification failed', {
          userId: user.id,
          message: notificationError.message,
        });
      }

      await sendInternalPush(
        supabaseUrl,
        user.id,
        'Acompte flash',
        `Finalise le paiement pour reserver "${design.title}".`,
        { flash_booking_id: booking.id, flash_design_id: flashDesignId },
      );

      return json({
        bookingId: booking.id,
        checkoutUrl: session.url,
        expiresAt: expiresIso,
        depositAmountCents,
      });
    } catch (error) {
      await supabase.from('flash_bookings').update({ status: 'cancelled' }).eq('id', booking.id);
      console.error('create-flash-checkout stripe failed', {
        bookingId: booking.id,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      return json({ error: 'Unable to create Stripe Checkout session' }, 500);
    }
  } catch (error) {
    console.error('create-flash-checkout error', {
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    return json({ error: 'Unable to create flash checkout' }, 500);
  }
});
