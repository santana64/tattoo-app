# INKR V5 — audit de reprise

12 novembre 2026. Base : `main` à `5c995e1`, refonte Claude `9d98ff4` (111 fichiers modifiés). Branche de travail : `codex/inkr-v5-completion-excellence`.

## Niveau de preuve

Le dépôt contient 48 écrans routés hors layouts et `+html`. Les 125 tests préexistants passaient avant intervention. La baseline TypeScript échouait dans `lib/auth-errors.ts` (deux paramètres implicitement `any`). ESLint passait avec trois avertissements dans `TToast`. L'export web échouait sans `EXPO_PUBLIC_SUPABASE_URL`, ce qui est attendu dans cet environnement sans variables de projet. Avec une URL et une clé **fictives**, l'export a réussi. Ce build ne valide aucune requête vers la vraie base.

Une session Chromium locale a rendu `/explore` à 360, 390, 768, 1024 et 1440 px : pas de débordement horizontal ni d'erreur JavaScript. L'état erreur réseau s'affiche, car la configuration est fictive. Les captures sont dans `/workspace/shared/inkr-explore-*.png` (hors dépôt). Aucun backend **de test**, compte de test ni appareil iOS/Android n'est disponible ici. Les états et permissions non observés en condition réelle portent donc la mention **NV**.

Inspection **en lecture seule** du projet Supabase connecté `inkr` : il est actif et expose les tables principales du produit, mais son historique contient neuf migrations (`001` à `009`) aux noms différents de ceux du dépôt (`001_initial` à `012_booking_care`). `search_artists` y existe, `artist_portfolio_previews` n'y existe pas. Le bucket `request-references` est privé et limité à 10 Mio, mais `allowed_mime_types` vaut `NULL`, contrairement à la migration locale. L'écart exige une réconciliation de schéma avant tout déploiement ; aucune requête d'écriture n'a été envoyée à ce projet. Les conseillers de sécurité Supabase signalent aussi des fonctions à `search_path` mutable et des fonctions `SECURITY DEFINER` exécutables par `anon` ; leur caractère intentionnel reste à examiner ([guide Supabase](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)).

Une seconde exportation locale avec la clé **publiable** du projet actif a permis de tester uniquement les lectures publiques : `/explore` a affiché un artiste réel ; la navigation vers son profil a affiché son nom, ses spécialités, son statut et « Demander un projet » dans la première hauteur à 390 px, sans débordement ; le bouton a ouvert `/sign-in` avec un paramètre `next` pointant vers le brief de cet artiste. Le profil a aussi été capturé à 1440 px (`/workspace/shared/inkr-live-artist-*.png`). Le RPC d'aperçus répond 404 tant que la migration n'est pas déployée ; la carte reste affichée grâce au repli. Une ouverture directe du profil a produit une erreur React d'hydratation `#418` en console avant de se rendre normalement : défaut de rendu à diagnostiquer. La base publique ne contient qu'un artiste visible au moment du test ; elle ne peut pas prouver l'équilibrage multiartiste.

## Légende de couverture

- **P** : parcours ou composant V5 présent dans le code ; **V** : rendu visuellement vérifié ; **NV** : non vérifié en interaction réelle.
- **E** : état erreur explicitement constaté ; **C** : état de chargement ou vide repéré dans le code ; **?** : état non encore audité.
- **PARTIAL** : un écart concret reste ouvert ; **NOT VERIFIED** : aucun défaut affirmé, mais la définition de terminé n'est pas prouvée. Aucune route n'est déclarée COMPLETE sur la seule base d'un build.
- Les rôles indiquent le rôle prévu par la route et les gardes de navigation ; les permissions RLS effectives doivent encore être validées avec les comptes appropriés.

| Route | Rôle prévu | Fonction et composants principaux | V5 | États chargement / vide / erreur / succès | Navigation / action, accessibilité et formats | Classement |
|---|---|---|---|---|---|---|
| `/(auth)/welcome` | public | entrée galerie, Stage | P | ? | NV | NOT VERIFIED |
| `/(auth)/sign-in` | public | connexion, Auth | P, V | formulaire visible ; envoi NV | retour depuis le profil vérifié à 390 px | PARTIAL |
| `/(auth)/role-select` | compte | rôle client/artiste | P | ? | NV | NOT VERIFIED |
| `/auth/callback` | public | retour OAuth | P | ? | NV | NOT VERIFIED |
| `/(onboarding)/client/step1` | client | identité | P | ? | NV | NOT VERIFIED |
| `/(onboarding)/client/step2` | client | ville | P | ? | NV | NOT VERIFIED |
| `/(onboarding)/client/step3` | client | styles et fin | P | succès serveur corrigé ; autres NV | NV | PARTIAL |
| `/(onboarding)/artist/step1` | artiste | identité d'atelier | P | ? | NV | NOT VERIFIED |
| `/(onboarding)/artist/step2` | artiste | styles | P | ? | NV | NOT VERIFIED |
| `/(onboarding)/artist/step3` | artiste | portfolio | P | ? | NV | NOT VERIFIED |
| `/(onboarding)/artist/step4` | artiste | disponibilité | P | ? | NV | NOT VERIFIED |
| `/(onboarding)/artist/step5` | artiste | formule et fin | P | succès serveur corrigé ; autres NV | NV | PARTIAL |
| `/(tabs)/index` | public | fil et abonnements | P | ? | NV | NOT VERIFIED |
| `/(tabs)/explore` | public | recherche RPC, ArtistCard, filtres | P, V | E ; chargement/vides NV | largeurs 360–1440, autres NV | PARTIAL |
| `/artist/[id]` | public | profil, portfolio, réservation | P, V | chargé avec données publiques ; autres NV | CTA visible à 390 px ; hydratation à diagnostiquer | PARTIAL |
| `/post/[id]` | public | œuvre | P | ? | NV | NOT VERIFIED |
| `/reels/[id]` | public | vidéo | P | ? | NV | NOT VERIFIED |
| `/series/[id]` | public | série | P | ? | NV | NOT VERIFIED |
| `/flash/[id]` | public | flash et disponibilité | P | ? | NV | NOT VERIFIED |
| `/saved` | compte | artistes et œuvres enregistrés | P | ? | NV | NOT VERIFIED |
| `/request/new` | client | brief, créneaux, soumission | P | sélection et reprise d'images implémentées ; accès réel NV | NV | PARTIAL |
| `/request/[id]` | parties | dossier et statut | P | bucket privé et URL signée raccordés ; accès réel NV | NV | PARTIAL |
| `/(tabs)/inbox` | compte | demandes | P | ? | NV | NOT VERIFIED |
| `/(tabs)/messages` | compte | conversations | P | ? | NV | NOT VERIFIED |
| `/conversation/[id]` | parties | échange | P | ? | NV | NOT VERIFIED |
| `/appointment/[id]` | parties | séance | P | ? | NV | NOT VERIFIED |
| `/review/new` | client | avis après séance | P | ? | NV | NOT VERIFIED |
| `/(tabs)/profile` | client/artiste | profil et Studio, MetricGrid | P | C/E repérés ; autres NV | ordre des priorités corrigé, formats NV | PARTIAL |
| `/(tabs)/agenda` | artiste | calendrier | P | ? | NV | NOT VERIFIED |
| `/availability` | artiste | horaires et absences | P | ? | NV | NOT VERIFIED |
| `/analytics` | artiste | chiffres | P | ? | NV | NOT VERIFIED |
| `/create` | artiste | publication | P | ? | NV | NOT VERIFIED |
| `/flash/new` | artiste | flash | P | ? | NV | NOT VERIFIED |
| `/story/new` | artiste | story | P | ? | NV | NOT VERIFIED |
| `/guest/new` | artiste | guest spot | P | ? | NV | NOT VERIFIED |
| `/customization` | artiste | page publique | P | ? | NV | NOT VERIFIED |
| `/premium-guide` | artiste | guide | P | ? | NV | NOT VERIFIED |
| `/notifications` | compte | alertes | P | ? | NV | NOT VERIFIED |
| `/settings` | compte | réglages | P | ? | NV | NOT VERIFIED |
| `/settings/account` | compte | identité | P | succès serveur corrigé ; autres NV | action de photo factice retirée | PARTIAL |
| `/settings/notifications` | compte | préférences | P | ? | NV | NOT VERIFIED |
| `/settings/privacy` | compte | confidentialité | P | ? | NV | NOT VERIFIED |
| `/settings/support` | compte | aide | P | ? | NV | NOT VERIFIED |
| `/settings/subscription` | artiste | Premium Stripe | P | ? | paiement test non vérifié | NOT VERIFIED |
| `/settings/delete-account` | compte | suppression | P | ? | NV | NOT VERIFIED |
| `/legal/terms` | public | CGU | P | ? | NV | NOT VERIFIED |
| `/legal/privacy-policy` | public | données personnelles | P | ? | NV | NOT VERIFIED |
| `/admin` | admin | modération | P | ? | permissions réelles NV | NOT VERIFIED |

## Écarts classés

1. **P1 — Références du brief** : sélection de trois images, compression JPEG, plafond 10 Mio, stockage sous l'identifiant de la demande et lecture signée depuis le bucket privé implémentés. Un échec après création conserve l'identifiant dans la session et permet de réessayer sans dupliquer le brief. Le dossier liste les fichiers déjà déposés, y compris après réouverture. Les quatre tests ciblés couvrent les chemins privés, la limite, la signature et les erreurs. Une reprise du téléversement **après fermeture de l'application**, l'expiration des liens pendant une longue session, le nettoyage fin des fichiers et la validation avec deux vrais comptes restent à faire. La table historique `request_references` n'est pas alimentée par ce nouveau flux : le chemin dans le bucket est la source de vérité. Aucun accès réel n'a été testé.
2. **P1 — Validation des écritures** : le compte et la fin d'onboarding annonçaient un succès avant la réponse serveur. Corrigé dans cette branche ; validation avec un backend de test encore requise.
3. **P1 — Aperçus recherche** : une limite globale pouvait masquer le portfolio des derniers artistes d'une page. Un RPC à quota par artiste, avec index et test SQL, est préparé. La migration doit précéder le client.
4. **P2 — Studio** : les chiffres précédaient les demandes à traiter. Ordre et hauteur de titre ajustés ; validation avec un compte artiste chargé encore requise.
5. **P2 — Actions factices** : lien App Store `id000000000` et commande photo ouvrant seulement une alerte retirés. Il reste à concevoir une vraie modification de photo.
6. **P1 — Écart de schéma connecté** : l'historique du projet actif et le dépôt ne concordent pas. Ne pas appliquer aveuglément les migrations du dépôt au projet actif.
7. **P2 — Hydratation du profil** : ouverture directe d'un profil réel : erreur React `#418` puis rendu normal. Vérifier la différence entre HTML statique et état client avant publication.

## Validation restante avant de qualifier la V5 de complète

Parcours client et artiste avec comptes de test, stockage privé avec un tiers non autorisé, paiements Stripe en mode test, alertes, états de données vides et chargées, zoom 200 %, clavier, VoiceOver/TalkBack, appareils natifs, performance mesurée et essais avec tatoueurs. L'absence de ces preuves interdit de déclarer les missions A et B achevées.
