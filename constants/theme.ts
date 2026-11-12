// INKR Design System v5 — "The Human Canvas"
// Philosophy: a contemporary gallery crossed with an independent magazine.
// Mineral paper pages, ink panels, one vermilion accent, a monumental editorial
// serif, square corners, hairline rules and numbered cartels.
//
// Two grounds, and only two:
//   • paper — the default page (`bgPrimary`), ink text;
//   • ink   — panels, navigation, anything over photography; use the `onInk*`
//             tokens there, never `textPrimary`.
//
// Legacy token keys (v3/v4) are kept and remapped so every screen inherits the
// direction; new code should prefer the v5 names at the top of `Colors`.

const semanticPalette = {
  text: '#121310', background: '#F0ECE3', tint: '#EA583B',
  icon: '#5E5A52', tabIconDefault: '#AAA69D', tabIconSelected: '#FFFFFF',
};

export const Colors = {
  light: semanticPalette,
  dark: semanticPalette,

  // ── v5 palette ────────────────────────────────────────────
  paper:      '#F0ECE3',     // the page
  white:      '#FFFDF9',     // raised sheet: panels, inputs, table cells
  wash:       '#E4DDCF',     // pressed / hover / quiet fills
  line:       '#D1C9BD',     // hairline rules and borders
  metal:      '#887F73',     // decorative only — too light for text on paper
  clay:       '#C7A692',     // skin-tone plate behind initials and empty art
  clayDeep:   '#8F796A',
  moss:       '#55654F',     // "open / available"
  flame:      '#EA583B',     // vermilion — fills, rules, focus, large display
  flameText:  '#B93A1B',     // vermilion that passes AA as small text on paper
  flameSoft:  '#FCE7DD',     // selected choice background
  flameOnInk: '#FFAD8D',     // vermilion as text on ink

  // Ink ground and what sits on it (panels, sidebar, tab bar, photography).
  inkPanel:    '#121310',
  inkRaised:   '#2A2C26',    // hover / active row on ink
  onInk:       '#EFEAE2',
  onInkMuted:  '#AAA69D',
  onInkFaint:  '#807C72',
  onInkLine:   '#44433C',
  scrim:       'rgba(12,12,11,0.74)',

  // ── Grounds (legacy keys) ─────────────────────────────────
  bgPrimary:   '#F0ECE3',
  bgElevated:  '#FFFDF9',
  bgSurface:   '#E8E3D8',
  bgSubtle:    '#E4DDCF',
  bgInk:       '#121310',
  bgCard:      '#FFFDF9',

  // ── Text on paper (WCAG AA on bgPrimary) ──────────────────
  textPrimary:   '#121310',   // ~15:1
  textSecondary: '#5E5A52',   // ~5.7:1
  textTertiary:  '#6F695F',   // ~4.6:1
  textInverse:   '#F0ECE3',
  textAccent:    '#B93A1B',

  // ── The single accent — vermilion ─────────────────────────
  accent:         '#121310',  // selected / active neutral
  accentWarm:     '#B93A1B',  // kickers, links, prices (small text)
  accentGlow:     '#DC4A2C',  // serif italics and other large display
  accentAction:   '#121310',  // primary action fill (ink)
  accentMuted:    'rgba(234,88,59,0.12)',

  // ── Legacy secondary accents, folded into the palette ─────
  violet:         '#6F695F',
  violetLight:    '#887F73',
  violetMuted:    'rgba(18,19,16,0.05)',
  violetGlow:     'rgba(18,19,16,0.08)',

  cyan:           '#55654F',
  cyanMuted:      'rgba(85,101,79,0.12)',

  // ── Ink (brand identity) ──────────────────────────────────
  ink:            '#121310',
  inkLight:       '#20211E',

  // ── Status — readable as text on paper ────────────────────
  success:        '#55654F',
  successLight:   '#4A5945',
  warning:        '#8F6220',
  warningLight:   '#8F6220',
  error:          '#A8281C',
  errorLight:     '#A8281C',
  info:           '#4F5D70',
  infoLight:      '#4F5D70',

  // ── Borders — hairlines ───────────────────────────────────
  borderSubtle:   '#DDD6CA',
  borderDefault:  '#D1C9BD',
  borderStrong:   '#121310',
  borderGlow:     'rgba(234,88,59,0.60)',
  borderFocus:    '#EA583B',
  borderGlass:    '#C8BEAE',
  borderViolet:   '#C8BEAE',

  // ── Quiet fills (legacy "glass" keys, now ink washes on paper)
  glassBg:            'rgba(18,19,16,0.03)',
  glassBgMid:         'rgba(18,19,16,0.05)',
  glassBgHover:       'rgba(18,19,16,0.07)',
  glassBorder:        'rgba(18,19,16,0.14)',
  glassBorderBright:  'rgba(18,19,16,0.28)',
  glassAmber:         'rgba(234,88,59,0.08)',
  glassViolet:        'rgba(18,19,16,0.04)',

  glowAmber:    'rgba(234,88,59,0.14)',
  glowGold:     'rgba(234,88,59,0.20)',
  glowWhite:    'rgba(18,19,16,0.04)',
  glowViolet:   'rgba(18,19,16,0.06)',
  glowCyan:     'rgba(85,101,79,0.12)',

  // ── Premium tier — same single accent ─────────────────────
  premiumGold:        '#EA583B',
  premiumGoldLight:   '#FFAD8D',
  premiumGoldDark:    '#B93A1B',
  premiumGradStart:   '#EA583B',
  premiumGradEnd:     '#D2472B',
};

// ── Type families (loaded in app/_layout.tsx) ─────────────────
export const Fonts = {
  serif:        'InstrumentSerif_400Regular',
  serifItalic:  'InstrumentSerif_400Regular_Italic',
  sans:         'Geist_400Regular',
  sansMedium:   'Geist_500Medium',
  sansSemibold: 'Geist_600SemiBold',
  sansBold:     'Geist_700Bold',
} as const;

export const Spacing = {
  '4xs': 2,
  '3xs': 4,
  '2xs': 8,
  xs:    12,
  sm:    16,
  md:    20,
  lg:    24,
  xl:    32,
  '2xl': 40,
  '3xl': 56,
  '4xl': 72,
  '5xl': 96,
};

// Square by default. Only `full` rounds (filter pills, status dots, toggles).
export const Radius = {
  xs:    0,
  sm:    0,
  md:    0,
  lg:    0,
  xl:    0,
  '2xl': 0,
  '3xl': 0,
  full:  9999,
};

export const FontSize = {
  displayXL: 68,
  displayL:  52,
  displayM:  42,
  displayS:  30,
  title1:    22,
  title2:    18,
  body:      16,
  bodySmall: 14,
  caption:   12.5,
  label:     10.5,
  micro:     10,
};

export const LetterSpacing = {
  hero:    -3.4,
  tight:   -2.2,
  tighter: -1.5,
  normal:   0,
  wide:     0.3,
  wider:    1.0,
  caps:     1.7,
  widest:   3.0,
};

export const LineHeight = {
  tight:  0.95,
  normal: 1.4,
  loose:  1.7,
  body:   1.6,
};

// Page geometry. `sidebar` is the fixed ink navigation on wide web screens;
// use `useContentDimensions()` (hooks/useContentDimensions) for the width that
// is actually left to the page.
export const Layout = {
  maxContent: 1280,
  maxReading: 640,
  gutter: 20,
  gutterWide: 56,
  sidebar: 238,
  wideBreakpoint: 1024,
};

// ── Light ──────────────────────────────────────────────────────
// v5 is flat: depth comes from rules and ground changes. These stay as very
// soft warm shadows so legacy call sites keep working.
const soft = (height: number, radius: number, opacity: number, elevation: number) => ({
  shadowColor: '#3A2F25',
  shadowOffset: { width: 0, height },
  shadowOpacity: opacity,
  shadowRadius: radius,
  elevation,
});

export const GlowShadow = {
  amber:       soft(6, 18, 0.10, 3),
  amberStrong: soft(10, 26, 0.14, 5),
  white:       soft(8, 22, 0.10, 3),
  violet:      soft(8, 22, 0.10, 3),
  cyan:        soft(4, 12, 0.08, 2),
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
};

export const Shadow = {
  sm: soft(2, 6, 0.08, 2),
  md: soft(10, 24, 0.12, 6),
  lg: soft(24, 60, 0.22, 14),
};

// ── Gradient presets ──────────────────────────────────────────
// Overlays always fall to ink: text placed on them uses `onInk*`.
export const Gradients = {
  inkBlack:    ['#121310', '#20211E'] as const,
  goldDiag:    ['#EA583B', '#D2472B'] as const,
  violetDark:  ['#20211E', '#121310'] as const,
  premiumCard: ['rgba(234,88,59,0.10)', 'rgba(234,88,59,0)'] as const,
  heroOverlay: ['rgba(18,19,16,0)', 'rgba(18,19,16,0.55)', 'rgba(18,19,16,0.96)'] as const,
  cardBottom:  ['transparent', 'rgba(18,19,16,0.86)'] as const,
  glowViolet:  ['rgba(18,19,16,0.06)', 'transparent'] as const,
  glowAmber:   ['rgba(234,88,59,0.12)', 'transparent'] as const,
  aurora:      ['rgba(234,88,59,0.05)', 'rgba(240,236,227,0)', 'rgba(240,236,227,0)'] as const,
  // The skin-tone plates behind artwork that has not loaded or does not exist.
  plateClay:   ['#D2B7A5', '#A88D7C'] as const,
  plateBone:   ['#E5DFD4', '#B4AC9F'] as const,
  plateSlate:  ['#8E8D84', '#4C4B47'] as const,
};

// ── Motion — weighty, no bounce on surfaces ───────────────────
export const SpringConfig = {
  gentle:   { damping: 22, stiffness: 160 },
  bouncy:   { damping: 14, stiffness: 260 },
  snappy:   { damping: 20, stiffness: 380 },
  wobbly:   { damping: 12, stiffness: 200 },
  stiff:    { damping: 26, stiffness: 500 },
};

export const Duration = {
  fast: 140,
  base: 220,
  slow: 420,
  reveal: 640,
};
