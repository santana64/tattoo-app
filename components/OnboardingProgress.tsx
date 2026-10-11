import React from 'react';
import {
  View, StyleSheet, KeyboardAvoidingView, Platform, Pressable, ScrollView, ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { Easing, FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { Colors, Spacing, Layout, Duration } from '@/constants/theme';
import { TText } from './ui/TText';
import { TProgressBar } from './ui/TProgressBar';
import { Logo } from './ui/Logo';

/** Forms and onboarding columns stay narrow and centered on wide screens. */
export const FORM_MAX_WIDTH = 480;

const EASE = Easing.bezier(0.22, 1, 0.36, 1);

/** Gallery entrance: short fade-up, disabled when the OS asks for reduced motion. */
export function enterFrom(delay: number, reduced: boolean) {
  return reduced ? undefined : FadeInDown.delay(delay).duration(Duration.reveal).easing(EASE);
}

/** Haptic feedback on native only. */
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

/** "Étape 2 sur 5" in tabular figures above a thin gold line. */
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
  children,
}: OnboardingScreenProps) {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();

  const leading = onBack ? (
    <Pressable
      onPress={onBack}
      accessibilityRole="button"
      accessibilityLabel="Retour à l’étape précédente"
      hitSlop={8}
      style={(state) => {
        const { pressed, hovered } = state as { pressed: boolean; hovered?: boolean };
        return [styles.backButton, (pressed || hovered) && styles.backButtonActive];
      }}
    >
      <Ionicons name="chevron-back" size={20} color={Colors.textPrimary} />
    </Pressable>
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
          <Animated.View entering={enterFrom(60, reduced)}>
            <TText variant="displayM" accessibilityRole="header" style={styles.title}>
              {title}{' '}
              <TText variant="displayM" italic color="accentGlow">{accent}</TText>
            </TText>
            {lede ? (
              <TText variant="body" color="secondary" style={styles.lede}>{lede}</TText>
            ) : null}
          </Animated.View>

          <Animated.View entering={enterFrom(160, reduced)} style={styles.content}>
            {children}
          </Animated.View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, Spacing.sm) + Spacing['2xs'] }]}>
        <View style={[styles.column, styles.footerInner]}>{footer}</View>
      </View>
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

/** 36px hairline chip; selected = paper fill with ink text. */
export function OnboardingChip({
  label,
  selected,
  onPress,
  selectedIcon = 'checkmark',
  accessibilityLabel,
}: OnboardingChipProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={accessibilityLabel ?? label}
      hitSlop={{ top: 4, bottom: 4 }}
      style={(state) => {
        const { pressed, hovered } = state as { pressed: boolean; hovered?: boolean };
        return [
          styles.chip,
          (pressed || hovered) && !selected && styles.chipHover,
          selected && styles.chipSelected,
          pressed && styles.chipPressed,
        ];
      }}
    >
      {selected ? <Ionicons name={selectedIcon} size={14} color={Colors.textInverse} /> : null}
      <TText
        variant="caption"
        weight="medium"
        style={[styles.chipLabel, { color: selected ? Colors.textInverse : Colors.textSecondary }]}
      >
        {label}
      </TText>
    </Pressable>
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
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } as object : null),
  },
  backButtonActive: { backgroundColor: Colors.glassBgMid },

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
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } as object : null),
  },
  chipHover: { backgroundColor: Colors.glassBgMid },
  chipSelected: { backgroundColor: Colors.accentAction, borderColor: Colors.accentAction },
  chipPressed: { opacity: 0.85 },
  chipLabel: { fontSize: 13 },
});
