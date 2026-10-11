import React from 'react';
import { Pressable, PressableProps, StyleProp, ViewStyle, Platform } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, useReducedMotion } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { EASE_OUT, MotionDuration } from './tokens';

interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  /** Scale while pressed. 0.97 for cards/buttons, 0.92 for small icons. */
  pressedScale?: number;
  /** Light haptic on commit (native only). Use for saves, toggles — not for navigation. */
  haptic?: boolean;
  children: React.ReactNode;
}

/**
 * Feedback on press-in, commit on press-out: the element compresses in 120ms
 * the instant a finger lands, which is what makes the app feel physical.
 */
export function PressableScale({
  style, pressedScale = 0.97, haptic = false, onPressIn, onPressOut, onPress, children, ...rest
}: PressableScaleProps) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <Pressable
      {...rest}
      pressRetentionOffset={{ top: 16, bottom: 16, left: 16, right: 16 }}
      onPressIn={(e) => {
        if (!reduced) scale.set(withTiming(pressedScale, { duration: MotionDuration.press, easing: EASE_OUT }));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.set(withTiming(1, { duration: MotionDuration.state, easing: EASE_OUT }));
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (haptic && Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.(e);
      }}
      style={Platform.OS === 'web' ? ({ cursor: 'pointer' } as ViewStyle) : undefined}
    >
      <Animated.View style={[style, anim]}>{children}</Animated.View>
    </Pressable>
  );
}
