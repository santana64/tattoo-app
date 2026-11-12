import React from 'react';
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';

interface GlassSurfaceProps {
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  /** `paper` (default) for bars over pages, `ink` for bars over photography. */
  tone?: 'paper' | 'ink';
  children?: React.ReactNode;
}

/**
 * Frosted bar surface. Paper tone over pages, ink tone over photography.
 * iOS and web get a real backdrop blur; Android gets a near-opaque wall tone
 * (its blur is costly and inconsistent across devices).
 */
export function GlassSurface({ style, intensity = 40, tone = 'paper', children }: GlassSurfaceProps) {
  const ink = tone === 'ink';
  if (Platform.OS === 'android') {
    return <View style={[ink ? styles.androidInk : styles.android, style]}>{children}</View>;
  }
  return (
    <View style={[styles.wrap, style]}>
      <BlurView intensity={intensity} tint={ink ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, ink ? styles.tintInk : styles.tint]} pointerEvents="none" />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden' },
  tint: { backgroundColor: 'rgba(240,236,227,0.90)' },
  tintInk: { backgroundColor: 'rgba(18,19,16,0.62)' },
  android: { backgroundColor: 'rgba(240,236,227,0.98)' },
  androidInk: { backgroundColor: 'rgba(18,19,16,0.96)' },
});
