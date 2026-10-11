import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Spacing } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TButton } from '@/components/ui/TButton';
import { OnboardingScreen, OnboardingChip } from '@/components/OnboardingProgress';
import { useAuthStore } from '@/store/auth-store';
import { Toast } from '@/components/ui/TToast';
import { STYLES } from '@/constants/mock-data';

const TOTAL = 5;
const STEP = 2;

export default function ArtistStep2() {
  const router = useRouter();
  const { saveArtist } = useAuthStore();
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [attempted, setAttempted] = useState(false);

  const toggle = (slug: string) => {
    const s = new Set(selected);
    if (s.has(slug)) s.delete(slug);
    else s.add(slug);
    setSelected(s);
  };

  const canContinue = selected.size >= 1;

  const handleContinue = async () => {
    if (!canContinue || saving) return;
    setSaving(true);
    // Store slugs: search filters and style labels resolve against the STYLES taxonomy.
    const { error } = await saveArtist({ styles: STYLES.filter((s) => selected.has(s.slug)).map((s) => s.slug) });
    setSaving(false);
    if (error) { Toast.error(error); return; }
    router.push('/(onboarding)/artist/step3');
  };

  const submit = () => {
    setAttempted(true);
    handleContinue();
  };

  const count = selected.size;
  const showError = attempted && !canContinue;

  return (
    <OnboardingScreen
      step={STEP}
      total={TOTAL}
      title="Les styles que"
      accent="vous maîtrisez"
      lede="Les clients vous trouveront à travers ces styles. Choisissez-en au moins un."
      onBack={router.canGoBack() ? () => router.back() : undefined}
      footer={<TButton title="Continuer" onPress={submit} loading={saving} />}
    >
      <View style={styles.grid}>
        {STYLES.map((s) => (
          <OnboardingChip
            key={s.id}
            label={s.name}
            selected={selected.has(s.slug)}
            onPress={() => toggle(s.slug)}
          />
        ))}
      </View>

      <TText
        variant="caption"
        color={showError ? 'error' : count > 0 ? 'secondary' : 'tertiary'}
        tabular
        style={styles.status}
        accessibilityLiveRegion="polite"
      >
        {showError
          ? 'Sélectionnez au moins un style pour continuer.'
          : count > 0
            ? `${count} style${count > 1 ? 's' : ''} sélectionné${count > 1 ? 's' : ''}`
            : 'Aucun style sélectionné pour l’instant.'}
      </TText>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  status: { marginTop: Spacing.md },
});
