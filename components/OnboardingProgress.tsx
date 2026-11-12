import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ViewStyle, StyleProp,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming,
} from 'react-native-reanimated';
import { Colors, Spacing, Radius } from '@/constants/theme';
import { EASE_OUT, MotionDuration, enterUp, fadeIn } from '@/components/motion/tokens';
import { PressableScale } from '@/components/motion/PressableScale';
import { EditorialTitle, IconButton, Kicker, StepProgress } from '@/components/v5';
import { StageAside, StageBand, StageTitle, useStage } from '@/components/v5/Stage';
import { TText } from './ui/TText';
import { TButton } from './ui/TButton';
import { Logo } from './ui/Logo';

/** Forms and onboarding columns stay narrow on wide screens. */
export const FORM_MAX_WIDTH = 560;

/** Haptic feedback on native only. Use for commits that are not a TButton press (TButton has its own). */
export function haptic(kind: 'select' | 'success' = 'select') {
  if (Platform.OS === 'web') return;
  if (kind === 'success') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  else void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

const pad2 = (n: number) => String(n).padStart(2, '0');

// ── Progress ──────────────────────────────────────────────────

interface OnboardingProgressProps {
  total: number;
  current: number;
  /** Name of the current step, in small capitals at the right. */
  label?: string;
  style?: StyleProp<ViewStyle>;
}

/** "Étape 02 / 05" above one bar per step; done steps are vermilion. */
export function OnboardingProgress({ total, current, label, style }: OnboardingProgressProps) {
  const safeTotal = Math.max(total, 1);
  const safeCurrent = Math.min(Math.max(current, 1), safeTotal);
  return (
    <StepProgress
      current={safeCurrent}
      total={safeTotal}
      label={label}
      style={style}
    />
  );
}

// ── Screen scaffold ───────────────────────────────────────────

export type OnboardingAudience = 'client' | 'artist';

const INTRO: Record<OnboardingAudience, { kicker: string; title: string; emphasis: string; copy: string }> = {
  client: {
    kicker: 'Client / Inscription',
    title: 'Faisons',
    emphasis: 'connaissance.',
    copy: 'Trois questions pour que les artistes sachent à qui ils répondent, et pour composer votre fil.',
  },
  artist: {
    kicker: 'Artiste / Inscription',
    title: 'Ouvrez',
    emphasis: 'votre atelier.',
    copy: 'Cinq étapes pour présenter votre travail : votre nom, vos styles, votre portrait, vos conditions et votre formule.',
  },
};

interface OnboardingScreenProps {
  /** Which journey: sets the statement of the ink column. */
  audience: OnboardingAudience;
  step: number;
  total: number;
  /** Short name of the step ("Votre ville"), shown beside the counter. */
  label?: string;
  /** Plain part of the serif title. */
  title: string;
  /** The single italic vermilion phrase that closes the title. */
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
  audience,
  step,
  total,
  label,
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
  const { wide, asideWidth } = useStage();
  const intro = INTRO[audience];
  const sidePadding = wide ? Spacing['3xl'] : 20;

  const back = onBack
    ? wide
      ? (
        <TButton
          title="Retour"
          variant="ghost"
          size="md"
          fullWidth={false}
          onPress={onBack}
          accessibilityLabel="Retour à l’étape précédente"
          icon={<Ionicons name="arrow-back" size={15} color={Colors.textSecondary} />}
        />
      )
      : <IconButton icon="arrow-back" label="Retour à l’étape précédente" onPress={onBack} />
    : null;

  const main = (
    <View style={styles.main}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingHorizontal: sidePadding,
            paddingTop: wide ? insets.top + Spacing['3xl'] : Spacing.lg,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.column, wide && styles.columnWide]}>
          <OnboardingProgress total={total} current={step} label={label} style={styles.progress} />
          <EditorialTitle size="section" emphasis={accent}>{title}</EditorialTitle>
          {lede ? <TText variant="body" color="secondary" style={styles.lede}>{lede}</TText> : null}
          <View style={styles.content}>{children}</View>
        </View>
      </ScrollView>

      <View
        style={[
          styles.footer,
          { paddingHorizontal: sidePadding, paddingBottom: Math.max(insets.bottom, Spacing.sm) + Spacing['2xs'] },
        ]}
      >
        <View style={[styles.column, wide && styles.columnWide, styles.footerRow]}>
          {back}
          <View style={[styles.footerActions, wide && styles.footerActionsWide]}>{footer}</View>
        </View>
      </View>
    </View>
  );

  const body = wide ? (
    <View style={styles.split}>
      <StageAside
        width={asideWidth}
        kicker={intro.kicker}
        title={intro.title}
        emphasis={intro.emphasis}
        copy={intro.copy}
        footer={
          <View style={styles.cartel} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <TText variant="displayXL" tabular style={styles.cartelNumber}>{pad2(step)}</TText>
            <Kicker tone="onInkMuted" style={styles.cartelLabel}>{`/ ${pad2(total)}${label ? ` — ${label}` : ''}`}</Kicker>
          </View>
        }
      />
      {main}
    </View>
  ) : (
    <>
      <StageBand meta={intro.kicker} />
      {main}
    </>
  );

  return (
    <View style={styles.container}>
      {keyboard ? (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          {body}
        </KeyboardAvoidingView>
      ) : body}
      {overlay}
    </View>
  );
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

/** Hairline pill; selected = ink fill with paper text. Toggling is a commit: light haptic. */
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
      {selected ? <Ionicons name={selectedIcon} size={13} color={Colors.paper} /> : null}
      <TText
        variant="caption"
        weight="semibold"
        style={[styles.chipLabel, { color: selected ? Colors.paper : Colors.ink }]}
      >
        {label}
      </TText>
    </PressableScale>
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

/** The whole window turns to ink: monogram, serif welcome, a vermilion rule that draws itself. */
function OnboardingFinale({ title, accent, lede }: FinaleCopy) {
  const reduced = useReducedMotion();
  const { wide } = useStage();
  const rule = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) return;
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
      <View style={styles.finaleColumn}>
        <Animated.View entering={enterUp(0, 80)}>
          <Logo size="lg" variant="mark" animate={!reduced} color={Colors.onInk} />
        </Animated.View>
        <Animated.View entering={enterUp(1, 80)} style={styles.finaleTitle}>
          <Kicker tone="flameOnInk" style={styles.finaleKicker}>The human canvas</Kicker>
          <StageTitle size={wide ? 76 : 50} emphasis={accent} onInk breakEmphasis>{title}</StageTitle>
        </Animated.View>
        <Animated.View style={[styles.finaleRule, ruleStyle]} />
        {lede ? (
          <Animated.View entering={enterUp(2, 80)}>
            <TText variant="body" color="onInkMuted" style={styles.finaleLede}>{lede}</TText>
          </Animated.View>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.paper },
  flex: { flex: 1 },
  split: { flex: 1, flexDirection: 'row' },
  main: { flex: 1, minWidth: 0 },

  column: { width: '100%', maxWidth: FORM_MAX_WIDTH, alignSelf: 'center' },
  columnWide: { alignSelf: 'flex-start' },

  scrollContent: { flexGrow: 1, paddingBottom: Spacing.xl },
  progress: { marginBottom: Spacing.xl },
  lede: { maxWidth: 460, marginTop: Spacing.sm },
  content: { marginTop: Spacing.xl },

  footer: {
    paddingTop: Spacing.sm,
    backgroundColor: Colors.paper,
    borderTopWidth: 1,
    borderTopColor: Colors.ink,
  },
  footerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.xs },
  footerActions: { flex: 1, minWidth: 0, gap: Spacing['3xs'] },
  footerActionsWide: { flex: 0, width: 340, marginLeft: 'auto' },

  cartel: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  cartelNumber: { color: Colors.onInk, fontSize: 96, lineHeight: 90, letterSpacing: -3 },
  cartelLabel: { marginBottom: 14, flexShrink: 1 },

  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 15,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.line,
  },
  chipSelected: { backgroundColor: Colors.ink, borderColor: Colors.ink },
  chipLabel: { fontSize: 13, lineHeight: 17 },

  finale: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.inkPanel,
  },
  finaleColumn: { width: '100%', maxWidth: 560 },
  finaleTitle: { marginTop: Spacing.xl },
  finaleKicker: { marginBottom: Spacing.md },
  finaleRule: {
    width: 96,
    height: 2,
    marginVertical: Spacing.lg,
    backgroundColor: Colors.flame,
    transformOrigin: 'left',
  },
  finaleLede: { maxWidth: 380 },
});
