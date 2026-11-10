// Supabase Edge Function: send-push
// Sends Expo push notifications to one user's devices.
//
// Server-to-server only: the caller must present the service role key
// (database webhooks, other edge functions). A signed-in user or the public
// anon key is refused, otherwise anyone could push arbitrary text to anyone.
//
// Deploy: supabase functions deploy send-push
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { bearerToken, safeEqual } from '../_shared/http.ts';

const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', SERVICE_ROLE_KEY);

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_TITLE = 120;
const MAX_BODY = 500;

interface PushPayload {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

function parsePayload(raw: unknown): PushPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const { userId, title, body, data } = raw as Record<string, unknown>;
  if (typeof userId !== 'string' || !UUID_PATTERN.test(userId)) return null;
  if (typeof title !== 'string' || !title.trim() || title.length > MAX_TITLE) return null;
  if (typeof body !== 'string' || !body.trim() || body.length > MAX_BODY) return null;
  if (data !== undefined && (data === null || typeof data !== 'object' || Array.isArray(data))) return null;
  return { userId, title, body, data: data as Record<string, unknown> | undefined };
}

const respond = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

serve(async (req) => {
  if (req.method !== 'POST') return respond({ error: 'method_not_allowed' }, 405);

  const token = bearerToken(req);
  if (!SERVICE_ROLE_KEY || !token || !safeEqual(token, SERVICE_ROLE_KEY)) {
    return respond({ error: 'forbidden' }, 403);
  }

  let payload: PushPayload | null = null;
  try {
    payload = parsePayload(await req.json());
  } catch {
    payload = null;
  }
  if (!payload) return respond({ error: 'invalid_payload' }, 400);

  const { data: tokens, error } = await supabase
    .from('push_tokens')
    .select('token')
    .eq('user_id', payload.userId);
  if (error) {
    console.error('send-push: token lookup failed', error.message);
    return respond({ error: 'lookup_failed' }, 500);
  }
  if (!tokens?.length) return respond({ sent: 0 });

  const messages = tokens.map((t) => ({
    to: t.token,
    sound: 'default',
    title: payload.title,
    body: payload.body,
    data: payload.data ?? {},
  }));

  const response = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(messages),
  });
  if (!response.ok) {
    console.error('send-push: Expo push API returned', response.status);
    return respond({ error: 'push_provider_failed' }, 502);
  }
  const result = await response.json();
  return respond({ sent: messages.length, result });
});
