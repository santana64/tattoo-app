# INKR PR #3 — G4 : préparation du rollback multiservice (21 novembre 2026)

## Décision
**Contrôle en lecture seule et documentation de reprise : PASS ciblé. Rejeu du rollback multiservice complet : NON FAIT — G4 HOLD.** Il est interdit d'assimiler le `ROLLBACK` PostgreSQL de migration exécuté sur clone à une récupération globale de l'application.

## Inventaire observé des dépendances à restaurer

Les inventaires ont été lus par le connecteur Supabase dans les projets de production et de staging, sans modification.

| Service | Production actuelle | Staging V5.1 |
|---|---|---|
| Supabase DB migrations enregistrées | 9 (`001` à `009`) | 24 |
| Supabase Edge Functions | **9 ACTIVE** | **5 ACTIVE** |
| `create-checkout-session` | version 7, `verify_jwt=false` | version 8, `verify_jwt=true` |
| `stripe-webhook` | version 3 | version 4 |
| `payment-return` | version 3 | version 6 |
| `delete-account` | version 2, `verify_jwt=true` | version 8, `verify_jwt=true` |
| `inkr-test-auth-seed` | **absente** | version 16, active mais code `410 Gone` |
| Autres Edge production | `create-billing-portal-session`, `healed-photo-reminders`, `send-push`, `create-deposit-checkout`, `create-flash-checkout` | absentes |

**Ne surtout pas remplacer l'intégralité de l'inventaire Edge production par l'inventaire plus court de staging** : cela supprimerait cinq fonctions requises par les clients actuels.

État Web production Vercel : déploiement précédemment `READY` `dpl_wtkr5vtLNsn8ehULWTiPpyiPHLna`, commit `410ad0a89e6f62682a6584f843a65c801009f686`. Cette référence doit être **revérifiée contre l'alias de production** immédiatement avant tout éventuel cutover ; un déploiement `READY` ne prouve pas qu'il dessert le trafic public. Le Web staging PR #3 est une preview indépendante et protégée.

## Preuves antérieures déjà disponibles
- Snapshot réel **17/11** restauré dans PostgreSQL jetable local, puis **12 migrations** V5/V5.1 dans une transaction, **36 → 38 tables**, `ROLLBACK;` **38 → 36**, comptes historiques et empreinte inchangés. Script `scripts/qa/real-snapshot-20261117-migration-rehearsal.ps1`. Ce test reste **SQL local uniquement**.
- Sauvegarde Storage **21/11**, 3 objets réels et 399 767 octets, restaurée depuis une archive AES-GCM sur **BOOK**, trois SHA-256 identiques ; les fichiers temporaires ont été supprimés.
- CI, Web, émulateur Android et simulateur iOS sur `6ac997e` : **4/4 workflows GitHub success**.
- G0 : un build Android v4 `STORE` existe dans EAS. Il faut une stratégie explicite pour les clients anciens si les RPC/permissions deviennent incompatibles.

## Procédure de répétition G4, à exécuter uniquement sur clone hébergé isolé
1. **Préparer le point zéro** : inventaire complet des 9 Edge prod (source+version+configuration+variables, valeurs sensibles hors Git), historique des 9 migrations, Auth settings, policies RLS et objets Storage avec checksums. Sauvegarde SQL fraîche + fichier Storage + coffre-fort indépendant de récupération de clé ; vérification par récupération cloud hors site.
2. **Répéter les migrations** contre le clone restauré en conditions proches de Supabase, avec utilisateurs Auth réels synthétiques et objets Storage privés. Garder l'ancienne application v4 en lecture de ses chemins compatibles ou démontrer la politique d'exclusion/obligation de mise à jour.
3. **Démontrer un incident de manière sûre** : bloquer la disponibilité d'une Edge Function *sur le clone uniquement* ou annuler le déploiement Web preview, puis rétablir le service sans pertes de données, secrets, rôles ni pièces privées.
4. **Répéter le rollback DB** : ne pas présumer qu'un rollback SQL après COMMIT annule les mutations. Employer un plan vérifié de restauration (PITR/ou snapshot) et documenter les écritures concurrentes à réconcilier. Ne pas perdre les événements Stripe TEST idempotents (contrôler `stripe_subscription_events` et l'état Stripe).
5. **Répéter les Edge Functions** : republier les anciennes versions préservées uniquement sur clone ; revalider `verify_jwt`, CORS, politiques d'auth manuelle, les cinq fonctions prod absentes de staging et les webhooks Stripe.
6. **Répéter Storage et Auth** : vérifier que les objets existants gardent leurs octets et permissions ; test négatif d'accès d'un compte tiers ; utilisateurs et sessions récupérables ; pas de secrets d'auth dans les logs.
7. **Revenir en arrière sur le Web** : utiliser un alias/preview réversible, vérifier routes d'auth callback, liens signés, pages de tarification et statut d'abonnement. Aucun rollback client mobile instantané n'est garanti : préparer un plan d'anciennes versions non compatibles.
8. **Critères de reprise** : 0 fuite d'objet privé, aucune régression de rôle, invariants de facturation, comptes et objets conservés à SHA égale, aucune migration destructive non restaurable, délais RTO/RPO mesurés, rapport d'exécution signé.

## Règles d'intervention en production (non autorisées à ce stade)
- Gel de changement, sauvegarde préalable, fenêtre de publication supervisée et canary progressif.
- Point de retour arrière identifié explicitement pour Vercel et versions Edge. Garder le même niveau de protection RLS.
- Déclencheur de rollback : échec login, données privées accessibles au tiers, webhook payant incohérent, taux d'erreurs majeur, migration non compatible.
- N'exécuter aucun `request_promote`, `request_rollback` de prod, ni `apply_migration` en production sur la seule base de ce document.

**G4 HOLD** jusqu'au test de restauration coordonnée **sur clone hébergé**, avec une sauvegarde SQL fraîche et un accès offsite prouvé. PR #3 DRAFT et production inchangée.
