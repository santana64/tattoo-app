# INKR — répétition du rollback transactionnel SQL sur dump frais du 21 novembre 2026

## Verdict

**PASS ciblé — migration SQL + ROLLBACK sur le snapshot du 21/11/2026.**
**G4 global : HOLD** (aucune restauration coordonnée DB + Auth Runtime + Storage binaire + Edge Functions + Web sur clone hébergé n'est démontrée).

## Preuve exécutée

- Source : le vrai `pg_dump` du 21/11/2026, créé en **lecture seule** depuis la production `jxmefklkixzzdceeorcg`, métadonnées et empreinte DPAPI/SQL déjà vérifiées dans `docs/INKR_G1_FRESH_SQL_20261121_SECOND_HOST_RESTORE.md`.
- Script privé exécuté sur PUCCI : `%LOCALAPPDATA%\\INKR-QA\\scripts\\Rehearse-INKR-FreshSnapshotRollback-20261121.ps1`. L'archive est sélectionnée comme la plus récente selon sa date de modification, avec validation de son manifeste et de son empreinte chiffrée. Nom du point de reprise validé dans le rapport : `snapshot=2026-11-21`.
- Instance éphémère **PostgreSQL 17**, boucle locale `127.0.0.1:55459` et base de test créée vide ; aucune connexion d'écriture à Supabase production ni staging.
- Restauration source : **36 tables publiques**, 2 rendez-vous, 4 demandes, 7 templates, 7 utilisateurs Auth, 3 objets Storage (métadonnées), fingerprint déterministe des rendez-vous `a5139386f5dfd60a76965d7240d38160`.
- Exécution **des 12 migrations `supabase/migrations/202611*.sql`**, dans une transaction PostgreSQL unique avec une sonde du schéma avant l'instruction `ROLLBACK;`.
- Comparaison : **36 tables avant → 38 après application dans la transaction → 36 après rollback**. Les rendez-vous, demandes, utilisateurs, métadonnées d'objets Storage et leur empreinte sont conservés. Les tables nouvelles propres à V5/V5.1 sont présentes durant la transaction et absentes après rollback.
- Résultat : `PASS_REAL_PRODUCTION_SNAPSHOT_MIGRATION_TRANSACTION_ROLLBACK`, `migration_count=12`, `historical_fingerprint_preserved=true`, `transactional_rollback_tested=true`.
- Processus local PostgreSQL arrêté puis dossier de travail contenant le dump en clair supprimé : `plaintext_removed=true`.
- Rapport privé : `%LOCALAPPDATA%\\INKR-QA\\clone\\g4-fresh-snapshot-transaction-20261121.json`, exécution **22:47:21–22:47:55 CET le 21/11/2026**.

## Limites et contrôles impératifs

1. Ce test ne prouve pas un rollback **après COMMIT** ou après une période d'écritures concurrentes : il annule une migration dans une transaction locale.
2. Une sauvegarde SQL ne restitue pas les binaires Storage, la configuration Auth, les secrets, les fonctions Edge, les paramètres Vercel ou les abonnements Stripe. Il faut un clone hébergé séparé et un plan de réconciliation.
3. Le snapshot contient les données de production et ne doit pas être copié vers un environnement public ou des journaux CI.
4. L'accès indépendant depuis OneDrive cloud et la récupération de la clé **sans aucun des deux PC** restent non vérifiés.
5. Le client Android v4 peut devenir incompatible avec les permissions après migrations ; ne pas restaurer les droits directs pour contourner ce risque.

**Publication : G4 HOLD, PR #3 DRAFT.** Aucun merge ni déploiement de production autorisé par ce rapport.
