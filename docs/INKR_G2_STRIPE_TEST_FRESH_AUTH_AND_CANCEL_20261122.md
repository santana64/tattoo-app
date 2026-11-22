# INKR PR #3 — G2 : paiement Stripe TEST, Premium après nouvelle authentification et annulation (22/11/2026)

## Verdict

**PASS ciblé** : le paiement fictif dans le véritable Checkout Stripe TEST a activé Premium dans INKR ; l'abonnement est resté Premium après **nouvelle authentification GoTrue réelle** et réouverture de la page sur un autre contexte de navigateur ; l'abonnement TEST a ensuite été **annulé** et l'offre gratuite a réapparu dans la session authentifiée, puis après rechargement.

**G2 global demeure HOLD** : cette campagne ne valide pas les parcours métier natifs authentifiés Android/iOS, les trois utilisateurs simultanés et les notifications d'acompte.

## Environnement et contraintes respectées

- Source interface Web : commit Git **`4783575979820944cb4ccbe15fadd5cc0830e1b8`**, déploiement preview Vercel `tattoo-pirq8ggyg-santana64s-projects.vercel.app`, sans affectation à la production. Accès QA protégé par un lien Vercel temporaire limité à 30 minutes.
- Backend : **Supabase staging `lsewxsdulunuuzmszegm` uniquement**, Edge Function `create-checkout-session` version **9** avec `verify_jwt=true`.
- Paiements : **Stripe sandbox séparé `acct_1Ubxk0BIelrUrSJe`**, `livemode=false` vérifié directement dans Stripe, **19,00 € fictifs**. Aucune opération sur le compte Stripe LIVE.
- Production Supabase `jxmefklkixzzdceeorcg` : **aucune écriture**, aucune migration et aucun déploiement.

## 1. Défaut CORS identifié et corrigé

La fonction staging v8 autorisait le format historique des previews `tattoo-app-4gmu-[a-z0-9]+-santana64s-projects.vercel.app`. La nouvelle URL de déploiement Vercel utilisait `tattoo-[a-z0-9]{9}-santana64s-projects.vercel.app`. Le clic Premium entraînait donc un échec CORS de la requête navigateur `create-checkout-session`, avant d'ouvrir Stripe.

- Correctif source `supabase/functions/_shared/http.ts`, commit **`a9030df93844ee78ce43d9a533764076eb1bc5ac`** : ajout d'une expression régulière **circonscrite au staging INKR** et aux URLs du projet/équipe attendus, sans wildcard `*.vercel.app`, et avec condition de désactivation sur toute autre URL Supabase (dont la production).
- Tests de non-régression dans `tests/checkout-cors-origin.test.cjs`, commit **`1ea1788ad7ecfdcf1f100806aeaca71fd3356e82`** : **3/3 PASS** (préviews staging acceptées, usurpations refusées, production refuse ces exceptions) ; `npm test`, `npm run typecheck`, `npm run lint` : exits 0 sur `pucci` après le correctif.
- Déploiement ciblé staging `create-checkout-session` **version 8 → 9** : seuls les octets du fichier partagé `_shared/http.ts` différaient de la fonction précédemment déployée ; `verify_jwt=true` conservé ; aucun autre service modifié.
- Tests réels préflight `OPTIONS` HTTP : **5/5 PASS**, anciens et nouveaux domaines reconnus ; domaine extérieur, suffixe trompeur et port inattendu refusés. Script privé `%LOCALAPPDATA%\\INKR-QA\\scripts\\Check-INKR-NewPreview-CORS-20261122.cjs`.

## 2. Paiement TEST depuis l'interface réelle

- Client Web réellement authentifié via e-mail magique et callback Supabase GoTrue PKCE ; ouverture de l'écran tarif et clic utilisateur automatisé sur le bouton `Passer à Premium · 19 € par mois`.
- Réponse réseau `create-checkout-session` **HTTP 200**, Checkout hébergé sur `checkout.stripe.com`. Contrôle **indépendant** du Checkout dans l'API Stripe sandbox : `livemode=false`, `mode=subscription`, `status=open`, `amount_total=1900`, monnaie EUR, et URLs de retour `success`/`cancel` renvoyant vers **l'origine HTTPS exacte de la preview QA**.
- Carte fictive standard de TEST soumise sur le formulaire hébergé Stripe ; paiement sandbox `complete/paid` confirmé à nouveau par l'API Stripe.
- Redirection navigateur automatique `/settings/subscription?checkout=success` : **PASS** ; Premium après traitement du webhook et après rechargement : **PASS**.
- Rapport privé avant paiement `g2-postcors-web-checkout-20261122.json` : `PASS_STRIPE_TEST_CHECKOUT_CREATED_AFTER_CORS`. La campagne originale dans `g2-full-cycle-fresh-login-20261122.json` porte **`HOLD` uniquement pour une assertion de texte erronée** (voir section 3), et ne doit pas être changée ou dissimulée.

## 3. Premium après une **nouvelle** authentification GoTrue

Une fois le paiement déjà complété, un second e-mail magique a été demandé, son lien GoTrue staging consommé en `HTTP 303` avec code PKCE, puis une **nouvelle session Supabase** a été établie dans un contexte Web neuf. Une troisième authentification GoTrue de contre-vérification a également réussi.

L'assertion initiale `Votre abonnement Premium est actif` était fausse comme critère de validation sur l'URL normale `/settings/subscription` : le texte n'est affiché que pour `?checkout=success`. La page Premium normale montre `VOTRE ABONNEMENT`, `Premium.`, et `Actif · renouvellement le 22 décembre 2026`.

**Preuve indépendante avant annulation** : le fichier privé `g2-fresh-gotrue-session-20261122.private.json` provenait bien de la nouvelle authentification GoTrue (cookie et localStorage du nouveau compte QA, sans copie de l'ancienne session). Un navigateur Playwright indépendant a été ouvert avec ce nouvel état :

- Jeton de session GoTrue présent, aucun renvoi vers `/sign-in`.
- Les requêtes `profiles` et `artists` de Supabase staging ont répondu **HTTP 200**.
- Libellés visibles : `VOTRE ABONNEMENT`, `Premium.`, `Actif · renouvellement le 22 décembre 2026`, et `GÉRER L’ABONNEMENT`.
- Bouton `Passer à Premium · 19 € par mois` **absent**, aucune erreur JS.
- Rapport privé `g2-fresh-gotrue-tier-labels-20261122.json` à **2026-11-22 08:08:58 UTC**, donc **avant annulation** de l'abonnement TEST.

Cela valide **Premium en UI après nouvelle authentification GoTrue, avant annulation**, même si le script monolithique de la campagne a échoué sur une assertion de texte non adaptée au routeur.

**Limite de redirection du lien magique :** les liens e-mail émis par Supabase staging contenaient un `redirect_to` historique vers un ancien domaine de preview. La campagne a exploité le **vrai lien GoTrue / vrai échange PKCE**, puis dirigé explicitement le code PKCE vers le domaine de la preview courante. La redirection automatique d'un lien e-mail vers la preview la plus récente **n'est pas prouvée** et doit être traitée séparément si le parcours utilisateur l'exige.

## 4. Annulation et retour à l'offre gratuite

- Stripe API dans le compte TEST exclusivement : `DELETE /v1/subscriptions/{id}` sur l'abonnement créé par cette campagne ; résultat `status=canceled`, `livemode=false`. Une relecture de l'abonnement par `GET` confirme `canceled`.
- Supabase staging, contrôle SQL en lecture seule après webhook : `artists.tier=normal`, `stripe_subscription_status=canceled`.
- Nouvelle vérification navigateur avec **l'état issu de la nouvelle authentification GoTrue** : `Passer à Premium · 19 € par mois` visible avant et après un rechargement, session signée toujours présente, aucun renvoi vers la connexion, aucune erreur JavaScript. Rapport privé `g2-test-canceled-free-fresh-gotrue-20261122.json` : **`PASS_STRIPE_TEST_CANCEL_FREE_VISIBLE_AFTER_FRESH_GOTRUE`**, **5/5 assertions PASS**.
- Pas de résidu d'abonnement TEST actif pour cet utilisateur après cette campagne, sous réserve d'une vérification de clôture du compte Stripe.

## Décision de release

- **Sous-contrôle G2 Stripe TEST complet (paiement, callback Web, webhook, Premium après nouveau login, annulation, retour gratuit) = PASS ciblé.**
- **G2 global = HOLD** (mobile natif authentifié, cohérence des trois rôles simultanés, notifications et dépôt d'acompte).
- **G0/G1/G3/G4/G5 restent HOLD**, PR #3 reste DRAFT ; aucun changement de production.

Les sources de preuve locales sensibles (magic links, JWT, URL Checkout, lien Vercel QA) ne sont pas incluses dans Git. Les rapports JSON ne contiennent pas les identifiants secrets complets.
