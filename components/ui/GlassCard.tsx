import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Colors } from '@/constants/theme';

interface GlassCardProps {
  children: React.ReactNode;
  variant?: 'default' | 'elevated' | 'glow' | 'premium' | 'violet' | 'surface';
  style?: ViewStyle;
  radius?: number;
  padding?: number;
}

/**
 * v5 panel: a flat white sheet on the paper page, hairline border, square.
 * (The name is legacy — nothing is glass any more.)
 *   default / surface  hairline sheet
 *   elevated           ink top rule — the lead panel of a section
 *   glow / premium     vermilion top rule — featured or premium content
 *   violet             quiet paper-wash panel
 */
export function GlassCard({
  children,
  variant = 'default',
  style,
  radius = 0,
  padding,
}: GlassCardProps) {
  return (
    <View
      style={[
        styles.base,
        VARIANT_STYLES[variant],
        { borderRadius: radius },
        padding !== undefined ? { padding } : undefined,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.line,
    padding: 22,
    overflow: 'hidden',
  },
});

const VARIANT_STYLES: Record<NonNullable<GlassCardProps['variant']>, ViewStyle> = {
  default: {},
  surface: {},
  elevated: { borderTopWidth: 2, borderTopColor: Colors.ink },
  glow: { borderTopWidth: 2, borderTopColor: Colors.flame },
  premium: { borderTopWidth: 2, borderTopColor: Colors.flame },
  violet: { backgroundColor: Colors.bgSurface },
};
