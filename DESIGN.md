# INKR — Design system "Galerie noire" (v4)

A contemporary art gallery after dark: warm off-black walls, the work lit like an exhibit,
one restrained gold accent, an editorial serif. Tattoo photography is the hero; the UI recedes.

Reference implementations: `app/(auth)/welcome.tsx`, `app/(tabs)/explore.tsx`,
`app/artist/[id].tsx`, `components/ArtistCard.tsx`, `components/ui/*`.

## Tokens (`constants/theme.ts`)

- **Walls**: `bgPrimary` page, `bgElevated` raised surfaces/inputs, `bgSurface` pressed/skeleton, `bgCard` cards.
- **Text**: `textPrimary` (paper), `textSecondary` (captions), `textTertiary` (meta, AA min). Never darker than tertiary for text.
- **One accent**: `accentWarm` (gold) for kickers, active markers, prices; `accentGlow` for serif italics and prices on dark images.
  `accentAction` (paper) fills the primary button. Do not introduce violet, cyan, neon or rainbow colors.
- **Status**: `success` (sage) = open/available, `warning` = waiting/pending, `error` = destructive/failure, `textTertiary` = closed/inactive.
- **Borders**: hairlines (`StyleSheet.hairlineWidth`) in `borderDefault`. Gold border `borderGlow` only for premium/featured.
- `Layout.maxContent` (1180) caps every screen on web; `Layout.maxReading` (640) caps prose; `Layout.gutter` (20) side padding.

## Typography (`TText`)

- `display*` variants render **Instrument Serif** automatically. Use for screen titles, names, section titles.
  Signature move: one italic gold phrase — `Trouver <TText variant="displayM" italic color="accentGlow">un artiste</TText>`.
- Everything else is **Geist**; `weight` picks the font file. Prefer `medium`/`semibold`; avoid `bold`/`black`.
- `variant="label" uppercase` + `color="accentWarm"` or `"tertiary"` for kickers/section labels (sparingly).
- `tabular` for prices, counts, times, dates.
- Sentence case everywhere. No ALL-CAPS buttons. No emoji in UI chrome.
- Copy addresses the user as **vous**. Plain, specific French. No exclamation marks, no "Oops".

## Components

- `TButton`: `primary` (paper fill) = the one main action per screen; `secondary` (hairline outline); `ghost`; `destructive` (red outline); `glow` (gold) only for premium upsell.
- `THeader` for stacked screens (round back button). `EmptyState` for empty, error and offline states (serif title, gold icon ring).
- `TSkeleton` matching the final layout instead of spinners.
- Chips: 36px tall, hairline border, selected = paper fill with ink text.
- Cards: avoid boxes when spacing + hairline dividers suffice. Radius tight inside (6–10), soft outside (14–28).
- Status display: 6px dot + label (see `BOOKING_STATUS` in `components/ArtistCard.tsx`).

## Motion (`components/motion`)

Gate first — how often is this seen? 100+/day (tab switch, typing, scrolling lists): **no animation**.
Tens/day (press, row select): < 150ms. Occasional (sheets, step changes, toasts): standard. Rare (success, first visit): delight allowed.

- `PressableScale` — every tappable card/tile/row (0.97, 120ms; 0.92 for small icon buttons). `haptic` only for commits (save, toggle).
- `RevealImage` — every photograph: fades up + settles 1.04→1 when decoded; pass `fallback` (e.g. `ArtPlaceholder`).
- `enterUp(index)` — `entering` for screen content above the fold, staggered ≤ 8 items. Never on virtualized list rows (FlatList/FlashList `renderItem`); animate the header/container instead.
- `BottomSheet` — modal sheets (filters, pickers, confirmations): drag-to-dismiss, velocity snap-back.
- `GlassSurface` — bars floating over imagery (tab bar, sticky headers, action bars).
- Scroll-driven effects (parallax cover, header that fades in, sticky glass bar) use Reanimated `useAnimatedScrollHandler` + `useAnimatedStyle`, never `setState` in onScroll, never core `Animated`.
- Curves: `EASE_OUT` for entrances, `EASE_IN_OUT` for on-screen moves, never ease-in. Springs (`Springs.*`) only when a finger drives it.
- Animate `transform`/`opacity` only. No infinite pulsing/glowing loops. Respect `useReducedMotion()` (keep fades, drop movement).
- Haptics only on native (`Platform.OS !== 'web'`), one per user action, always paired with a visual.
- Web: film grain is global (`app/+html.tsx`); don't add per-screen noise.

## Layout & a11y

- Mobile first (375), then 768 and 1440: center content in `maxContent`, add columns on wide screens; use `useWindowDimensions`, never module-level `Dimensions.get`.
- Touch targets ≥ 40px; every icon-only control gets `accessibilityLabel` + `accessibilityRole`.
- Distinct loading / empty / error / signed-out states. Never show fabricated numbers, reviews or badges.

## Data rules (from the takeover audit)

- No fixtures (`ARTISTS`, `POSTS`, `REQUESTS`… from `constants/mock-data.ts`) in real screens. Only `STYLES` taxonomy and types may be imported.
- Do not change store/Supabase logic while restyling; keep handlers, params and navigation targets intact.
