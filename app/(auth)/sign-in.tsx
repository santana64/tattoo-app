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
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated from 'react-native-reanimated';
import { Colors, Spacing, Radius, Layout } from '@/constants/theme';
import { enterUp, fadeIn } from '@/components/motion/tokens';
import { PressableScale } from '@/components/motion/PressableScale';
import { TText } from '@/components/ui/TText';
import { TButton } from '@/components/ui/TButton';
import { TInput } from '@/components/ui/TInput';
import { Logo } from '@/components/ui/Logo';
import { enabledOAuthProviders } from '@/lib/auth-errors';
import { useAuthStore } from '@/store/auth-store';
import { Toast } from '@/components/ui/TToast';
import { Captcha, CAPTCHA_REQUIRED } from '@/components/auth/Captcha';

const FORM_MAX_WIDTH = 480;
const MIN_PASSWORD = 8;
type AuthMode = 'signin' | 'signup' | 'magic';
// Format check only: the provider remains the source of truth.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Entrance rhythm matches welcome.tsx: masthead fades, then a short rising stagger.
const STAGGER_BASE = 120;

export default function SignInScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const {
    signInWithEmail, signInWithPassword, signUpWithPassword, signInWithApple, signInWithGoogle,
    error: profileError, refreshProfile, signOut,
  } = useAuthStore();
  const oauth = enabledOAuthProviders();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState<false | 'magic' | 'confirm'>(false);
  const [emailTouched, setEmailTouched] = useState(false);
  // Password is the default: it works even when the e-mail provider is throttled.
  const [mode, setMode] = useState<AuthMode>('signin');
  const [password, setPassword] = useState('');
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  // Turnstile, web only and only with a site key: a token is single-use.
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const captchaPending = CAPTCHA_REQUIRED && !captchaToken;

  const consumeCaptcha = () => {
    const token = captchaToken;
    if (CAPTCHA_REQUIRED) {
      setCaptchaToken(null);
      setCaptchaResetKey((n) => n + 1);
    }
    return token;
  };

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
    if (!email.trim() || captchaPending) return;
    setLoading('email');
    const { error } = await signInWithEmail(email.trim(), consumeCaptcha());
    setLoading(null);
    if (error) {
      Toast.error(error);
    } else {
      setEmailSent('magic');
      Toast.success('Lien envoyé. Vérifiez votre boîte mail.');
    }
  };

  const passwordError = passwordTouched && mode !== 'magic'
    ? (!password
      ? 'Saisissez votre mot de passe.'
      : mode === 'signup' && password.length < MIN_PASSWORD
        ? `Au moins ${MIN_PASSWORD} caractères.`
        : undefined)
    : undefined;

  const handlePassword = async () => {
    setEmailTouched(true);
    setPasswordTouched(true);
    const tooShort = mode === 'signup' && password.length < MIN_PASSWORD;
    if (!EMAIL_PATTERN.test(email.trim()) || !password || tooShort) return;
    if (captchaPending) {
      // Reached from the keyboard's "go" key; the button itself stays disabled.
      Toast.info('Validez d’abord la vérification anti-robot.');
      return;
    }
    setLoading('password');
    const token = consumeCaptcha();
    if (mode === 'signup') {
      const { error, needsConfirmation } = await signUpWithPassword(email.trim(), password, token);
      setLoading(null);
      if (error) Toast.error(error);
      else if (needsConfirmation) setEmailSent('confirm');
      // Otherwise a session exists: the root layout routes to onboarding.
    } else {
      const { error } = await signInWithPassword(email.trim(), password, token);
      setLoading(null);
      if (error) Toast.error(error);
    }
  };

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setPasswordTouched(false);
  };

  const emailValid = EMAIL_PATTERN.test(email.trim());
  const emailError = emailTouched && !emailValid
    ? (email.trim() ? 'Cette adresse e-mail semble incomplète.' : 'Saisissez votre adresse e-mail.')
    : undefined;

  const submitEmail = () => {
    setEmailTouched(true);
    if (!emailValid) return;
    if (captchaPending) {
      Toast.info('Validez d’abord la vérification anti-robot.');
      return;
    }
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
            <Animated.View entering={fadeIn()} style={styles.topBar}>
              {canGoBack ? (
                <PressableScale
                  onPress={() => router.back()}
                  pressedScale={0.92}
                  accessibilityRole="button"
                  accessibilityLabel="Retour"
                  hitSlop={8}
                  style={styles.backButton}
                >
                  <Ionicons name="chevron-back" size={20} color={Colors.textPrimary} />
                </PressableScale>
              ) : null}
              <Logo size="sm" variant="wordmark" />
            </Animated.View>

            <View style={styles.spacer} />

            {/* Editorial block */}
            <Animated.View entering={enterUp(0, STAGGER_BASE)} style={styles.kicker}>
              <View style={styles.kickerRule} />
              <TText variant="label" color="accentWarm" uppercase>Connexion · Inscription</TText>
            </Animated.View>

            <Animated.View entering={enterUp(1, STAGGER_BASE)}>
              <TText variant="displayL" style={styles.headline} accessibilityRole="header">
                Entrez dans{'\n'}
                <TText variant="displayL" italic color="accentGlow">l’atelier.</TText>
              </TText>
              <TText variant="body" color="secondary" style={styles.lede}>
                Un seul compte pour suivre vos artistes, confier vos projets et retrouver vos
                rendez-vous.
              </TText>
            </Animated.View>

            {/* Profile could not be loaded after sign-in */}
            {profileError ? (
              <Animated.View entering={enterUp(0)} style={styles.notice} accessibilityLiveRegion="polite">
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
              <Animated.View entering={enterUp(0)} style={styles.sentPanel} accessibilityLiveRegion="polite">
                <View style={styles.iconRing}>
                  <Ionicons name="mail-open-outline" size={20} color={Colors.accentWarm} />
                </View>
                <TText variant="displayS" style={styles.sentTitle} accessibilityRole="header">
                  Vérifiez votre{' '}
                  <TText variant="displayS" italic color="accentGlow">boîte mail</TText>
                </TText>
                <TText variant="bodySmall" color="secondary" style={styles.sentText}>
                  {emailSent === 'confirm' ? 'Votre compte est créé. Confirmez l’adresse ' : 'Nous avons envoyé un lien de connexion à '}
                  <TText variant="bodySmall" weight="medium">{email.trim()}</TText>
                  {emailSent === 'confirm' ? ' grâce au lien reçu, puis connectez-vous.' : '.'}
                </TText>
                <TText variant="caption" color="tertiary" style={styles.sentText}>
                  Ouvrez-le depuis cet appareil pour terminer la connexion. Pensez à vérifier
                  vos courriers indésirables.
                </TText>
                {emailSent === 'magic' && CAPTCHA_REQUIRED ? (
                  <Captcha onToken={setCaptchaToken} resetKey={captchaResetKey} style={styles.sentCaptcha} />
                ) : null}
                <View style={styles.sentActions}>
                  {emailSent === 'magic' ? (
                    <TButton
                      title="Renvoyer le lien"
                      variant="secondary"
                      size="md"
                      fullWidth={false}
                      loading={loading === 'email'}
                      disabled={captchaPending}
                      onPress={handleEmail}
                    />
                  ) : (
                    <TButton
                      title="J’ai confirmé, me connecter"
                      variant="secondary"
                      size="md"
                      fullWidth={false}
                      onPress={() => { setEmailSent(false); switchMode('signin'); }}
                    />
                  )}
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
                {/* ── Providers (only those enabled on the Supabase project) ── */}
                {oauth.size > 0 && (
                  <>
                    <Animated.View entering={enterUp(2, STAGGER_BASE)} style={styles.providers}>
                      {oauth.has('apple') && (
                        <TButton
                          title="Continuer avec Apple"
                          variant="secondary"
                          onPress={handleApple}
                          loading={loading === 'apple'}
                          disabled={!!loading}
                          icon={<Ionicons name="logo-apple" size={19} color={Colors.textPrimary} />}
                        />
                      )}
                      {oauth.has('google') && (
                        <TButton
                          title="Continuer avec Google"
                          variant="secondary"
                          onPress={handleGoogle}
                          loading={loading === 'google'}
                          disabled={!!loading}
                          icon={<Ionicons name="logo-google" size={17} color={Colors.textPrimary} />}
                        />
                      )}
                    </Animated.View>

                    <Animated.View entering={enterUp(3, STAGGER_BASE)} style={styles.dividerRow}>
                      <View style={styles.dividerLine} />
                      <TText variant="caption" color="tertiary">ou par e-mail</TText>
                      <View style={styles.dividerLine} />
                    </Animated.View>
                  </>
                )}

                {/* ── Mode switch ─────────────────────────────────── */}
                {mode !== 'magic' && (
                  <Animated.View entering={enterUp(4, STAGGER_BASE)} style={styles.segment} accessibilityRole="tablist">
                    {(['signin', 'signup'] as const).map((m) => (
                      <Pressable
                        key={m}
                        onPress={() => switchMode(m)}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: mode === m }}
                        style={[styles.segmentItem, mode === m && styles.segmentItemActive]}
                      >
                        <TText variant="bodySmall" weight="medium" style={{ color: mode === m ? Colors.textInverse : Colors.textSecondary }}>
                          {m === 'signin' ? 'Se connecter' : 'Créer un compte'}
                        </TText>
                      </Pressable>
                    ))}
                  </Animated.View>
                )}

                <Animated.View entering={enterUp(5, STAGGER_BASE)}>
                  <TInput
                    label="Adresse e-mail"
                    value={email}
                    onChangeText={setEmail}
                    onBlur={() => { if (email.trim()) setEmailTouched(true); }}
                    placeholder="vous@exemple.fr"
                    error={emailError}
                    helper={mode === 'magic' ? 'Nous vous envoyons un lien de connexion par e-mail.' : undefined}
                    keyboardType="email-address"
                    inputMode="email"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    textContentType="emailAddress"
                    returnKeyType={mode === 'magic' ? 'send' : 'next'}
                    onSubmitEditing={mode === 'magic' ? submitEmail : undefined}
                    editable={!loading}
                  />

                  {mode !== 'magic' && (
                    <TInput
                      label="Mot de passe"
                      value={password}
                      onChangeText={setPassword}
                      onBlur={() => { if (password) setPasswordTouched(true); }}
                      placeholder={mode === 'signup' ? `${MIN_PASSWORD} caractères minimum` : 'Votre mot de passe'}
                      error={passwordError}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                      textContentType={mode === 'signup' ? 'newPassword' : 'password'}
                      returnKeyType="go"
                      onSubmitEditing={() => void handlePassword()}
                      editable={!loading}
                      rightElement={
                        <Pressable
                          onPress={() => setShowPassword((v) => !v)}
                          hitSlop={10}
                          accessibilityRole="button"
                          accessibilityLabel={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                        >
                          <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={19} color={Colors.textTertiary} />
                        </Pressable>
                      }
                    />
                  )}

                  <Captcha onToken={setCaptchaToken} resetKey={captchaResetKey} />

                  {mode === 'magic' ? (
                    <TButton
                      title="Recevoir le lien de connexion"
                      onPress={submitEmail}
                      loading={loading === 'email'}
                      disabled={(!!loading && loading !== 'email') || captchaPending}
                    />
                  ) : (
                    <TButton
                      title={mode === 'signup' ? 'Créer mon compte' : 'Se connecter'}
                      onPress={() => void handlePassword()}
                      loading={loading === 'password'}
                      disabled={(!!loading && loading !== 'password') || captchaPending}
                    />
                  )}

                  <Pressable
                    onPress={() => switchMode(mode === 'magic' ? 'signin' : 'magic')}
                    accessibilityRole="button"
                    hitSlop={8}
                    style={styles.altLink}
                  >
                    <TText variant="bodySmall" color="secondary" style={styles.underline}>
                      {mode === 'magic'
                        ? 'Utiliser plutôt un mot de passe'
                        : mode === 'signin' ? 'Mot de passe oublié ? Recevoir un lien de connexion' : 'Recevoir plutôt un lien par e-mail'}
                    </TText>
                  </Pressable>
                </Animated.View>
              </>
            )}

            {/* Legal */}
            <Animated.View
              entering={fadeIn(700)}
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
  },

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
  sentCaptcha: { maxWidth: 360, marginTop: Spacing.xs, marginBottom: 0 },
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

  segment: {
    flexDirection: 'row',
    padding: 4,
    gap: 4,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderDefault,
    backgroundColor: Colors.bgElevated,
    marginBottom: Spacing.lg,
  },
  segmentItem: {
    flex: 1,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentItemActive: { backgroundColor: Colors.accentAction },
  altLink: { alignSelf: 'center', marginTop: Spacing.md, paddingVertical: 4 },
});
