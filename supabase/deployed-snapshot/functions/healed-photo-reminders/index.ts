// Supabase Edge Function: healed-photo-reminders
// Intended for a daily Supabase scheduled job. It sends J+30 healed-photo
// reminders for completed appointments that do not yet have a healed photo.
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-inkr-internal-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function sendInternalPush(
  supabaseUrl: string,
  userId: string,
  title: string,
  body: string,
  data: Record<string, unknown>,
) {
  const internalSecret = Deno.env.get('INTERNAL_FUNCTION_SECRET');
  if (!internalSecret) return { sent: false, skipped: true };

  const response = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-INKR-INTERNAL-SECRET': internalSecret,
    },
    body: JSON.stringify({ userId, title, body, data, category: 'appointment' }),
  });

  if (!response.ok && response.status !== 404) {
    console.error('healed-photo-reminders push failed', { userId, status: response.status });
  }

  return { sent: response.ok };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const internalSecret = Deno.env.get('INTERNAL_FUNCTION_SECRET');
  const providedSecret = req.headers.get('X-INKR-INTERNAL-SECRET');
  const authHeader = req.headers.get('Authorization') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');

  const isInternal = internalSecret && providedSecret === internalSecret;
  const isServiceBearer = serviceRoleKey && authHeader === `Bearer ${serviceRoleKey}`;
  if (!isInternal && !isServiceBearer) return json({ error: 'Unauthorized' }, 401);

  if (!serviceRoleKey || !supabaseUrl) {
    return json({ error: 'Supabase service role is not configured' }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: reminders, error } = await supabase
    .from('healed_photo_reminders')
    .select('appointment_id, artist_id, client_id, due_at')
    .is('sent_at', null)
    .lte('due_at', new Date().toISOString())
    .limit(100);

  if (error) {
    console.error('healed-photo-reminders lookup failed', { message: error.message });
    return json({ error: 'Reminder lookup failed' }, 500);
  }

  let sent = 0;
  let skipped = 0;

  for (const reminder of reminders ?? []) {
    if (!reminder.client_id) {
      skipped += 1;
      continue;
    }

    const { data: existingPhoto } = await supabase
      .from('healed_photos')
      .select('id')
      .eq('appointment_id', reminder.appointment_id)
      .maybeSingle();

    if (existingPhoto) {
      await supabase
        .from('healed_photo_reminders')
        .update({ sent_at: new Date().toISOString() })
        .eq('appointment_id', reminder.appointment_id);
      skipped += 1;
      continue;
    }

    const title = 'Photo cicatrisee';
    const body = 'Ton tatouage a eu le temps de cicatriser. Ajoute une photo pour ton artiste.';
    const data = {
      appointment_id: reminder.appointment_id,
      artist_id: reminder.artist_id,
      route: `/healed/${reminder.appointment_id}`,
    };

    const { error: notificationError } = await supabase.from('notifications').insert({
      user_id: reminder.client_id,
      type: 'healed_photo_reminder',
      title,
      body,
      data,
    });

    if (notificationError) {
      console.error('healed-photo-reminders notification failed', {
        appointmentId: reminder.appointment_id,
        message: notificationError.message,
      });
      skipped += 1;
      continue;
    }

    await sendInternalPush(supabaseUrl, reminder.client_id, title, body, data);

    await supabase
      .from('healed_photo_reminders')
      .update({ sent_at: new Date().toISOString() })
      .eq('appointment_id', reminder.appointment_id);

    sent += 1;
  }

  return json({ sent, skipped });
});
