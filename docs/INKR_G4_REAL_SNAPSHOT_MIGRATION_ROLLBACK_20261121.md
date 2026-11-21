# INKR PR #3 — G4 : migration et rollback transactionnels sur un vrai snapshot historique (21 novembre 2026)

## Verdict circonscrit
**PASS — les 12 migrations SQL additionnelles V5/V5.1 sont exécutables sur une restauration PostgreSQL locale du snapshot de production du 17 novembre 2026, et leur rollback transactionnel redonne les mêmes comptes et l'empreinte contrôlée.**

**G4 global = HOLD.** Le test n'est pas une simulation d'un déploiement Supabase complet, ni un rollback coordonné des services Auth/Storage/Edge Functions et des binaires. L'état courant de production après le snapshot du 17/11 n'est pas certifié par cette preuve.

## Environnement et isolations
- Source : sauvegarde PostgreSQL réelle du projet `jxmefklkixzzdceeorcg`, créée le **17/11/2026** et **chiffrée avec Windows DPAPI**.
- Le fichier source chiffré et son JSON de métadonnées ont été comparés en SHA-256, et la version déchiffrée à son empreinte `sha256_plain` attendue.
- PostgreSQL **17.12 local autonome** sur `pucci`, port **127.0.0.1:55459**, nouveau cluster et base **jetables** créés avec un mot de passe aléatoire. Aucune connexion distante requise pour ce test ; aucune migration exécutée sur le projet Supabase de production ou sur le staging.
- Rejeu des extensions locales nécessaires dans le clone, puis `pg_restore --single-transaction --exit-on-error --no-owner --no-acl`. Le test vérifie que les données source attendues sont présentes.
- Script reproductible **versionné** : `scripts/qa/real-snapshot-20261117-migration-rehearsal.ps1` (backup DPAPI local et PostgreSQL portable nécessaires). Script d'exécution privé validé : `%LOCALAPPDATA%\INKR-QA\scripts\Rehearse-INKR-12Migrations-RealSnapshot-20261121.ps1`. Rapport d'exécution **local privé** : `%LOCALAPPDATA%\INKR-QA\clone\g4-real-snapshot-transaction-20261121.json`. Aucun dump, identifiant personnel, mot de passe ni secret ajouté à Git.

## Résultats réellement observés
| Assertion | Avant | Pendant le replay | Après ROLLBACK |
|---|---:|---:|---:|
| Tables du schéma `public` | **36** | **38** | **36** |
| `appointments` | **2** | **2** | **2** |
| `tattoo_requests` | **4** | **4** | **4** |
| `message_templates` | **7** | non modifiés par le replay | non modifiés |
| `auth.users` | **7** | non modifiés par le replay | non modifiés |
| `storage.objects` (métadonnées) | **3** | non modifiés par le replay | non modifiés |
| Empreinte des rendez-vous | **`a5139386f5dfd60a76965d7240d38160`** | **identique** | **identique** |
| Table `appointment_deposit_requests` | absente | présente | absente |
| Table `stripe_subscription_events` | absente | présente | absente |

**12 fichiers SQL** `supabase/migrations/202611*.sql` du dépôt ont été rejoués dans leur ordre lexicographique. Le client `psql` a utilisé `ON_ERROR_STOP=1` et `--single-transaction`, puis un **`ROLLBACK` explicite**. Code de sortie **0** et assertions de présence des nouvelles tables / conservation des données réussies.

Rapport exact : `PASS_REAL_PRODUCTION_SNAPSHOT_MIGRATION_TRANSACTION_ROLLBACK`, 12 migrations, `public_tables_before=36`, `public_tables_migrated=38`, `public_tables_after_rollback=36`, `historical_fingerprint_preserved=true`, `transactional_rollback_tested=true`, `plaintext_removed=true`, `production_touched=false`. Dernière réussite renforcée horodatée de **20:07:21 à 20:07:33, heure de Paris**, incluant les comptes des 7 modèles de messages, 7 utilisateurs Auth et 3 métadonnées Storage avant, pendant et après rollback.

Le premier essai avait été arrêté avant migration à cause de la gestion des sorties natives PowerShell ; un second avait exécuté les migrations sans détecter la ligne de preuve SQL à cause d'un espace de mise en forme. Tous les clones d'essai ont été supprimés. La troisième exécution puis une quatrième avec vérifications renforcées sont des cycles complets **PASS / exit 0**. Ces incidents concernent le harnais de recette et non le code SQL en production.

## Nettoyage et protection
- Le cluster PostgreSQL jetable a été **arrêté**.
- Le port local `55459` ne répond plus en écoute.
- Le dump de production en clair, le mot de passe local temporaire, les logs du clone et le cluster ont été **supprimés**, absence vérifiée.
- La sauvegarde chiffrée d'origine et les rapports privés sont conservés sur le poste autorisé. Le rapport Git ne contient que les métriques et les résultats d'audit.

## Limites obligatoires avant G4 = GO
1. **Snapshot du 17 novembre, pas une sauvegarde fraîche au moment du cutover** : refaire le même replay sur un export immédiatement antérieur à la migration réelle.
2. Les extensions suppléées localement ne reproduisent pas toute l'infrastructure Supabase hébergée ; exécuter également la simulation complète des rôles applicatifs et contrats Auth/Storage après migrations.
3. Ce `ROLLBACK` est **transactionnel dans PostgreSQL**, pas une restauration point-in-time de plusieurs services après un déploiement interrompu.
4. Préparer et tester le retour arrière coordonné de l'application Web et des clients mobiles, des Edge Functions et des paramètres Auth/Storage, y compris la **conservation des objets Storage réels**.
5. Vérifier indépendamment une copie de récupération **hors site et synchronisée**, et obtenir l'autorisation de production spécifique G5.

**G4 global HOLD ; G0, G1, G2, G3, G5 HOLD ; aucune modification Supabase production, aucun merge ni publication.**
