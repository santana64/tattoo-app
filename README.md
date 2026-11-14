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
supabase functions deploy payment-return --no-verify-jwt
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

Sur le projet de test isolé, utiliser uniquement une clé `sk_test_…`, des prix Stripe de test et l'URL du webhook de test. `payment-return` est public car Stripe y redirige le navigateur ; il n'accepte que les deux destinations d'abonnement prévues. Sans clé ni prix configurés, `create-checkout-session` renvoie `checkout_unavailable` (503).

## Déploiement web

Vercel construit avec `npm run build:web` et sert `dist/` (voir `vercel.json`). Variables d'environnement du projet Vercel :

- `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_SITE_URL` : URL publique du site, utilisée pour les URL canoniques, le sitemap et `robots.txt`
- `EXPO_PUBLIC_TURNSTILE_SITE_KEY` (facultatif) : active le captcha, voir plus bas

Le build échoue volontairement si le script en ligne émis par Expo ne correspond plus au hash autorisé par la Content-Security-Policy : le message indique le hash à reporter dans `vercel.json`.

## Signalement des erreurs

Les plantages sont enregistrés dans la base du projet (table `client_errors`, migration 012), sans service tiers. `lib/error-reporting.ts` écoute les erreurs non interceptées (web : `error` et `unhandledrejection` ; natif : gestionnaire global de React Native et promesses rejetées en build de production) et `components/ErrorBoundary.tsx` affiche un écran de secours quand un écran plante.

- **Envoyé** : le message de l'erreur, sa pile d'appels, la route sans identifiants ni paramètres (`/artist/:id`, jamais `?…`), la plateforme et la version de l'app. La fonction `report_client_error` y joint l'identifiant du compte connecté (remis à vide si le compte est supprimé).
- **Jamais envoyé** : le contenu des écrans, les saisies, les paramètres d'URL, l'e-mail, la position.
- **Ignoré** : erreurs sans message, `ResizeObserver loop`, « Script error. » d'origine externe, requêtes annulées, échecs réseau hors ligne, et tout en développement. Chaque message part une fois par session (10 au plus) ; la base refuse au-delà de 60 signalements par minute.
- **Lecture** : écran Modération (`/admin`, administrateurs uniquement), onglet « Erreurs » : erreurs regroupées par message, les plus récentes d'abord, avec la pile d'appels et « Tout effacer ».

Un plantage natif fatal peut fermer l'app avant que l'envoi parte ; les plantages du code natif (hors JavaScript) ne sont pas captés.

## Captcha à l'inscription et à la connexion (facultatif)

Sans clé, rien ne change. Avec une clé, le web affiche Cloudflare Turnstile au-dessus du bouton d'envoi (connexion, inscription, lien par e-mail) et transmet le jeton à Supabase.

1. Cloudflare → Turnstile → ajouter un site avec le ou les domaines du site (Vercel et domaine personnalisé).
2. Vercel → variables d'environnement : `EXPO_PUBLIC_TURNSTILE_SITE_KEY` = la clé **de site** (publique), puis redéployer (la valeur est intégrée au build).
3. `vercel.json` : ajouter `https://challenges.cloudflare.com` aux directives `script-src` et `frame-src` de la Content-Security-Policy, sinon le widget est bloqué.
4. Une fois le site déployé : Supabase → Authentication → Attack Protection → activer la protection captcha, fournisseur Turnstile, coller la clé **secrète**.
5. Supabase → Authentication → Sign In / Providers → Email : activer « Confirm email ».

La protection captcha de Supabase vaut pour tout le projet : les apps iOS et Android, qui n'affichent pas de captcha, verraient leurs connexions par e-mail refusées. Ne l'activer que tant qu'aucune app native n'est distribuée. La clé secrète ne va jamais dans `.env` ni dans le dépôt.

## Rappels de rendez-vous

La migration 012 programme avec `pg_cron` la tâche `inkr_appointment_reminders`, toutes les heures à la minute 7 : `select public.send_appointment_reminders()` envoie au client et à l'artiste une notification 48 h puis 24 h avant chaque séance confirmée, une seule fois par rappel.

- Vérifier : `select jobname, schedule, active from cron.job;` et `select status, start_time from cron.job_run_details order by start_time desc limit 10;`
- Si `pg_cron` n'était pas disponible, la migration l'a signalé sans échouer : activer l'extension (Database → Extensions → `pg_cron`) puis rejouer la migration 012, idempotente.

## Builds iOS et Android

`app.json` ne contient pas encore d'identifiant de projet EAS : il est créé par `eas init` avec le compte Expo du propriétaire. Identifiants : `com.inkr.tattoo` (iOS et Android), schéma de liens `inkr://`.

```bash
npx eas-cli login
npx eas-cli init                      # crée le projet Expo, écrit extra.eas.projectId dans app.json (à committer)
npx eas-cli env:create --environment production --name EXPO_PUBLIC_SUPABASE_URL --value "https://<projet>.supabase.co" --visibility plaintext
npx eas-cli env:create --environment production --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "<clé anon>" --visibility plaintext
npx eas-cli build --platform all --profile preview      # binaires de test internes
npx eas-cli build --platform all --profile production   # versions pour les stores
npx eas-cli submit --platform ios --profile production
npx eas-cli submit --platform android --profile production
```

- `.env` n'est pas envoyé à EAS : chaque profil de `eas.json` lit les variables de l'environnement EAS du même nom (`development`, `preview`, `production`). Y créer aussi `EXPO_PUBLIC_SITE_URL` et `EXPO_PUBLIC_AUTH_PROVIDERS` si utilisés, pour chaque environnement construit.
- Les numéros de build sont gérés par EAS (`appVersionSource: remote`) ; la version affichée reste `version` dans `app.json`.
- Le profil `development` exige `npx expo install expo-dev-client` au préalable.
- Le premier envoi Android se fait à la main dans la Play Console ; ensuite `eas submit` utilise la clé de compte de service Google enregistrée avec `npx eas-cli credentials` (ne jamais committer ce fichier JSON). Pour iOS, `eas submit` demande l'identifiant Apple ou une clé App Store Connect.
- Les notifications push Android exigent en plus un projet Firebase (`google-services.json`, `android.googleServicesFile`) et la clé FCM v1 dans les identifiants EAS.

## Tests

```bash
npm test
```

`tests/rls-security.test.cjs` rejoue toutes les migrations dans PGlite et vérifie, avec les rôles `anon` et `authenticated`, ce que chaque règle doit interdire et ce qui doit continuer à fonctionner. Toute modification d'une règle de sécurité doit y ajouter un cas.
