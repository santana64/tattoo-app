import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TButton } from '@/components/ui/TButton';
import { TInput } from '@/components/ui/TInput';
import { OnboardingProgress } from '@/components/OnboardingProgress';
import { useAuthStore } from '@/store/auth-store';

export default function ClientStep2() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { updateProfile } = useAuthStore();
  const [city, setCity] = useState('');

  const handleNext = () => {
    if (city.trim()) {
      updateProfile({ city: city.trim() });
    }
    router.push('/(onboarding)/client/step3');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + Spacing.md, paddingBottom: insets.bottom + Spacing.lg }]}>
      <OnboardingProgress total={3} current={2} />

      <View style={styles.content}>
        <TText variant="displayL" weight="bold" style={styles.title}>
          Où es-tu ?
        </TText>
        <TText variant="body" color="secondary" style={styles.subtitle}>
          On t'aide à trouver des tatoueurs près de chez toi. Tu pourras changer ça plus tard.
        </TText>

        <TInput
          label="Ville"
          value={city}
          onChangeText={setCity}
          placeholder="Paris, Lyon, Bordeaux..."
          autoFocus
          optional
          returnKeyType="done"
          onSubmitEditing={handleNext}
          containerStyle={styles.input}
        />
      </View>

      <TButton
        title="Continuer"
        onPress={handleNext}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
    paddingHorizontal: Spacing.lg,
    justifyContent: 'space-between',
  },
  content: {
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
  input: {
    marginTop: Spacing.md,
  },
});
