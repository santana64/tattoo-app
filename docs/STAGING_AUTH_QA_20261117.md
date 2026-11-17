# INKR V5.1 — Deux vrais comptes Auth de recette sur staging

**Date :** 17 novembre 2026. **Périmètre exclusif :** Supabase staging `lsewxsdulunuuzmszegm`. Production `jxmefklkixzzdceeorcg` inchangée.

## Comptes effectivement créés et confirmés

Deux comptes distincts ont été créés par l’API officielle `/auth/v1/otp` en utilisant la **clé publique staging** et deux alias d’une même boîte Gmail contrôlée. Les réponses étaient `HTTP 200`. Les deux e-mails `Confirm your email address` ont été reçus et authentifiés comme venant de Supabase Auth. Les deux comptes ont été confirmés par le mécanisme e-mail Supabase (le second a répondu `HTTP 303` lors de la confirmation). Requête SQL postérieure : **2 comptes Auth présents, 2 e-mails confirmés, 2 premières connexions enregistrées et 2 profils publics associés**.

Ne pas inclure dans GitHub les liens de confirmation à usage unique, leurs tokens, sessions, identifiants de compte ou informations personnelles. Aucun mot de passe supplémentaire n'a été créé ni stocké.

## Configuration du rôle tatoueur sur staging

Le compte client conserve le rôle `user`. Le compte tatoueur a été promu au rôle `artist` et une ligne correspondante a été créée dans `public.artists`, sous le rôle SQL `authenticated` et le `auth.uid()` de ce compte. L’artist a `booking_status='closed'` et `onboarding_completed=false` : aucun rendez-vous réel n’est proposé ni aucun onboarding complet présumé.

**Précision :** le premier essai d’écriture avait échoué car une requête de diagnostic lisait `is_admin`, une colonne délibérément inaccessible au rôle normal. L’application utilise les colonnes déléguées `role`, `onboarding_completed` et `id`, dont les privilèges colonne et politiques RLS ont été confirmés. L’essai correct a réussi et l’écriture effective a été re-vérifiée.

## Vérification des droits par rôle

Les deux comptes Auth existent réellement. Les requêtes de contrôle SQL ont ensuite **simulé leurs JWT** via `set_config('request.jwt.claim.sub', ...)`, et utilisé `SET LOCAL ROLE authenticated`, avec `BEGIN` / `ROLLBACK`. Cela vérifie les permissions de tables, colonnes et RLS avec les identifiants réels ; cela ne constitue pas un test HTTP avec un jeton Auth signé.

| Test | Client de recette | Tatoueur de recette | Utilisateur extérieur |
| --- | ---: | ---: | ---: |
| Propre profil public visible | 1 | 1 | s.o. |
| Propre ligne `artists` | 0 | 1 | s.o. |
| Rendez-vous préexistants visibles | 0 | 0 | 0 |
| Demandes préexistantes visibles | 0 | 0 | 0 |
| Notifications préexistantes visibles | 0 | 0 | 0 |
| Acomptes préexistants visibles | 0 | 0 | 0 |
| Demande de test créée en transaction, visible | 1 | 1 | 0 |
| Notification destinée au tatoueur, visible | 0 | 1 | 0 |

Le test de création de demande sous la session SQL simulée du client a réussi. Les triggers `notify_request_change` et `notify_user` ont créé la notification attendue pour l’artiste. La transaction complète a été **annulée** après vérification des trois profils, et la base staging est revenue à **9 demandes, 1 rendez-vous, 0 demande et 0 notification résiduelle portant le marqueur de recette**.

## Critères non encore démontrés

- **Une authentification HTTP Supabase (GoTrue) suivie de requêtes PostgREST avec un JWT réellement signé pour chacun des deux comptes**. Les comptes sont confirmés et des premières connexions sont enregistrées, mais aucun jeton de session n'a été conservé pour ce scénario de recette.
- La navigation du web preview et des applications natives, le parcours d'onboarding artiste achevé par l'UI, les notifications push et le rendu UX.
- Les actions complètes sur rendez-vous, paiements manuels, annulations et cas réseau sous de vraies sessions applicatives.
- La distribution des anciens APK et la validation du retour arrière complet.

**Décision : G2 reste HOLD** jusqu’aux tests de session et parcours applicatif réels. Cette preuve ne doit pas être transformée en validation de production.
