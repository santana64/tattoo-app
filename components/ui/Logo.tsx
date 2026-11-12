import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withDelay, withTiming, Easing, useReducedMotion,
} from 'react-native-reanimated';
import { TText } from './TText';
import { Colors, Duration, Fonts } from '@/constants/theme';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'full' | 'mark' | 'wordmark';
  animate?: boolean;
  /** Wordmark colour. Defaults to ink; pass `Colors.onInk` on ink grounds. */
  color?: string;
}

const SIZES = {
  sm: { mark: 30, wordmark: 24, gap: 10 },
  md: { mark: 36, wordmark: 30, gap: 12 },
  lg: { mark: 44, wordmark: 38, gap: 14 },
  xl: { mark: 58, wordmark: 54, gap: 16 },
};

const EASE = Easing.bezier(0.22, 1, 0.36, 1);

function useReveal(animate: boolean, delay: number) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(animate ? 0 : 1);
  useEffect(() => {
    if (!animate) return;
    progress.value = withDelay(delay, withTiming(1, { duration: Duration.reveal, easing: EASE }));
  }, [animate, delay, progress]);
  return useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: reduced ? 0 : (1 - progress.value) * 6 }],
  }));
}

/** Monogram: a serif italic "i." stamped on an ink square. */
function Mark({ size, animate, onInk }: { size: number; animate: boolean; onInk: boolean }) {
  const style = useReveal(animate, 60);
  return (
    <Animated.View
      style={[
        styles.mark,
        { width: size, height: size, backgroundColor: onInk ? Colors.paper : Colors.ink },
        style,
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <TText
        variant="displayM"
        italic
        style={{
          fontSize: size * 0.66, lineHeight: size * 0.8, letterSpacing: 0,
          color: onInk ? Colors.ink : Colors.paper,
        }}
      >
        i<TText variant="displayM" italic style={{ fontSize: size * 0.66, lineHeight: size * 0.8, color: Colors.flame }}>.</TText>
      </TText>
    </Animated.View>
  );
}

/** Wordmark: "inkr" in tight heavy grotesque, closed by a vermilion full stop. */
function Wordmark({ fontSize, color, animate }: { fontSize: number; color: string; animate: boolean }) {
  const style = useReveal(animate, 180);
  const type = {
    fontFamily: Fonts.sansBold,
    fontSize,
    lineHeight: fontSize * 1.05,
    letterSpacing: -fontSize * 0.085,
  };
  return (
    <Animated.View style={style}>
      <TText style={[type, { color }]} accessibilityRole="header" accessibilityLabel="Inkr">
        inkr<TText style={[type, { color: Colors.flame }]}>.</TText>
      </TText>
    </Animated.View>
  );
}

export function Logo({ size = 'md', variant = 'full', animate = false, color }: LogoProps) {
  const conf = SIZES[size];
  const textColor = color ?? Colors.ink;
  const onInk = textColor !== Colors.ink;

  if (variant === 'mark') return <Mark size={conf.mark} animate={animate} onInk={onInk} />;
  if (variant === 'wordmark') return <Wordmark fontSize={conf.wordmark} color={textColor} animate={animate} />;

  return (
    <View style={[styles.fullLogo, { gap: conf.gap }]}>
      <Mark size={conf.mark} animate={animate} onInk={onInk} />
      <Wordmark fontSize={conf.wordmark} color={textColor} animate={animate} />
    </View>
  );
}

const styles = StyleSheet.create({
  fullLogo: { flexDirection: 'row', alignItems: 'center' },
  mark: { alignItems: 'center', justifyContent: 'center' },
});
