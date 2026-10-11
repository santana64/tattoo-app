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

## Motion

- Entrances: `FadeInDown.duration(600).easing(bezier(0.22,1,0.36,1))`, short stagger, respect `useReducedMotion()`.
- Press: scale 0.975–0.985 spring, never bouncy wobble. No infinite pulsing/glowing loops.
- Haptics only on native (`Platform.OS !== 'web'`).

## Layout & a11y

- Mobile first (375), then 768 and 1440: center content in `maxContent`, add columns on wide screens; use `useWindowDimensions`, never module-level `Dimensions.get`.
- Touch targets ≥ 40px; every icon-only control gets `accessibilityLabel` + `accessibilityRole`.
- Distinct loading / empty / error / signed-out states. Never show fabricated numbers, reviews or badges.

## Data rules (from the takeover audit)

- No fixtures (`ARTISTS`, `POSTS`, `REQUESTS`… from `constants/mock-data.ts`) in real screens. Only `STYLES` taxonomy and types may be imported.
- Do not change store/Supabase logic while restyling; keep handlers, params and navigation targets intact.
