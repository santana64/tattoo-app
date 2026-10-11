import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { Easing, FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { Colors, Spacing, Radius, Layout, Duration } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TButton } from '@/components/ui/TButton';
import { TInput } from '@/components/ui/TInput';
import { Logo } from '@/components/ui/Logo';
import { useAuthStore } from '@/store/auth-store';
import { Toast } from '@/components/ui/TToast';

const FORM_MAX_WIDTH = 480;
const EASE = Easing.bezier(0.22, 1, 0.36, 1);
// Format check only: the provider remains the source of truth.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function enter(delay: number, reduced: boolean) {
  return reduced ? undefined : FadeInDown.delay(delay).duration(Duration.reveal).easing(EASE);
}

type InteractionState = { pressed: boolean; hovered?: boolean };

export default function SignInScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const { signInWithEmail, signInWithApple, signInWithGoogle, error: profileError, refreshProfile, signOut } = useAuthStore();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);

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
      Toast.success('Lien envoyé. Vérifiez votre boîte mail.');
    }
  };

  const emailValid = EMAIL_PATTERN.test(email.trim());
  const emailError = emailTouched && !emailValid
    ? (email.trim() ? 'Cette adresse e-mail semble incomplète.' : 'Saisissez votre adresse e-mail.')
    : undefined;

  const submitEmail = () => {
    setEmailTouched(true);
    if (!emailValid) return;
    void handleEmail();
  };

  const canGoBack = router.canGoBack();

  return (
    <View style={styles.container}>
      {/* A single warm spotlight from above — no orbs, no glow loops. */}
      <LinearGradient
        colors={['rgba(201,164,106,0.10)', 'rgba(201,164,106,0.03)', 'rgba(11,10,9,0)']}
        locations={[0, 0.4, 1]}
        style={styles.spotlight}
        pointerEvents="none"
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { minHeight: height, paddingTop: insets.top + 14, paddingBottom: insets.bottom + Spacing.lg },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.column}>
            {/* Masthead */}
            <Animated.View entering={reduced ? undefined : FadeIn.duration(800)} style={styles.topBar}>
              {canGoBack ? (
                <Pressable
                  onPress={() => router.back()}
                  accessibilityRole="button"
                  accessibilityLabel="Retour"
                  hitSlop={8}
                  style={(state) => {
                    const { pressed, hovered } = state as InteractionState;
                    return [styles.backButton, (pressed || hovered) && styles.backButtonActive];
                  }}
                >
                  <Ionicons name="chevron-back" size={20} color={Colors.textPrimary} />
                </Pressable>
              ) : null}
              <Logo size="sm" variant="wordmark" />
            </Animated.View>

            <View style={styles.spacer} />

            {/* Editorial block */}
            <Animated.View entering={enter(120, reduced)} style={styles.kicker}>
              <View style={styles.kickerRule} />
              <TText variant="label" color="accentWarm" uppercase>Connexion · Inscription</TText>
            </Animated.View>

            <Animated.View entering={enter(220, reduced)}>
              <TText variant="displayL" style={styles.headline} accessibilityRole="header">
                Entrez dans{'\n'}
                <TText variant="displayL" italic color="accentGlow">l’atelier.</TText>
              </TText>
              <TText variant="body" color="secondary" style={styles.lede}>
                Un seul compte pour suivre vos artistes, confier vos projets et retrouver vos
                rendez-vous. Aucun mot de passe à retenir.
              </TText>
            </Animated.View>

            {/* Profile could not be loaded after sign-in */}
            {profileError ? (
              <Animated.View entering={enter(0, reduced)} style={styles.notice} accessibilityLiveRegion="polite">
                <View style={styles.noticeHead}>
                  <View style={styles.noticeDot} />
                  <TText variant="bodySmall" weight="medium">Profil indisponible</TText>
                </View>
                <TText variant="caption" color="secondary" style={styles.noticeText}>{profileError}</TText>
                <View style={styles.noticeActions}>
                  <TButton
                    title="Réessayer"
                    variant="secondary"
                    size="sm"
                    fullWidth={false}
                    onPress={() => void refreshProfile()}
                  />
                  <TButton
                    title="Utiliser un autre compte"
                    variant="ghost"
                    size="sm"
                    fullWidth={false}
                    onPress={() => void signOut().catch(() => Toast.error('Déconnexion impossible. Réessayez.'))}
                  />
                </View>
              </Animated.View>
            ) : null}

            {emailSent ? (
              // ── Link sent ───────────────────────────────────────
              <Animated.View entering={enter(0, reduced)} style={styles.sentPanel} accessibilityLiveRegion="polite">
                <View style={styles.iconRing}>
                  <Ionicons name="mail-open-outline" size={20} color={Colors.accentWarm} />
                </View>
                <TText variant="displayS" style={styles.sentTitle} accessibilityRole="header">
                  Vérifiez votre{' '}
                  <TText variant="displayS" italic color="accentGlow">boîte mail</TText>
                </TText>
                <TText variant="bodySmall" color="secondary" style={styles.sentText}>
                  Nous avons envoyé un lien de connexion à{' '}
                  <TText variant="bodySmall" weight="medium">{email.trim()}</TText>.
                </TText>
                <TText variant="caption" color="tertiary" style={styles.sentText}>
                  Ouvrez-le depuis cet appareil pour terminer la connexion. Pensez à vérifier
                  vos courriers indésirables.
                </TText>
                <View style={styles.sentActions}>
                  <TButton
                    title="Renvoyer le lien"
                    variant="secondary"
                    size="md"
                    fullWidth={false}
                    loading={loading === 'email'}
                    onPress={handleEmail}
                  />
                  <TButton
                    title="Changer d’adresse"
                    variant="ghost"
                    size="md"
                    fullWidth={false}
                    disabled={loading === 'email'}
                    onPress={() => setEmailSent(false)}
                  />
                </View>
              </Animated.View>
            ) : (
              <>
                {/* ── Providers ──────────────────────────────────── */}
                <Animated.View entering={enter(340, reduced)} style={styles.providers}>
                  <TButton
                    title="Continuer avec Apple"
                    variant="secondary"
                    onPress={handleApple}
                    loading={loading === 'apple'}
                    disabled={!!loading}
                    icon={<Ionicons name="logo-apple" size={19} color={Colors.textPrimary} />}
                  />
                  <TButton
                    title="Continuer avec Google"
                    variant="secondary"
                    onPress={handleGoogle}
                    loading={loading === 'google'}
                    disabled={!!loading}
                    icon={<Ionicons name="logo-google" size={17} color={Colors.textPrimary} />}
                  />
                </Animated.View>

                <Animated.View entering={enter(420, reduced)} style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <TText variant="caption" color="tertiary">ou par e-mail</TText>
                  <View style={styles.dividerLine} />
                </Animated.View>

                {/* ── Email magic link ───────────────────────────── */}
                <Animated.View entering={enter(500, reduced)}>
                  <TInput
                    label="Adresse e-mail"
                    value={email}
                    onChangeText={setEmail}
                    onBlur={() => { if (email.trim()) setEmailTouched(true); }}
                    placeholder="vous@exemple.fr"
                    error={emailError}
                    helper="Nous vous envoyons un lien de connexion par e-mail."
                    keyboardType="email-address"
                    inputMode="email"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    textContentType="emailAddress"
                    returnKeyType="send"
                    onSubmitEditing={submitEmail}
                    editable={loading !== 'email'}
                  />
                  <TButton
                    title="Recevoir le lien de connexion"
                    onPress={submitEmail}
                    loading={loading === 'email'}
                    disabled={!!loading && loading !== 'email'}
                  />
                </Animated.View>
              </>
            )}

            {/* Legal */}
            <Animated.View
              entering={reduced ? undefined : FadeIn.delay(700).duration(600)}
              style={styles.legalRow}
            >
              <TText variant="caption" color="tertiary">En continuant, vous acceptez les </TText>
              <Pressable onPress={() => router.push('/legal/terms')} accessibilityRole="link" hitSlop={6}>
                <TText variant="caption" color="secondary" style={styles.underline}>CGU</TText>
              </Pressable>
              <TText variant="caption" color="tertiary"> et la </TText>
              <Pressable onPress={() => router.push('/legal/privacy-policy')} accessibilityRole="link" hitSlop={6}>
                <TText variant="caption" color="secondary" style={styles.underline}>politique de confidentialité</TText>
              </Pressable>
              <TText variant="caption" color="tertiary">.</TText>
            </Animated.View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  flex: { flex: 1 },
  spotlight: { position: 'absolute', top: 0, left: 0, right: 0, height: 420 },

  scroll: { flexGrow: 1, paddingHorizontal: Layout.gutter },
  column: { flex: 1, width: '100%', maxWidth: FORM_MAX_WIDTH, alignSelf: 'center' },

  topBar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, minHeight: 40 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderDefault,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } as object : null),
  },
  backButtonActive: { backgroundColor: Colors.glassBgMid },

  spacer: { flex: 1, minHeight: Spacing['2xl'], maxHeight: 160 },

  kicker: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: Spacing.md },
  kickerRule: { width: 24, height: 1, backgroundColor: Colors.accentWarm },
  headline: { marginBottom: Spacing.sm },
  lede: { maxWidth: 440, marginBottom: Spacing.xl },

  notice: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderDefault,
    borderRadius: Radius.lg,
    padding: Spacing.sm,
    marginBottom: Spacing.lg,
    backgroundColor: Colors.bgElevated,
  },
  noticeHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  noticeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.warning },
  noticeText: { marginTop: 6 },
  noticeActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: Spacing.xs },

  providers: { gap: 10 },

  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginVertical: Spacing.lg,
  },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: Colors.borderDefault },

  sentPanel: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius['2xl'],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderDefault,
    backgroundColor: Colors.bgElevated,
  },
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
  sentTitle: { textAlign: 'center', marginBottom: Spacing['2xs'] },
  sentText: { textAlign: 'center', maxWidth: 360, marginBottom: Spacing['2xs'] },
  sentActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: Spacing.sm,
  },

  legalRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: Spacing.xl,
  },
  underline: { textDecorationLine: 'underline' },
});
