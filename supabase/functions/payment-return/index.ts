// Stripe requires HTTPS return URLs. This public bridge opens only the two
// subscription results in the native app; it has no credentials or data access.
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { paymentReturnDeepLink } from '../_shared/payment-return.ts';

serve((req) => {
  if (req.method !== 'GET') return new Response('Method not allowed', { status: 405 });
  const target = new URL(req.url).searchParams.get('target');
  const link = paymentReturnDeepLink(target);
  const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="0;url=${link}"><title>Retour vers INKR</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#11110f;color:#f0ece4;font:16px system-ui,sans-serif}main{text-align:center;padding:32px}strong{font-size:32px;letter-spacing:-.05em}a{display:inline-block;margin-top:24px;padding:14px 22px;border:1px solid #f0ece4;color:#f0ece4;text-decoration:none}p{color:#aaa69f}</style>
</head><body><main><strong>inkr.</strong><p>Retour vers l’application…</p><a href="${link}">Ouvrir INKR</a></main></body></html>`;
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'",
    },
  });
});
