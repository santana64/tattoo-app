import React, { useCallback } from 'react';
import {
  StyleSheet, ViewStyle, TextStyle, ActivityIndicator, View, Pressable, Platform,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, useReducedMotion,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/theme';
import { EASE_OUT, MotionDuration } from '@/components/motion/tokens';
import { TText } from './TText';

/**
 * v5 buttons are square, set in tracked capitals.
 *   primary     ink fill on paper — the one main action of a screen
 *   secondary   ink outline
 *   ghost       quiet text action
 *   destructive vermilion-red outline
 *   glow        vermilion fill — premium and "book now" moments only
 *   glass       paper fill — for ink panels and over photography
 *   inverse     paper outline — secondary action on ink
 */
type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'glass' | 'glow' | 'inverse';
type Size = 'sm' | 'md' | 'lg';

interface TButtonProps {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  style?: ViewStyle;
  textStyle?: TextStyle;
  fullWidth?: boolean;
  accessibilityLabel?: string;
}

// RN-web adds hover/focus to the Pressable state; native only reports `pressed`.
type InteractionState = { pressed: boolean; hovered?: boolean; focused?: boolean };

const HEIGHTS: Record<Size, number> = { sm: 36, md: 46, lg: 56 };
const PAD_X: Record<Size, number> = { sm: 12, md: 18, lg: 24 };
const FONT: Record<Size, number> = { sm: 10, md: 11, lg: 11.5 };

const LABEL: Record<Variant, string> = {
  primary: Colors.paper,
  secondary: Colors.textPrimary,
  ghost: Colors.textSecondary,
  destructive: Colors.error,
  glass: Colors.ink,
  glow: '#FFFFFF',
  inverse: Colors.onInk,
};

export function TButton({
  title,
  onPress,
  variant = 'primary',
  size = 'lg',
  disabled = false,
  loading = false,
  icon,
  iconPosition = 'left',
  style,
  textStyle,
  fullWidth = true,
  accessibilityLabel,
}: TButtonProps) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const inactive = disabled || loading;

  const handlePressIn = useCallback(() => {
    if (!reduced) scale.value = withTiming(0.98, { duration: MotionDuration.press, easing: EASE_OUT });
  }, [reduced, scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withTiming(1, { duration: MotionDuration.state, easing: EASE_OUT });
  }, [scale]);

  const handlePress = () => {
    if (inactive) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  };

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[animStyle, fullWidth && { width: '100%' }, style]}>
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={inactive}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? title}
        accessibilityState={{ disabled: inactive, busy: loading }}
        style={(state) => {
          const { hovered, focused, pressed } = state as InteractionState;
          const lit = (hovered || pressed) && !inactive;
          return [
            styles.base,
            { minHeight: HEIGHTS[size], paddingHorizontal: PAD_X[size] },
            styles[variant],
            lit && HOVER[variant],
            focused && styles.focused,
            inactive && styles.disabled,
          ];
        }}
      >
        {(state) => {
          const { hovered, pressed } = state as InteractionState;
          const lit = (hovered || pressed) && !inactive;
          const color = lit ? HOVER_LABEL[variant] : LABEL[variant];
          return loading ? (
            <ActivityIndicator color={color} size="small" />
          ) : (
            <View style={styles.inner}>
              {icon && iconPosition === 'left' && <View style={styles.iconLeft}>{icon}</View>}
              <TText
                variant="label"
                weight="bold"
                uppercase
                style={[{ color, fontSize: FONT[size], letterSpacing: 0.8, lineHeight: 16 }, textStyle]}
                numberOfLines={1}
              >
                {title}
              </TText>
              {icon && iconPosition === 'right' && <View style={styles.iconRight}>{icon}</View>}
            </View>
          );
        }}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
    ...(Platform.OS === 'web'
      ? ({ cursor: 'pointer', transitionProperty: 'background-color, border-color', transitionDuration: '200ms' } as object)
      : null),
  },
  inner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  iconLeft:  { marginRight: 10 },
  iconRight: { marginLeft: 10 },
  primary: { backgroundColor: Colors.ink, borderColor: Colors.ink },
  glow: { backgroundColor: Colors.flame, borderColor: Colors.flame },
  secondary: { backgroundColor: 'transparent', borderColor: Colors.ink },
  glass: { backgroundColor: Colors.paper, borderColor: Colors.paper },
  inverse: { backgroundColor: 'transparent', borderColor: Colors.onInk },
  ghost: { backgroundColor: 'transparent' },
  destructive: { backgroundColor: 'transparent', borderColor: Colors.error },
  focused: { borderColor: Colors.flame, borderWidth: 2 },
  disabled: { opacity: 0.42 },
});

const hover = StyleSheet.create({
  toFlame: { backgroundColor: Colors.flame, borderColor: Colors.flame },
  toInk: { backgroundColor: Colors.ink, borderColor: Colors.ink },
  toPaper: { backgroundColor: Colors.paper, borderColor: Colors.paper },
  toWash: { backgroundColor: Colors.wash },
  toError: { backgroundColor: Colors.error, borderColor: Colors.error },
});

const HOVER: Record<Variant, ViewStyle> = {
  primary: hover.toFlame,
  glass: hover.toFlame,
  glow: hover.toInk,
  secondary: hover.toInk,
  inverse: hover.toPaper,
  ghost: hover.toWash,
  destructive: hover.toError,
};

const HOVER_LABEL: Record<Variant, string> = {
  primary: '#FFFFFF',
  glass: '#FFFFFF',
  glow: Colors.paper,
  secondary: Colors.paper,
  inverse: Colors.ink,
  ghost: Colors.textPrimary,
  destructive: '#FFFFFF',
};
