import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Radius, GlowShadow, FontSize } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { Logo } from '@/components/ui/Logo';
import { useAuthStore } from '@/store/auth-store';

const TOTAL = 3;
const STEP = 1;

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <View style={dots.row}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            dots.dot,
            i === current - 1
              ? dots.active
              : i < current
              ? dots.past
              : dots.future,
          ]}
        />
      ))}
    </View>
  );
}

const dots = StyleSheet.create({
  row: { flexDirection: 'row', gap: 5, alignItems: 'center' },
  dot: { height: 4, borderRadius: 2 },
  active: { width: 22, backgroundColor: Colors.accentWarm },
  past: { width: 12, backgroundColor: Colors.accentWarm, opacity: 0.4 },
  future: { width: 12, backgroundColor: Colors.borderDefault },
});

export default function ClientStep1() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { updateProfile } = useAuthStore();
  const [name, setName] = useState('');
  const [focused, setFocused] = useState(false);

  const canContinue = name.trim().length >= 2;

  const handleContinue = () => {
    if (!canContinue) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    updateProfile({ displayName: name.trim() });
    router.push('/(onboarding)/client/step2');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Ambient orbs */}
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
        <StepDots current={STEP} total={TOTAL} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Animated.View entering={FadeInDown.delay(200).springify()}>
          <TText variant="displayS" weight="black" style={styles.title}>
            Comment{'\n'}tu t'appelles ?
          </TText>
          <TText variant="body" color="secondary" style={styles.subtitle}>
            Les artistes verront ton prénom quand tu envoies une demande.
          </TText>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(350).springify()}
          style={{ marginTop: Spacing.xl }}
        >
          <View style={[styles.inputWrap, focused && styles.inputFocused]}>
            {focused && (
              <LinearGradient
                colors={['rgba(212,168,100,0.07)', 'transparent']}
                style={StyleSheet.absoluteFill}
              />
            )}
            <TText
              variant="micro"
              uppercase
              style={[
                styles.inputLabel,
                { color: focused ? Colors.accentWarm : Colors.textTertiary },
              ]}
            >
              Ton prénom
            </TText>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Ex: Marie, Thomas…"
              placeholderTextColor={Colors.textTertiary}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleContinue}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              maxLength={40}
              autoCorrect={false}
            />
          </View>
        </Animated.View>
      </View>

      {/* Footer */}
      <Animated.View
        entering={FadeInUp.delay(500).springify()}
        style={[styles.footer, { paddingBottom: insets.bottom + Spacing.md }]}
      >
        <TouchableOpacity
          onPress={handleContinue}
          activeOpacity={0.85}
          style={[styles.btn, !canContinue && styles.btnDisabled]}
          disabled={!canContinue}
        >
          <LinearGradient
            colors={
              canContinue
                ? [Colors.accentGlow, Colors.accentWarm, '#A06030']
                : [Colors.bgSubtle, Colors.bgSubtle]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <TText
            variant="body"
            weight="bold"
            style={{ color: canContinue ? Colors.bgPrimary : Colors.textTertiary }}
          >
            Continuer →
          </TText>
        </TouchableOpacity>

        <TText
          variant="caption"
          color="tertiary"
          style={styles.back}
          onPress={() => router.back()}
        >
          Retour
        </TText>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  orb1: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: Colors.violet,
    opacity: 0.055,
    top: -60,
    right: -80,
  },
  orb2: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: Colors.accentWarm,
    opacity: 0.055,
    bottom: '22%',
    left: -60,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing['2xl'],
  },
  title: {
    letterSpacing: -1.5,
    lineHeight: 36,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    lineHeight: 24,
  },
  inputWrap: {
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing['2xs'],
    paddingBottom: Spacing.xs,
    overflow: 'hidden',
  },
  inputFocused: {
    borderColor: Colors.accentWarm,
  },
  inputLabel: {
    letterSpacing: 1.5,
    marginBottom: 2,
    fontSize: 9,
  },
  input: {
    color: Colors.textPrimary,
    fontSize: FontSize.title2,
    fontWeight: '600',
    paddingBottom: 0,
    paddingTop: 2,
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing['2xs'],
  },
  btn: {
    height: 56,
    borderRadius: Radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...GlowShadow.amber,
  },
  btnDisabled: {
    opacity: 0.45,
  },
  back: {
    textAlign: 'center',
    paddingVertical: Spacing['2xs'],
  },
});
