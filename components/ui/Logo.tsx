import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withDelay, withTiming, Easing,
} from 'react-native-reanimated';
import { TText } from './TText';
import { Colors, Duration } from '@/constants/theme';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'full' | 'mark' | 'wordmark';
  animate?: boolean;
  color?: string;
}

const SIZES = {
  sm: { mark: 28, wordmark: 24, gap: 8 },
  md: { mark: 34, wordmark: 30, gap: 10 },
  lg: { mark: 44, wordmark: 40, gap: 12 },
  xl: { mark: 58, wordmark: 56, gap: 14 },
};

const EASE = Easing.bezier(0.22, 1, 0.36, 1);

function useReveal(animate: boolean, delay: number) {
  const progress = useSharedValue(animate ? 0 : 1);
  useEffect(() => {
    if (!animate) return;
    progress.value = withDelay(delay, withTiming(1, { duration: Duration.reveal, easing: EASE }));
  }, [animate, delay, progress]);
  return useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 6 }],
  }));
}

/** Monogram: an italic serif "i" set inside a hairline gold ring. */
function Mark({ size, animate }: { size: number; animate: boolean }) {
  const style = useReveal(animate, 60);
  return (
    <Animated.View
      style={[styles.mark, { width: size, height: size, borderRadius: size / 2 }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <TText
        variant="displayM"
        italic
        style={{ fontSize: size * 0.72, lineHeight: size * 0.9, color: Colors.accentGlow, marginTop: size * 0.04 }}
      >
        i
      </TText>
    </Animated.View>
  );
}

/** Wordmark: "Inkr" in the editorial serif, closed by a gold full stop. */
function Wordmark({ fontSize, color, animate }: { fontSize: number; color: string; animate: boolean }) {
  const style = useReveal(animate, 180);
  return (
    <Animated.View style={style}>
      <TText
        variant="displayM"
        style={{ fontSize, lineHeight: fontSize * 1.05, color, letterSpacing: -fontSize * 0.02 }}
        accessibilityRole="header"
        accessibilityLabel="Inkr"
      >
        Inkr<TText variant="displayM" style={{ fontSize, lineHeight: fontSize * 1.05, color: Colors.accentWarm }}>.</TText>
      </TText>
    </Animated.View>
  );
}

export function Logo({ size = 'md', variant = 'full', animate = false, color }: LogoProps) {
  const conf = SIZES[size];
  const textColor = color ?? Colors.textPrimary;

  if (variant === 'mark') return <Mark size={conf.mark} animate={animate} />;
  if (variant === 'wordmark') return <Wordmark fontSize={conf.wordmark} color={textColor} animate={animate} />;

  return (
    <View style={[styles.fullLogo, { gap: conf.gap }]}>
      <Mark size={conf.mark} animate={animate} />
      <Wordmark fontSize={conf.wordmark} color={textColor} animate={animate} />
    </View>
  );
}

const styles = StyleSheet.create({
  fullLogo: { flexDirection: 'row', alignItems: 'center' },
  mark: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.borderGlow,
    backgroundColor: Colors.glassAmber,
  },
});
