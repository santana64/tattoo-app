import React, { useCallback } from 'react';
import {
  StyleSheet, ViewStyle, TextStyle, ActivityIndicator, View,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
} from 'react-native-reanimated';
import { TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Radius, Spacing, GlowShadow } from '@/constants/theme';
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
}

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
}: TButtonProps) {
  const scale = useSharedValue(1);

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.96, { damping: 15, stiffness: 300 });
  }, []);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 12, stiffness: 250 });
  }, []);

  const handlePress = () => {
    if (disabled || loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress?.();
  };

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const heights = { sm: 36, md: 44, lg: 54 };
  const h = heights[size];
  const isLight = variant === 'primary';
  const isGlow = variant === 'glow';
  const isGlass = variant === 'glass';

  return (
    <Animated.View style={[animStyle, fullWidth && { width: '100%' }, style]}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        style={[
          styles.base,
          { height: h },
          isGlow && styles.variantGlow,
          isGlass && styles.variantGlass,
          variant === 'secondary' && styles.variantSecondary,
          variant === 'ghost' && styles.variantGhost,
          variant === 'destructive' && styles.variantDestructive,
          (disabled || loading) && styles.disabled,
        ]}
      >
        {/* Glow/primary gradient fill */}
        {(variant === 'primary' || isGlow) && (
          <LinearGradient
            colors={isGlow
              ? ['#D4A96A', '#C8A882', '#B8987A']
              : ['#FFFFFF', '#E8E0D0']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        )}

        {loading ? (
          <ActivityIndicator
            color={isLight || isGlow ? Colors.textInverse : Colors.textPrimary}
            size="small"
          />
        ) : (
          <View style={styles.inner}>
            {icon && iconPosition === 'left' && <View style={styles.iconLeft}>{icon}</View>}
            <TText
              variant={size === 'sm' ? 'caption' : 'bodySmall'}
              weight="bold"
              color={isLight || isGlow ? 'inverse' : variant === 'destructive' ? 'primary' : 'primary'}
              uppercase={size !== 'sm'}
              style={[
                styles.text,
                { letterSpacing: size === 'sm' ? 0.5 : 1.5 },
                textStyle,
              ]}
            >
              {title}
            </TText>
            {icon && iconPosition === 'right' && <View style={styles.iconRight}>{icon}</View>}
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconLeft:  { marginRight: 8 },
  iconRight: { marginLeft: 8 },
  text: {},
  variantSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.borderGlass,
  },
  variantGhost: {
    backgroundColor: 'transparent',
  },
  variantDestructive: {
    backgroundColor: Colors.error,
  },
  variantGlow: {
    ...GlowShadow.amberStrong,
  },
  variantGlass: {
    backgroundColor: Colors.glassBg,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  disabled: { opacity: 0.35 },
});
