# INKR PR #3 — G2 : parcours authentifié réel avec JWT Supabase signés (21 novembre 2026)

## Verdict ciblé
**PASS pour le cycle métier backend réalisé avec deux sessions GoTrue effectivement signées**, sur le seul Supabase **staging** `lsewxsdulunuuzmszegm`. **G2 global HOLD** : ce test ne prouve ni la navigation UI du dernier build ni un troisième utilisateur authentifié, ni les références privées via JWT / Storage.

## Origine et vérification des preuves
- Programme d'exécution privé déjà présent sur le poste de QA : `%LOCALAPPDATA%\INKR-QA\scripts\Run-INKR-RealJWT-QA-20261121.cjs`.
- Rapport privé de recette `%LOCALAPPDATA%\INKR-QA\clone\real-jwt-qa-20261121.json`, horodaté entre **2026-11-21T11:20:20.111Z** et **2026-11-21T11:20:24.117Z**, statut **`PASS_REAL_SIGNED_JWT_BACKEND_FLOW`** ; `production_touched=false`, `ui_tested=false`.
- Le programme consomme des `token_hash` Auth à usage unique via `POST /auth/v1/verify` pour **deux comptes QA distincts**. Il établit de vraies sessions Supabase via `setSession`, puis vérifie les jetons par `auth.getUser()`. Ce n'est pas un contrôle qui usurpe le rôle via `SET ROLE`.
- Le code du programme et ses résultats ont été inspectés à nouveau le 21 novembre. **33 assertions métier et d'authentification** sont marquées `pass=true` dans la sortie privée.
- Aucun JWT, jeton d'OTP, mot de passe, adresse e-mail, identifiant utilisateur ni lien privé n'est reproduit dans ce document. Le code détruit le fichier local des hash OTP à usage unique après lecture.

## Matrice exécutée avec vraies sessions Auth
| Domaine | Preuve | Résultat |
|---|---|---|
| Auth | Lien à usage unique vérifié par GoTrue pour le client | PASS |
| Auth | Vraie session et `getUser()` client | PASS |
| Auth | Lien à usage unique vérifié pour l'artiste | PASS |
| Auth | Vraie session et `getUser()` artiste | PASS |
| Identités | Comptes distincts, `profiles.role` user/artist et profil `artists` | PASS |
| PostgREST | SELECT autorisé sur 5 ressources privées par rôle | PASS (10/10) |
| Demande | Client crée une demande de tatouage, artiste la lit | PASS |
| RLS | L'anonyme ne lit pas la demande | PASS |
| Messagerie | Deux messages échangés dans les deux sens et persistants | PASS |
| RLS | L'anonyme ne lit pas les messages | PASS |
| Agenda | L'artiste accepte la demande et propose une séance | PASS |
| Agenda | Le client confirme par RPC `respond_to_appointment` | PASS |
| Acompte | Le client n'est pas autorisé à créer lui-même l'acompte | PASS |
| Acompte | L'artiste crée l'acompte manuel facultatif | PASS |
| Acompte | Le client consulte le montant ; l'anonyme ne lit pas | PASS |
| Acompte | L'artiste renonce à l'acompte ; notification correspondante | PASS |
| Données | Les notifications ne contiennent pas de lien de paiement | PASS |

Le rapport privé n'est **pas** une preuve d'UI Web ou Android/iOS ; il ne contient pas de test de paiement Stripe avec redirection, ni d'accès Storage signé, ni d'un utilisateur tiers authentifié.

## Absence de résidus de données de la campagne
Une requête **SQL en lecture seule** exécutée à nouveau sur le staging le 21/11/2026 vérifie exactement le marqueur de la campagne `INKR-QA-REAL-JWT-20261121` :
- `tattoo_requests.description` : **0** ligne.
- `messages.content` commençant par le marqueur : **0** ligne.
- `appointments.notes` portant le marqueur : **0** ligne.

Aucune donnée de test associée au marqueur ne subsiste dans ces trois tables. Ces trois contrôles ne prouvent pas l'absence absolue de tout autre objet (par exemple en Storage ou notification sans ce marqueur).

## Sécurité et réserves
- Le projet Supabase staging possède **31 tables dans public et 31 ont RLS activé** (contrôle SQL indépendant).
- La fonction Edge de QA `inkr-test-auth-seed`, encore enregistrée comme active mais avec `verify_jwt=true`, répond désormais uniquement `410 Gone` : son code source de déploiement a été inspecté. Elle ne peut pas être invoquée pour obtenir des données de test par ses anciennes fonctions.
- Un audit de sécurité indique des fonctions `SECURITY DEFINER` exposées à `authenticated`, dont les fonctions de modération ; leur présence n'est pas intrinsèquement une exploitation. Les fonctions `admin_*` examinées appellent systématiquement `public.assert_admin()` et les contraintes de droit doivent rester couvertes par des tests négatifs JWT réels.
- Aucun déploiement, migration ou modification du projet Supabase de production `jxmefklkixzzdceeorcg`.

## Pour G2=GO
1. Trois sessions réelles indépendantes client/artiste/utilisateur tiers ; preuves de refus RLS/Storage pour le tiers authentifié.
2. Test de 0 à 3 références privées depuis la **vraie UI**, tentative de quatrième interdite ; liens signés/expiration/nettoyage ; preuve multi-comptes.
3. Parcours client↔artiste complet dans la **dernière** preview Web et les builds natifs après fermeture/reconnexion, sans erreur PKCE/SecureStore.
4. Retour automatique Stripe TEST depuis l'UI Web, abonnement visible après reconnexion et annulation, sans toucher aux paiements LIVE.
5. Contrôles anti-régression de sécurité et restauration/replay sans résidus de QA.

**Décision : sous-gate API métier avec JWT signés = PASS ; G2 global HOLD. G0, G1, G3, G4, G5 HOLD et PR #3 DRAFT.**
