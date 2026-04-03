// INKR Design System v3.0 — 2026 "Ink Meets Future"
// Philosophy: Editorial magazine × Tattoo culture × Spatial computing

export const Colors = {
  // ── Backgrounds — deep, rich, layered ─────────────────────
  bgPrimary:   '#030305',     // void black with violet undertone
  bgElevated:  '#0A0A0F',     // elevated surface
  bgSurface:   '#111116',     // cards, inputs
  bgSubtle:    '#18181F',     // subtle backgrounds
  bgInk:       '#060609',     // deepest overlay
  bgCard:      '#0E0E14',     // card background

  // ── Text ───────────────────────────────────────────────────
  textPrimary:   '#F2F0EC',   // warm white
  textSecondary: '#7A7875',   // muted warm gray
  textTertiary:  '#3D3B38',   // very muted
  textInverse:   '#030305',
  textAccent:    '#E8C88A',   // amber text

  // ── Primary Accent — Electric Amber ───────────────────────
  accent:         '#E8DCC8',  // parchment
  accentWarm:     '#D4A864',  // warm gold
  accentGlow:     '#F0B840',  // bright electric gold
  accentAction:   '#FFFFFF',
  accentMuted:    'rgba(212,168,100,0.15)',

  // ── Secondary Accent — Electric Violet ────────────────────
  violet:         '#8B5CF6',  // electric violet
  violetLight:    '#A78BFA',
  violetMuted:    'rgba(139,92,246,0.12)',
  violetGlow:     'rgba(139,92,246,0.25)',

  // ── Tertiary — Electric Cyan (for "live" / "online") ──────
  cyan:           '#22D3EE',
  cyanMuted:      'rgba(34,211,238,0.10)',

  // ── Ink (brand identity) ──────────────────────────────────
  ink:            '#1E1B3A',
  inkLight:       '#2A2548',

  // ── Status ────────────────────────────────────────────────
  success:        '#10B981',  // emerald
  successLight:   '#34D399',
  warning:        '#F59E0B',  // amber
  warningLight:   '#FBBF24',
  error:          '#EF4444',
  errorLight:     '#F87171',
  info:           '#6366F1',  // indigo
  infoLight:      '#818CF8',

  // ── Borders ───────────────────────────────────────────────
  borderSubtle:   'rgba(255,255,255,0.04)',
  borderDefault:  'rgba(255,255,255,0.08)',
  borderGlow:     'rgba(212,168,100,0.30)',
  borderFocus:    'rgba(240,184,64,0.55)',
  borderGlass:    'rgba(255,255,255,0.07)',
  borderViolet:   'rgba(139,92,246,0.30)',

  // ── Glass 2.0 ─────────────────────────────────────────────
  glassBg:            'rgba(255,255,255,0.025)',
  glassBgMid:         'rgba(255,255,255,0.05)',
  glassBgHover:       'rgba(255,255,255,0.07)',
  glassBorder:        'rgba(255,255,255,0.07)',
  glassBorderBright:  'rgba(255,255,255,0.14)',
  glassAmber:         'rgba(212,168,100,0.07)',
  glassViolet:        'rgba(139,92,246,0.07)',

  // ── Glow colors ───────────────────────────────────────────
  glowAmber:    'rgba(212,168,100,0.22)',
  glowGold:     'rgba(240,184,64,0.35)',
  glowWhite:    'rgba(255,255,255,0.07)',
  glowViolet:   'rgba(139,92,246,0.18)',
  glowCyan:     'rgba(34,211,238,0.15)',

  // ── Premium tier colors ───────────────────────────────────
  premiumGold:        '#D4A864',
  premiumGoldLight:   '#F0C878',
  premiumGoldDark:    '#9A7040',
  premiumGradStart:   '#F0B840',
  premiumGradEnd:     '#C8783A',
};

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

export const Radius = {
  xs:    4,
  sm:    8,
  md:    12,
  lg:    18,
  xl:    24,
  '2xl': 32,
  '3xl': 44,
  full:  9999,
};

export const FontSize = {
  displayXL: 56,
  displayL:  44,
  displayM:  34,
  displayS:  28,
  title1:    24,
  title2:    20,
  body:      16,
  bodySmall: 14,
  caption:   12,
  label:     10,
  micro:     9,
};

export const LetterSpacing = {
  hero:    -4.0,
  tight:   -2.0,
  tighter: -1.0,
  normal:   0,
  wide:     0.5,
  wider:    1.5,
  caps:     2.5,
  widest:   4.0,
};

export const LineHeight = {
  tight:  1.1,
  normal: 1.4,
  loose:  1.6,
  body:   1.65,
};

// ── Glow shadows ──────────────────────────────────────────────
export const GlowShadow = {
  amber: {
    shadowColor: '#D4A864',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.40,
    shadowRadius: 28,
    elevation: 10,
  },
  amberStrong: {
    shadowColor: '#F0B840',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.55,
    shadowRadius: 48,
    elevation: 18,
  },
  white: {
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 6,
  },
  violet: {
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.30,
    shadowRadius: 32,
    elevation: 12,
  },
  cyan: {
    shadowColor: '#22D3EE',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 8,
  },
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
};

export const Shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.65,
    shadowRadius: 8,
    elevation: 3,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.75,
    shadowRadius: 24,
    elevation: 10,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.85,
    shadowRadius: 48,
    elevation: 20,
  },
};

// ── Gradient presets ──────────────────────────────────────────
export const Gradients = {
  inkBlack:    ['#030305', '#0A0A0F'] as const,
  goldDiag:    ['#F0B840', '#C8783A'] as const,
  violetDark:  ['#1E1B3A', '#0A0A0F'] as const,
  premiumCard: ['rgba(212,168,100,0.12)', 'rgba(212,168,100,0.03)'] as const,
  heroOverlay: ['rgba(3,3,5,0)', 'rgba(3,3,5,0.55)', 'rgba(3,3,5,0.97)'] as const,
  cardBottom:  ['transparent', 'rgba(3,3,5,0.9)'] as const,
  glowViolet:  ['rgba(139,92,246,0.15)', 'transparent'] as const,
  glowAmber:   ['rgba(212,168,100,0.20)', 'transparent'] as const,
  aurora:      ['rgba(139,92,246,0.06)', 'rgba(212,168,100,0.04)', 'rgba(34,211,238,0.03)'] as const,
};

// ── Animation configs ─────────────────────────────────────────
export const SpringConfig = {
  gentle:   { damping: 20, stiffness: 150 },
  bouncy:   { damping: 10, stiffness: 300 },
  snappy:   { damping: 18, stiffness: 400 },
  wobbly:   { damping: 6,  stiffness: 200 },
  stiff:    { damping: 25, stiffness: 500 },
};
