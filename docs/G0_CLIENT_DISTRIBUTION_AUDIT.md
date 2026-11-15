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

## Décision et autorisations

**NO-GO tant que les points 1–4 ne sont pas documentés** ; aucune absence de publication publique ne constitue à elle seule une levée du risque d'APK internes ou d'anciennes installations. Une fois G0 établi, G1–G4 (sauvegarde, migration sur copie, scénarios réels et rollback) restent obligatoires ; G5 exige ensuite une **autorisation explicite distincte** avant la moindre écriture sur `jxmefklkixzzdceeorcg`.

**État Android** : ne pas démarrer l'AVD avec ~0,5 Gio de RAM disponible ; préférer un appareil Android connecté, ou libérer les ressources du PC et recontrôler avant lancement. La recette iOS VoiceOver exige toujours un appareil Apple ; aucun essai natif n'est déclaré réussi par cet audit.
