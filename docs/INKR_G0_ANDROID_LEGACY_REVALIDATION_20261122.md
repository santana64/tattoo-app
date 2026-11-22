# INKR — G0 : contre-audit de l'APK v4 et compatibilité V5 (22/11/2026)

## Verdict

**G0 HOLD : le parcours métier complet de l'ancien APK v4 n'est toujours pas démontré sur le backend V5.** Le risque est concret : le backend V5 staging refuse les écritures directes dans `appointments`, et les RPC de réservation de la version actuelle n'apparaissent pas parmi les chaînes de bytecode Hermes du vrai APK historique. Cela ne suffit toutefois pas à prouver quel chemin exact utilise le vieux binaire ni s'il a été distribué à des utilisateurs.

## Observations vérifiées

1. **Binaires réels** sur `pucci` :
   - APK historique Android `versionCode=4` (`historical-apk-from-BOOK-20261121.apk`), SHA-256 `a2b04e1a2bfff6cf5385affa7765295ba19ad186196eea4594cbd71d9360ae2b`.
   - Preview EAS Android `versionCode=5` (`inkr-eas-preview-v5-20261121.apk`), SHA-256 `93485a89e996e4aecb873cb94a4bac5df437535b72c0a31554467dc1aa5d7aca`.
   - La vérification antérieure a établi certificat identique, upgrade Android 11 **v4→v5 sans désinstallation**, UID conservé et écran public v5 lançable : `docs/INKR_G0_ANDROID_V4_V5_UPGRADE_20261121.md`. Ce test **n'établit pas** la compatibilité des anciens appels métier.
2. **Inventaire EAS** issu du véritable historique JSON authentifié le 21/11 : **7 builds internes v4 terminés, 2 internes annulés, 1 build v4 destiné au Store terminé**. **0 soumission EAS** dans l'inventaire précédent. La présence de `distribution=STORE` ne prouve pas que Google Play ait publié cette version ou qu'un utilisateur l'ait installée. Voir `docs/INKR_G0_EAS_DISTRIBUTION_INVENTORY_20261121.md`.
3. **Traçabilité du code source** : les SHA des commits historiques EAS utilisés par les vrais builds v4 ne peuvent plus être récupérés via les références du dépôt GitHub courant (API 404 sur ces SHA). Le code source `main` actuel ou celui du dossier local récent ne peut donc pas être présenté comme la preuve du code exact contenu dans ces APK.
4. **Inspection statique approfondie** sur `pucci` : l'ancien `assets/index.android.bundle` est du bytecode Hermes. Un `hermesc -dump-bytecode` en lecture seule a produit une désassemblage local de **71 413 982 octets**, sans extraction de données personnelles et avec suppression du bundle binaire temporaire. On y trouve les chaînes `supabase` et `appointments`; pas de chaîne `respond_to_appointment`, `propose_appointment` ou `updateAppointment`. Cette absence est **un indice**, pas une preuve du graphe d'appel à l'exécution, d'un accès direct UPDATE ou du backend réellement ciblé.
5. **Staging API réel** : le test conservateur sur la table `public.appointments` avec JWT **artiste QA authentifié** et UUID inexistant, pour éviter d'altérer une vraie réservation, a obtenu **HTTP 403 / SQLSTATE 42501** en tentant une écriture directe de style ancien. Rapport privé `g0-legacy-direct-update-denial-20261121.json`. Les restrictions RPC de V5 ne doivent pas être contournées en rouvrant UPDATE ou la visibilité des images privées.
6. **Banc Android du 22/11** : démarrage d'un émulateur QA Android 11 dédié pour inspection de l'environnement. Un paquet `com.inkr.tattoo` était déjà présent sur cette instance ; l'installation a été préservée. En absence de destination backend anciennement vérifiée, l'APK v4 **n'a pas été lancé contre un serveur potentiellement de production**. Émulateur arrêté après contrôle.

## Preuve nécessaire pour G0 = GO

- Vérifier dans **Google Play Console** les tracks publiés, les versions réellement actives et les appareils ; compléter avec tout APK distribué manuellement, liens publics, gestion des versions EAS/OTA, TestFlight.
- Soit reproduire sur staging les **vrais parcours** de l'ancien binaire v4 avec une destination backend prouvée non-production (request, conversation, proposition/confirmation de rendez-vous, médias privés), soit publier et **vérifier** une mise à jour imposée/une barrière de version minimale **avant** les migrations qui suppriment des permissions historiques.
- Si des anciens utilisateurs existent, définir et valider leur chemin de mise à jour **sans perte de données**. Ne pas inférer l'absence d'installations d'après l'absence de soumission EAS.

**G0 = HOLD, PR #3 = DRAFT, production inchangée.**
