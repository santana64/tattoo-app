# INKR V5.1 — Diagnostic du retour Stripe Web (21/11/2026)

## Périmètre
PR #3, code et Supabase `lsewxsdulunuuzmszegm` **staging uniquement**. Aucune modification sur production `jxmefklkixzzdceeorcg`, aucune fusion, aucun paiement LIVE.

## Cause confirmée
Le dernier Checkout de recette avait été créé avec un JWT signé, mais par appel API direct **sans** `successUrl`/`cancelUrl` Web. La fonction a donc utilisé son bridge HTTPS vers `inkr://`, comportement conçu pour les clients natifs. Ce test ne prouve pas que le clic sur le bouton Web fonctionne.

Depuis `pucci`, le précontrôle CORS `OPTIONS` du staging a renvoyé HTTP 200 **sans** `Access-Control-Allow-Origin` pour:
- `https://tattoo-app-4gmu-po0g25qat-santana64s-projects.vercel.app` (preview QA existante),
- `https://tattoo-app-git-codex-inkr-v5-1-optio-7c07d9-santana64s-projects.vercel.app` (autre preview),
- `http://127.0.0.1:4173` (serveur Web local).

Le premier de ces domaines correspond à la preview Vercel du projet `tattoo-app-4gmu`. **Seule cette famille de preview** est couverte par le correctif de staging. Les autres origines ne sont pas autorisées implicitement et peuvent être ajoutées individuellement après vérification de leur propriété si nécessaires.

## Correctif préparé
- `supabase/functions/_shared/checkout-return-urls.ts` : Web = deux URL HTTPS, autorisées, avec path/query stricts; toute URL Web invalide ou partielle doit déclencher `invalid_return_urls` (HTTP 400), pas le bridge natif.
- `supabase/functions/create-checkout-session/index.ts` : applique cet algorithme; les clients natifs sans URL explicites conservent le bridge existant.
- `supabase/functions/_shared/http.ts` : origines Vercel du **seul** projet/team QA `tattoo-app-4gmu-<id>-santana64s-projects.vercel.app`, activées **seulement lorsque SUPABASE_URL est l'adresse du staging**. Aucun wildcard générique `*.vercel.app`; le comportement de production reste celui de `ALLOWED_ORIGINS`.
- Tests `tests/checkout-return-urls.test.cjs` et `tests/checkout-cors-origin.test.cjs` : scénarios d'autorisation, refus d'origines usurpées, interdiction des retours incomplets et isolation du mode production.

## Preuves nécessaires après déploiement sur staging
1. Rejouer OPTIONS depuis la véritable preview projet/team; HTTP 200 avec `Access-Control-Allow-Origin` identique à la preview.
2. Contrôler le refus depuis un domaine étranger et le maintien de `verify_jwt=true`.
3. Avec un artiste QA **onboardé temporairement seulement**, cliquer dans l'UI Web sur « Passer à Premium », vérifier que la session Stripe TEST a les deux URL HTTPS Web exactes.
4. Faire un paiement fictif Stripe Checkout, vérifier redirection automatique vers `/settings/subscription?checkout=success`, webhook, Premium affiché après reconnexion et refresh; annuler l'abonnement de test et remettre le compte QA à l'état initial. Ne pas réutiliser l'ancienne session dont le retour ciblait le bridge natif.

Le paiement Stripe TEST antérieur, le webhook, Premium UI **après navigation manuelle**, et la révocation Stripe/Supabase ont déjà été validés, mais **ils ne remplacent pas l'étape 4**. Ne pas déclarer le retour automatique Web PASS avant son exécution.

## Décision de release
PR #3 **DRAFT** et `docs/RELEASE_EVIDENCE.json` **G0–G5 HOLD**. Ce document est une recette ciblée, pas une autorisation de mise en production.