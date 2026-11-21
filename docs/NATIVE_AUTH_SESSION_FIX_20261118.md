# INKR V5.1 — Correction de persistance Auth native (18/11/2026)

## Défaut constaté par revue de code

Avant ce changement, `lib/supabase.ts` utilisait un adaptateur `webStorage` fondé sur `localStorage`, avec un retour `null` / une écriture sans effet lorsque `localStorage` était absent. Sur React Native Android/iOS, ce stockage n'était donc **pas réellement persistant**. La restauration des sessions après fermeture forcée et la conservation du vérificateur PKCE lors des liens magiques natifs étaient compromises.

Ce défaut est **confirmé dans le code source** ; il n'a **pas** été reproduit sur un appareil dans cette session.

## Correction apportée sur la PR #3

- `lib/auth-storage.ts` conserve la persistance navigateur `localStorage`, avec gestion SSR.
- `lib/auth-storage.native.ts` utilise `expo-secure-store`, une dépendance native **déjà incluse** dans le projet. Les données d'authentification sont stockées sous un espace de noms distinct `inkr.auth.*`.
- Les sessions peuvent dépasser la limite historique de 2 Ko par valeur SecureStore. Les données sont donc codées en ASCII et divisées en blocs de 1 500 octets maximum.
- La mise à jour s'effectue dans un emplacement alternatif `a/b`. Le manifeste n'est remplacé qu'une fois tous les blocs écrits ; une écriture partielle ne remplace pas la dernière session valide.
- `removeItem` supprime le manifeste avant les blocs : une nouvelle lecture ne peut pas retrouver une session déconnectée.
- `processLock` sérialise les opérations Auth **sur mobile uniquement** ; sur le Web, le verrou multi-onglets de Supabase est conservé.
- `app/_layout.tsx` suspend le rafraîchissement Auth en arrière-plan et le relance au retour au premier plan, selon la recommandation Supabase React Native.
- `signInWithGoogle()` lance explicitement l’URL OAuth dans le navigateur système sur Android/iOS (`skipBrowserRedirect: true`) pour permettre le retour par deep link. Sur le Web, la redirection native Supabase reste inchangée.
- La CI compile désormais les bundles **Android et iOS**, en plus du Web, avec des URL Supabase fictives non routables ; aucune application mobile distribuée n’est générée.
- Aucune migration SQL, aucun identifiant utilisateur, aucune clé privée ni modification Supabase de production.

## Tests automatisés

`tests/native-auth-storage.test.cjs` injecte un SecureStore simulé avec limite stricte de 2 048 octets et vérifie six scénarios :

1. Longue session Unicode fragmentée et restaurée après rechargement du module.
2. Vérificateur PKCE conservé, remplacé puis nettoyé.
3. Échec d'écriture en cours : l'ancienne session reste lisible.
4. Manifestes incomplets / clés invalides : aucune session partielle n'est renvoyée.
5. Branchements explicites du stockage et du verrou dans le client Supabase.
6. Rejet d'une session trop grande sans supprimer la précédente.

Ces tests sont des **preuves unitaires**, non une certification de l'API Keychain/Keystore sur appareil réel. Trois autres tests automatiques portent sur la connexion Google OAuth Android, Web et ses cas d’échec.

## Recette native obligatoire avant production

Utiliser une **nouvelle build Android/iOS** créée après ces commits et reliée uniquement au Supabase **staging** `lsewxsdulunuuzmszegm`. Le précédent APK EAS du 16 novembre ne contient pas cette correction.

- Connexion client puis artiste sur des sessions distinctes : fermeture forcée, redémarrage, conservation de la bonne session et absence de données croisées.
- Lien magique demandé et ouvert **sur le même appareil** : redirection `inkr://auth/callback?code=...`, échange PKCE, profil chargé.
- Vérifier que `inkr://auth/callback` figure dans les **Redirect URLs de Supabase staging**. Sans cette autorisation, GoTrue peut revenir à sa Site URL Web au lieu d'ouvrir l'application native.

**Test de validation effectué :** un `POST /auth/v1/otp` sur staging, avec `redirect_to=inkr://auth/callback`, a répondu **HTTP 200** et le mail QA est arrivé en **INBOX**. Le lien reçu contenait toutefois `redirect_to=https://tattoo-app-4gmu-57llo48jq-santana64s-projects.vercel.app` (ancienne Site URL Web). **Conclusion : redirection native non autorisée à ce jour.** Il faut ajouter exactement `inkr://auth/callback` dans les Redirect URLs staging, puis recommencer un seul test. Ne pas ajouter la règle sur le projet Supabase de production pendant cette recette. Aucun lien à jeton n'a été publié.
- Passage en arrière-plan, retour au premier plan, renouvellement du jeton et reprise réseau après expiration.
- Déconnexion puis redémarrage : aucune session ni donnée privée résiduelle.
- Test iOS après réinstallation : les éléments Keychain peuvent subsister selon les règles du système ; ne jamais supposer qu'une désinstallation équivaut à une déconnexion.
- Avant distribution, régler et vérifier `versionCode` Android au-delà des anciens binaires et confirmer la compatibilité de signature.

**État :** correctif de code et tests automatisés ; Android/iOS sur appareil restent en **HOLD** jusqu'à la nouvelle build et la recette. **Production : HOLD.**

Documentation de référence : https://supabase.com/docs/guides/auth/quickstarts/react-native
