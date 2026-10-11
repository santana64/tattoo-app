import React, { useEffect } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming,
} from 'react-native-reanimated';
import { Colors, Duration } from '@/constants/theme';

interface TProgressBarProps {
  progress: number; // 0–1
  /** Value the fill starts from on mount (0–1), e.g. the previous step. */
  from?: number;
  height?: number;
  color?: string;
  style?: ViewStyle;
  accessibilityLabel?: string;
}

const EASE = Easing.bezier(0.22, 1, 0.36, 1);
const clamp = (n: number) => Math.min(Math.max(Number.isFinite(n) ? n : 0, 0), 1);

/** Thin gallery-light line: hairline track, gold fill, eased (never springy). */
export function TProgressBar({
  progress,
  from,
  height = 4,
  color = Colors.accentWarm,
  style,
  accessibilityLabel,
}: TProgressBarProps) {
  const reduced = useReducedMotion();
  const target = clamp(progress);
  const fill = useSharedValue(reduced ? target : clamp(from ?? 0));

  useEffect(() => {
    fill.value = reduced ? target : withTiming(target, { duration: Duration.reveal, easing: EASE });
  }, [fill, reduced, target]);

  const barStyle = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(target * 100) }}
      style={[styles.track, { height, borderRadius: height / 2 }, style]}
    >
      <Animated.View style={[styles.fill, { height, borderRadius: height / 2, backgroundColor: color }, barStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    backgroundColor: Colors.borderDefault,
    overflow: 'hidden',
  },
  fill: {},
});
