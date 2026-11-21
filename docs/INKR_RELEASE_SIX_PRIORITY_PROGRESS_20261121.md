# INKR — contre-audit des six chantiers de clôture, 21 novembre 2026

**Périmètre :** PR #3 (`codex/inkr-v5-1-optional-deposits`), Supabase staging `lsewxsdulunuuzmszegm`, compte séparé Stripe TEST `acct_1Ubxk0BIelrUrSJe`, ordinateurs QA `pucci` et `BOOK-OOU94V899O`. **Production non modifiée. PR DRAFT. Décision NO-GO.**

Ce rapport distingue les opérations effectivement réussies des vérifications que les accès disponibles ne permettent pas encore de terminer. Les contrôles d'exécution préexistants sont signalés séparément des nouveaux tests du présent contre-audit.

| Priorité | Résultat prouvé | Résultat encore manquant | Gate |
| --- | --- | --- | --- |
| 1 — APK historiques v4 | APK v4/v5 réels, même certificat, versionCode 4→5, upgrade Android 11 réussi et UID conservé ; changement avéré des droits `appointments` entre production et staging et refus HTTP 403 des écritures directes dans staging ; inventaire officiel EAS déjà consigné | **Aucune preuve** qu'un APK v4 réellement distribué effectue correctement son parcours rendez-vous contre les migrations V5 ; absence de traçabilité Play Console / APK manuels ; impossible de déduire son backend cible du bundle Hermes | **G0 HOLD** |
| 2 — Stripe TEST | Campagne précédente de carte **fictive** avec clic Checkout Web, redirection HTTPS, activation Premium webhook et après reload, annulation API TEST, retour `normal`. Le 21/11, reconnexion Web réelle par lien magique **après annulation** et CTA gratuit confirmés (7/7). Consultation Stripe : compte TEST, pas de nouveau paiement généré dans cette reprise | **Aucune campagne unique prouvant Premium actif après une nouvelle authentification GoTrue avant annulation** ; ancien scénario bloqué sur OTP, script privé de paiement porte une validation manuelle, preview Vercel protégée non accessible par le lien de QA temporaire. Ne pas confondre rechargement d'une session existante et nouvelle authentification | **G2 HOLD** |
| 3 — Sauvegarde hors site | Dump SQL **21/11** chiffré DPAPI puis AES-GCM, copie chiffrée reçue sur BOOK avec SHA-256 vérifiée, restauration PostgreSQL 17 réelle **PASS** (36 tables, 7 Auth, 3 métadonnées Storage), suppression du clair ; octets des trois objets Storage du 21/11 restaurés également sur BOOK | Aucun téléchargement **OneDrive Web/API** prouvé indépendant des PC ; dossier local OneDrive insuffisant ; aucune récupération de la clé du coffre hors site après perte simultanée des deux machines ; Google Drive et Gmail n'équivalent pas à OneDrive | **G1 HOLD** |
| 4 — Recette et accessibilité | Corrigé le défaut d'activation clavier `div role=link` sur CGU/confidentialité et sur les œuvres accueil/exploration/favoris ; **8/8 assertions clavier PASS** après rebuild Web staging, **9/9 scénarios responsive publics PASS**, `tsc`/lint PASS ; **262/262 tests unitaires** sur la révision précédant seulement l'import `Platform` | Parcours client/artiste/tiers natifs réellement authentifiés sur appareils physiques et iOS/Android, lecteurs d'écran NVDA/VoiceOver/TalkBack, formulaires et états d'erreur complets non certifiés | **G2/G3 HOLD** |
| 5 — Reprise après sinistre | Rejeu sur le dump **frais du 21/11** de **12 migrations SQL V5/V5.1**, **36→38→36** tables et fingerprint stable après `ROLLBACK`, déchiffrement et PostgreSQL éphémère nettoyés | Pas de clone hébergé indépendant, pas de rollback multiservice après COMMIT et écritures concurrentes, ni rétablissement coordonné Auth+Storage+Edge+Web/Stripe. Ne pas écraser staging ou les fonctions Edge de production pour le démontrer | **G4 HOLD** |
| 6 — Publication | PR conservée DRAFT, manifestes G0–G5 conservés HOLD, export Web staging, tests TypeScript/lint et tests unitaires validés selon les bornes ci-dessus ; `release:check` **refuse correctement** le GO avec exit 1 | Tous les workflows GitHub/Vercel **au dernier SHA** doivent être terminés avec conclusion success ; dossier G0–G4 encore incomplet ; approbation explicite du propriétaire absente ; **aucun merge ni déploiement** | **G5 HOLD** |

## Traces complémentaires de ce contre-audit

1. `docs/INKR_G1_FRESH_SQL_20261121_SECOND_HOST_RESTORE.md` — preuve récente de restauration DB sur BOOK.
2. `docs/INKR_G4_FRESH_20261121_SNAPSHOT_ROLLBACK.md` — répétition transactionnelle de 12 migrations sur le dump récent.
3. `docs/INKR_G3_WEB_KEYBOARD_FIX_AND_RECHECK_20261121.md` — régression reproductible et correctifs Web validés après reconstruire.
4. `docs/INKR_G0_G1_G2_FRESH_LOGIN_AND_PRE_CUTOVER_20261121.md` — nouvel OTP en plan gratuit et delta de privilèges v4/V5.
5. `docs/RELEASE_EVIDENCE.json` — contrôle machine des portes G0–G5. **Ne jamais positionner un gate global GO à partir d'un résultat partiel.**

## Dépendances externes à lever sans contournement

- **APK v4** : accès à Google Play Console et au registre des APK transmis manuellement, puis dispositif réellement testé pour installations encore actives ; pas de droits SQL directs ouverts pour les anciens clients.
- **Stripe** : une nouvelle campagne exclusivement Stripe TEST autorisée, avec vérification indépendante de `livemode=false`, paiement fictif, vraie reconnexion pendant que Premium est actif, puis résiliation et UI gratuite.
- **Cloud/clé** : authentification OneDrive Web du propriétaire et téléchargement depuis le cloud, empreintes confrontées aux archives originales ; clé de secours dans un coffre indépendant avec essai sur machine vierge.
- **Devices / accessibilité** : appareils Android et iPhone/iOS QA, lecteurs d'écran et identifiants de test uniquement ; ne pas utiliser les comptes d'utilisateurs réels pour satisfaire la recette.
- **Clone hébergé** : environnement séparé, sans écraser les deux projets en service, destiné à tester DB + Auth + Storage + Edge + Web et rollback des writes post-COMMIT.
- **Release** : ne signer la validation que lorsque tous les gates sont objectivement justifiés et que le commit approuvé correspond au commit testé.

**Décision conservatoire : NO-GO.** Les résultats PASS ci-dessus sont réels mais partiels ; ils ne suffisent pas à déclarer INKR entièrement terminé.
