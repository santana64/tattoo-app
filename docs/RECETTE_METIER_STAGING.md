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

## Scénarios en attente de configuration

La suppression de compte **depuis les previews web** et le paiement Stripe **TEST** attendent les origines autorisées et les secrets de test sur le Supabase staging. Ne pas tenter un paiement réel ni supprimer un compte utilisé pour les autres scénarios. Une fois la configuration terminée, utiliser un compte fictif jetable pour la suppression et les cartes de test officielles Stripe pour le paiement. Le retour de Checkout ne doit pas suffire à afficher Premium avant confirmation serveur.

## Signaler un défaut

Noter : la preview utilisée, la date, le compte fictif (rôle seulement), la largeur d'écran, l'étape, le résultat attendu, le résultat observé, et une capture sans données privées. Pour un blocage, indiquer si le rechargement ou une nouvelle connexion le reproduit. Ne jamais joindre de mot de passe, de jeton, de lien signé vers une référence, ni de clé API.
