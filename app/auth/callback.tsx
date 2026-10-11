import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth-store';
import { Colors, Spacing } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TButton } from '@/components/ui/TButton';

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

  useEffect(() => {
    let active = true;
    const finish = async () => {
      try {
        if (providerError || !code) throw new Error('Ce lien de connexion est invalide ou a expiré. Demande un nouveau lien.');
        const result = await exchangeCode(code);
        if (result.error || !result.data.session) {
          throw new Error('Ce lien a expiré ou a été ouvert dans un autre navigateur. Demande un nouveau lien depuis ce navigateur.');
        }
        if (!active) return;
        setExchanged(true);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Connexion impossible. Réessaie.');
      }
    };
    void finish();
    return () => { active = false; };
  }, [code, providerError, router]);

  useEffect(() => {
    if (!exchanged || isLoading) return;
    if (user) router.replace(user.onboardingCompleted ? '/(tabs)' : '/(auth)/role-select');
    else setError(profileError ?? 'Ton profil est momentanément indisponible.');
  }, [exchanged, isLoading, user, profileError, router]);

  return (
    <View style={styles.container}>
      {error ? (
        <>
          <TText variant="title2">Connexion interrompue</TText>
          <TText color="secondary" style={styles.message}>{error}</TText>
          <TButton title="Revenir à la connexion" onPress={() => router.replace('/(auth)/sign-in')} />
          <TButton title="Explorer les artistes" variant="ghost" onPress={() => router.replace('/(tabs)/explore')} />
        </>
      ) : (
        <><ActivityIndicator color={Colors.accentWarm} /><TText>Connexion en cours…</TText></>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.lg, gap: Spacing.md, backgroundColor: Colors.bgPrimary },
  message: { textAlign: 'center', maxWidth: 420 },
});
