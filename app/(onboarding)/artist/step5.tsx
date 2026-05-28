import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Radius, GlowShadow } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { Logo } from '@/components/ui/Logo';
import { useAuthStore } from '@/store/auth-store';

const TOTAL = 5;
const STEP = 5;

const FREE_FEATURES = [
  'Profil artiste complet',
  'Galerie jusqu\'à 20 photos',
  'Réception de demandes',
  'Messagerie basique',
];

const PREMIUM_FEATURES = [
  'Galerie illimitée + mise en avant',
  'Analytics avancées + insights',
  'Réservation directe intégrée',
  'Badge "Artiste vérifié"',
  'Support prioritaire 24/7',
  'Personnalisation avancée du profil',
];

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 5 }}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            { height: 4, borderRadius: 2 },
            i === current - 1
              ? { width: 22, backgroundColor: Colors.accentWarm }
              : i < current
              ? { width: 12, backgroundColor: Colors.accentWarm, opacity: 0.4 }
              : { width: 12, backgroundColor: Colors.borderDefault },
          ]}
        />
      ))}
    </View>
  );
}

function FeatureRow({ text, premium }: { text: string; premium?: boolean }) {
  return (
    <View style={featureStyles.row}>
      <View style={[featureStyles.check, premium && featureStyles.checkPremium]}>
        {premium ? (
          <LinearGradient
            colors={[Colors.accentGlow, Colors.accentWarm]}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        <TText
          style={{
            fontSize: 9,
            color: premium ? Colors.bgPrimary : Colors.textSecondary,
            fontWeight: '700',
          }}
        >
          ✓
        </TText>
      </View>
      <TText
        variant="caption"
        style={{ color: premium ? Colors.textPrimary : Colors.textSecondary, flex: 1 }}
      >
        {text}
      </TText>
    </View>
  );
}

const featureStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  check: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.bgSubtle,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginTop: 1,
    flexShrink: 0,
  },
  checkPremium: {
    borderColor: Colors.accentWarm,
  },
});

export default function ArtistStep5() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { completeOnboarding } = useAuthStore();
  const [selected, setSelected] = useState<'free' | 'premium'>('premium');

  const handleFree = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await completeOnboarding();
    router.replace('/(tabs)');
  };

  const handlePremium = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await completeOnboarding();
    router.replace('/settings/subscription');
  };

  return (
    <View style={styles.container}>
      <View style={styles.orb1} pointerEvents="none" />
      <View style={styles.orb2} pointerEvents="none" />
      <LinearGradient
        colors={['rgba(3,3,5,0)', 'rgba(3,3,5,0.5)', Colors.bgPrimary]}
        locations={[0, 0.4, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        <Logo size="sm" variant="full" />
        <StepDots current={STEP} total={TOTAL} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.delay(200).springify()}>
          <TText variant="displayS" weight="black" style={styles.title}>
            Choisis ta{'\n'}formule
          </TText>
          <TText variant="body" color="secondary" style={styles.subtitle}>
            Tu peux changer d'avis à tout moment depuis ton profil.
          </TText>
        </Animated.View>

        {/* FREE card */}
        <Animated.View entering={FadeInDown.delay(320).springify()}>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSelected('free');
            }}
            activeOpacity={0.9}
            style={[styles.planCard, selected === 'free' && styles.planCardFreeSelected]}
          >
            <View style={styles.planHeader}>
              <View style={styles.planTitleRow}>
                <TText variant="title2" weight="bold" style={{ color: Colors.textPrimary }}>
                  Gratuit
                </TText>
                {selected === 'free' && (
                  <View style={styles.selectedDot} />
                )}
              </View>
              <View style={styles.priceRow}>
                <TText
                  variant="displayS"
                  weight="black"
                  style={{ color: Colors.textPrimary, letterSpacing: -1 }}
                >
                  0€
                </TText>
                <TText variant="caption" color="tertiary" style={{ marginBottom: 4 }}>
                  {' '}/ pour toujours
                </TText>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.featureList}>
              {FREE_FEATURES.map((f) => (
                <FeatureRow key={f} text={f} premium={false} />
              ))}
            </View>
          </TouchableOpacity>
        </Animated.View>

        {/* PREMIUM card */}
        <Animated.View entering={FadeInDown.delay(420).springify()} style={{ marginTop: 12 }}>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setSelected('premium');
            }}
            activeOpacity={0.9}
            style={[styles.planCard, styles.planCardPremium, selected === 'premium' && styles.planCardPremiumSelected]}
          >
            {/* Subtle gold shimmer bg */}
            <LinearGradient
              colors={['rgba(212,168,100,0.08)', 'rgba(212,168,100,0.03)', 'rgba(3,3,5,0)']}
              locations={[0, 0.5, 1]}
              style={StyleSheet.absoluteFill}
            />

            {/* RECOMMANDÉ badge */}
            <View style={styles.recommendedBadge}>
              <LinearGradient
                colors={[Colors.accentGlow, Colors.accentWarm]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
              <TText style={{ fontSize: 10, fontWeight: '800', color: Colors.bgPrimary, letterSpacing: 1 }}>
                RECOMMANDÉ
              </TText>
            </View>

            <View style={[styles.planHeader, { marginTop: Spacing.xs }]}>
              <View style={styles.planTitleRow}>
                <TText variant="title2" weight="bold" style={{ color: Colors.textPrimary }}>
                  Premium
                </TText>
                {selected === 'premium' && (
                  <View style={[styles.selectedDot, { backgroundColor: Colors.accentWarm }]} />
                )}
              </View>
              <View style={styles.priceRow}>
                <TText
                  variant="displayS"
                  weight="black"
                  style={{ color: Colors.accentWarm, letterSpacing: -1 }}
                >
                  19€
                </TText>
                <TText variant="caption" color="tertiary" style={{ marginBottom: 4 }}>
                  {' '}/ mois
                </TText>
              </View>
              <TText variant="caption" color="tertiary">
                ou 149€/an · économise 35%
              </TText>
            </View>
            <View style={[styles.divider, { borderColor: Colors.borderGlow }]} />
            <View style={styles.featureList}>
              {PREMIUM_FEATURES.map((f) => (
                <FeatureRow key={f} text={f} premium />
              ))}
            </View>
          </TouchableOpacity>
        </Animated.View>

        <View style={{ height: Spacing['2xl'] }} />
      </ScrollView>

      <Animated.View
        entering={FadeInUp.delay(600).springify()}
        style={[styles.footer, { paddingBottom: insets.bottom + Spacing.md }]}
      >
        {selected === 'premium' ? (
          <TouchableOpacity onPress={handlePremium} activeOpacity={0.85} style={styles.continueBtn}>
            <LinearGradient
              colors={[Colors.accentGlow, Colors.accentWarm, '#A06030']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Ionicons name="star" size={16} color={Colors.bgPrimary} style={{ marginRight: 8 }} />
            <TText variant="body" weight="bold" style={{ color: Colors.bgPrimary }}>
              Passer Premium →
            </TText>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={handleFree} activeOpacity={0.85} style={styles.continueBtn}>
            <LinearGradient
              colors={[Colors.bgSurface, Colors.bgSubtle]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <TText variant="body" weight="bold" style={{ color: Colors.textPrimary }}>
              Commencer gratuitement →
            </TText>
          </TouchableOpacity>
        )}
        {selected === 'premium' && (
          <TText
            variant="caption"
            color="tertiary"
            style={{ textAlign: 'center' }}
            onPress={handleFree}
          >
            Commencer gratuitement
          </TText>
        )}
        {selected === 'free' && (
          <TText
            variant="caption"
            color="tertiary"
            style={{ textAlign: 'center' }}
            onPress={() => router.back()}
          >
            Retour
          </TText>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  orb1: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: Colors.violet,
    opacity: 0.055,
    top: -70,
    right: -90,
  },
  orb2: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: Colors.accentWarm,
    opacity: 0.055,
    bottom: '20%',
    left: -70,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
  },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.xl },
  title: { letterSpacing: -1.5, lineHeight: 36, marginBottom: Spacing.xs },
  subtitle: { lineHeight: 24, marginBottom: Spacing.xl },

  // Plan cards
  planCard: {
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    padding: Spacing.lg,
    overflow: 'hidden',
  },
  planCardFreeSelected: {
    borderColor: Colors.borderGlass,
    backgroundColor: Colors.bgSubtle,
  },
  planCardPremium: {
    borderColor: 'rgba(212,168,100,0.20)',
  },
  planCardPremiumSelected: {
    borderColor: Colors.borderGlow,
    ...GlowShadow.amber,
  },

  // RECOMMANDÉ badge
  recommendedBadge: {
    alignSelf: 'flex-start',
    borderRadius: Radius.xs,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 2,
  },

  planHeader: { marginBottom: Spacing.sm },
  planTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  selectedDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.textSecondary,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },

  divider: {
    height: 1,
    backgroundColor: Colors.borderSubtle,
    borderColor: Colors.borderSubtle,
    marginBottom: Spacing.sm,
  },

  featureList: { gap: 0 },

  // Footer
  footer: { paddingHorizontal: Spacing.lg, gap: Spacing['2xs'] },
  continueBtn: {
    height: 56,
    borderRadius: Radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    ...GlowShadow.amber,
  },
});
