// Uses Expo Push API: https://exp.host/--/api/v2/push/send
// Validates Expo push tokens (start with ExponentPushToken[...)
// Sends to one or multiple tokens
// Handles chunking (max 100 per request)
// Returns receipt IDs

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } });

  try {
    const { tokens, title, body, data, badge } = await req.json();

    // Filter valid Expo tokens
    const validTokens = (Array.isArray(tokens) ? tokens : [tokens])
      .filter((t: string) => t && t.startsWith('ExponentPushToken['));

    if (validTokens.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
    }

    // Build messages
    const messages = validTokens.map((token: string) => ({
      to: token,
      title,
      body,
      data: data ?? {},
      badge: badge ?? 1,
      sound: 'default',
      priority: 'high',
    }));

    // Send to Expo Push API (in chunks of 100)
    const results = [];
    for (let i = 0; i < messages.length; i += 100) {
      const chunk = messages.slice(i, i + 100);
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
        },
        body: JSON.stringify(chunk),
      });
      const json = await res.json();
      results.push(...(json.data ?? []));
    }

    return new Response(JSON.stringify({ sent: validTokens.length, receipts: results }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
});
