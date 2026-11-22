# INKR PR #3 — G0 : inventaire officiel EAS Android et iOS (21/11/2026)

## Résultat
**PASS pour l'inventaire EAS des compilations accessibles ; G0 global HOLD** parce qu'un build en distribution STORE ne démontre pas son déploiement sur Play Console et qu'il manque le recensement des APK transmis directement à des utilisateurs.

## Interrogation officielle authentifiée
Depuis le compte Expo EAS existant `@puccicity/inkr` :
```powershell
eas build:list --platform android --limit 30 --json --non-interactive
eas build:list --platform ios --limit 30 --json --non-interactive
```
Les deux commandes ont renvoyé **exit 0**. Les listes intégrales JSON sont conservées **localement**, pas versées au dépôt.

### Android
**12 builds historiques** accessibles :
- **1 preview interne v5 FINISHED** (nouvel APK corrigé de PR #3, build `04ebbd5e-4cc0-4fd5-b4f4-5201e6dc78e6`).
- **1 preview interne v1 FINISHED** — ancien candidat non installable en mise à jour par-dessus v4.
- Plusieurs builds **v4** sous profil `preview`, dont plusieurs FINISHED et deux CANCELED.
- **Un build v4 sous profil `production` et `distribution=STORE`, FINISHED** : `07bdf0c3-58a0-4424-b64b-b179f17b99f6`. **ATTENTION : la compilation EAS « pour Store » ne démontre ni soumission ni disponibilité sur Google Play.**

### iOS
**0 build iOS EAS visible** au même moment sur ce projet EAS. **0 soumission EAS répertoriée** via `eas submit:list --platform all --limit 50 --json --non-interactive` (exit 0), sans exclure des soumissions manuelles directes. Ce n'est pas la preuve absolue qu'aucun build iOS n'a été distribué via d'autres outils ou comptes Apple.

## Compatibilité Android
- APK historique réellement téléchargé et inspecté : `versionCode 4`.
- APK EAS preview nouveau : `versionCode 5` avec **certificat de signature identique**, mise à jour réelle v4 → v5 réussie sans désinstaller ni changer l'UID Android, app lancée sur émulateur API 30.
- Scan du bytecode Hermes historique : anciens noms RPC v5 absents ; l'ancienne v4 peut être incompatible avec les politiques renforcées des rendez-vous. Elle doit être testée en **staging** avec une copie adéquate du backend, ou disposer d'une stratégie de mise à jour obligatoire, non dangereuse pour les accès privés.

## Pour G0 = GO
1. Consulter Google Play Console avec le compte du propriétaire pour vérifier l'état du build STORE, les pistes, signatures Play App Signing, installations et éventuels utilisateurs actifs.
2. Consulter App Store Connect / TestFlight et rechercher les distributions manuelles d'APK hors EAS.
3. Rejouer l'ancienne API/les anciens clients contre une **copie isolée** ou mettre en œuvre un mécanisme de transition sûre, sans rouvrir les droits SQL directs sur `appointments` ni les buckets privés.
4. Documenter les canaux de communication et la politique de mise à jour.

**G0 global HOLD. Pas de publication, pas de merge.**
