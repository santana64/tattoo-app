import React from 'react';
import { Text, TextStyle, StyleSheet, TextProps } from 'react-native';
import { Colors, FontSize, Fonts, LetterSpacing } from '@/constants/theme';

type Variant =
  | 'displayXL'
  | 'displayL'
  | 'displayM'
  | 'displayS'
  | 'title1'
  | 'title2'
  | 'body'
  | 'bodySmall'
  | 'caption'
  | 'label'
  | 'micro';

type Color =
  | 'primary' | 'secondary' | 'tertiary' | 'inverse'
  | 'accent' | 'accentWarm' | 'accentGlow'
  | 'error' | 'success' | 'warning' | 'info';

interface TTextProps extends TextProps {
  variant?: Variant;
  color?: Color;
  weight?: 'regular' | 'medium' | 'semibold' | 'bold' | 'black';
  uppercase?: boolean;
  /** Force the editorial serif on a non-display variant. */
  serif?: boolean;
  /** Serif italic — the signature accent of the display type. */
  italic?: boolean;
  /** Tabular figures for prices, times and counters. */
  tabular?: boolean;
  style?: TextProps['style'];
}

const DISPLAY: ReadonlySet<Variant> = new Set(['displayXL', 'displayL', 'displayM', 'displayS']);

const variantStyles: Record<Variant, TextStyle> = {
  displayXL: { fontSize: FontSize.displayXL, letterSpacing: LetterSpacing.hero, lineHeight: 60 },
  displayL:  { fontSize: FontSize.displayL, letterSpacing: LetterSpacing.tight, lineHeight: 48 },
  displayM:  { fontSize: FontSize.displayM, letterSpacing: LetterSpacing.tighter, lineHeight: 39 },
  displayS:  { fontSize: FontSize.displayS, letterSpacing: LetterSpacing.tighter, lineHeight: 33 },
  title1:    { fontSize: FontSize.title1, fontWeight: '600', letterSpacing: -0.5, lineHeight: 28 },
  title2:    { fontSize: FontSize.title2, fontWeight: '600', letterSpacing: -0.25, lineHeight: 24 },
  body:      { fontSize: FontSize.body, fontWeight: '400', letterSpacing: -0.1, lineHeight: 25 },
  bodySmall: { fontSize: FontSize.bodySmall, fontWeight: '400', letterSpacing: -0.05, lineHeight: 21 },
  caption:   { fontSize: FontSize.caption, fontWeight: '400', letterSpacing: 0, lineHeight: 17 },
  label:     { fontSize: FontSize.label, fontWeight: '500', letterSpacing: LetterSpacing.caps, lineHeight: 15 },
  micro:     { fontSize: FontSize.micro, fontWeight: '500', letterSpacing: LetterSpacing.wider, lineHeight: 13 },
};

const colorMap: Record<Color, string> = {
  primary:    Colors.textPrimary,
  secondary:  Colors.textSecondary,
  tertiary:   Colors.textTertiary,
  inverse:    Colors.textInverse,
  accent:     Colors.accent,
  accentWarm: Colors.accentWarm,
  accentGlow: Colors.accentGlow,
  error:      Colors.error,
  success:    Colors.success,
  warning:    Colors.warning,
  info:       Colors.info,
};

const weightMap: Record<NonNullable<TTextProps['weight']>, TextStyle['fontWeight']> = {
  regular:  '400',
  medium:   '500',
  semibold: '600',
  bold:     '700',
  black:    '800',
};

/** Custom fonts ship one file per weight: resolve the family from the weight. */
function sansFamily(weight: TextStyle['fontWeight']): string {
  switch (String(weight ?? '400')) {
    case '500': case 'medium': return Fonts.sansMedium;
    case '600': case 'semibold': return Fonts.sansSemibold;
    case '700': case '800': case '900': case 'bold': return Fonts.sansBold;
    default: return Fonts.sans;
  }
}

export function TText({
  variant = 'body',
  color = 'primary',
  weight,
  uppercase = false,
  serif,
  italic = false,
  tabular = false,
  style,
  children,
  ...props
}: TTextProps) {
  const useSerif = serif ?? DISPLAY.has(variant);

  const merged = StyleSheet.flatten([
    variantStyles[variant],
    { color: colorMap[color] },
    weight ? { fontWeight: weightMap[weight] } : undefined,
    uppercase ? { textTransform: 'uppercase' } : undefined,
    style,
  ]) as TextStyle;

  // Respect an explicit family from the caller; otherwise pick ours.
  const wantsItalic = italic || merged.fontStyle === 'italic';
  const family = merged.fontFamily
    ?? (useSerif ? (wantsItalic ? Fonts.serifItalic : Fonts.serif) : sansFamily(merged.fontWeight));

  return (
    <Text
      style={[
        merged,
        {
          fontFamily: family,
          // The family already encodes weight; a second weight makes platforms fake-bold.
          fontWeight: 'normal',
          fontStyle: useSerif || !wantsItalic ? 'normal' : 'italic',
        },
        tabular ? { fontVariant: ['tabular-nums'] } : undefined,
      ]}
      {...props}
    >
      {children}
    </Text>
  );
}
