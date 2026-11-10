import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Spacing } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TButton } from '@/components/ui/TButton';
import { OnboardingScreen, OnboardingChip, useOnboardingFinale } from '@/components/OnboardingProgress';
import { useAuthStore } from '@/store/auth-store';
import { STYLES } from '@/constants/tattoo';

const TOTAL = 3;
const STEP = 3;

export default function ClientStep3() {
  const router = useRouter();
  const { updateProfile, completeOnboarding } = useAuthStore();
  const [selected, setSelected] = useState<string[]>([]);
  const finale = useOnboardingFinale();

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

  const handleSkip = () => {
    updateProfile({ stylePreferences: [] });
    completeOnboarding();
    router.replace('/(tabs)');
  };

  const hasSelection = selected.length > 0;
  const count = selected.length;

  // Rare moment: a short welcome before the original finish/skip handlers run.
  const finish = (then: () => void) => finale.celebrate(
    { title: 'Bienvenue', accent: 'sur Inkr.', lede: 'Votre fil est prêt. Bonne exploration.' },
    then,
  );

  return (
    <OnboardingScreen
      step={STEP}
      total={TOTAL}
      title="Quels styles"
      accent="vous attirent ?"
      lede="Votre fil s’adapte à vos choix. Sélectionnez-en autant que vous le souhaitez."
      onBack={router.canGoBack() ? () => router.back() : undefined}
      overlay={finale.overlay}
      footer={
        <>
          <TButton
            title={hasSelection ? 'Terminer' : 'Passer cette étape'}
            variant={hasSelection ? 'primary' : 'secondary'}
            onPress={() => finish(handleFinish)}
            disabled={finale.active}
          />
          {hasSelection ? (
            <TButton
              title="Continuer sans préférence"
              variant="ghost"
              size="md"
              onPress={() => finish(handleSkip)}
              disabled={finale.active}
            />
          ) : null}
        </>
      }
    >
      <View style={styles.grid}>
        {STYLES.map((style) => (
          <OnboardingChip
            key={style.id}
            label={style.name}
            selected={selected.includes(style.slug)}
            onPress={() => toggle(style.slug)}
          />
        ))}
      </View>

      <TText
        variant="caption"
        color={hasSelection ? 'secondary' : 'tertiary'}
        tabular
        style={styles.count}
        accessibilityLiveRegion="polite"
      >
        {hasSelection
          ? `${count} style${count > 1 ? 's' : ''} sélectionné${count > 1 ? 's' : ''}`
          : 'Aucun style sélectionné pour l’instant.'}
      </TText>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  count: { marginTop: Spacing.md },
});
