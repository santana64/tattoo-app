# INKR V5.1 — Matrice de recette étendue (21 novembre 2026)

## Règles de preuve

Périmètre : PR #3, branche `codex/inkr-v5-1-optional-deposits`, staging Supabase `lsewxsdulunuuzmszegm` exclusivement. Production `jxmefklkixzzdceeorcg` et PR principale **HOLD** : aucun déploiement, fusion, écriture ni changement de configuration.

Statuts : **PASS** = preuve actuelle liée à une exécution; **PASS LOCAL** = test PGlite isolé, non équivalent à Auth/PostgREST hébergé; **PASS SQL** = lecture hébergée avec rôle simulé, non équivalent à JWT signé; **PARTIEL** = sous-cas seulement; **À EXÉCUTER** = aucune preuve; **BLOQUÉ** = dépendance concrète indisponible.

## Résultats automatiques observés

- CI GitHub sur `a26c9fb` : **248 tests Node réussis, 0 échec**, lint, TypeScript, export web et bundles natifs. https://github.com/santana64/tattoo-app/actions/runs/44880078166
- Recette Android 15 et iOS 18.5 sur un commit commun **fb8f33f** : PASS pour les **parcours publics** (pas comptes connectés) : https://github.com/santana64/tattoo-app/actions/runs/44807630025 ; https://github.com/santana64/tattoo-app/actions/runs/44807629798
- Tests native du dernier `a26c9fb` : résultat à renseigner une fois les jobs terminés. Ne pas réutiliser un ancien PASS comme validation du nouveau code.
- PostgreSQL staging : 31/31 tables applicatives avec RLS, refus en lecture des données privées d'anon et d'un utilisateur extérieur simulé. Les lectures n'ont produit aucune écriture. **Test SQL, pas JWT HTTP réel.**
- L'analyseur Supabase avertit sur 25 FK non indexées, 55 évaluations RLS non optimisées, 50 politiques permissives multiples, 5 index inutilisés, et Auth « leaked password protection » désactivé. Ces avis exigent examen mais ne prouvent pas à eux seuls une exploitation ou une panne.

## Matrice fonctionnelle, sécurité et résilience

| ID | Domaine | Scénario d'acceptation | État au 21/11 |
| --- | --- | --- | --- |
| PUB-01 | Navigation publique | Installer, démarrer et ouvrir l'accueil sur Android 15 | PASS (fb8f33f) |
| PUB-02 | Navigation publique | Démarrer iOS et naviguer sur l'interface via Maestro | PASS (fb8f33f) |
| PUB-03 | Navigation publique | Artistes réels de staging chargés, recherche, page de connexion | PASS (fb8f33f) |
| PUB-04 | Robustesse Android | Trois allers-retours accueil/recherche sans crash natif | PASS (fb8f33f) |
| PUB-05 | Cycle natif | Reprise d'arrière-plan, redémarrage à froid, callback Auth invalide | PASS (smoke dédié, fb8f33f) |
| PUB-06 | Web | Chromium/Firefox/WebKit, 360/768/1440px, navigation et captures | À EXÉCUTER (nouveau workflow) |
| PUB-07 | Web | Aucun débordement horizontal ni erreur JavaScript non capturée | À EXÉCUTER (nouveau workflow) |
| PUB-08 | Web | Rafraîchir les liens profonds / artiste sur navigateur | À EXÉCUTER |
| PUB-09 | Accessibilité | Zoom à 200 %, texte système agrandi, clavier seul, lecteur d'écran | À EXÉCUTER |
| PUB-10 | Accessibilité | Mise au point, contrastes, annonces d'erreur, reduced motion | À EXÉCUTER |
| AUTH-01 | Auth | Connexion client réelle via PKCE, reconnexion après kill complet | BLOQUÉ (session client native absente) |
| AUTH-02 | Auth | Connexion artiste réelle, rôle et profil persistants | BLOQUÉ (JWT artiste absent) |
| AUTH-03 | Auth | Compte tiers distinct refusé sur lien privé | BLOQUÉ (session tiers absente) |
| AUTH-04 | Auth | Déconnexion, changement de compte, absence de fuite de cache | À EXÉCUTER sur appareils |
| AUTH-05 | Auth | Réponse à un callback OAuth refusé | PASS Android/iOS public (pas login réel) |
| AUTH-06 | Auth | Token expiré/révoqué, rafraîchissement, reprise offline | À EXÉCUTER |
| AUTH-07 | Auth | URL de retour encodée, traversal, redirection externe | PASS LOCAL (tests Node sur a26c9fb) |
| AUTH-08 | Auth | Session native persistée dans SecureStore avec Unicode/valeurs longues | PASS LOCAL (Node + smoke natif public) |
| RLS-01 | Confidentialité | Anonyme ne voit ni rendez-vous, ni messages, ni demandes | PASS SQL staging (lecture sous anon) |
| RLS-02 | Confidentialité | Anonyme ne voit aucune référence ni Storage privé | PASS SQL staging |
| RLS-03 | Confidentialité | Tiers synthétique ne voit aucune donnée privée | PASS SQL staging (auth.uid simulé) |
| RLS-04 | Confidentialité | Colonnes email/admin/ban/trust_score sans SELECT client | PASS SQL staging (permissions de colonne) |
| RLS-05 | Confidentialité | Fonction admin refuse écriture non administrateur | PASS LOCAL (PGlite), signature de fonction inspectée |
| RLS-06 | Confidentialité | Accès tiers refusé avec vrai JWT sur demandes/Storage | À EXÉCUTER |
| RLS-07 | Confidentialité | Modification frauduleuse d'identifiants dans les requêtes | PASS LOCAL (PGlite) / À EXÉCUTER JWT réel |
| RLS-08 | Confidentialité | Un artiste ne peut pas se donner Premium/verified | PASS LOCAL et grants staging, JWT réel à exécuter |
| REQ-01 | Dossier | Brief client + jusqu'à trois JPEG fictifs, persistance | PASS LOCAL (Node/PGlite), UI réelle à exécuter |
| REQ-02 | Dossier | Refuser une quatrième image, objet trop volumineux / MIME inattendu | PASS LOCAL, UI réelle à exécuter |
| REQ-03 | Dossier | Upload privé, puis retrait; nettoyage Storage et metadata | PASS LOCAL, UI réelle à exécuter |
| REQ-04 | Dossier | Coupure réseau pendant upload, reprise idempotente | À EXÉCUTER |
| REQ-05 | Dossier | Refus artiste, demande périmée et double validation concurrente | À EXÉCUTER |
| MSG-01 | Messages | Client ↔ artiste, conservation du fil, pas de doublon | PASS LOCAL, UI réelle à exécuter |
| MSG-02 | Messages | Interdiction à un utilisateur tiers d'écrire dans un fil | PASS LOCAL, JWT réel à exécuter |
| MSG-03 | Messages | Offline/retry, marquer lu, répétitions et changement de compte | PARTIEL (Node), UI réelle à exécuter |
| RDV-01 | Agenda | Proposition, acceptation côté client, clôture côté artiste | PASS LOCAL, UI réelle à exécuter |
| RDV-02 | Agenda | Chevauchement d'horaires confirmé refusé par contrainte | PASS LOCAL + contrainte staging vérifiée |
| RDV-03 | Agenda | Rendez-vous passé et bornes invalides sont rejetés | PASS LOCAL (Node), UI réelle à exécuter |
| RDV-04 | Agenda | Passage heure été/hiver, fuseau, heures inexistantes | PASS LOCAL (Node a26c9fb), UI réelle à exécuter |
| RDV-05 | Agenda | Annulation client/artiste, report, préavis minimal | PASS LOCAL (PGlite), UI réelle à exécuter |
| RDV-06 | Agenda | Double acceptation simultanée / demandes concurrentes | À EXÉCUTER |
| DEP-01 | Acomptes | Acompte manuel/externe entièrement facultatif | PASS LOCAL (PGlite), UI réelle à exécuter |
| DEP-02 | Acomptes | Validation du montant 1–10 000 €, URL whitelist HTTPS | PASS LOCAL, constraints staging présentes |
| DEP-03 | Acomptes | Client ou tiers interdit d'émettre l'acompte | PASS LOCAL, JWT réel à exécuter |
| DEP-04 | Acomptes | Clôture, annulation rendez-vous, notification, anti-doublon | PASS LOCAL, JWT/UI réels à exécuter |
| DEP-05 | Acomptes | Aucune fausse déclaration de paiement confirmé | À EXÉCUTER en UI |
| PAY-01 | Stripe TEST | Checkout mensuel TEST, webhook, passage Premium puis annulation | PARTIEL (recette du 15/11 dans docs/RECETTE_METIER_STAGING.md) |
| PAY-02 | Stripe TEST | Abandon/refus, montant annuel, webhook en retard | PARTIEL (Node; parcours réel à exécuter) |
| PAY-03 | Stripe TEST | Retour authentifié UI après redirection, sans Premium optimiste | À EXÉCUTER |
| PAY-04 | Stripe TEST | Webhooks rejoués, désordonnés, signature invalide | PASS LOCAL, retest hébergé à exécuter |
| NOTIF-01 | Notifications | Notification en base à la bonne partie, sans double envoi | PASS LOCAL (PGlite), livraison réelle à exécuter |
| NOTIF-02 | Notifications | Permission refusée/accordée, push iOS et Android | BLOQUÉ (appareils/jetons push requis) |
| SOC-01 | Social | Favoris, suivi, réactions, stories, flash et guest spots | PASS LOCAL (tests Node/PGlite), UI réelle à exécuter |
| SOC-02 | Social | Média non publié inaccessible à un tiers | PASS LOCAL / JWT réel à exécuter |
| SOC-03 | Social | Photo cicatrisée privée par défaut, partage réversible | PASS LOCAL / appareils à exécuter |
| ACC-01 | Comptes | Suppression de compte et données associées | PARTIEL (TEST staging antérieur; UI native à exécuter) |
| ACC-02 | Comptes | Compte suspendu empêché de gérer un acompte | PASS LOCAL (PGlite) |
| SEC-01 | API | Toutes les tables publiques RLS on | PASS SQL staging |
| SEC-02 | API | Les Edge Functions CHECKOUT et DELETE exigent JWT | PASS configuration staging; autorisation métier à exécuter |
| SEC-03 | API | Webhook Stripe authentifie les événements signés | PARTIEL (code + tests Node) |
| SEC-04 | API | Vérification systématique de chaque SECURITY DEFINER | PARTIEL : fonctions admin inspectées, 26 avis restant à examiner |
| SEC-05 | API | Protection contre les mots de passe compromis | À CONFIGURER : avis Auth staging |
| PERF-01 | Performance | Réponse P95/P99 sur recherche, fils, images et API | À EXÉCUTER (charges dédiées, jeu de données non négligeable) |
| PERF-02 | Performance | Absence de requête répétitive et index pertinents | À EXAMINER : 25 FK non indexées |
| PERF-03 | Performance | RLS sans surcoût inutile à grand volume | À EXAMINER : 55 initplans / 50 policies multiples |
| REL-01 | Compatibilité | Ancien APK Android / versionCode / signature de mise à jour | BLOQUÉ G0 |
| REL-02 | Données | Sauvegarde portable, restore isolé et intégrité Storage | BLOQUÉ G1 |
| REL-03 | Distribution | TestFlight/Play Console / appareil physique | BLOQUÉ G3 |
| REL-04 | Retour arrière | Retrait d'une version, migration, restauration Storage | BLOQUÉ G4 |
| REL-05 | Gouvernance | Approbation explicite propriétaire | BLOQUÉ G5 |

**Verdict** : G0–G5 restent **HOLD**. Ne pas valider production sur la base de CI + smoke public. Cette matrice documente les preuves existantes, ne transforme pas des tests manquants en réussite, et exclut expressément l'environnement de production.
