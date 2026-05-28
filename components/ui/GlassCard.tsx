import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Radius, GlowShadow } from '@/constants/theme';

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
    ...(padding !== undefined ? { padding } : {}),
    ...VARIANT_STYLES[variant],
    ...style,
  };

  if (variant === 'glow' || variant === 'premium') {
    return (
      <View style={baseStyle}>
        <LinearGradient
          colors={['rgba(212,168,100,0.10)', 'rgba(212,168,100,0.03)']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
        />
        {children}
      </View>
    );
  }

  if (variant === 'violet') {
    return (
      <View style={baseStyle}>
        <LinearGradient
          colors={['rgba(139,92,246,0.10)', 'rgba(139,92,246,0.03)']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
        />
        {children}
      </View>
    );
  }

  return <View style={baseStyle}>{children}</View>;
}

const VARIANT_STYLES: Record<string, ViewStyle> = {
  default: {
    backgroundColor: Colors.glassBg,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    padding: 16,
  },
  elevated: {
    backgroundColor: Colors.bgSurface,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    padding: 16,
    ...GlowShadow.white,
  },
  glow: {
    backgroundColor: Colors.glassAmber,
    borderWidth: 1.5,
    borderColor: Colors.borderGlow,
    padding: 16,
    ...GlowShadow.amber,
  },
  premium: {
    backgroundColor: Colors.glassAmber,
    borderWidth: 1.5,
    borderColor: Colors.borderGlow,
    padding: 16,
    ...GlowShadow.amber,
  },
  violet: {
    backgroundColor: Colors.glassViolet,
    borderWidth: 1.5,
    borderColor: Colors.borderViolet,
    padding: 16,
    ...GlowShadow.violet,
  },
  surface: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    padding: 16,
  },
};
