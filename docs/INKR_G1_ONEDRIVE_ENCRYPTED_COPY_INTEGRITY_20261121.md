# INKR PR #3 — G1 : intégrité des archives chiffrées OneDrive et seconde machine (21 novembre 2026)

## Résultat
**PASS pour l'intégrité chiffrée sur deux supports locaux distincts et dans le dossier OneDrive de l'utilisateur. G1 global HOLD**, car l'existence d'une copie **réellement distante et relisible par API cloud indépendante** n'est pas démontrée et le snapshot date du 17 novembre 2026.

## Supports et vérifications
- Hôte source `PUCCI` : dossier configuré `%USERPROFILE%\OneDrive\Documents\INKR-Recovery\20261121`. Deux archives chiffrées `.inkrbak` sont présentes, sous forme de fichiers OneDrive avec l'attribut `ReparsePoint`. Le compte OneDrive **Personal** est enregistré dans Windows. Le client OneDrive ne tournait pas initialement ; il a été relancé en arrière-plan normalement, puis son processus actif vérifié.
- **Lecture complète et SHA-256** depuis le dossier OneDrive de PUCCI, même si le client était arrêté : les deux empreintes comparées à la référence sont **PASS**.
- Hôte indépendant `BOOK-OOU94V899O` : archives chiffrées `%LOCALAPPDATA%\INKR-QA\isolated-recovery\20261121\encrypted`, SHA-256 **PASS** sur les mêmes fichiers. Il ne s'agit pas d'une troisième localisation hors site : `BOOK` et `PUCCI` étaient sur le même réseau local pendant les transferts.
- Les restaurations du 21/11 sur BOOK ont déjà prouvé le déchiffrement autonome, la restauration SQL dans PostgreSQL local et la restauration des 3 véritables objets Storage ; voir `docs/INKR_G1_SECOND_HOST_RESTORE_20261121.md`.

| Archive chiffrée | Octets | SHA-256 attendu et vérifié sur OneDrive local + BOOK |
|---|---:|---|
| `inkr-sql-20261117.inkrbak` | 566 207 | `c38d6e3106b8facee6585b516c9d906924abd67da849cecdc545c42a47ad1889` |
| `inkr-storage-20261117.inkrbak` | 380 608 | `356b2872d1e5a66e93d23bae1394817a621b0ef36a99bbb35b8ac3aa364a9e14` |

Le script de contrôle reproductible `scripts/qa/check-encrypted-inkr-recovery-copies.ps1` ne lit que les octets chiffrés et ne requiert aucune clé DPAPI, aucun secret Supabase ni aucun service réseau.

## Limites explicites
1. **Un dossier local OneDrive synchronisé n'est pas une preuve de présence effective sur le cloud OneDrive.** L'attribut `ReparsePoint`, la présence d'un compte et l'exécution du client ne prouvent pas que ces versions ont été téléversées ni qu'elles restent récupérables après perte des deux machines. Il manque une **lecture depuis l'API OneDrive ou l'interface Web sur une session indépendante**, puis un recalcul SHA-256 sur le fichier redescendu.
2. Les archives sont des captures du **17 novembre 2026**, donc obsolètes pour un cutover ultérieur. Un backup différentiel/frais, chiffré et prouvé hors site devra être effectué avant toute production.
3. La clé de déchiffrement protégée par Windows DPAPI sur BOOK atteste un test de déchiffrement pour cet utilisateur Windows, mais elle doit être conservée **séparément** du cloud chiffré avec une procédure documentée de récupération indépendante d'une perte de cette session Windows.
4. Ce contrôle ne revalide pas les changements intervenus depuis le dernier snapshot et ne couvre pas la restauration intégrale d'un projet Supabase hébergé dans un nouveau projet.

**Verdict : intégrité locale OneDrive et seconde machine = PASS ; cloud readback, fraîcheur, indépendance des secrets et restauration hébergée = non démontrés. G1 HOLD. Aucune modification du projet Supabase production, aucun merge ni publication.**
