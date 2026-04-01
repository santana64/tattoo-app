import React from 'react';
import { View, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TButton } from '@/components/ui/TButton';

const { width, height } = Dimensions.get('window');

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <Image
        source={{ uri: 'https://images.unsplash.com/photo-1568515387631-8b650bbcdb90?w=800' }}
        style={styles.bg}
        contentFit="cover"
      />
      <LinearGradient
        colors={['transparent', 'rgba(10,10,10,0.6)', Colors.bgPrimary]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.content, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <View style={styles.logoSection}>
          <TText variant="displayXL" weight="bold" style={styles.logo}>
            TATTOO
          </TText>
          <TText variant="body" color="secondary" style={styles.tagline}>
            L'outil des tatoueurs sérieux.
          </TText>
        </View>

        <View style={styles.actions}>
          <TButton
            title="Commencer"
            onPress={() => router.push('/(auth)/sign-in')}
            variant="primary"
          />
          <TouchableOpacity
            onPress={() => router.push('/(auth)/sign-in')}
            style={styles.signInLink}
          >
            <TText variant="bodySmall" color="secondary">
              Déjà un compte ?{' '}
              <TText variant="bodySmall" color="accent">
                Se connecter
              </TText>
            </TText>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  bg: {
    ...StyleSheet.absoluteFillObject,
    width,
    height,
  },
  content: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.lg,
  },
  logoSection: {
    marginBottom: Spacing['2xl'],
  },
  logo: {
    letterSpacing: 8,
    marginBottom: Spacing['2xs'],
  },
  tagline: {
    letterSpacing: 0.5,
  },
  actions: {
    gap: Spacing.sm,
  },
  signInLink: {
    alignItems: 'center',
    paddingVertical: Spacing['2xs'],
  },
});
