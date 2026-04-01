import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Radius } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TButton } from '@/components/ui/TButton';
import { TInput } from '@/components/ui/TInput';
import { TDivider } from '@/components/ui/TDivider';
import { useAuthStore } from '@/store/auth-store';

export default function SignInScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signIn } = useAuthStore();
  const [email, setEmail] = useState('');
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  const handleAuth = async (method: 'apple' | 'google' | 'email') => {
    setLoading(method);
    // Simulate auth
    await new Promise((r) => setTimeout(r, 600));
    setLoading(null);
    router.push('/(auth)/role-select');
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
        <View style={styles.header}>
          <TText variant="displayL" weight="bold">
            Connexion
          </TText>
          <TText variant="body" color="secondary" style={styles.subtitle}>
            Connexion rapide et sécurisée.
          </TText>
        </View>

        <View style={styles.methods}>
          {/* Apple */}
          <TouchableOpacity
            style={styles.socialButton}
            activeOpacity={0.85}
            onPress={() => handleAuth('apple')}
          >
            {loading === 'apple' ? null : (
              <Ionicons name="logo-apple" size={20} color={Colors.textPrimary} />
            )}
            <TText variant="bodySmall" weight="semibold" style={styles.socialLabel}>
              Continuer avec Apple
            </TText>
          </TouchableOpacity>

          {/* Google */}
          <TouchableOpacity
            style={styles.socialButton}
            activeOpacity={0.85}
            onPress={() => handleAuth('google')}
          >
            <TText variant="bodySmall" weight="semibold" style={styles.socialLabel}>
              Continuer avec Google
            </TText>
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <TDivider style={{ flex: 1 }} />
            <TText variant="caption" color="tertiary" style={{ marginHorizontal: Spacing['2xs'] }}>
              ou
            </TText>
            <TDivider style={{ flex: 1 }} />
          </View>

          {showEmailForm ? (
            <View>
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
                onPress={() => handleAuth('email')}
                loading={loading === 'email'}
              />
            </View>
          ) : (
            <TouchableOpacity
              style={styles.socialButton}
              activeOpacity={0.85}
              onPress={() => setShowEmailForm(true)}
            >
              <Ionicons name="mail-outline" size={20} color={Colors.textSecondary} />
              <TText variant="bodySmall" color="secondary" style={styles.socialLabel}>
                Continuer avec un email
              </TText>
            </TouchableOpacity>
          )}
        </View>

        <TText variant="caption" color="tertiary" style={styles.legal}>
          En continuant, tu acceptes nos{' '}
          <TText variant="caption" color="accent">
            Conditions générales
          </TText>{' '}
          et notre{' '}
          <TText variant="caption" color="accent">
            Politique de confidentialité
          </TText>
          .
        </TText>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
    paddingHorizontal: Spacing.lg,
  },
  backBtn: {
    marginTop: Spacing['2xs'],
    width: 44,
    height: 44,
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: Spacing.xl,
  },
  header: {
    gap: Spacing['2xs'],
  },
  subtitle: {
    marginTop: 4,
  },
  methods: {
    gap: Spacing['2xs'],
  },
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
  socialLabel: {
    letterSpacing: 0.2,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing['2xs'],
  },
  legal: {
    textAlign: 'center',
    lineHeight: 18,
  },
});
