import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Radius, GlowShadow } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { Logo } from '@/components/ui/Logo';
import { useAuthStore } from '@/store/auth-store';

const { width: W } = Dimensions.get('window');
const TOTAL = 5;
const STEP = 3;

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 5 }}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            { height: 4, borderRadius: 2 },
            i === current - 1
              ? { width: 22, backgroundColor: Colors.accentWarm }
              : i < current
              ? { width: 12, backgroundColor: Colors.accentWarm, opacity: 0.4 }
              : { width: 12, backgroundColor: Colors.borderDefault },
          ]}
        />
      ))}
    </View>
  );
}

export default function ArtistStep3() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleContinue = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (avatarUri) updateProfile({ avatarUrl: avatarUri } as any);
    router.push('/(onboarding)/artist/step4');
  };

  return (
    <View style={styles.container}>
      <View style={styles.orb1} pointerEvents="none" />
      <View style={styles.orb2} pointerEvents="none" />
      <LinearGradient
        colors={['rgba(3,3,5,0)', 'rgba(3,3,5,0.5)', Colors.bgPrimary]}
        locations={[0, 0.4, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        <Logo size="sm" variant="full" />
        <StepDots current={STEP} total={TOTAL} />
      </View>

      <View style={styles.content}>
        <Animated.View entering={FadeInDown.delay(200).springify()}>
          <TText variant="displayS" weight="black" style={styles.title}>
            Ta photo{'\n'}de profil
          </TText>
          <TText variant="body" color="secondary" style={styles.subtitle}>
            Une belle photo augmente les demandes de 3×.
          </TText>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(350).springify()} style={styles.pickerSection}>
          {/* Avatar picker */}
          <TouchableOpacity onPress={pickAvatar} activeOpacity={0.85} style={styles.avatarWrapper}>
            {avatarUri ? (
              <>
                {/* Premium ring gradient */}
                <LinearGradient
                  colors={[Colors.accentGlow, Colors.accentWarm, '#B06030']}
                  style={styles.avatarRingGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
                <View style={styles.avatarPreviewRing}>
                  <Image
                    source={{ uri: avatarUri }}
                    style={styles.avatarPreview}
                    contentFit="cover"
                  />
                </View>
                <View style={styles.avatarEditBadge}>
                  <Ionicons name="pencil" size={12} color="#fff" />
                </View>
              </>
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person-outline" size={32} color={Colors.textTertiary} />
                <View style={styles.avatarAddBadge}>
                  <LinearGradient
                    colors={[Colors.accentGlow, Colors.accentWarm]}
                    style={StyleSheet.absoluteFill}
                  />
                  <Ionicons name="add" size={16} color={Colors.bgPrimary} />
                </View>
              </View>
            )}
          </TouchableOpacity>
          <TText variant="caption" color="tertiary" style={{ textAlign: 'center', marginTop: 8 }}>
            {avatarUri ? 'Appuyer pour modifier' : 'Photo de profil'}
          </TText>

          {/* Cover photo picker */}
          <TouchableOpacity
            onPress={pickCover}
            activeOpacity={0.85}
            style={styles.coverPicker}
          >
            {coverUri ? (
              <Image
                source={{ uri: coverUri }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
              />
            ) : (
              <View style={styles.coverPlaceholder}>
                <Ionicons name="image-outline" size={28} color={Colors.textTertiary} />
                <TText variant="caption" color="tertiary" style={{ marginTop: 6 }}>
                  Photo de couverture (optionnel)
                </TText>
              </View>
            )}
            {coverUri && (
              <View style={styles.coverEditOverlay}>
                <Ionicons name="pencil" size={14} color="#fff" />
                <TText variant="micro" style={{ color: '#fff', marginLeft: 4 }}>
                  Modifier
                </TText>
              </View>
            )}
          </TouchableOpacity>
        </Animated.View>
      </View>

      <Animated.View
        entering={FadeInUp.delay(500).springify()}
        style={[styles.footer, { paddingBottom: insets.bottom + Spacing.md }]}
      >
        <TouchableOpacity onPress={handleContinue} activeOpacity={0.85} style={styles.continueBtn}>
          <LinearGradient
            colors={[Colors.accentGlow, Colors.accentWarm, '#A06030']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <TText variant="body" weight="bold" style={{ color: Colors.bgPrimary }}>
            {avatarUri ? 'Continuer →' : 'Passer cette étape →'}
          </TText>
        </TouchableOpacity>
        <TText
          variant="caption"
          color="tertiary"
          style={{ textAlign: 'center' }}
          onPress={() => router.back()}
        >
          Retour
        </TText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  orb1: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: Colors.violet,
    opacity: 0.055,
    top: -70,
    right: -90,
  },
  orb2: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: Colors.accentWarm,
    opacity: 0.055,
    bottom: '20%',
    left: -70,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
  },
  content: { flex: 1, paddingHorizontal: Spacing.lg, paddingTop: Spacing.xl },
  title: { letterSpacing: -1.5, lineHeight: 36, marginBottom: Spacing.xs },
  subtitle: { lineHeight: 24 },
  pickerSection: { alignItems: 'center', marginTop: Spacing.xl, gap: 4 },

  // Avatar
  avatarWrapper: {
    width: 104,
    height: 104,
    borderRadius: 52,
    alignItems: 'center',
    justifyContent: 'center',
    ...GlowShadow.amber,
  },
  avatarRingGradient: {
    position: 'absolute',
    width: 104,
    height: 104,
    borderRadius: 52,
  },
  avatarPreviewRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: Colors.bgPrimary,
  },
  avatarPreview: { width: 96, height: 96 },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.bgSurface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.accentWarm,
    borderStyle: 'dashed',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.accentWarm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.bgPrimary,
  },
  avatarAddBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 26,
    height: 26,
    borderRadius: 13,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.bgPrimary,
  },

  // Cover
  coverPicker: {
    width: W - Spacing.lg * 2,
    height: 130,
    borderRadius: Radius.xl,
    backgroundColor: Colors.bgSurface,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginTop: Spacing.sm,
  },
  coverPlaceholder: { alignItems: 'center' },
  coverEditOverlay: {
    position: 'absolute',
    bottom: Spacing['2xs'],
    right: Spacing['2xs'],
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },

  // Footer
  footer: { paddingHorizontal: Spacing.lg, gap: Spacing['2xs'] },
  continueBtn: {
    height: 56,
    borderRadius: Radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...GlowShadow.amber,
  },
});
