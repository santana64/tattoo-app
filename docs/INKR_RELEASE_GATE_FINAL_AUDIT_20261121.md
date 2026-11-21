# INKR PR #3 — Audit consolidé et recommandation de release (21/11/2026)

## Décision de release
**NO-GO production / PR #3 conservée en DRAFT. Aucun merge, aucun déploiement production, aucun paiement Stripe LIVE.**

Un sous-test réussi ne valide pas à lui seul un gate global : aucun des six gates G0–G5 n'est intégralement démontré. Les résultats ont été reproduits sur les systèmes autorisés, avec preuves détaillées dans les rapports annexes.

| Gate | État | Preuves obtenues | Prérequis non démontrés |
|---|---|---|---|
| **G0** Anciens clients | HOLD | EAS Android **12** builds (dont v4 STORE destiné à publication), iOS EAS **0**, APK réel v4→v5 signé identiquement et mise à jour réussie | Play Console/App Store Connect, distribution manuelle et compatibilité fonctionnelle v4 |
| **G1** Sauvegardes | HOLD | Snapshot SQL du 17/11 restauré sur 2e machine et migrations rejouées ; **nouveau backup Storage 21/11** 3 objets / 399 767 octets restaurés localement **et sur BOOK après re-chiffrement portable AES-GCM** | Nouveau SQL, récupération OneDrive cloud indépendante, clé récupérable hors des deux PC |
| **G2** Recette utilisateur | HOLD | Vraie UI Web avec deux JWT GoTrue, onboarding, 3 images privées, demande, messagerie, RDV confirmé ; JWT tiers **16/16** sécurité ; 4/4 reconnexion Web ; **Stripe TEST paiement fictif → retour Web automatique → webhook Premium → refresh, annulation API et retour UI gratuit** | Reconnexion spécifique Premium après nouvel OTP, session native authentifiée et troisième rôle dans UI simultané |
| **G3** Natifs/accessibilité | HOLD | Sur `6ac997e`, **CI, Web, Android émulateur public, iOS simulateur** : 4/4 success | Connexion, images, réservation en Android et iOS, accessibilité multi-écran/lecteur d'écran |
| **G4** Rollback | HOLD | 12 migrations sur vrai snapshot 17/11, PostgreSQL transactionnel 36→38→36 tables, préservation des données et rollback | Plan réellement coordonné Auth/Storage/Edge/versions mobiles/Vercel en staging, export frais |
| **G5** Approbation | HOLD | Audit des preuves consolidé | G0–G4 complets puis autorisation humaine explicite de publication |

## Exécution et sécurité
- Le dernier flux QA navigateur a produit une demande marquée, trois JPEG neutres, deux messages, une proposition de rendez-vous **24/11/2026 14 h–16 h Paris**, confirmée par le client. Événement de test **sans rendez-vous réel**.
- **Nettoyage avéré** : le client a supprimé les trois objets privés via l'interface. La demande, ses deux messages et le rendez-vous QA ont été supprimés sur staging après contrôle strict du marqueur ; requête de vérification finale : 0 ligne/objet correspondant.
- Les deux sessions Web authentifiées ont survécu à la fermeture et au rétablissement du navigateur, puis au rechargement. Les secrets et cookies sont restés hors Git.
- Sur Stripe TEST, notre premier navigateur headless ouvrait Checkout mais n'affichait pas de formulaire exploitable, **sans paiement dans cette première campagne**. Une autre campagne indépendante sur la même preview a ensuite exécuté **un paiement carte fictive Stripe TEST, le retour HTTPS automatique, Premium activé via webhook et visible après reload, puis une annulation Stripe TEST avec retour backend à l'offre gratuite**. Une vérification UI ultérieure montre la formule gratuite actuelle, inchangée après reload. **La reconnexion Premium après un nouvel OTP reste non démontrée**, d'où le G2 global HOLD. Voir `INKR_G2_STRIPE_TEST_WEB_AUTORETURN_20261121.md`.
- L'audit peut être repris sur la branche **sans modifier le projet de production** `jxmefklkixzzdceeorcg`, hormis les lectures autorisées pour les sauvegardes Storage et l'inventaire.

## Décision
La release reste **bloquée par construction** : `npm run release:check` doit sortir avec code **1** tant que G0–G5 sont en HOLD. La PR #3 doit rester brouillon et non fusionnée. Aucune approbation G5 automatique ne peut remplacer les vérifications externes manquantes.
