# INKR PR #3 — G3 : recette responsive Web et correction d'accessibilité (21 novembre 2026)

## Résultat ciblé
**PASS** pour l'ensemble des **4 workflows GitHub** (CI, Web navigateur staging, Android émulateur staging, iOS simulateur staging) du commit `6ac997eb57c32f4d08f7da03e5f8bf6d464249c9`.

**PASS** pour le nouvel audit Web responsive/public sur **9 cas** (3 pages × 3 largeurs), avec correction ciblée des petites cibles juridiques et reconstruction Web à partir du code de la PR. **G3 global HOLD** faute de recette exhaustive VoiceOver/TalkBack, navigation clavier et appareils physiques (aucun téléphone physique disponible sur le banc QA).

## Méthode et preuve locale
- Build Web reconstruit depuis la PR avec `npm run build:web` et les seules variables `EXPO_PUBLIC_SUPABASE_URL` et `EXPO_PUBLIC_SUPABASE_ANON_KEY` du **staging** `lsewxsdulunuuzmszegm` ; **exit 0**. Aucune configuration de production utilisée.
- Script de navigateur `Review-INKR-WebA11y-20261121.cjs`, Playwright sur Microsoft Edge Chromium, preview Web liée à `http://127.0.0.1:4173`, `reducedMotion=reduce`.
- Pages : `/`, `/explore`, `/sign-in`. Largeurs : **360, 768 et 1440 px**. À toutes les combinaisons, HTTP **200**, **0** débordement horizontal, **0** contrôle visible sans nom accessible, **0** exception JS, **0** image visible sans `alt` dans le build propre.
- Contrôle complémentaire après `networkidle` et **4 secondes** de chargement réel : sur `/`, **2 images visibles** et **0 sans `alt`** ; sur `/explore`, **4 images visibles** et **0 sans `alt`** ; sur `/sign-in`, **aucune erreur JS**.
- Avant la reconstruction, une ancienne exportation `dist/` faisait apparaître 2 images sans `alt` sur `/` et 4 sur `/explore`. Ce résultat **n'est pas reproduit** sur le build propre à images visibles chargées, et n'autorise pas d'affirmer que toute l'accessibilité des images de tous les écrans est certifiée.
- Deux liens interactifs de la page de connexion (`CGU` et `politique de confidentialité`) avaient un rectangle de **17 px de hauteur**. Le correctif source dans `app/(auth)/sign-in.tsx` donne à ces liens **`minHeight:24`**, avec centrage vertical et `hitSlop={8}` conservé. Un contrôle Playwright du build reconstruit mesure **24 px** chacun.
- TypeScript `npm run typecheck` et ESLint `npm run lint` ont réussi après le changement ; le bundle Web a été exporté avec succès.

## Limites / tests requis pour G3 = GO
1. Parcours **clavier seulement** (Tab, Maj+Tab, entrée, Échap), visibilité du focus, pièges de focus, ordre logique, menus, états d'erreur.
2. **Lecteurs d'écran** réels (NVDA/Windows, VoiceOver/iOS, TalkBack/Android) sur les composants cruciaux, texte alternatif contextuel et libellés des contenus privés.
3. Appareils mobiles physiques et différences de permissions, OS, retour arrière, notifications, fichiers, fermeture/réouverture, rotation, latence faible et réseaux intermittents. Les simulateurs ne valent pas validation matériel réel.
4. Tests de contrastes réels, zoom jusqu'à 200 %, tailles de police agrandies et modes réduction des animations.
5. Les navigations via PKCE et les trois comptes nécessitent encore la recette métier UI complète (G2).

**G3 HOLD**, malgré les nouveaux scénarios responsive PASS. PR #3 DRAFT, aucune publication ni modification de Supabase production.
