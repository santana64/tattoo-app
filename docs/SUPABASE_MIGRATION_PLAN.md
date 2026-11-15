# INKR — réconciliation Supabase avant déploiement

État observé en lecture seule le 12 novembre, puis recontrôlé le 15 novembre 2026 sur `jxmefklkixzzdceeorcg`. Ce projet actif n'a reçu ni migration ni donnée de test.

**État G0 détaillé (15/11/2026)** : consulter [l'inventaire vérifié des versions distribuées](G0_CLIENT_DISTRIBUTION_AUDIT.md). Les recherches publiques n'ont identifié aucun paquet mobile pour les identifiants de l'application, mais les canaux privés EAS, Play Console, TestFlight et APK ne sont pas encore audités : **G0 reste NO-GO**.

## Portes de passage P0 — critères GO/NO-GO avant migration active

**Statut au 15 novembre 2026 : NO-GO.** Ce protocole formalise les preuves attendues et ne constitue **pas** une autorisation de migration, de fusion ou de déploiement. Une lecture SQL de contrôle sur `jxmefklkixzzdceeorcg` confirme **deux** rendez-vous `status='proposed'`, la policy `appointments_manage_artist` en `ALL`, les privilèges `INSERT/UPDATE/DELETE` de `authenticated` sur `appointments`, et les deux buckets `healed-photos` / `request-references` en `public=false`. Ne publier aucun identifiant de compte ou de rendez-vous issu de cette inspection.

| Porte | Preuve nécessaire | Décision |
| --- | --- | --- |
| **G0 — Inventaire des clients distribués** | Identifier les versions réellement installées sur Android/iOS, les canaux de mise à jour, la version web active et la possibilité vérifiée d'imposer une version minimale. Documenter les versions qui utilisent encore `appointments.update` côté artiste, `request_references.url` en URL publique et `getPublicUrl` pour `healed-photos`. | **NO-GO** tant que l'existence de clients incompatibles ne peut être exclue ou qu'un blocage/versionnement fiable n'est pas validé. |
| **G1 — Préparation sur copie et sauvegarde** | Snapshot du schéma, grants, fonctions, policies, Storage, historique des migrations et données concernées, restaurabilité contrôlée ; delta SQL objet-par-objet rejoué sur une copie distincte. Vérification des RPC, du journal Stripe et du traitement idempotent. | **NO-GO** sans preuve de restauration et contrôle du delta. Ni `db push` aveugle ni `migration repair` d'après les noms. |
| **G2 — Contrat fonctionnel des anciens clients** | Prouver que tout client autorisé à utiliser les parcours rendez-vous/références/photos emploie le RPC client et des URL signées privées, ou qu'un mécanisme de version minimale refuse proprement l'accès des anciens clients à ces fonctions. Vérifier l'absence de lien public de repli pour les références privées. | **NO-GO** si une version distribuée doit encore confirmer un rendez-vous par `UPDATE` direct ou tente d'afficher un chemin Storage privé comme URL. |
| **G3 — Données existantes et sécurité** | Les **deux rendez-vous proposés** sont préservés ; proposition, acceptation par le client, refus de l'artiste et refus du tiers vérifiés sur copie avec le nouvel ensemble de grants. Idem pour lecture/signature/retrait de références et photos cicatrisées. Aucun artefact de test dans l'actif. | **NO-GO** si le nouveau schéma bloque une confirmation légitime ou expose une image privée. |
| **G4 — Bascule et retour arrière** | Plan ordonné approuvé : version cliente compatible disponible → contrôle de compatibilité → migrations additives revues → migrations restrictives seulement une fois les clients incompatibles exclus → déploiement coordonné et contrôle RLS/Stripe/Storage. Repli applicatif testé qui **ne réouvre pas** un bucket privé ni la policy artiste trop large. | **NO-GO** sans tests, responsabilité de décision et procédure de rollback non permissive. |
| **G5 — Autorisation distincte** | Diff SQL final, preuves G0–G4 et décision explicite du propriétaire autorisant les modifications sur `jxmefklkixzzdceeorcg`. | Aucun changement actif sans cette approbation, même si la CI et le staging sont verts. |

### Prévol reproductible (lecture seule sur l'actif)

```sql
select status, count(*) as total
from public.appointments
group by status order by status;

select policyname, cmd
from pg_policies
where schemaname = 'public' and tablename = 'appointments'
order by policyname;

select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'appointments'
  and grantee = 'authenticated'
  and privilege_type in ('INSERT','UPDATE','DELETE')
order by privilege_type;

select id, public, file_size_limit
from storage.buckets
where id in ('healed-photos', 'request-references')
order by id;
```

**Remarque de sécurité** : ne pas interpréter la réussite d'une requête HTTP `OPTIONS`, d'un export web ou d'une migration sur staging comme preuve de compatibilité des anciens clients. Tester des parcours authentifiés sur une copie avec données représentatives et permissions effectives. L'existence de `status='proposed'` impose un contrôle métier mais ne donne pas l'autorisation de modifier ces lignes.

## Prévol comparatif du 15 novembre — aucune écriture sur l'actif

| Contrôle | Actif `jxmefklkixzzdceeorcg` | Staging `lsewxsdulunuuzmszegm` | Décision de compatibilité |
| --- | --- | --- | --- |
| Historique | 9 migrations | 17 migrations | Les noms et nombres ne prouvent pas l'équivalence ; comparer les objets, puis préparer un delta revu sur une copie. |
| Tables clés | `appointments`, `healed_photos`, `request_references`, `subscriptions`, `tattoo_requests` ont les mêmes ensembles de colonnes observés | Mêmes colonnes, plus `stripe_subscription_events` | Le journal Stripe doit être créé avant le nouveau webhook ; aucune ancienne migration ne doit être rejouée par son numéro. |
| Rendez-vous | `appointments_manage_artist` en `ALL` ; `authenticated` possède `INSERT`, `UPDATE`, `DELETE` ; **2 rendez-vous proposés** | Policy large retirée, ces trois privilèges absents ; transitions par RPC | Le client de `main` (`5c995e1`) propose encore « Confirmer le rendez-vous » côté artiste via `UPDATE` direct. Il échouera après durcissement. Réconcilier ces deux dossiers et le parc de clients réellement distribués avant le retrait. Ne pas réouvrir le droit pour masquer le problème. |
| Références privées | 0 ligne, 0 objet ; pas de policy `DELETE` sur la table ou le bucket ; MIME du bucket libre | Policy de suppression propriétaire, JPEG seulement, trois emplacements, 10 Mio | Le client de `main` lit `request_references.url` comme URL d'image ; la PR y enregistre un chemin privé. Un ancien client ne saura pas afficher une référence nouvelle. Exiger une version cliente compatible ou un protocole de transition qui préserve la confidentialité avant déploiement. |
| Photos cicatrisées | 0 ligne, 0 objet ; bucket privé 20 Mio, MIME libre, aucune policy SELECT Storage | Bucket privé 10 Mio, JPEG/PNG/WebP, SELECT lié aux lignes visibles | Le client de `main` utilise `getPublicUrl` et stocke une URL publique ; il ne sait pas signer une lecture privée. Il faut déterminer les versions encore actives avant de diffuser ce parcours. |
| RPC et privilèges | `artist_portfolio_previews` et `apply_stripe_subscription_event` absents ; `search_artists` et les trois RPC rendez-vous présents | Les deux nouveaux RPC présents ; `apply_stripe_subscription_event` exécutable par `service_role` seulement | Les signatures et les lignes SQL des quatre RPC communs concordent après retrait des espaces de début/fin de ligne. Leurs grants observés concordent ; préserver ces contrats et revoir les deux ajouts sur une copie. |
| Abonnements | 0 statut actif | Abonnement TEST annulé, 0 artiste Premium | Préserver les lignes historiques ; déployer le journal d'événements avant le webhook modifié. |

Les fonctions `search_artists`, `propose_appointment`, `respond_to_appointment` et `complete_appointment` existent sur les deux projets avec la même signature. Leurs `md5(pg_get_functiondef(...))` diffèrent, mais une comparaison ligne par ligne après retrait des espaces de début et de fin donne **les mêmes 64, 39, 34 et 30 lignes respectivement, dans le même ordre**. La différence d'empreinte provient donc de la présentation SQL observée, pas d'une ligne de logique divergente. Exporter malgré tout les définitions, policies et grants au prévol final sur une copie ; les comptages ci-dessus sont un instantané.

La comparaison des policies confirme exactement les ajouts et retraits attendus sur ces parcours : `appointments_manage_artist` existe seulement sur l'actif ; `refs_delete_client`, `inkr_request_refs_delete_client` et `inkr_healed_photos_select_visible` existent seulement sur staging. Les conditions `refs_insert_client`, `inkr_request_refs_insert_client` et `inkr_request_refs_update_client` sont plus strictes sur staging : trois noms JPEG plats autorisés, et `WITH CHECK` explicite pour l'upsert. Les autres policies ciblées ont la même expression normalisée. Le client de `main` utilise déjà `ref_0.jpg` à `ref_2.jpg` et peut donc encore déposer ces fichiers ; son affichage de la métadonnée privée demeure incompatible.

## Écarts vérifiés

| Objet | Projet actif | Dépôt / PR #2 | Conséquence |
| --- | --- | --- | --- |
| Historique | `001_initial` à `009_stories` | `001_initial.sql` à `012_booking_care.sql`, puis migrations horodatées | Les versions numériques ne prouvent pas l'équivalence des contenus. `db push` et `migration repair` sont interdits avant correspondance objet par objet. |
| Recherche | `search_artists(text,text,text,integer,text,integer,integer)` existe | Même contrat appelé par le client | Comparer la définition et les index avant une mise à jour. |
| Aperçus | `artist_portfolio_previews(uuid[],integer)` absent | Migration `20261112193526_balanced_artist_previews.sql` | Le client utilise son repli tant que le RPC manque. |
| Références | Table `request_references(id,request_id,url,created_at)` ; 0 ligne observée | Même table ; la PR enregistre un chemin privé dans `url` | Préparer l'unicité et le nettoyage des lignes orphelines sur une copie avant application. |
| Storage | Bucket `request-references` privé, 10 Mio, 0 objet observé, MIME non restreint | Trois emplacements JPEG, MIME `image/jpeg`, plafond 10 Mio et droits de suppression dans `20261112213805_private_request_reference_lifecycle.sql` | Vérifier les politiques et le service Storage avec trois vrais comptes avant d'autoriser ce changement. |
| Fonctions privilégiées | Conseillers Supabase : fonctions à `search_path` mutable et `SECURITY DEFINER` exécutables par `anon` | Certaines fonctions sont intentionnellement privilégiées | Revue séparée de chaque fonction et de ses grants avant toute reprise de migrations anciennes. |
| Rendez-vous (lecture du 14 novembre) | `authenticated` peut `INSERT`, `UPDATE`, `DELETE` ; policy `appointments_manage_artist` active | Migration `20261114164541_appointment_rpc_only.sql` : ces trois privilèges retirés et policy supprimée, transitions par RPC | **Bloquant sécurité** : le client doit accepter lui-même un créneau. Avant toute application active, vérifier qu'aucun ancien client distribué ne dépend des écritures directes. Le staging refuse déjà la modification directe de l'artiste (403) et conserve la lecture des deux parties. |
| Événements Stripe (lecture du 14 novembre) | `subscriptions` existe ; `stripe_subscription_events` absent | Migration `20261114163800_stripe_subscription_event_order.sql` : journal privé, RPC atomique service role | Appliquer avant la nouvelle version de `stripe-webhook`, sinon le webhook recevra une erreur RPC et Stripe réessaiera. Ne jamais diffuser une clé Stripe dans le client. |
| Photos cicatrisées (lecture du 14 novembre) | Bucket `healed-photos` déjà privé, 20 Mio, 0 objet et 0 ligne ; aucune policy Storage SELECT pour client, artiste ou public | `20261114183000_private_healed_photos.sql` : bucket privé, chemin du propriétaire et SELECT conditionné par la visibilité de `healed_photos` ; URL signée de 60 s côté client | L'ancienne application sauvegarde une URL publique et ne peut pas lire un bucket privé. Déployer ensemble le client qui signe les images et la policy ; tester les anciens chemins avant diffusion. Ne jamais rouvrir le bucket en public pour rétablir l'affichage. |

Les comptes et objets peuvent changer entre cette lecture et un futur déploiement. Refaire tous les prévols à ce moment-là.

## Dépendances et ordre sûr

1. Créer un **projet Supabase de test distinct**, avec clés et comptes propres. Exporter d'abord le schéma, les policies, les fonctions, les grants, les buckets et l'historique du projet actif en lecture seule. Sauvegarder aussi le schéma et les données de l'environnement cible avant tout essai.
2. Construire une table de correspondance entre les neuf migrations actives et les douze migrations numériques du dépôt à partir des objets SQL réels. Vérifier colonnes, contraintes, index, définitions `pg_get_functiondef`, policies et permissions. Aucun ancien fichier numérique ne doit être appliqué par son seul nom.
3. Sur le projet de test, appliquer uniquement les différences **additives et revues** dont les dépendances existent. Le RPC d'aperçus exige `public.posts` avec `artist_id`, `is_published`, `media_type`, `published_at`. La migration des références exige `public.tattoo_requests`, `public.request_references`, `storage.objects` et `storage.foldername`.
4. Avant l'index unique, vérifier `select request_id, url, count(*) from public.request_references where url ~ '^[0-9a-f-]{36}/ref_[0-2]\.jpg$' group by 1,2 having count(*) > 1;`. Résoudre toute collision explicitement sur le test ; ne pas supprimer silencieusement des lignes actives. Vérifier aussi les objets Storage qui utilisent d'autres noms et la présence de lignes orphelines.
5. Exécuter les tests SQL du dépôt, puis les tests **API Storage** avec client propriétaire, artiste destinataire et tiers : upload, liste, URL signée, remplacement, refus d'accès, expiration après une minute, suppression, nouvelle tentative et récupération après réouverture. Vérifier que la table et les objets restent cohérents après chaque erreur injectée.
6. Pointer les deux previews Vercel vers ce projet de test via leurs variables **Preview** (`EXPO_PUBLIC_SUPABASE_URL` et clé publiable), puis vérifier les parcours client et tatoueur dans le navigateur et sur appareils natifs. Aucune preview ne doit utiliser la clé `service_role` ni écrire sur le projet actif.
7. Soumettre le diff SQL final, les résultats des tests et la sauvegarde à revue. Une autorisation distincte est nécessaire avant toute écriture sur le projet actif. Déployer le schéma compatible avant de supprimer le repli client du RPC.

Pour les deux migrations du 14 novembre : vérifier d'abord le contrat des anciens clients sur les rendez-vous, sauvegarder les définitions exactes de `appointments_manage_artist`, les grants et la table `subscriptions`, puis appliquer le retrait des écritures directes seulement après la version cliente utilisant exclusivement les RPC. Appliquer le journal Stripe avant de déployer le webhook modifié. Sur une copie du projet actif, tester l'acceptation client, le refus d'écriture directe artiste, l'annulation, la fin de séance, les livraisons Stripe répétées et désordonnées, puis les droits Premium après reconnexion. Une simple réussite du build ne suffit pas.

Pour `healed-photos`, enregistrer le statut du bucket, les policies Storage, les éventuels chemins historiques et les réponses CDN avant application. Le staging a confirmé : un objet neuf privé refuse l'URL publique (HTTP 400) ; seuls client et artiste obtiennent une URL signée tant que la ligne est privée ; le tiers et l'anonyme sont refusés ; la publication par le client ouvre la signature anonyme, sa dépublication la referme. Une séance fictive a été proposée, acceptée, terminée, puis sa photo supprimée ; zéro ligne et zéro objet restent. Un ancien URL public mis en cache peut néanmoins répondre `HIT` après le passage du bucket en privé, alors que la même URL avec un paramètre inédit est refusée. Prévoir la fenêtre de cache avant toute donnée sensible et ne promettre aucune révocation immédiate des anciens liens.

## Contrôles de compatibilité

- Les deux versions clientes ne sont pas encore compatibles sur les références et photos privées : l'ancienne attend des URL directement affichables, la nouvelle signe des chemins privés. Inventorier les versions réellement distribuées et valider une transition sûre sur une copie avant tout changement actif.
- Les nouvelles politiques Storage doivent laisser **SELECT** aux deux parties, **INSERT/UPDATE/DELETE** au client propriétaire et aucun de ces droits au tiers. L'upsert exige SELECT + UPDATE + INSERT.
- Le dossier ne rend jamais un chemin privé comme URL directe. Les liens signés sont des jetons temporaires : quiconque reçoit le lien peut l'utiliser jusqu'à son expiration, même après déconnexion. Une suppression d'objet doit être vérifiée au niveau du service, y compris avec un ancien lien.
- Tester les comptes existants, demandes sans image, flash épuisé, réponse réseau perdue après insertion, fichiers partiellement déposés et ancienne ligne `request_references.url` avant d'élargir la diffusion.

## Retour arrière

1. En cas de défaut applicatif, revenir au précédent build client et conserver les migrations additives tant que les anciens clients les tolèrent. Le repli de recherche reste disponible.
2. Si une policy bloque un parcours, restaurer **la définition exacte capturée avant migration** sur le projet de test, puis refaire les tests RLS. Ne pas rouvrir par défaut un accès large à `storage.objects`.
   Pour les photos cicatrisées, conserver le bucket privé si la signature échoue ; retirer temporairement leur affichage ou corriger la policy et le client. Un retour à `public = true` exposerait les photos que les clients ont marquées privées et n'est pas un retour arrière acceptable.
3. Le RPC d'aperçus et son index peuvent être retirés uniquement après vérification qu'aucun client ne les appelle. L'index unique des références peut être retiré sans supprimer les lignes. Ne jamais supprimer les fichiers privés ni les demandes pour revenir en arrière.
4. Si un incident touche les données, utiliser la sauvegarde contrôlée de l'environnement cible plutôt qu'une migration inverse destructive. Réévaluer les liens signés déjà émis jusqu'à leur expiration.
5. Pour le journal Stripe, revenir temporairement au webhook précédent seulement après avoir coupé les livraisons ou confirmé sa compatibilité ; conserver la table d'événements et ses données pour permettre la reprise. Pour les rendez-vous, restaurer les grants et la policy précédemment capturés uniquement si une incompatibilité d'ancien client est démontrée, puis couper cette exception après correction ; cette restauration rouvre le risque d'acceptation artiste et exige une décision explicite. Le retour au build applicatif précédent ne rétablit pas à lui seul les anciens privilèges SQL.

## Projet de test créé le 13 novembre

Le devis Supabase était de 0 $/mois sur l'organisation gratuite `bourrico`, qui comptait un projet actif et trois inactifs. Le projet distinct `inkr-v5-staging` (`lsewxsdulunuuzmszegm`, région `eu-west-1`) a été créé, puis les douze migrations numériques et les deux migrations horodatées initiales du dépôt y ont été appliquées dans l'ordre. Les migrations Stripe, rendez-vous et photos cicatrisées privées portent l'historique à **dix-sept** entrées au 15 novembre. Une lecture SQL a confirmé le bucket de références privé, le plafond 10 Mio, le MIME JPEG et les politiques Storage réservées aux rôles authentifiés. Le conseiller de sécurité signale encore deux fonctions au `search_path` mutable et des fonctions `SECURITY DEFINER` exécutables par `anon` ; chaque grant doit être revu selon le contrat public de la fonction avant un changement de sécurité.

Les variables Vercel **Preview** des deux projets ont été orientées vers ce projet et sa clé publiable, sans modifier les valeurs Production. La seconde preview utilise une URL ciblée sur `codex/inkr-v5-completion-excellence` afin de conserver sa variable URL commune aux autres environnements. Les bundles des deux previews du commit `53178ab` ont confirmé la priorité effective de ces variables : URL du projet de test présente, URL du projet actif absente.

Un essai Storage HTTP anonyme a renvoyé un refus RLS à l'upload, aucune URL signée et aucune liste d'objets ; `remove` a renvoyé un succès avec zéro fichier. Cette dernière réponse ne prouve pas une suppression : le client vérifie désormais le propriétaire et l'absence de l'objet avant de retirer la ligne `request_references`. Aucun compte ou objet de test n'a été créé sur le projet actif.

Quatre comptes Auth fictifs ont été créés par l'API officielle Auth Admin dans une fonction temporaire déployée **uniquement** sur `lsewxsdulunuuzmszegm`. La clé d'administration est restée dans l'environnement serveur Supabase ; les identifiants et sessions ne figurent ni dans le dépôt ni dans les journaux. La fonction exigeait un jeton aléatoire et vérifiait l'URL exacte du projet. Elle a immédiatement été remplacée par une version inerte ; un POST ultérieur a répondu HTTP 410. Les rôles client, artiste, tiers et administrateur se connectent avec succès.

Le script opt-in `scripts/staging-private-references.cjs` a exercé l'API hébergée avec ces comptes : demande unique après répétition du même identifiant, lecture artiste, refus du tiers et de l'administrateur hors RPC, trois emplacements JPEG, refus MIME et taille supérieure à 10 Mio, remplacement, URL signée, expiration, fermeture simulée par un nouveau client Auth, suppression, nouvelle tentative et cohérence de `request_references`. Le tiers reçoit parfois HTTP succès avec zéro objet supprimé ; l'objet reste présent. Un lien signé **déjà utilisé** est encore servi depuis le cache après suppression, même avec `cacheControl: 0`. Un lien court cesse de répondre après expiration. Le client émet donc maintenant des liens d'une minute, renouvelés toutes les 45 secondes dans le dossier, et prévient après suppression. La révocation instantanée d'un lien déjà délivré n'est pas garantie par ce mécanisme ; un proxy authentifié sans cache serait nécessaire si elle devient une exigence absolue.

## Limite de preuve actuelle

Les migrations sont testées dans PGlite avec les rôles API simulés et appliquées sur le projet de test hébergé. Le service Storage local n'a pas pu démarrer faute d'espace Docker ; les essais HTTP hébergés à trois identités le remplacent pour les références. Le dossier de références et le rendez-vous proposé/accepté ont aussi été exercés depuis l'interface web. Un Checkout Stripe TEST payé puis annulé a confirmé les transitions de tier en base ; son état Premium après retour visuel et les essais sur appareils natifs restent à vérifier.

Les variables **Preview** Vercel ont été remplacées par l'URL et la clé publiable du projet de test. Les bundles de `53178ab` prouvent que les deux nouvelles previews utilisent ce projet ; les anciens déploiements gardent leurs variables au moment de leur propre construction.
