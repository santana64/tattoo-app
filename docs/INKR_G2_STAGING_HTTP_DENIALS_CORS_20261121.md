# INKR PR #3 — G2 : autorisations HTTP anonymes et CORS Checkout (21 novembre 2026)

## Résultat vérifié
**10 vérifications HTTP contre Supabase staging : 10/10 PASS**, utilisant uniquement la clé publique du projet `lsewxsdulunuuzmszegm`. Aucune session utilisateur, clé de service, suppression d'objet ou mutation de base n'a été utilisée.

Le programme reproductible `scripts/ci/staging-anon-http-security.cjs` verrouille **en dur** l'URL du projet staging et refuse toute clé non préfixée `sb_publishable_`. Il fonctionne seulement avec une clé publique transmise au processus via `INKR_STAGING_PUBLIC_KEY`, non écrite dans le dépôt.

## Résultats réels par requête

| Test | Méthode | HTTP | Critère | Verdict |
|---|---|---:|---|---|
| Liste demandes privées anonyme | GET PostgREST | 200 | 0 ligne | PASS |
| Liste messages anonyme | GET PostgREST | 200 | 0 ligne | PASS |
| Liste rendez-vous anonyme | GET PostgREST | 200 | 0 ligne | PASS |
| Liste acomptes anonyme | GET PostgREST | 401 | Accès refusé | PASS |
| Liste Storage `request-references` anonyme | POST Storage list (lecture seule) | 200 | 0 objet | PASS |
| `admin_list_reports` sans JWT | POST RPC en lecture seule | 401 | Accès refusé | PASS |
| `admin_list_verifications` sans JWT | POST RPC en lecture seule | 401 | Accès refusé | PASS |
| Préflight CORS depuis preview INKR récente `prrqvs0jx` | OPTIONS Checkout | 200 | `Access-Control-Allow-Origin` exact | PASS |
| Préflight CORS depuis preview INKR précédente `po0g25qat` | OPTIONS Checkout | 200 | `Access-Control-Allow-Origin` exact | PASS |
| Préflight CORS depuis `https://attacker-example.invalid` | OPTIONS Checkout | 200 | Aucune autorisation de l'origine étrangère / aucun `*` | PASS |

Les codes HTTP 200 du préflight n'impliquent pas que l'origine étrangère soit autorisée : les navigateurs appliquent le contrôle à partir de l'en-tête `Access-Control-Allow-Origin`. Ici l'en-tête n'autorise ni cette origine ni le wildcard.

## Observations de sécurité complémentaires
- Une requête SQL en lecture seule donne **31 tables publiques et RLS activé sur les 31**.
- Cinq fonctions SQL `SECURITY DEFINER` sont exécutables par `anon`, incluant les statistiques et disponibilités publiques d'artistes, réactions publiques, et `report_client_error` ; ces interfaces doivent faire l'objet d'un audit métier avant production, la simple présence n'étant pas une preuve de faille.
- Les cinq fonctions de modération `admin_list_reports`, `admin_list_verifications`, `admin_resolve_report`, `admin_review_verification`, `admin_set_ban` consultées par `pg_get_functiondef` appellent `public.assert_admin()`; cette fonction vérifie `public.is_admin()`, elle-même fondée sur le profil correspondant à `auth.uid()`. **La revue de source ne remplace pas un test d'appel avec JWT non administrateur.**
- L'ancienne fonction Edge de recette `inkr-test-auth-seed` est déployée en réponse `410 Gone` et `verify_jwt=true`, constaté depuis le code déployé. Elle n'est pas une voie active d'initialisation d'utilisateurs via son code actuel.

## Ce que cela ne démontre pas
- Les mêmes refus avec **un troisième JWT authentifié** restent non testés.
- Le parcours Web **authentifié** « Passer à Premium » → Stripe Checkout TEST → retour HTTPS automatique → webhook → affichage Premium après reconnexion n'a pas été exécuté dans cette passe.
- Les trois objets Storage privés et leur usage depuis l'UI client/artiste n'ont pas fait l'objet de tests JWT hébergés dans cette passe.
- Le contrôle CORS n'établit pas à lui seul la validité des URL `success_url` et `cancel_url` envoyées par l'UI.
- D'autres conseils Supabase (fonctions SECURITY DEFINER, extensions dans public, index RLS) restent à traiter selon leur exploitabilité et leur impact.

**G2 global : HOLD. G0, G1, G3, G4, G5 : HOLD. La production `jxmefklkixzzdceeorcg` n'a pas été touchée ; la PR #3 reste DRAFT.**

## Rejeu sans secret Git
Dans un terminal local disposant d'une clé publique staging :
```powershell
$env:INKR_STAGING_PUBLIC_KEY = (Get-Content "$env:LOCALAPPDATA\INKR-QA\secrets\staging-anon-publishable.key" -Raw).Trim()
node scripts/ci/staging-anon-http-security.cjs
Remove-Item Env:INKR_STAGING_PUBLIC_KEY
```

Résultat observé : `INKR_STAGING_ANON_HTTP_QA=PASS (10/10 checks; production untouched)`.
