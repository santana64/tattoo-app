// Supabase Edge Function: delete-account
// Permanently deletes the signed-in user's account (GDPR art. 17, store rules).
//
// Order matters:
//   1. cancel the Stripe subscription — if that fails we stop, so nobody
//      keeps being billed for an account that no longer exists;
//   2. delete the auth user — the database cascades to the profile, artist
//      page, posts, requests, messages, appointments and reviews;
//   3. remove the uploaded files (best effort; failures are logged).
//
// Deploy: supabase functions deploy delete-account
// Secrets: STRIPE_SECRET_KEY (optional), ALLOWED_ORIGINS
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { bearerToken, corsHeaders, json } from '../_shared/http.ts';

const STRIPE_API = 'https://api.stripe.com/v1';
const LIST_PAGE = 100;
const REMOVE_BATCH = 100;

/** Cancels the subscription now. Returns false when Stripe could not confirm it. */
async function cancelSubscription(subscriptionId: string): Promise<boolean> {
  const secret = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
  if (!secret) {
    console.error('delete-account: subscription present but STRIPE_SECRET_KEY is not set');
    return false;
  }
  const response = await fetch(`${STRIPE_API}/subscriptions/${encodeURIComponent(subscriptionId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${secret}` },
  });
  if (response.ok) return true;
  // Already gone on Stripe's side: nothing left to bill.
  if (response.status === 404) return true;
  console.error('delete-account: Stripe cancel failed with status', response.status);
  return false;
}

/** Every file path under `prefix`, walking sub-folders. */
async function listFiles(admin: SupabaseClient, bucket: string, prefix: string): Promise<string[]> {
  const files: string[] = [];
  const pending = [prefix];
  while (pending.length) {
    const folder = pending.pop()!;
    for (let offset = 0; ; offset += LIST_PAGE) {
      const { data, error } = await admin.storage.from(bucket).list(folder, { limit: LIST_PAGE, offset });
      if (error) throw error;
      for (const entry of data ?? []) {
        const path = `${folder}/${entry.name}`;
        // Folders are listed without an id.
        if (entry.id === null) pending.push(path);
        else files.push(path);
      }
      if (!data || data.length < LIST_PAGE) break;
    }
  }
  return files;
}

async function removeFolder(admin: SupabaseClient, bucket: string, prefix: string): Promise<void> {
  try {
    const files = await listFiles(admin, bucket, prefix);
    for (let i = 0; i < files.length; i += REMOVE_BATCH) {
      const { error } = await admin.storage.from(bucket).remove(files.slice(i, i + REMOVE_BATCH));
      if (error) throw error;
    }
  } catch (err) {
    console.error(`delete-account: could not clean ${bucket}/${prefix}`, err);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, { error: 'method_not_allowed' }, 405);

  try {
    const jwt = bearerToken(req);
    if (!jwt) return json(req, { error: 'unauthorized' }, 401);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data: { user }, error: authError } = await admin.auth.getUser(jwt);
    if (authError || !user) return json(req, { error: 'unauthorized' }, 401);

    // What has to be cleaned outside the database, read before the rows vanish.
    const { data: artist, error: artistError } = await admin
      .from('artists')
      .select('id, stripe_subscription_id, stripe_subscription_status')
      .eq('profile_id', user.id)
      .maybeSingle();
    if (artistError) throw new Error(`artist lookup failed: ${artistError.message}`);

    const { data: requests, error: requestsError } = await admin
      .from('tattoo_requests')
      .select('id')
      .eq('client_id', user.id);
    if (requestsError) throw new Error(`request lookup failed: ${requestsError.message}`);

    if (artist?.stripe_subscription_id && artist.stripe_subscription_status !== 'canceled') {
      const canceled = await cancelSubscription(artist.stripe_subscription_id);
      if (!canceled) return json(req, { error: 'subscription_cancel_failed' }, 502);
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) throw new Error(`user deletion failed: ${deleteError.message}`);

    const cleanups: Promise<void>[] = [
      removeFolder(admin, 'avatars', user.id),
      removeFolder(admin, 'covers', user.id),
      removeFolder(admin, 'verification-docs', user.id),
    ];
    if (artist) cleanups.push(removeFolder(admin, 'posts-media', artist.id));
    for (const request of requests ?? []) {
      cleanups.push(removeFolder(admin, 'request-references', request.id));
    }
    await Promise.all(cleanups);

    return json(req, { deleted: true });
  } catch (err) {
    console.error('delete-account error', err);
    return json(req, { error: 'deletion_failed' }, 500);
  }
});
