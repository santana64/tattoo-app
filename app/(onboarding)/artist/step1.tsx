import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { TInput } from '@/components/ui/TInput';
import { TButton } from '@/components/ui/TButton';
import { OnboardingScreen } from '@/components/OnboardingProgress';
import { useAuthStore } from '@/store/auth-store';
import { Toast } from '@/components/ui/TToast';

const TOTAL_STEPS = 5;
const CURRENT_STEP = 1;

export default function ArtistStep1() {
  const router = useRouter();
  const { updateProfile, saveArtist } = useAuthStore();
  const [saving, setSaving] = useState(false);

  const [blaze, setBlaze] = useState('');
  const [city, setCity] = useState('');
  const [blazeTouched, setBlazeTouched] = useState(false);
  const [cityTouched, setCityTouched] = useState(false);

  const blazeValid = blaze.trim().length >= 2;
  const cityValid = city.trim().length >= 2;
  const canContinue = blazeValid && cityValid;

  const handleContinue = async () => {
    if (!canContinue || saving) return;
    setSaving(true);
    const profile = await updateProfile({ displayName: blaze.trim(), city: city.trim() });
    const artist = profile.error ? profile : await saveArtist({ blaze: blaze.trim(), city: city.trim() });
    setSaving(false);
    if (artist.error) { Toast.error(artist.error); return; }
    router.push('/(onboarding)/artist/step2');
  };

  const submit = () => {
    setBlazeTouched(true);
    setCityTouched(true);
    handleContinue();
  };

  return (
    <OnboardingScreen
      audience="artist"
      step={CURRENT_STEP}
      total={TOTAL_STEPS}
      label="Votre identité"
      title="Votre nom"
      accent="d’artiste"
      lede="Il apparaît sur votre profil et dans les recherches des clients."
      onBack={router.canGoBack() ? () => router.back() : undefined}
      keyboard
      footer={<TButton title="Continuer" onPress={submit} loading={saving} />}
    >
      <TInput
        label="Nom d’artiste"
        value={blaze}
        onChangeText={setBlaze}
        onBlur={() => { if (blaze.length > 0) setBlazeTouched(true); }}
        placeholder="Le nom sous lequel vous tatouez"
        error={blazeTouched && !blazeValid ? 'Indiquez au moins 2 caractères.' : undefined}
        autoFocus
        autoCorrect={false}
        returnKeyType="next"
        maxLength={40}
      />
      <TInput
        label="Ville"
        value={city}
        onChangeText={setCity}
        onBlur={() => { if (city.length > 0) setCityTouched(true); }}
        placeholder="Paris, Lyon, Bordeaux…"
        helper="La ville où vous tatouez principalement."
        error={cityTouched && !cityValid ? 'Indiquez votre ville.' : undefined}
        textContentType="addressCity"
        autoCapitalize="words"
        autoCorrect={false}
        returnKeyType="done"
        onSubmitEditing={submit}
        maxLength={40}
      />
    </OnboardingScreen>
  );
}
