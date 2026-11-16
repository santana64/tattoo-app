# INKR V5.1 — audit ciblé G0–G2 et recette du 16 novembre 2026

**Verdict : GO pour la poursuite de la recette, HOLD pour la production.**
Travail effectué sur la branche de validation de la PR #3, sur une base PostgreSQL embarquée (PGlite) et en lecture seule sur les deux projets Supabase. Aucune migration appliquée à `jxmefklkixzzdceeorcg`.

## 1. Versions Android précédemment compilées — G0

Inventaire **authentifié** dans le projet Expo EAS `@puccicity/inkr` :

- **10 builds Android historiques** : huit terminées, deux annulées ; une build historique de type `STORE`. Toutes annoncent `appVersion=1.0.0` et **`appBuildVersion=4`**.
- La nouvelle build de recette [`578577e4-6261-41a8-a472-e35d2f254ac4`](https://expo.dev/accounts/puccicity/projects/inkr/builds/578577e4-6261-41a8-a472-e35d2f254ac4) est `FINISHED` et annonce **`versionCode=1`**, malgré les builds historiques en `4`.
- La build historique du 8 août `b3350edc-3cbf-42c1-adb9-2d347e187b4e` a bien été retrouvée dans EAS avec `versionCode=4` et Git SHA `c6ff36a3729e2a56229fda52f4e0f330ddd880a9`. **Son artefact renvoie HTTP 404** lors du téléchargement. Ce SHA n'est pas résolvable dans l'historique GitHub de ce dépôt. Impossible de comparer ses signatures ou d'en tester les écrans réels.
- Dans le dépôt `main`, `app/appointment/[id].tsx` effectuait une modification directe `.from('appointments').update({status:'confirmed'})` (ligne 245 lors du relevé). Sur le staging V5, les rôles `authenticated` n'ont **plus** de droits d'INSERT/UPDATE/DELETE sur `appointments` : cette ancienne écriture échouerait. Cela est attesté pour le code de `main`, **pas** pour chaque APK historique dont le binaire manque.
- Un ancien client peut aussi considérer `request_references.url` comme une URL publique alors que la V5 demande des références privées et des URL signées. Ne pas rendre le bucket public pour restaurer l'ancien comportement.

**Mesure mise en place :** le contrôleur `scripts/check-release-evidence.cjs` bloque la validation documentaire G0 si le `versionCode` vérifié du candidat n'est pas strictement supérieur à `4`. Pour la voie de compatibilité avec les anciens clients, il exige en plus une preuve de signature Android compatible. Les tests correspondants ont été ajoutés. `docs/RELEASE_EVIDENCE.json` reste explicitement en HOLD, avec `candidate_android_version_code=1`.

**Pour lever G0 :** inventorier Google Play Console, App Store Connect et les APK transmis manuellement ; déterminer lesquels sont encore susceptibles de se connecter ; récupérer une ancienne version installable/une signature fiable ; tester sur une **copie** la compatibilité ou l'exclusion sécurisée des anciens clients ; puis seulement synchroniser la numérotation EAS distante pour que la prochaine build candidate soit au moins `5`. La variable `android.versionCode` dans `app.json` ne suffit pas lorsque `appVersionSource=remote`.

## 2. Comparaison de schémas et migrations — G1

Deux vérifications **SQL en lecture seule** ont confirmé :

| Vérification | Production `jxmefklkixzzdceeorcg` | Staging `lsewxsdulunuuzmszegm` |
| --- | --- | --- |
| Rendez-vous | **2** lignes `proposed` | **1** ligne `confirmed` |
| `appointments` : RLS | Activé | Activé |
| `appointments` : INSERT/UPDATE/DELETE accordés à `authenticated` | **Oui / Oui / Oui** | **Non / Non / Non** |
| `appointment_deposit_requests` | Table absente | Table présente, RLS activé |
| `appointment_deposit_requests` : lecture authentifiée | Sans objet | Accordée aux participants par policy RLS |
| `appointment_deposit_requests` : écriture directe | Sans objet | Refusée ; RPC contrôlés |
| Migrations Supabase | Historique ancien `001` à `009` | Migrations additionnelles V5.1 (acompte, notifications, suspension, index) appliquées |

Le schéma `appointments` a conservé, pour les colonnes consultées, la même structure et nullabilité dans les deux projets. La différence principale identifiée à ce stade est **l'autorisation de muter les rendez-vous**, pas la suppression de leurs champs.

Le test `tests/appointment-migration-upgrade.test.cjs` reconstitue en **PGlite** deux rendez-vous existants au statut `proposed`, exécute le verrouillage restrictif, puis prouve que :

1. Les deux enregistrements et leurs références restent identiques.
2. Les anciennes modifications directes deviennent interdites.
3. Le client peut confirmer une proposition avec `respond_to_appointment`, sans effacer la seconde proposition.

**Limite :** PGlite exécute le SQL PostgreSQL pertinent sur des données de synthèse, pas une restauration fidèle de la production avec ses extensions, données, objets Storage, contraintes d'infrastructure et identités. **Une sauvegarde/restauration de la production dans un environnement isolé et un essai de migrations sur cette copie restent nécessaires pour G1/G4.** Ne pas déduire un GO d'un test synthétique.

## 3. Parcours client → tatoueur et acomptes — G2

Le nouveau test `tests/booking-deposit-lifecycle.test.cjs` rejoue les migrations locales sur PGlite puis simule le parcours multi-rôles suivant :

1. Un client crée une demande ; un tiers ne peut pas l'accepter.
2. L'artiste accepte, propose une séance future ; seul le client peut confirmer.
3. Le client ne peut pas créer ou clôturer l'acompte de son propre rendez-vous.
4. L'artiste crée un acompte **manuel**, puis rejoue la même demande sans notification dupliquée.
5. L'artiste remplace par un **lien externe autorisé** ; le client voit l'acompte, le tiers ne lit aucune ligne.
6. L'artiste déclare la réception ; un deuxième appel est idempotent ; la demande finalisée ne peut plus être modifiée.
7. Les notifications ne contiennent pas le lien de paiement.
8. Sur une autre séance confirmée, le client annule une demande d'acompte encore ouverte ; le statut devient `cancelled` et l'URL externe est effacée.

Test exécuté le 16 novembre 2026 : **PASS**. Le test de migration des deux propositions et les tests du garde-fou G0 sont également **PASS (11/11 ciblés)**.

**Limite :** il s'agit d'une intégration au niveau de la base et des rôles simulés. La session d'authentification réelle sur le site/app, la récupération de mot de passe, les notifications push, les pièces jointes privées, les liens profonds et le retour du site de paiement restent des recettes distinctes. Aucun paiement bancaire réel n'a été réalisé ni simulé par cette nouvelle recette.

## Séquence de lancement recommandée

1. Résoudre G0 : historique de distribution, signature, numérotation EAS, stratégie de bascule sans réintroduire de droits SQL directs.
2. Produire une **copie isolée et vérifiée** des données/schéma de production ; exécuter et contrôler la migration, y compris les **deux** propositions existantes ; tester une restauration complète.
3. Exécuter la recette à deux sessions authentifiées sur staging (client, tatoueur, tiers), dont refus de lecture, demandes d'acompte, annulation et notification.
4. Terminer les validations native Android/iOS, panne réseau, accessibilité, retour de paiement, puis G3/G4.
5. Revoir les preuves et obtenir une approbation de publication **distincte** (G5). Sans cela, aucun merge ni mutation de la production.

**État documentaire : tous les gates G0–G5 demeurent HOLD.**
