import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TButton } from '@/components/ui/TButton';
import { TChip } from '@/components/ui/TChip';
import { OnboardingProgress } from '@/components/OnboardingProgress';
import { STYLES } from '@/constants/mock-data';

export default function ArtistStep2() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (slug: string) => {
    setSelected((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + Spacing.md, paddingBottom: insets.bottom + Spacing.lg }]}>
      <OnboardingProgress total={5} current={2} />

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <TText variant="displayL" weight="bold" style={styles.title}>
          Ton univers
        </TText>
        <TText variant="body" color="secondary" style={styles.subtitle}>
          Quels styles pratiques-tu ? Ça aide les clients à te trouver.
        </TText>

        <View style={styles.grid}>
          {STYLES.map((style) => (
            <TChip
              key={style.id}
              label={`${style.emoji}  ${style.name}`}
              selected={selected.includes(style.slug)}
              onPress={() => toggle(style.slug)}
            />
          ))}
        </View>
      </ScrollView>

      <TButton
        title="Continuer"
        onPress={() => router.push('/(onboarding)/artist/step3')}
        disabled={selected.length === 0}
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
  scroll: { flex: 1, paddingTop: Spacing['2xl'] },
  title: { marginBottom: Spacing['2xs'] },
  subtitle: { marginBottom: Spacing.xl, lineHeight: 24 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: Spacing.xl },
  cta: { marginTop: Spacing.md },
});
