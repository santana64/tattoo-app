import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Radius, Shadow, GlowShadow } from '@/constants/theme';

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: 'default' | 'elevated' | 'glow' | 'premium';
  radius?: number;
  padding?: number;
}

export function GlassCard({
  children,
  style,
  variant = 'default',
  radius = Radius.xl,
  padding,
}: GlassCardProps) {
  return (
    <View
      style={[
        styles.base,
        { borderRadius: radius },
        padding !== undefined && { padding },
        variant === 'default'   && styles.variantDefault,
        variant === 'elevated'  && styles.variantElevated,
        variant === 'glow'      && styles.variantGlow,
        variant === 'premium'   && styles.variantPremium,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
  variantDefault: {
    backgroundColor: Colors.glassBg,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    ...Shadow.md,
  },
  variantElevated: {
    backgroundColor: Colors.bgSurface,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    ...Shadow.lg,
  },
  variantGlow: {
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.borderGlow,
    ...GlowShadow.amber,
  },
  variantPremium: {
    backgroundColor: 'rgba(200,168,130,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(200,168,130,0.20)',
    ...GlowShadow.amberStrong,
  },
});
