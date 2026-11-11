// Supabase Edge Function: create-deposit-checkout
// Creates a Stripe Checkout session for an appointment deposit.
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.0.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { escapeHtml, sendTransactionalEmail } from '../_shared/email.ts';

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
  userId: string | null,
  title: string,
  body: string,
  data: Record<string, unknown>,
) {
  const internalSecret = Deno.env.get('INTERNAL_FUNCTION_SECRET');
  if (!internalSecret || !userId) return { sent: false, skipped: true };

  const response = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-INKR-INTERNAL-SECRET': internalSecret,
    },
    body: JSON.stringify({ userId, title, body, data, category: 'deposit' }),
  });

  if (!response.ok && response.status !== 404) {
    console.error('create-deposit-checkout push failed', {
      userId,
      status: response.status,
    });
  }

  return { sent: response.ok };
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
    const appointmentId = body.appointmentId;
    const amountCents = body.amountCents;
    const currency = typeof body.currency === 'string' ? body.currency.toLowerCase() : 'eur';
    const successUrl = body.successUrl;
    const cancelUrl = body.cancelUrl;

    if (
      typeof appointmentId !== 'string'
      || typeof amountCents !== 'number'
      || !Number.isInteger(amountCents)
      || amountCents < 100
    ) {
      return json({ error: 'appointmentId and integer amountCents (min 100) are required' }, 400);
    }

    if (typeof successUrl !== 'string' || typeof cancelUrl !== 'string') {
      return json({ error: 'successUrl and cancelUrl are required' }, 400);
    }

    const { data: artist, error: artistError } = await supabase
      .from('artists')
      .select('id, blaze, stripe_customer_id')
      .eq('profile_id', user.id)
      .single();

    if (artistError || !artist) {
      return json({ error: 'Only artists can request deposits' }, 403);
    }

    const { data: appointment, error: appointmentError } = await supabase
      .from('appointments')
      .select('id, client_id, status')
      .eq('id', appointmentId)
      .eq('artist_id', artist.id)
      .single();

    if (appointmentError || !appointment) {
      return json({ error: 'Appointment not found or access denied' }, 404);
    }

    if (appointment.status === 'canceled' || appointment.status === 'completed') {
      return json({ error: 'Cannot request deposit for a canceled or completed appointment' }, 400);
    }

    const { data: existing, error: existingError } = await supabase
      .from('deposits')
      .select('id, status')
      .eq('appointment_id', appointmentId)
      .maybeSingle();

    if (existingError) return json({ error: 'Unable to inspect existing deposits' }, 500);
    if (existing?.status === 'paid') return json({ error: 'Deposit already paid for this appointment' }, 409);

    if (existing && existing.status !== 'paid') {
      const { error: cancelError } = await supabase
        .from('deposits')
        .update({ status: 'cancelled' })
        .eq('id', existing.id);
      if (cancelError) return json({ error: 'Unable to cancel previous deposit' }, 500);
    }

    const { data: clientProfile } = await supabase
      .from('profiles')
      .select('email, display_name')
      .eq('id', appointment.client_id)
      .maybeSingle();

    const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60 * 24;
    const amountFormatted = `${(amountCents / 100).toFixed(2).replace('.', ',')} EUR`;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency,
            product_data: {
              name: `Acompte - ${artist.blaze}`,
              description: 'Reservation de votre rendez-vous de tatouage',
            },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      customer_email: clientProfile?.email ?? undefined,
      success_url: successUrl,
      cancel_url: cancelUrl,
      expires_at: expiresAt,
      metadata: {
        appointment_id: appointmentId,
        artist_id: artist.id,
        client_id: appointment.client_id ?? '',
      },
    });

    const depositExpiry = new Date(expiresAt * 1000).toISOString();
    const { data: deposit, error: depositError } = await supabase
      .from('deposits')
      .insert({
        appointment_id: appointmentId,
        amount_cents: amountCents,
        currency,
        status: 'pending_payment',
        stripe_session_id: session.id,
        checkout_url: session.url,
        expires_at: depositExpiry,
      })
      .select('id')
      .single();

    if (depositError || !deposit) {
      console.error('create-deposit-checkout deposit insert failed', {
        appointmentId,
        message: depositError?.message,
      });
      return json({ error: 'Unable to create deposit record' }, 500);
    }

    const notificationBody = `${artist.blaze} demande un acompte de ${amountFormatted} pour confirmer votre rendez-vous.`;
    if (appointment.client_id) {
      const { error: notificationError } = await supabase.from('notifications').insert({
        user_id: appointment.client_id,
        type: 'deposit_requested',
        title: 'Acompte demande',
        body: notificationBody,
        data: { deposit_id: deposit.id, appointment_id: appointmentId, checkout_url: session.url },
      });
      if (notificationError) {
        console.error('create-deposit-checkout notification insert failed', {
          userId: appointment.client_id,
          message: notificationError.message,
        });
      }

      await sendInternalPush(supabaseUrl, appointment.client_id, 'Acompte demande', notificationBody, {
        deposit_id: deposit.id,
        appointment_id: appointmentId,
      });
    }

    const emailResult = await sendTransactionalEmail({
      to: clientProfile?.email,
      subject: 'Acompte demande sur INKR',
      html: `<p>Bonjour${clientProfile?.display_name ? ` ${escapeHtml(clientProfile.display_name)}` : ''},</p><p>${escapeHtml(artist.blaze)} demande un acompte de <strong>${escapeHtml(amountFormatted)}</strong> pour confirmer votre rendez-vous.</p><p><a href="${escapeHtml(session.url ?? '')}">Payer l'acompte</a></p>`,
      text: `${artist.blaze} demande un acompte de ${amountFormatted}. Lien de paiement: ${session.url ?? ''}`,
    });
    if (emailResult.error) {
      console.error('create-deposit-checkout email failed', { message: emailResult.error });
    }

    return json({
      depositId: deposit.id,
      checkoutUrl: session.url,
      expiresAt: depositExpiry,
      emailSent: emailResult.sent,
      emailSkipped: emailResult.skipped ?? false,
    });
  } catch (error) {
    console.error('create-deposit-checkout error', {
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    return json({ error: 'Unable to create deposit checkout' }, 500);
  }
});
