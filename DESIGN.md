# INKR — Design system v5 "The Human Canvas"

A contemporary gallery crossed with an independent magazine. Mineral paper pages, ink panels,
one vermilion accent, a monumental editorial serif, square corners, hairline rules, numbered
cartels. Discovery screens are expressive; working screens (agenda, messages, availability,
settings) are deliberately calm. That contrast is intended.

Signature lines (English, used sparingly as kickers or hero statements): **ART UNDER SKIN.** /
**THE HUMAN CANVAS**. Everything else is French, addressed as **vous**.

Reference implementations: `components/v5/index.tsx` (kit), `components/layout/Sidebar.tsx`,
`components/ui/*`, `app/(auth)/welcome.tsx`, `app/(tabs)/explore.tsx`, `app/artist/[id].tsx`.

## Two grounds

| Ground | Token | Text on it |
|---|---|---|
| **Paper** — every page | `Colors.paper` (`bgPrimary`) | `textPrimary` ink, `textSecondary`, `textTertiary` |
| **White sheet** — panels, inputs, cells | `Colors.white` (`bgElevated`, `bgCard`) | same as paper |
| **Ink** — panels, navigation, heroes, anything over a photograph | `Colors.inkPanel` | `onInk`, `onInkMuted`, `onInkFaint`, `flameOnInk` — **never** `textPrimary` |

`<TText color="onInk | onInkMuted | flameOnInk">`, `<TButton variant="glass">` (paper fill) and
`variant="inverse"` (paper outline) exist for the ink ground. Overlays on photographs always fall
to ink (`Gradients.heroOverlay`, `cardBottom`); prefer no overlay at all and put the text beside
or under the image.

## Colour (`constants/theme.ts`)

- **One accent, vermilion.** `flame` for fills, rules, focus rings, active markers and the vermilion
  knob. `flameText` (`accentWarm`) for small text on paper (kickers, links, prices) — `flame`
  itself fails AA at small sizes. `accentGlow` for large serif italics. `flameOnInk` on ink.
- `line` hairlines, `wash` hover/pressed fills, `clay` skin-tone plate behind initials and missing art.
- **Status** is a 6px dot + small capitals (`StatusDot`): `open` moss, `wait` ochre, `closed` grey,
  `alert` vermilion. Never a coloured pill.
- No gold, violet, cyan, gradients as decoration, glows or coloured shadows. The page is flat:
  depth comes from rules and from switching ground.

## Shape

- **Square.** `Radius.*` is 0. Only `Radius.full` rounds: filter pills (`TChip`), status dots,
  toggles. Do not hard-code a `borderRadius`.
- Borders are 1px `line`; an **ink rule** (1px `Colors.ink`) closes a masthead or opens a list.
- Portraits (`TAvatar`) are square plates.

## Typography (`TText`)

- `display*` → **Instrument Serif**, tight tracking, line-height ≈ 0.95. Screen titles, names,
  section titles, big numerals.
- Signature move — one italic vermilion phrase closing the title: `<EditorialTitle emphasis="rencontre.">La bonne</EditorialTitle>`.
- Everything else is **Geist**. `variant="label"` is the tracked-capitals kicker (use `Kicker`).
- Buttons, tags and breadcrumbs are tracked capitals; body copy is sentence case.
- `tabular` for prices, counts, times, dates. Numbered cartels use two digits: `01`, `02`.
- Copy: plain, specific French. No exclamation marks, no "Oups", no emoji in chrome.

## Kit (`components/v5`)

`Kicker`, `Rule`, `PageWrap`, `EditorialTitle`, `Masthead`, `SectionHead`, `TextLink`, `InkPanel`,
`StatusDot`, `MetricGrid`, `StepProgress`, `DetailRow`, `SettingRow`, `IconButton`, `Toggle`,
`Choice`, `ArtCanvas`.

- A page opens with a `Masthead` (kicker, serif title, short description at the right, ink rule).
- A section opens with a `SectionHead`; its one secondary action is a `TextLink`, not a button.
- `ArtCanvas` frames work: square, no overlay, optional cartel mark, a skin-tone plate when there is
  no image. Never a stock image, never an invented artwork.
- `MetricGrid` for studio figures: pass `"—"` when there is no data.
- `TButton`: `primary` (ink) is the one main action of a screen; `secondary` ink outline; `ghost`
  quiet; `destructive`; `glow` vermilion fill for premium and booking moments only.
- `GlassCard` / `TCard` are flat white sheets (legacy names). `elevated` = ink top rule,
  `glow`/`premium` = vermilion top rule. Avoid boxes when a rule and spacing are enough.
- `THeader` for stacked screens. `EmptyState` for empty, error and offline states.
- `TSkeleton` matching the final layout instead of spinners.

## Layout

- Phone first (360–390), then 768 and 1440. No horizontal overflow at 360.
- `useContentDimensions()` (not `useWindowDimensions`) inside pages: wide web screens have a fixed
  238px ink rail (`components/layout/Sidebar.tsx`), and `width` is what is left. `isWide` (≥ 900)
  switches to editorial two-column compositions; `gutter` is the side padding. Full-window
  overlays (lightbox, story viewer, sheets, reels) keep `useWindowDimensions`.
- Phones and tablets: five-entry ink tab bar. The rail replaces it on wide web.
- Wide: asymmetric compositions — image blocks beside an ink information panel, description at
  the right of the title, 12-column art grids with mixed spans. Never three equal cards in a row.
- Phone, detail screens: the name and the main action are visible in the first screen height,
  before the gallery.
- `Layout.maxContent` (1280) caps pages; `Layout.maxReading` (640) caps prose.

## Motion (`components/motion`)

Reserved for first encounters, full-screen photographs and transitions between galleries.
Frequent tasks get none.

- `PressableScale` on tappable cards/tiles; `RevealImage` on every photograph; `enterUp(index)`
  for above-the-fold content, never on virtualised rows; `BottomSheet` for sheets.
- Web hover: buttons turn vermilion, rows take a `wash` fill, titles turn `flameText`. 180–200ms.
- Animate `transform`/`opacity` only. No infinite loops. Respect `useReducedMotion()`.
- Haptics on native only, one per commit.

## Accessibility

- Touch targets ≥ 44px; every icon-only control has `accessibilityLabel` + `accessibilityRole`.
- Visible focus on web: 3px vermilion outline (global, `app/+html.tsx`).
- Text contrast ≥ 4.5:1 on its ground; `metal` and `flame` are not text colours on paper.
- Distinct loading / empty / error / signed-out states.

## Data rules

- Never show fabricated artists, reviews, availability, prices, figures or badges. Empty is fine.
- Do not change store / Supabase / navigation logic while restyling; keep handlers, params and
  targets intact. No deposit or payment at booking: that feature was deliberately left out.
- Legal texts stay as they are.
