# INKR — contre-audit des parcours Web réels et de la reprise (21/11/2026)

## Périmètre et décision

- Branche : `codex/inkr-v5-1-optional-deposits`, commit applicatif vérifié `6ac997eb57c32f4d08f7da03e5f8bf6d464249c9`.
- GitHub Actions : CI, Web Browser Staging QA, Android Emulator Staging Public UI, iOS Simulator Staging Smoke : quatre exécutions `success` sur ce commit.
- Déploiement Vercel de la preview correspondant au SHA : `READY`.
- Supabase staging : `lsewxsdulunuuzmszegm`. Production : `jxmefklkixzzdceeorcg` **non modifiée**.
- La PR #3 reste **DRAFT**. `G0–G5 = HOLD`. Ce rapport n'autorise ni merge, ni migration production, ni paiement LIVE, ni soumission aux stores.

## Relecture indépendante des rapports QA locaux

Les fichiers ci-dessous ont été relus sur `pucci` dans le répertoire privé `%LOCALAPPDATA%\INKR-QA\clone`. L'agrégateur local `Review-INKR-E2E-QA-PrivateResults-20261121.cjs` a été exécuté après inspection de son code ; il rapporte **`ALL_LOCAL_GROUNDED_SUBTESTS=true`** et exit 0. Aucun jeton, URL signée, secret, e-mail de recette, capture privée ni fichier image n'a été versé au dépôt.

| Domaine | Rapport local (suffixe `-20261121.json`) | Résultat |
| --- | --- | --- |
| Navigation publique | `inkr-web-preview6ac997e-public` | PASS, 6/6 |
| Magic link / session artiste | `inkr-artist-web-auth-callback` | PASS, 4/4 |
| Magic link / session client | `inkr-client-web-auth-callback` | PASS, 4/4 |
| Onboarding artiste et inbox | `inkr-artist-web-onboarding` | PASS, 8/8 |
| Onboarding client et projets | `inkr-client-web-onboarding` | PASS, 5/5 |
| Création demande + trois images privées | `inkr-client-ui-3-private-references` | PASS, 8/8 |
| Lecture des trois références, acceptation artiste | `inkr-artist-ui-private-refs-and-accept` | PASS, 5/5 |
| Message artiste depuis vraie UI | `inkr-artist-web-message` | PASS, 3/3 |
| Message client depuis vraie UI | `inkr-client-web-message` | PASS, 4/4 |
| Proposition de créneau artiste | `inkr-artist-web-propose-appointment` | PASS, 5/5 |
| Confirmation de rendez-vous client | `inkr-client-appointment-confirmed` | PASS, 3/3 |
| Sessions conservées (réouverture / reload) | `inkr-web-client-artist-reconnection` | PASS, 4/4 |
| Nettoyage des trois références QA | `inkr-private-three-images-cleanup` | PASS, 3 éléments retirés |
| Ouverture Stripe Checkout TEST depuis UI artiste | `inkr-artist-web-stripe-checkout` | PASS, 6 assertions |

Les réussites sont des **rapports d'exécution de recette**, pas la preuve que toutes les combinaisons navigateur/appareil, les conditions d'erreur ou les scénarios adversariaux sont testés. Le rapport `inkr-client-web-message` emploie un libellé interne de statut « ARTIST » malgré ses assertions `client_*` ; cela constitue une ambiguïté de nomenclature QA, non une preuve d'échec de l'envoi.

## Recoupement avec les services connectés

- Lecture directe de Supabase staging : 1 rendez-vous `confirmed` ; 1 demande `confirmed`, 8 demandes `submitted` ; 0 acompte facultatif en table ; 2 abonnements `normal:canceled` au moment du contrôle. Ces états peuvent changer après la recette.
- Stripe, compte **« environnement de test inkr »**, `livemode=false` : 12 sessions Checkout retournées, dont 4 au statut `complete/paid`; 5 abonnements historiques retournés avec `status=canceled` en demandant explicitement `status=all`. L'autre compte « inkr » en mode TEST renvoie 0 session et 0 abonnement dans ce contrôle.
- La session payée du 21/11/2026 à 19:39 UTC possède `success_url` et `cancel_url` HTTPS ciblant `/settings/subscription` sur la preview attendue.
- Le rapport `premium-test-activation-ui-20261121.json` atteste 7 étapes PASS pour Premium visible après webhook et rechargement **lors d'une recette distincte**. Cependant `g2-actual-web-stripe-20261121.json` a terminé `HOLD` à cause du second lien OTP manquant : ne pas prétendre que la séquence **unique et complète** Checkout → retour automatique navigué → Premium → reconnexion réelle → annulation a passé.
- Les enregistrements Stripe et les rapports UI ne constituent pas à eux seuls un enregistrement de navigation automatique du navigateur à l'URL de succès.
- G1 : rapport sur `BOOK`, `second-host-fresh-storage-restore-20261121.json`, **PASS**, archive Storage du 21/11 déchiffrée et 3 objets / 399 767 octets restaurés sur un deuxième ordinateur, fichiers clairs temporaires supprimés. SQL indépendant restauré depuis le snapshot **du 17/11** seulement. Lecture indépendante **depuis le cloud OneDrive non prouvée**.

## Sous-gates confirmés mais insuffisants

- **G0 / Android** : APK v4 historique et v5 EAS signés par le même certificat ; `versionCode 4 → 5`, `pm install -r` = `Success`, UID et premier horodatage d'installation conservés, démarrage Android 11 sans FATAL EXCEPTION. **HOLD** : parc réellement distribué et compatibilité métier des appels de la v4 face aux RPC restrictives non démontrés.
- **G1 / sauvegardes** : second ordinateur et Storage récent vérifiés ; **HOLD** : SQL récent + copie hors site récupérée depuis le cloud + secrets indépendants + essai de récupération globale.
- **G2 / parcours Web** : client/artiste réels, demande, images, messagerie et rendez-vous confirmés ; troisième JWT externe testé en API seulement. **HOLD** : UI tiers adversarial, cycle Stripe complet dans une seule exécution, parcours d'acompte facultatif en UI et clients natifs authentifiés.
- **G3 / qualité** : quatre pipelines verts, mais `g3-web-keyboard-smoke-20261121.json` est **HOLD** à l'attente d'une navigation `/legal/terms`; pas de certification WCAG ni d'ensemble d'appareils physiques.
- **G4 / retour arrière** : 12 migrations rejouées puis rollback SQL transactionnel sur dump du 17/11, préservation des comptes et empreintes ; **HOLD** pour restauration coordonnée d'une vraie release Supabase.
- **G5 / gouvernance** : aucune autorisation de mise en production.

## Ordre de clôture recommandé

1. Finir et enregistrer **une recette Stripe TEST non fragmentée** sur preview à SHA figé : clic UI, paiement sandbox, navigation réellement observée, webhook, Premium après nouvelle connexion, annulation et retour au plan gratuit.
2. Tester l'UI avec trois identités et les images privées sur Web + clients natifs ; exercer le cycle des acomptes externes sur le rendez-vous QA **sans encaissement INKR**.
3. Constituer le backup **SQL actuel** et les objets Storage, vérifier téléchargement depuis un emplacement cloud hors site et restauration indépendante ; éprouver une restauration sur clone.
4. Inventorier les anciennes versions distribuées et tester un client v4 contre le contrat staging post-migrations, sans réouvrir les permissions directes d'écriture.
5. Terminer accessibilité/clavier, appareils réels, mode offline, gestion du temps et rollback multi-services.
6. Obtenir l'approbation spécifique du propriétaire pour chaque opération de production ; laisser `docs/RELEASE_EVIDENCE.json` en `HOLD` tant que les preuves manquent.

**Conclusion : progression Web authentifiée et reprise Storage confirmées, mais INKR n'est pas encore certifiable pour une publication.**
