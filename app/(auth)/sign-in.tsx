import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeIn, Layout } from 'react-native-reanimated';
import { Colors, Spacing, Radius } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TButton } from '@/components/ui/TButton';
import { TInput } from '@/components/ui/TInput';
import { TDivider } from '@/components/ui/TDivider';
import { useAuthStore } from '@/store/auth-store';
import { Toast } from '@/components/ui/TToast';

export default function SignInScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signInWithEmail, signInWithApple, signInWithGoogle, _devSignIn } = useAuthStore();
  const [email, setEmail] = useState('');
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);

  const handleApple = async () => {
    setLoading('apple');
    const { error } = await signInWithApple();
    setLoading(null);
    if (error) Toast.error(error);
  };

  const handleGoogle = async () => {
    setLoading('google');
    const { error } = await signInWithGoogle();
    setLoading(null);
    if (error) Toast.error(error);
  };

  const handleEmail = async () => {
    if (!email.trim()) return;
    setLoading('email');
    const { error } = await signInWithEmail(email.trim());
    setLoading(null);
    if (error) {
      Toast.error(error);
    } else {
      setEmailSent(true);
      Toast.success('Lien envoyé ! Vérifie ta boîte mail.');
    }
  };

  const handleDevLogin = (role: 'user' | 'artist') => {
    _devSignIn(role);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
      </TouchableOpacity>

      <View style={[styles.content, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <Animated.View entering={FadeIn.duration(400)} style={styles.header}>
          <TText variant="displayL" weight="bold">Connexion</TText>
          <TText variant="body" color="secondary" style={styles.subtitle}>
            Connexion rapide et sécurisée.
          </TText>
        </Animated.View>

        <View style={styles.methods}>
          {/* Apple */}
          <Animated.View entering={FadeInDown.delay(100).springify()}>
            <TouchableOpacity
              style={styles.socialButton}
              activeOpacity={0.8}
              onPress={handleApple}
              disabled={!!loading}
            >
              <Ionicons name="logo-apple" size={20} color={Colors.textPrimary} />
              <TText variant="bodySmall" weight="semibold" style={styles.socialLabel}>
                Continuer avec Apple
              </TText>
            </TouchableOpacity>
          </Animated.View>

          {/* Google */}
          <Animated.View entering={FadeInDown.delay(180).springify()}>
            <TouchableOpacity
              style={styles.socialButton}
              activeOpacity={0.8}
              onPress={handleGoogle}
              disabled={!!loading}
            >
              <TText variant="bodySmall" weight="semibold" style={styles.socialLabel}>
                Continuer avec Google
              </TText>
            </TouchableOpacity>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(250)} style={styles.dividerRow}>
            <TDivider style={{ flex: 1 }} />
            <TText variant="caption" color="tertiary" style={{ marginHorizontal: Spacing['2xs'] }}>ou</TText>
            <TDivider style={{ flex: 1 }} />
          </Animated.View>

          {/* Email */}
          <Animated.View entering={FadeInDown.delay(310).springify()} layout={Layout.springify()}>
            {emailSent ? (
              <View style={styles.emailSentBox}>
                <Ionicons name="mail-open-outline" size={28} color={Colors.success} />
                <TText variant="bodySmall" color="secondary" style={{ marginTop: 8, textAlign: 'center', lineHeight: 20 }}>
                  Lien envoyé à{' '}<TText variant="bodySmall" weight="semibold">{email}</TText>{'\n'}Vérifie ta boîte mail.
                </TText>
              </View>
            ) : showEmailForm ? (
              <Animated.View entering={FadeIn.duration(300)} style={{ gap: Spacing['2xs'] }}>
                <TInput
                  label="Email"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="ton@email.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                />
                <TButton
                  title="Recevoir un lien de connexion"
                  onPress={handleEmail}
                  loading={loading === 'email'}
                  disabled={!email.trim()}
                />
              </Animated.View>
            ) : (
              <TouchableOpacity
                style={styles.socialButton}
                activeOpacity={0.8}
                onPress={() => setShowEmailForm(true)}
              >
                <Ionicons name="mail-outline" size={20} color={Colors.textSecondary} />
                <TText variant="bodySmall" color="secondary" style={styles.socialLabel}>
                  Continuer avec un email
                </TText>
              </TouchableOpacity>
            )}
          </Animated.View>

          {/* Dev shortcuts */}
          {__DEV__ && (
            <Animated.View entering={FadeIn.delay(500)} style={styles.devRow}>
              <TText variant="caption" color="tertiary" style={{ textAlign: 'center', marginBottom: 6 }}>
                DEV — Connexion rapide
              </TText>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity style={styles.devBtn} onPress={() => handleDevLogin('user')}>
                  <TText variant="caption">👤 Client</TText>
                </TouchableOpacity>
                <TouchableOpacity style={styles.devBtn} onPress={() => handleDevLogin('artist')}>
                  <TText variant="caption">🎨 Artiste</TText>
                </TouchableOpacity>
              </View>
            </Animated.View>
          )}
        </View>

        <Animated.View entering={FadeIn.delay(500)}>
          <TText variant="caption" color="tertiary" style={styles.legal}>
            En continuant, tu acceptes nos{' '}
            <TText variant="caption" color="accent">Conditions générales</TText>
            {' '}et notre{' '}
            <TText variant="caption" color="accent">Politique de confidentialité</TText>.
          </TText>
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary, paddingHorizontal: Spacing.lg },
  backBtn: { marginTop: Spacing['2xs'], width: 44, height: 44, justifyContent: 'center' },
  content: { flex: 1, justifyContent: 'space-between', paddingTop: Spacing.xl },
  header: { gap: Spacing['2xs'] },
  subtitle: { marginTop: 4 },
  methods: { gap: Spacing['2xs'] },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgSurface,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    gap: Spacing['2xs'],
  },
  socialLabel: { letterSpacing: 0.2 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: Spacing['2xs'] },
  emailSentBox: { alignItems: 'center', padding: Spacing.md, backgroundColor: Colors.bgElevated, borderRadius: Radius.md },
  legal: { textAlign: 'center', lineHeight: 18 },
  devRow: { marginTop: Spacing.sm, alignItems: 'center' },
  devBtn: {
    flex: 1,
    alignItems: 'center',
    padding: 8,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgSurface,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
});
