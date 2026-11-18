# INKR V5.1 — Preuve Auth HTTP / PostgREST réelle (staging, 18/11/2026)

## Périmètre et environnement

- Branche/PR : `codex/inkr-v5-1-optional-deposits`, PR #3, HEAD initial `dd6b4de8efc8fafb8c2cdc0a8660ce76ef740daa`.
- Preview de référence : `https://tattoo-app-4gmu-1i386krsp-santana64s-projects.vercel.app/`.
- **Supabase staging exclusivement** : `lsewxsdulunuuzmszegm`.
- Production : **aucun appel ni changement** aux données, migrations, réglages Auth, secrets ou déploiements du projet `jxmefklkixzzdceeorcg`.
- Identités de test : comptes Gmail plus-address déjà confirmés et autorisés, désignés ci-dessous uniquement par les rôles `client QA` et `artiste QA`. Aucun jeton ou lien magique n'est reproduit ici.

## Résultats HTTP réels — compte client QA

La procédure ne s'est **pas** limitée à `SET ROLE authenticated` ni à une simulation de `auth.uid()` :

1. Envoi d'un unique lien magique via `POST /auth/v1/otp` (`create_user=false`, clé publique staging) : **HTTP 200**.
2. Réception du mail `Your sign-in link` dans Gmail : **INBOX**, expéditeur `INKR Staging`. Le retour `redirect_to` dans le mail est exactement `https://tattoo-app-4gmu-1i386krsp-santana64s-projects.vercel.app/auth/callback`.
3. Vérification du hash du lien via `POST /auth/v1/verify` : **HTTP 200** ; Supabase Auth a émis un véritable jeton d'accès signé et renvoyé un utilisateur.
4. Appel réel `GET /auth/v1/user` avec ce jeton : **HTTP 200** ; identifiant cohérent avec la réponse Auth.
5. Appels réels à PostgREST staging, avec `apikey` public et `Authorization: Bearer <JWT>` :

| Ressource | HTTP | Résultat visible |
| --- | ---: | --- |
| `profiles` : propre profil (id/role/onboarding) | 200 | 1 ligne |
| `appointments` | 200 | 0 ligne |
| `tattoo_requests` | 200 | 0 ligne |
| `messages` | 200 | 0 ligne |
| `appointment_deposit_requests` : `appointment_id` | 200 | 0 ligne |
| `notifications` | 200 | 0 ligne |
| `profiles` : colonne privilégiée `is_admin` | **403** | Refus attendu, SQLSTATE `42501` |

Un premier essai sur les acomptes avait demandé une colonne `id` **inexistante dans le schéma** et obtenu `400 / 42703` (erreur du test, pas de l'application). La requête corrigée en `appointment_id` a obtenu **200**, tableau vide.

Le contrôle SQL indépendant indique que le staging contient effectivement **1 rendez-vous, 9 demandes, 2 messages et 42 notifications**, mais que le `client QA` ne possède aucune des demandes ou réservations existantes : ses listes vides sont cohérentes avec les droits attendus.

### Accès interdit à des ressources existantes

Une requête REST avec le JWT client a ciblé l'identifiant réel d'un enregistrement étranger dans chacune de ces tables. Les identifiants ne sont pas consignés.

| Lecture directe étrangère | HTTP | Lignes visibles |
| --- | ---: | ---: |
| Rendez-vous non participant | 200 | **0** |
| Demande de tatouage d'un tiers | 200 | **0** |
| Message d'un dossier tiers | 200 | **0** |
| Notification d'un tiers | 200 | **0** |

Ces résultats vérifient le filtrage **RLS par JWT réellement signé** pour ce client, au niveau de l'API hébergée. Ils ne prouvent pas tous les parcours écriture/UI.

### Hygiène de session

Après les lectures, `POST /auth/v1/logout?scope=local` a répondu **204** : seule la session créée pour cette recette a été déconnectée, sans révocation globale des autres sessions. Le corps de la réponse de vérification contenant le JWT a ensuite été supprimé du cache éphémère `net._http_response` du staging. Aucun mot de passe créé/modifié.

## Compte artiste QA — statut distinct

- `POST /auth/v1/otp` : **HTTP 200**, email reçu dans Gmail `INBOX`.
- La vérification automatisée du jeton artiste a été **interrompue par les contrôles de sécurité de l'outil**. Elle n'a pas été relancée ni contournée.
- **Aucun test PostgREST avec un JWT artiste ne doit être considéré comme réussi** sur cette passe. Les vérifications antérieures des permissions artiste via simulations SQL restent des preuves distinctes.

## Bloqueurs de recette

- Une connexion **UI complète en PKCE sur le tout dernier déploiement** n'a pas été exécutée dans cette passe : le navigateur distant était indisponible et le PC Windows de QA hors ligne. Une précédente connexion navigateur avait réussi sur une preview plus ancienne ; ne pas extrapoler automatiquement ce succès.
- Pas de test natif Android/iOS supplémentaire, pas de cycle de rendez-vous/acompte réellement mené par **deux** comptes connectés, ni de preuve d'invitation Auth Admin.
- PR #3 maintenue en brouillon, **G0–G5 / production : HOLD**.

Les identifiants, OTP, jetons d'accès, cookies, secrets de service et URL portant un jeton ne sont jamais ajoutés au dépôt.
