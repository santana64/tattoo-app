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
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, GlowShadow, FontSize } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { Logo } from '@/components/ui/Logo';
import { useAuthStore } from '@/store/auth-store';

const TOTAL = 3;
const STEP = 2;

const CITY_SUGGESTIONS = ['Paris', 'Lyon', 'Bordeaux', 'Marseille', 'Toulouse', 'Nantes', 'Lille'];

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

export default function ClientStep2() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { updateProfile } = useAuthStore();
  const [city, setCity] = useState('');
  const [focused, setFocused] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const filteredSuggestions = city.length >= 1
    ? CITY_SUGGESTIONS.filter((c) => c.toLowerCase().startsWith(city.toLowerCase()) && c.toLowerCase() !== city.toLowerCase())
    : [];

  const handleContinue = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (city.trim()) {
      updateProfile({ city: city.trim() });
    }
    router.push('/(onboarding)/client/step3');
  };

  const selectCity = (c: string) => {
    setCity(c);
    setShowSuggestions(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
            Tu es{'\n'}où ?
          </TText>
          <TText variant="body" color="secondary" style={styles.subtitle}>
            On t'aide à trouver des artistes près de chez toi. Tu pourras changer ça plus tard.
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
            <View style={styles.inputInner}>
              <Ionicons
                name="location-outline"
                size={18}
                color={focused ? Colors.accentWarm : Colors.textTertiary}
                style={styles.inputIcon}
              />
              <View style={{ flex: 1 }}>
                <TText
                  variant="micro"
                  uppercase
                  style={[
                    styles.inputLabel,
                    { color: focused ? Colors.accentWarm : Colors.textTertiary },
                  ]}
                >
                  Ta ville
                </TText>
                <TextInput
                  style={styles.input}
                  value={city}
                  onChangeText={(t) => {
                    setCity(t);
                    setShowSuggestions(true);
                  }}
                  placeholder="Paris, Lyon, Bordeaux…"
                  placeholderTextColor={Colors.textTertiary}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleContinue}
                  onFocus={() => {
                    setFocused(true);
                    setShowSuggestions(true);
                  }}
                  onBlur={() => {
                    setFocused(false);
                    setTimeout(() => setShowSuggestions(false), 150);
                  }}
                  maxLength={60}
                  autoCorrect={false}
                />
              </View>
            </View>
          </View>

          {/* City suggestions */}
          {showSuggestions && filteredSuggestions.length > 0 && (
            <Animated.View entering={FadeInDown.duration(180)} style={styles.suggestions}>
              {filteredSuggestions.map((c, i) => (
                <TouchableOpacity
                  key={c}
                  style={[
                    styles.suggestionRow,
                    i < filteredSuggestions.length - 1 && styles.suggestionBorder,
                  ]}
                  onPress={() => selectCity(c)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="location" size={13} color={Colors.accentWarm} style={{ marginRight: 8 }} />
                  <TText variant="bodySmall">{c}</TText>
                </TouchableOpacity>
              ))}
            </Animated.View>
          )}
        </Animated.View>

        {/* Optional label */}
        <Animated.View entering={FadeInDown.delay(450).springify()} style={styles.optionalRow}>
          <Ionicons name="information-circle-outline" size={13} color={Colors.textTertiary} />
          <TText variant="caption" color="tertiary" style={{ marginLeft: 5 }}>
            Optionnel — tu peux passer cette étape
          </TText>
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
          style={styles.btn}
        >
          <LinearGradient
            colors={[Colors.accentGlow, Colors.accentWarm, '#A06030']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <TText variant="body" weight="bold" style={{ color: Colors.bgPrimary }}>
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
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: Colors.accentWarm,
    opacity: 0.045,
    top: -80,
    left: -100,
  },
  orb2: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: Colors.violet,
    opacity: 0.05,
    bottom: '30%',
    right: -70,
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
    paddingVertical: Spacing.xs,
    overflow: 'hidden',
  },
  inputFocused: {
    borderColor: Colors.accentWarm,
  },
  inputInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputIcon: {
    marginRight: Spacing['2xs'],
    marginTop: 4,
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
  suggestions: {
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    marginTop: Spacing['2xs'],
    overflow: 'hidden',
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  suggestionBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSubtle,
  },
  optionalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
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
  back: {
    textAlign: 'center',
    paddingVertical: Spacing['2xs'],
  },
});
