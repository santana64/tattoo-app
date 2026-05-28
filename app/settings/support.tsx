import React, { useState, useRef } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  TouchableOpacity,
  TextInput,
  Linking,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Radius, GlowShadow, FontSize } from '@/constants/theme';
import { TText } from '@/components/ui/TText';

// Enable layout animation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ── FAQ data ─────────────────────────────────────────────────────
const FAQ_ITEMS = [
  {
    q: 'Comment modifier mon abonnement ?',
    a: 'Va dans Paramètres → Abonnement. Tu peux upgrader, downgrader ou annuler depuis cet écran. Les changements prennent effet à la fin de la période en cours.',
  },
  {
    q: 'Comment supprimer mon compte ?',
    a: 'Va dans Paramètres → Supprimer mon compte. Un délai de 30 jours te permet de changer d\'avis. Passé ce délai, toutes tes données sont définitivement effacées.',
  },
  {
    q: 'Comment signaler un contenu inapproprié ?',
    a: 'Appuie longuement sur un post ou utilise le menu ··· pour accéder à l\'option Signaler. Chaque signalement est examiné sous 48h par notre équipe.',
  },
  {
    q: 'Je n\'arrive pas à recevoir de demandes.',
    a: 'Vérifie que ton statut de disponibilité est sur "Ouvert" dans ton profil, et que ton abonnement est actif. Si le problème persiste, contacte notre support.',
  },
  {
    q: 'Comment restaurer mon abonnement ?',
    a: 'Va dans Paramètres → Abonnement → Restaurer les achats. Cette option est disponible uniquement si tu avais un abonnement actif sur le même compte Apple / Google.',
  },
  {
    q: 'Comment fonctionne le système de demandes ?',
    a: 'Tu envoies une demande détaillée à un artiste (style, budget, zone, description). L\'artiste accepte, refuse ou demande des précisions. En cas d\'acceptation, la messagerie s\'ouvre pour coordonner le RDV.',
  },
];

// ── Accordion item ───────────────────────────────────────────────
function AccordionItem({
  question,
  answer,
  isOpen,
  onPress,
  delay,
}: {
  question: string;
  answer: string;
  isOpen: boolean;
  onPress: () => void;
  delay: number;
}) {
  const rotation = useSharedValue(isOpen ? 1 : 0);

  React.useEffect(() => {
    rotation.value = withTiming(isOpen ? 1 : 0, { duration: 220 });
  }, [isOpen]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(rotation.value, [0, 1], [0, 180])}deg` }],
  }));

  const handlePress = () => {
    LayoutAnimation.configureNext({
      duration: 220,
      create: { type: 'easeInEaseOut', property: 'opacity' },
      update: { type: 'spring', springDamping: 0.7 },
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <Animated.View entering={FadeInDown.delay(delay).springify()} style={accordion.wrap}>
      <TouchableOpacity
        style={accordion.row}
        onPress={handlePress}
        activeOpacity={0.75}
      >
        <View style={accordion.bullet}>
          <TText style={{ fontSize: 10, color: Colors.accentWarm }}>✦</TText>
        </View>
        <TText variant="bodySmall" weight="medium" style={accordion.question}>
          {question}
        </TText>
        <Animated.View style={chevronStyle}>
          <Ionicons name="chevron-down" size={16} color={Colors.textTertiary} />
        </Animated.View>
      </TouchableOpacity>

      {isOpen && (
        <View style={accordion.answerWrap}>
          <LinearGradient
            colors={['rgba(212,168,100,0.04)', 'transparent']}
            style={StyleSheet.absoluteFill}
          />
          <TText variant="bodySmall" color="secondary" style={accordion.answer}>
            {answer}
          </TText>
        </View>
      )}
    </Animated.View>
  );
}

const accordion = StyleSheet.create({
  wrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSubtle,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    gap: Spacing['2xs'],
  },
  bullet: {
    width: 20,
    alignItems: 'center',
  },
  question: {
    flex: 1,
    lineHeight: 20,
  },
  answerWrap: {
    paddingLeft: 28,
    paddingRight: Spacing.xs,
    paddingBottom: Spacing.sm,
    overflow: 'hidden',
  },
  answer: {
    lineHeight: 22,
  },
});

// ── Glass input ──────────────────────────────────────────────────
function GlassInput({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[inp.wrap, focused && inp.focused]}>
      {focused && (
        <LinearGradient
          colors={['rgba(212,168,100,0.06)', 'transparent']}
          style={StyleSheet.absoluteFill}
        />
      )}
      <TText
        variant="micro"
        uppercase
        style={[inp.label, { color: focused ? Colors.accentWarm : Colors.textTertiary }]}
      >
        {label}
      </TText>
      <TextInput
        style={[inp.input, multiline && { height: 100, textAlignVertical: 'top' }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textTertiary}
        multiline={multiline}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
    </View>
  );
}

const inp = StyleSheet.create({
  wrap: {
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.xs,
    marginBottom: Spacing['2xs'],
    overflow: 'hidden',
  },
  focused: { borderColor: Colors.accentWarm },
  label: { fontSize: 9, letterSpacing: 1.5, marginBottom: 2 },
  input: {
    color: Colors.textPrimary,
    fontSize: FontSize.body,
    fontWeight: '400',
    paddingTop: 2,
    paddingBottom: 0,
  },
});

// ── Main screen ──────────────────────────────────────────────────
export default function SupportScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [sent, setSent] = useState(false);

  const canSend = subject.trim().length > 3 && description.trim().length > 10;

  const toggleFaq = (i: number) => {
    setOpenFaq(openFaq === i ? null : i);
  };

  const handleSend = () => {
    if (!canSend) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // In production: POST to support API
    const mailto = `mailto:support@inkr.app?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(description)}`;
    Linking.openURL(mailto).catch(() => {});
    setSent(true);
    setSubject('');
    setDescription('');
    setTimeout(() => {
      setSent(false);
      setShowForm(false);
    }, 2000);
  };

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 60 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <Animated.View entering={FadeInDown.delay(0).springify()} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <TText variant="title2" weight="bold">Aide et support</TText>
        <View style={{ width: 44 }} />
      </Animated.View>

      <View style={styles.body}>

        {/* Hero */}
        <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.hero}>
          <LinearGradient
            colors={['rgba(212,168,100,0.10)', 'rgba(212,168,100,0.03)']}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.heroIcon}>
            <TText style={{ fontSize: 24 }}>💬</TText>
          </View>
          <TText variant="title2" weight="bold" style={styles.heroTitle}>
            Comment peut-on t'aider ?
          </TText>
          <TText variant="bodySmall" color="secondary" style={{ textAlign: 'center', lineHeight: 20 }}>
            Consulte la FAQ ou envoie-nous un message. On répond sous 24–48h.
          </TText>
        </Animated.View>

        {/* FAQ section */}
        <Animated.View entering={FadeInDown.delay(200).springify()}>
          <TText variant="micro" uppercase color="tertiary" style={styles.sectionLabel}>
            Questions fréquentes
          </TText>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(220).springify()} style={styles.faqCard}>
          {FAQ_ITEMS.map((item, i) => (
            <AccordionItem
              key={i}
              question={item.q}
              answer={item.a}
              isOpen={openFaq === i}
              onPress={() => toggleFaq(i)}
              delay={240 + i * 40}
            />
          ))}
        </Animated.View>

        {/* Contact section */}
        <Animated.View entering={FadeInDown.delay(500).springify()}>
          <TText variant="micro" uppercase color="tertiary" style={[styles.sectionLabel, { marginTop: Spacing.xl }]}>
            Contacter le support
          </TText>
        </Animated.View>

        {!showForm ? (
          <Animated.View entering={FadeInDown.delay(520).springify()}>
            <TouchableOpacity
              style={styles.contactBtn}
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setShowForm(true);
              }}
              activeOpacity={0.8}
            >
              <View style={styles.contactIconWrap}>
                <Ionicons name="mail" size={20} color={Colors.accentWarm} />
              </View>
              <View style={{ flex: 1 }}>
                <TText variant="bodySmall" weight="semibold">Envoyer un message</TText>
                <TText variant="caption" color="tertiary">Réponse sous 24–48h</TText>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
            </TouchableOpacity>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeInDown.delay(0).springify()} style={styles.form}>
            <GlassInput
              label="Sujet"
              value={subject}
              onChangeText={setSubject}
              placeholder="Décris brièvement ton problème"
            />
            <GlassInput
              label="Description"
              value={description}
              onChangeText={setDescription}
              placeholder="Explique le problème en détail…"
              multiline
            />
            <TouchableOpacity
              onPress={handleSend}
              activeOpacity={0.85}
              style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
              disabled={!canSend}
            >
              <LinearGradient
                colors={
                  sent
                    ? [Colors.success, Colors.successLight]
                    : canSend
                    ? [Colors.accentGlow, Colors.accentWarm, '#A06030']
                    : [Colors.bgSubtle, Colors.bgElevated]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <TText
                variant="body"
                weight="bold"
                style={{ color: canSend ? Colors.bgPrimary : Colors.textTertiary }}
              >
                {sent ? '✓ Message envoyé' : 'Envoyer'}
              </TText>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ alignItems: 'center', paddingVertical: Spacing['2xs'] }}
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setShowForm(false);
              }}
            >
              <TText variant="caption" color="tertiary">Annuler</TText>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Social links */}
        <Animated.View entering={FadeInDown.delay(560).springify()}>
          <TText variant="micro" uppercase color="tertiary" style={[styles.sectionLabel, { marginTop: Spacing.xl }]}>
            Retrouve-nous
          </TText>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(580).springify()} style={styles.socialRow}>
          {[
            { icon: 'logo-twitter' as const, label: 'Twitter', url: 'https://twitter.com/inkrapp', color: '#1DA1F2' },
            { icon: 'logo-instagram' as const, label: 'Instagram', url: 'https://instagram.com/inkrapp', color: '#E1306C' },
            { icon: 'logo-discord' as const, label: 'Discord', url: 'https://discord.gg/inkr', color: '#5865F2' },
          ].map(({ icon, label, url, color }) => (
            <TouchableOpacity
              key={label}
              style={styles.socialBtn}
              onPress={() => Linking.openURL(url)}
              activeOpacity={0.75}
            >
              <View style={[styles.socialIcon, { backgroundColor: `${color}18` }]}>
                <Ionicons name={icon} size={20} color={color} />
              </View>
              <TText variant="caption" color="secondary">{label}</TText>
            </TouchableOpacity>
          ))}
        </Animated.View>

        {/* Version footer */}
        <Animated.View entering={FadeInDown.delay(640).springify()} style={styles.footer}>
          <View style={styles.footerDot} />
          <TText variant="caption" color="tertiary" style={{ letterSpacing: 0.5 }}>
            INKR Version 3.0.0
          </TText>
          <View style={styles.footerDot} />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(660).springify()} style={{ alignItems: 'center', marginTop: 4 }}>
          <TText variant="micro" color="tertiary" style={{ letterSpacing: 1 }}>
            Ink meets future ✦
          </TText>
        </Animated.View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSubtle,
  },
  headerBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    paddingHorizontal: Spacing.lg,
  },
  hero: {
    alignItems: 'center',
    padding: Spacing.xl,
    marginTop: Spacing.lg,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.borderGlow,
    overflow: 'hidden',
    marginBottom: Spacing.xl,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.bgSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  heroTitle: {
    marginBottom: Spacing.xs,
    letterSpacing: -0.5,
  },
  sectionLabel: {
    letterSpacing: 1.8,
    fontSize: 9,
    marginBottom: Spacing.xs,
  },
  faqCard: {
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    paddingHorizontal: Spacing.sm,
    overflow: 'hidden',
  },
  contactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    gap: Spacing.sm,
  },
  contactIconWrap: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  form: {
    gap: 0,
  },
  sendBtn: {
    height: 52,
    borderRadius: Radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginTop: Spacing.xs,
    marginBottom: Spacing['2xs'],
    ...GlowShadow.amber,
  },
  sendBtnDisabled: {
    opacity: 0.45,
    ...GlowShadow.none,
  },
  socialRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  socialBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    gap: 6,
  },
  socialIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xl,
    gap: Spacing.sm,
  },
  footerDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.textTertiary,
  },
});
