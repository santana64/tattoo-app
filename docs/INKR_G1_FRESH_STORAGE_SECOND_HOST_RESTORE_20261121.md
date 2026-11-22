# INKR PR #3 — G1 : nouvelle sauvegarde Storage chiffrée et restauration indépendante (21 novembre 2026)

## Verdict ciblé
**PASS** — sauvegarde du **21/11/2026** des fichiers Storage effectivement présents dans les buckets de production, avec restauration locale et **restauration complète des 3 objets sur une seconde machine indépendante**. **G1 global HOLD**, faute d'export SQL du 21/11 et de preuve indépendante d'un téléchargement depuis le cloud.

## Source et périmètre
- Une requête SQL **en lecture seule** sur Supabase production `jxmefklkixzzdceeorcg` constate 8 buckets, **3 objets publics** (1 `avatars`, 1 `covers`, 1 `posts-media`) et **0 objet** dans les buckets privés à l'instant contrôlé.
- `Backup-INKR-Storage.ps1` a téléchargé **uniquement en GET** les trois objets publics réels, vérifié taille et entête JPEG, assemblé l'archive ZIP en mémoire, puis chiffré cette archive sur PUCCI en **DPAPI current-user**. Source locale : `inkr-storage-20261121-204304.zip.dpapi`, résultat `STORAGE_BACKUP=PASS`.
- `Verify-INKR-Storage-Backup.ps1` a déchiffré et **restauré les trois objets dans un répertoire local isolé**, contrôlé SHA-256 par fichier et total **399 767 octets**, résultat `INKR_STORAGE_BACKUP_AND_LOCAL_RESTORE=PASS`.
- `Make-INKR-FreshStorage-Portable-20261121.ps1` a produit `inkr-storage-20261121.inkrbak` : fichier ZIP source de **380 546 octets**, archive **AES-256-GCM + scrypt** de **380 607 octets**, intégrité GCM revérifiée localement. Archive située dans le dossier local `OneDrive/Documents/INKR-Recovery/20261121`. **Clé de récupération conservée séparément du dossier OneDrive**.
- Fichier de preuve privé : `%LOCALAPPDATA%\INKR-QA\clone\g1-fresh-storage-portable-20261121.json`.

## Restauration indépendante sur BOOK
- Les **octets de l'archive chiffrée**, jamais le ZIP ou la clé en clair, ont été transmis via un serveur LAN HTTP temporaire en lecture seule, **protégé par un jeton unique**. SHA-256 de ciphertext vérifié sur BOOK avant renommage définitif.
- La **clé AES de récupération avait déjà été protégée sous Windows DPAPI sur BOOK** (jamais passée en clair sur le LAN lors de cette opération).
- `Restore-INKR-BOOK-FreshStorage-20261121.cjs` sur l'hôte `BOOK-OOU94V899O` a fait : vérification GCM, déchiffrement isolé, vérification du ZIP, reconstruction de **3 fichiers** puis vérification **3/3 SHA-256, 399 767 octets**.
- Rapport : `PASS_INDEPENDENT_HOST_FRESH_STORAGE_3_OBJECT_RESTORE`, **`temporaryPlaintextRemoved=true`**, **`productionTouched=false`**.
- Après la preuve, serveur LAN arrêté, port fermé, jetons temporaires supprimés sur les deux machines. Seules les archives chiffrées et les rapports de résultat demeurent.

## Critères restant bloquants
1. **Sauvegarde PostgreSQL complète récente** (`public`, `auth`, `storage`) : le dernier `pg_dump` disponible demeure daté du **17/11/2026**. La commande de backup SQL requiert une authentification PostgreSQL production valide et ne doit pas être remplacée par un export partiel présenté comme complet.
2. **Offsite cloud réel** : la présence de l'archive dans le dossier OneDrive local ne prouve pas qu'elle a été uploadée ni qu'elle est récupérable après disparition des deux PC. Nécessité d'une lecture depuis **OneDrive Web/API sur une session indépendante**, puis vérification d'empreinte du fichier redescendu.
3. **Récupération de clé résiliente à la perte simultanée des PC** : une clé DPAPI présente sur BOOK ne constitue pas une preuve d'un coffre-fort indépendant récupérable hors site.
4. **Restauration hébergée et reproductible** d'une sauvegarde fraîche dans un environnement Supabase isolé, avec Auth, Storage objets, politiques, Edge Functions et procédures de reprise.

**G1 global HOLD malgré la restauration fraîche Storage PASS.** Aucune écriture sur le projet Supabase de production n'a été effectuée.
