# INKR PR #3 — G0 : différentiel statique de l'APK historique v4 et du preview v5 (21 novembre 2026)

## Verdict
**Incompatibilité fonctionnelle potentielle de l'ancien client : non résolue. G0 global HOLD.** Ce contrôle analyse les vrais binaires Android, pas une conjecture à partir du code `main` actuel. Il **ne prouve pas que le client v4 exécute un chemin particulier**, ni à quel backend il se connecte.

## Artefacts vérifiés localement
- APK historique réel de `BOOK`, `versionCode=4` : SHA-256 `a2b04e1a2bfff6cf5385affa7765295ba19ad186196eea4594cbd71d9360ae2b`.
- APK preview EAS signé v5 : `versionCode=5`, SHA-256 `93485a89e996e4aecb873cb94a4bac5df437535b72c0a31554467dc1aa5d7aca`.
- Les deux ont le même certificat SHA-256 `6dc3710d2573857e5ec954d5e8fb0ff778b3b2e51035e2b39d2419f318ab3ecf`, test de mise à jour Android réel **v4→v5 PASS** sur émulateur Android 11 (preuve dans `docs/INKR_G0_ANDROID_V4_V5_UPGRADE_20261121.md`).
- Scan **en lecture seule** de toutes les entrées ZIP des deux APK (1 332 v4 / 1 656 v5) et de `assets/index.android.bundle` ; le fichier de bundle est du bytecode **Hermes**, non du code source JavaScript. Les chaînes littérales sont des indices, **pas un graphe d'appel complet**. Aucune extraction de clé secrète ni récupération de données personnelles.

## Chaînes présentes dans le bytecode Hermes

| Chaîne exacte | v4 historique | v5 preview |
|---|---|---|
| `appointments` | présente | présente |
| `request_references` | présente | présente |
| `request-references` | présente | présente |
| `propose_appointment` | **absente** | présente |
| `respond_to_appointment` | **absente** | présente |
| `cancel_appointment` | **absente** | présente |
| `complete_appointment` | **absente** | présente |
| `set_appointment_deposit_request` | **absente** | présente |
| `supabaseUrl` | présente | présente |
| Littéral `lsewxsdulunuuzmszegm` (staging) | absent | présent |
| Littéral `jxmefklkixzzdceeorcg` (production) | absent | absent |
| Sous-chaîne littérale `supabase.co` | absente | présente |

La recherche s'est limitée à la présence de chaînes littérales dans les ressources embarquées. L'absence de `supabase.co` dans la v4 **ne signifie ni absence de connexion Supabase, ni impossibilité de connexion à production** : la configuration peut être injectée ou reconstruite à l'exécution, chiffrée, référencée dans des ressources non textuelles ou encodée différemment.

## Conséquences pour la mise en production
- Le **nouveau** chemin de rendez-vous V5 dépend de RPC contrôlés, notamment `respond_to_appointment`.
- La migration SQL `20261114164541_appointment_rpc_only.sql` **révoque les écritures directes** sur `public.appointments` pour `authenticated` et supprime la policy `appointments_manage_artist`.
- Le code actuel de `main` examiné précédemment mettait à jour directement `appointments.status` ; **il n'est pas démontré que le binaire historique v4 est issu exactement de cette révision**. Cependant l'absence des noms de ces RPC dans l'APK historique rend une compatibilité universelle non justifiée.
- **Ne pas rétablir les UPDATE directs ou rendre les images privées publiques pour corriger les vieux clients** : cela dégraderait les protections V5 et irait à l'encontre de l'architecture à RPC contrôlés.
- La procédure G0 exige toujours l'inventaire des APK distribués (Google Play Console, distribution manuelle et App Store Connect), la détermination des installations encore actives et soit un test de compatibilité **sur staging**, soit une stratégie sûre et testée de désactivation/mise à jour avant restriction de l'API.

## Bilan
**PASS :** APK réels inspectés, signature égale, versionCode corrigé, mise à jour Android v4→v5 démontrée. **HOLD :** compatibilité **fonctionnelle** de v4 contre les changements PostgREST/RPC, backend effectivement ciblé par v4, distribution et mécanisme de transition des clients existants.

Aucun APK n'a été lancé vers Supabase production, aucune modification Supabase de production, aucun merge ni publication.
