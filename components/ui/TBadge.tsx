import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Colors } from '@/constants/theme';
import { TText } from './TText';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'premium' | 'accent';

interface TBadgeProps {
  label: string;
  variant?: BadgeVariant;
  style?: ViewStyle;
  dot?: boolean;
}

// Square tags in tracked capitals. Colour lives in the text and the hairline, never in a fill.
const variantColors: Record<BadgeVariant, { text: string; border: string }> = {
  default: { text: Colors.textSecondary, border: Colors.line },
  success: { text: Colors.successLight, border: Colors.success },
  warning: { text: Colors.warning, border: Colors.warning },
  error:   { text: Colors.error, border: Colors.error },
  info:    { text: Colors.info, border: Colors.info },
  premium: { text: Colors.flameText, border: Colors.flame },
  accent:  { text: Colors.ink, border: Colors.ink },
};

export function TBadge({ label, variant = 'default', style, dot }: TBadgeProps) {
  const c = variantColors[variant];
  return (
    <View style={[styles.badge, { borderColor: c.border }, style]}>
      {dot && <View style={[styles.dot, { backgroundColor: c.text }]} />}
      <TText variant="label" weight="bold" uppercase style={{ color: c.text, letterSpacing: 0.8, fontSize: 9.5, lineHeight: 13 }}>
        {label}
      </TText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
});
