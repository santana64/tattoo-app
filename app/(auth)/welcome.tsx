import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions, TouchableOpacity, Animated as RNAnimated } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSpring,
  withDelay, withRepeat, withSequence, Easing, FadeIn, FadeInUp, FadeInDown,
  interpolate, useAnimatedScrollHandler,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Radius, GlowShadow, Gradients } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { Logo } from '@/components/ui/Logo';

const { width: W, height: H } = Dimensions.get('window');

// Floating orb for aurora effect
function FloatingOrb({ color, size, x, y, delay }: { color: string; size: number; x: string; y: number; delay: number }) {
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 1200 }));
    translateY.value = withDelay(delay, withRepeat(
      withSequence(
        withTiming(-20, { duration: 4000, easing: Easing.inOut(Easing.sine) }),
        withTiming(20, { duration: 4000, easing: Easing.inOut(Easing.sine) }),
      ), -1, true
    ));
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value * 0.6,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFillObject, style]} pointerEvents="none">
      <View style={{
        position: 'absolute',
        left: x,
        top: y,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        filter: [{ blur: size * 0.5 }] as any,
      }} />
    </Animated.View>
  );
}

// Stats pill showing social proof
function StatPill({ value, label, delay }: { value: string; label: string; delay: number }) {
  return (
    <Animated.View entering={FadeInUp.delay(delay).springify()} style={styles.statPill}>
      <TText variant="title2" weight="bold" style={{ color: Colors.accentGlow, letterSpacing: -1 }}>{value}</TText>
      <TText variant="caption" color="secondary" style={{ marginTop: 1 }}>{label}</TText>
    </Animated.View>
  );
}

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Ken Burns — main BG
  const bgScale = useSharedValue(1);
  const bgOpacity = useSharedValue(0);

  // Particle dots
  const dotOpacity = useSharedValue(0);

  // CTA buttons
  const btnScale1 = useSharedValue(0.92);
  const btnScale2 = useSharedValue(0.88);
  const btnOpacity1 = useSharedValue(0);
  const btnOpacity2 = useSharedValue(0);

  useEffect(() => {
    // Background fade in
    bgOpacity.value = withTiming(1, { duration: 1000 });

    // Ken Burns
    bgScale.value = withRepeat(
      withSequence(
        withTiming(1.10, { duration: 12000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1.0, { duration: 12000, easing: Easing.inOut(Easing.ease) })
      ), -1, false
    );

    // Buttons entrance
    btnOpacity1.value = withDelay(600, withTiming(1, { duration: 500 }));
    btnScale1.value = withDelay(600, withSpring(1, { damping: 12, stiffness: 200 }));
    btnOpacity2.value = withDelay(800, withTiming(1, { duration: 500 }));
    btnScale2.value = withDelay(800, withSpring(1, { damping: 12, stiffness: 200 }));
    dotOpacity.value = withDelay(1200, withTiming(1, { duration: 800 }));
  }, []);

  const bgStyle = useAnimatedStyle(() => ({
    transform: [{ scale: bgScale.value }],
    opacity: bgOpacity.value,
  }));

  const btn1Style = useAnimatedStyle(() => ({
    transform: [{ scale: btnScale1.value }],
    opacity: btnOpacity1.value,
  }));

  const btn2Style = useAnimatedStyle(() => ({
    transform: [{ scale: btnScale2.value }],
    opacity: btnOpacity2.value,
  }));

  const handleStart = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/(auth)/sign-in');
  };

  const handleSignIn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(auth)/sign-in');
  };

  return (
    <View style={styles.container}>
      {/* BG Image with Ken Burns */}
      <Animated.View style={[StyleSheet.absoluteFill, bgStyle]}>
        <Image
          source={{ uri: 'https://images.unsplash.com/photo-1590246815015-e4e6de2a6873?w=1200' }}
          style={styles.bg}
          contentFit="cover"
        />
      </Animated.View>

      {/* Multi-layer gradient */}
      <LinearGradient
        colors={['rgba(3,3,5,0.0)', 'rgba(3,3,5,0.40)', 'rgba(3,3,5,0.75)', Colors.bgPrimary]}
        locations={[0, 0.3, 0.6, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Aurora orbs */}
      <FloatingOrb color={Colors.violet} size={300} x={'-20%'} y={H * 0.05} delay={400} />
      <FloatingOrb color={Colors.accentWarm} size={200} x={'60%'} y={H * 0.15} delay={600} />
      <FloatingOrb color={Colors.cyan} size={150} x={'75%'} y={H * 0.6} delay={800} />

      {/* Top bar — logo */}
      <Animated.View
        entering={FadeIn.delay(200).duration(800)}
        style={[styles.topBar, { paddingTop: insets.top + 12 }]}
      >
        <Logo size="md" variant="full" animate />
      </Animated.View>

      {/* Center — Hero headline */}
      <View style={styles.hero} pointerEvents="none">
        <Animated.View entering={FadeInDown.delay(350).duration(700).springify()}>
          <TText
            variant="displayXL"
            weight="black"
            style={styles.heroTitle}
          >
            L'art{'\n'}sur ta peau.
          </TText>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(500).duration(600)}>
          <TText variant="body" color="secondary" style={styles.heroSub}>
            Trouve le tatoueur parfait.{'\n'}Réserve en quelques touches.
          </TText>
        </Animated.View>
      </View>

      {/* Stats row */}
      <Animated.View entering={FadeInUp.delay(700).springify()} style={styles.statsRow}>
        <StatPill value="2 400+" label="artistes" delay={720} />
        <View style={styles.statsDivider} />
        <StatPill value="98%" label="satisfaction" delay={780} />
        <View style={styles.statsDivider} />
        <StatPill value="12k+" label="tatouages" delay={840} />
      </Animated.View>

      {/* CTA section */}
      <View style={[styles.actions, { paddingBottom: insets.bottom + Spacing.lg }]}>
        {/* Primary CTA */}
        <Animated.View style={btn1Style}>
          <TouchableOpacity
            onPress={handleStart}
            activeOpacity={0.9}
            style={styles.primaryBtn}
          >
            <LinearGradient
              colors={[Colors.accentGlow, Colors.accentWarm, '#B8783A']}
              locations={[0, 0.55, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <TText variant="body" weight="bold" style={styles.primaryBtnText}>
              Commencer maintenant
            </TText>
            <View style={styles.primaryBtnArrow}>
              <TText style={{ color: Colors.bgPrimary, fontSize: 16 }}>→</TText>
            </View>
          </TouchableOpacity>
        </Animated.View>

        {/* Secondary — artist CTA */}
        <Animated.View style={btn2Style}>
          <TouchableOpacity
            onPress={handleSignIn}
            activeOpacity={0.8}
            style={styles.secondaryBtn}
          >
            <TText variant="bodySmall" color="secondary">
              Déjà un compte ?{' '}
              <TText variant="bodySmall" style={{ color: Colors.accentWarm }}>
                Se connecter
              </TText>
            </TText>
          </TouchableOpacity>
        </Animated.View>

        {/* Micro legal */}
        <Animated.View entering={FadeIn.delay(1000).duration(600)}>
          <TText variant="micro" color="tertiary" style={styles.legal}>
            En continuant, tu acceptes nos CGU · Politique de confidentialité
          </TText>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary, overflow: 'hidden' },
  bg: { width: W, height: H + 60, top: -30 },

  topBar: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    paddingHorizontal: Spacing.lg,
    zIndex: 10,
  },

  hero: {
    position: 'absolute',
    bottom: '42%',
    left: 0, right: 0,
    paddingHorizontal: Spacing.lg,
  },
  heroTitle: {
    letterSpacing: -3,
    lineHeight: 58,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  heroSub: {
    lineHeight: 24,
    letterSpacing: 0.2,
  },

  statsRow: {
    position: 'absolute',
    bottom: '30%',
    left: 0, right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.xl,
  },
  statPill: { alignItems: 'center' },
  statsDivider: { width: 1, height: 28, backgroundColor: Colors.borderSubtle },

  actions: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },

  primaryBtn: {
    height: 58,
    borderRadius: Radius.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...GlowShadow.amberStrong,
  },
  primaryBtnText: {
    color: Colors.bgPrimary,
    letterSpacing: 0.3,
    fontSize: 16,
  },
  primaryBtnArrow: {
    position: 'absolute',
    right: Spacing.md,
  },
  secondaryBtn: {
    alignItems: 'center',
    paddingVertical: Spacing['2xs'],
  },
  legal: {
    textAlign: 'center',
    lineHeight: 14,
  },
});
