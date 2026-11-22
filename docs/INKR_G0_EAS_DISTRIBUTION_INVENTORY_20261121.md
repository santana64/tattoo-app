# INKR PR #3 — G0 : inventaire des builds EAS et vérification de distribution (21 novembre 2026)

## Résultat exact
**Inventaire du projet EAS authentifié effectué : PASS. Inventaire exhaustif des utilisateurs et canaux de distribution : HOLD.** Projet `@puccicity/inkr` ; package Android `com.inkr.tattoo`.

L'outil EAS a été interrogé avec les commandes en lecture seule `eas build:list --platform android --limit 50 --json --non-interactive`, `eas build:list --platform ios --limit 50 --json --non-interactive` et `eas submit:list --platform all --limit 50 --json --non-interactive`.

| Type | Version Android | État | Nombre |
|---|---:|---|---:|
| Build interne | 4 | FINISHED | 7 |
| Build interne | 4 | CANCELED | 2 |
| Build interne | 1 | FINISHED | 1 |
| Build destiné au Store | 4 | FINISHED | **1** |
| Nouveau preview interne | 5 | FINISHED | 1 |
| **Total Android** | | | **12** |

- **Builds EAS iOS enregistrés : 0** au moment du contrôle.
- **Soumissions EAS enregistrées (Android + iOS) : 0**, réponse `[]`.
- Cette absence de soumission EAS **n'exclut pas** un téléversement manuel sur Google Play, TestFlight/App Store Connect ou la circulation d'APK indépendamment d'EAS.
- Le build Android `versionCode=4` avec `distribution=STORE` existe réellement dans l'historique : cela ne constitue pas en soi une preuve de publication.
- Le certificat et `versionCode=5` de la preview ainsi que l'installation native v4 → v5 sans désinstallation ont été démontrés séparément, cf. `docs/INKR_G0_ANDROID_V4_V5_UPGRADE_20261121.md`.
- La v4 historique ne contient pas les noms des nouveaux RPC `propose_appointment`, `respond_to_appointment`, `cancel_appointment`, `complete_appointment`, `set_appointment_deposit_request`, cf. `docs/INKR_G0_LEGACY_APK_HERMES_DIFFERENTIAL_20261121.md`.

## Prérequis indispensables à G0 = GO
1. Contrôler depuis **Google Play Console** les versions / tracks réellement publiés, appareils actifs et signatures reconnues, et depuis **App Store Connect/TestFlight** toute distribution iOS.
2. Inventorier les APK fournis manuellement et les anciennes installations ; documenter la version minimale réellement prise en charge et la procédure d'information/mise à jour.
3. Tester sur **staging** les véritables anciens parcours client/artiste avec le client v4 et les nouvelles migrations API, **sans pointer l'APK historique vers la production**. S'il n'est pas compatible, préparer un mécanisme de transition sûr qui n'ouvre pas les RLS ni les UPDATE directs.
4. Tester le cas d'un client v4 qui reste installé au moment d'une migration restrictive.

**G0 global HOLD.** Aucune publication n'a été réalisée, aucune modification de production n'a été appliquée et la PR #3 reste DRAFT.
