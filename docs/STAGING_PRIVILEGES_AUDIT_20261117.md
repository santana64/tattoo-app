# INKR V5.1 — Revue des privilèges STAGING, 17 novembre 2026

**Périmètre :** Supabase staging `lsewxsdulunuuzmszegm`. Requêtes sur `pg_proc`, `pg_class` et `pg_namespace` **uniquement en lecture**. Aucune mutation de données ou de configuration. Production `jxmefklkixzzdceeorcg` inchangée.

## Résultats constatés

| Contrôle | Résultat |
| --- | --- |
| Tables `public` sans Row Level Security | **0** |
| Fonctions `admin_*` présentes | **5** |
| Fonctions `admin_*` avec appel à `public.assert_admin()` | **5/5** |
| Fonctions `admin_*` directement exécutables par `anon` | **0** |
| RPC de création / clôture des acomptes exécutables par `anon` | **0** |
| RPC de proposition / réponse / annulation de rendez-vous exécutables par `anon` | **0** |
| Fonctions `SECURITY DEFINER` exécutables par `anon` | **5** |

Les cinq RPC accessibles publiquement sont `artist_free_slots`, `artist_public_stats`, `artists_nearby`, `post_reaction_counts` et `report_client_error`. Leur exposition est **compatible avec les parcours invités** de découverte des artistes et de remontée des erreurs. Cela ne constitue pas une certification de sécurité : les fonctions `SECURITY DEFINER` doivent être considérées comme des frontières d'autorisation et auditées régulièrement. Les quatre RPC de consultation sont limités dans leurs résultats ; `report_client_error` a une limite globale de 60 écritures par minute, laquelle ne constitue pas un contrôle anti-abus par utilisateur ou IP.

Les cinq RPC d'administration sont protégées dans leur corps par `public.assert_admin()`, qui utilise `public.is_admin()` et le profil de `auth.uid()`. Ce contrôle est attesté par **lecture des définitions SQL sur staging** et non par un essai de compte malveillant sur le service Auth. Le test RLS en condition réelle nécessite deux comptes de recette confirmés et autorisés.

## Avertissements Supabase non ignorés

La liste des *security advisors* signale 5 `SECURITY DEFINER` accessibles à `anon`, ainsi que 3 extensions dans le schéma `public` et des fonctions `SECURITY DEFINER` accessibles aux authentifiés. Certaines alertes sont inhérentes à l'architecture des RPC publics ; ne pas supprimer aveuglément leurs droits. Les extensions `pg_trgm` et `btree_gist` sont utilisées par des objets SQL existants, de sorte qu'une relocalisation sans analyse des dépendances serait risquée.

Sources de remédiation : https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable et https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public .

## Séquence de recette encore nécessaire

Le script `scripts/staging-auth-readonly-audit.cjs` peut établir **deux vraies sessions Auth sur staging** à partir de comptes de test existants (client et tatoueur), vérifie les rôles, lit les données autorisées et teste la non-divulgation d'un rendez-vous tiers s'il en existe un. Il reste strictement en lecture seule et refuse la production. Les identifiants doivent être entrés dans la fenêtre privée `INKR - Recette authentifiee STAGING` sur le PC, sans les envoyer dans le chat. Tant que les comptes ne sont pas fournis et le script réellement exécuté, **G2 reste HOLD**.

**Autres blocages préexistants :** G0 (signature des APK historiques et parc réellement distribué), G1/G4 (copie de sauvegarde chiffrée et récupérable sur un support indépendant, restauration complète dans les services managés), G3 (appareils, iOS, permissions, erreurs réseau et accessibilité), G5 (approbation de mise en production). Les trois objets Storage ont déjà une sauvegarde chiffrée et une restauration **sur disque local** vérifiée. Le rejeu SQL et le rollback PostgreSQL ont été testés sur les clones privés. Aucun de ces résultats ne justifie de lever automatiquement les gates.
