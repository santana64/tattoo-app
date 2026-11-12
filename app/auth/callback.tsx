import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth-store';
import { Colors, Spacing } from '@/constants/theme';
import { enterUp, fadeIn } from '@/components/motion/tokens';
import { TText } from '@/components/ui/TText';
import { TButton } from '@/components/ui/TButton';
import { Logo } from '@/components/ui/Logo';
import { EditorialTitle, Kicker } from '@/components/v5';
import { useContentDimensions } from '@/hooks/useContentDimensions';

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
  const { gutter } = useContentDimensions();

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
    <View style={[styles.container, { paddingHorizontal: gutter }]}>
      {error ? (
        <View style={styles.column} accessibilityLiveRegion="polite">
          <Animated.View entering={enterUp(0)}>
            <Kicker tone="flame" style={styles.kicker}>Connexion / Retour</Kicker>
            <EditorialTitle emphasis="interrompue.">Connexion</EditorialTitle>
          </Animated.View>
          <Animated.View entering={enterUp(1)}>
            <TText variant="body" color="secondary" style={styles.message}>{error}</TText>
          </Animated.View>
          <Animated.View entering={enterUp(2)} style={styles.actions}>
            <TButton title="Revenir à la connexion" fullWidth={false} onPress={() => router.replace('/(auth)/sign-in')} />
            <TButton title="Explorer les artistes" variant="ghost" size="md" fullWidth={false} onPress={() => router.replace('/(tabs)/explore')} />
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
          <Kicker tone="muted" style={styles.pendingKicker}>Connexion / Vérification</Kicker>
          <TText variant="displayM" style={styles.pendingTitle}>
            Connexion{' '}
            <TText variant="displayM" italic color="accentGlow" style={styles.pendingTitle}>en cours…</TText>
          </TText>
          <ActivityIndicator color={Colors.ink} size="small" style={styles.spinner} />
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
    backgroundColor: Colors.paper,
  },
  column: {
    width: '100%',
    maxWidth: 560,
    borderTopWidth: 1,
    borderTopColor: Colors.ink,
    paddingTop: Spacing.lg,
  },
  kicker: { marginBottom: Spacing.sm },
  message: { marginTop: Spacing.md, marginBottom: Spacing.xl, maxWidth: 460 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing['2xs'] },
  pendingKicker: { marginTop: Spacing.lg, marginBottom: Spacing.xs },
  pendingTitle: { fontSize: 40, lineHeight: 42 },
  spinner: { alignSelf: 'flex-start', marginTop: Spacing.md },
});
