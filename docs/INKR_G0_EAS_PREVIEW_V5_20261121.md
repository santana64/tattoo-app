# INKR G0 — correction du compteur EAS et build Android preview (21/11/2026)

**Verdict courant : G0 HOLD.** L'ancien APK v4 est vérifié, mais aucune preuve de mise à jour fonctionnelle sur appareil n'est acquise à ce stade.

## Autorisation et périmètre
Le propriétaire a explicitement autorisé le **21/11/2026** la correction du compteur de version EAS Android et le lancement d'un build **preview interne**, sans soumission aux stores ni publication en production. Aucune modification du projet Supabase actif ou staging n'a été nécessaire pour la correction du compteur.

## Version EAS : correction réellement exécutée
- Compte EAS authentifié : `puccicity` ; projet `@puccicity/inkr`, ID `9e39dea3-25eb-4ff6-9a34-01c410af785c`, Android `com.inkr.tattoo`.
- Ancien APK réel découvert sur `BOOK` : `versionCode=4`, certificat SHA-256 `6dc3710d2573857e5ec954d5e8fb0ff778b3b2e51035e2b39d2419f318ab3ecf`.
- Relecture EAS initiale : versionCode `1`. Modification autorisée par la mutation **officielle EAS CLI / Expo AppVersionMutation**, limitée au projet, package et plateforme précités, avec valeur exacte `5`. La commande interactive `eas build:version:set` a été tentée en premier mais n'acceptait pas stdin dans le canal distant ; aucune mutation par cette première commande.
- **Relecture indépendante après modification :** `eas build:version:get --platform android --profile preview --json --non-interactive` retourne `{"versionCode":"5"}`.
- Versionnement `cli.appVersionSource=remote` : la valeur locale `expo.android.versionCode=1` a été retirée de `app.json` pour ne pas présenter un numéro obsolète via `expo-constants`. Les champs stables `expo.owner=puccicity` et `expo.extra.eas.projectId` lient explicitement le projet EAS. **Aucune permission Android supplémentaire** n'a été ajoutée.
- Commit de configuration : `c0063c9999d80f2c1587fd30daeffad4cebb93d3`.

## Build EAS autorisé
- Build : `04ebbd5e-4cc0-4fd5-b4f4-5201e6dc78e6`
- Lien : https://expo.dev/accounts/puccicity/projects/inkr/builds/04ebbd5e-4cc0-4fd5-b4f4-5201e6dc78e6
- Plateforme : **Android**, profil **preview**, distribution **INTERNAL**, archive attendue **APK**, version distante **5** ; source `c0063c9`.
- Résultat de l'appel `eas build --platform android --profile preview --non-interactive --no-wait --json` : **exit 0**, ID EAS et `appBuildVersion=5` confirmés.
- EAS a sélectionné les **credentials Android distants déjà existants**. Le certificat **de l'APK de ce nouveau build** reste à vérifier après téléchargement.
- Les variables du profil `preview` contiennent la référence **Supabase staging** `lsewxsdulunuuzmszegm` ; la référence de production `jxmefklkixzzdceeorcg` est absente de cette configuration.
- **Statut au dernier relevé de cet audit : IN_PROGRESS**. Un build accepté n'est pas un APK signé et certifié.

## Contrôles non encore clos
1. Attendre la fin du build et lire l'artefact avec `aapt dump badging` : package attendu `com.inkr.tattoo`, `versionCode=5`.
2. `apksigner verify --print-certs` : le certificat doit correspondre à l'ancien APK `6dc3710d...318ab3ecf`.
3. Installer l'APK historique v4 dans un émulateur dédié / appareil de test ; procéder à l'installation du nouveau APK v5 **par-dessus** avec `adb install -r`, sans suppression de données ; vérifier l'installation, le package et le code de version.
4. Vérifier les parcours métier hérités (rendez-vous, références privées, images) sur staging avec anciens comptes autorisés, ou valider une procédure d'exclusion. Vérifier les audiences de distribution et Play Console/TestFlight.
5. G1 offsite, G2, G3, G4 et accord de mise en production G5 restent distincts.

**Aucune soumission aux stores, aucune promotion ni merge.** PR #3 toujours DRAFT et G0–G5 restent HOLD.
