import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Radius, Shadow } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { useAuthStore } from '@/store/auth-store';

export default function RoleSelectScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signIn } = useAuthStore();

  const selectRole = (role: 'user' | 'artist') => {
    signIn({
      id: `u_${Date.now()}`,
      displayName: 'Nouvel utilisateur',
      email: 'user@example.com',
      role,
      artistId: role === 'artist' ? 'a1' : undefined,
      artistTier: role === 'artist' ? 'normal' : undefined,
      onboardingCompleted: false,
    });
    if (role === 'user') {
      router.replace('/(onboarding)/client/step1');
    } else {
      router.replace('/(onboarding)/artist/step1');
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + Spacing.xl, paddingBottom: insets.bottom + Spacing.lg }]}>
      <View style={styles.header}>
        <TText variant="displayL" weight="bold">
          Qui es-tu ?
        </TText>
        <TText variant="body" color="secondary" style={styles.subtitle}>
          Choisis ton profil pour personnaliser ton expérience.
        </TText>
      </View>

      <View style={styles.cards}>
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.85}
          onPress={() => selectRole('user')}
        >
          <View style={styles.cardIcon}>
            <Ionicons name="search" size={32} color={Colors.accent} />
          </View>
          <TText variant="title2" weight="semibold" style={styles.cardTitle}>
            Je cherche un tatoueur
          </TText>
          <TText variant="bodySmall" color="secondary" style={styles.cardDesc}>
            Explore des artistes, découvre leurs univers, envoie des demandes structurées.
          </TText>
          <View style={styles.cardArrow}>
            <Ionicons name="arrow-forward" size={20} color={Colors.textTertiary} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.card, styles.cardArtist]}
          activeOpacity={0.85}
          onPress={() => selectRole('artist')}
        >
          <View style={styles.cardIcon}>
            <Ionicons name="brush" size={32} color={Colors.accentWarm} />
          </View>
          <TText variant="title2" weight="semibold" style={styles.cardTitle}>
            Je suis tatoueur
          </TText>
          <TText variant="bodySmall" color="secondary" style={styles.cardDesc}>
            Crée ton profil pro, reçois des demandes qualifiées, gère ton agenda.
          </TText>
          <View style={styles.cardArrow}>
            <Ionicons name="arrow-forward" size={20} color={Colors.textTertiary} />
          </View>
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
  header: {
    gap: Spacing['2xs'],
  },
  subtitle: {
    marginTop: 4,
    lineHeight: 24,
  },
  cards: {
    gap: Spacing.sm,
    flex: 1,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    ...Shadow.sm,
  },
  cardArtist: {
    borderColor: 'rgba(200,168,130,0.2)',
  },
  cardIcon: {
    width: 56,
    height: 56,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgSurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  cardTitle: {
    marginBottom: Spacing['3xs'],
  },
  cardDesc: {
    lineHeight: 22,
  },
  cardArrow: {
    position: 'absolute',
    right: Spacing.lg,
    top: Spacing.lg,
  },
});
