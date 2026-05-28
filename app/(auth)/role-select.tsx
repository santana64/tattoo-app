import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, Radius, GlowShadow } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { Logo } from '@/components/ui/Logo';
import { useAuthStore } from '@/store/auth-store';
import { supabase } from '@/lib/supabase';
import { Toast } from '@/components/ui/TToast';

// ── Animated card wrapper with spring press scale ─────────────
function ScaleCard({
  children,
  onPress,
  disabled,
  style,
}: {
  children: React.ReactNode;
  onPress: () => void;
  disabled: boolean;
  style?: object;
}) {
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[animStyle, style]}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        onPressIn={() => {
          scale.value = withSpring(0.97, { damping: 18, stiffness: 400 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 18, stiffness: 400 });
        }}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

export default function RoleSelectScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { setRole, session, user, _devSignIn } = useAuthStore();
  const [loading, setLoading] = useState<'user' | 'artist' | null>(null);

  const selectRole = async (role: 'user' | 'artist') => {
    setLoading(role);
    try {
      if (session?.user) {
        await setRole(role);
        if (role === 'artist') {
          const { error } = await supabase.from('artists').insert({
            profile_id: session.user.id,
            blaze: user?.displayName ?? 'Mon Blaze',
            city: 'Ma Ville',
          });
          if (error && error.code !== '23505') throw error;
        }
      } else {
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
    <View
      style={[
        styles.container,
        { paddingTop: insets.top + Spacing.xl, paddingBottom: insets.bottom + Spacing.lg },
      ]}
    >
      {/* Aurora orbs */}
      <View style={styles.orbViolet} pointerEvents="none" />
      <View style={styles.orbAmber} pointerEvents="none" />

      {/* Logo */}
      <Animated.View entering={FadeIn.duration(500)} style={styles.logoWrap}>
        <Logo variant="full" size="md" animate />
      </Animated.View>

      {/* Header */}
      <Animated.View entering={FadeInDown.delay(150).duration(500)} style={styles.header}>
        <TText variant="displayL" weight="bold">Qui es-tu ?</TText>
        <TText variant="body" color="secondary" style={styles.subtitle}>
          Choisis ton profil pour personnaliser ton expérience.
        </TText>
      </Animated.View>

      {/* Cards */}
      <View style={styles.cards}>

        {/* ── Client card ── */}
        <Animated.View entering={FadeInDown.delay(300).springify()}>
          <ScaleCard
            onPress={() => selectRole('user')}
            disabled={!!loading}
            style={styles.cardShadowWrap}
          >
            <View style={styles.clientCard}>
              {/* Icon area */}
              <View style={styles.clientIconWrap}>
                {loading === 'user' ? (
                  <ActivityIndicator color={Colors.accentWarm} />
                ) : (
                  <Ionicons name="search" size={28} color={Colors.accentWarm} />
                )}
              </View>

              {/* Text */}
              <View style={styles.cardTextBlock}>
                <TText variant="title2" weight="bold" style={styles.cardTitle}>
                  Je cherche un tatoueur
                </TText>
                <TText variant="bodySmall" color="secondary" style={styles.cardDesc}>
                  Explore des artistes, découvre leurs univers, envoie des demandes structurées.
                </TText>
              </View>

              {/* Arrow */}
              <View style={styles.cardArrow}>
                <Ionicons name="arrow-forward" size={20} color={Colors.textTertiary} />
              </View>
            </View>
          </ScaleCard>
        </Animated.View>

        {/* ── Artist card ── */}
        <Animated.View entering={FadeInDown.delay(420).springify()}>
          <ScaleCard
            onPress={() => selectRole('artist')}
            disabled={!!loading}
            style={styles.cardShadowWrap}
          >
            <View style={styles.artistCard}>
              {/* PRO pill */}
              <View style={styles.proPillWrap}>
                <LinearGradient
                  colors={[Colors.accentGlow, Colors.accentWarm]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.proPill}
                >
                  <TText
                    style={{
                      color: '#FFFFFF',
                      fontSize: 10,
                      fontWeight: 'bold',
                      letterSpacing: 1,
                    }}
                  >
                    PRO
                  </TText>
                </LinearGradient>
              </View>

              {/* Icon area */}
              <LinearGradient
                colors={[Colors.accentGlow, Colors.accentWarm]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.artistIconWrap}
              >
                {loading === 'artist' ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Ionicons name="brush" size={28} color="#FFFFFF" />
                )}
              </LinearGradient>

              {/* Text */}
              <View style={styles.cardTextBlock}>
                <TText variant="title2" weight="bold" style={styles.cardTitle}>
                  Je suis tatoueur
                </TText>
                <TText variant="bodySmall" color="secondary" style={styles.cardDesc}>
                  Crée ton profil pro, reçois des demandes qualifiées, gère ton agenda.
                </TText>
              </View>

              {/* Arrow */}
              <View style={styles.cardArrow}>
                <Ionicons name="arrow-forward" size={20} color={Colors.accentWarm} />
              </View>
            </View>
          </ScaleCard>
        </Animated.View>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
    paddingHorizontal: Spacing.lg,
  },

  // ── Aurora orbs ────────────────────────────────────────────
  orbViolet: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: Colors.violet,
    opacity: 0.055,
    top: -60,
    right: -80,
  },
  orbAmber: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: Colors.accentWarm,
    opacity: 0.05,
    bottom: 60,
    left: -60,
  },

  // ── Header ─────────────────────────────────────────────────
  logoWrap: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  header: {
    gap: Spacing['2xs'],
    marginBottom: Spacing['2xl'],
  },
  subtitle: {
    marginTop: 4,
    lineHeight: 24,
  },

  // ── Cards container ────────────────────────────────────────
  cards: {
    gap: Spacing.md,
    flex: 1,
    justifyContent: 'center',
  },

  cardShadowWrap: {},

  // ── Client card ────────────────────────────────────────────
  clientCard: {
    backgroundColor: Colors.glassBg,
    borderWidth: 1.5,
    borderColor: Colors.borderDefault,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  clientIconWrap: {
    width: 60,
    height: 60,
    borderRadius: Radius.md,
    backgroundColor: Colors.glassAmber,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  // ── Artist card ────────────────────────────────────────────
  artistCard: {
    backgroundColor: Colors.glassBg,
    borderWidth: 1.5,
    borderColor: 'rgba(212,168,100,0.25)',
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    ...GlowShadow.amber,
  },
  artistIconWrap: {
    width: 60,
    height: 60,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  // ── PRO pill ───────────────────────────────────────────────
  proPillWrap: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    zIndex: 10,
  },
  proPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },

  // ── Shared card internals ──────────────────────────────────
  cardTextBlock: {
    flex: 1,
    gap: Spacing['3xs'],
  },
  cardTitle: {
    marginBottom: 2,
  },
  cardDesc: {
    lineHeight: 20,
  },
  cardArrow: {
    flexShrink: 0,
    marginLeft: Spacing['3xs'],
  },
});
