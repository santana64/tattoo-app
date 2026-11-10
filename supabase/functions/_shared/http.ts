// Shared HTTP helpers for the INKR edge functions.
//
// ALLOWED_ORIGINS (function secret): comma-separated list of web origins that
// may call the functions from a browser and receive checkout redirects, e.g.
//   supabase secrets set ALLOWED_ORIGINS=https://inkr.app,https://tattoo-app-4gmu.vercel.app
// Native apps send no Origin header and are not affected by CORS.

const NATIVE_SCHEME = 'inkr://';

export function allowedOrigins(): string[] {
  return (Deno.env.get('ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

export function corsHeaders(req: Request): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
  const origin = req.headers.get('Origin');
  if (origin && allowedOrigins().includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

export function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  });
}

/** True when `url` points back into the app: the native scheme or an allowed web origin. */
export function isAllowedReturnUrl(url: unknown): url is string {
  if (typeof url !== 'string' || url.length > 2048) return false;
  if (url.startsWith(NATIVE_SCHEME)) return true;
  try {
    const parsed = new URL(url);
    // Plain http is only tolerated for local development.
    const local = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
    if (parsed.protocol !== 'https:' && !(local && parsed.protocol === 'http:')) return false;
    return allowedOrigins().includes(parsed.origin);
  } catch {
    return false;
  }
}

/** Constant-time string comparison, for secrets. */
export function safeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left[i] ^ right[i];
  return diff === 0;
}

export function bearerToken(req: Request): string | null {
  const header = req.headers.get('Authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match ? match[1].trim() : null;
}
