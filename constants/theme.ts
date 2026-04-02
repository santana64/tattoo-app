// TATTOO Design System v2.0 — 2026 Luxury Dark

export const Colors = {
  // ── Backgrounds ────────────────────────────────────────────
  bgPrimary:  '#050508',     // near-black with blue undertone
  bgElevated: '#0D0D12',     // elevated surface
  bgSurface:  '#141419',     // cards, inputs
  bgSubtle:   '#1C1C23',     // subtle backgrounds
  bgInk:      '#08080F',     // deepest black for overlays

  // ── Text ───────────────────────────────────────────────────
  textPrimary:   '#F0EEE8',  // warm white
  textSecondary: '#8C8A85',  // muted
  textTertiary:  '#4A4845',  // very muted
  textInverse:   '#050508',

  // ── Accent — warm amber gold ──────────────────────────────
  accent:       '#E8E0D0',   // parchment white
  accentWarm:   '#C8A882',   // warm gold
  accentGlow:   '#D4A96A',   // bright gold for glow
  accentAction: '#FFFFFF',   // pure white CTA

  // ── Ink ──────────────────────────────────────────────────
  ink:          '#1A1A2E',   // deep ink blue
  inkLight:     '#252540',   // lighter ink

  // ── Status ────────────────────────────────────────────────
  success: '#34D399',
  warning: '#FBBF24',
  error:   '#F87171',
  info:    '#818CF8',

  // ── Borders ───────────────────────────────────────────────
  borderSubtle:  'rgba(255,255,255,0.05)',
  borderDefault: 'rgba(255,255,255,0.09)',
  borderGlow:    'rgba(200,168,130,0.25)',
  borderFocus:   'rgba(232,224,208,0.5)',
  borderGlass:   'rgba(255,255,255,0.08)',

  // ── Glass ─────────────────────────────────────────────────
  glassBg:       'rgba(255,255,255,0.03)',
  glassBgHover:  'rgba(255,255,255,0.06)',
  glassBorder:   'rgba(255,255,255,0.08)',
  glassBorderBright: 'rgba(255,255,255,0.15)',

  // ── Glow ──────────────────────────────────────────────────
  glowAmber:  'rgba(200,168,130,0.20)',
  glowWhite:  'rgba(255,255,255,0.08)',
  glowGold:   'rgba(212,169,106,0.30)',
  glowPurple: 'rgba(129,140,248,0.15)',

  // ── Premium ───────────────────────────────────────────────
  premiumGold:       '#C8A882',
  premiumGoldLight:  '#E8C99A',
  premiumGoldDark:   '#9A7A5A',
};

export const Spacing = {
  '4xs': 2,
  '3xs': 4,
  '2xs': 8,
  xs:   12,
  sm:   16,
  md:   20,
  lg:   24,
  xl:   32,
  '2xl': 40,
  '3xl': 56,
  '4xl': 72,
};

export const Radius = {
  xs:   4,
  sm:   8,
  md:   14,
  lg:   20,
  xl:   28,
  '2xl': 36,
  full: 9999,
};

export const FontSize = {
  displayXL: 52,   // hero
  displayL:  40,   // section headers
  displayM:  32,
  title1:    24,
  title2:    18,
  body:      16,
  bodySmall: 14,
  caption:   12,
  label:     10,
  micro:     9,
};

export const LetterSpacing = {
  tight:   -1.5,
  tighter: -2.5,
  hero:    -3.5,
  normal:   0,
  wide:     0.5,
  wider:    1.2,
  caps:     2.0,
};

// Glow shadows — colored
export const GlowShadow = {
  amber: {
    shadowColor: '#C8A882',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 8,
  },
  amberStrong: {
    shadowColor: '#D4A96A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 40,
    elevation: 16,
  },
  white: {
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.10,
    shadowRadius: 20,
    elevation: 6,
  },
  purple: {
    shadowColor: '#818CF8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 28,
    elevation: 10,
  },
};

// Classic depth shadows
export const Shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 3,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.7,
    shadowRadius: 24,
    elevation: 10,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.8,
    shadowRadius: 48,
    elevation: 20,
  },
};
