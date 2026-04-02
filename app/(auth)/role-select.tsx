import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { Colors, Spacing, Radius, Shadow } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { useAuthStore } from '@/store/auth-store';
import { supabase } from '@/lib/supabase';
import { Toast } from '@/components/ui/TToast';

export default function RoleSelectScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { setRole, session, user, _devSignIn } = useAuthStore();
  const [loading, setLoading] = useState<'user' | 'artist' | null>(null);

  const selectRole = async (role: 'user' | 'artist') => {
    setLoading(role);
    try {
      if (session?.user) {
        // Real auth: update profile role in DB
        await setRole(role);
        if (role === 'artist') {
          // Create artist record
          const { error } = await supabase.from('artists').insert({
            profile_id: session.user.id,
            blaze: user?.displayName ?? 'Mon Blaze',
            city: 'Ma Ville',
          });
          if (error && error.code !== '23505') throw error; // ignore duplicate
        }
      } else {
        // Dev mode
        _devSignIn(role);
      }
      router.replace(role === 'user' ? '/(onboarding)/client/step1' : '/(onboarding)/artist/step1');
    } catch (e: any) {
      Toast.error(e.message ?? 'Erreur');
    } finally {
      setLoading(null);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + Spacing.xl, paddingBottom: insets.bottom + Spacing.lg }]}>
      <Animated.View entering={FadeIn.duration(400)} style={styles.header}>
        <TText variant="displayL" weight="bold">Qui es-tu ?</TText>
        <TText variant="body" color="secondary" style={styles.subtitle}>
          Choisis ton profil pour personnaliser ton expérience.
        </TText>
      </Animated.View>

      <View style={styles.cards}>
        {/* Client card */}
        <Animated.View entering={FadeInDown.delay(200).springify()}>
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.85}
            onPress={() => selectRole('user')}
            disabled={!!loading}
          >
            <View style={styles.cardIcon}>
              {loading === 'user'
                ? <ActivityIndicator color={Colors.accent} />
                : <Ionicons name="search" size={32} color={Colors.accent} />}
            </View>
            <TText variant="title2" weight="semibold" style={styles.cardTitle}>Je cherche un tatoueur</TText>
            <TText variant="bodySmall" color="secondary" style={styles.cardDesc}>
              Explore des artistes, découvre leurs univers, envoie des demandes structurées.
            </TText>
            <View style={styles.cardArrow}>
              <Ionicons name="arrow-forward" size={20} color={Colors.textTertiary} />
            </View>
          </TouchableOpacity>
        </Animated.View>

        {/* Artist card */}
        <Animated.View entering={FadeInDown.delay(320).springify()}>
          <TouchableOpacity
            style={[styles.card, styles.cardArtist]}
            activeOpacity={0.85}
            onPress={() => selectRole('artist')}
            disabled={!!loading}
          >
            <View style={styles.cardIcon}>
              {loading === 'artist'
                ? <ActivityIndicator color={Colors.accentWarm} />
                : <Ionicons name="brush" size={32} color={Colors.accentWarm} />}
            </View>
            <TText variant="title2" weight="semibold" style={styles.cardTitle}>Je suis tatoueur</TText>
            <TText variant="bodySmall" color="secondary" style={styles.cardDesc}>
              Crée ton profil pro, reçois des demandes qualifiées, gère ton agenda.
            </TText>
            <View style={styles.cardArrow}>
              <Ionicons name="arrow-forward" size={20} color={Colors.textTertiary} />
            </View>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary, paddingHorizontal: Spacing.lg, justifyContent: 'space-between' },
  header: { gap: Spacing['2xs'] },
  subtitle: { marginTop: 4, lineHeight: 24 },
  cards: { gap: Spacing.sm, flex: 1, justifyContent: 'center' },
  card: {
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    ...Shadow.sm,
  },
  cardArtist: { borderColor: 'rgba(200,168,130,0.2)' },
  cardIcon: { width: 56, height: 56, borderRadius: Radius.md, backgroundColor: Colors.bgSurface, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },
  cardTitle: { marginBottom: Spacing['3xs'] },
  cardDesc: { lineHeight: 22 },
  cardArrow: { position: 'absolute', right: Spacing.lg, top: Spacing.lg },
});
