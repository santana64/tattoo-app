# INKR PR #3 — G2 : vraie recette Web client ↔ artiste (21/11/2026)

## Verdict ciblé
**PASS** pour les parcours client et artiste dans la vraie preview Vercel, avec authentification réelle, intégration, trois références Storage privées, demande, acceptation, messagerie bidirectionnelle et proposition/confirmation d'un rendez-vous. **G2 global HOLD** : le cycle Stripe TEST complet et les parcours équivalents authentifiés Android/iOS restent non prouvés.

**Périmètre :** preview `tattoo-app-4gmu-6w3310ryl-santana64s-projects.vercel.app`, commit `6ac997eb57c32f4d08f7da03e5f8bf6d464249c9`, Supabase **staging uniquement** `lsewxsdulunuuzmszegm`. Les identités QA appartiennent à des comptes de test contrôlés. Les jetons OTP, JWT, cookies et images de test **ne sont pas versionnés**.

## Authentification et intégration (vraie UI)
- Deux e-mails de connexion ont été déclenchés à partir de la **vraie page `/sign-in`**, puis reçus dans la boîte QA. Les vrais liens GoTrue ont redirigé dans l'interface de preview et ont créé des sessions Supabase persistantes dans le navigateur : **4/4 contrôles** par rôle.
- L'artiste QA a terminé les **5 étapes du wizard** avec une formule gratuite, sans téléversement de portrait : **8/8**, accès ensuite à `/inbox`. Le client QA a terminé les 3 étapes : **5/5**, accès ensuite à `/projects`.
- La reconnexion après **fermeture du contexte navigateur, réouverture avec storageState et rechargement Web** est **4/4 PASS** sur les deux rôles (l'authentification native et le logout restent à tester).
- Les pages privées de l'artiste `/inbox`, `/messages`, `/agenda` sont navigables avec le véritable JWT ; un premier test préalable avait échoué correctement sur l'assistant d'intégration non encore terminé. Ne pas confondre ce blocage de configuration et un défaut de l'application.

## Parcours métier réel entièrement exécuté
1. **Client, formulaire 4 étapes** `/request/new` : type Nouveau tatouage, zone Avant-bras, taille M, budget 150–300 €, style Fine line, couleur Noir et gris, description de QA identifiée. Trois véritables JPEG artificiels neutres ont été sélectionnés via le sélecteur de fichiers de l'interface, puis la demande a été envoyée. **8/8 assertions UI PASS**.
2. **Preuve SQL staging indépendante** : 1 demande réelle au statut `submitted`, **3 lignes `request_references` et 3 véritables objets dans le bucket privé `request-references`**.
3. **Artiste, détail de demande réel** : les trois images se sont effectivement chargées comme `img` Web de largeur naturelle positive (1200) depuis Supabase staging, sans réponse HTTP d'erreur sur les objets vérifiés. Artiste a cliqué **Accepter la demande** ; SQL : `status=accepted`. **5/5 assertions UI PASS**.
4. **Messagerie Web** : artiste envoie un message, client le reçoit et lui répond depuis la vraie conversation. SQL : **2 messages**, **2 expéditeurs distincts**, chacun avec le marqueur attendu.
5. **Agenda Web** : artiste ouvre le panneau `Proposer un créneau`, sélectionne **24 novembre 2026 à 14 h, heure de Paris**, durée 2 h, envoie la proposition. **5/5 assertions UI PASS** et SQL `appointments.status=proposed`. Le client ouvre le même dossier et clique **Accepter ce créneau**. **3/3 assertions UI PASS**, SQL `appointments.status=confirmed`, créneau 14 h–16 h (Paris).
6. **Nettoyage ciblé par le vrai client Web** : les trois images ont été retirées par les contrôles `Retirer la référence`, et l'interface a affiché 3→2→1→0 références. SQL a confirmé **0 ligne de référence et 0 objet Storage privé** restant. La demande QA et ses 2 messages + 1 rendez-vous ont ensuite été effacés par une transaction **strictement filtrée sur le marqueur exact, le statut confirmé et les comptes attendus** ; contrainte FK `ON DELETE CASCADE`. SQL indépendant final : **0 demande, 0 message, 0 rendez-vous, 0 objet Storage** pour cette campagne.

## Limites
- Ce scénario **n'a pas utilisé un troisième utilisateur tiers dans la même fenêtre**. Un troisième JWT GoTrue distinct avait néanmoins fait **16/16** tests RLS/Storage/négatifs et a été supprimé avec vérification 0 profil orphelin (voir rapport G2 tiers précédent).
- Des JWT de test et sessions navigateur sont stockés localement dans le répertoire privé du poste de QA uniquement pendant la recette ; ils ne sont pas ajoutés à Git.
- Le cycle Stripe Checkout **TEST → paiement → retour → webhook → Premium après reconnexion → annulation** ne passe pas encore entièrement dans la preview.
- Les tests natifs authentifiés, les invitations, la session iOS/Android et la recette d'accessibilité complète restent partiels.
- Les rapports JSON bruts de l'UI sont privés, sous `%LOCALAPPDATA%\INKR-QA\clone`, notamment `inkr-client-ui-3-private-references-20261121.json`, `inkr-artist-ui-private-refs-and-accept-20261121.json`, `inkr-client-appointment-confirmed-20261121.json`, `inkr-web-client-artist-reconnection-20261121.json` et les rapports de messagerie.

**Décision : G2 métier Web et médias privés = PASS ciblé. G2 global HOLD ; G0–G5 restent HOLD ; aucun changement de production.**
