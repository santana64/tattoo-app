# INKR — Android v4 → v5 : décision de mise à jour obligatoire avant migration restrictive

**Audit : 22 novembre 2026. Statut global : G0 HOLD / PR #3 DRAFT / production inchangée.**

## Décision vérifiée

**Un « écran de mise à jour obligatoire » ne peut pas être installé à distance sur l'ancienne v4 par Expo Updates.** Cette ancienne version ne semble pas non plus embarquer l'API Google Play Core des mises à jour immédiates. Il faut **distribuer un nouveau binaire Android signé** et vérifier qu'il a remplacé les installations concernées **avant** de retirer les droits ou colonnes consommés par les vieux clients.

Cette conclusion ne prouve pas l'incompatibilité du parcours métier complet : le backend exact et les appels d'exécution de l'ancienne v4 ne sont pas entièrement identifiés.

## 1. Preuves de l'ancien binaire, sans supposition depuis le code récent

APK historique : `%LOCALAPPDATA%\\INKR-QA\\clone\\historical-apk-from-BOOK-20261121.apk`.

- Paquet **`com.inkr.tattoo`** ; `versionCode=4`, `versionName=1.0.0`, SDK min 24, target SDK 36, confirmé avec `aapt dump badging`.
- `AndroidManifest.xml` inspecté par `aapt dump xmltree` : `expo.modules.updates.ENABLED` porte la valeur booléenne **false** `(type 0x12)0x0` ; aucune métadonnée `EXPO_UPDATE_URL` visible. `assets/app.config` contient `runtimeVersion={policy:appVersion}` mais **pas de champ `updates.url`**.
- Les trois `classes*.dex` ne contiennent pas les chaînes de type `AppUpdateManager`, `appupdate`, `ImmediateUpdate` ou `InAppUpdate` ; c'est un **indice négatif statique**, pas une preuve universelle d'absence de tout mécanisme de mise à jour propriétaire.
- Décompilation en lecture seule du bundle Hermes : absence de nouveaux identifiants RPC `respond_to_appointment`, `propose_appointment`. Ni l'URL Supabase de destination de la v4, ni le graphe d'appels effectif n'ont été prouvés.
- Le compte rendu EAS du 21/11 recense des builds internes v4 et **un build v4 de profil STORE**, mais **aucune soumission EAS**. Les installations Google Play, TestFlight et les APK transmis manuellement ne sont **pas inventoriés**. Aucun « zéro installation » ne peut être conclu.
- Côté staging V5, le test avec JWT artiste QA d'une écriture directe à une réservation inexistante retourne **HTTP 403, SQLSTATE 42501**. Ne pas réouvrir des privilèges SQL ou désactiver RLS pour maintenir artificiellement un ancien client.

Sources techniques : [Expo configuration des mises à jour](https://docs.expo.dev/versions/latest/config/app/), [Expo debug des updates](https://docs.expo.dev/eas-update/debug/), [Android in-app updates](https://developer.android.com/guide/playcore/in-app-updates).

## 2. Nouvelle preuve réelle du remplacement binaire (sans accès au backend)

- Test le 22/11 sur **Android 11 API 30**, émulateur avec fichier de partition utilisateur **neuf et distinct** des AVD QA existants.
- V4 historique réellement installée via le Package Manager, **sans lancer son interface ni l'authentifier** : aucun test réseau du backend ancien, susceptible de pointer sur la production, n'a été effectué.
- Installation de l'APK **v5 preview staging** avec `adb install -r` sur la v4 existante : **Success**, `versionCode 4 → 5`.
- **UID de l'application et `firstInstallTime` conservés**, comme lors du premier contrôle du 21/11. L'intégrité de la signature commune est documentée séparément.
- **Limite :** la création d'un fichier témoin dans le stockage externe spécifique à l'application a été refusée par le shell Android 11 (Scoped Storage). Le contenu **privé** de l'installation n'a donc **pas** été testé indépendamment, et aucune prétention de restauration des sessions locales ne doit être formulée.
- Rapport privé `%LOCALAPPDATA%\\INKR-QA\\clone\\g0-v4-to-v5-independent-package-upgrade-20261122.json` ; émulateur arrêté, partition temporaire supprimée après le résultat PASS.
- La v5 utilisée est **une preview signée configurée pour staging**, **pas un build autorisé pour les vrais utilisateurs de production**.

## 3. Stratégie de déploiement sûre : expand → upgrade → contract

**Étape A — Inventory / décision zéro installation**
1. Google Play Console : confirmer l'existence de l'application `com.inkr.tattoo`, les pistes **production, open/closed/internal testing**, leurs versions et les **installations actives v4** ; archiver les exports datés.
2. EAS : rapprocher les 10 anciens builds Android, les liens preview transmis et les éventuels dépôts manuels. Documenter les destinataires effectifs des APK. App Store Connect/TestFlight : vérifier séparément la distribution iOS.
3. Si aucune installation n'existe en dehors des QA contrôlées : joindre une attestation de **zéro client historique**, puis choisir `no-legacy-installations-attested` dans `docs/RELEASE_EVIDENCE.json`. L'absence de soumission EAS seule ne suffit pas.

**Étape B — Si au moins une installation v4 a été distribuée**
1. Ne pas appliquer les migrations restrictives en production et ne pas retirer les anciennes API avant d'avoir une voie de remplacement **réellement accessible**. Les migrations **additives** et non cassantes peuvent être étudiées séparément pour permettre la coexistence provisoire.
2. Construire **depuis un commit revu et la bonne configuration production** un artefact v5 ou supérieur, avec `versionCode > 4`, même `applicationId` et certificat Android reconnu par le canal de distribution. Le binaire QA v5 *staging* n'est pas destiné aux utilisateurs réels.
3. Soumettre le nouveau binaire sur **le même canal effectif** : Google Play (incluant pistes test concernées), ou transfert explicite d'un APK signé aux destinataires manuels. Vérifier sur appareils réels une mise à jour **sans désinstallation** et la persistance des données/identifiants locaux pertinents.
4. Pour une v4 issue du Play Store, Google Play peut installer la mise à jour si le binaire, la signature et le code de version sont compatibles, mais le mécanisme d'**in-app immediate update** dépend du code du **client déjà installé** et n'est pas démontré ici. Les APK sideloadés exigent un canal de remplacement et communication propres.
5. Vérifier la **couverture effective de toutes les installations** : chiffres de versions en service dans la Play Console et confirmations des destinataires manuels ; enregistrer la date, les propriétaires, les preuves de signature et les échecs éventuels. Ne pas supposer que tous les clients passent spontanément à la v5.
6. Tant que des installations v4 subsistent, conserver les API nécessaires **sous leurs contraintes existantes** ou maintenir le lancement en `HOLD`. Un simple retour HTTP 403 ne constitue **pas** une invitation exploitable à mettre à jour.

**Étape C — Contract / retrait final**
1. Sur un clone hébergé, tester le passage v4 → v5, le chemin transactionnel de rendez-vous, la messagerie, les médias privés et la reconnexion **avec des comptes QA et une destination backend connue**.
2. Attester que tous les clients affectés ont été mis à jour **avant** la migration destructive, ou démontrer une compatibilité ancienne complète et sûre.
3. Seulement ensuite : appliquer les changements restrictifs avec rollback multiservice disponible. Vérifier qu'aucun `GRANT` direct dangereux ni désactivation de RLS n'a été ajouté pour contourner le problème.
4. Exiger le dernier SHA CI vert et l'approbation distincte du propriétaire avant la distribution/production.

## 4. Verrou CI renforcé

`scripts/check-release-evidence.cjs` bloque désormais un hypothétique `G0 = GO` avec la résolution `legacy-exclusion-tested` si l'on n'a **pas** attesté explicitement :
- la désactivation des OTA dans la v4 ;
- la livraison signée d'un remplacement aux destinataires réels ;
- l'installation effective de la nouvelle version chez **tous** les destinataires concernés ;
- le bon ordre de publication **avant** les migrations cassantes ;
- l'absence de contournement dangereux des privilèges / RLS.

La résolution `no-legacy-installations-attested` exige en outre une attestation distincte de zéro client historique. Des tests automatisés négatifs couvrent ces conditions ; ces booléens ne valent **pas à eux seuls preuve** sans les exports Play/QA datés.

**Verdict : plan techniquement exploitable, mais pas de « forced update » effectivement diffusé. G0 reste HOLD jusqu'à l'inventaire de distribution et l'exécution du déploiement sûr.**
