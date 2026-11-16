import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { TInput } from '@/components/ui/TInput';
import { TButton } from '@/components/ui/TButton';
import { TText } from '@/components/ui/TText';
import { OnboardingScreen } from '@/components/OnboardingProgress';
import { useAuthStore } from '@/store/auth-store';

const TOTAL = 3;
const STEP = 1;

export default function ClientStep1() {
  const router = useRouter();
  const { updateProfile } = useAuthStore();
  const [name, setName] = useState('');
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const canContinue = name.trim().length >= 2;
  const nameError = touched && !canContinue
    ? 'Indiquez au moins 2 caractères.'
    : undefined;

  const handleContinue = async () => {
    if (!canContinue || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const result = await updateProfile({ displayName: name.trim() });
      if (result.error) { setSaveError(result.error); return; }
      router.push('/(onboarding)/client/step2');
    } catch {
      setSaveError('Enregistrement impossible. Vérifiez votre connexion puis réessayez.');
    } finally {
      setSaving(false);
    }
  };

  const submit = () => {
    setTouched(true);
    void handleContinue();
  };

  return (
    <OnboardingScreen
      audience="client"
      step={STEP}
      total={TOTAL}
      label="Votre prénom"
      title="Comment vous"
      accent="appelez-vous ?"
      lede="Les artistes verront votre prénom lorsque vous leur enverrez une demande."
      onBack={router.canGoBack() ? () => router.back() : undefined}
      keyboard
      footer={<TButton title="Continuer" onPress={submit} loading={saving} disabled={saving} />}
    >
      <TInput
        label="Prénom"
        value={name}
        onChangeText={(value) => { setName(value); setSaveError(null); }}
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
        editable={!saving}
      />
      {!!saveError && <TText variant="bodySmall" color="error" accessibilityRole="alert">{saveError}</TText>}
    </OnboardingScreen>
  );
}
