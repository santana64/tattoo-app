# INKR — recette Android du 16 novembre 2026

## Périmètre testé

- Code fonctionnel : PR #3, commit `3928933`, branche `codex/inkr-v5-1-optional-deposits`.
- Preview Vercel : `tattoo-6j9e00siy-santana64s-projects.vercel.app`, connectée au Supabase **staging** `lsewxsdulunuuzmszegm`.
- Aucune modification de la base de production `jxmefklkixzzdceeorcg`, aucun merge dans `main`, aucune publication Play Store.
- Tests sur le PC autorisé `pucci`. Opera est resté ouvert et répondant.

## Vérifications réellement exécutées

| Scénario | Environnement | Résultat |
| --- | --- | --- |
| Démarrage et navigation du navigateur Android | AVD `INKR_Test_API_34`, Android 14, Chrome 113, 720 × 1600 | PASS |
| Accueil : découverte des publications de test | Android 14 / preview staging | PASS : artiste Mara Test et deux publications |
| Recherche d'artiste | Android 14 / preview staging | PASS : un artiste visible, chargement terminé |
| Profil de Mara Test | Android 14 / preview staging | PASS : ville, style, œuvres, tarif indicatif |
| « Demander un projet », visiteur déconnecté | Android 14 / preview staging | PASS : redirection vers `/sign-in?next=/request/new?artistId=...` |
| Formulaire de connexion vide | Android 14 / preview staging | PASS : erreurs e-mail et mot de passe affichées |
| Recherche SQL `search_artists` | Supabase staging | PASS : une ligne, exécution observée à environ 18 ms |
| Acomptes / sécurité de base | Tests locaux ciblés PGlite | PASS : 7 tests sur 7 après fusion V5 + V5.1 |
| TypeScript et ESLint | Branche intégrée locale | PASS |
| CI GitHub et previews Vercel | PR #3, commit `3928933` | PASS |

## Incompatibilité du navigateur ancien

L'AVD `INKR_Test_API_30` (Android 11, WebView Chromium 83) affichait `RECHERCHE…` indéfiniment. Son débogueur a signalé plusieurs `SyntaxError: Unexpected token '='` sur les scripts, sans même lancer les appels `search_artists`. Il s'agit d'un problème de compatibilité avec ce moteur de test obsolète, **pas d'une lenteur SQL démontrée**. Sur Android 14 / Chrome 113, la même recherche affiche son résultat.

L'émulateur Android 14 a d'abord rencontré un crash Vulkan avec l'ancien moteur d'émulation installé (33.1.24). Le redémarrage avec `-feature -Vulkan` a permis d'exécuter les scénarios ci-dessus. L'AVD Android 11 d'origine n'a pas été supprimé.

## APK natif : en cours, non certifié

Une build **interne** Android `preview` a été déclenchée sur le projet EAS existant `@puccicity/inkr` depuis la branche locale isolée `qa/inkr-v5-1-android14-apk` (commit de liaison de configuration `59e7c53`). Les deux variables publiques Supabase de l'environnement EAS **preview** ciblent le staging ; la configuration de production n'a pas été touchée.

Build EAS : https://expo.dev/accounts/puccicity/projects/inkr/builds/578577e4-6261-41a8-a472-e35d2f254ac4

**État lors du dernier relevé : `IN_QUEUE`.** Aucun APK de cette révision n'a encore été installé ni validé dans l'émulateur ; ne pas confondre les essais de la version **web dans Chrome Android** avec une recette de l'application **React Native native**.

## Critères non levés

- Inscription et authentification avec un compte de recette autorisé, récupération d'accès et sessions persistantes.
- Création/acceptation/annulation réelle des rendez-vous avec deux rôles connectés.
- Acompte manuel facultatif : parcours client-artiste réel, notifications, méthodes externes et interdictions d'accès.
- APK Android : installation, démarrage, permissions, lien profond et retour d'authentification. iOS non testé.
- Anciennes applications distribuées, restauration de sauvegarde, compatibilité, plan de retour arrière et approbation explicite : gates **G0–G5 en HOLD**.

**Verdict : GO pour poursuivre la recette sur staging ; HOLD pour la mise en production.**
