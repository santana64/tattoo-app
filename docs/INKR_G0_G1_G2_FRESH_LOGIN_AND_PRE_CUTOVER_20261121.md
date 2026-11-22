# INKR — vérification complémentaire G0, G1, G2 (21/11/2026)

**Périmètre :** recette locale Web branchée à Supabase staging, comparaison des grants SQL en lecture seule, inspection Supabase production. **PR #3 DRAFT ; G0 à G5 HOLD.** Aucun paiement réel ni modification des données de production.

## G2 : reconnexion Web réelle après annulation Stripe TEST — PASS ciblé

Après la recette Stripe TEST précédente (paiement fictif → retour automatique HTTPS → Premium après webhook → annulation API), une **nouvelle authentification GoTrue** a été exécutée sur l'interface Web locale connectée au staging.

Rapport privé sur `pucci` :
`%LOCALAPPDATA%\INKR-QA\clone\premium-test-revocation-ui-20261121.json`

- Campagne de 21:26:32 à 21:26:57 UTC, résultat exact **`PASS_PREMIUM_REVOKED_UI_STRIPE_TEST`**, **7 contrôles réussis sur 7**.
- Nouveau lien magique reçu par Gmail, lien d'origine vérifié vers `lsewxsdulunuuzmszegm.supabase.co/auth/v1/verify`.
- Échange PKCE effectif, session Supabase signée réellement obtenue dans le navigateur.
- La page abonnement affiche le bouton **« Passer à Premium · 19 € par mois »** après l'annulation de l'abonnement TEST, puis après rechargement.
- Aucune exception JavaScript de page observée. Le lien OTP n'a été conservé que temporairement sur le poste de QA et a été supprimé après consommation.

**Limite :** ceci prouve la **reconnexion en formule gratuite après annulation**. Cela ne prouve **pas** une nouvelle connexion quand Premium est encore actif *dans la même campagne de paiement*. Le champ `stripe_test_premium_after_fresh_goTrue_relogin_verified` reste **false**. Pas de modification sur Stripe LIVE, pas de nouvelle carte fictive débitée dans cette vérification.

## G0 : confirmation du changement de privilèges incompatible avec les écritures directes

Interrogations SQL **read-only** distinctes :

| Contrat sur `public.appointments` pour `authenticated` | Production `jxmefklkixzzdceeorcg` | Staging `lsewxsdulunuuzmszegm` |
| --- | --- | --- |
| `has_table_privilege(..., 'INSERT')` | **true** | **false** |
| `has_table_privilege(..., 'UPDATE')` | **true** | **false** |
| RPC `respond_to_appointment` présente | true | true |

Le test négatif HTTP effectué précédemment sur staging avec un vrai JWT artiste, en ciblant un UUID fictif inexistant, confirme **403 / SQLSTATE 42501** en tentative d'UPDATE direct. C'est un **changement de contrat effectif** et un risque pour tout client historique qui persiste par écriture directe.

Le bytecode Hermes de la v4 analysée ne contient pas les nouveaux noms des RPC V5 ; il n'est toutefois pas démontré que l'ancienne installation appelle effectivement ces écritures contre la production ni qu'elle est encore distribuée. La compatibilité applicative v4 reste **HOLD**. **Ne jamais restaurer les droits INSERT/UPDATE directs ou ouvrir les images privées pour résoudre ce problème**.

## G1 : SQL récent et copie indépendante restent manquants

- Inspection du projet Supabase : `inkr`, région `eu-west-1`, PostgreSQL 17, statut `ACTIVE_HEALTHY`, organisation sur offre **Free**.
- Snapshot d'inventaire SQL de la production à **2026-11-21 21:27:28 UTC** (lecture seule) : 36 tables `public`, 2 rendez-vous, 4 demandes, 7 utilisateurs Auth, 3 métadonnées Storage, 8 buckets. Ces **comptages** égalent ceux de la restauration SQL du 17/11, mais **ils ne prouvent pas l'identité des données ni des schémas actuels**.
- Dernier `pg_dump` chiffré effectivement présent sur `pucci` : **17 novembre 2026**. Aucun nouveau fichier SQL du 21 novembre n'a été observé.
- Les restaurations physiques du dump du 17/11 et des trois fichiers Storage du 21/11 ont déjà réussi sur un second ordinateur. Cela démontre la capacité à rétablir ces archives historiques, non un point de reprise SQL courant.
- Le programme existant `Open-INKR-SecureBackupPrompt.ps1` a été ouvert sur `pucci` pour solliciter **localement**, dans une boîte masquée, le mot de passe PostgreSQL requis à `pg_dump`. À la date de ce contrôle, l'export n'avait pas été achevé. **Aucun secret ne doit être saisi dans GitHub ou ChatGPT.**
- Une copie récupérée depuis un véritable service cloud hors site avec SHA-256 indépendamment vérifié demeure également absente.

## Décision

- **G0 HOLD** : connaître les installations réellement distribuées / actives, tester la v4 dans un backend isolé ou formaliser une migration forcée sûre.
- **G1 HOLD** : obtenir un dump SQL frais et chiffré via accès PostgreSQL local, restaurer sur second hôte, tester l'archive depuis une **source distante** et vérifier la récupération des clés.
- **G2 HOLD** : preuve supplémentaire du retour au plan gratuit après nouvelle authentification réussie ; **reste** la reconnexion pendant Premium et la campagne unifiée complète. Autres critères G2 indépendants inchangés.
- **G3, G4, G5 HOLD**, aucune autorisation de merge ou de mise en production.
