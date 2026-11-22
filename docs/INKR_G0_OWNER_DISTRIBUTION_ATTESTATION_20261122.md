# INKR — G0, déclaration du propriétaire sur la distribution Android v4

**Date : 22 novembre 2026 — déclaratif, sans accès indépendant aux consoles de distribution.**

Le propriétaire a confirmé dans la conversation de clôture :

- **Aucune publication d'INKR sur Google Play à sa connaissance** ; l'écran Google Play Console présenté lance l'inscription d'un compte développeur et la configuration d'un profil de paiement, plutôt que l'inventaire d'une application existante.
- **Aucun APK d'INKR envoyé à une autre personne** pour installation.

Cette déclaration rend **peu probable l'existence d'installations externes v4 par ces deux canaux**, et permet de privilégier le scénario d'une première distribution, sans mécanisme rétroactif de mise à jour obligatoire.

**Limites :** l'inventaire EAS montre malgré tout plusieurs builds internes v4 et un build de profil STORE, sans soumission EAS enregistrée. La déclaration ne constitue pas une preuve technique de **zéro installation** : restent à réconcilier les appareils de test du propriétaire, les liens de preview éventuellement accessibles, les distributions sur d'autres comptes/canaux et les éventuels appareils déjà configurés avec un ancien binaire.

**Décision documentaire :** ne plus présumer qu'une migration de clients publics est nécessaire ; conserver `legacy_client_resolution=unknown`, `legacy_zero_installed_clients_attested=false`, `G0=HOLD` jusqu'à l'inventaire final des appareils et canaux. Aucun changement des permissions de production, aucune publication Android, aucun basculement du gate vers GO.
