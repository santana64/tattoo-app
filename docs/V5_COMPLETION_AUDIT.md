# INKR V5 — audit de reprise

## État vérifié — 15 novembre 2026

- **PR brouillon et builds** : `f59013d` a passé la CI (204 tests, lint, TypeScript et export web) et les deux previews Vercel. Aucun déploiement Production ni fusion.
- **Staging isolé** : `lsewxsdulunuuzmszegm` porte 17 migrations. Les contrôles réels RLS et Storage ont utilisé des identités client, artiste et tiers ; le projet actif `jxmefklkixzzdceeorcg` est resté en lecture seule.
- **CORS** : les deux origines Preview reçoivent leur en-tête exact sur `delete-account` et `create-checkout-session` ; une origine étrangère n'en reçoit aucun. Le Checkout authentifié depuis la preview a créé une session TEST.
- **Stripe TEST** : le mensuel à 1 900 centimes EUR a terminé une session Checkout `complete / paid`, `livemode=false`. Le webhook signé a fait passer l'artiste fictif à `premium` et l'abonnement à `active`. L'annulation immédiate a remis `tier=normal` et les deux statuts à `canceled` ; le staging conserve un abonnement historique et aucun artiste Premium. Le prix annuel TEST est 14 900 centimes EUR. La fiscalité reste provisoire et nécessite une décision avant commercialisation. Aucun paiement LIVE.
- **Interface abonnement** : la preview protégée à 390 px a montré l'offre gratuite après annulation et son bouton mensuel a ouvert Checkout dans un nouvel onglet. Un second essai automatisé de paiement, destiné à capturer l'écran Premium après retour, n'a pas chargé les champs de carte Stripe ; aucune nouvelle activation n'en est déduite.
- **Suppression de compte** : après double confirmation dans la preview à 390 px, `delete-account` a répondu `200 {"deleted":true}`. L'écran est passé de la confirmation à `/welcome` en quelques secondes ; une nouvelle connexion au compte jetable a été refusée. SQL : 0 utilisateur Auth, 0 profil, 0 objet Storage. La fonction temporaire de création Auth a été neutralisée en `410 Gone` et les liens de preview temporaires ont été révoqués.
- **Sitemap et rendu** : le sitemap de la preview connectée répond 200 avec 8 URL, dont un profil artiste. Les messages `fetch failed` de l'export CI viennent de sa configuration Supabase fictive et produisent le repli statique de 5 URL. Le balayage connecté antérieur de 48 routes × 5 largeurs a donné 240 visites sans erreur JavaScript, page vide ou débordement ; 60 autres visites ont couvert l'onboarding incomplet. Il atteste du rendu, pas de chaque interaction.
- **Clavier abonnement** : la recette Preview a reproduit un contrôle Mensuel/Annuel activable par Entrée mais non par Espace, sans `aria-checked`. Le contrôle partagé a été corrigé ; sur l'export web puis sur la preview verte de `ec9be3b`, Espace sélectionne l'annuel, `aria-checked` passe de `false` à `true`, le focus est visible, le bouton annonce 149 € par an et la page ne déborde pas à 720 px CSS. Explorer garde une recherche et un bouton Filtres accessibles au clavier à cette largeur, sans erreur JS ni débordement. Il s'agit d'une largeur CSS équivalente à un bureau de 1440 px à 200 %, pas d'un essai du zoom natif du navigateur. La validation lecteur d'écran sur appareil reste ouverte.
- **États d'erreur ciblés** : sur l'export connecté, un refus `500` simulé de `delete-account` a laissé le compte sur sa page et affiché « La suppression n’a pas pu être confirmée », sans succès trompeur. Un `503 checkout_unavailable` simulé a gardé la page Abonnement et affiché « Impossible de démarrer le paiement », sans activer Premium. Ces simulations valident l'interface d'échec ; elles ne remplacent pas les refus réels Storage/RLS testés séparément.
- **Retours Checkout sans droit actif** : avec l'artiste fictif redevenu `normal`, l'ouverture directe et le rechargement de `?checkout=success` affichent « activation après confirmation par Stripe » et gardent l'offre gratuite ; `?checkout=cancel` affiche l'abandon et garde la même offre. Aucun simple paramètre d'URL n'annonce Premium. L'état visuel de l'offre Premium réellement active après un nouveau paiement reste à capturer.
- **Restant avant sortie Production** : état visuel Premium après paiement et reconnexion, recette complète des états d'erreur et du clavier/zoom, appareils Android/iOS avec VoiceOver/TalkBack, puis compatibilité SQL/RLS et anciennes versions clientes avec le projet actif. Ces validations et toute migration Production exigent une décision séparée ; la PR reste en brouillon.

## Journal de reprise

Les observations datées et les blocages depuis résolus sont conservés dans [`V5_REPRISE_JOURNAL.md`](V5_REPRISE_JOURNAL.md). La matrice ci-dessous et la synthèse ci-dessus décrivent l’état à vérifier pour la recette finale.

## Légende de couverture

- **P** : parcours ou composant V5 présent dans le code ; **V** : rendu visuellement vérifié ; **NV** : non vérifié en interaction réelle.
- **E** : état erreur explicitement constaté ; **C** : état de chargement ou vide repéré dans le code ; **?** : état non encore audité.
- **PARTIAL** : un écart concret reste ouvert ; **NOT VERIFIED** : aucun défaut affirmé, mais la définition de terminé n'est pas prouvée. Aucune route n'est déclarée COMPLETE sur la seule base d'un build.
- Les rôles indiquent le rôle prévu par la route et les gardes de navigation ; les permissions RLS effectives doivent encore être validées avec les comptes appropriés.

| Route | Rôle prévu | Fonction et composants principaux | V5 | États chargement / vide / erreur / succès | Navigation / action, accessibilité et formats | Classement |
|---|---|---|---|---|---|---|
| `/(auth)/welcome` | public | entrée galerie, Stage | P | ? | NV | NOT VERIFIED |
| `/(auth)/sign-in` | public | connexion, Auth | P, V | connexion réelle client/artiste/tiers/admin | retour depuis le profil vérifié à 390 px ; autres erreurs à couvrir | PARTIAL |
| `/(auth)/role-select` | compte | rôle client/artiste | P, V | écriture confirmée et refus zéro ligne testés sur staging | navigation de l'écran à compléter sur un nouveau compte | PARTIAL |
| `/auth/callback` | public | retour OAuth | P | ? | NV | NOT VERIFIED |
| `/(onboarding)/client/step1` | client | identité | P, V | refus et succès serveur vérifiés | navigation bloquée sur refus, contrôlée sur succès ; cinq largeurs | PARTIAL |
| `/(onboarding)/client/step2` | client | ville | P, V | refus et succès serveur vérifiés | navigation bloquée sur refus, contrôlée sur succès ; cinq largeurs | PARTIAL |
| `/(onboarding)/client/step3` | client | styles et fin | P | succès serveur corrigé ; autres NV | NV | PARTIAL |
| `/(onboarding)/artist/step1` | artiste | identité d'atelier | P | ? | NV | NOT VERIFIED |
| `/(onboarding)/artist/step2` | artiste | styles | P | ? | NV | NOT VERIFIED |
| `/(onboarding)/artist/step3` | artiste | portfolio | P | ? | NV | NOT VERIFIED |
| `/(onboarding)/artist/step4` | artiste | disponibilité | P | ? | NV | NOT VERIFIED |
| `/(onboarding)/artist/step5` | artiste | formule et fin | P | succès serveur corrigé ; autres NV | NV | PARTIAL |
| `/(tabs)/index` | public | fil et abonnements | P | ? | NV | NOT VERIFIED |
| `/(tabs)/explore` | public | recherche RPC, ArtistCard, filtres | P, V | E ; chargement/vides NV | largeurs 360–1440, autres NV | PARTIAL |
| `/artist/[id]` | public | profil, portfolio, réservation | P, V | chargé avec données publiques ; autres NV | CTA visible à 390 px ; ouvertures directes et rechargements 390/1440 sans #418 | PARTIAL |
| `/post/[id]` | public | œuvre | P, V | favori et j'aime confirmés, retrait zéro ligne refusé | ajout/retrait et rechargement testés à 390 px ; autres états NV | PARTIAL |
| `/reels/[id]` | public | vidéo | P | ? | NV | NOT VERIFIED |
| `/series/[id]` | public | série | P | ? | NV | NOT VERIFIED |
| `/flash/[id]` | public | flash et disponibilité | P, V | flash publié et demande liée vérifiés ; archivage confirmé | retrait propriétaire testé à 390 px ; natif NV | PARTIAL |
| `/saved` | compte | artistes et œuvres enregistrés | P, V | source serveur et RLS vérifiés depuis le profil et l'œuvre | rendu cinq largeurs ; interactions propres à la liste NV | PARTIAL |
| `/request/new` | client | brief, créneaux, soumission | P, V | envoi réel du brief sans image vérifié sur staging ; reprise d'images NV | quatre étapes et confirmation vérifiées à 390 px | PARTIAL |
| `/request/[id]` | parties | dossier et statut | P, V | accès client/artiste, refus du tiers, acceptation, référence privée et retrait réels | réouverture et cycle image vérifiés à 390 px | PARTIAL |
| `/(tabs)/inbox` | compte | demandes | P, V | demande reçue par l'artiste sur staging | ouverture du dossier vérifiée | PARTIAL |
| `/(tabs)/messages` | compte | conversations | P | ? | NV | NOT VERIFIED |
| `/conversation/[id]` | parties | échange texte, relance idempotente | P, V | échange client/artiste réel, refus tiers UI et RLS ; échec et relance testés localement | image jointe désactivée (policy Storage incompatible) | PARTIAL |
| `/appointment/[id]` | parties | séance | P, V | proposition et acceptation client réelles sur staging ; refus tiers HTTP | attente artiste, confirmation et rechargement vérifiés à 390 px ; natif NV | PARTIAL |
| `/review/new` | client | avis après séance | P | ? | NV | NOT VERIFIED |
| `/(tabs)/profile` | client/artiste | profil et Studio, MetricGrid | P | C/E repérés ; autres NV | ordre des priorités corrigé, formats NV | PARTIAL |
| `/(tabs)/agenda` | artiste | calendrier | P, V | prochain rendez-vous confirmé affiché sur staging | accès artiste vérifié à 390 px | PARTIAL |
| `/availability` | artiste | horaires et absences | P, V | horaires persistés puis restaurés ; blocage et retrait réels, refus RLS tiers confirmé | interactions à 390 px vérifiées ; natif NV | PARTIAL |
| `/analytics` | artiste | chiffres | P | ? | NV | NOT VERIFIED |
| `/create` | artiste | publication | P, V | JPEG, écriture Storage et post public vérifiés sur staging | sortie après succès vérifiée en ouverture directe | PARTIAL |
| `/flash/new` | artiste | flash | P, V | publication fictive et persistance vérifiées | ouverture directe et demande client liées testées ; natif NV | PARTIAL |
| `/story/new` | artiste | story | P, V | publication, persistance après reconnexion, suppression vérifiées | ouverture directe et retrait propriétaire testés ; natif NV | PARTIAL |
| `/guest/new` | artiste | guest spot | P, V | création, affichage public et suppression vérifiés | sortie du formulaire et retrait propriétaire testés ; natif NV | PARTIAL |
| `/customization` | artiste | page publique | P | ? | NV | NOT VERIFIED |
| `/premium-guide` | artiste | guide | P | ? | NV | NOT VERIFIED |
| `/notifications` | compte | alertes | P | erreurs et confirmations serveur corrigées ; API réelle NV | NV | PARTIAL |
| `/settings` | compte | réglages | P | ? | NV | NOT VERIFIED |
| `/settings/account` | compte | identité | P | succès serveur corrigé ; autres NV | action de photo factice retirée | PARTIAL |
| `/settings/notifications` | compte | préférences | P | ? | NV | NOT VERIFIED |
| `/settings/privacy` | compte | confidentialité | P | ? | NV | NOT VERIFIED |
| `/settings/support` | compte | aide | P | ? | NV | NOT VERIFIED |
| `/settings/subscription` | artiste | Premium Stripe | P, V | Checkout TEST payé, webhook Premium puis annulation et retour au tier normal | page Preview à 390 px, bouton Checkout et clavier ; retour Premium visuel encore NV | PARTIAL |
| `/settings/delete-account` | compte | suppression | P, V | double confirmation, POST 200 et 0 donnée après suppression | transition `/welcome` et refus de reconnexion vérifiés à 390 px | PARTIAL |
| `/legal/terms` | public | CGU | P | ? | NV | NOT VERIFIED |
| `/legal/privacy-policy` | public | données personnelles | P | ? | NV | NOT VERIFIED |
| `/admin` | admin | modération | P, V | accès réservé client/tiers, signalement classé par l'administrateur | accès direct et action à 390 px, RLS de conversation testés ; autres actions NV | PARTIAL |

## Écarts classés

1. **P1 — Références du brief** : sélection de trois images, compression JPEG, plafond 10 Mio, stockage sous l'identifiant de la demande et lecture signée depuis le bucket privé implémentés. Un échec après création conserve l'identifiant en session ; un marqueur local contenant uniquement cet identifiant permet de retrouver le dossier après réouverture et de réutiliser le même identifiant après une réponse réseau ambiguë. Si cette vérification échoue, le formulaire attend une nouvelle vérification au lieu de permettre un envoi potentiellement trompeur. Un ancien identifiant ne peut pas faire passer un brief différent pour une nouvelle demande. Le dossier liste les fichiers déposés et permet au client d'en ajouter ou retirer ; les URI d'images ne sont pas conservées localement, donc elles doivent être resélectionnées après fermeture. Le chemin privé est enregistré de façon idempotente dans `request_references` ; le bucket reste la source de vérité pour l'affichage. La migration locale, **non appliquée au projet actif**, ajoute l'unicité des chemins, les droits de suppression du client, limite les noms à trois emplacements et impose JPEG et 10 Mio côté Storage. Elle a été appliquée et testée sur `inkr-v5-staging`. Les liens signés expirent après une minute et sont renouvelés toutes les 45 secondes pendant l'ouverture du dossier ainsi qu'au retour au premier plan. L'API réelle à trois identités et l'expiration ont été testées ; le cache peut encore servir un lien déjà utilisé jusqu'à son expiration. L'ajout, la lecture, la suppression et la nouvelle tentative dans l'interface web ont été vérifiés ; les appareils natifs restent à tester.
2. **P1 — Validation des écritures** : le compte, le rôle et la fin d'onboarding annonçaient parfois un succès avant une ligne confirmée. Corrigé dans cette branche ; les refus zéro ligne et les écritures autorisées ont été testés sur le staging pour le profil et le rôle. Le parcours complet d'un compte neuf reste à rejouer.
3. **P1 — Aperçus recherche** : une limite globale pouvait masquer le portfolio des derniers artistes d'une page. Un RPC à quota par artiste, avec index et test SQL, est préparé. La migration doit précéder le client.
4. **P2 — Studio** : les chiffres précédaient les demandes à traiter. Ordre et hauteur de titre ajustés ; validation avec un compte artiste chargé encore requise.
5. **P2 — Actions factices** : lien App Store `id000000000` et commande photo ouvrant seulement une alerte retirés. Il reste à concevoir une vraie modification de photo.
6. **P1 — Écart de schéma connecté** : l'historique du projet actif et le dépôt ne concordent pas. Ne pas appliquer aveuglément les migrations du dépôt au projet actif.
7. **P2 — Hydratation du profil** : une ancienne ouverture directe d'un profil réel avait produit React `#418`. Les ouvertures directes et rechargements ultérieurs sur les bonnes routes ne l'ont pas reproduite à 390, 1024 et 1440 px ; surveiller la réapparition sur les previews et après authentification.
8. **P1 — Conversation** : l'envoi texte utilise maintenant un identifiant de message stable. Une réponse perdue est vérifiée par cet identifiant avant d'afficher un échec ; un message non confirmé reste visible et relançable avec le même identifiant. Les caches privés sont vidés au changement de compte. L'ancien bouton d'image de conversation utilisait `posts-media/conv/<demande>/…`, refusé par la policy Storage active `inkr_posts_media_insert_own_artist` pour le client comme pour l'artiste. Il a été retiré ; les références du projet restent gérées dans le dossier privé. Des pièces jointes de conversation exigeraient un bucket privé distinct et ses tests HTTP sur l'environnement isolé.
9. **P1 — URL directe de conversation** : corrigée après reproduction avec le compte tiers. L'accès au dossier est confirmé avant de récupérer les messages, de s'abonner à Realtime ou d'afficher le composeur. Test réel à trois identités effectué sur le staging.
10. **P1 — Paiement de test** : pont de retour natif, Checkout TEST authentifié et webhook signé vérifiés sur le staging ; la base est passée de `normal` à `premium`, puis à `normal` après annulation. Le bouton Preview ouvre Checkout. La présentation de l’état Premium après retour de paiement et reconnexion reste à observer. Aucun secret Stripe LIVE ni configuration Production n’a été employé.
11. **P1 — Images web** : la CSP empêchait la lecture des URL `blob:` produites par le sélecteur. L'autorisation `blob:` a été ajoutée à `connect-src` sans élargir les domaines distants. Le cycle réel de référence privée client/artiste/tiers, retrait et nouvel envoi passe sur le staging.
12. **P1 — Publication directe** : une publication réussie depuis `/create` ouvert directement conservait le formulaire, ce qui permettait un second envoi accidentel. La navigation remplace maintenant l'écran par le Studio après la confirmation serveur ; la recette réelle a validé la redirection et l'apparition du post public.
13. **P2 — Garde artiste au chargement** : les écrans de création montraient un refus avant que le profil soit restauré. Un squelette commun évite ce faux état, avec refus réel conservé pour un compte client.

## Validation restante avant de qualifier la V5 de complète

Le parcours client/artiste, les références privées à trois identités et le cycle Stripe TEST sont vérifiés sur staging. Restent : transition visuelle Premium après paiement et reconnexion, états d’erreur et permissions de toutes les routes, zoom navigateur 200 % et clavier complets, VoiceOver/TalkBack sur appareils, performance mesurée et essais avec tatoueurs. Aucune route n’est déclarée complète sur la seule preuve du rendu automatisé.
