import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Radius } from '@/constants/theme';
import { TText } from './TText';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'premium' | 'accent';

interface TBadgeProps {
  label: string;
  variant?: BadgeVariant;
  style?: ViewStyle;
  dot?: boolean;
}

const variantColors: Record<BadgeVariant, { bg: string; text: string; border: string }> = {
  default: { bg: 'transparent', text: Colors.textSecondary, border: Colors.borderDefault },
  success: { bg: 'rgba(143,181,154,0.10)', text: Colors.successLight, border: 'rgba(143,181,154,0.28)' },
  warning: { bg: 'rgba(217,165,91,0.10)', text: Colors.warningLight, border: 'rgba(217,165,91,0.28)' },
  error:   { bg: 'rgba(217,105,95,0.10)', text: Colors.errorLight, border: 'rgba(217,105,95,0.28)' },
  info:    { bg: 'rgba(159,170,186,0.10)', text: Colors.infoLight, border: 'rgba(159,170,186,0.26)' },
  premium: { bg: 'rgba(201,164,106,0.10)', text: Colors.accentGlow, border: Colors.borderGlow },
  accent:  { bg: 'rgba(237,227,209,0.08)', text: Colors.accent, border: Colors.borderDefault },
};

export function TBadge({ label, variant = 'default', style, dot }: TBadgeProps) {
  const c = variantColors[variant];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg, borderColor: c.border }, style]}>
      {dot && <View style={[styles.dot, { backgroundColor: c.text }]} />}
      <TText variant="label" style={{ color: c.text, letterSpacing: 0.4, textTransform: 'none', fontSize: 11 }}>
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
    paddingVertical: 3,
    borderRadius: Radius.xs,
    borderWidth: StyleSheet.hairlineWidth,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginRight: 6,
  },
});
