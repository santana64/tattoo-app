# INKR PR #3 — G1 sauvegarde Storage chiffrée et restauration sur clone (21/11/2026)

## Verdict ciblé
**PASS : archive Storage de production créée en lecture seule le 21 novembre et restaurée localement physiquement, empreintes par objet comparées. G1 global HOLD** : le SQL le plus récent reste daté du 17 novembre et une récupération depuis OneDrive distant indépendamment du poste n'est pas prouvée.

## Exécution vérifiée
- Audit SQL en lecture seule sur Supabase production `jxmefklkixzzdceeorcg` : exactement **3 fichiers publics** dans `avatars`, `covers` et `posts-media`, avec tailles respectives **129 536**, **46 198**, **224 033** octets. Il ne s'agit **pas** de fichiers privés ni d'un accès Storage non autorisé.
- Script local déjà existant `%LOCALAPPDATA%\INKR-QA\scripts\Backup-INKR-Storage.ps1` : trois téléchargements HTTP GET des trois fichiers publics, vérification longueur et signature JPEG, empaquetage en mémoire dans ZIP avec manifeste et SHA-256, chiffrement **Windows DPAPI CurrentUser** puis contrôle d'aller-retour cryptographique. **STORAGE_BACKUP=PASS**, archive de **380 774 octets**, datée du **21 novembre 2026** sous `%LOCALAPPDATA%\INKR-QA\backups`.
- Script de restauration locale `Verify-INKR-Storage-Backup-20261121-Unique.ps1` : déchiffrement, lecture du manifeste ZIP, restauration des **3 objets** dans un dossier local isolé, vérification des octets et SHA-256 des fichiers écrits physiquement : **INKR_STORAGE_BACKUP_AND_LOCAL_RESTORE=PASS**, total **399 767 octets**. Aucune réécriture des buckets de production.
- Une campagne supplémentaire a re-chiffré une archive Storage fraîche en **AES-256-GCM + scrypt**, l'a transférée exclusivement sous forme de ciphertext vers la seconde machine **BOOK** et restauré **3/3 fichiers, 399 767 octets**, avec contrôles SHA et suppression des fichiers temporaires. Rapport indépendant `second-host-fresh-storage-restore-20261121.json` : `PASS_INDEPENDENT_HOST_FRESH_STORAGE_3_OBJECT_RESTORE`. Voir `INKR_G1_FRESH_STORAGE_SECOND_HOST_RESTORE_20261121.md`. Aucun dump en clair ni secret partagé via GitHub.

## Limites
- Le script SQL existant `Backup-INKR-Production.ps1` nécessite un mot de passe PostgreSQL de production fourni de façon sécurisée au poste local ; aucun secret n'a été sollicité en conversation ni inventé. **Aucun nouveau dump SQL n'a été produit** : dernière sauvegarde SQL disponible vérifiée du **17 novembre 2026**, quatre jours plus ancienne.
- L'archive Storage fraîche utilise DPAPI dépendant de l'utilisateur Windows, et **n'est pas une sauvegarde immédiatement portable entre machines** sans ré-enveloppement des clés.
- La présence de deux archives antérieures dans le dossier OneDrive de PUCCI et leur intégrité sur BOOK étaient prouvées, mais **pas leur récupération depuis l'API OneDrive cloud** ; une authentification/lecture indépendante demeure indispensable.
- Aucune restauration complète d'un projet Supabase hébergé (Auth/DB/Storage/Edge) n'a été effectuée.

**G1 global = HOLD malgré la réussite du contrôle Storage frais.**
