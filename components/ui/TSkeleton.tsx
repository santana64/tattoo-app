import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  useReducedMotion,
} from 'react-native-reanimated';
import { Colors, Radius } from '@/constants/theme';

interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: ViewStyle;
}

/** Loading placeholder: a soft band of light sweeps across, like a gallery spotlight passing. */
export function TSkeleton({ width = '100%', height = 16, radius = Radius.sm, style }: SkeletonProps) {
  const reduced = useReducedMotion();
  const [w, setW] = useState(0);
  const sweep = useSharedValue(0);

  useEffect(() => {
    if (reduced || !w) return;
    // Constant motion → linear, as a single continuous pass.
    sweep.set(withRepeat(withTiming(1, { duration: 1400, easing: Easing.linear }), -1, false));
  }, [reduced, w, sweep]);

  const bandStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -w + sweep.get() * w * 2 }],
  }));

  return (
    <View
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={[{ width, height, borderRadius: radius, backgroundColor: Colors.bgSubtle, overflow: 'hidden' }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {!reduced && w > 0 && (
        <Animated.View style={[StyleSheet.absoluteFill, bandStyle]}>
          <LinearGradient
            colors={['rgba(255,253,249,0)', 'rgba(255,253,249,0.55)', 'rgba(255,253,249,0)']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}
    </View>
  );
}

// ─── Preset skeletons ─────────────────────────────────────────────────────────
export function PostCardSkeleton() {
  return (
    <View style={skStyles.card}>
      <TSkeleton height={360} radius={Radius.xl} />
      <View style={skStyles.footer}>
        <TSkeleton width={36} height={36} radius={0} />
        <View style={{ flex: 1, marginLeft: 10, gap: 6 }}>
          <TSkeleton width="60%" height={12} />
          <TSkeleton width="40%" height={10} />
        </View>
      </View>
    </View>
  );
}

export function ArtistCardSkeleton() {
  return (
    <View style={skStyles.artistCard}>
      <TSkeleton height={232} radius={Radius.xl} />
      <View style={skStyles.artistFooter}>
        <TSkeleton width={44} height={44} radius={0} />
        <View style={{ flex: 1, marginLeft: 10, gap: 6 }}>
          <TSkeleton width="50%" height={12} />
          <TSkeleton width="35%" height={10} />
        </View>
      </View>
    </View>
  );
}

export function RequestCardSkeleton() {
  return (
    <View style={skStyles.requestCard}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <TSkeleton width={44} height={44} radius={0} />
        <View style={{ flex: 1, gap: 6 }}>
          <TSkeleton width="55%" height={12} />
          <TSkeleton width="80%" height={10} />
          <TSkeleton width="40%" height={10} />
        </View>
        <TSkeleton width={60} height={20} radius={Radius.full} />
      </View>
    </View>
  );
}

const skStyles = StyleSheet.create({
  card: { marginBottom: 20 },
  footer: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  artistCard: { marginBottom: 16 },
  artistFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  requestCard: {
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderDefault,
  },
});
