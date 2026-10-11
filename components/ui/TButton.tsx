import React, { useCallback } from 'react';
import {
  StyleSheet, ViewStyle, TextStyle, ActivityIndicator, View, Pressable, Platform,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Radius, GlowShadow, SpringConfig } from '@/constants/theme';
import { TText } from './TText';

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'glass' | 'glow';
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

const HEIGHTS: Record<Size, number> = { sm: 38, md: 46, lg: 54 };
const PAD_X: Record<Size, number> = { sm: 14, md: 18, lg: 24 };

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
  const scale = useSharedValue(1);
  const inactive = disabled || loading;

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.975, SpringConfig.snappy);
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, SpringConfig.gentle);
  }, [scale]);

  const handlePress = () => {
    if (inactive) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  };

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const filled = variant === 'primary' || variant === 'glow';
  const labelColor = filled
    ? Colors.textInverse
    : variant === 'destructive' ? Colors.errorLight
    : variant === 'ghost' ? Colors.textSecondary
    : Colors.textPrimary;

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
          return [
            styles.base,
            { height: HEIGHTS[size], paddingHorizontal: PAD_X[size] },
            variant === 'primary' && styles.primary,
            variant === 'glow' && styles.glow,
            variant === 'secondary' && styles.secondary,
            variant === 'glass' && styles.glass,
            variant === 'ghost' && styles.ghost,
            variant === 'destructive' && styles.destructive,
            hovered && !inactive && (filled ? styles.filledHover : styles.outlineHover),
            pressed && !filled && styles.outlinePressed,
            focused && styles.focused,
            inactive && styles.disabled,
          ];
        }}
      >
        {variant === 'glow' && (
          <LinearGradient
            colors={[Colors.premiumGradStart, Colors.premiumGradEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        )}

        {loading ? (
          <ActivityIndicator color={labelColor} size="small" />
        ) : (
          <View style={styles.inner}>
            {icon && iconPosition === 'left' && <View style={styles.iconLeft}>{icon}</View>}
            <TText
              variant={size === 'sm' ? 'caption' : 'bodySmall'}
              weight="semibold"
              style={[
                { color: labelColor, fontSize: size === 'lg' ? 15 : size === 'md' ? 14 : 13, letterSpacing: -0.1 },
                textStyle,
              ]}
              numberOfLines={1}
            >
              {title}
            </TText>
            {icon && iconPosition === 'right' && <View style={styles.iconRight}>{icon}</View>}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? { cursor: 'pointer', transitionDuration: '180ms' } as object : null),
  },
  inner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  iconLeft:  { marginRight: 8 },
  iconRight: { marginLeft: 8 },
  primary: { backgroundColor: Colors.accentAction },
  glow: { ...GlowShadow.amber },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.borderDefault,
  },
  glass: {
    backgroundColor: Colors.glassBgMid,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  ghost: { backgroundColor: 'transparent' },
  destructive: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(217,105,95,0.45)',
  },
  filledHover: { opacity: 0.9 },
  outlineHover: { backgroundColor: Colors.glassBgHover, borderColor: Colors.borderGlass },
  outlinePressed: { backgroundColor: Colors.bgSubtle },
  focused: { borderWidth: 1.5, borderColor: Colors.borderFocus },
  disabled: { opacity: 0.38 },
});
