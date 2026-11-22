# INKR PR #3 — G2 : contrôle réel d'un troisième JWT authentifié (21 novembre 2026)

## Résultat
**PASS ciblé : 16 assertions réussies sur 16 avec un troisième compte de recette indépendant, réellement authentifié via Supabase GoTrue, sur le projet staging `lsewxsdulunuuzmszegm`.** L'utilisateur tiers n'a accès ni aux ressources privées d'autrui, ni aux objets Storage ni aux fonctions d'administration vérifiées.

Le résultat exact du rapport local privé : `PASS_THIRD_GENUINE_JWT_OUTSIDER_RLS_AND_PRIVATE_STORAGE`, `ASSERTIONS=16`, `FAILED=0`, `production_touched=false`.

## Authentification de bout en bout
1. Un e-mail **QA jetable**, utilisant une adresse alias appartenant au responsable de la recette, a été provisionné **uniquement en staging**, à l'aide de la clé publique `sb_publishable_`. L'e-mail de connexion a été livré dans la boîte QA existante.
2. Le lien `https://lsewxsdulunuuzmszegm.supabase.co/auth/v1/verify` a été contrôlé (domaine exact et destinataire exact), puis son `token_hash` à usage unique a été transmis localement sans affichage, log ni commit.
3. `POST /auth/v1/verify` a retourné **HTTP 200** et les jetons GoTrue attendus ; `auth.setSession` et **`auth.getUser`** ont confirmé le vrai JWT. La table `profiles` confirme le rôle **`user`**, non administratif.
4. Le jeton OTP a été effacé du fichier de transfert dès lecture. Les jetons de session sont restés uniquement dans la mémoire du processus de QA.

## Matrice d'autorisations et de refus observés

| Test avec le JWT tiers réel | Résultat |
|---|---|
| Magic-link GoTrue vérifié | PASS |
| Session JWT signée acceptée par Supabase | PASS |
| `auth.getUser` valide | PASS |
| Profil de rôle non privilégié | PASS |
| Lecture de `tattoo_requests` | 0 ligne — PASS |
| Lecture de `messages` | 0 ligne — PASS |
| Lecture de `appointments` | 0 ligne — PASS |
| Lecture de `appointment_deposit_requests` | 0 ligne — PASS |
| Lecture de `notifications` | 0 ligne — PASS |
| Lecture de `request_references` | 0 ligne — PASS |
| Listing de `request-references` Storage | 0 ligne — PASS |
| Génération de lien signé vers un **vrai objet Storage existant** | Refusée — PASS |
| Téléchargement du même objet privé | Refusé — PASS |
| `admin_list_reports` | Refusé — PASS |
| `admin_list_verifications` | Refusé — PASS |
| Déconnexion `signOut({scope:'global'})` | PASS |

Les tables privées de staging ne sont pas vides : une requête SQL indépendante (agrégats seulement, sans contenu) recensait **9 demandes, 2 messages, 1 rendez-vous, 4 références en base et 4 fichiers dans le bucket privé** au moment de la campagne. Les listes privées vides sous le JWT tiers ont donc une portée réelle. Le test de création de lien signé cible un chemin précis existant en Storage, vérifié séparément en SQL. Aucun de ces objets n'a été rendu public ni exporté.

Ce test est **plus fort** qu'une simulation PostgreSQL `SET ROLE` : il utilise un JWT que l'API Auth hébergée a effectivement émis et vérifié. Il complète les **33 assertions de la campagne client–artiste** documentée dans `docs/INKR_G2_SIGNED_JWT_REAL_BUSINESS_FLOW_20261121.md`. Ces campagnes ont été exécutées distinctement : elles ne constituent pas une capture de trois navigateurs connectés **simultanément**.

## Nettoyage et confidentialité
- La session de QA du tiers a été révoquée via `signOut({scope:'global'})`.
- Avant suppression, une requête SQL staging confirmait : **1 compte QA tiers**, **1 profil** correspondant, **0 demande**, **0 message** et **0 rendez-vous** créés par le tiers.
- Le compte Auth QA a été supprimé **par une transaction SQL strictement ciblée sur son alias** après contrôle du rôle et de l'absence de dépendances métier. Une lecture indépendante confirme **0 compte QA temporaire restant et 0 profil orphelin**.
- Les identités et secrets de connexion sont absents du dépôt. Rapports bruts, script d'authentification et chemins d'objet demeurent dans la zone privée `%LOCALAPPDATA%\INKR-QA` sur le poste autorisé.
- Aucune connexion à `jxmefklkixzzdceeorcg` (Supabase production), aucun payment LIVE, aucune publication.

## Critères encore requis pour G2 = GO
- Parcours **interface réelle** avec comptes client, artiste et tiers (Web + Android/iOS), et trois images de référence privées jusqu'à leur suppression / expiration.
- Vérifier la conservation de session/récupération PKCE et la fermeture effective sur chaque plateforme.
- Parcours intégré Stripe **TEST** : Checkout depuis l'interface connectée, redirection HTTPS automatique, webhook, Premium affiché après reconnexion et annulation.
- Tests des rôles autorisés avec des objets Storage privés réels, y compris expiration des liens signés et génération contrôlée des URLs.
- Les différents tests DB/JWT/Auth sont complémentaires, pas une certification de l'expérience complète.

**Verdict G2 global = HOLD ; sous-contrôle JWT tiers / RLS / Storage / privilèges = PASS. PR #3 DRAFT ; production inchangée.**
