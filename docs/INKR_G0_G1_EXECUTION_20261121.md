# INKR V5.1 — G0 Android et G1 sauvegarde portable : protocole d'exécution

**Référence :** PR #3, staging uniquement pour les tests applicatifs. Ce fichier est un protocole, **pas une preuve de distribution, une sauvegarde hors site, ni une autorisation de production**.

## G0 — Risque historique Android

Relevé documenté : dix builds EAS Android historiques au code `4`; huit sont terminées. La configuration du dépôt indique `expo.android.versionCode=1`, mais `eas.json` contient `cli.appVersionSource="remote"` et `production.autoIncrement=true`. **C'est le compteur EAS distant qui gouverne le prochain build EAS**, pas seulement la valeur dans `app.json`.

Le dernier compteur distant relevé dans les audits précédents était `1`, inférieur à `4`. Il faut le **relire** sur la session EAS du projet `@puccicity/inkr`, sans muter son compteur :

~~~bash
eas whoami
eas build:version:get --platform android --profile production --json --non-interactive > eas-version-get.json
node scripts/ci/android-version-gate.cjs remote docs/RELEASE_EVIDENCE.json eas-version-get.json
~~~

Le contrôle lit la version distante, exige la configuration EAS `remote` / `autoIncrement`, et échoue si le compteur observé est inférieur au maximum historique. Un résultat PASS est uniquement une **précondition** ; cela ne prouve ni la version d'un APK/AAB construit, ni sa signature ou son installation.

**Ne pas lancer** `eas build:version:set`, `eas build`, `eas submit`, ni changer les canaux tant que la stratégie de distribution des anciennes installations et son impact ne sont pas approuvés. Pour le candidat réel, après autorisation spécifique, relever le code et l'identifiant exact :

~~~bash
aapt dump badging candidate.apk > candidate.badging.txt
node scripts/ci/android-version-gate.cjs apk docs/RELEASE_EVIDENCE.json candidate.badging.txt
apksigner verify --verbose --print-certs candidate.apk
~~~

Pour un AAB, examiner le manifest avec `bundletool dump manifest`; la commande `aapt` ci-dessus est destinée à un **APK**, pas à un AAB. Le candidat doit avoir le package `com.inkr.tattoo` et `versionCode >= 5`. Comparer les empreintes de signature avec un **ancien APK effectivement distribué** et effectuer un essai d'installation/mise à jour sur un environnement autorisé. Si les anciennes versions ont des signatures incompatibles, élaborer puis tester une stratégie explicite de remplacement/exclusion, sans réouvrir les anciennes permissions Supabase.

Restent manquants : preuve des pistes Play Console et TestFlight, inventaire de toute distribution manuelle, ancienne signature historique, attestation du parc et test d'upgrade. **G0 demeure HOLD.**

## G1 — Archives utilisables indépendamment du compte Windows initial

Les anciens rapports établissent un dump SQL et des objets Storage vérifiés dans une copie locale, mais les archives originales `.dpapi` reposent sur **Windows DPAPI CurrentUser**. La perte du profil Windows ou du PC pourrait rendre ces archives impossibles à déchiffrer. Supabase rappelle que les sauvegardes PostgreSQL n'incluent **pas** les octets des objets Storage.

Le nouveau programme `scripts/portable-qa-backup.cjs` emploie **AES-256-GCM authentifié**, avec clé dérivée d'une phrase secrète par `scrypt` et entête authentifié. Il chiffre de façon portable **des archives déjà exportées localement** ; il ne connecte pas Supabase et **ne réalise pas lui-même** un `pg_dump` ni une restauration.

Sur le poste Windows d'origine, lorsque le propriétaire du profil peut déchiffrer les archives DPAPI, reconstruire localement et temporairement les **véritables** fichiers dump et ZIP d'objets selon l'ancienne procédure contrôlée. Ne jamais transmettre les dumps, l'archive déchiffrée, les secrets ou les identifiants à ChatGPT, à GitHub, ni à un CI public.

Pour chacun des fichiers sources obtenus localement :

~~~bash
node scripts/portable-qa-backup.cjs encrypt inkr-sql.dump inkr-sql.inkrbak
node scripts/portable-qa-backup.cjs verify inkr-sql.inkrbak
node scripts/portable-qa-backup.cjs encrypt inkr-storage.zip inkr-storage.inkrbak
node scripts/portable-qa-backup.cjs verify inkr-storage.inkrbak
~~~

Le programme demande une phrase secrète longue **sans l'afficher**, ne la prend ni en argument ni en variable d'environnement. Ne pas la perdre : **aucune récupération sans la phrase secrète**. L'outil refuse d'écraser un fichier existant. Garder la phrase secrète dans un gestionnaire sécurisé et **hors du dossier d'archives**.

Transférer les deux fichiers `.inkrbak` vers une **seconde machine** (ou support physiquement distinct), dans une sauvegarde hors site et sécurisée. Sur cet environnement indépendant, installer Node.js 22+, disposer de la phrase secrète, puis exécuter :

~~~bash
node scripts/portable-qa-backup.cjs verify inkr-sql.inkrbak
node scripts/portable-qa-backup.cjs decrypt inkr-sql.inkrbak restored-sql.dump
node scripts/portable-qa-backup.cjs verify inkr-storage.inkrbak
node scripts/portable-qa-backup.cjs decrypt inkr-storage.inkrbak restored-storage.zip
~~~

Comparer les SHA-256 du contenu en clair annoncés à ceux relevés **sur la source** lors du chiffrement ; contrôler aussi les tailles. Vérifier `pg_restore --list`, restaurer le dump vers **une base PostgreSQL de test isolée** (jamais la production), comparer tables, empreintes des données et migrations ; extraire le ZIP Storage dans un répertoire de test et comparer la liste, les tailles et les hashs des objets attendus. Évaluer séparément Auth, migrations, configuration et restauration réelle des API Storage. Le chiffrement seul n'est **pas** un essai de reprise après sinistre.

Les fichiers temporaires en clair doivent rester sous contrôle d'accès strict et être supprimés après validation. Attention aux sauvegardes/snapshots automatiques pouvant conserver ces fichiers.

**Évidence nécessaire pour G1** : identifiant d'un support hors site, copie indépendante, résultats des deux `verify`, empreintes SHA-256, restauration indépendante PostgreSQL et Storage, résultats de comparaison (sans données confidentielles), et personne qui les a contrôlés. Les sauvegardes réelles n'ont **pas** été déplacées par la présente modification. **G1 demeure HOLD.**

## Tests et limites

Les tests `tests/release-backup-hardening.test.cjs` vérifient : JSON EAS à code de version chaîne/entier, refus d'un code inférieur à 5 pour un APK, mauvais identifiant Android, chiffrement et déchiffrement d'une archive **fictive**, refus d'un mot de passe incorrect, détection de falsification, absence de publication de fichiers déchiffrés après échec et refus d'écrasement.

Le test utilise des données fictives. Il ne valide ni le dump réel, ni la signature EAS, ni une sauvegarde réalisée sur la seconde machine. **G0–G5 restent HOLD** dans `docs/RELEASE_EVIDENCE.json`.

Références : [Expo — App version management](https://docs.expo.dev/build-reference/app-versions/) ; [Supabase — Database backups](https://supabase.com/docs/guides/platform/backups).
