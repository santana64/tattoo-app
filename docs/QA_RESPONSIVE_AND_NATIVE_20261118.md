# INKR V5.1 — QA responsive et état natif — 18/11/2026

## Environnement et périmètre

- PR : `#3`, `codex/inkr-v5-1-optional-deposits`
- Commit observé : `9e124612ae009e61ee556be186cea6d04071b01b`
- Preview : `https://tattoo-app-4gmu-nfpr40ewq-santana64s-projects.vercel.app/`
- Supabase : **staging exclusivement** `lsewxsdulunuuzmszegm`
- Exécution : Microsoft Edge headless / Playwright sur le poste Windows autorisé, sans connexion à un compte applicatif
- Production : aucune modification, aucune fusion, aucune publication native

## Recette de navigation — PASS sur les six parcours et les trois largeurs

Largeurs CSS testées : **320 px**, **390 px** et **1 440 px**, hauteur 844 px.

| Route | Résultat observé |
| --- | --- |
| `/` | HTTP 200, fil de publications de test visible |
| `/explore` | HTTP 200, recherche / découverte visible |
| `/artist/<identifiant QA>` | HTTP 200, profil fictif « Mara Test » visible |
| `/request/new?artistId=<identifiant QA>` | HTTP 200, redirection attendue vers `/sign-in` sans session |
| `/admin` | HTTP 200, redirection attendue vers `/sign-in` sans session |
| `/sign-in` | HTTP 200, formulaire de connexion visible |

Bilan : **18 combinaisons route × largeur chargées**, aucune erreur `pageerror` ou `console.error` captée, aucun débordement horizontal de `document.documentElement.scrollWidth` à ces largeurs. Aucun écran de protection Vercel n'a interrompu la recette.

**Limites :** rendu et routage uniquement. Pas de clic dans tous les composants, pas de test au clavier/lecteur d'écran, pas de connexion client/artiste pendant cette passe, pas de téléchargement, de notification push, ni de test réseau déconnecté. Ce contrôle est **web mobile**, pas **Android/iOS natif**.

## État de la recette Android native

- Artefact précédent, daté du 16/11 : `inkr-v5-1-staging-eas-578577e4.apk`, SHA-256 vérifié `9374f85121d17accf105696809de7a83fc94017508bae889327d7ee98a4375ec`.
- Cet APK correspond à une build **antérieure au commit** `9e12461`, il ne certifie pas les changements de dépendances du 18/11.
- Aucune session ADB active constatée, plusieurs AVD présents.
- Démarrage protégé d'un AVD bas-RAM programmé, mais **non lancé** : seulement **986 Mo de mémoire libre** au contrôle préalable. Le garde-fou a interrompu l'essai sans démarrer ni modifier d'émulateur.
- Verdict : **native E2E HOLD** (appareil et budget mémoire insuffisants).

## Invitations administratives

- La recherche dans l'application et les fonctions du dépôt n'a identifié **aucune implémentation `inviteUserByEmail` ou formulaire d'invitation administrative INKR**.
- L'écran `/admin` gère la modération et redirige les visiteurs non connectés vers `/sign-in`.
- Les emails de **lien magique** ont été vérifiés séparément précédemment ; ils ne constituent pas un test de l'API admin Supabase `inviteUserByEmail`.
- Le poste de QA ne dispose que de la clé publique staging, pas de clé de service ni de session admin appropriée ; aucune invitation de compte supplémentaire n'a été créée.
- Verdict : **invitation administrative non testée**. Ne pas contourner la séparation de privilèges pour fabriquer une réussite.

## Décision de release

- **GO** pour continuer les contrôles staging.
- **HOLD** sur la production (G0–G5 et tests mobiles natifs non totalement levés).
- Ce document est une preuve QA partielle et ne vaut pas approbation de production.
