import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Spacing } from '@/constants/theme';
import { Kicker } from '@/components/v5';
import { TInput } from '@/components/ui/TInput';
import { TButton } from '@/components/ui/TButton';
import { TText } from '@/components/ui/TText';
import { OnboardingScreen, OnboardingChip } from '@/components/OnboardingProgress';
import { useAuthStore } from '@/store/auth-store';

const TOTAL = 3;
const STEP = 2;

const CITY_SUGGESTIONS = ['Paris', 'Lyon', 'Bordeaux', 'Marseille', 'Toulouse', 'Nantes', 'Lille'];

export default function ClientStep2() {
  const router = useRouter();
  const { updateProfile } = useAuthStore();
  const [city, setCity] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleContinue = async () => {
    if (saving) return;
    if (!city.trim()) { router.push('/(onboarding)/client/step3'); return; }
    setSaving(true);
    setSaveError(null);
    try {
      const result = await updateProfile({ city: city.trim() });
      if (result.error) { setSaveError(result.error); return; }
      router.push('/(onboarding)/client/step3');
    } catch {
      setSaveError('Enregistrement impossible. Vérifiez votre connexion puis réessayez.');
    } finally {
      setSaving(false);
    }
  };

  const selectCity = (c: string) => {
    setCity(c);
    setSaveError(null);
  };

  const isSelected = (c: string) => c.toLowerCase() === city.trim().toLowerCase();

  return (
    <OnboardingScreen
      audience="client"
      step={STEP}
      total={TOTAL}
      label="Votre ville"
      title="Dans quelle ville"
      accent="êtes-vous ?"
      lede="Nous mettrons en avant les artistes proches de vous. Vous pourrez la modifier plus tard."
      onBack={router.canGoBack() ? () => router.back() : undefined}
      keyboard
      footer={
        <TButton
          title={city.trim() ? 'Continuer' : 'Passer cette étape'}
          variant={city.trim() ? 'primary' : 'secondary'}
          onPress={() => { void handleContinue(); }}
          loading={saving}
          disabled={saving}
        />
      }
    >
      <TInput
        label="Ville"
        optional
        value={city}
        onChangeText={(value) => { setCity(value); setSaveError(null); }}
        placeholder="Paris, Lyon, Bordeaux…"
        autoComplete="postal-address-locality"
        textContentType="addressCity"
        autoCapitalize="words"
        autoCorrect={false}
        returnKeyType="done"
        onSubmitEditing={() => { void handleContinue(); }}
        maxLength={60}
        editable={!saving}
      />
      {!!saveError && <TText variant="bodySmall" color="error" accessibilityRole="alert">{saveError}</TText>}

      <Kicker tone="muted" style={styles.suggestLabel}>Suggestions</Kicker>
      <View style={styles.chips}>
        {CITY_SUGGESTIONS.map((c) => (
          <OnboardingChip
            key={c}
            label={c}
            selected={isSelected(c)}
            onPress={() => selectCity(c)}
            accessibilityLabel={`Choisir ${c}`}
          />
        ))}
      </View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  suggestLabel: { marginTop: Spacing.xs, marginBottom: Spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
