import React, { useState } from 'react';
import { View, StyleSheet, Pressable, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Spacing, Radius } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TButton } from '@/components/ui/TButton';
import { OnboardingScreen, haptic } from '@/components/OnboardingProgress';
import { useAuthStore } from '@/store/auth-store';

const TOTAL = 5;
const STEP = 3;
const AVATAR = 112;

type InteractionState = { pressed: boolean; hovered?: boolean };

export default function ArtistStep3() {
  const router = useRouter();
  const { updateProfile } = useAuthStore();
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [coverUri, setCoverUri] = useState<string | null>(null);

  const pickAvatar = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });
    if (!res.canceled && res.assets[0]) {
      setCoverUri(res.assets[0].uri);
      haptic('success');
    }
  };

  const handleContinue = () => {
    haptic('success');
    if (avatarUri) updateProfile({ avatarUrl: avatarUri } as any);
    router.push('/(onboarding)/artist/step4');
  };

  return (
    <OnboardingScreen
      step={STEP}
      total={TOTAL}
      title="Votre"
      accent="portrait"
      lede="Une photo de vous ou de votre poste de travail aide les clients à savoir à qui ils s’adressent."
      onBack={router.canGoBack() ? () => router.back() : undefined}
      footer={
        <TButton
          title={avatarUri ? 'Continuer' : 'Passer cette étape'}
          variant={avatarUri ? 'primary' : 'secondary'}
          onPress={handleContinue}
        />
      }
    >
      {/* Profile photo */}
      <View style={styles.avatarBlock}>
        <Pressable
          onPress={pickAvatar}
          accessibilityRole="button"
          accessibilityLabel={avatarUri ? 'Changer la photo de profil' : 'Ajouter une photo de profil'}
          style={(state) => {
            const { pressed, hovered } = state as InteractionState;
            return [styles.avatar, !avatarUri && styles.avatarEmpty, (pressed || hovered) && styles.pressed];
          }}
        >
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatarImage} contentFit="cover" />
          ) : (
            <Ionicons name="person-outline" size={30} color={Colors.textTertiary} />
          )}
          <View style={styles.avatarBadge}>
            <Ionicons name={avatarUri ? 'pencil' : 'add'} size={avatarUri ? 13 : 16} color={Colors.textInverse} />
          </View>
        </Pressable>
        <View style={styles.avatarText}>
          <TText variant="bodySmall" weight="medium">Photo de profil</TText>
          <TText variant="caption" color="tertiary">
            {avatarUri ? 'Touchez la photo pour la changer.' : 'Format carré, visage ou atelier bien éclairé.'}
          </TText>
        </View>
      </View>

      {/* Cover photo */}
      <View style={styles.coverLabel}>
        <TText variant="caption" weight="medium" color="secondary">Photo de couverture</TText>
        <TText variant="caption" color="tertiary">Optionnel</TText>
      </View>
      <Pressable
        onPress={pickCover}
        accessibilityRole="button"
        accessibilityLabel={coverUri ? 'Changer la photo de couverture' : 'Ajouter une photo de couverture'}
        style={(state) => {
          const { pressed, hovered } = state as InteractionState;
          return [styles.cover, !coverUri && styles.coverEmpty, (pressed || hovered) && styles.pressed];
        }}
      >
        {coverUri ? (
          <>
            <Image source={{ uri: coverUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
            <View style={styles.coverEdit}>
              <Ionicons name="pencil" size={12} color={Colors.textPrimary} />
              <TText variant="caption" weight="medium">Modifier</TText>
            </View>
          </>
        ) : (
          <View style={styles.coverPlaceholder}>
            <View style={styles.iconRing}>
              <Ionicons name="image-outline" size={18} color={Colors.accentWarm} />
            </View>
            <TText variant="caption" color="tertiary">Une pièce récente, au format paysage</TText>
          </View>
        )}
      </Pressable>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  avatarBlock: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.borderGlow,
    backgroundColor: Colors.bgElevated,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } as object : null),
  },
  avatarEmpty: { borderStyle: 'dashed', borderColor: Colors.borderDefault },
  avatarImage: { width: AVATAR - 2, height: AVATAR - 2, borderRadius: (AVATAR - 2) / 2 },
  avatarBadge: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accentAction,
    borderWidth: 2,
    borderColor: Colors.bgPrimary,
  },
  avatarText: { flex: 1, gap: 4 },

  coverLabel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.xl,
    marginBottom: 8,
  },
  cover: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    backgroundColor: Colors.bgElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderDefault,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } as object : null),
  },
  coverEmpty: { borderWidth: 1, borderStyle: 'dashed' },
  coverPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: Spacing.sm },
  iconRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderGlow,
    backgroundColor: Colors.glassAmber,
  },
  coverEdit: {
    position: 'absolute',
    right: Spacing['2xs'],
    bottom: Spacing['2xs'],
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 15,
    backgroundColor: 'rgba(11,10,9,0.65)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.glassBorderBright,
  },
  pressed: { opacity: 0.85 },
});
