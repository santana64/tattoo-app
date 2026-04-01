import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Radius } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TButton } from '@/components/ui/TButton';
import { OnboardingProgress } from '@/components/OnboardingProgress';

export default function ArtistStep3() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + Spacing.md, paddingBottom: insets.bottom + Spacing.lg }]}>
      <OnboardingProgress total={5} current={3} />

      <View style={styles.content}>
        <TText variant="displayL" weight="bold" style={styles.title}>
          Ta photo de profil
        </TText>
        <TText variant="body" color="secondary" style={styles.subtitle}>
          Une photo de profil professionnelle augmente fortement la confiance de tes clients.
        </TText>

        <TouchableOpacity style={styles.uploadArea} activeOpacity={0.8}>
          <Ionicons name="camera" size={40} color={Colors.textTertiary} />
          <TText variant="bodySmall" color="secondary" style={{ marginTop: Spacing['2xs'] }}>
            Ajouter une photo
          </TText>
          <TText variant="caption" color="tertiary" style={{ marginTop: 2 }}>
            JPEG ou PNG · Recommandé : 400×400px
          </TText>
        </TouchableOpacity>
      </View>

      <View style={styles.actions}>
        <TButton
          title="Continuer"
          onPress={() => router.push('/(onboarding)/artist/step4')}
        />
        <TouchableOpacity onPress={() => router.push('/(onboarding)/artist/step4')} style={styles.skipLink}>
          <TText variant="bodySmall" color="tertiary">
            Passer cette étape
          </TText>
        </TouchableOpacity>
      </View>
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
  content: { flex: 1, paddingTop: Spacing['2xl'] },
  title: { marginBottom: Spacing['2xs'] },
  subtitle: { marginBottom: Spacing.xl, lineHeight: 24 },
  uploadArea: {
    height: 180,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.borderDefault,
    borderStyle: 'dashed',
    backgroundColor: Colors.bgSurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.md,
  },
  actions: { gap: Spacing['2xs'] },
  skipLink: { alignItems: 'center', paddingVertical: Spacing['2xs'] },
});
