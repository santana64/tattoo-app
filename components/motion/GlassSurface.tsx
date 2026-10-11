import React from 'react';
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';

interface GlassSurfaceProps {
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  children?: React.ReactNode;
}

/**
 * Frosted gallery glass for bars floating over photography.
 * iOS and web get a real backdrop blur; Android gets a near-opaque wall tone
 * (its blur is costly and inconsistent across devices).
 */
export function GlassSurface({ style, intensity = 40, children }: GlassSurfaceProps) {
  if (Platform.OS === 'android') {
    return <View style={[styles.android, style]}>{children}</View>;
  }
  return (
    <View style={[styles.wrap, style]}>
      <BlurView intensity={intensity} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, styles.tint]} pointerEvents="none" />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden' },
  tint: { backgroundColor: 'rgba(11,10,9,0.55)' },
  android: { backgroundColor: 'rgba(11,10,9,0.96)' },
});
