import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { TInput } from '@/components/ui/TInput';
import { TButton } from '@/components/ui/TButton';
import { OnboardingScreen, haptic } from '@/components/OnboardingProgress';
import { useAuthStore } from '@/store/auth-store';

const TOTAL = 3;
const STEP = 1;

export default function ClientStep1() {
  const router = useRouter();
  const { updateProfile } = useAuthStore();
  const [name, setName] = useState('');
  const [touched, setTouched] = useState(false);

  const canContinue = name.trim().length >= 2;
  const nameError = touched && !canContinue
    ? 'Indiquez au moins 2 caractères.'
    : undefined;

  const handleContinue = () => {
    if (!canContinue) return;
    haptic('success');
    updateProfile({ displayName: name.trim() });
    router.push('/(onboarding)/client/step2');
  };

  const submit = () => {
    setTouched(true);
    handleContinue();
  };

  return (
    <OnboardingScreen
      step={STEP}
      total={TOTAL}
      title="Comment vous"
      accent="appelez-vous ?"
      lede="Les artistes verront votre prénom lorsque vous leur enverrez une demande."
      onBack={router.canGoBack() ? () => router.back() : undefined}
      keyboard
      footer={<TButton title="Continuer" onPress={submit} />}
    >
      <TInput
        label="Prénom"
        value={name}
        onChangeText={setName}
        onBlur={() => { if (name.length > 0) setTouched(true); }}
        placeholder="Votre prénom"
        error={nameError}
        autoFocus
        autoComplete="given-name"
        textContentType="givenName"
        autoCapitalize="words"
        autoCorrect={false}
        returnKeyType="done"
        onSubmitEditing={submit}
        maxLength={40}
      />
    </OnboardingScreen>
  );
}
