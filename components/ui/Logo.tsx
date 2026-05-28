import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withSpring, withDelay, withTiming, FadeIn,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { TText } from './TText';
import { Colors } from '@/constants/theme';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'full' | 'mark' | 'wordmark';
  animate?: boolean;
  color?: string;
}

const SIZES = {
  sm: { mark: 28, wordmark: 18, gap: 6 },
  md: { mark: 36, wordmark: 22, gap: 8 },
  lg: { mark: 48, wordmark: 28, gap: 10 },
  xl: { mark: 64, wordmark: 36, gap: 14 },
};

// SVG-style ink drop mark rendered with Views
function InkDropMark({ size, animate }: { size: number; animate: boolean }) {
  const scale = useSharedValue(animate ? 0 : 1);
  const rotate = useSharedValue(animate ? -15 : 0);
  const opacity = useSharedValue(animate ? 0 : 1);

  useEffect(() => {
    if (!animate) return;
    opacity.value = withDelay(100, withTiming(1, { duration: 400 }));
    scale.value = withDelay(150, withSpring(1, { damping: 10, stiffness: 200 }));
    rotate.value = withDelay(150, withSpring(0, { damping: 12, stiffness: 180 }));
  }, []);

  const markStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { rotate: `${rotate.value}deg` }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[{ width: size, height: size }, markStyle]}>
      <LinearGradient
        colors={[Colors.accentGlow, Colors.accentWarm, '#C8783A']}
        locations={[0, 0.5, 1]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={[styles.inkDrop, {
          width: size,
          height: size * 1.1,
          borderRadius: size * 0.45,
          borderTopLeftRadius: size * 0.45,
          borderTopRightRadius: size * 0.45,
          borderBottomLeftRadius: size * 0.45,
          borderBottomRightRadius: size * 0.1,
          transform: [{ rotate: '180deg' }],
        }]}
      />
      {/* Inner highlight */}
      <View style={[styles.inkHighlight, {
        width: size * 0.25,
        height: size * 0.35,
        top: size * 0.15,
        left: size * 0.2,
        borderRadius: size * 0.15,
      }]} />
    </Animated.View>
  );
}

export function Logo({ size = 'md', variant = 'full', animate = false, color }: LogoProps) {
  const conf = SIZES[size];
  const textColor = color ?? Colors.textPrimary;

  const wordmarkOpacity = useSharedValue(animate ? 0 : 1);
  const wordmarkX = useSharedValue(animate ? -8 : 0);

  useEffect(() => {
    if (!animate) return;
    wordmarkOpacity.value = withDelay(350, withTiming(1, { duration: 500 }));
    wordmarkX.value = withDelay(350, withSpring(0, { damping: 18, stiffness: 200 }));
  }, []);

  const wordStyle = useAnimatedStyle(() => ({
    opacity: wordmarkOpacity.value,
    transform: [{ translateX: wordmarkX.value }],
  }));

  if (variant === 'mark') {
    return <InkDropMark size={conf.mark} animate={animate} />;
  }

  if (variant === 'wordmark') {
    return (
      <Animated.View style={wordStyle}>
        <TText
          variant="displayM"
          weight="black"
          style={[styles.wordmark, { fontSize: conf.wordmark, color: textColor, letterSpacing: conf.wordmark * 0.18 }]}
        >
          INKR
        </TText>
      </Animated.View>
    );
  }

  return (
    <View style={[styles.fullLogo, { gap: conf.gap }]}>
      <InkDropMark size={conf.mark} animate={animate} />
      <Animated.View style={wordStyle}>
        <TText
          variant="displayM"
          weight="black"
          style={[styles.wordmark, { fontSize: conf.wordmark, color: textColor, letterSpacing: conf.wordmark * 0.15 }]}
        >
          INKR
        </TText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  fullLogo: { flexDirection: 'row', alignItems: 'center' },
  inkDrop: { position: 'absolute' },
  inkHighlight: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.30)',
    borderRadius: 10,
  },
  wordmark: { letterSpacing: 5 },
});
