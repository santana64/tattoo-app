import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, TextInput, TouchableOpacity, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Radius, FontSize, GlowShadow } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { Logo } from '@/components/ui/Logo';
import { useAuthStore } from '@/store/auth-store';

const { height: H } = Dimensions.get('window');
const TOTAL_STEPS = 5;
const CURRENT_STEP = 1;

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <View style={sdStyles.wrap}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            sdStyles.dot,
            i === current - 1 ? sdStyles.dotActive : i < current ? sdStyles.dotDone : sdStyles.dotInactive,
          ]}
        />
      ))}
    </View>
  );
}
const sdStyles = StyleSheet.create({
  wrap: { flexDirection: 'row', gap: 5 },
  dot: { height: 4, borderRadius: 2 },
  dotActive: { width: 22, backgroundColor: Colors.accentWarm },
  dotDone: { width: 12, backgroundColor: Colors.accentWarm, opacity: 0.45 },
  dotInactive: { width: 12, backgroundColor: Colors.borderDefault },
});

export default function ArtistStep1() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { updateProfile } = useAuthStore();

  const [blaze, setBlaze] = useState('');
  const [city, setCity] = useState('');
  const [blazeFocused, setBlazeFocused] = useState(false);
  const [cityFocused, setCityFocused] = useState(false);

  const canContinue = blaze.trim().length >= 2 && city.trim().length >= 2;

  const handleContinue = () => {
    if (!canContinue) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    updateProfile({ displayName: blaze.trim(), city: city.trim() });
    router.push('/(onboarding)/artist/step2');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Aurora orbs */}
      <View style={styles.orb1} pointerEvents="none" />
      <View style={styles.orb2} pointerEvents="none" />
      <LinearGradient
        colors={['rgba(3,3,5,0)', 'rgba(3,3,5,0.5)', Colors.bgPrimary]}
        locations={[0, 0.4, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        <Logo size="sm" variant="full" />
        <StepDots current={CURRENT_STEP} total={TOTAL_STEPS} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Animated.View entering={FadeInDown.delay(200).springify()}>
          <TText variant="displayS" weight="black" style={styles.title}>
            Comment tu{'\n'}t'appelles ?
          </TText>
          <TText variant="body" color="secondary" style={styles.subtitle}>
            Ton blaze sera visible par tous tes clients.
          </TText>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(350).springify()} style={styles.fields}>
          {/* Blaze */}
          <View style={[styles.inputWrap, blazeFocused && styles.inputWrapFocused]}>
            {blazeFocused && (
              <LinearGradient colors={['rgba(212,168,100,0.07)', 'transparent']} style={StyleSheet.absoluteFill} />
            )}
            <TText variant="micro" uppercase style={[styles.inputLabel, { color: blazeFocused ? Colors.accentWarm : Colors.textTertiary }]}>
              Ton blaze / pseudo
            </TText>
            <TextInput
              style={styles.input}
              value={blaze}
              onChangeText={setBlaze}
              placeholder="Ex: InkMaster Paris"
              placeholderTextColor={Colors.textTertiary}
              autoFocus
              returnKeyType="next"
              onFocus={() => setBlazeFocused(true)}
              onBlur={() => setBlazeFocused(false)}
              maxLength={40}
            />
          </View>

          {/* City */}
          <View style={[styles.inputWrap, cityFocused && styles.inputWrapFocused]}>
            {cityFocused && (
              <LinearGradient colors={['rgba(212,168,100,0.07)', 'transparent']} style={StyleSheet.absoluteFill} />
            )}
            <TText variant="micro" uppercase style={[styles.inputLabel, { color: cityFocused ? Colors.accentWarm : Colors.textTertiary }]}>
              Ta ville
            </TText>
            <TextInput
              style={styles.input}
              value={city}
              onChangeText={setCity}
              placeholder="Paris, Lyon, Bordeaux…"
              placeholderTextColor={Colors.textTertiary}
              returnKeyType="done"
              onSubmitEditing={handleContinue}
              onFocus={() => setCityFocused(true)}
              onBlur={() => setCityFocused(false)}
              maxLength={40}
            />
          </View>
        </Animated.View>
      </View>

      {/* Footer */}
      <Animated.View entering={FadeInUp.delay(500).springify()} style={[styles.footer, { paddingBottom: insets.bottom + Spacing.md }]}>
        <TouchableOpacity
          onPress={handleContinue}
          activeOpacity={0.85}
          style={[styles.continueBtn, !canContinue && { opacity: 0.45 }]}
          disabled={!canContinue}
        >
          <LinearGradient
            colors={canContinue ? [Colors.accentGlow, Colors.accentWarm, '#A06030'] : [Colors.bgSubtle, Colors.bgSubtle]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <TText variant="body" weight="bold" style={{ color: canContinue ? Colors.bgPrimary : Colors.textTertiary, letterSpacing: 0.3 }}>
            Continuer →
          </TText>
        </TouchableOpacity>
        <TText
          variant="caption" color="tertiary"
          style={{ textAlign: 'center', marginTop: Spacing.xs }}
          onPress={() => router.back()}
        >
          Retour
        </TText>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  orb1: {
    position: 'absolute', width: 300, height: 300, borderRadius: 150,
    backgroundColor: Colors.violet, opacity: 0.055,
    top: -80, right: -100,
  },
  orb2: {
    position: 'absolute', width: 220, height: 220, borderRadius: 110,
    backgroundColor: Colors.accentWarm, opacity: 0.055,
    bottom: H * 0.22, left: -80,
  },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
  },
  content: { flex: 1, paddingHorizontal: Spacing.lg, paddingTop: Spacing['2xl'] },
  title: { letterSpacing: -1.5, lineHeight: 36, marginBottom: Spacing.xs },
  subtitle: { lineHeight: 24 },
  fields: { marginTop: Spacing.xl, gap: Spacing.sm },
  inputWrap: {
    backgroundColor: Colors.bgSurface, borderRadius: Radius.xl,
    borderWidth: 1, borderColor: Colors.borderDefault,
    paddingHorizontal: Spacing.sm, paddingTop: Spacing['2xs'], paddingBottom: Spacing.xs,
    overflow: 'hidden',
  },
  inputWrapFocused: { borderColor: Colors.accentWarm },
  inputLabel: { letterSpacing: 1.5, marginBottom: 2, fontSize: 9 },
  input: {
    color: Colors.textPrimary, fontSize: FontSize.title2,
    fontWeight: '600', paddingBottom: 0, paddingTop: 2,
  },
  footer: { paddingHorizontal: Spacing.lg, gap: Spacing['2xs'] },
  continueBtn: {
    height: 56, borderRadius: Radius.xl,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', ...GlowShadow.amber,
  },
});
