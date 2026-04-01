import React from 'react';
import { Text, TextStyle, StyleSheet, TextProps } from 'react-native';
import { Colors, FontSize } from '@/constants/theme';

type Variant =
  | 'displayXL'
  | 'displayL'
  | 'title1'
  | 'title2'
  | 'body'
  | 'bodySmall'
  | 'caption'
  | 'label';

type Color = 'primary' | 'secondary' | 'tertiary' | 'inverse' | 'accent' | 'accentWarm' | 'error' | 'success' | 'warning';

interface TTextProps extends TextProps {
  variant?: Variant;
  color?: Color;
  weight?: 'regular' | 'medium' | 'semibold' | 'bold';
  uppercase?: boolean;
  style?: TextStyle | TextStyle[];
}

const variantStyles: Record<Variant, TextStyle> = {
  displayXL: { fontSize: FontSize.displayXL, fontWeight: '700', letterSpacing: -0.5, lineHeight: 42 },
  displayL: { fontSize: FontSize.displayL, fontWeight: '700', letterSpacing: -0.3, lineHeight: 36 },
  title1: { fontSize: FontSize.title1, fontWeight: '600', letterSpacing: -0.2, lineHeight: 28 },
  title2: { fontSize: FontSize.title2, fontWeight: '600', letterSpacing: 0, lineHeight: 22 },
  body: { fontSize: FontSize.body, fontWeight: '400', letterSpacing: 0, lineHeight: 24 },
  bodySmall: { fontSize: FontSize.bodySmall, fontWeight: '400', letterSpacing: 0, lineHeight: 20 },
  caption: { fontSize: FontSize.caption, fontWeight: '400', letterSpacing: 0.2, lineHeight: 16 },
  label: { fontSize: FontSize.label, fontWeight: '500', letterSpacing: 0.5, lineHeight: 16 },
};

const colorMap: Record<Color, string> = {
  primary: Colors.textPrimary,
  secondary: Colors.textSecondary,
  tertiary: Colors.textTertiary,
  inverse: Colors.textInverse,
  accent: Colors.accent,
  accentWarm: Colors.accentWarm,
  error: Colors.error,
  success: Colors.success,
  warning: Colors.warning,
};

const weightMap: Record<string, TextStyle['fontWeight']> = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
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
