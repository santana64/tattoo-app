import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeInDown,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Radius, GlowShadow } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { Logo } from '@/components/ui/Logo';
import { useAuthStore } from '@/store/auth-store';
import { STYLES } from '@/constants/mock-data';

const TOTAL = 5;
const STEP = 2;

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

function StyleChip({
  item,
  selected,
  onPress,
  index,
}: {
  item: (typeof STYLES)[0];
  selected: boolean;
  onPress: () => void;
  index: number;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View entering={FadeInDown.delay(300 + index * 30).springify()} style={animStyle}>
      <TouchableOpacity
        onPress={() => {
          scale.value = withSpring(0.88, { damping: 8 }, () => {
            scale.value = withSpring(1, { damping: 12 });
          });
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
        activeOpacity={1}
        style={[chipStyles.chip, selected && chipStyles.chipActive]}
      >
        {selected && (
          <LinearGradient
            colors={['rgba(212,168,100,0.18)', 'rgba(212,168,100,0.06)']}
            style={StyleSheet.absoluteFill}
          />
        )}
        <TText style={{ fontSize: 18 }}>{item.emoji}</TText>
        <TText
          variant="caption"
          weight={selected ? 'semibold' : 'regular'}
          style={{ color: selected ? Colors.accentWarm : Colors.textSecondary }}
        >
          {item.name}
        </TText>
        {selected && (
          <View style={chipStyles.chipCheck}>
            <TText style={{ fontSize: 9, color: Colors.bgPrimary }}>✓</TText>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const chipStyles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    overflow: 'hidden',
  },
  chipActive: { borderColor: Colors.accentWarm },
  chipCheck: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.accentWarm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default function ArtistStep2() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { updateProfile } = useAuthStore();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (slug: string) => {
    const s = new Set(selected);
    s.has(slug) ? s.delete(slug) : s.add(slug);
    setSelected(s);
  };

  const canContinue = selected.size >= 1;

  const handleContinue = () => {
    if (!canContinue) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const styleNames = STYLES.filter((s) => selected.has(s.slug)).map((s) => s.name);
    updateProfile({ styles: styleNames } as any);
    router.push('/(onboarding)/artist/step3');
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

      <View style={styles.content}>
        <Animated.View entering={FadeInDown.delay(200).springify()}>
          <TText variant="displayS" weight="black" style={styles.title}>
            Ton univers{'\n'}artistique
          </TText>
          <TText variant="body" color="secondary" style={styles.subtitle}>
            Sélectionne les styles que tu maîtrises.{'\n'}
            {selected.size > 0
              ? `${selected.size} sélectionné${selected.size > 1 ? 's' : ''}`
              : 'Minimum 1 style.'}
          </TText>
        </Animated.View>

        <ScrollView
          style={{ marginTop: Spacing.lg }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.grid}
        >
          {STYLES.map((s, i) => (
            <StyleChip
              key={s.id}
              item={s}
              selected={selected.has(s.slug)}
              onPress={() => toggle(s.slug)}
              index={i}
            />
          ))}
        </ScrollView>
      </View>

      <Animated.View
        entering={FadeInUp.delay(500).springify()}
        style={[styles.footer, { paddingBottom: insets.bottom + Spacing.md }]}
      >
        <TouchableOpacity
          onPress={handleContinue}
          activeOpacity={0.85}
          style={[styles.continueBtn, !canContinue && { opacity: 0.45 }]}
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
          style={{ textAlign: 'center' }}
          onPress={() => router.back()}
        >
          Retour
        </TText>
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
  content: { flex: 1, paddingHorizontal: Spacing.lg, paddingTop: Spacing.xl },
  title: { letterSpacing: -1.5, lineHeight: 36, marginBottom: Spacing.xs },
  subtitle: { lineHeight: 24 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: Spacing.xl,
  },
  footer: { paddingHorizontal: Spacing.lg, gap: Spacing['2xs'] },
  continueBtn: {
    height: 56,
    borderRadius: Radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...GlowShadow.amber,
  },
});
