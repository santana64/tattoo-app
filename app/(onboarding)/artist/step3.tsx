import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Spacing } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { Kicker } from '@/components/v5';
import { TButton } from '@/components/ui/TButton';
import { OnboardingScreen, haptic } from '@/components/OnboardingProgress';
import { PressableScale } from '@/components/motion/PressableScale';
import { RevealImage } from '@/components/motion/RevealImage';
import { useAuthStore } from '@/store/auth-store';
import { uploadAvatar, uploadCover } from '@/lib/storage';
import { Toast } from '@/components/ui/TToast';

const TOTAL = 5;
const STEP = 3;
const AVATAR = 112;

export default function ArtistStep3() {
  const router = useRouter();
  const { updateProfile, saveArtist, session } = useAuthStore();
  const [saving, setSaving] = useState(false);
  const [uploadFailed, setUploadFailed] = useState(false);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [coverUri, setCoverUri] = useState<string | null>(null);

  const pickAvatar = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!res.canceled && res.assets[0]) {
      setAvatarUri(res.assets[0].uri);
      haptic('success');
    }
  };

  const pickCover = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });
    if (!res.canceled && res.assets[0]) {
      setCoverUri(res.assets[0].uri);
      haptic('success');
    }
  };

  const handleContinue = async () => {
    if (saving) return;
    const userId = session?.user.id;
    if (!userId || (!avatarUri && !coverUri)) { router.push('/(onboarding)/artist/step4'); return; }
    setSaving(true);
    try {
      // Unique names: storage policies allow inserts, not overwrites.
      const stamp = Date.now();
      const avatar = avatarUri ? await uploadAvatar(avatarUri, `${userId}/${stamp}`, undefined, false) : null;
      const cover = coverUri ? await uploadCover(coverUri, `${userId}/${stamp}`, undefined, false) : null;
      const { error } = await saveArtist({ avatarUrl: avatar?.url, coverUrl: cover?.url });
      if (error) throw new Error(error);
      if (avatar) await updateProfile({ avatarUrl: avatar.url });
      router.push('/(onboarding)/artist/step4');
    } catch (e) {
      setUploadFailed(true);
      const detail = e instanceof Error ? e.message : String(e);
      console.warn('[onboarding] photo upload failed:', detail, e);
      Toast.error(
        detail.startsWith('Enregistrement') ? detail
          : /row-level security|unauthorized|403/i.test(detail)
            ? 'Le stockage des photos refuse l’envoi : ses règles de sécurité ne sont pas configurées. Passez cette étape pour l’instant.'
            : 'Envoi des photos impossible. Réessayez, ou passez cette étape.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <OnboardingScreen
      audience="artist"
      step={STEP}
      total={TOTAL}
      label="Votre portrait"
      title="Votre"
      accent="portrait"
      lede="Une photo de vous ou de votre poste de travail aide les clients à savoir à qui ils s’adressent."
      onBack={router.canGoBack() ? () => router.back() : undefined}
      footer={
        <>
          <TButton
            title={avatarUri ? 'Continuer' : 'Passer cette étape'}
            variant={avatarUri ? 'primary' : 'secondary'}
            onPress={handleContinue}
            loading={saving}
          />
          {uploadFailed && (
            <TButton
              title="Continuer sans photo"
              variant="ghost"
              onPress={() => router.push('/(onboarding)/artist/step4')}
              disabled={saving}
            />
          )}
        </>
      }
    >
      {/* Profile photo */}
      <Kicker tone="muted" style={styles.kicker}>01 / Photo de profil</Kicker>
      <View style={styles.avatarBlock}>
        <PressableScale
          onPress={pickAvatar}
          accessibilityRole="button"
          accessibilityLabel={avatarUri ? 'Changer la photo de profil' : 'Ajouter une photo de profil'}
          style={styles.avatar}
        >
          {avatarUri ? (
            <RevealImage key={avatarUri} uri={avatarUri} style={StyleSheet.absoluteFill} accessibilityLabel="Votre photo de profil" />
          ) : (
            <Ionicons name="person-outline" size={30} color={Colors.textSecondary} />
          )}
          <View style={styles.avatarBadge}>
            <Ionicons name={avatarUri ? 'pencil' : 'add'} size={avatarUri ? 13 : 16} color={Colors.paper} />
          </View>
        </PressableScale>
        <View style={styles.avatarText}>
          <TText variant="bodySmall" weight="semibold">Photo de profil</TText>
          <TText variant="caption" color="secondary">
            {avatarUri ? 'Touchez la photo pour la changer.' : 'Format carré, visage ou atelier bien éclairé.'}
          </TText>
        </View>
      </View>

      {/* Cover photo */}
      <View style={styles.coverLabel}>
        <Kicker tone="muted">02 / Photo de couverture</Kicker>
        <TText variant="caption" color="tertiary">Optionnel</TText>
      </View>
      <PressableScale
        onPress={pickCover}
        accessibilityRole="button"
        accessibilityLabel={coverUri ? 'Changer la photo de couverture' : 'Ajouter une photo de couverture'}
        style={styles.cover}
      >
        {coverUri ? (
          <>
            <RevealImage key={coverUri} uri={coverUri} style={StyleSheet.absoluteFill} accessibilityLabel="Votre photo de couverture" />
            <View style={styles.coverEdit}>
              <Ionicons name="pencil" size={12} color={Colors.ink} />
              <TText variant="label" weight="bold" uppercase style={styles.coverEditLabel}>Modifier</TText>
            </View>
          </>
        ) : (
          <View style={styles.coverPlaceholder}>
            <View style={styles.iconFrame}>
              <Ionicons name="image-outline" size={18} color={Colors.ink} />
            </View>
            <TText variant="caption" color="secondary">Une pièce récente, au format paysage</TText>
          </View>
        )}
      </PressableScale>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  kicker: { marginBottom: Spacing.sm },
  avatarBlock: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.line,
    backgroundColor: Colors.white,
  },
  avatarBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.ink,
  },
  avatarText: { flex: 1, gap: 4 },

  coverLabel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.xl,
    marginBottom: Spacing.sm,
  },
  cover: {
    width: '100%',
    aspectRatio: 16 / 9,
    overflow: 'hidden',
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.line,
  },
  coverPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: Spacing.sm },
  iconFrame: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.line,
  },
  coverEdit: {
    position: 'absolute',
    right: Spacing['2xs'],
    bottom: Spacing['2xs'],
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 32,
    paddingHorizontal: 12,
    backgroundColor: Colors.paper,
  },
  coverEditLabel: { color: Colors.ink, letterSpacing: 1 },
});
