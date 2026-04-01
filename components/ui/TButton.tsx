import React from 'react';
import {
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { TText } from './TText';

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive';
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
  const handlePress = () => {
    if (disabled || loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress?.();
  };

  const containerStyle: ViewStyle[] = [
    styles.base,
    styles[`variant_${variant}`],
    styles[`size_${size}`],
    fullWidth && styles.fullWidth,
    (disabled || loading) && styles.disabled,
    style as ViewStyle,
  ].filter(Boolean) as ViewStyle[];

  const isLight = variant === 'primary';

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={handlePress}
      disabled={disabled || loading}
      style={containerStyle}
    >
      {loading ? (
        <ActivityIndicator color={isLight ? Colors.textInverse : Colors.textPrimary} size="small" />
      ) : (
        <View style={styles.inner}>
          {icon && iconPosition === 'left' && <View style={styles.iconLeft}>{icon}</View>}
          <TText
            variant={size === 'sm' ? 'caption' : 'bodySmall'}
            weight="semibold"
            color={isLight ? 'inverse' : variant === 'destructive' ? 'primary' : 'primary'}
            uppercase={size !== 'sm'}
            style={[styles.text, textStyle]}
          >
            {title}
          </TText>
          {icon && iconPosition === 'right' && <View style={styles.iconRight}>{icon}</View>}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: {
    width: '100%',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconLeft: { marginRight: 8 },
  iconRight: { marginLeft: 8 },
  text: {
    letterSpacing: 0.8,
  },
  variant_primary: {
    backgroundColor: Colors.accentAction,
  },
  variant_secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.borderDefault,
  },
  variant_ghost: {
    backgroundColor: 'transparent',
  },
  variant_destructive: {
    backgroundColor: Colors.error,
  },
  size_sm: {
    height: 36,
    paddingHorizontal: Spacing.sm,
  },
  size_md: {
    height: 44,
    paddingHorizontal: Spacing.lg,
  },
  size_lg: {
    height: 52,
    paddingHorizontal: Spacing.xl,
  },
  disabled: {
    opacity: 0.4,
  },
});
