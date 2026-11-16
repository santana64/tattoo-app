# INKR — sauvegarde préalable et bascule contrôlée

**État au 16 novembre 2026 : NON EXÉCUTÉ / HOLD.** Ce document est un protocole de sécurité, pas une autorisation d'appliquer les migrations au projet actif.

## État réellement constaté

- Projet de production Supabase : `jxmefklkixzzdceeorcg`, PostgreSQL 17, organisme `bourrico` sur **plan Free**.
- Aucune branche Supabase de ce projet n'existe actuellement.
- Les sauvegardes quotidiennes automatiques Supabase sont réservées aux plans payants. Il serait incorrect de supposer qu'une sauvegarde récupérable est disponible sur Free.
- Le clonage intégré « Restore to a New Project » nécessite un plan payant éligible ; il facture un nouveau projet. **Aucun upgrade ni clone payant n'a été déclenché.**
- La commande `supabase` et `pg_dump` ne figurent pas dans le PATH du PC autorisé ; aucune variable `PG*` ou `DATABASE_*` de connexion n'y était configurée. L'accès via le connecteur Supabase autorise des requêtes SQL, mais ne fournit **pas** à lui seul une sauvegarde PostgreSQL restaurable.
- Les données de production vérifiées en lecture seule incluent **2 rendez-vous proposés, 4 demandes et 7 modèles de message**. Les sept tables historiques ont été recensées, leur schéma partiellement reproduit en PGlite et les tests de migration sont passés.

## Voie recommandée sur Free : export logique puis restauration isolée

1. Récupérer la **chaîne de connexion SQL officielle** depuis [Supabase > Connect](https://supabase.com/dashboard/project/jxmefklkixzzdceeorcg?showConnect=true) dans une session propriétaire autorisée. **Ne pas transmettre le mot de passe en chat, GitHub, journaux ou paramètres publics**. Ne pas réinitialiser le mot de passe sans planifier les autres connexions qui en dépendent.
2. Sur une machine ayant les capacités nécessaires, installer et vérifier la version actuelle de la **Supabase CLI**, Docker (ou les outils PostgreSQL compatibles) et un disque chiffré avec espace libre suffisant. Cette préparation est indépendante du projet INKR.
3. Effectuer un export **rôles / schéma / données** avec la procédure officielle [Backup and Restore using the CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore). Ne pas confondre un dump de schéma, un dump de données publiques et une sauvegarde complète des services Supabase.
4. Vérifier les codes de sortie, tailles, empreintes SHA-256, présence des tables, extensions et de toutes les lignes attendues. Conserver les sauvegardes en emplacement **privé et chiffré**, hors dépôt, sans partage non autorisé.
5. Restaurer uniquement dans une **nouvelle base isolée**, sans clients réels ni clés de production dans les applications de recette. Appliquer les migrations V5/V5.1 sur cette copie après sauvegarde du point de départ.
6. Contrôler avant/après : deux rendez-vous proposés avec mêmes identifiants et statuts, quatre demandes, sept modèles de message ; vérifier chaque table et policy historique, FKs, triggers, privilèges, fonctions, contraintes, index et RLS. Les tables d'anciens acomptes et flashs sont vides au relevé, mais leur code historique reste à vérifier.
7. Tester sous identités client/artiste/tiers **autorisées et isolées** : refus d'écriture directe, réservation par RPC, référence privée, messagerie, notifications, acompte externe déclaré et annulation. Exécuter un **essai de restauration / retour arrière** sur la copie.
8. Traiter **séparément** Storage et Auth : les exports standards `supabase db dump` ont des exclusions par défaut ; les objets physiques du Storage ne sont pas inclus dans les sauvegardes de base de données. Suivre la documentation officielle avant de certifier la reprise Auth/Storage.

## Voie alternative

Si l'organisation passe à un plan éligible et accepte les frais annoncés dans le Dashboard, [Restore to a New Project](https://supabase.com/docs/guides/platform/clone-project) peut cloner la base (avec utilisateurs Auth) vers un nouveau projet. Il faut encore copier séparément les objets et réglages Storage, puis reconfigurer les Edge Functions, réglages Auth, clés API, extensions et Realtime. **Une branche de prévisualisation ordinaire ne copie pas les données de production**.

## Distribution des anciens clients — G0

- EAS enregistre dix builds Android historiques (`versionCode=4`), dont huit terminées et deux annulées. Trois anciens liens d'artefact renvoient HTTP 404 et cinq builds terminées n'exposent plus d'artefact. On ne peut pas vérifier leur code signé sur la seule base EAS.
- Le nouvel APK de recette utilise `versionCode=1`. **La future build Android candidate doit porter un code strictement supérieur à 4**, sous réserve de revue des consoles et de la signature ; ne pas manipuler le versionnement distant EAS de production pour effacer la preuve de l'historique.
- Revoir depuis les comptes propriétaires **Google Play Console**, **App Store Connect/TestFlight**, tout partage d'APK/IPA et la cible web active. Une piste `STORE` EAS ne prouve pas une publication réellement disponible.
- Le code historique `main` utilise une mutation directe de rendez-vous que la V5 refuse ; **ne pas rétablir les droits SQL permissifs** pour contourner la migration. Choisir et vérifier une compatibilité ou une exclusion explicite des vieux clients sur une copie.

## Critères de sortie

**G0 :** parc ancien et distribution authentifiés, signatures et version compatibles ou exclusion prouvée.

**G1 :** sauvegarde vérifiée et restauration isolée réussie, tests SQL réels y compris les anciennes structures et les données.

**G2 :** parcours client/artiste/tiers authentifiés validés sur staging et données de copie.

**G3/G4 :** appareils et accessibilité, panne réseau, intégrité des services, sécurité et retour arrière.

**G5 :** approbation de publication séparée, explicite et documentée du propriétaire.

**Jusque-là : HOLD.** Aucun merge `main`, migration `jxmefklkixzzdceeorcg`, release store ou changement de domaine en production sans décision distincte.
