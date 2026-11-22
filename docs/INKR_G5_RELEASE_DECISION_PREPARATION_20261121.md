# INKR PR #3 — G5 : dossier de décision de mise en production (21 novembre 2026)

## Décision actuelle : NO-GO / HOLD
Le responsable n'a **pas fourni de validation finale G5**, et les critères techniques G0–G4 ne sont pas tous remplis. Ce document constitue un **dossier de décision préparatoire**, pas une approbation ni un consentement au déploiement.

## Résultats vérifiés
- **GitHub** : PR #3 toujours DRAFT ; 4/4 workflows du commit `6ac997e` sont réussis (CI, Web, Android staging, iOS staging).
- **Android** : le nouvel APK v5 est signé avec le certificat de l'ancien APK v4 et se met effectivement à jour v4 → v5 en conservant l'UID, avec démarrage natif validé sous Android 11/API30.
- **Supabase staging** : 33/33 assertions backend JWT client/artiste ; 16/16 assertions JWT réel tiers, dont RLS, refus de signed URL pour objet privé réel, refus de téléchargement et RPC admin.
- **Stripe TEST** : vrai clic UI Web dans la preview Vercel, sandbox indépendant confirmé, paiement carte fictive, retour HTTPS automatique, Premium après webhook et reload, abonnement fictif annulé et compte revenu à l'offre normale via webhook. Le second OTP manquant a empêché de prouver la reconnexion et le contrôle UI gratuit final.
- **Sauvegarde SQL historique** : migrations V5/V5.1 sur snapshot réel 17/11 avec rollback transactionnel local, invariants vérifiés.
- **Sauvegarde Storage fraîche** : 21/11, trois fichiers restaurés localement puis sur BOOK depuis AES-GCM, empreintes et contenu contrôlés.

## Critères bloquants
| Gate | Preuve manquante | Statut |
|---|---|---|
| G0 | Google Play Console/App Store Connect, distribution d'APK manuelle, compatibilité du véritable client v4 avec les nouvelles permissions/RPC, transition sûre des anciennes versions | HOLD |
| G1 | Sauvegarde SQL récente et restaurée ; récupération depuis **le cloud** indépendante des deux ordinateurs ; coffre-fort de clé hors site ; restauration hébergée | HOLD |
| G2 | Parcours UI Web et natif client/artiste/tiers avec 3 références privées, suppression/expiration ; reconnexion Premium et UI gratuite après annulation ; retours de session multi-appareils | HOLD |
| G3 | Bilan complet d'accessibilité (images sans texte de remplacement, contrôle clavier/screen reader), appareils physiques non disponibles, éventuels écarts Android/iOS | HOLD |
| G4 | Rollback coordonné DB + Auth + Storage + Edge + Web sur clone hébergé, à partir d'un backup frais | HOLD |
| G5 | Validation indépendante du dossier complet et **approbation explicite du responsable avec référence d'autorisation** | HOLD |

## Préconditions de décision GO, non remplies aujourd'hui
- Toutes les preuves G0–G4 requalifiées de manière vérifiable, sans raccourci.
- Aucun incident critique sécurité/vie privée en instance, certificats et numéro Android compatibles, ancien client résolu.
- Plan d'exploitation et rollback testés ; RPO/RTO réels connus ; sauvegarde frais/hors site vérifiée.
- Signature de publication datée et réf. de l'autorisation spécifique par le propriétaire.
- `npm run release:check` ne devient PASS **qu'après** clôture de tous les gates, et non par contournement documentaire.
- Seulement ensuite : préparer le merge, l'application contrôlée des migrations, les fonctions Edge, le déploiement Web et les soumissions stores.

**Aucune autorisation de production n'est accordée par ce rapport. Ne pas transformer G5 en GO et ne pas fusionner la PR.**
