// Supabase Edge Function: stripe-webhook
// Set env: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SUPABASE_SERVICE_ROLE_KEY
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.0.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { escapeHtml, sendTransactionalEmail } from '../_shared/email.ts';

const STRIPE_API_VERSION = '2023-10-16';

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
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
  category: 'deposit' | 'appointment' | 'system',
) {
  const internalSecret = Deno.env.get('INTERNAL_FUNCTION_SECRET');
  if (!internalSecret || !userId) return;

  const response = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-INKR-INTERNAL-SECRET': internalSecret,
    },
    body: JSON.stringify({ userId, title, body, data, category }),
  });

  if (!response.ok && response.status !== 404) {
    console.error('stripe-webhook push failed', { userId, status: response.status });
  }
}

serve(async (req) => {
  const stripe = getStripe();
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!stripe || !webhookSecret) {
    return json({ error: 'Stripe webhook is not configured' }, 500);
  }
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: 'Supabase service role is not configured' }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const body = await req.text();
  const sig = req.headers.get('stripe-signature') ?? '';

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret);
  } catch {
    return json({ error: 'invalid_signature' }, 400);
  }

  const getArtistByCustomer = async (customerId: string) => {
    const { data, error } = await supabase
      .from('artists')
      .select('id, profile_id')
      .eq('stripe_customer_id', customerId)
      .maybeSingle();
    if (error) {
      console.error('stripe-webhook artist lookup failed', { customerId, message: error.message });
    }
    return data;
  };

  const applySubscription = async (sub: Stripe.Subscription, deleted: boolean) => {
    const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
    const artist = await getArtistByCustomer(customerId);
    if (!artist) return;
    const { error } = await supabase.rpc('apply_stripe_subscription_event', {
      p_event_id: event.id,
      p_event_created_at: new Date(event.created * 1000).toISOString(),
      p_artist_id: artist.id,
      p_subscription_id: sub.id,
      p_status: sub.status,
      p_price_id: sub.items.data[0]?.price.id ?? null,
      p_period_start: new Date(sub.current_period_start * 1000).toISOString(),
      p_period_end: new Date(sub.current_period_end * 1000).toISOString(),
      p_cancel_at_period_end: sub.cancel_at_period_end,
      p_deleted: deleted,
    });
    if (error) throw error;
  };

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        await applySubscription(sub, false);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        await applySubscription(sub, true);
        break;
      }

      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== 'payment') break;

        const flashBookingId = session.metadata?.flash_booking_id;
        if (flashBookingId) {
          const { data: booking, error: bookingError } = await supabase
            .from('flash_bookings')
            .update({
              status: 'confirmed',
              stripe_payment_intent_id: typeof session.payment_intent === 'string' ? session.payment_intent : null,
              paid_at: new Date().toISOString(),
            })
            .eq('id', flashBookingId)
            .select('id, flash_design_id, artist_id, client_id, deposit_amount_cents, currency')
            .single();
          if (bookingError) throw bookingError;

          const { data: design } = await supabase
            .from('flash_designs')
            .select('title, artists!inner(profile_id, blaze)')
            .eq('id', booking.flash_design_id)
            .maybeSingle();

          const artist = Array.isArray(design?.artists)
            ? design?.artists[0]
            : design?.artists;
          const title = design?.title ?? 'Flash';
          const amountFormatted = `${(booking.deposit_amount_cents / 100).toFixed(2).replace('.', ',')} ${booking.currency.toUpperCase()}`;

          if (booking.client_id) {
            const body = `Ton acompte de ${amountFormatted} est confirme pour "${title}".`;
            const { error: clientNotifError } = await supabase.from('notifications').insert({
              user_id: booking.client_id,
              type: 'flash_booking_confirmed',
              title: 'Flash reserve',
              body,
              data: { flash_booking_id: booking.id, flash_design_id: booking.flash_design_id },
            });
            if (clientNotifError) console.error('stripe-webhook flash client notification failed', { userId: booking.client_id, message: clientNotifError.message });

            await sendInternalPush(
              supabaseUrl,
              booking.client_id,
              'Flash reserve',
              body,
              { flash_booking_id: booking.id, flash_design_id: booking.flash_design_id },
              'deposit',
            );
          }

          if (artist?.profile_id) {
            const body = `"${title}" vient d'etre reserve avec un acompte de ${amountFormatted}.`;
            const { error: artistNotifError } = await supabase.from('notifications').insert({
              user_id: artist.profile_id,
              type: 'flash_booking_received',
              title: 'Nouveau flash reserve',
              body,
              data: { flash_booking_id: booking.id, flash_design_id: booking.flash_design_id },
            });
            if (artistNotifError) console.error('stripe-webhook flash artist notification failed', { userId: artist.profile_id, message: artistNotifError.message });

            await sendInternalPush(
              supabaseUrl,
              artist.profile_id,
              'Nouveau flash reserve',
              body,
              { flash_booking_id: booking.id, flash_design_id: booking.flash_design_id },
              'deposit',
            );
          }

          break;
        }

        const appointmentId = session.metadata?.appointment_id;
        const clientId = session.metadata?.client_id;
        const artistId = session.metadata?.artist_id;
        if (!appointmentId) break;

        const { data: deposit, error: depositError } = await supabase
          .from('deposits')
          .update({
            status: 'paid',
            stripe_payment_intent_id: typeof session.payment_intent === 'string' ? session.payment_intent : null,
            paid_at: new Date().toISOString(),
          })
          .eq('stripe_session_id', session.id)
          .select('id, amount_cents, currency')
          .single();
        if (depositError) throw depositError;

        const { error: appointmentError } = await supabase
          .from('appointments')
          .update({ status: 'confirmed' })
          .eq('id', appointmentId)
          .eq('status', 'proposed');
        if (appointmentError) throw appointmentError;

        const amountFormatted = deposit
          ? `${(deposit.amount_cents / 100).toFixed(2).replace('.', ',')} ${deposit.currency.toUpperCase()}`
          : '';

        if (clientId) {
          const { error: clientNotifError } = await supabase.from('notifications').insert({
            user_id: clientId,
            type: 'deposit_paid',
            title: 'Acompte confirme',
            body: 'Ton acompte a bien ete recu. Ton rendez-vous est confirme.',
            data: { appointment_id: appointmentId, deposit_id: deposit?.id },
          });
          if (clientNotifError) console.error('stripe-webhook client notification failed', { userId: clientId, message: clientNotifError.message });

          await sendInternalPush(
            supabaseUrl,
            clientId,
            'Acompte confirme',
            'Ton acompte a bien ete recu. Ton rendez-vous est confirme.',
            { appointment_id: appointmentId, deposit_id: deposit?.id },
            'deposit',
          );

          const { data: clientProfile } = await supabase
            .from('profiles')
            .select('email, display_name')
            .eq('id', clientId)
            .maybeSingle();
          const emailResult = await sendTransactionalEmail({
            to: clientProfile?.email,
            subject: 'Paiement confirme sur INKR',
            html: `<p>Bonjour${clientProfile?.display_name ? ` ${escapeHtml(clientProfile.display_name)}` : ''},</p><p>Votre acompte${amountFormatted ? ` de <strong>${escapeHtml(amountFormatted)}</strong>` : ''} a bien ete recu. Le rendez-vous est confirme.</p>`,
            text: `Votre acompte${amountFormatted ? ` de ${amountFormatted}` : ''} a bien ete recu. Le rendez-vous est confirme.`,
          });
          if (emailResult.error) console.error('stripe-webhook client email failed', { message: emailResult.error });
        }

        if (artistId) {
          const { data: artistProfile, error: artistLookupError } = await supabase
            .from('artists')
            .select('profile_id, blaze, profiles!profile_id(email, display_name)')
            .eq('id', artistId)
            .single();
          if (artistLookupError) throw artistLookupError;

          if (artistProfile?.profile_id) {
            const notifBody = `L'acompte${amountFormatted ? ` de ${amountFormatted}` : ''} a bien ete paye. Le rendez-vous est confirme.`;
            const { error: artistNotifError } = await supabase.from('notifications').insert({
              user_id: artistProfile.profile_id,
              type: 'deposit_received',
              title: 'Acompte recu',
              body: notifBody,
              data: { appointment_id: appointmentId, deposit_id: deposit?.id },
            });
            if (artistNotifError) console.error('stripe-webhook artist notification failed', { userId: artistProfile.profile_id, message: artistNotifError.message });

            await sendInternalPush(
              supabaseUrl,
              artistProfile.profile_id,
              'Acompte recu',
              notifBody,
              { appointment_id: appointmentId, deposit_id: deposit?.id },
              'deposit',
            );

            const profile = Array.isArray(artistProfile.profiles)
              ? artistProfile.profiles[0]
              : artistProfile.profiles;
            const emailResult = await sendTransactionalEmail({
              to: profile?.email,
              subject: 'Acompte recu sur INKR',
              html: `<p>Bonjour${profile?.display_name ? ` ${escapeHtml(profile.display_name)}` : ''},</p><p>${escapeHtml(notifBody)}</p>`,
              text: notifBody,
            });
            if (emailResult.error) console.error('stripe-webhook artist email failed', { message: emailResult.error });
          }
        }
        break;
      }

      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== 'payment') break;

        if (session.metadata?.flash_booking_id) {
          const { error } = await supabase
            .from('flash_bookings')
            .update({ status: 'expired' })
            .eq('id', session.metadata.flash_booking_id)
            .eq('status', 'pending_deposit');
          if (error) throw error;
          break;
        }

        const { error } = await supabase
          .from('deposits')
          .update({ status: 'cancelled' })
          .eq('stripe_session_id', session.id)
          .eq('status', 'pending_payment');
        if (error) throw error;
        break;
      }
    }

    return json({ received: true });
  } catch (error) {
    console.error('stripe-webhook handler failed', {
      eventType: event.type,
      eventId: event.id,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    return json({ error: 'Webhook handling failed' }, 500);
  }
});
