import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Pressable, ScrollView, useWindowDimensions, Platform } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withRepeat, withSequence,
  Easing, FadeIn, FadeInDown, useReducedMotion,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Layout, Duration } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TButton } from '@/components/ui/TButton';
import { Logo } from '@/components/ui/Logo';
import { STYLES } from '@/constants/mock-data';

// Remote placeholder until the product hosts rights-cleared artist photography.
const HERO_IMAGE = 'https://images.unsplash.com/photo-1611501275019-9b5cda994e8d?w=1600&q=80';
// Slugs from the shared STYLES taxonomy.
const QUICK_STYLES = STYLES.filter((s) => ['fine-line', 'blackwork', 'realisme', 'japonais', 'old-school', 'neo-trad'].includes(s.slug));
const EASE = Easing.bezier(0.22, 1, 0.36, 1);

function enter(delay: number, reduced: boolean) {
  return reduced ? FadeIn.duration(1) : FadeInDown.delay(delay).duration(Duration.reveal).easing(EASE);
}

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const wide = width >= 900;
  const [photoFailed, setPhotoFailed] = useState(false);

  // Slow gallery-light drift on the hero photograph.
  const drift = useSharedValue(1);
  useEffect(() => {
    if (reduced) return;
    drift.value = withRepeat(
      withSequence(
        withTiming(1.06, { duration: 16000, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 16000, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [drift, reduced]);
  const driftStyle = useAnimatedStyle(() => ({ transform: [{ scale: drift.value }] }));

  const explore = (style?: string) =>
    router.push(style ? { pathname: '/(tabs)/explore', params: { style } } : '/(tabs)/explore');

  return (
    <View style={styles.container}>
      {/* Photograph, lit from above */}
      <Animated.View style={[styles.photo, wide && styles.photoWide, driftStyle]}>
        {photoFailed ? (
          // No photograph: a warm spotlight on the wall keeps the composition lit.
          <LinearGradient
            colors={['rgba(201,164,106,0.20)', 'rgba(201,164,106,0.05)', 'rgba(11,10,9,0)']}
            locations={[0, 0.45, 1]}
            start={{ x: 0.7, y: 0 }}
            end={{ x: 0.3, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <Image
            source={{ uri: HERO_IMAGE }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={600}
            onError={() => setPhotoFailed(true)}
            accessibilityLabel="Tatoueur au travail dans un studio"
          />
        )}
      </Animated.View>
      <LinearGradient
        colors={wide
          ? ['rgba(11,10,9,0.96)', 'rgba(11,10,9,0.80)', 'rgba(11,10,9,0.15)']
          : ['rgba(11,10,9,0.35)', 'rgba(11,10,9,0.10)', 'rgba(11,10,9,0.82)', Colors.bgPrimary]}
        locations={wide ? [0, 0.42, 1] : [0, 0.28, 0.62, 0.88]}
        start={wide ? { x: 0, y: 0.5 } : { x: 0.5, y: 0 }}
        end={wide ? { x: 1, y: 0.5 } : { x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { minHeight: height, paddingTop: insets.top + 14, paddingBottom: insets.bottom + Spacing.lg },
        ]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.frame}>
          {/* Masthead */}
          <Animated.View entering={reduced ? undefined : FadeIn.duration(800)} style={styles.topBar}>
            <Logo size="sm" variant="wordmark" />
            <Pressable
              onPress={() => router.push('/(auth)/sign-in')}
              accessibilityRole="link"
              hitSlop={10}
              style={({ pressed }) => [styles.signInLink, pressed && { opacity: 0.6 }]}
            >
              <TText variant="bodySmall" weight="medium">Se connecter</TText>
            </Pressable>
          </Animated.View>

          <View style={styles.spacer} />

          {/* Editorial block */}
          <View style={[styles.copy, wide && styles.copyWide]}>
            <Animated.View entering={enter(120, reduced)} style={styles.kicker}>
              <View style={styles.kickerRule} />
              <TText variant="label" color="accentWarm" uppercase>
                Tatoueurs · Studios · Guest spots
              </TText>
            </Animated.View>

            <Animated.View entering={enter(220, reduced)}>
              <TText variant="displayXL" style={[styles.headline, !wide && styles.headlineMobile]} accessibilityRole="header">
                Trouvez l’artiste{'\n'}
                <TText variant="displayXL" italic color="accentGlow" style={!wide && styles.headlineMobile}>
                  qui vous ressemble.
                </TText>
              </TText>
            </Animated.View>

            <Animated.View entering={enter(340, reduced)}>
              <TText variant="body" color="secondary" style={styles.lede}>
                Parcourez les portfolios par style et par ville, puis confiez votre projet directement
                à l’artiste qui vous parle.
              </TText>
            </Animated.View>

            {/* Quick entry by style */}
            <Animated.View entering={enter(440, reduced)}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.styleRow}
                style={styles.styleScroller}
              >
                {QUICK_STYLES.map((s) => (
                  <Pressable
                    key={s.slug}
                    onPress={() => explore(s.slug)}
                    accessibilityRole="button"
                    accessibilityLabel={`Voir les artistes ${s.name}`}
                    style={(state) => {
                      const { pressed, hovered } = state as { pressed: boolean; hovered?: boolean };
                      return [styles.styleChip, (pressed || hovered) && styles.styleChipActive];
                    }}
                  >
                    <TText variant="caption" weight="medium" style={{ fontSize: 13 }}>{s.name}</TText>
                  </Pressable>
                ))}
              </ScrollView>
            </Animated.View>

            <Animated.View entering={enter(540, reduced)} style={styles.actions}>
              <TButton
                title="Explorer les artistes"
                onPress={() => explore()}
                icon={<Ionicons name="arrow-forward" size={17} color={Colors.textInverse} />}
                iconPosition="right"
                fullWidth={!wide}
              />
              <TButton
                title="Je suis tatoueur·se"
                variant="secondary"
                onPress={() => router.push('/(auth)/sign-in')}
                fullWidth={!wide}
              />
            </Animated.View>

            <Animated.View entering={reduced ? undefined : FadeIn.delay(800).duration(600)} style={styles.legalRow}>
              <TText variant="caption" color="tertiary">En continuant, vous acceptez les </TText>
              <Pressable onPress={() => router.push('/legal/terms')} accessibilityRole="link">
                <TText variant="caption" color="secondary" style={styles.underline}>CGU</TText>
              </Pressable>
              <TText variant="caption" color="tertiary"> et la </TText>
              <Pressable onPress={() => router.push('/legal/privacy-policy')} accessibilityRole="link">
                <TText variant="caption" color="secondary" style={styles.underline}>politique de confidentialité</TText>
              </Pressable>
              <TText variant="caption" color="tertiary">.</TText>
            </Animated.View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary, overflow: 'hidden' },
  photo: { ...StyleSheet.absoluteFillObject, bottom: '30%' },
  photoWide: { left: '38%', bottom: 0 },

  scroll: { flexGrow: 1, paddingHorizontal: Layout.gutter },
  frame: { flex: 1, width: '100%', maxWidth: Layout.maxContent, alignSelf: 'center' },

  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  signInLink: {
    paddingHorizontal: 14,
    height: 36,
    justifyContent: 'center',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.glassBorderBright,
    backgroundColor: 'rgba(11,10,9,0.45)',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } as object : null),
  },

  spacer: { flex: 1, minHeight: 220 },

  copy: { width: '100%' },
  copyWide: { maxWidth: 560, paddingBottom: Spacing['3xl'] },

  kicker: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: Spacing.md },
  kickerRule: { width: 24, height: 1, backgroundColor: Colors.accentWarm },

  headline: { marginBottom: Spacing.md },
  headlineMobile: { fontSize: 46, lineHeight: 48, letterSpacing: -1.2 },
  lede: { maxWidth: 440, marginBottom: Spacing.lg },

  styleScroller: { marginHorizontal: -Layout.gutter, marginBottom: Spacing.lg },
  styleRow: { paddingHorizontal: Layout.gutter, gap: 8 },
  styleChip: {
    height: 36,
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.glassBorderBright,
    backgroundColor: 'rgba(11,10,9,0.5)',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } as object : null),
  },
  styleChipActive: { borderColor: Colors.borderGlow, backgroundColor: Colors.glassAmber },

  actions: { gap: 10, flexDirection: 'row', flexWrap: 'wrap', marginBottom: Spacing.md },

  legalRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  underline: { textDecorationLine: 'underline' },
});
