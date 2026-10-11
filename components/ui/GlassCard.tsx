import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Radius, Shadow, Gradients } from '@/constants/theme';

interface GlassCardProps {
  children: React.ReactNode;
  variant?: 'default' | 'elevated' | 'glow' | 'premium' | 'violet' | 'surface';
  style?: ViewStyle;
  radius?: number;
  padding?: number;
}

export function GlassCard({
  children,
  variant = 'default',
  style,
  radius = Radius.xl,
  padding,
}: GlassCardProps) {
  const baseStyle: ViewStyle = {
    borderRadius: radius,
    overflow: 'hidden' as const,
    ...VARIANT_STYLES[variant],
    ...(padding !== undefined ? { padding } : {}),
    ...style,
  };

  // Gold-lit variants: a soft wash from the top-left, like a spotlight on a plinth.
  if (variant === 'glow' || variant === 'premium') {
    return (
      <View style={baseStyle}>
        <LinearGradient
          colors={Gradients.premiumCard}
          start={{ x: 0, y: 0 }} end={{ x: 0.8, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        {children}
      </View>
    );
  }

  return <View style={baseStyle}>{children}</View>;
}

const hairline = StyleSheet.hairlineWidth;

const VARIANT_STYLES: Record<NonNullable<GlassCardProps['variant']>, ViewStyle> = {
  default: {
    backgroundColor: Colors.bgCard,
    borderWidth: hairline,
    borderColor: Colors.borderDefault,
    padding: 18,
  },
  elevated: {
    backgroundColor: Colors.bgElevated,
    borderWidth: hairline,
    borderColor: Colors.borderDefault,
    padding: 18,
    ...Shadow.md,
  },
  glow: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.borderGlow,
    padding: 18,
  },
  premium: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.borderGlow,
    padding: 18,
  },
  violet: {
    backgroundColor: Colors.bgCard,
    borderWidth: hairline,
    borderColor: Colors.borderViolet,
    padding: 18,
  },
  surface: {
    backgroundColor: Colors.bgCard,
    borderWidth: hairline,
    borderColor: Colors.borderSubtle,
    padding: 18,
  },
};
