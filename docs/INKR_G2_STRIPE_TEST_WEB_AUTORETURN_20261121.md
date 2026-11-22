# INKR PR #3 — G2 : Stripe TEST dans la véritable preview Web protégée (21 novembre 2026)

## Verdict
**PASS ciblé** — vrai clic « Passer à Premium » depuis l'interface de la preview Web Vercel, paiement par carte fictive Stripe **TEST**, **retour automatique HTTPS**, webhook, Premium visible et persistant après rechargement ; annulation de l'abonnement TEST effectuée via l'API Stripe et webhook de retour au niveau gratuit.

**HOLD résiduel** — la vérification du Premium après **nouvelle connexion** et la confirmation visuelle de l'offre gratuite après annulation dans la même campagne n'ont pas pu être terminées : le deuxième e-mail à usage unique n'a pas été livré pendant le délai de test.

## Exécution réelle
1. Preview cible à SHA `6ac997eb57c32f4d08f7da03e5f8bf6d464249c9` : `tattoo-app-4gmu-6w3310ryl-santana64s-projects.vercel.app`, état `READY`. Protection Vercel maintenue ; un accès de QA **temporaire et borné** a été créé puis **révoqué** après la campagne.
2. Le compte **artiste QA** de staging présentait initialement `onboarding_completed=false` et ne pouvait atteindre la page Premium. Son onboarding a été **temporairement** mis à `true` **pour ce compte seulement**, avec vérification de son rôle. L'état initial `false` a été restauré à la fin.
3. Authentification **dans la véritable UI Web** : l'e-mail magic-link livré a été consommé par Supabase GoTrue ; callback PKCE HTTP 303, session authentifiée présente, accès aux paramètres abonnement.
4. **Clic sur le bouton Premium réellement affiché** : navigation du navigateur vers Stripe Checkout, sans appel API direct servant de substitut au clic.
5. Contrôle par une session **Stripe API indépendante** dans le compte sandbox `acct_1Ubxk0BIelrUrSJe` : Checkout `cs_test_...`, `livemode=false`, `mode=subscription`, prix **1 900 centimes EUR**, `status=open`, deux URL HTTPS Web `success_url` et `cancel_url` pointant vers le **domaine exact de la preview**. Une carte Stripe fictive `4242...` a été autorisée **seulement après ce contrôle**.
6. Après soumission fictive, **redirection navigateur automatique** vers `/settings/subscription?checkout=success`, état Premium **affiché après webhook**, puis encore affiché **après rafraîchissement de la page**. Les assertions correspondantes du script Playwright sont `PASS`.
7. La campagne a ensuite supprimé l'ancienne session navigateur pour éprouver une **vraie reconnexion**, mais n'a pas reçu le second e-mail magic-link à temps : `g2-actual-web-stripe-20261121.json` conserve le statut global **`HOLD`**, ce qui est correct.
8. Nettoyage indépendant : abonnement TEST `sub_1UeK84BIelrUrSJe3SWbodRN` annulé via Stripe API **test mode**, `status=canceled` ; Supabase staging a confirmé `artists.tier=normal` et `stripe_subscription_status=canceled` après webhook. Onboarding QA restauré à **`false`**. **Aucun paiement LIVE**.
9. Les fichiers temporaires avec liens Stripe, OTP et URL d'accès Vercel ne sont pas dans Git ; la protection Vercel temporaire a été révoquée.

## Preuves et limites
- Script Playwright privé : `%LOCALAPPDATA%\INKR-QA\scripts\Run-INKR-Actual-Preview-StripeTEST-20261121.cjs`. Rapport privé `%LOCALAPPDATA%\INKR-QA\clone\g2-actual-web-stripe-20261121.json`, avec les **11 étapes initiales PASS**, puis timeout au deuxième lien de connexion.
- Le test antérieur `premium-test-activation-ui-20261121.json` avait confirmé Premium visible après e-mail et recharge, mais **n'avait pas démontré le retour automatique Web**. La nouvelle campagne comble précisément cette lacune.
- Contrôles Supabase : après résiliation, niveau gratuit confirmé. Ces résultats API ne remplacent **pas** la vérification de l'interface une fois reconnecté.
- **Reste à faire :** test UI en trois comptes simultanément, trois références privées de bout en bout, reconnexion Premium après paiement, suppression et expiration des médias, écran gratuit après résiliation, politique de débit des e-mails et mobile natif.

**G2 global HOLD**, malgré le **PASS ciblé du retour automatique Stripe TEST / activation / webhook / annulation API**. PR #3 DRAFT, aucune publication et aucune mutation du projet Supabase production.
