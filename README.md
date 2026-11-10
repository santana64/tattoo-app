# Inkr

Inkr met en relation des clients et des artistes tatoueurs : portfolios par style et par ville, demande de projet, messagerie, prise de rendez-vous et avis.

Une seule base de code [Expo](https://expo.dev) (React Native + `react-native-web`) pour iOS, Android et le web, avec [Supabase](https://supabase.com) pour l'authentification, la base de données, le stockage et les fonctions edge, et Stripe pour l'abonnement Premium des artistes.

## Démarrer

Prérequis : Node 20+, un projet Supabase.

```bash
npm install
cp .env.example .env   # puis renseigner l'URL et la clé anon Supabase
npm run web            # ou : npm run ios / npm run android
```

## Commandes

| Commande | Rôle |
|---|---|
| `npm run web` | Serveur de développement web |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, sans émission |
| `npm test` | Tests unitaires + tests SQL des règles de sécurité |
| `npm run build:web` | Export statique dans `dist/`, liens profonds, sitemap, contrôle de la CSP |
| `npm run preview:web` | Sert `dist/` en appliquant `vercel.json` (réécritures, en-têtes) |

## Structure

| Dossier | Contenu |
|---|---|
| `app/` | Écrans (routage par fichiers, `expo-router`) |
| `components/` | Composants d'interface, dont `ui/` (kit de base) et `motion/` |
| `store/` | États Zustand : auth, fil, demandes, messages, notifications |
| `lib/` | Client Supabase, stockage, rendez-vous, métadonnées du site |
| `constants/` | Thème, types métier et catalogue des styles |
| `supabase/migrations/` | Schéma et règles de sécurité, à appliquer dans l'ordre |
| `supabase/functions/` | Fonctions edge : paiement, webhook Stripe, push, suppression de compte |
| `tests/` | Tests `node:test` ; `rls-security.test.cjs` exécute les migrations dans un Postgres embarqué |
| `scripts/` | Post-traitement de l'export web, prévisualisation, génération des images |

`DESIGN.md` décrit le système visuel (« Galerie noire »).

## Base de données

Les migrations de `supabase/migrations/` sont idempotentes et s'appliquent dans l'ordre numérique, dans l'éditeur SQL Supabase ou avec `supabase db push`.

Deux principes à respecter pour toute nouvelle table :

- la RLS décide **quelles lignes** un appelant peut toucher, les privilèges de colonnes décident **quelles colonnes** (voir `005_p0_security.sql`) ;
- les transitions d'état sensibles passent par des fonctions `security definer` qui vérifient l'appelant (voir `003_appointment_booking.sql`), jamais par un `UPDATE` direct.

Une migration qui retire des droits doit être déployée **après** le client qui n'en dépend plus.

## Fonctions edge

```bash
supabase functions deploy create-checkout-session
supabase functions deploy delete-account
supabase functions deploy send-push
supabase functions deploy stripe-webhook --no-verify-jwt
```

Secrets attendus (`supabase secrets set NOM=valeur`) :

| Secret | Usage |
|---|---|
| `ALLOWED_ORIGINS` | Origines web autorisées (CORS et retours de paiement), séparées par des virgules |
| `STRIPE_SECRET_KEY` | Paiement, résiliation à la suppression du compte |
| `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY` | Tarifs Premium |
| `STRIPE_WEBHOOK_SECRET` | Signature du webhook |

## Déploiement web

Vercel construit avec `npm run build:web` et sert `dist/` (voir `vercel.json`). Variables d'environnement du projet Vercel :

- `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_SITE_URL` : URL publique du site, utilisée pour les URL canoniques, le sitemap et `robots.txt`

Le build échoue volontairement si le script en ligne émis par Expo ne correspond plus au hash autorisé par la Content-Security-Policy : le message indique le hash à reporter dans `vercel.json`.

## Tests

```bash
npm test
```

`tests/rls-security.test.cjs` rejoue toutes les migrations dans PGlite et vérifie, avec les rôles `anon` et `authenticated`, ce que chaque règle doit interdire et ce qui doit continuer à fonctionner. Toute modification d'une règle de sécurité doit y ajouter un cas.
