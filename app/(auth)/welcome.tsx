import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  withRepeat,
  withSequence,
  Easing,
  FadeIn,
  FadeInUp,
} from 'react-native-reanimated';
import { Colors, Spacing } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TButton } from '@/components/ui/TButton';

const { width, height } = Dimensions.get('window');

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Ken Burns effect on background
  const bgScale = useSharedValue(1);
  useEffect(() => {
    bgScale.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 8000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 8000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, []);

  const bgStyle = useAnimatedStyle(() => ({
    transform: [{ scale: bgScale.value }],
  }));

  return (
    <View style={styles.container}>
      {/* Ken Burns background */}
      <Animated.View style={[StyleSheet.absoluteFill, bgStyle]}>
        <Image
          source={{ uri: 'https://images.unsplash.com/photo-1568515387631-8b650bbcdb90?w=1200' }}
          style={styles.bg}
          contentFit="cover"
          transition={500}
        />
      </Animated.View>

      {/* Gradient overlay */}
      <LinearGradient
        colors={['rgba(10,10,10,0.1)', 'rgba(10,10,10,0.55)', Colors.bgPrimary]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.content, { paddingBottom: insets.bottom + Spacing.xl }]}>
        {/* Logo with entrance animation */}
        <Animated.View entering={FadeIn.delay(200).duration(700)} style={styles.logoSection}>
          <TText variant="displayXL" weight="bold" style={styles.logo}>
            TATTOO
          </TText>
          <TText variant="body" color="secondary" style={styles.tagline}>
            L'outil des tatoueurs sérieux.
          </TText>
        </Animated.View>

        {/* Actions with staggered entrance */}
        <Animated.View entering={FadeInUp.delay(500).duration(600).springify()} style={styles.actions}>
          <TButton
            title="Commencer"
            onPress={() => router.push('/(auth)/sign-in')}
            variant="primary"
          />
          <Animated.View entering={FadeIn.delay(700).duration(500)}>
            <TouchableOpacity
              onPress={() => router.push('/(auth)/sign-in')}
              style={styles.signInLink}
            >
              <TText variant="bodySmall" color="secondary">
                Déjà un compte ?{' '}
                <TText variant="bodySmall" color="accent">
                  Se connecter
                </TText>
              </TText>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary, overflow: 'hidden' },
  bg: { width, height: height + 40, top: -20 },
  content: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.lg,
  },
  logoSection: { marginBottom: Spacing['2xl'] },
  logo: { letterSpacing: 8, marginBottom: Spacing['2xs'] },
  tagline: { letterSpacing: 0.5 },
  actions: { gap: Spacing.sm },
  signInLink: { alignItems: 'center', paddingVertical: Spacing['2xs'] },
});
