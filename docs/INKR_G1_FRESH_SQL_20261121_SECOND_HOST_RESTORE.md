# INKR PR #3 — G1 : sauvegarde SQL du 21/11/2026 et restauration vérifiée sur second hôte

**Résultat ciblé : PASS.** L'export PostgreSQL de production du **21 novembre 2026** a été chiffré, transmis sous forme de ciphertext, déchiffré et restauré dans une base PostgreSQL 17 locale isolée sur le **second ordinateur**. **G1 global : HOLD**, car le stockage cloud véritablement récupérable, le coffre-fort de clé hors site et une reprise de services Supabase hébergés n'ont toujours pas été démontrés.

## 1. Archive SQL fraîche depuis la production

- Source unique : `jxmefklkixzzdceeorcg`, export PostgreSQL avec authentification saisie localement sur `pucci` et TLS `verify-full` ; seules des opérations read-only (`psql SELECT`, `pg_dump`) ont été utilisées, **aucune mutation de la base**.
- Date de création locale : **2026-11-21 22:32:53 (+01:00)** ; script : `%LOCALAPPDATA%\\INKR-QA\\scripts\\Backup-INKR-Production.ps1`.
- Dump `pg_dump` au format custom `-Fc -Z 6`, périmètre **`public`, `auth`, `storage`**, sans les octets des objets Storage (sauvegarde Storage séparée déjà validée).
- Fichier local chiffré `inkr-sql-20261121-223253.dump.dpapi` : **566 374 octets**, DPAPI utilisateur Windows.
- Métadonnées locales : `inkr-sql-20261121-223253.dump.json`. Empreinte du dump déchiffré : **SHA-256 `523e2ea550146c32e8e668ad17afdca6cb04fda1a5b0660ef748642635d3013f`**, **566 146 octets**.
- Vérifications : empreinte SHA-256 de la source chiffrée comparée au manifeste ; déchiffrement DPAPI ; empreinte du contenu en clair ; lecture du TOC avec `pg_restore -l` : `G1_NEW_SQL_SOURCE_DPAPI_HASH_TOC=PASS`.

## 2. Archive portable indépendante de Windows/DPAPI

- `Make-INKR-FreshSQL-Portable-20261121.ps1` et `Encrypt-INKR-FreshSQL-20261121.cjs` ont produit **`inkr-sql-20261121.inkrbak`**, enveloppe **AES-256-GCM + scrypt**, **566 207 octets**.
- Emplacement local : `C:\Users\pucci\OneDrive\Documents\INKR-Recovery\20261121`. La **présence dans le dossier OneDrive local n'est pas une preuve de synchronisation dans le cloud**.
- Empreinte SHA-256 du ciphertext : **`26d6f5e5b296804836980e30512540ae3b89fe46b0241a21c64dd41715998a1c`**.
- Déchiffrement authentifié local vérifié ; fichier temporaire SQL en clair supprimé : `G1_NEW_SQL_PLAINTEXT_STAGING_REMOVED=True`. La clé AES n'est pas dans le dossier OneDrive et n'a pas été inscrite dans le dépôt.
- Rapport privé sur `pucci` : `%LOCALAPPDATA%\\INKR-QA\\clone\\g1-fresh-sql-portable-20261121.json`, état `PASS_FRESH_SQL_AES_GCM_LOCAL_VERIFIED`.

## 3. Réception et restauration isolée sur BOOK

- Hôte : `BOOK-OOU94V899O`, distinct de `pucci`.
- Transfert via serveur LAN HTTP temporaire **uniquement des octets AES-GCM**, avec jeton de session aléatoire, vérification stricte taille + SHA-256 avant écriture. Réception exacte **566 207 octets**, SHA du ciphertext identique au point 2 ; **aucun dump SQL en clair transmis**.
- Le serveur temporaire a été arrêté ; port `43896` confirmé fermé après l'opération ; jeton de transfert supprimé.
- Archive reçue sur BOOK : `%LOCALAPPDATA%\\INKR-QA\\isolated-recovery\\20261121\\encrypted\\inkr-sql-20261121.inkrbak`.
- Déchiffrement avec la clé de récupération déjà protégée par DPAPI **sur BOOK**, authentification AES-GCM et SHA-256 déchiffrée : `G1_FRESH_SQL_BOOK_AUTHENTICATED_DECRYPT=PASS`, **566 146 octets**, hash `523e2ea...` identique à la source.
- Restauration dans une instance **PostgreSQL 17 locale éphémère** : `127.0.0.1:55449`, base créée vide, extensions locales, `pg_restore --single-transaction --exit-on-error`. Script `Restore-INKR-FreshSQL-OnBOOK-20261121.ps1`.
- Résultats SQL : **36 tables `public` ; 2 rendez-vous ; 4 demandes ; 7 modèles de message ; 7 comptes Auth ; 3 objets Storage (métadonnées) ; 8 buckets**. Fingerprint déterministe des rendez-vous **`a5139386f5dfd60a76965d7240d38160`**, identique à celui observé en production par `SELECT` read-only le 21 novembre.
- Rapport privé indépendant : `second-host-fresh-sql-restore-20261121.json`, statut **`PASS_INDEPENDENT_SECOND_HOST_FRESH_SQL_20261121_RESTORE`**, `source_snapshot_date=2026-11-21`, `source_signature_match=true`, `plaintext_work_removed=true`, heure de fin **21/11/2026 22:36:36 (+01:00)**.
- Le serveur PostgreSQL isolé a été arrêté ; le dossier `sql-restore-work` contenant les objets déchiffrés n'existe plus.

## 4. Ce qui n'est pas démontré

1. **Cloud hors site :** aucune connexion indépendante à OneDrive Web/API et aucun téléchargement redescendu depuis le stockage distant dont l'empreinte SHA puisse être comparée au fichier sur BOOK.
2. **Clé de récupération hors site :** la clé protégée DPAPI sur les deux PC ne prouve pas la possibilité de déchiffrement après la perte simultanée de ces ordinateurs. Il faut un gestionnaire/coffre de secrets indépendant, avec récupération testée.
3. **Restauration hébergée complète :** un `pg_restore` local PostgreSQL ne restaure pas à lui seul Auth runtime, Storage binaire, SMTP, Edge Functions, secrets ou la totalité d'un projet Supabase. La restauration coordonnée sur une infrastructure de recette distincte et les RPO/RTO réels restent à prouver.
4. **Périmètre :** le dump créé avec `-n public -n auth -n storage` n'est pas une image intégrale des paramètres de l'organisation et des rôles PostgreSQL globaux.

**Verdict : G1 SQL récent et restauration SQL sur second host = PASS. G1 global = HOLD.** Ne pas fusionner la PR #3, ne pas changer Supabase production, ne pas présenter un fichier dans un dossier de synchronisation comme une sauvegarde cloud vérifiée.
