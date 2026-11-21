# INKR PR #3 — G2 Stripe TEST (21/11/2026)

## Verdict
**PASS ciblé : ouverture d'une session Checkout Stripe TEST depuis le vrai compte artiste Web connecté. HOLD pour le cycle complet paiement → retour → webhook → Premium après reconnexion → résiliation.**

- Vraie UI `/settings/subscription` de la preview Vercel commit `6ac997e` : abonnement non Premium avant Checkout, plan mensuel **19 €**, bouton **Passer à Premium** effectivement cliqué.
- Fonction Supabase **staging** `create-checkout-session` appelée depuis la vraie UI, **HTTP 200**, fenêtre réelle `checkout.stripe.com` ouverte, authentification Stripe **TEST** (ID `cs_test_...`, pas `cs_live_`), offre INKR Premium 19 €/mois et intitulé **« environnement de test inkr »**.
- **6/6 vérifications ciblées PASS** avec Playwright. Aucune carte bancaire LIVE, aucune facture réelle, aucun paiement de production.
- Dans ce navigateur headless, Stripe Checkout affichait le panneau de récapitulatif, mais **pas le formulaire de paiement**, y compris avec Microsoft Edge et un délai supplémentaire de 18 secondes. Par conséquent, **aucun paiement fictif n'a été réalisé dans cette campagne**, et il est interdit de déclarer l'intégration de retour/activation totalement validée.
- Relevé Stripe API autorisé sur le seul compte **TEST** `environnement de test inkr` : **11 sessions historiques avant l'essai**, dont **4 `complete / paid`**. Après l'essai, une nouvelle session `open / unpaid` est visible. **5 abonnements historiques** sont au statut **`canceled`**.
- Réconciliation SQL Supabase staging : deux artistes QA historiques présentent `artists.tier='normal'`, `stripe_subscription_status='canceled'` et ligne `subscriptions.status='canceled', tier='normal'`. Une table `stripe_subscription_events` contient **5 et 6 événements** associés aux deux artistes, preuve du traitement historique des changements d'abonnement. Cela **n'atteste pas** qu'un nouveau webhook s'est exécuté pendant l'essai de ce jour.
- La page de l'application indique que les changements de facturation et annulations se font par le support et non en libre-service, ce qui constitue un besoin de vérification fonctionnelle pour le gate G2/G5.

## Complément indépendant exécuté sur la même preview
Une autre campagne de recette, documentée dans `INKR_G2_STRIPE_TEST_WEB_AUTORETURN_20261121.md` et vérifiée dans le rapport QA privé `g2-actual-web-stripe-20261121.json`, a **réussi 11 assertions** : accès protégé, JWT GoTrue, clic depuis la vraie UI, test mode, formulaire carte fictive, retour HTTPS automatique, Premium après webhook puis après reload. La seconde tentative de magic-link de **reconnexion Premium** a expiré faute d'e-mail dans le créneau de test, d'où **HOLD global**. L'abonnement a été annulé dans Stripe TEST ; le niveau `normal` et le statut `canceled` ont été confirmés en SQL staging. La page Web d'abonnement a ensuite été contrôlée de nouveau : **formule gratuite affichée et conservée après rechargement, 2/2 PASS**. L'échec d'affichage du formulaire dans **notre premier navigateur** ne doit donc pas être extrapolé à cette autre campagne.

## Pour lever G2 Stripe
1. Compléter le paiement **uniquement avec une carte d'essai officielle Stripe** et un navigateur où le formulaire s'affiche.
2. Vérifier la **redirection HTTPS réelle** vers la preview `/settings/subscription?checkout=success`.
3. Vérifier la réception et l'ordre des **événements webhook Stripe TEST**, la ligne `subscriptions` puis le statut `artists.tier='premium'`.
4. Fermer et rouvrir la session artiste et constater Premium dans la véritable interface.
5. Annuler l'abonnement TEST, contrôler événements et rétrogradation selon la politique métier.

**Le retour HTTP 200 de la fonction de Checkout et les anciennes sessions complétées ne remplacent pas ce parcours intégral. G2 global = HOLD.**
