import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Radius, GlowShadow, FontSize } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { Logo } from '@/components/ui/Logo';
import { useAuthStore } from '@/store/auth-store';
import { STYLES } from '@/constants/mock-data';

const TOTAL = 3;
const STEP = 3;

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

function StyleChip({
  emoji,
  name,
  selected,
  onPress,
}: {
  emoji: string;
  name: string;
  selected: boolean;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    scale.value = withSpring(0.93, { damping: 10, stiffness: 400 }, () => {
      scale.value = withSpring(1, { damping: 12, stiffness: 350 });
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <Pressable onPress={handlePress}>
      <Animated.View style={[styles.chip, selected && styles.chipSelected, animStyle]}>
        {selected && (
          <LinearGradient
            colors={['rgba(212,168,100,0.18)', 'rgba(212,168,100,0.06)']}
            style={StyleSheet.absoluteFill}
          />
        )}
        <TText
          variant="caption"
          style={[styles.chipEmoji, selected && { color: Colors.accentWarm }]}
        >
          {emoji}
        </TText>
        <TText
          variant="bodySmall"
          weight={selected ? 'semibold' : 'regular'}
          style={[styles.chipLabel, selected && { color: Colors.accentWarm }]}
        >
          {name}
        </TText>
        {selected && (
          <View style={styles.chipCheck}>
            <TText style={{ fontSize: 9, color: Colors.bgPrimary }}>✓</TText>
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

export default function ClientStep3() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { updateProfile, completeOnboarding } = useAuthStore();
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (slug: string) => {
    setSelected((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  };

  const handleFinish = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    updateProfile({ stylePreferences: selected });
    completeOnboarding();
    router.replace('/(tabs)');
  };

  const hasSelection = selected.length > 0;

  return (
    <View style={styles.container}>
      {/* Ambient orbs */}
      <View style={styles.orb1} pointerEvents="none" />
      <View style={styles.orb2} pointerEvents="none" />
      <LinearGradient
        colors={['rgba(3,3,5,0)', 'rgba(3,3,5,0.45)', Colors.bgPrimary]}
        locations={[0, 0.35, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        <Logo size="sm" variant="full" />
        <StepDots current={STEP} total={TOTAL} />
      </View>

      {/* Scrollable content */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View entering={FadeInDown.delay(200).springify()}>
          <TText variant="displayS" weight="black" style={styles.title}>
            Quels styles{'\n'}t'attirent ?
          </TText>
          <TText variant="body" color="secondary" style={styles.subtitle}>
            Ces préférences personnalisent ton feed. Choisis autant que tu veux.
          </TText>
        </Animated.View>

        {/* Style grid */}
        <Animated.View
          entering={FadeInDown.delay(350).springify()}
          style={styles.grid}
        >
          {STYLES.map((style) => (
            <StyleChip
              key={style.id}
              emoji={style.emoji}
              name={style.name}
              selected={selected.includes(style.slug)}
              onPress={() => toggle(style.slug)}
            />
          ))}
        </Animated.View>

        {/* Selection count pill */}
        {hasSelection && (
          <Animated.View entering={FadeInDown.duration(250)} style={styles.countPill}>
            <LinearGradient
              colors={['rgba(212,168,100,0.15)', 'rgba(212,168,100,0.05)']}
              style={StyleSheet.absoluteFill}
            />
            <TText variant="caption" style={{ color: Colors.accentWarm }}>
              {selected.length} style{selected.length > 1 ? 's' : ''} sélectionné{selected.length > 1 ? 's' : ''}
            </TText>
          </Animated.View>
        )}

        {/* Motivating message */}
        <Animated.View
          entering={FadeInDown.delay(500).springify()}
          style={styles.motivBox}
        >
          <TText variant="caption" color="tertiary" style={styles.motivText}>
            Tu vas trouver l'artiste parfait 🎨
          </TText>
        </Animated.View>
      </ScrollView>

      {/* Footer */}
      <Animated.View
        entering={FadeInUp.delay(600).springify()}
        style={[styles.footer, { paddingBottom: insets.bottom + Spacing.md }]}
      >
        <TouchableOpacity
          onPress={handleFinish}
          activeOpacity={0.85}
          style={styles.btn}
        >
          <LinearGradient
            colors={
              hasSelection
                ? [Colors.accentGlow, Colors.accentWarm, '#A06030']
                : [Colors.bgSubtle, Colors.bgElevated]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <TText
            variant="body"
            weight="bold"
            style={{
              color: hasSelection ? Colors.bgPrimary : Colors.textSecondary,
            }}
          >
            {hasSelection ? 'Terminer ✦' : 'Passer'}
          </TText>
        </TouchableOpacity>

        {hasSelection && (
          <Animated.View entering={FadeInDown.duration(200)}>
            <TText
              variant="caption"
              color="tertiary"
              style={styles.skip}
              onPress={() => {
                updateProfile({ stylePreferences: [] });
                completeOnboarding();
                router.replace('/(tabs)');
              }}
            >
              Passer sans sélectionner
            </TText>
          </Animated.View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  orb1: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: Colors.violet,
    opacity: 0.04,
    top: -100,
    right: -120,
  },
  orb2: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: Colors.accentWarm,
    opacity: 0.05,
    bottom: '15%',
    left: -80,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing['2xs'],
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing['2xl'],
  },
  title: {
    letterSpacing: -1.5,
    lineHeight: 36,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    lineHeight: 24,
    marginBottom: Spacing.xl,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing['2xs'],
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 10,
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    gap: 6,
    overflow: 'hidden',
  },
  chipSelected: {
    borderColor: Colors.accentWarm,
  },
  chipEmoji: {
    fontSize: FontSize.bodySmall,
  },
  chipLabel: {
    fontSize: FontSize.bodySmall,
    color: Colors.textSecondary,
  },
  chipCheck: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.accentWarm,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },
  countPill: {
    alignSelf: 'flex-start',
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.borderGlow,
    overflow: 'hidden',
  },
  motivBox: {
    marginTop: Spacing.xl,
    alignItems: 'center',
  },
  motivText: {
    textAlign: 'center',
    letterSpacing: 0.5,
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
  skip: {
    textAlign: 'center',
    paddingVertical: Spacing['2xs'],
  },
});
