import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { Colors, Spacing } from '@/constants/theme';
import { fadeIn } from '@/components/motion/tokens';
import { TText } from '@/components/ui/TText';
import { TButton } from '@/components/ui/TButton';
import { TInput } from '@/components/ui/TInput';
import { IconButton, Kicker, Rule, StatusDot } from '@/components/v5';
import { StageAside, StageBand, StageTitle, useStage } from '@/components/v5/Stage';
import { enabledOAuthProviders } from '@/lib/auth-errors';
import { useAuthStore } from '@/store/auth-store';
import { Toast } from '@/components/ui/TToast';
import { Captcha, CAPTCHA_REQUIRED } from '@/components/auth/Captcha';

const FORM_MAX_WIDTH = 440;
const MIN_PASSWORD = 8;
type AuthMode = 'signin' | 'signup' | 'magic';
// Format check only: the provider remains the source of truth.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const STATEMENT = {
  kicker: 'Identité / Accès',
  title: 'Entrez dans',
  emphasis: 'l’atelier.',
  copy: 'Un seul compte pour suivre vos artistes, confier vos projets et retrouver vos rendez-vous.',
};

type Hover = { pressed: boolean; hovered?: boolean };
const webPointer = Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null;

/**
 * Apple / Google: white sheet, ink hairline, the provider's own glyph in ink.
 * Hover takes a wash fill so the glyph stays legible (a filled hover would hide it).
 */
function ProviderButton({ title, icon, onPress, loading, disabled }: {
  title: string; icon: React.ReactNode; onPress: () => void; loading: boolean; disabled: boolean;
}) {
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={inactive ? undefined : onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={(state) => [
        styles.provider,
        webPointer,
        ((state as Hover).hovered || (state as Hover).pressed) && !inactive && styles.providerActive,
        inactive && styles.providerInactive,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={Colors.ink} size="small" />
      ) : (
        <>
          {icon}
          <TText variant="label" weight="bold" uppercase style={styles.providerLabel} numberOfLines={1}>{title}</TText>
        </>
      )}
    </Pressable>
  );
}

export default function SignInScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { wide, height, asideWidth } = useStage();
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
  const back = canGoBack ? (
    <IconButton icon="arrow-back" label="Retour" onInk onPress={() => router.back()} />
  ) : null;

  // ── The form column (paper) ─────────────────────────────────
  const form = (
    <View style={styles.column}>
      <Kicker tone="muted" style={styles.formKicker}>Inkr / Authentification</Kicker>

      {/* Profile could not be loaded after sign-in */}
      {profileError ? (
        <View style={styles.notice} accessibilityLiveRegion="polite">
          <StatusDot tone="wait" label="Profil indisponible" />
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
        </View>
      ) : null}

      {emailSent ? (
        // ── Link sent ───────────────────────────────────────
        <View style={styles.sentPanel} accessibilityLiveRegion="polite">
          <View style={styles.iconFrame}>
            <Ionicons name="mail-open-outline" size={20} color={Colors.ink} />
          </View>
          <StageTitle size={wide ? 44 : 38} emphasis="boîte mail.">Vérifiez votre</StageTitle>
          <TText variant="bodySmall" color="secondary" style={styles.sentText}>
            {emailSent === 'confirm' ? 'Votre compte est créé. Confirmez l’adresse ' : 'Nous avons envoyé un lien de connexion à '}
            <TText variant="bodySmall" weight="semibold">{email.trim()}</TText>
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
        </View>
      ) : (
        <>
          {/* ── Mode switch ─────────────────────────────────── */}
          {mode !== 'magic' ? (
            <View style={styles.tabs} accessibilityRole="tablist">
              {(['signin', 'signup'] as const).map((m) => {
                const selected = mode === m;
                return (
                  <Pressable
                    key={m}
                    onPress={() => switchMode(m)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected }}
                    style={[styles.tab, webPointer, selected && styles.tabSelected]}
                  >
                    <TText
                      variant="label"
                      weight="bold"
                      uppercase
                      style={{ color: selected ? Colors.ink : Colors.textTertiary, letterSpacing: 1.2 }}
                    >
                      {m === 'signin' ? 'Se connecter' : 'Créer un compte'}
                    </TText>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <View style={styles.magicHead}>
              <StageTitle size={wide ? 40 : 34} emphasis="de connexion.">Recevoir un lien</StageTitle>
            </View>
          )}

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
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  style={styles.eye}
                >
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={19} color={Colors.textSecondary} />
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
            style={[styles.altLink, webPointer]}
          >
            <TText variant="bodySmall" color="secondary" style={styles.underline}>
              {mode === 'magic'
                ? 'Utiliser plutôt un mot de passe'
                : mode === 'signin' ? 'Mot de passe oublié ? Recevoir un lien de connexion' : 'Recevoir plutôt un lien par e-mail'}
            </TText>
          </Pressable>

          {/* ── Providers (only those enabled on the Supabase project) ── */}
          {oauth.size > 0 && (
            <>
              <View style={styles.dividerRow}>
                <Rule style={styles.dividerLine} />
                <Kicker tone="muted">Ou continuer avec</Kicker>
                <Rule style={styles.dividerLine} />
              </View>
              <View style={[styles.providers, wide && styles.providersWide]}>
                {oauth.has('apple') && (
                  <View style={wide ? styles.providerCell : undefined}>
                    <ProviderButton
                      title="Continuer avec Apple"
                      onPress={handleApple}
                      loading={loading === 'apple'}
                      disabled={!!loading}
                      icon={<Ionicons name="logo-apple" size={19} color={Colors.ink} />}
                    />
                  </View>
                )}
                {oauth.has('google') && (
                  <View style={wide ? styles.providerCell : undefined}>
                    <ProviderButton
                      title="Continuer avec Google"
                      onPress={handleGoogle}
                      loading={loading === 'google'}
                      disabled={!!loading}
                      icon={<Ionicons name="logo-google" size={17} color={Colors.ink} />}
                    />
                  </View>
                )}
              </View>
            </>
          )}
        </>
      )}

      {/* Legal */}
      <View style={styles.legalRow}>
        <TText variant="caption" color="tertiary">En continuant, vous acceptez les </TText>
        <Pressable onPress={() => router.push('/legal/terms')} accessibilityRole="link" hitSlop={8}>
          <TText variant="caption" color="secondary" style={styles.underline}>CGU</TText>
        </Pressable>
        <TText variant="caption" color="tertiary"> et la </TText>
        <Pressable onPress={() => router.push('/legal/privacy-policy')} accessibilityRole="link" hitSlop={8}>
          <TText variant="caption" color="secondary" style={styles.underline}>politique de confidentialité</TText>
        </Pressable>
        <TText variant="caption" color="tertiary">.</TText>
      </View>
    </View>
  );

  if (wide) {
    return (
      <View style={[styles.container, styles.split]}>
        <StageAside
          width={asideWidth}
          leading={back}
          kicker={STATEMENT.kicker}
          title={STATEMENT.title}
          emphasis={STATEMENT.emphasis}
          copy={STATEMENT.copy}
          footer={<Kicker tone="onInkMuted">Art under skin.</Kicker>}
        />
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView
            contentContainerStyle={[
              styles.mainWide,
              { minHeight: height, paddingTop: insets.top + Spacing['3xl'], paddingBottom: insets.bottom + Spacing['3xl'] },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {form}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + Spacing.xl }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <StageBand leading={back} meta={STATEMENT.kicker}>
            <Animated.View entering={fadeIn()} style={styles.bandStatement}>
              <StageTitle size={42} emphasis={STATEMENT.emphasis} onInk breakEmphasis>{STATEMENT.title}</StageTitle>
              <TText variant="bodySmall" color="onInkMuted" style={styles.bandCopy}>{STATEMENT.copy}</TText>
            </Animated.View>
          </StageBand>
          <View style={styles.mainNarrow}>{form}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.paper },
  split: { flexDirection: 'row' },
  flex: { flex: 1 },

  mainWide: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: Spacing['3xl'] },
  mainNarrow: { paddingHorizontal: 20, paddingTop: Spacing.xl },
  column: { width: '100%', maxWidth: FORM_MAX_WIDTH, alignSelf: 'center' },

  bandStatement: { marginTop: Spacing.lg },
  bandCopy: { marginTop: Spacing.sm, maxWidth: 420, lineHeight: 21 },

  formKicker: { marginBottom: Spacing.lg },

  notice: {
    borderTopWidth: 1,
    borderTopColor: Colors.ink,
    borderBottomWidth: 1,
    borderBottomColor: Colors.line,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  noticeText: { marginTop: 8 },
  noticeActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: Spacing.xs },

  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.line,
    marginBottom: Spacing.lg,
  },
  tab: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    marginBottom: -1,
  },
  tabSelected: { borderBottomColor: Colors.flame },
  magicHead: { marginBottom: Spacing.lg },

  eye: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', marginRight: -10 },

  altLink: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', marginTop: Spacing['2xs'] },
  underline: { textDecorationLine: 'underline' },

  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  dividerLine: { flex: 1, alignSelf: 'center' },

  providers: { gap: 10 },
  providersWide: { flexDirection: 'row' },
  providerCell: { flex: 1, minWidth: 0 },
  provider: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.ink,
    backgroundColor: Colors.white,
  },
  providerActive: { backgroundColor: Colors.wash },
  providerInactive: { opacity: 0.42 },
  providerLabel: { color: Colors.ink, letterSpacing: 0.8, fontSize: 11, lineHeight: 16, flexShrink: 1 },

  sentPanel: {
    borderTopWidth: 1,
    borderTopColor: Colors.ink,
    paddingTop: Spacing.lg,
  },
  iconFrame: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.line,
    marginBottom: Spacing.md,
  },
  sentText: { maxWidth: 400, marginTop: Spacing.xs },
  sentCaptcha: { maxWidth: 400, marginTop: Spacing.sm, marginBottom: 0 },
  sentActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: Spacing.lg,
  },

  legalRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: Spacing.xl,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.line,
  },
});
