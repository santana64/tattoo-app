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

export default function ClientStep1() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { updateProfile } = useAuthStore();
  const [firstName, setFirstName] = useState('');

  const handleNext = () => {
    if (!firstName.trim()) return;
    updateProfile({ displayName: firstName.trim() });
    router.push('/(onboarding)/client/step2');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + Spacing.md, paddingBottom: insets.bottom + Spacing.lg }]}>
      <OnboardingProgress total={3} current={1} />

      <View style={styles.content}>
        <TText variant="displayL" weight="bold" style={styles.title}>
          Comment tu t'appelles ?
        </TText>
        <TText variant="body" color="secondary" style={styles.subtitle}>
          C'est ce que les tatoueurs verront quand tu envoies une demande.
        </TText>

        <TInput
          label="Prénom"
          value={firstName}
          onChangeText={setFirstName}
          placeholder="Ton prénom"
          autoFocus
          returnKeyType="next"
          onSubmitEditing={handleNext}
          containerStyle={styles.input}
        />
      </View>

      <TButton
        title="Continuer"
        onPress={handleNext}
        disabled={!firstName.trim()}
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
