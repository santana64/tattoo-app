# INKR V5.1 — acomptes facultatifs hors plateforme

## Décision produit

INKR ne collecte **aucun** acompte de réservation, ne dispose d'aucun compte d'encaissement intermédiaire et n'annonce pas avoir vérifié un versement. L'artiste encaisse lui-même avec son prestataire habituel ou en dehors de l'application.

L'abonnement INKR Premium via Stripe est **indépendant** de ce module.

## Parcours

1. Un rendez-vous est confirmé par le client dans le flux habituel. Cette confirmation ne présume pas du paiement.
2. L'artiste ouvre la fiche du rendez-vous et peut, facultativement, créer une demande d'acompte de 1 à 10 000 €.
3. Il choisit soit un règlement hors application (instructions à convenir avec le client), soit un lien HTTPS appartenant à l'un des prestataires pris en charge : `buy.stripe.com`, `paypal.me`, `www.paypal.com`, `pay.sumup.com`, `my.sumup.com`, `revolut.me`. Le montant affiché dans INKR **n'est pas comparé** au montant facturé par le prestataire externe.
4. Le client voit le montant demandé et, lorsqu'il existe, peut ouvrir volontairement le site externe. INKR ne reçoit jamais le numéro de carte ni le résultat du paiement.
5. L'artiste peut **déclarer** l'acompte reçu ou y renoncer. Le client voit explicitement qu'il s'agit d'une déclaration non vérifiée. L'artiste ne peut pas réouvrir ou réécrire un acompte clôturé.
6. L'annulation d'un rendez-vous invalide la demande en attente et retire le lien d'INKR. Elle **n'annule pas** un versement déjà réalisé auprès du prestataire tiers. Un éventuel remboursement se traite entre le client, l'artiste et le prestataire.

## Contrat sécurité

- Pas de `create-deposit-checkout` : l'ancien snapshot de cette fonction créerait une session sur le compte Stripe de la plateforme, contraire au périmètre validé.
- Une table additive `appointment_deposit_requests`, avec accès RLS en lecture aux seules parties du rendez-vous.
- Aucune écriture SQL directe par `anon` ou `authenticated`; deux RPC `SECURITY DEFINER` valident explicitement le propriétaire, le statut, les bornes et l'hôte du lien.
- Lien externe validé également dans l'UI avant ouverture; aucun URL arbitraire, schéma `http:`, nom d'hôte ressemblant ou destination avec identifiants.
- Un acompte ne peut être demandé que pour une séance **confirmée, à venir**, sans changement du statut de la séance ni du mécanisme d'acceptation RPC.
- Statuts `requested`, `declared_received`, `waived`, `cancelled`. Ce ne sont **pas** des preuves de paiement bancaire.
- Limites connues : INKR ne contrôle pas les remboursements et ne peut pas empêcher la réutilisation d'un lien externe enregistré ailleurs. L'autorisation de nouvelles passerelles de paiement exige une revue d'hôte.

## Vérifications avant activation

1. `npm run lint`, `npm run typecheck`, `npm test`, `npm run build:web` avec configuration fictive.
2. Rejouer `tests/optional-deposits.test.cjs`, incluant les appels RPC de client / artiste / tiers, les liens usurpés et l'annulation.
3. **Sur staging uniquement** : appliquer la nouvelle migration après revue de son delta ; inspecter les grants et les policies ; vérifier depuis les comptes fictifs (artiste, client, tiers) que les opérations de lecture et d'écriture respectent RLS.
4. Recette web puis Android/iOS : demande manuelle, demande lien externe, remplacement avant réception, déclaration de réception, renoncement, annulation et persistance après reconnexion. Vérifier aussi un prestataire indisponible et un téléphone hors réseau.
5. Contrôler le rendu et la sécurité des liens dans les previews associées au commit testé.

**Production : HOLD.** La V5 principale possède toujours les portes G0 à G5. Ce document ne constitue pas une autorisation de fusion, de mise en production ou d'exécution SQL sur `jxmefklkixzzdceeorcg`.
