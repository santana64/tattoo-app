# INKR — réconciliation Supabase avant déploiement

État observé en lecture seule le 12 novembre 2026 sur `jxmefklkixzzdceeorcg`. Ce projet actif n'a reçu ni migration ni donnée de test.

## Écarts vérifiés

| Objet | Projet actif | Dépôt / PR #2 | Conséquence |
| --- | --- | --- | --- |
| Historique | `001_initial` à `009_stories` | `001_initial.sql` à `012_booking_care.sql`, puis migrations horodatées | Les versions numériques ne prouvent pas l'équivalence des contenus. `db push` et `migration repair` sont interdits avant correspondance objet par objet. |
| Recherche | `search_artists(text,text,text,integer,text,integer,integer)` existe | Même contrat appelé par le client | Comparer la définition et les index avant une mise à jour. |
| Aperçus | `artist_portfolio_previews(uuid[],integer)` absent | Migration `20261112193526_balanced_artist_previews.sql` | Le client utilise son repli tant que le RPC manque. |
| Références | Table `request_references(id,request_id,url,created_at)` ; 0 ligne observée | Même table ; la PR enregistre un chemin privé dans `url` | Préparer l'unicité et le nettoyage des lignes orphelines sur une copie avant application. |
| Storage | Bucket `request-references` privé, 10 Mio, 0 objet observé, MIME non restreint | Trois emplacements JPEG, MIME `image/jpeg`, plafond 10 Mio et droits de suppression dans `20261112213805_private_request_reference_lifecycle.sql` | Vérifier les politiques et le service Storage avec trois vrais comptes avant d'autoriser ce changement. |
| Fonctions privilégiées | Conseillers Supabase : fonctions à `search_path` mutable et `SECURITY DEFINER` exécutables par `anon` | Certaines fonctions sont intentionnellement privilégiées | Revue séparée de chaque fonction et de ses grants avant toute reprise de migrations anciennes. |

Les comptes et objets peuvent changer entre cette lecture et un futur déploiement. Refaire tous les prévols à ce moment-là.

## Dépendances et ordre sûr

1. Créer un **projet Supabase de test distinct**, avec clés et comptes propres. Exporter d'abord le schéma, les policies, les fonctions, les grants, les buckets et l'historique du projet actif en lecture seule. Sauvegarder aussi le schéma et les données de l'environnement cible avant tout essai.
2. Construire une table de correspondance entre les neuf migrations actives et les douze migrations numériques du dépôt à partir des objets SQL réels. Vérifier colonnes, contraintes, index, définitions `pg_get_functiondef`, policies et permissions. Aucun ancien fichier numérique ne doit être appliqué par son seul nom.
3. Sur le projet de test, appliquer uniquement les différences **additives et revues** dont les dépendances existent. Le RPC d'aperçus exige `public.posts` avec `artist_id`, `is_published`, `media_type`, `published_at`. La migration des références exige `public.tattoo_requests`, `public.request_references`, `storage.objects` et `storage.foldername`.
4. Avant l'index unique, vérifier `select request_id, url, count(*) from public.request_references where url ~ '^[0-9a-f-]{36}/ref_[0-2]\.jpg$' group by 1,2 having count(*) > 1;`. Résoudre toute collision explicitement sur le test ; ne pas supprimer silencieusement des lignes actives. Vérifier aussi les objets Storage qui utilisent d'autres noms et la présence de lignes orphelines.
5. Exécuter les tests SQL du dépôt, puis les tests **API Storage** avec client propriétaire, artiste destinataire et tiers : upload, liste, URL signée, remplacement, refus d'accès, expiration après cinq minutes, suppression, nouvelle tentative et récupération après réouverture. Vérifier que la table et les objets restent cohérents après chaque erreur injectée.
6. Pointer les deux previews Vercel vers ce projet de test via leurs variables **Preview** (`EXPO_PUBLIC_SUPABASE_URL` et clé publiable), puis vérifier les parcours client et tatoueur dans le navigateur et sur appareils natifs. Aucune preview ne doit utiliser la clé `service_role` ni écrire sur le projet actif.
7. Soumettre le diff SQL final, les résultats des tests et la sauvegarde à revue. Une autorisation distincte est nécessaire avant toute écriture sur le projet actif. Déployer le schéma compatible avant de supprimer le repli client du RPC.

## Contrôles de compatibilité

- Deux versions du client doivent fonctionner pendant la transition : l'ancienne peut lire les demandes et la nouvelle sait lister les fichiers privés même si une ligne de métadonnées manque.
- Les nouvelles politiques Storage doivent laisser **SELECT** aux deux parties, **INSERT/UPDATE/DELETE** au client propriétaire et aucun de ces droits au tiers. L'upsert exige SELECT + UPDATE + INSERT.
- Le dossier ne rend jamais un chemin privé comme URL directe. Les liens signés sont des jetons temporaires : quiconque reçoit le lien peut l'utiliser jusqu'à son expiration, même après déconnexion. Une suppression d'objet doit être vérifiée au niveau du service, y compris avec un ancien lien.
- Tester les comptes existants, demandes sans image, flash épuisé, réponse réseau perdue après insertion, fichiers partiellement déposés et ancienne ligne `request_references.url` avant d'élargir la diffusion.

## Retour arrière

1. En cas de défaut applicatif, revenir au précédent build client et conserver les migrations additives tant que les anciens clients les tolèrent. Le repli de recherche reste disponible.
2. Si une policy bloque un parcours, restaurer **la définition exacte capturée avant migration** sur le projet de test, puis refaire les tests RLS. Ne pas rouvrir par défaut un accès large à `storage.objects`.
3. Le RPC d'aperçus et son index peuvent être retirés uniquement après vérification qu'aucun client ne les appelle. L'index unique des références peut être retiré sans supprimer les lignes. Ne jamais supprimer les fichiers privés ni les demandes pour revenir en arrière.
4. Si un incident touche les données, utiliser la sauvegarde contrôlée de l'environnement cible plutôt qu'une migration inverse destructive. Réévaluer les liens signés déjà émis jusqu'à leur expiration.

## Limite de preuve actuelle

Les migrations sont testées dans PGlite avec les rôles API simulés. Le démarrage du service Supabase Storage local a échoué pendant l'extraction Docker (`no space left on device`) ; ce test ne prouve donc pas le comportement HTTP du service ni l'expiration effective des liens. Aucun environnement Supabase de test distinct et aucun trio de comptes de test n'est disponible à ce stade.
