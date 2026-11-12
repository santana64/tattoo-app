import React, { useState } from 'react';
import { ScrollView, StyleSheet, View, Linking, Platform, KeyboardAvoidingView, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Layout } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TButton } from '@/components/ui/TButton';
import { TInput } from '@/components/ui/TInput';
import { THeader } from '@/components/ui/THeader';
import { Kicker, Masthead, SettingRow, TextLink } from '@/components/v5';
import { SETTINGS_PANE, SettingsSection } from '@/components/v5/SettingsParts';
import { useContentDimensions } from '@/hooks/useContentDimensions';

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
  { label: 'Instagram', url: 'https://instagram.com/inkrapp' },
  { label: 'X (Twitter)', url: 'https://twitter.com/inkrapp' },
  { label: 'Discord', url: 'https://discord.gg/inkr' },
];

// ── Accordion item: numbered question, answer underneath ─────────
type Hover = { pressed: boolean; hovered?: boolean };

function AccordionItem({ number, question, answer, isOpen, onPress }: {
  number: string; question: string; answer: string; isOpen: boolean; onPress: () => void;
}) {
  return (
    <View style={styles.faqItem}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
        style={[styles.faqRow, Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null]}
      >
        {(state) => {
          const lit = (state as Hover).hovered || (state as Hover).pressed;
          return (
            <>
              <Kicker tone="flame" style={styles.faqNumber}>{number}</Kicker>
              <TText
                variant="displayS"
                style={[styles.faqQuestion, { color: lit ? Colors.flameText : Colors.ink }]}
              >
                {question}
              </TText>
              <Ionicons name={isOpen ? 'remove' : 'add'} size={18} color={Colors.ink} />
            </>
          );
        }}
      </Pressable>
      {isOpen && (
        <TText variant="bodySmall" color="secondary" style={styles.faqAnswer}>{answer}</TText>
      )}
    </View>
  );
}

// ── Main screen ──────────────────────────────────────────────────
export default function SupportScreen() {
  const insets = useSafeAreaInsets();
  const { isWide, gutter } = useContentDimensions();
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
    // Support is reached by e-mail: open a pre-filled draft in the mail app.
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
        contentContainerStyle={[styles.content, { paddingHorizontal: gutter, paddingBottom: insets.bottom + Spacing['3xl'] }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Masthead
          kicker="Assistance"
          title="Comment pouvons-nous"
          emphasis="vous aider ?"
          description="Consultez les questions fréquentes ou écrivez-nous : nous vous répondons par e-mail."
        />

        <View style={styles.pane}>
          {/* FAQ */}
          <SettingsSection number="01" title="Questions fréquentes" style={styles.firstSection}>
            {FAQ_ITEMS.map((item, i) => (
              <AccordionItem
                key={item.q}
                number={String(i + 1).padStart(2, '0')}
                question={item.q}
                answer={item.a}
                isOpen={openFaq === i}
                onPress={() => toggleFaq(i)}
              />
            ))}
          </SettingsSection>

          {/* Contact */}
          <SettingsSection number="02" title="Contacter le support">
            {!showForm ? (
              <SettingRow
                title="Écrire un message"
                description="Le message s’ouvre dans votre messagerie"
                accessibilityLabel="Écrire un message au support"
                onPress={() => setShowForm(true)}
              />
            ) : (
              <View style={styles.form}>
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
                  inputStyle={{ minHeight: 120, textAlignVertical: 'top', paddingTop: 14 }}
                  helper={canSend ? undefined : 'Au moins quelques mots dans chaque champ.'}
                />
                <View style={[styles.formActions, isWide && styles.formActionsWide]}>
                  <TButton
                    title={sent ? 'Brouillon ouvert dans votre messagerie' : 'Préparer l’e-mail'}
                    onPress={handleSend}
                    disabled={!canSend || sent}
                    fullWidth={!isWide}
                    icon={sent ? <Ionicons name="checkmark" size={18} color={Colors.textInverse} /> : undefined}
                  />
                  <TButton title="Annuler" variant="ghost" fullWidth={!isWide} onPress={() => setShowForm(false)} />
                </View>
              </View>
            )}
          </SettingsSection>

          {/* Social links */}
          <SettingsSection number="03" title="Nous suivre">
            <View style={styles.socials}>
              {SOCIALS.map(({ label, url }) => (
                <TextLink
                  key={label}
                  label={label}
                  icon="open-outline"
                  accessibilityLabel={label}
                  onPress={() => { Linking.openURL(url).catch(() => {}); }}
                  style={styles.social}
                />
              ))}
            </View>
          </SettingsSection>

          {!!APP_VERSION && (
            <Kicker tone="muted" style={styles.version}>{`Inkr ${APP_VERSION}`}</Kicker>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.paper },
  content: { width: '100%', maxWidth: Layout.maxContent, alignSelf: 'center' },
  pane: { width: '100%', maxWidth: SETTINGS_PANE },
  firstSection: { marginTop: 0 },

  faqItem: { borderBottomWidth: 1, borderBottomColor: Colors.line },
  faqRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, minHeight: 64, paddingVertical: Spacing.sm },
  faqNumber: { width: 22 },
  faqQuestion: { flex: 1, fontSize: 22, lineHeight: 26, letterSpacing: -0.3 },
  faqAnswer: { paddingLeft: 22 + Spacing.sm, paddingRight: Spacing.lg, paddingBottom: Spacing.md, lineHeight: 22, maxWidth: Layout.maxReading },

  form: { paddingTop: Spacing.md },
  formActions: { gap: 10 },
  formActionsWide: { flexDirection: 'row', flexWrap: 'wrap' },

  socials: { flexDirection: 'row', flexWrap: 'wrap', columnGap: Spacing.lg, paddingTop: Spacing.sm },
  social: { minHeight: 44 },
  version: { marginTop: Spacing['2xl'] },
});
