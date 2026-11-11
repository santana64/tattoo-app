// Supabase Edge Function: payment-return
// Pont HTTPS → deep link. Stripe exige des success/cancel URLs en https,
// cette page redirige immédiatement vers l'app via le scheme inkr://.
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const APP_SCHEME = 'inkr';

serve((req) => {
  const url = new URL(req.url);
  const rawTarget = url.searchParams.get('target') ?? '';

  // Anti open-redirect : uniquement un chemin relatif simple (pas de scheme,
  // pas de double slash, caractères sûrs seulement)
  const isSafe =
    /^[a-zA-Z0-9/_\-?&=.%~]*$/.test(rawTarget) &&
    !rawTarget.includes('//') &&
    !rawTarget.includes(':');

  const deepLink = `${APP_SCHEME}://${isSafe ? rawTarget : ''}`;

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="refresh" content="0;url=${deepLink}">
  <title>INKR — Retour vers l'app</title>
  <style>
    body { background:#03030A; color:#EDEDF2; font-family:-apple-system,system-ui,sans-serif;
           display:flex; align-items:center; justify-content:center; height:100vh; margin:0; }
    .card { text-align:center; padding:32px; }
    .logo { font-size:28px; font-weight:800; letter-spacing:6px; color:#E8B84B; margin-bottom:16px; }
    a { display:inline-block; margin-top:20px; padding:14px 28px; border-radius:14px;
        background:linear-gradient(90deg,#F2CC6E,#C49A3C,#9A6E1C); color:#03030A;
        text-decoration:none; font-weight:700; }
    p { color:#8B8B93; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">INKR</div>
    <p>Retour vers l'application…</p>
    <a href="${deepLink}">Ouvrir INKR</a>
  </div>
  <script>window.location.href = ${JSON.stringify(deepLink)};</script>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
});
