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

const variantColors: Record<BadgeVariant, { bg: string; text: string }> = {
  default: { bg: Colors.bgSubtle, text: Colors.textSecondary },
  success: { bg: 'rgba(74,222,128,0.12)', text: Colors.success },
  warning: { bg: 'rgba(251,191,36,0.12)', text: Colors.warning },
  error: { bg: 'rgba(248,113,113,0.12)', text: Colors.error },
  info: { bg: 'rgba(96,165,250,0.12)', text: Colors.info },
  premium: { bg: 'rgba(200,168,130,0.15)', text: Colors.accentWarm },
  accent: { bg: 'rgba(232,224,208,0.12)', text: Colors.accent },
};

export function TBadge({ label, variant = 'default', style, dot }: TBadgeProps) {
  const colors = variantColors[variant];
  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }, style]}>
      {dot && (
        <View
          style={[
            styles.dot,
            { backgroundColor: colors.text },
          ]}
        />
      )}
      <TText variant="label" style={{ color: colors.text, letterSpacing: 0.3 }}>
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
    alignSelf: 'flex-start',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginRight: 5,
  },
});
