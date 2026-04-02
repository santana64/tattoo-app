import React from 'react';
import { Text, TextStyle, StyleSheet, TextProps } from 'react-native';
import { Colors, FontSize, LetterSpacing } from '@/constants/theme';

type Variant =
  | 'displayXL'
  | 'displayL'
  | 'displayM'
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
  style?: TextStyle | TextStyle[];
}

const variantStyles: Record<Variant, TextStyle> = {
  displayXL: {
    fontSize: FontSize.displayXL,
    fontWeight: '800',
    letterSpacing: LetterSpacing.hero,
    lineHeight: 56,
  },
  displayL: {
    fontSize: FontSize.displayL,
    fontWeight: '700',
    letterSpacing: LetterSpacing.tighter,
    lineHeight: 46,
  },
  displayM: {
    fontSize: FontSize.displayM,
    fontWeight: '700',
    letterSpacing: LetterSpacing.tight,
    lineHeight: 38,
  },
  title1: {
    fontSize: FontSize.title1,
    fontWeight: '600',
    letterSpacing: -0.8,
    lineHeight: 30,
  },
  title2: {
    fontSize: FontSize.title2,
    fontWeight: '600',
    letterSpacing: -0.3,
    lineHeight: 24,
  },
  body: {
    fontSize: FontSize.body,
    fontWeight: '400',
    letterSpacing: -0.1,
    lineHeight: 26,
  },
  bodySmall: {
    fontSize: FontSize.bodySmall,
    fontWeight: '400',
    letterSpacing: 0,
    lineHeight: 20,
  },
  caption: {
    fontSize: FontSize.caption,
    fontWeight: '400',
    letterSpacing: 0.1,
    lineHeight: 17,
  },
  label: {
    fontSize: FontSize.label,
    fontWeight: '600',
    letterSpacing: LetterSpacing.caps,
    lineHeight: 14,
  },
  micro: {
    fontSize: FontSize.micro,
    fontWeight: '500',
    letterSpacing: LetterSpacing.caps,
    lineHeight: 12,
  },
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

const weightMap: Record<string, TextStyle['fontWeight']> = {
  regular:  '400',
  medium:   '500',
  semibold: '600',
  bold:     '700',
  black:    '900',
};

export function TText({
  variant = 'body',
  color = 'primary',
  weight,
  uppercase = false,
  style,
  children,
  ...props
}: TTextProps) {
  return (
    <Text
      style={[
        variantStyles[variant],
        { color: colorMap[color] },
        weight ? { fontWeight: weightMap[weight] } : undefined,
        uppercase ? { textTransform: 'uppercase' } : undefined,
        ...(Array.isArray(style) ? style : [style]),
      ]}
      {...props}
    >
      {children}
    </Text>
  );
}
