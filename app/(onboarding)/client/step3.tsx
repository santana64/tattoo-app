import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TButton } from '@/components/ui/TButton';
import { TChip } from '@/components/ui/TChip';
import { OnboardingProgress } from '@/components/OnboardingProgress';
import { useAuthStore } from '@/store/auth-store';
import { STYLES } from '@/constants/mock-data';

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
    updateProfile({ stylePreferences: selected });
    completeOnboarding();
    router.replace('/(tabs)');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + Spacing.md, paddingBottom: insets.bottom + Spacing.lg }]}>
      <OnboardingProgress total={3} current={3} />

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <TText variant="displayL" weight="bold" style={styles.title}>
          Quels styles t'attirent ?
        </TText>
        <TText variant="body" color="secondary" style={styles.subtitle}>
          Ces préférences personnalisent ton feed. Tu peux en choisir plusieurs.
        </TText>

        <View style={styles.grid}>
          {STYLES.map((style) => (
            <TChip
              key={style.id}
              label={`${style.emoji}  ${style.name}`}
              selected={selected.includes(style.slug)}
              onPress={() => toggle(style.slug)}
              style={styles.chip}
            />
          ))}
        </View>
      </ScrollView>

      <TButton
        title={selected.length > 0 ? 'Terminer' : 'Passer'}
        onPress={handleFinish}
        style={styles.cta}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
    paddingHorizontal: Spacing.lg,
  },
  scroll: {
    flex: 1,
    paddingTop: Spacing['2xl'],
  },
  title: {
    marginBottom: Spacing['2xs'],
  },
  subtitle: {
    marginBottom: Spacing.xl,
    lineHeight: 24,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: Spacing.xl,
  },
  chip: {
    marginRight: 0,
    marginBottom: 0,
  },
  cta: {
    marginTop: Spacing.md,
  },
});
