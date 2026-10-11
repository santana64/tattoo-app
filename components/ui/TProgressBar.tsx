import React, { useEffect } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle, useReducedMotion, useSharedValue, withTiming,
} from 'react-native-reanimated';
import { Colors } from '@/constants/theme';
import { EASE_OUT } from '@/components/motion/tokens';

interface TProgressBarProps {
  progress: number; // 0–1
  /** Value the fill starts from on mount (0–1), e.g. the previous step. */
  from?: number;
  height?: number;
  color?: string;
  style?: ViewStyle;
  accessibilityLabel?: string;
}

const FILL_DURATION = 400;
const clamp = (n: number) => Math.min(Math.max(Number.isFinite(n) ? n : 0, 0), 1);

/**
 * Thin gallery-light line: hairline track, gold fill eased out over ~400ms.
 * The fill is an absolutely positioned, childless view, so animating its width
 * never reflows siblings. Reduced motion jumps straight to the value.
 */
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
    fill.value = reduced ? target : withTiming(target, { duration: FILL_DURATION, easing: EASE_OUT });
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
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0 },
});
