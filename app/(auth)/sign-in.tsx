import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  TextInput,
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
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, Radius, GlowShadow } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { Logo } from '@/components/ui/Logo';
import { useAuthStore } from '@/store/auth-store';
import { Toast } from '@/components/ui/TToast';

// ── Animated glass social button ──────────────────────────────
function SocialButton({
  onPress,
  disabled,
  children,
  delay = 0,
}: {
  onPress: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  delay?: number;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.97, { damping: 18, stiffness: 400 });
  };
  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 18, stiffness: 400 });
  };

  return (
    <Animated.View entering={FadeInDown.delay(delay).springify()} style={animStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        style={styles.socialButton}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

// ── Aurora orb ────────────────────────────────────────────────
function AuroraOrb({
  size,
  color,
  style,
}: {
  size: number;
  color: string;
  style?: object;
}) {
  return (
    <View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
}

export default function SignInScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signInWithEmail, signInWithApple, signInWithGoogle, _devSignIn } = useAuthStore();
  const [email, setEmail] = useState('');
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);

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
      {/* Aurora orbs — decorative background atmosphere */}
      <AuroraOrb
        size={280}
        color={`rgba(139,92,246,0.06)`}
        style={{ top: -60, right: -80 }}
      />
      <AuroraOrb
        size={220}
        color={`rgba(212,168,100,0.055)`}
        style={{ bottom: 120, left: -70 }}
      />

      {/* Back button */}
      <TouchableOpacity
        onPress={() => router.back()}
        style={[styles.backBtn, { marginTop: Spacing['3xs'] }]}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
      </TouchableOpacity>

      <View style={[styles.content, { paddingBottom: insets.bottom + Spacing.lg }]}>

        {/* Header — Logo + tagline */}
        <Animated.View entering={FadeInDown.delay(0).duration(500)} style={styles.header}>
          <Logo variant="full" size="lg" animate />
          <TText
            variant="bodySmall"
            color="secondary"
            style={styles.tagline}
          >
            L'art du tatouage, réinventé.
          </TText>
        </Animated.View>

        {/* Auth methods */}
        <View style={styles.methods}>

          {/* Apple */}
          <SocialButton onPress={handleApple} disabled={!!loading} delay={80}>
            <Ionicons name="logo-apple" size={20} color={Colors.textPrimary} />
            <TText variant="bodySmall" weight="semibold" style={styles.socialLabel}>
              Continuer avec Apple
            </TText>
          </SocialButton>

          {/* Google */}
          <SocialButton onPress={handleGoogle} disabled={!!loading} delay={160}>
            <TText
              variant="bodySmall"
              weight="bold"
              style={[styles.googleG, { color: Colors.accentWarm }]}
            >
              G
            </TText>
            <TText variant="bodySmall" weight="semibold" style={styles.socialLabel}>
              Continuer avec Google
            </TText>
          </SocialButton>

          {/* Divider */}
          <Animated.View entering={FadeInDown.delay(240)} style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <TText variant="caption" color="tertiary" style={styles.dividerLabel}>ou</TText>
            <View style={styles.dividerLine} />
          </Animated.View>

          {/* Email — toggle / form / sent */}
          <Animated.View entering={FadeInDown.delay(320).springify()}>
            {emailSent ? (
              // ── Email sent success card ──
              <Animated.View
                entering={FadeInDown.springify().damping(12).stiffness(200)}
                style={styles.emailSentCard}
              >
                <View style={styles.emailSentIconWrap}>
                  <Ionicons name="mail-open-outline" size={32} color={Colors.success} />
                </View>
                <TText
                  variant="bodySmall"
                  weight="semibold"
                  style={{ color: Colors.textPrimary, marginTop: Spacing['2xs'] }}
                >
                  Lien de connexion envoyé
                </TText>
                <TText
                  variant="caption"
                  color="secondary"
                  style={styles.emailSentSubtext}
                >
                  Vérifie ta boîte mail pour{' '}
                  <TText variant="caption" weight="semibold" style={{ color: Colors.accentWarm }}>
                    {email}
                  </TText>
                </TText>
              </Animated.View>
            ) : showEmailForm ? (
              // ── Email input form ──
              <Animated.View
                entering={FadeIn.duration(280)}
                style={styles.emailFormCard}
              >
                {/* Input */}
                <View
                  style={[
                    styles.inputWrap,
                    emailFocused && styles.inputWrapFocused,
                  ]}
                >
                  <Ionicons
                    name="mail-outline"
                    size={16}
                    color={emailFocused ? Colors.accentWarm : Colors.textTertiary}
                    style={{ marginRight: Spacing['2xs'] }}
                  />
                  <TextInput
                    style={styles.textInput}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="ton@email.com"
                    placeholderTextColor={Colors.textTertiary}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    autoFocus
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => setEmailFocused(false)}
                  />
                </View>

                {/* CTA */}
                <TouchableOpacity
                  onPress={handleEmail}
                  disabled={!email.trim() || loading === 'email'}
                  activeOpacity={0.85}
                  style={[styles.ctaWrap, (!email.trim() || loading === 'email') && { opacity: 0.5 }]}
                >
                  <LinearGradient
                    colors={[Colors.accentGlow, Colors.accentWarm, '#A06030']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.ctaGradient, GlowShadow.amberStrong]}
                  >
                    <TText variant="bodySmall" weight="bold" style={styles.ctaLabel}>
                      {loading === 'email' ? 'Envoi en cours…' : 'Recevoir un lien de connexion'}
                    </TText>
                    {loading !== 'email' && (
                      <Ionicons name="arrow-forward" size={16} color={Colors.textInverse} />
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
            ) : (
              // ── Email toggle button ──
              <SocialButton onPress={() => setShowEmailForm(true)} delay={0}>
                <Ionicons name="mail-outline" size={20} color={Colors.textSecondary} />
                <TText variant="bodySmall" color="secondary" weight="semibold" style={styles.socialLabel}>
                  Continuer avec un email
                </TText>
              </SocialButton>
            )}
          </Animated.View>

          {/* Dev shortcuts */}
          {__DEV__ && (
            <Animated.View entering={FadeIn.delay(500)} style={styles.devRow}>
              <TText variant="caption" color="tertiary" style={styles.devLabel}>
                DEV — Connexion rapide
              </TText>
              <View style={styles.devButtons}>
                <TouchableOpacity
                  style={styles.devBtn}
                  onPress={() => handleDevLogin('user')}
                >
                  <TText variant="caption" style={{ color: Colors.textSecondary }}>
                    Client
                  </TText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.devBtn}
                  onPress={() => handleDevLogin('artist')}
                >
                  <TText variant="caption" style={{ color: Colors.accentWarm }}>
                    Artiste
                  </TText>
                </TouchableOpacity>
              </View>
            </Animated.View>
          )}
        </View>

        {/* Legal */}
        <Animated.View entering={FadeIn.delay(480)}>
          <TText variant="caption" color="tertiary" style={styles.legal}>
            En continuant, tu acceptes nos{' '}
            <Pressable onPress={() => router.push('/legal/terms')} hitSlop={4}>
              <TText variant="caption" style={styles.legalLink}>Conditions générales</TText>
            </Pressable>
            {' '}et notre{' '}
            <Pressable onPress={() => router.push('/legal/privacy-policy')} hitSlop={4}>
              <TText variant="caption" style={styles.legalLink}>Politique de confidentialité</TText>
            </Pressable>
            .
          </TText>
        </Animated.View>
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
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: Spacing.xl,
  },

  // ── Header ──────────────────────────────────────────────────
  header: {
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing['2xs'],
  },
  tagline: {
    fontStyle: 'italic',
    letterSpacing: 0.3,
    color: Colors.textSecondary,
    marginTop: Spacing['3xs'],
  },

  // ── Methods ─────────────────────────────────────────────────
  methods: {
    gap: Spacing['2xs'],
  },

  // ── Social button — glassmorphism ────────────────────────────
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 54,
    borderRadius: Radius.xl,
    backgroundColor: Colors.glassBg,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    gap: Spacing['2xs'],
  },
  socialLabel: {
    letterSpacing: 0.2,
  },
  googleG: {
    fontSize: 18,
    lineHeight: 20,
    width: 20,
    textAlign: 'center',
  },

  // ── Divider ─────────────────────────────────────────────────
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing['3xs'],
    gap: Spacing['2xs'],
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.borderSubtle,
  },
  dividerLabel: {
    letterSpacing: 0.5,
  },

  // ── Email form card ──────────────────────────────────────────
  emailFormCard: {
    backgroundColor: Colors.glassBg,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    padding: Spacing.sm,
    gap: Spacing.sm,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.lg,
    backgroundColor: Colors.bgSurface,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  inputWrapFocused: {
    borderBottomColor: Colors.accentWarm,
    borderColor: Colors.borderDefault,
  },
  textInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 15,
    letterSpacing: 0.2,
  },
  ctaWrap: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  ctaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    gap: Spacing['2xs'],
    borderRadius: Radius.lg,
  },
  ctaLabel: {
    color: Colors.textInverse,
    letterSpacing: 0.3,
  },

  // ── Email sent card ──────────────────────────────────────────
  emailSentCard: {
    alignItems: 'center',
    padding: Spacing.lg,
    backgroundColor: Colors.glassBg,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: `rgba(16,185,129,0.20)`,
    gap: Spacing['3xs'],
  },
  emailSentIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: `rgba(16,185,129,0.10)`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing['3xs'],
  },
  emailSentSubtext: {
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 2,
  },

  // ── Dev shortcuts ────────────────────────────────────────────
  devRow: {
    marginTop: Spacing.xs,
    alignItems: 'center',
    gap: Spacing['3xs'],
  },
  devLabel: {
    textAlign: 'center',
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontSize: 10,
  },
  devButtons: {
    flexDirection: 'row',
    gap: Spacing['2xs'],
  },
  devBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing['3xs'],
    paddingHorizontal: Spacing.xs,
    borderRadius: Radius.sm,
    backgroundColor: Colors.glassBg,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },

  // ── Legal ────────────────────────────────────────────────────
  legal: {
    textAlign: 'center',
    lineHeight: 18,
  },
  legalLink: {
    color: Colors.accentWarm,
  },
});
