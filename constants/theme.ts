// INKR Design System v4 — "Galerie noire"
// Philosophy: a contemporary art gallery after dark. Warm off-black walls,
// the work lit like an exhibit, one restrained gold accent, editorial serif.
//
// Token keys are kept stable from v3 so every screen inherits the new
// direction; legacy accents (violet, cyan) are remapped onto the gallery
// palette instead of being removed.

// Legacy Expo components consume semantic light/dark palettes. INKR uses its dark identity in both modes.
const semanticPalette = { text: '#F4EFE6', background: '#0B0A09', tint: '#C9A46A', icon: '#A39C91', tabIconDefault: '#6E685F', tabIconSelected: '#F4EFE6' };

export const Colors = {
  light: semanticPalette,
  dark: semanticPalette,

  // ── Walls — warm off-blacks, one hue family ───────────────
  bgPrimary:   '#0B0A09',     // gallery wall after hours
  bgElevated:  '#12110F',     // raised plinth
  bgSurface:   '#191715',     // cards, inputs
  bgSubtle:    '#211E1B',     // pressed / subtle fills
  bgInk:       '#070605',     // deepest overlay
  bgCard:      '#141210',     // card background

  // ── Text — warm paper tones (WCAG AA on bgPrimary) ─────────
  textPrimary:   '#F4EFE6',   // gallery paper, ~17:1
  textSecondary: '#A39C91',   // caption ink, ~7.4:1
  textTertiary:  '#7A736A',   // meta, ~4.5:1
  textInverse:   '#0B0A09',
  textAccent:    '#D9B77E',

  // ── The single accent — brushed gold ──────────────────────
  accent:         '#EDE3D1',  // parchment, for selected/active neutrals
  accentWarm:     '#C9A46A',  // brushed gold — the one accent
  accentGlow:     '#DDBB82',  // lit gold, highlights & italic display
  accentAction:   '#F4EFE6',  // primary action fill (paper)
  accentMuted:    'rgba(201,164,106,0.14)',

  // ── Legacy secondary accents, folded into the gallery palette
  violet:         '#B4A487',  // bronze
  violetLight:    '#CDBFA4',
  violetMuted:    'rgba(180,164,135,0.12)',
  violetGlow:     'rgba(180,164,135,0.18)',

  cyan:           '#8FB59A',  // sage — "available / live"
  cyanMuted:      'rgba(143,181,154,0.12)',

  // ── Ink (brand identity) ──────────────────────────────────
  ink:            '#1A1714',
  inkLight:       '#26221E',

  // ── Status — desaturated to sit with the walls ────────────
  success:        '#8FB59A',
  successLight:   '#A9C9B2',
  warning:        '#D9A55B',
  warningLight:   '#E6BC7E',
  error:          '#D9695F',
  errorLight:     '#E68C83',
  info:           '#9FAABA',
  infoLight:      '#BAC3D0',

  // ── Borders — hairlines, never outlines ───────────────────
  borderSubtle:   'rgba(244,239,230,0.06)',
  borderDefault:  'rgba(244,239,230,0.11)',
  borderGlow:     'rgba(201,164,106,0.38)',
  borderFocus:    'rgba(221,187,130,0.70)',
  borderGlass:    'rgba(244,239,230,0.10)',
  borderViolet:   'rgba(180,164,135,0.28)',

  // ── Surfaces over imagery ─────────────────────────────────
  glassBg:            'rgba(244,239,230,0.035)',
  glassBgMid:         'rgba(244,239,230,0.06)',
  glassBgHover:       'rgba(244,239,230,0.08)',
  glassBorder:        'rgba(244,239,230,0.08)',
  glassBorderBright:  'rgba(244,239,230,0.16)',
  glassAmber:         'rgba(201,164,106,0.06)',
  glassViolet:        'rgba(180,164,135,0.05)',

  // ── Light (used sparingly, like a spotlight) ──────────────
  glowAmber:    'rgba(201,164,106,0.16)',
  glowGold:     'rgba(221,187,130,0.24)',
  glowWhite:    'rgba(244,239,230,0.05)',
  glowViolet:   'rgba(180,164,135,0.10)',
  glowCyan:     'rgba(143,181,154,0.12)',

  // ── Premium tier ──────────────────────────────────────────
  premiumGold:        '#C9A46A',
  premiumGoldLight:   '#DDBB82',
  premiumGoldDark:    '#8E7146',
  premiumGradStart:   '#DDBB82',
  premiumGradEnd:     '#A8834C',
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

// Tight on inner elements, softer on containers — never pill-everything.
export const Radius = {
  xs:    3,
  sm:    6,
  md:    10,
  lg:    14,
  xl:    20,
  '2xl': 28,
  '3xl': 36,
  full:  9999,
};

export const FontSize = {
  displayXL: 60,
  displayL:  46,
  displayM:  36,
  displayS:  30,
  title1:    22,
  title2:    18,
  body:      16,
  bodySmall: 14,
  caption:   12.5,
  label:     11,
  micro:     10,
};

export const LetterSpacing = {
  hero:    -1.6,
  tight:   -1.0,
  tighter: -0.5,
  normal:   0,
  wide:     0.3,
  wider:    1.0,
  caps:     1.6,
  widest:   3.0,
};

export const LineHeight = {
  tight:  1.05,
  normal: 1.4,
  loose:  1.6,
  body:   1.6,
};

// Max readable width on large web viewports.
export const Layout = {
  maxContent: 1180,
  maxReading: 640,
  gutter: 20,
};

// ── Light — soft, warm, single source from above ──────────────
export const GlowShadow = {
  amber: {
    shadowColor: '#C9A46A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 6,
  },
  amberStrong: {
    shadowColor: '#C9A46A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.28,
    shadowRadius: 32,
    elevation: 10,
  },
  white: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 6,
  },
  violet: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 6,
  },
  cyan: {
    shadowColor: '#8FB59A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 4,
  },
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
};

// Shadows tinted toward the wall color, not pure black haze.
export const Shadow = {
  sm: {
    shadowColor: '#050403',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 3,
  },
  md: {
    shadowColor: '#050403',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.55,
    shadowRadius: 22,
    elevation: 10,
  },
  lg: {
    shadowColor: '#050403',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.6,
    shadowRadius: 44,
    elevation: 20,
  },
};

// ── Gradient presets ──────────────────────────────────────────
export const Gradients = {
  inkBlack:    ['#0B0A09', '#12110F'] as const,
  goldDiag:    ['#DDBB82', '#A8834C'] as const,
  violetDark:  ['#1A1714', '#0B0A09'] as const,
  premiumCard: ['rgba(201,164,106,0.10)', 'rgba(201,164,106,0.02)'] as const,
  heroOverlay: ['rgba(11,10,9,0)', 'rgba(11,10,9,0.55)', 'rgba(11,10,9,0.98)'] as const,
  cardBottom:  ['transparent', 'rgba(11,10,9,0.88)'] as const,
  glowViolet:  ['rgba(180,164,135,0.08)', 'transparent'] as const,
  glowAmber:   ['rgba(201,164,106,0.14)', 'transparent'] as const,
  aurora:      ['rgba(201,164,106,0.05)', 'rgba(11,10,9,0)', 'rgba(11,10,9,0)'] as const,
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
