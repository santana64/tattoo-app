# INKR PR #3 — G0 : APK v5 EAS signé et mise à jour réelle v4 → v5 (21/11/2026)

## Verdict
**PASS pour la compatibilité de signature, de numéro de version et pour la mise à jour Android sur émulateur dédié. G0 global reste HOLD.** La compatibilité fonctionnelle de tous les anciens clients avec les migrations restrictives et l'inventaire de la distribution ne sont pas démontrés.

Le propriétaire a précédemment autorisé la modification du compteur EAS Android et le build preview interne. Les essais ci-dessous ont eu lieu **sur un émulateur Android de test dédié**, pas sur le téléphone de l'utilisateur ni sur un environnement de production.

## Build EAS réel
- Projet EAS : `@puccicity/inkr`, projet ID `9e39dea3-25eb-4ff6-9a34-01c410af785c`.
- Build approuvé : `04ebbd5e-4cc0-4fd5-b4f4-5201e6dc78e6`, statut **FINISHED**, profil `preview`, distribution `INTERNAL`, Git source `c0063c9999d80f2c1587fd30daeffad4cebb93d3`, `versionCode=5`.
- EAS : https://expo.dev/accounts/puccicity/projects/inkr/builds/04ebbd5e-4cc0-4fd5-b4f4-5201e6dc78e6
- L'APK exact a été téléchargé sur `pucci` et contrôlé par `aapt dump badging` et `apksigner verify --print-certs`, **codes de retour 0**.
- Package : `com.inkr.tattoo` ; `versionCode=5`.
- Certificat SHA-256 du signataire : **`6dc3710d2573857e5ec954d5e8fb0ff778b3b2e51035e2b39d2419f318ab3ecf`** — identique à l'ancien APK historique v4 trouvé sur `BOOK`.
- APK v5 : **88 714 273 octets**, SHA-256 **`93485a89e996e4aecb873cb94a4bac5df437535b72c0a31554467dc1aa5d7aca`**.
- APK historique v4 : SHA-256 `a2b04e1a2bfff6cf5385affa7765295ba19ad186196eea4594cbd71d9360ae2b`, `versionCode=4`.

## Mise à jour réellement exécutée — environnement isolé Android
- Hôte : `pucci`; AVD dédié : `INKR_Test_API_30` (Android 11 / API 30, Google Play, ABI x86, Android Emulator 33.1.24), démarré avec `-no-window -no-audio -no-boot-anim -no-snapshot -gpu swiftshader_indirect`.
- Boot Android : `sys.boot_completed=1` et `dev.bootcomplete=1`; ADB : `emulator-5554 device`.
- Avant installation : `adb shell pm path com.inkr.tattoo` absent.
- Installation du vrai **APK historique v4** : `dumpsys package` donne `versionCode=4`, **UID Android `10154`**, `firstInstallTime=2026-11-21 18:27:26`. La commande PC `adb install` était bloquée au retour après l'inscription du package ; seul son client ADB a été fermé une fois la version v4 et l'UID contrôlés.
- Copie du vrai APK v5 : `adb push ... /data/local/tmp/inkr-upgrade-v5.apk` → **1 fichier transféré, exit 0**.
- Mise à jour **sans suppression préalable** : `adb shell pm install -r /data/local/tmp/inkr-upgrade-v5.apk` → réponse Android **`Success`**, code de sortie **0**.
- Vérification après mise à jour : `dumpsys package` → **`versionCode=5`**, **UID conservé `10154`**, **date de première installation inchangée `2026-11-21 18:27:26`**, `lastUpdateTime=2026-11-21 18:31:14`.
- **Démarrage natif** : `adb shell monkey -p com.inkr.tattoo -c android.intent.category.LAUNCHER 1` → 1 événement injecté, **exit 0** ; processus Android `com.inkr.tattoo` actif, `MainActivity` visible / fenêtre focalisée. `logcat` après le démarrage : **0 FATAL EXCEPTION** correspondant aux motifs de crash vérifiés. Une capture locale du flux public a été prise et visualisée sur l'émulateur : en-tête INKR, navigation native, contenu visible du flux de staging. La capture n'est **pas** versée au dépôt.

Cette mise à jour conserve le package et son UID, preuve d'absence de désinstallation. **Limite importante : les données privées internes de l'application n'ont pas été lues ni comparées octet par octet** (APK non débogable ; Android restreint l'accès au stockage externe d'autres applications). Ne pas prétendre que tous les paramètres/comptes sont inchangés ou que les anciens parcours API sont compatibles.

## Blocages encore présents avant G0=GO
1. Auditer les distributions manuelles d'APK, les pistes Google Play Console et TestFlight/App Store Connect, et les anciennes installations actives.
2. Tester avec comptes réels consentants sur une **copie/staging** les anciens parcours client et artiste : rendez-vous RPC, références privées, images, bascule de permissions ; vérifier soit une compatibilité rétroactive, soit un mécanisme explicite d'exclusion sûre avant migrations restrictives.
3. Les contrôles Auth/RLS des rôles authentifiés, les scénarios de paiement et retour Premium, l'accessibilité complète, les procédures de restauration hors site et rollback, ainsi que l'accord de production restent couverts séparément par G1–G5.
4. L'installation v4→v5 est prouvée sur **Android 11/API 30 uniquement**. Elle ne certifie pas automatiquement tous les appareils et versions Android.

**Conséquence : sous-contrôles signature + version + mise à jour et démarrage = PASS ; G0 global HOLD, G1–G5 HOLD, PR #3 DRAFT ; aucune publication ou modification de Supabase production.**
