# INKR PR #3 — audit G0 de signature Android et compteur EAS (21 novembre 2026)

## Verdict
**G0 = HOLD / NO-GO.** Un APK historique effectivement présent dans les téléchargements de `BOOK-OOU94V899O` porte `versionCode=4`. Un APK candidat staging EAS présent sur `PUCCI` porte `versionCode=1`. **Les certificats de signature correspondent exactement**, mais le candidat actuel ne constitue pas une mise à jour Android valide du binaire historique. Le compteur de version EAS distant est lui aussi à **1**.

Aucun APK n'a été installé, aucun émulateur n'a été lancé, aucune version distante EAS n'a été modifiée et aucune écriture n'a été effectuée sur Supabase production ou staging.

## Preuves techniques
| Source | Package | versionCode | Vérification de signature | SHA-256 de certificat |
|---|---|---:|---|---|
| APK historique récupéré sur BOOK (20 mai 2026, identifiant de build `e09d6916`) | `com.inkr.tattoo` | **4** | `apksigner verify --print-certs` : sortie 0 | `6dc3710d2573857e5ec954d5e8fb0ff778b3b2e51035e2b39d2419f318ab3ecf` |
| APK candidat staging `inkr-v5-1-staging-eas-578577e4.apk` | `com.inkr.tattoo` | **1** | `apksigner verify --print-certs` : sortie 0 | `6dc3710d2573857e5ec954d5e8fb0ff778b3b2e51035e2b39d2419f318ab3ecf` |

Empreinte SHA-256 du **fichier historique** (88 272 591 octets) : `a2b04e1a2bfff6cf5385affa7765295ba19ad186196eea4594cbd71d9360ae2b`.

Empreinte SHA-256 du **fichier candidat** (88 714 633 octets) : `9374f85121d17accf105696809de7a83fc94017508bae889327d7ee98a4375ec`.

L'APK historique a été transféré de BOOK vers PUCCI par un serveur LAN **temporaire, en lecture seule, limité à l'IP locale du destinataire et protégé par jeton éphémère**. La taille et le SHA-256 ont été comparés sur PUCCI avant l'inspection. Le serveur est arrêté et les deux copies du jeton ont été supprimées. L'APK historique reste en copie locale privée pour un test Android ultérieur.

Les deux APK ont été inspectés sur PUCCI avec le SDK Android Build Tools 36, `aapt dump badging` et `apksigner verify --print-certs`. Min SDK = 24, target SDK = 36 sur les deux. Un certificat identique ne garantit pas à lui seul la compatibilité des **parcours métier** entre les deux versions.

## EAS versionnement distant
- Session EAS authentifiée, compte `puccicity`.
- Projet existant `@puccicity/inkr`, identifiant `9e39dea3-25eb-4ff6-9a34-01c410af785c`.
- Le dépôt contient `eas.json` avec `cli.appVersionSource="remote"` et `build.production.autoIncrement=true`.
- Commande en **lecture seule** sur une copie de configuration isolée reliée à ce projet : `eas build:version:get --platform android --profile production --json --non-interactive` ; résultat réel `{"versionCode":"1"}`.
- L'application Git originale, le projet EAS distant et ses clés de signature n'ont pas été modifiés.

## Garde-fous réels exécutés
`scripts/ci/android-version-gate.cjs` confronté aux métadonnées effectivement lues (sans secrets) :
- mode `remote`, `versionCode=1` vs maximum historique `4` : **HOLD / exit code 1**.
- mode `apk`, candidat `versionCode=1` vs `4` : **HOLD / exit code 1**.
- mode `apk`, APK historique `versionCode=4` vs `4` : **HOLD / exit code 1**.

## Pour lever G0
1. Réconcilier de manière contrôlée le **compteur EAS distant**, pas seulement `app.json`, puis obtenir un **nouvel APK staging réellement signé et doté de `versionCode >= 5`**. Cette mutation EAS doit faire l'objet d'une autorisation spécifique et sa version doit être relue sur l'artefact produit. Ne pas modifier silencieusement le compteur dans cet audit.
2. Vérifier le certificat du nouvel APK : il doit égaler `6dc3710d...318ab3ecf` pour mise à jour sur le même package.
3. Installer **le binaire historique v4** sur un appareil Android de test ou émulateur disposant de RAM suffisante, puis tester **`adb install -r` du nouveau binaire signé**. Un simple test des métadonnées ou un build vert ne prouve pas une mise à jour réussie et la conservation des données.
4. Tester les parcours fonctionnels hérités (rendez-vous, références privées, photos privées) sur une copie de l'environnement. La même signature et une version supérieure ne prouvent pas la compatibilité RPC/API.
5. Identifier les destinataires des anciens APK et les pistes Play Console / TestFlight. En l'absence de preuve qu'aucun client v4 reste actif, il faut une stratégie explicite et testée de transition/blocage avant toute migration restrictive.

**Résultat actuel : signature historique établie et correspondante ; incompatibilité de versionnement certaine ; mise à niveau réelle et gestion des clients historiques non démontrées. G0 reste HOLD et la PR reste DRAFT.**
