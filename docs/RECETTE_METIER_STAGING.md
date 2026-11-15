# INKR V5 — recette métier sur le projet de test

Cette procédure est destinée à la personne qui validera l'expérience client et tatoueur. Elle utilise uniquement des profils et contenus fictifs sur **inkr-v5-staging** (`lsewxsdulunuuzmszegm`). Elle ne modifie pas le projet actif. Ouvrir la [preview de la branche](https://tattoo-app-git-codex-inkr-v5-complet-630ef5-santana64s-projects.vercel.app) sur téléphone et sur ordinateur. Une seconde [preview](https://tattoo-app-4gmu-git-codex-inkr-v5-co-e13ffb-santana64s-projects.vercel.app) sert à comparer le même commit. Vérifier que les deux déploiements sont verts dans la PR avant la séance.

Les comptes fictifs **client**, **artiste** et **tiers** existent déjà. Obtenir leurs identifiants par un canal privé auprès du propriétaire ; ne pas les placer dans un ticket ni dans ce document. Utiliser des photos de test sans personne réelle. Recharger la page après chaque étape importante pour vérifier la persistance.

## Parcours client et artiste

| Étape | Compte et point de départ | Action | Résultat et preuve à observer |
| --- | --- | --- | --- |
| 1 | Sans connexion, accueil puis Explorer | Chercher un artiste par style ou ville, ouvrir son profil et ses œuvres. | Le profil et le portfolio s'ouvrent ; les images gardent leur proportion ; aucune page blanche. |
| 2 | Client, profil de l'artiste | Ouvrir un flash disponible, puis « Demander un projet ». Remplir le brief et ajouter jusqu'à trois JPEG fictifs. | La demande apparaît dans Mes projets ; les références s'affichent dans le dossier après rechargement. |
| 3 | Artiste, boîte de réception | Ouvrir la nouvelle demande et ses références, répondre puis accepter la demande. | Le brief et les images sont visibles à l'artiste ; la réponse apparaît au client après rechargement. |
| 4 | Client puis artiste, conversation du dossier | Échanger un message de chaque côté. | Chaque message n'apparaît qu'une fois et reste visible après fermeture et réouverture. |
| 5 | Artiste, dossier accepté | Proposer un créneau futur libre. | Le rendez-vous est « En attente de confirmation » ; l'artiste ne peut pas le confirmer à la place du client. |
| 6 | Client, rendez-vous proposé | Accepter le créneau. | Le statut devient « Confirmé » et reste confirmé après rechargement ; l'agenda artiste et le dossier client le montrent. |
| 7 | Tiers, URL directe du dossier et du rendez-vous | Ouvrir les liens copiés depuis le compte client. | Le tiers ne voit ni demande, ni message, ni référence privée, ni rendez-vous. Ne pas transférer d'URL signée de référence à un tiers : elle fonctionne pendant sa courte durée de validité. |
| 8 | Client, dossier | Retirer une référence, recharger, puis ajouter une autre image. | Le fichier retiré disparaît réellement ; la nouvelle image est visible par le client et l'artiste. Un refus doit produire une erreur, jamais une confirmation. |

## Atelier du tatoueur

Avec le compte **artiste**, ouvrir le Studio : modifier le profil puis le recharger ; publier une œuvre et une story fictives ; créer un guest spot et un flash ; changer une disponibilité ; consulter ensuite Explorer, le profil public, la boîte de réception et l'agenda. Le contenu doit apparaître aux bons endroits après rechargement. Une suppression de story ou de guest spot doit retirer l'élément. Un flash déjà lié à une demande doit pouvoir être **archivé** tout en gardant le dossier historique consultable. Nettoyer les contenus créés pour cette recette après validation.

## Cas d'échec à rejouer

- Couper le réseau avant d'enregistrer un profil, d'envoyer un message ou de joindre une référence : un message compréhensible doit apparaître et l'état ne doit pas annoncer un succès. Rétablir le réseau et réessayer une seule fois ; vérifier l'absence de doublon.
- Se déconnecter du client puis ouvrir la même URL avec le tiers : les données du client ne doivent pas rester à l'écran.
- Ouvrir directement un profil artiste dans un nouvel onglet puis actualiser : pas d'écran blanc, de saut majeur ni d'erreur d'hydratation dans la console.
- Tester à largeur téléphone, tablette et ordinateur, ainsi qu'au zoom navigateur 200 % : les boutons de validation doivent rester visibles et utilisables au clavier.

## Recette Stripe TEST à effectuer (mise à jour du 15 novembre)

Le CORS des deux previews et la réception d'événements webhook signés ont été validés sur `lsewxsdulunuuzmszegm`, mais cela **ne valide pas** le Checkout INKR ni les droits Premium. Utiliser exclusivement l'environnement Stripe TEST `acct_1Ubxk0BIelrUrSJe` et un compte artiste **fictif** du staging :

1. Sur l'une des deux previews, ouvrir Paramètres → Abonnement avec le compte artiste de test. Choisir le plan à 19 €/mois ; lancer Checkout et vérifier que la page Stripe est en **TEST** et affiche 19 € pour l'offre mensuelle. Vérifier séparément l'affichage du plan annuel à 149 €/an.
2. Finaliser uniquement avec une carte de test officiellement documentée par Stripe : https://docs.stripe.com/testing ; ne saisir aucune carte bancaire réelle. Ne transmettre aucune clé `sk_test_`, `whsec_` ni session utilisateur dans les rapports.
3. Après le retour Checkout, recharger l'interface. Contrôler côté Supabase staging que le client Stripe de l'artiste est lié, que la table `subscriptions` contient le bon abonnement/prix et que le tier de l'artiste est `premium` **après webhook**, et non simplement après redirection.
4. Rejouer un abandon de Checkout (statut Premium inchangé) ; puis une annulation de l'abonnement TEST et contrôler la transition en base et l'interface. Vérifier dans Stripe la livraison HTTP 2xx des événements abonnements et l'absence d'effet doublon.
5. Nettoyer les objets Stripe TEST de recette non nécessaires, ainsi que les fixtures fictives du staging. Ne pas supprimer les comptes réutilisés par les autres recettes.

Le scénario d'essai d'abonnement Stripe créé et annulé le 15 novembre a uniquement confirmé deux POST webhook HTTP 200 ; il ne constitue **pas** cette recette de bout en bout.

## Scénarios connectés vérifiés et limites

Le 15 novembre, les deux origines Preview ont obtenu leur en-tête CORS exact sur `delete-account` et `create-checkout-session` ; une origine témoin n'en a reçu aucun. La suppression **depuis l'interface web** reste à rejouer avec un compte jetable ; ne jamais supprimer les comptes partagés par les autres recettes.

Le Checkout Stripe du compte artiste fictif a été ouvert depuis la fonction staging pour les deux périodes, avec des sessions `cs_test_…`. Le paiement mensuel par carte de test a terminé la session en `complete / paid` pour **1 900 centimes EUR**. Après réception du webhook, `artists.tier` est passé à `premium` et la ligne `subscriptions` à `active`. L'abonnement de test a ensuite été annulé immédiatement ; le webhook a remis le tier à `normal` et les deux statuts à `canceled`. Le navigateur de test utilisait une sortie réseau américaine : Stripe affichait une conversion indicative en USD dans Checkout. Aucun paiement LIVE n'a été lancé. À 390 px, la preview protégée a affiché l'offre gratuite après annulation et le bouton « Passer à Premium · 19 € par mois » a ouvert Stripe Checkout dans un nouvel onglet. Le retour visuel après paiement **dans la preview protégée** reste à vérifier ; le retour du paiement TEST a atteint la protection Vercel. Le lien de partage temporaire utilisé pour cette vérification a été révoqué.

La fonction `delete-account` version 3 a été vérifiée directement sur `inkr-v5-staging` avec un compte jetable et deux objets fictifs, dans `avatars` et `healed-photos`. Elle a répondu `200 {"deleted":true}` après retrait des fichiers ; une requête SQL de contrôle a trouvé **0 utilisateur Auth et 0 objet Storage** pour cet identifiant, et une nouvelle connexion a été refusée. Le test automatisé vérifie aussi qu'une suppression Storage qui annonce un succès sans retirer le fichier produit une erreur et conserve le compte pour une nouvelle tentative. Un second test couvre les couvertures artiste, stockées sous l'identifiant artiste et non sous celui du compte ; la version 4, déployée ensuite sur staging, nettoie les deux chemins. La fonction temporaire de création de compte a été remise à sa réponse `410 Gone` après le test. Le bouton web de suppression reste à tester une fois `ALLOWED_ORIGINS` disponible.

## Signaler un défaut

Noter : la preview utilisée, la date, le compte fictif (rôle seulement), la largeur d'écran, l'étape, le résultat attendu, le résultat observé, et une capture sans données privées. Pour un blocage, indiquer si le rechargement ou une nouvelle connexion le reproduit. Ne jamais joindre de mot de passe, de jeton, de lien signé vers une référence, ni de clé API.
