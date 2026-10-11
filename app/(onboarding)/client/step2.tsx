import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Spacing } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TInput } from '@/components/ui/TInput';
import { TButton } from '@/components/ui/TButton';
import { OnboardingScreen, OnboardingChip } from '@/components/OnboardingProgress';
import { useAuthStore } from '@/store/auth-store';

const TOTAL = 3;
const STEP = 2;

const CITY_SUGGESTIONS = ['Paris', 'Lyon', 'Bordeaux', 'Marseille', 'Toulouse', 'Nantes', 'Lille'];

export default function ClientStep2() {
  const router = useRouter();
  const { updateProfile } = useAuthStore();
  const [city, setCity] = useState('');

  const handleContinue = () => {
    if (city.trim()) {
      updateProfile({ city: city.trim() });
    }
    router.push('/(onboarding)/client/step3');
  };

  const selectCity = (c: string) => {
    setCity(c);
  };

  const isSelected = (c: string) => c.toLowerCase() === city.trim().toLowerCase();

  return (
    <OnboardingScreen
      step={STEP}
      total={TOTAL}
      title="Dans quelle ville"
      accent="êtes-vous ?"
      lede="Nous mettrons en avant les artistes proches de vous. Vous pourrez la modifier plus tard."
      onBack={router.canGoBack() ? () => router.back() : undefined}
      keyboard
      footer={
        <TButton
          title={city.trim() ? 'Continuer' : 'Passer cette étape'}
          variant={city.trim() ? 'primary' : 'secondary'}
          onPress={handleContinue}
        />
      }
    >
      <TInput
        label="Ville"
        optional
        value={city}
        onChangeText={setCity}
        placeholder="Paris, Lyon, Bordeaux…"
        autoComplete="postal-address-locality"
        textContentType="addressCity"
        autoCapitalize="words"
        autoCorrect={false}
        returnKeyType="done"
        onSubmitEditing={handleContinue}
        maxLength={60}
      />

      <TText variant="label" color="tertiary" uppercase style={styles.suggestLabel}>
        Suggestions
      </TText>
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
  suggestLabel: { marginTop: Spacing['2xs'], marginBottom: Spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
