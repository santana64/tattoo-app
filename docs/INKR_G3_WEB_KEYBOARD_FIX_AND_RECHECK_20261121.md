# INKR — G3, correctifs clavier Web et contre-recette du 21/11/2026

## Statut

**PASS ciblé : 8/8 contrôles clavier, TypeScript, ESLint et 9/9 contrôles responsive/public. G3 global HOLD.**
Aucun lecteur d'écran matériel ou appareil physique n'a été testé par cette campagne.

## Anomalies réellement reproduites avant correction

- Sur l'écran public `/sign-in`, les actions CGU et politique de confidentialité avaient `role=link` et `tabindex=0`, mais **Entrée ne naviguait pas** : Playwright a attendu la page cible sans l'obtenir.
- Une fois les liens juridiques corrigés, le même problème a été reproduit sur la vignette « Réalisation de … » de `/explore` : focus visible, mais absence de navigation après Entrée.
- Cause : les `Pressable` React Native Web étaient rendus comme `div role="link"` et leur `onPress` ne garantissait pas l'activation clavier sur ces liens.

## Correctifs source sur la branche PR #3

- `app/(auth)/sign-in.tsx` : `accessibilityLabel` et `onKeyDown` Web explicite pour CGU / confidentialité ; cible visuelle 24 px conservée.
- `app/(auth)/welcome.tsx` : idem pour les liens juridiques ; liens d'œuvres accessibles au clavier ; cible juridiques de 24 px.
- `app/(tabs)/explore.tsx` : activation clavier des vignettes `TrendingTile`.
- `app/saved.tsx` : activation clavier des œuvres sauvegardées, avec import `Platform` corrigé.
- Dans chaque cas, la navigation clavier accepte Entrée et Espace sur le Web, prévient l'action par défaut et conserve `onPress` natif.

## Exécution indépendante après reconstruction Web

- Source applicative au commit **`915d8327eb3d40f7564ae03ca651afbf13d90394`** avant les seuls commits de documentation.
- Reconstruction `npm run build:web` de staging (variables `EXPO_PUBLIC_SUPABASE_*` pointant uniquement vers `lsewxsdulunuuzmszegm`) : **exit 0**.
- TypeScript `npm run typecheck` : **exit 0**.
- ESLint `npm run lint` : **exit 0**.
- Suite unitaire exécutée avant le dernier ajout d'import : **262/262 PASS** ; ne pas substituer ce résultat à la CI exacte du dernier commit.
- Script Playwright privé `%LOCALAPPDATA%\\INKR-QA\\scripts\\Run-INKR-G3-KeyboardSmoke-20261121.cjs` (Edge/Chromium, sans appareil physique, navigateur sur `http://127.0.0.1:4173`).
- Résultat final `PASS_PARTIAL_KEYBOARD_LINK_SMOKE` le **2026-11-21 21:53:10 UTC**, rapport `%LOCALAPPDATA%\\INKR-QA\\clone\\g3-web-keyboard-smoke-20261121.json`. **8/8 PASS** :
  1. Tab initial donne le focus à un élément.
  2. CGU hauteur mesurée 24 px.
  3. Entrée sur CGU ouvre `/legal/terms`.
  4. Confidentialité hauteur mesurée 24 px.
  5. Entrée sur confidentialité ouvre `/legal/privacy-policy`.
  6. Vignette « Réalisation de… » visible et accessible par son nom.
  7. Entrée sur la vignette ouvre `/post/...`.
  8. Aucune erreur JavaScript détectée dans ce parcours.
- Recontrôle responsive public `Review-INKR-WebA11y-20261121.cjs`, routes `/`, `/explore`, `/sign-in` × largeurs **360, 768 et 1440 px** : **9/9 HTTP 200 ; aucun débordement horizontal ; aucun contrôle visible sans libellé ; aucune image visible sans `alt` ; aucune exception JS détectée**.

## Limitations

- Le test clavier est **partiel** : ni toutes les routes, ni tous les modals, menus, formulaires, états d'erreur et la navigation Maj+Tab / Échap ne sont couverts.
- Aucune validation réelle NVDA, VoiceOver, TalkBack, contraste WCAG global ou zoom 200 %.
- Les corrections ne démontrent pas les parcours natifs authentifiés, les notifications, la galerie privée ou la compatibilité des APK v4.

**G3 HOLD. PR #3 DRAFT. Aucun déploiement de production.**
