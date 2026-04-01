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

export default function ArtistStep1() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { updateProfile } = useAuthStore();
  const [blaze, setBlaze] = useState('');
  const [city, setCity] = useState('');

  const handleNext = () => {
    if (!blaze.trim()) return;
    updateProfile({ displayName: blaze.trim(), city: city.trim() });
    router.push('/(onboarding)/artist/step2');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + Spacing.md, paddingBottom: insets.bottom + Spacing.lg }]}>
      <OnboardingProgress total={5} current={1} />

      <View style={styles.content}>
        <TText variant="displayL" weight="bold" style={styles.title}>
          Qui es-tu ?
        </TText>
        <TText variant="body" color="secondary" style={styles.subtitle}>
          Ton blaze ou ton nom réel — c'est ce que tes clients verront.
        </TText>

        <TInput
          label="Nom artistique / Blaze"
          value={blaze}
          onChangeText={setBlaze}
          placeholder="Marco Ink, Lucie B., ..."
          autoFocus
          returnKeyType="next"
          containerStyle={styles.inputGap}
        />
        <TInput
          label="Ville principale"
          value={city}
          onChangeText={setCity}
          placeholder="Paris, Lyon, Bordeaux..."
          returnKeyType="done"
          onSubmitEditing={handleNext}
        />
      </View>

      <TButton
        title="Continuer"
        onPress={handleNext}
        disabled={!blaze.trim()}
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
  title: { marginBottom: Spacing['2xs'] },
  subtitle: { marginBottom: Spacing.xl, lineHeight: 24 },
  inputGap: { marginBottom: Spacing.md },
});
