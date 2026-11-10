import React, { useState } from 'react';
import { ScrollView, StyleSheet, View, Linking, Platform, KeyboardAvoidingView } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import Animated from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Layout } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TButton } from '@/components/ui/TButton';
import { TInput } from '@/components/ui/TInput';
import { TDivider } from '@/components/ui/TDivider';
import { THeader } from '@/components/ui/THeader';
import { PressableScale, fadeIn } from '@/components/motion';

const APP_VERSION = Constants.expoConfig?.version;

// ── FAQ: only describes flows that exist in the app ──────────────
const FAQ_ITEMS = [
  {
    q: 'Comment modifier ou résilier mon abonnement ?',
    a: 'Ouvrez Paramètres, puis Abonnement. Pour changer de moyen de paiement ou résilier, écrivez-nous avec le formulaire ci-dessous.',
  },
  {
    q: 'Comment supprimer mon compte ?',
    a: 'Ouvrez Paramètres, puis Supprimer mon compte, et suivez les étapes de confirmation.',
  },
  {
    q: 'Comment signaler un contenu inapproprié ?',
    a: 'Ouvrez la réalisation concernée, touchez le menu d’options puis Signaler. Chaque signalement est transmis à notre équipe de modération.',
  },
  {
    q: 'Je ne reçois pas de demandes.',
    a: 'Vérifiez que votre disponibilité est sur « Prend des projets » dans votre profil. Si le problème persiste, contactez-nous.',
  },
  {
    q: 'Comment fonctionnent les demandes ?',
    a: 'Le client envoie une demande détaillée à un artiste : style, budget, zone, description. L’artiste accepte, refuse ou demande des précisions. En cas d’accord, la messagerie permet d’organiser le rendez-vous.',
  },
];

const SOCIALS = [
  { icon: 'logo-instagram' as const, label: 'Instagram', url: 'https://instagram.com/inkrapp' },
  { icon: 'logo-twitter' as const, label: 'X (Twitter)', url: 'https://twitter.com/inkrapp' },
  { icon: 'logo-discord' as const, label: 'Discord', url: 'https://discord.gg/inkr' },
];

// ── Accordion item ───────────────────────────────────────────────
function AccordionItem({ question, answer, isOpen, onPress }: {
  question: string; answer: string; isOpen: boolean; onPress: () => void;
}) {
  return (
    <View>
      <PressableScale
        onPress={onPress}
        pressedScale={0.985}
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
        style={styles.faqRow}
      >
        <TText variant="body" weight="medium" style={{ flex: 1 }}>{question}</TText>
        <Ionicons name={isOpen ? 'remove' : 'add'} size={18} color={Colors.textSecondary} />
      </PressableScale>
      {isOpen && (
        <Animated.View entering={fadeIn()}>
          <TText variant="bodySmall" color="secondary" style={styles.faqAnswer}>{answer}</TText>
        </Animated.View>
      )}
    </View>
  );
}

// ── Main screen ──────────────────────────────────────────────────
export default function SupportScreen() {
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
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <THeader title="Aide et support" showBack />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing['2xl'] }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <TText variant="label" color="accentWarm" uppercase>Assistance</TText>
          <TText variant="displayM" style={{ marginTop: 6 }} accessibilityRole="header">
            Comment pouvons-nous <TText variant="displayM" italic color="accentGlow">vous aider</TText> ?
          </TText>
          <TText variant="body" color="secondary" style={{ marginTop: Spacing.xs }}>
            Consultez les questions fréquentes ou écrivez-nous : nous vous répondons par e-mail.
          </TText>
        </View>

        {/* FAQ */}
        <TText variant="label" color="tertiary" uppercase style={styles.sectionLabel}>Questions fréquentes</TText>
        <View style={styles.list}>
          {FAQ_ITEMS.map((item, i) => (
            <React.Fragment key={item.q}>
              {i > 0 && <TDivider />}
              <AccordionItem
                question={item.q}
                answer={item.a}
                isOpen={openFaq === i}
                onPress={() => toggleFaq(i)}
              />
            </React.Fragment>
          ))}
        </View>

        {/* Contact */}
        <TText variant="label" color="tertiary" uppercase style={[styles.sectionLabel, { marginTop: Spacing['2xl'] }]}>
          Contacter le support
        </TText>
        {!showForm ? (
          <PressableScale
            onPress={() => setShowForm(true)}
            pressedScale={0.985}
            accessibilityRole="button"
            accessibilityLabel="Écrire un message au support"
            style={[styles.list, styles.contactRow]}
          >
            <Ionicons name="mail-outline" size={19} color={Colors.accentWarm} style={{ width: 22 }} />
            <View style={{ flex: 1 }}>
              <TText variant="body" weight="medium">Écrire un message</TText>
              <TText variant="caption" color="tertiary">Le message s’ouvre dans votre messagerie</TText>
            </View>
            <Ionicons name="chevron-forward" size={15} color={Colors.textTertiary} />
          </PressableScale>
        ) : (
          <Animated.View entering={fadeIn()}>
            <TInput
              label="Sujet"
              value={subject}
              onChangeText={setSubject}
              placeholder="Résumez votre question en quelques mots"
            />
            <TInput
              label="Description"
              value={description}
              onChangeText={setDescription}
              placeholder="Décrivez la situation : écran concerné, étapes, message d’erreur…"
              multiline
              inputStyle={{ minHeight: 110, textAlignVertical: 'top', paddingTop: 14 }}
              helper={canSend ? undefined : 'Au moins quelques mots dans chaque champ.'}
            />
            <View style={{ gap: 10 }}>
              <TButton
                title={sent ? 'Brouillon ouvert dans votre messagerie' : 'Préparer l’e-mail'}
                onPress={handleSend}
                disabled={!canSend || sent}
                icon={sent ? <Ionicons name="checkmark" size={18} color={Colors.textInverse} /> : undefined}
              />
              <TButton title="Annuler" variant="ghost" onPress={() => setShowForm(false)} />
            </View>
          </Animated.View>
        )}

        {/* Social links */}
        <TText variant="label" color="tertiary" uppercase style={[styles.sectionLabel, { marginTop: Spacing['2xl'] }]}>
          Nous suivre
        </TText>
        <View style={styles.list}>
          {SOCIALS.map(({ icon, label, url }, i) => (
            <React.Fragment key={label}>
              {i > 0 && <TDivider inset={34} />}
              <PressableScale
                onPress={() => { Linking.openURL(url).catch(() => {}); }}
                pressedScale={0.985}
                accessibilityRole="link"
                accessibilityLabel={label}
                style={styles.contactRow}
              >
                <Ionicons name={icon} size={19} color={Colors.textSecondary} style={{ width: 22 }} />
                <TText variant="body" style={{ flex: 1 }}>{label}</TText>
                <Ionicons name="open-outline" size={15} color={Colors.textTertiary} />
              </PressableScale>
            </React.Fragment>
          ))}
        </View>

        {!!APP_VERSION && (
          <TText variant="caption" color="tertiary" tabular style={styles.version}>INKR {APP_VERSION}</TText>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  content: {
    width: '100%', maxWidth: Layout.maxReading + Layout.gutter * 2, alignSelf: 'center',
    paddingHorizontal: Layout.gutter, paddingTop: Spacing.xl,
  },
  hero: { marginBottom: Spacing.xl },
  sectionLabel: { marginBottom: Spacing['2xs'] },
  list: {
    borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderDefault,
  },
  faqRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 12 },
  faqAnswer: { paddingBottom: Spacing.sm, maxWidth: Layout.maxReading },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 10 },
  version: { textAlign: 'center', marginTop: Spacing.xl },
});
