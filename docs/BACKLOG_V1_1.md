# INKR — après la release candidate V5

Ces éléments ne doivent pas retarder les corrections de sécurité, Stripe TEST, la recette sur appareils et la réconciliation Supabase. Ils ne sont pas couverts par les critères de sortie de la PR #2 tant qu'ils n'ont pas été explicitement reclassés.

| Sujet | État V5 et condition de reprise |
| --- | --- |
| Préférences de confidentialité et de notification | Les interrupteurs de `/settings/privacy` et `/settings/notifications` sont locaux et l'écran indique « Non enregistré ». Implémenter la persistance et l'application effective des préférences aux envois avant de les présenter comme fonctionnelles. |
| Gestion autonome de la facturation | L'abonné est orienté vers le support pour changer de carte, obtenir une facture ou résilier. Prévoir un portail client Stripe avec contrôles de retour et de droits. |
| Révocation immédiate des liens de références | Une URL signée déjà émise peut rester réutilisable jusqu'à expiration, notamment depuis un cache. Si la révocation immédiate devient exigée, concevoir un proxy authentifié sans cache et tester client, artiste et tiers. |
| Notifications push natives | Valider d'abord les identifiants Expo/FCM/APNs, les permissions et les appareils. Aucun résultat web ne prouve une réception native. |
| Réglages de visibilité avancés | Les contrôles « profil public », localisation et avertissements de contenu ne disposent pas encore d'un contrat serveur complet. Définir les règles de diffusion et les tests RLS avant d'activer ces options. |
