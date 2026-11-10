import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming,
} from 'react-native-reanimated';
import { Colors, Spacing, Layout } from '@/constants/theme';
import { EASE_OUT, MotionDuration, enterUp, fadeIn } from '@/components/motion/tokens';
import { PressableScale } from '@/components/motion/PressableScale';
import { TText } from './ui/TText';
import { TProgressBar } from './ui/TProgressBar';
import { Logo } from './ui/Logo';

/** Forms and onboarding columns stay narrow and centered on wide screens. */
export const FORM_MAX_WIDTH = 480;

/** Haptic feedback on native only. Use for commits that are not a TButton press (TButton has its own). */
export function haptic(kind: 'select' | 'success' = 'select') {
  if (Platform.OS === 'web') return;
  if (kind === 'success') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  else void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

// ── Progress ──────────────────────────────────────────────────

interface OnboardingProgressProps {
  total: number;
  current: number;
  /** Rendered on the left of the step counter (back button, wordmark…). */
  leading?: React.ReactNode;
  style?: ViewStyle;
}

/** "Étape 2 sur 5" in tabular figures above a thin gold line that fills from the previous step. */
export function OnboardingProgress({ total, current, leading, style }: OnboardingProgressProps) {
  const safeTotal = Math.max(total, 1);
  const safeCurrent = Math.min(Math.max(current, 1), safeTotal);

  return (
    <View style={style}>
      <View style={styles.progressRow}>
        {leading ?? <View />}
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={`Étape ${safeCurrent} sur ${safeTotal}`}
          accessibilityValue={{ min: 1, max: safeTotal, now: safeCurrent }}
        >
          <TText variant="caption" color="tertiary" tabular>
            Étape{' '}
            <TText variant="caption" weight="medium" color="primary" tabular>{safeCurrent}</TText>
            {' '}sur {safeTotal}
          </TText>
        </View>
      </View>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <TProgressBar
          progress={safeCurrent / safeTotal}
          from={(safeCurrent - 1) / safeTotal}
          height={2}
          style={styles.progressLine}
        />
      </View>
    </View>
  );
}

// ── Screen scaffold ───────────────────────────────────────────

interface OnboardingScreenProps {
  step: number;
  total: number;
  /** Plain part of the serif title. */
  title: string;
  /** The single italic gold phrase that closes the title. */
  accent: string;
  lede?: string;
  /** Shown only when provided (e.g. when there is history to go back to). */
  onBack?: () => void;
  /** Wrap in a KeyboardAvoidingView for screens with text fields. */
  keyboard?: boolean;
  /** Pinned actions: one primary, at most one quiet secondary. */
  footer: React.ReactNode;
  /** Full-screen layer above everything (e.g. the finale). */
  overlay?: React.ReactNode;
  children?: React.ReactNode;
}

export function OnboardingScreen({
  step,
  total,
  title,
  accent,
  lede,
  onBack,
  keyboard = false,
  footer,
  overlay,
  children,
}: OnboardingScreenProps) {
  const insets = useSafeAreaInsets();

  const leading = onBack ? (
    <PressableScale
      onPress={onBack}
      pressedScale={0.92}
      accessibilityRole="button"
      accessibilityLabel="Retour à l’étape précédente"
      hitSlop={8}
      style={styles.backButton}
    >
      <Ionicons name="chevron-back" size={20} color={Colors.textPrimary} />
    </PressableScale>
  ) : (
    <Logo size="sm" variant="wordmark" />
  );

  const body = (
    <>
      <View style={[styles.header, { paddingTop: insets.top + Spacing['2xs'] }]}>
        <OnboardingProgress total={total} current={step} leading={leading} style={styles.column} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.column}>
          {/* Step change: title, lede and content rise in a short stagger. */}
          <Animated.View entering={enterUp(0, 60)}>
            <TText variant="displayM" accessibilityRole="header" style={styles.title}>
              {title}{' '}
              <TText variant="displayM" italic color="accentGlow">{accent}</TText>
            </TText>
          </Animated.View>
          {lede ? (
            <Animated.View entering={enterUp(1, 60)}>
              <TText variant="body" color="secondary" style={styles.lede}>{lede}</TText>
            </Animated.View>
          ) : null}

          <Animated.View entering={enterUp(2, 60)} style={styles.content}>
            {children}
          </Animated.View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, Spacing.sm) + Spacing['2xs'] }]}>
        <View style={[styles.column, styles.footerInner]}>{footer}</View>
      </View>

      {overlay}
    </>
  );

  if (keyboard) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {body}
      </KeyboardAvoidingView>
    );
  }
  return <View style={styles.container}>{body}</View>;
}

// ── Selectable chip ───────────────────────────────────────────

interface OnboardingChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** Icon shown inside a selected chip. */
  selectedIcon?: keyof typeof Ionicons.glyphMap;
  accessibilityLabel?: string;
}

/** 36px hairline chip; selected = paper fill with ink text. Toggling is a commit: light haptic. */
export function OnboardingChip({
  label,
  selected,
  onPress,
  selectedIcon = 'checkmark',
  accessibilityLabel,
}: OnboardingChipProps) {
  return (
    <PressableScale
      onPress={onPress}
      haptic
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={accessibilityLabel ?? label}
      hitSlop={{ top: 4, bottom: 4 }}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      {selected ? <Ionicons name={selectedIcon} size={14} color={Colors.textInverse} /> : null}
      <TText
        variant="caption"
        weight="medium"
        style={[styles.chipLabel, { color: selected ? Colors.textInverse : Colors.textSecondary }]}
      >
        {label}
      </TText>
    </PressableScale>
  );
}

// ── Radio mark ────────────────────────────────────────────────

/** Hairline ring; the paper dot fades and settles in over ~180ms when selected. */
export function RadioMark({ selected }: { selected: boolean }) {
  const reduced = useReducedMotion();
  const on = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    on.set(withTiming(selected ? 1 : 0, { duration: MotionDuration.state, easing: EASE_OUT }));
  }, [on, selected]);

  const dotStyle = useAnimatedStyle(() => ({
    opacity: on.get(),
    transform: [{ scale: reduced ? 1 : 0.6 + on.get() * 0.4 }],
  }));

  return (
    <View style={[styles.radio, selected && styles.radioOn]}>
      <Animated.View style={[styles.radioDot, dotStyle]} />
    </View>
  );
}

// ── Finale (rare: end of onboarding) ──────────────────────────

interface FinaleCopy {
  title: string;
  accent: string;
  lede?: string;
}

const FINALE_HOLD = 1300;
const FINALE_HOLD_REDUCED = 700;

/**
 * A calm "your space is ready" moment shown once, before leaving onboarding.
 * Runs `then` after a short hold; the caller keeps its own navigation.
 */
export function useOnboardingFinale() {
  const reduced = useReducedMotion();
  const [copy, setCopy] = useState<FinaleCopy | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const celebrate = useCallback((next: FinaleCopy, then: () => void) => {
    if (timer.current) return;
    setCopy(next);
    timer.current = setTimeout(() => {
      timer.current = null;
      then();
    }, reduced ? FINALE_HOLD_REDUCED : FINALE_HOLD);
  }, [reduced]);

  return {
    celebrate,
    active: copy !== null,
    overlay: copy ? <OnboardingFinale {...copy} /> : null,
  };
}

function OnboardingFinale({ title, accent, lede }: FinaleCopy) {
  const reduced = useReducedMotion();
  const rule = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) return;
    // A thin gold rule draws itself under the title: transform only.
    rule.set(withDelay(360, withTiming(1, { duration: MotionDuration.reveal, easing: EASE_OUT })));
  }, [reduced, rule]);

  const ruleStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: rule.get() }] }));

  return (
    <Animated.View
      entering={fadeIn()}
      style={styles.finale}
      accessibilityViewIsModal
      accessibilityLiveRegion="polite"
    >
      <Animated.View entering={enterUp(0, 80)}>
        <Logo size="xl" variant="mark" animate={!reduced} />
      </Animated.View>
      <Animated.View entering={enterUp(1, 80)}>
        <TText variant="displayM" accessibilityRole="header" style={styles.finaleTitle}>
          {title}{' '}
          <TText variant="displayM" italic color="accentGlow">{accent}</TText>
        </TText>
      </Animated.View>
      <Animated.View style={[styles.finaleRule, ruleStyle]} />
      {lede ? (
        <Animated.View entering={enterUp(2, 80)}>
          <TText variant="body" color="secondary" style={styles.finaleLede}>{lede}</TText>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },

  column: { width: '100%', maxWidth: FORM_MAX_WIDTH, alignSelf: 'center' },

  header: { paddingHorizontal: Layout.gutter, paddingBottom: Spacing.xs },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 40,
  },
  progressLine: { marginTop: Spacing.xs },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderDefault,
  },

  scroll: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Layout.gutter,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xl,
  },
  title: { marginBottom: Spacing.xs },
  lede: { maxWidth: 420 },
  content: { marginTop: Spacing.xl },

  footer: {
    paddingHorizontal: Layout.gutter,
    paddingTop: Spacing.sm,
    backgroundColor: Colors.bgPrimary,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderSubtle,
  },
  footerInner: { gap: Spacing['3xs'] },

  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
  },
  chipSelected: { backgroundColor: Colors.accentAction, borderColor: Colors.accentAction },
  chipLabel: { fontSize: 13 },

  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.borderGlass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: Colors.accentAction },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.accentAction },

  finale: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    backgroundColor: Colors.bgPrimary,
  },
  finaleTitle: { textAlign: 'center', marginTop: Spacing.lg },
  finaleRule: {
    width: 64,
    height: 1,
    marginVertical: Spacing.md,
    backgroundColor: Colors.accentWarm,
  },
  finaleLede: { textAlign: 'center', maxWidth: 340 },
});
