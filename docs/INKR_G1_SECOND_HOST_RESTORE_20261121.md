# INKR — restauration indépendante sur second ordinateur (G1, 21 novembre 2026)

## Périmètre
- Source : sauvegardes historiques **du 17/11/2026** exportées sur `PUCCI`. Ce contrôle ne crée **pas** une nouvelle sauvegarde de production à la date du 21 novembre.
- Cible : `BOOK-OOU94V899O`, ordinateur Windows différent sur le même LAN.
- Aucun écrasement de données préexistantes sur `BOOK`, aucune modification des projets Supabase de production ou staging et aucun merge GitHub.
- Résultat : **PASS pour la restauration indépendante du dump SQL et des trois objets Storage historiques**. **HOLD pour la preuve de synchronisation cloud/offsite et pour une reprise intégrale de l'application et des services hébergés**.

## Transfert et protection des clés
1. Deux archives AES-256-GCM + scrypt au format `INKR-PORTABLE-v1` ont été transférées vers `BOOK` par un serveur LAN temporaire ne délivrant que les fichiers chiffrés, avec un jeton d'autorisation éphémère.
2. SHA-256 des copies chiffrées vérifiées sur `BOOK` :
   - SQL : `c38d6e3106b8facee6585b516c9d906924abd67da849cecdc545c42a47ad1889` (566 207 octets).
   - Storage : `356b2872d1e5a66e93d23bae1394817a621b0ef36a99bbb35b8ac3aa364a9e14` (380 608 octets).
3. La clé de déchiffrement a été enveloppée en RSA-OAEP/SHA-256 au moyen d'une clé publique créée sur `BOOK`. La clé RSA privée n'a pas quitté `BOOK`.
4. Après validation, le secret de récupération de `BOOK` a été protégé via Windows DPAPI `CurrentUser`. Les clés RSA transitoires en clair, le jeton LAN et les deux serveurs temporaires ont été supprimés/arrêtés.
5. Les scripts de vérification `BOOK` ont été adaptés à DPAPI ; la vérification, la restauration SQL et la restauration Storage ont toutes **réussi une seconde fois** après suppression des clés transitoires.

## Preuves SQL — restauration physique indépendante
- PostgreSQL portable **17.12** installé uniquement dans `%LOCALAPPDATA%\INKR-QA\tools` sur `BOOK`, instance **jetable**, `127.0.0.1:55449`.
- Dump custom archive déchiffré/authentifié sur `BOOK` : SHA-256 clair `d5c6f74bce0f7150e88826a775949b1cfcfdd5053ccdf5f03d263b737797ecf6`, 566 146 octets.
- `pg_restore` exécuté avec `--single-transaction --exit-on-error --no-owner --no-acl`; extensions compatibles préparées localement, sans connexion distante.
- Contrôles : **36 tables publiques**, **2 rendez-vous**, **4 demandes**, **7 modèles de messages**, **7 utilisateurs Auth**, **3 objets Storage catalogués**, **8 buckets**.
- Empreinte UTC des rendez-vous : `a5139386f5dfd60a76965d7240d38160`, identique à la restauration historique.
- Rapport `second-host-sql-restore-20261121.json` : **`PASS_INDEPENDENT_SECOND_HOST_SQL_RESTORE`**, `local_only=true`, `plaintext_work_removed=true`.
- PostgreSQL local arrêté ; cluster et dump en clair supprimés. Vérification post-nettoyage : aucun processus PostgreSQL, aucun répertoire de travail SQL.

## Preuves Storage — restauration physique indépendante
- Archive GCM déchiffrée/authentifiée sur `BOOK` : SHA-256 clair `d67792aba729351bb0bcfe6750554acd01f2893bf3d87d54711a8b31f941ea25`, 380 547 octets.
- ZIP lu en totalité (**4 entrées**), puis les **trois objets Storage** restaurés dans un répertoire temporaire isolé de `BOOK`.
- Les trois fichiers ont été comparés par SHA-256 et longueur à la référence historique : **3/3 identiques ; 399 767 octets**.
- Rapport `second-host-storage-restore-20261121.json` : **`PASS_SECOND_HOST_FULL_STORAGE_OBJECT_RESTORE`**, `temporary_plaintext_removed=true`.
- Les fichiers Storage en clair et les ZIP intermédiaires ont été supprimés. Les deux archives **chiffrées** demeurent disponibles sur `BOOK`.

## Reproductibilité et limitations
Les rapports privés restent sur `BOOK` sous `%LOCALAPPDATA%\INKR-QA\isolated-recovery\20261121`. Les clés de récupération ne sont **pas** incorporées aux rapports ni dans Git. La clé de `BOOK` dépend du profil Windows `CurrentUser` : prévoir une procédure de séquestre hors site distincte pour la perte simultanée des deux machines.

**Non prouvé :** synchronisation des archives sur le cloud OneDrive, récupération offsite indépendante, fraîcheur des sauvegardes au jour d'un futur cutover, restauration de l'Auth Supabase live, d'Edge Functions ou des clients distribués. G1 (global) reste **HOLD** tant que la politique de sauvegarde offsite de production n'a pas été vérifiée. Aucun changement du statut de publication G0–G5 n'est autorisé par cette seule preuve.
