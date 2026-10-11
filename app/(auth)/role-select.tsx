import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Colors, Spacing, Radius, Layout } from '@/constants/theme';
import { EASE_OUT, MotionDuration, enterUp, fadeIn } from '@/components/motion/tokens';
import { PressableScale } from '@/components/motion/PressableScale';
import { TText } from '@/components/ui/TText';
import { Logo } from '@/components/ui/Logo';
import { useAuthStore } from '@/store/auth-store';
import { Toast } from '@/components/ui/TToast';

const FORM_MAX_WIDTH = 480;

type Role = 'user' | 'artist';

// ── Role option: hairline card, paper ring fades in when chosen ─────────────
function RoleOption({
  icon,
  title,
  description,
  state,
  disabled,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  /** idle: nothing chosen · selected: this one is saving · dimmed: the other one was chosen */
  state: 'idle' | 'selected' | 'dimmed';
  disabled: boolean;
  onPress: () => void;
}) {
  const selected = useSharedValue(state === 'selected' ? 1 : 0);
  const opacity = useSharedValue(state === 'dimmed' ? 0.45 : 1);

  useEffect(() => {
    const timing = { duration: MotionDuration.state, easing: EASE_OUT };
    selected.set(withTiming(state === 'selected' ? 1 : 0, timing));
    opacity.set(withTiming(state === 'dimmed' ? 0.45 : 1, timing));
  }, [state, selected, opacity]);

  const cardStyle = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  const ringStyle = useAnimatedStyle(() => ({ opacity: selected.get() }));

  return (
    <Animated.View style={cardStyle}>
      <PressableScale
        onPress={onPress}
        disabled={disabled}
        haptic
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${description}`}
        accessibilityState={{ disabled, busy: state === 'selected', selected: state === 'selected' }}
        style={styles.card}
      >
        {/* Selection ring: opacity-only transition, no layout shift. */}
        <Animated.View pointerEvents="none" style={[styles.cardRing, ringStyle]} />

        <View style={styles.iconRing}>
          <Ionicons name={icon} size={20} color={Colors.accentWarm} />
        </View>

        <View style={styles.cardText}>
          <TText variant="title2" weight="semibold">{title}</TText>
          <TText variant="bodySmall" color="secondary">{description}</TText>
        </View>

        <View style={styles.cardTrailing}>
          {state === 'selected' ? (
            <ActivityIndicator color={Colors.textPrimary} size="small" />
          ) : (
            <Ionicons name="arrow-forward" size={18} color={Colors.textTertiary} />
          )}
        </View>
      </PressableScale>
    </Animated.View>
  );
}

export default function RoleSelectScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { setRole, saveArtist, session, refreshProfile } = useAuthStore();
  const [loading, setLoading] = useState<'user' | 'artist' | null>(null);

  const selectRole = async (role: 'user' | 'artist') => {
    setLoading(role);
    try {
      if (session?.user) {
        await setRole(role);
        if (role === 'artist') {
          // Creates the artist row (idempotent); real name and city are set in onboarding step 1.
          const { error } = await saveArtist({});
          if (error) throw new Error(error);
          await refreshProfile();
        }
      } else {
        router.replace('/(auth)/sign-in');
        return;
      }
      router.replace(role === 'user' ? '/(onboarding)/client/step1' : '/(onboarding)/artist/step1');
    } catch (e: any) {
      Toast.error(e.message ?? 'Une erreur est survenue. Réessayez.');
    } finally {
      setLoading(null);
    }
  };

  const stateFor = (role: Role): 'idle' | 'selected' | 'dimmed' =>
    loading === null ? 'idle' : loading === role ? 'selected' : 'dimmed';

  return (
    <View style={styles.container}>
      {/* One warm spotlight from above. */}
      <LinearGradient
        colors={['rgba(201,164,106,0.09)', 'rgba(201,164,106,0.02)', 'rgba(11,10,9,0)']}
        locations={[0, 0.4, 1]}
        style={styles.spotlight}
        pointerEvents="none"
      />

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { minHeight: height, paddingTop: insets.top + 14, paddingBottom: insets.bottom + Spacing.lg },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.column}>
          <Animated.View entering={fadeIn()} style={styles.topBar}>
            <Logo size="sm" variant="wordmark" />
          </Animated.View>

          <View style={styles.spacer} />

          <Animated.View entering={enterUp(0, 80)} style={styles.kicker}>
            <View style={styles.kickerRule} />
            <TText variant="label" color="accentWarm" uppercase>Bienvenue</TText>
          </Animated.View>

          <Animated.View entering={enterUp(1, 80)}>
            <TText variant="displayL" style={styles.headline} accessibilityRole="header">
              Comment utiliserez-vous{' '}
              <TText variant="displayL" italic color="accentGlow">Inkr ?</TText>
            </TText>
          </Animated.View>

          <Animated.View entering={enterUp(2, 80)}>
            <TText variant="body" color="secondary" style={styles.lede}>
              Choisissez votre profil : nous adaptons l’expérience à votre usage.
            </TText>
          </Animated.View>

          <View style={styles.cards}>
            <Animated.View entering={enterUp(3, 80)}>
              <RoleOption
                icon="search-outline"
                title="Je cherche un artiste"
                description="Explorez les portfolios, enregistrez vos artistes et envoyez des demandes détaillées."
                state={stateFor('user')}
                disabled={!!loading}
                onPress={() => selectRole('user')}
              />
            </Animated.View>
            <Animated.View entering={enterUp(4, 80)}>
              <RoleOption
                icon="brush-outline"
                title="Je suis tatoueur·se"
                description="Présentez votre travail, recevez des demandes qualifiées et organisez vos rendez-vous."
                state={stateFor('artist')}
                disabled={!!loading}
                onPress={() => selectRole('artist')}
              />
            </Animated.View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  spotlight: { position: 'absolute', top: 0, left: 0, right: 0, height: 420 },

  scroll: { flexGrow: 1, paddingHorizontal: Layout.gutter },
  column: { flex: 1, width: '100%', maxWidth: FORM_MAX_WIDTH, alignSelf: 'center' },

  topBar: { flexDirection: 'row', alignItems: 'center', minHeight: 40 },
  spacer: { flex: 1, minHeight: Spacing['2xl'], maxHeight: 160 },

  kicker: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: Spacing.md },
  kickerRule: { width: 24, height: 1, backgroundColor: Colors.accentWarm },
  headline: { marginBottom: Spacing.sm },
  lede: { maxWidth: 440, marginBottom: Spacing.xl },

  cards: { gap: Spacing.xs },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderDefault,
    backgroundColor: Colors.bgCard,
  },
  cardRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.accent,
    backgroundColor: Colors.glassBg,
  },
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
  cardText: { flex: 1, gap: 4 },
  cardTrailing: { width: 24, alignItems: 'center' },
});
