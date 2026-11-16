# INKR V5 — audit G0 : versions réellement distribuées

**Date du relevé : 15 novembre 2026.** **Décision : G0 NON LEVÉ / HOLD production.**

Cet audit distingue volontairement une **version déclarée dans le dépôt**, une **build compilée**, une **build distribuée** et une **installation utilisée**. Ni l'absence d'une fiche publique, ni la réussite de la CI, ni l'absence de télémétrie ne prouvent qu'aucun ancien client natif n'est installé. Aucun changement n'a été fait au Supabase actif, aux stores, aux canaux EAS ou à la production.

## Identification et preuves disponibles

| Source interrogée | Résultat vérifié | Ce que cela prouve / ne prouve pas |
| --- | --- | --- |
| GitHub, PR #2 `60e7010` | `app.json` : `expo.version=1.0.0`, `android.package=com.inkr.tattoo`, `android.versionCode=1`, `ios.bundleIdentifier=com.inkr.tattoo`, `ios.buildNumber=1`, `runtimeVersion.policy=appVersion` | Identifiants et version **du code source actuel**, pas du parc installé. Le versionnement local ne suffit pas à distinguer deux commits portant tous deux `1.0.0`. |
| `eas.json` | Profils `development` (internal), `preview` (internal) et `production` (Android app-bundle) ; versionnement `appVersionSource=remote` | Des canaux sont **configurés** ; aucune liste de builds soumises/installées n'est fournie par le dépôt. Les versions distantes EAS peuvent différer des entiers dans `app.json`. |
| GitHub Releases | Aucune release sur le dépôt au moment du contrôle | N'exclut pas des builds EAS, TestFlight, Google Play ou APK transmis hors de GitHub. Le workflow GitHub `.github/workflows/ci.yml` ne construit que le web (lint, types, tests, export). |
| Apple, lookup public par bundle ID | `itunes.apple.com/lookup?bundleId=com.inkr.tattoo` : `resultCount=0` en pays `fr` et `us` | Aucune fiche publique trouvée sous cet identifiant dans ces deux boutiques ; ne couvre pas TestFlight, les pays non vérifiés ni une autre fiche/identifiant. |
| Google Play, URL directe | `play.google.com/store/apps/details?id=com.inkr.tattoo&hl=fr` : HTTP **404** | Aucune fiche publique accessible par cette URL lors du contrôle. Ne renseigne pas les tests internes/fermés, les pays non accessibles et les APK externes. |
| Supabase **actif**, lecture seule | `public.client_errors` : **3 événements**, `platform=web`, `app_version=1.0.0`, datés du 12/11/2026 | Prouve que cette version s'est déclarée dans trois **rapports d'erreur web**. N'établit ni le nombre d'utilisateurs ni l'absence de clients iOS/Android (la table collecte des erreurs, pas les sessions). |
| Vercel, projet `tattoo-app` | Une cible Production `READY` sur `a566513` ; une tentative Production plus récente depuis `main` / `5c995e1` en `ERROR`. Protection SSO activée ; `live=false` dans la fiche projet | Une build web a été déployée avec la cible Production ; cela **ne prouve pas** qu'elle est publiquement accessible ou qu'elle utilise aujourd'hui le bon backend. Les previews vertes de PR #2 ne changent pas la production. |
| PC Windows `pucci` | SDK Android et émulateur `Medium_Phone_API_30` disponibles ; aucun téléphone connecté ; ~0,5 Gio de RAM libre au dernier relevé. CLI EAS absente du PATH et non présente dans le cache npm vérifié. | Possibilité future de recette Android ; aucune consultation EAS distante effectuée, aucun lancement d'émulateur ni installation d'application. |

La recherche par simple nom « INKR » n'est **pas** une preuve : l'app publique « Tattoo Stencil Maker: inkr » est développée par NOTJUST.DEV SL et ne correspond pas au bundle `com.inkr.tattoo`.

## Risques constatés sur l'ancienne application

- **Rendez-vous (P0)** : sur `main`, l'écran `app/appointment/[id].tsx` permet à l'artiste `.from('appointments').update({status:'confirmed'})`. Le staging de PR #2 retire `INSERT/UPDATE/DELETE` à `authenticated`, supprimant ce contrat. L'ancien client ne pourrait plus confirmer de la même manière. Le nouveau contrat impose `respond_to_appointment` appelé par **le client**.
- **Références privées (P0)** : `main` lit `request_references.url` comme une URL d'image ; la PR #2 stocke des chemins de fichiers privés et demande des URL signées. L'ancienne interface ne sait pas les afficher.
- **Photos cicatrisées (P0)** : un ancien client utilisant `getPublicUrl` n'obtient pas une lecture valide du bucket privé. Ne **jamais** rendre le bucket public pour contourner ce défaut.
- **Données existantes** : la lecture du Supabase actif confirme **deux** rendez-vous `status=proposed`. Un test de migration sur PGlite (commit `60e7010`) préserve les deux lignes et valide l'acceptation du premier par RPC du client, sans valider pour autant le comportement d'une ancienne application installée.

## Preuves indispensables pour lever G0

Les vérifications suivantes doivent être réalisées dans les comptes propriétaires, par accès autorisé ou export expurgé, **sans communiquer de jetons, certificats, secrets, données nominatives ou clés de signature** :

1. **Expo EAS** : examiner le projet lié à `com.inkr.tattoo` ; recenser les builds Android et iOS avec plateforme, `appVersion`, `versionCode/buildNumber` distants, profil, canal, date et mode de distribution. Examiner aussi les mises à jour OTA / branches / channels EAS effectivement publiés. Une configuration `eas.json` ne remplace pas cet inventaire.
2. **Google Play Console** : ouvrir l'application portant **exactement** le package `com.inkr.tattoo` ; relever les versions et audiences de production, tests ouverts, fermés et internes, y compris les pistes désactivées et l'historique des mises en production. Si aucune application n'existe, conserver une preuve de ce constat côté console.
3. **App Store Connect / TestFlight** : contrôler **exactement** `com.inkr.tattoo`, son historique d'App Store et ses builds TestFlight (groupes internes/externes, disponibilité, dates d'expiration). Si absent, consigner l'absence vérifiée.
4. **Distribution manuelle** : recenser tout APK/IPA, lien de build, QR code Expo Go, dossier partagé ou distribution externe. Identifier si une ancienne installation peut encore se connecter au Supabase actif. Les anciens fichiers signés ne disparaissent pas parce que le canal de distribution est fermé.
5. **Web** : vérifier quelle révision est servie sous les domaines de production et les règles SSO, sans y déployer. Contrôler les variables backend du déploiement réellement accessible. Les 3 erreurs `platform=web` ne sont pas un recensement des utilisateurs.
6. **Protocole de version minimale** : pour **chaque** version distribuée, tester réellement les parcours rendez-vous, références et photos sur une copie. Si un ancien client est incompatible, démontrer qu'il a été mis à jour **ou** qu'il est bloqué de manière explicite et sûre avant la migration restrictive. La simple valeur `1.0.0` côté JavaScript, partagée entre builds, n'est pas un identifiant de capacité fiable.


## Complément G0 : canaux privés et tentative Android sur poste autorisé

**Relevé du 15 novembre 2026, aucun identifiant ni secret conservé dans le dépôt.**

- **EAS CLI, relevé initial** : la première vérification `eas whoami` avait répondu `Not logged in`. Cette observation historique est **supplantée** par la vérification authentifiée décrite ci-dessous. Le `app.json` du dépôt ne portait pas `extra.eas.projectId` ; l'inventaire a été effectué depuis une configuration de travail isolée avec l'identifiant du projet existant, sans commit de liaison.
- **Consoles privées** : aucune session autorisée de Google Play Console ni App Store Connect/TestFlight disponible à cet outil. Les recherches publiques antérieures ne peuvent pas remplacer l'historique des pistes de test privées.
- **Fichiers locaux** : recherche de noms de fichiers APK/AAB/IPA dans `Downloads`, `Desktop` et `Documents`. Des APK d'un autre projet ont été identifiés, ainsi qu'une archive de sources INKR, mais **aucun paquet installable INKR vérifié dans ce périmètre**. Les autres disques, partages, installations antérieures et machines ne sont pas exclus.
- **Recette Android tentée, non réussie** : AVD `Medium_Phone_API_30` (Android 11/API 30, Play Store, x86) découvert sur Windows ; aucun appareil physique connecté à ADB. Démarrage de l'émulateur avec fenêtre, animations et snapshots désactivés, option `-memory 1024` ; l'émulateur a **relevé la RAM virtuelle à 2048 Mio** et ADB l'a brièvement vu en `device`, sans `sys.boot_completed=1` constaté ni INKR installé. La RAM Windows est descendue vers **0,5 Gio** ; l'émulateur a été arrêté par `adb emu kill`, puis ADB n'a plus listé de périphérique. À la fin de la tentative, environ **3,39 Gio** de RAM étaient libres.
- **Nettoyage sans fermeture d'applications** : libération non destructive de working sets de 14 processus en arrière-plan (OneDrive, Opera, Claude, Discord, lanceurs de jeux). Ce mécanisme ne supprime pas de données et la RAM ainsi récupérée peut être réutilisée immédiatement par les applications : ce n'est pas un gain durable garanti.

**Décision : G0 toujours NO-GO et recette Android non validée.** Ne pas interpréter `Not logged in` comme une absence de builds, ni l'émulateur `device` comme un test natif réussi. Pour poursuivre : (1) connexion du propriétaire à EAS, (2) historique des canaux Google/Apple ou confirmation documentée de leur absence, (3) inventaire APK manuels, (4) essai sur un téléphone Android relié par USB, ou sur une machine disposant d'assez de RAM pour démarrer Android, Metro et INKR simultanément.

## Vérification authentifiée EAS — 15 novembre 2026

**Projet vérifié** : `@puccicity/inkr`, identifiant EAS `9e39dea3-25eb-4ff6-9a34-01c410af785c`. Connexion locale confirmée par `eas whoami`. La liste suivante provient du **projet EAS existant**, et non d'une inférence à partir des profils `eas.json`. Aucune build, mise à jour OTA, soumission ou migration n'a été déclenchée.

### Historique des builds EAS

| Build ID (préfixe) | Date de création UTC | Plateforme | Distribution | Profil | État |
| --- | --- | --- | --- | --- | --- |
| `b3350edc` | 08/08/2026 | Android | INTERNAL | preview | FINISHED |
| `64623d5c` | 10/06/2026 | Android | INTERNAL | preview | FINISHED |
| `331ea7b9` | 10/06/2026 | Android | INTERNAL | preview | FINISHED |
| `c8a92f2f` | 10/06/2026 | Android | INTERNAL | preview | CANCELED |
| `874f22db` | 10/06/2026 | Android | INTERNAL | preview | CANCELED |
| `56ff1075` | 20/05/2026 | Android | INTERNAL | preview | FINISHED |
| `a2a5eb4d` | 20/05/2026 | Android | INTERNAL | preview | FINISHED |
| `eaccdc2e` | 20/05/2026 | Android | INTERNAL | preview | FINISHED |
| `e09d6916` | 20/05/2026 | Android | INTERNAL | preview | FINISHED |
| `07bdf0c3` | 17/05/2026 | Android | STORE | production | FINISHED |

**Bilan : 10 builds Android enregistrées, 8 terminées (7 INTERNAL et 1 STORE), 2 annulées ; aucune build iOS dans l'historique retourné.** Les 10 indiquent `appVersion=1.0.0` et `appBuildVersion=4`. Toutefois, des empreintes Git différentes ont été enregistrées, notamment `c6ff36a3` (08/08), `9a8ecb00` et `c97a8914` (10/06), `97dfdb78` et `91e9796e` (20/05), ainsi que `8491ac90` pour la build STORE du 17/05. Une politique de blocage uniquement fondée sur `1.0.0 (4)` **ne permet donc pas d'identifier la présence des nouvelles capacités RPC / Storage**.

### Historique de distribution et mises à jour

- `eas submit:list --platform all --json` : **0 soumission** trouvée. Cela ne prouve pas l'absence de dépôt manuel d'un AAB/IPA dans une console de store.
- `eas update:list --all --platform all --json` : **0 groupe de mises à jour OTA** dans la réponse (`currentPage=[]`).
- `eas channel:list --json` : **0 canal EAS Update** ; `eas branch:list --json` : **0 branche EAS Update**.
- La build `STORE` indique un **binaire destiné à un magasin**, et non une installation publique ou une publication effectivement approuvée. La build `INTERNAL` terminée indique un artefact potentiellement transmissible par lien, et non le nombre de téléchargements ou d'appareils encore actifs.
- Les historiques privés Google Play Console, TestFlight et les APK transmis manuellement restent non vérifiés. Les résultats publics App Store / Google Play et l'absence d'erreurs Android dans `client_errors` n'écartent aucune installation privée.

**Décision G0 : NO-GO confirmé avec une preuve positive d'anciens binaires Android.** Tant que le périmètre des installations n'est pas connu, ne pas activer les migrations restrictives `appointment_rpc_only`, les chemins privés de référence ni une désactivation de lecture publique sur la base des seules numérotations `1.0.0 (4)`. Vérifier la distribution réelle de chacun des binaires, tester la compatibilité des anciens parcours ou mettre en place un mécanisme de blocage / migration de clients qui ne dégrade pas la sécurité. G1–G5 et l'autorisation distincte de migration restent requis.

## Contrôle complémentaire des artefacts et de la télémétrie — 15 novembre 2026

**Recherche documentaire et requêtes authentifiées en lecture seule** :

- Sur les **10 builds Android** historiques, le champ Expo `appIdentifier` vaut **`com.inkr.tattoo`** pour chacune. Aucun paquet d'un autre projet ne figure dans ce lot.
- Toutes ont une `expirationDate` dépassée au 15/11/2026 : **22/08/2026** pour la dernière build INTERNAL du 08/08 ; **24/06/2026** pour les builds du 10/06 ; **03/06/2026** pour les INTERNAL du 20/05 ; et **16/06/2026** pour la build STORE du 17/05. Les deux builds annulées n'ont pas produit d'artefact installable. Une requête **GET avec Range: bytes=0-0** sur l'URL de la dernière build INTERNAL retourne **HTTP 404** ; pour la build STORE du 17/05, la réponse EAS consultée ne contient plus d'URL d'artefact. **Ces observations ne prouvent ni le nombre d'anciens téléchargements ni la disparition d'APK déjà installés ou copiés.**
- Les métriques `eas build:view` exposées sont `buildWaitTime`, `buildQueueTime`, `buildDuration` : ce sont des métriques de **compilation**, pas des compteurs d'appareils/installations.
- `eas observe:versions --project-id 9e39dea3-25eb-4ff6-9a34-01c410af785c --platform android --start 2026-05-01 --end 2026-11-15 --json` retourne **`[]`**. Le dépôt actuel ne dépend pas de `expo-observe` ; l'absence de données Observe n'est donc **pas** une preuve d'absence d'utilisation des anciens APK. Une installation sans instrumentation reste invisible à cette interrogation.
- Les commits Git annoncés par certaines builds historiques, dont `c6ff36a3`, `8491ac90`, `9a8ecb00`, ne sont pas résolus en objets commit/tree via l'API GitHub du dépôt courant (HTTP 422 sur demande d'arbre). On ne peut **pas** certifier le code exact embarqué dans ces binaires à partir des sources accessibles actuellement. Ne pas inférer que chaque ancienne build exécute exactement les routes de `main`.

### Critères de clôture restants

1. **Diffusion manuelle** : confirmer si les liens d'installation EAS ou les fichiers APK ont été transmis à des tiers, et si des copies ont été téléchargées sur des téléphones personnels. Cette information est **indisponible dans l'historique EAS Build** interrogé ; aucun « zéro installation » n'est démontré.
2. **Consoles propriétaires** : vérifier l'absence ou la présence de pistes Google Play Console (production, interne, fermée, ouverte) pour `com.inkr.tattoo`, et l'éventuel TestFlight / App Store Connect pour `com.inkr.tattoo`. **0 EAS Submit** n'exclut pas une mise en ligne manuelle.
3. **Appareils connus, avec consentement des détenteurs** : sur Android, `adb shell pm path com.inkr.tattoo` établit si le package est installé ; `adb shell dumpsys package com.inkr.tattoo` permet ensuite de vérifier `versionCode`. Ne collecter aucun identifiant personnel ni contenu de l'appareil. **Version 1.0.0 (4) commune** : cette observation ne suffit pas à identifier le commit et donc à prouver la compatibilité.
4. **Transition sans confiance dans le seul numéro de version** : pour une migration restrictive, garantir que les anciennes applications ne peuvent plus exercer les flux directs devenus incompatibles ; réaliser un test des anciens APK sur une copie/installation autorisée si disponibles, ou appliquer un mécanisme de mise à jour / exclusion fiable sans rouvrir les accès RLS privés. Ne pas déclarer G0 validé simplement parce que les URLs EAS expirent.

**Décision actualisée : G0 = NO-GO**, ancien parc inconnu malgré la confirmation de builds Android anciennes ; aucune mutation du Supabase actif, des comptes de store ou des builds EAS.

## Décision et autorisations

**NO-GO tant que les points 1–4 ne sont pas documentés** ; aucune absence de publication publique ne constitue à elle seule une levée du risque d'APK internes ou d'anciennes installations. Une fois G0 établi, G1–G4 (sauvegarde, migration sur copie, scénarios réels et rollback) restent obligatoires ; G5 exige ensuite une **autorisation explicite distincte** avant la moindre écriture sur `jxmefklkixzzdceeorcg`.

**État Android** : ne pas démarrer l'AVD avec ~0,5 Gio de RAM disponible ; préférer un appareil Android connecté, ou libérer les ressources du PC et recontrôler avant lancement. La recette iOS VoiceOver exige toujours un appareil Apple ; aucun essai natif n'est déclaré réussi par cet audit.

## Garde-fou documentaire de sortie — 16 novembre 2026

La PR contient désormais `scripts/check-release-evidence.cjs`, `docs/RELEASE_EVIDENCE.json` et des tests d'adversité `tests/release-evidence.test.cjs`.

Exécution locale depuis la racine du dépôt : `npm run release:check`. **Le code de sortie doit être non nul tant que G0–G5 sont HOLD.** Les tests du vérificateur s'exécutent automatiquement dans `npm test` ; ce n'est pas un workflow de déploiement et le contrôle documentaire n'empêche pas, à lui seul, un déploiement manuel via Vercel ou les consoles.

Ce contrôle est intentionnellement insuffisant pour autoriser un lancement : il vérifie uniquement la structure d'une décision et la présence de références de preuves, pas leur véracité ni les installations réelles. Un champ `GO` écrit dans un fichier ne démontre pas la compatibilité d'un ancien APK. L'inventaire EAS demeure positif pour dix builds historiques, et **G0 reste HOLD** jusqu'à revue des consoles privées, de la distribution manuelle et d'un traitement vérifié des anciens clients. Les opérations sur le projet Supabase actif restent interdites sans l'autorisation séparée G5.

Le contrôle `appVersion=1.0.0` ou `versionCode=4` est explicitement insuffisant pour reconnaître le binaire/la logique. La politique Expo `runtimeVersion: { policy: "appVersion" }` sépare les environnements natifs de mise à jour OTA, mais ne constitue ni une preuve de version applicative compatible ni un verrou d'accès du serveur. N'activer aucune migration restrictive uniquement sur cette base.
