import React, { useEffect } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Colors, Radius } from '@/constants/theme';

interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: ViewStyle;
}

export function TSkeleton({ width = '100%', height = 16, radius = Radius.sm, style }: SkeletonProps) {
  const opacity = useSharedValue(0.45);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.85, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.45, { duration: 900, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[{ width, height, borderRadius: radius, backgroundColor: Colors.bgElevated }, animStyle, style]}
    />
  );
}

// ─── Preset skeletons ─────────────────────────────────────────────────────────
export function PostCardSkeleton() {
  return (
    <View style={skStyles.card}>
      <TSkeleton height={360} radius={Radius.xl} />
      <View style={skStyles.footer}>
        <TSkeleton width={36} height={36} radius={18} />
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
        <TSkeleton width={44} height={44} radius={22} />
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
        <TSkeleton width={44} height={44} radius={22} />
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
