import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth-store';
import { Colors, Spacing, Layout } from '@/constants/theme';
import { enterUp, fadeIn } from '@/components/motion/tokens';
import { TText } from '@/components/ui/TText';
import { TButton } from '@/components/ui/TButton';
import { Logo } from '@/components/ui/Logo';

// A code is single-use. Reuse the pending result on React strict-mode remount.
let lastCode: string | undefined;
let pendingExchange: ReturnType<typeof supabase.auth.exchangeCodeForSession> | undefined;
function exchangeCode(code: string) {
  if (code !== lastCode || !pendingExchange) {
    lastCode = code;
    pendingExchange = supabase.auth.exchangeCodeForSession(code);
  }
  return pendingExchange;
}

export default function AuthCallbackScreen() {
  const { code, error: providerError } = useLocalSearchParams<{ code?: string; error?: string }>();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [exchanged, setExchanged] = useState(false);
  const { user, isLoading, error: profileError } = useAuthStore();
  const reduced = useReducedMotion();

  useEffect(() => {
    let active = true;
    const finish = async () => {
      try {
        if (providerError || !code) throw new Error('Ce lien de connexion est invalide ou a expiré. Demandez un nouveau lien.');
        const result = await exchangeCode(code);
        if (result.error || !result.data.session) {
          throw new Error('Ce lien a expiré ou a été ouvert dans un autre navigateur. Demandez un nouveau lien depuis ce navigateur.');
        }
        if (!active) return;
        setExchanged(true);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Connexion impossible. Réessayez.');
      }
    };
    void finish();
    return () => { active = false; };
  }, [code, providerError, router]);

  useEffect(() => {
    if (!exchanged || isLoading) return;
    if (user) router.replace(user.onboardingCompleted ? '/(tabs)' : '/(auth)/role-select');
    else setError(profileError ?? 'Votre profil est momentanément indisponible.');
  }, [exchanged, isLoading, user, profileError, router]);

  return (
    <View style={styles.container}>
      {error ? (
        <View style={styles.column} accessibilityLiveRegion="polite">
          <Animated.View entering={enterUp(0)} style={styles.iconRing}>
            <Ionicons name="link-outline" size={20} color={Colors.accentWarm} />
          </Animated.View>
          <Animated.View entering={enterUp(1)}>
            <TText variant="displayM" style={styles.title} accessibilityRole="header">
              Connexion{' '}
              <TText variant="displayM" italic color="accentGlow">interrompue</TText>
            </TText>
          </Animated.View>
          <Animated.View entering={enterUp(2)}>
            <TText variant="body" color="secondary" style={styles.message}>{error}</TText>
          </Animated.View>
          <Animated.View entering={enterUp(3)} style={styles.actions}>
            <TButton title="Revenir à la connexion" onPress={() => router.replace('/(auth)/sign-in')} />
            <TButton title="Explorer les artistes" variant="ghost" size="md" onPress={() => router.replace('/(tabs)/explore')} />
          </Animated.View>
        </View>
      ) : (
        <Animated.View
          entering={fadeIn()}
          style={styles.column}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel="Connexion en cours"
        >
          <Logo size="lg" variant="mark" animate={!reduced} />
          <TText variant="displayS" style={styles.title}>
            Connexion{' '}
            <TText variant="displayS" italic color="accentGlow">en cours…</TText>
          </TText>
          <ActivityIndicator color={Colors.textSecondary} size="small" />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Layout.gutter,
    backgroundColor: Colors.bgPrimary,
  },
  column: { width: '100%', maxWidth: 420, alignItems: 'center' },
  iconRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderGlow,
    backgroundColor: Colors.glassAmber,
    marginBottom: Spacing.md,
  },
  title: { textAlign: 'center', marginTop: Spacing.md, marginBottom: Spacing.sm },
  message: { textAlign: 'center', marginBottom: Spacing.xl },
  actions: { width: '100%', gap: Spacing['3xs'] },
});
