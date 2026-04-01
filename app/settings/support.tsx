import React, { useState } from 'react';
import { ScrollView, StyleSheet, View, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Radius } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TInput } from '@/components/ui/TInput';
import { TButton } from '@/components/ui/TButton';
import { TDivider } from '@/components/ui/TDivider';

const FAQ = [
  { q: 'Comment modifier mon abonnement ?', a: 'Va dans Paramètres → Abonnement. Tu peux upgrader, downgrader ou annuler depuis cet écran.' },
  { q: 'Comment supprimer mon compte ?', a: 'Va dans Paramètres → Supprimer mon compte. Un délai de 30 jours te permet de changer d\'avis.' },
  { q: 'Comment signaler un contenu inapproprié ?', a: 'Appuie longuement sur un post ou utilise le menu ··· pour accéder à l\'option Signaler.' },
  { q: 'Je n\'arrive pas à recevoir de demandes.', a: 'Vérifie que ton statut de disponibilité est sur "Ouvert" dans ton profil, et que ton abonnement est actif.' },
  { q: 'Comment restaurer mon abonnement ?', a: 'Va dans Paramètres → Abonnement → Restaurer les achats.' },
];

export default function SupportScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <TText variant="title2">Aide et support</TText>
        <View style={{ width: 44 }} />
      </View>

      {/* FAQ */}
      <View style={styles.section}>
        <TText variant="caption" color="secondary" style={styles.sectionTitle}>QUESTIONS FRÉQUENTES</TText>
        {FAQ.map((item, i) => (
          <TouchableOpacity
            key={i}
            style={styles.faqItem}
            onPress={() => setOpenFaq(openFaq === i ? null : i)}
            activeOpacity={0.8}
          >
            <View style={styles.faqRow}>
              <TText variant="bodySmall" weight="semibold" style={{ flex: 1 }}>
                {item.q}
              </TText>
              <Ionicons
                name={openFaq === i ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={Colors.textTertiary}
              />
            </View>
            {openFaq === i && (
              <TText variant="bodySmall" color="secondary" style={styles.faqAnswer}>
                {item.a}
              </TText>
            )}
          </TouchableOpacity>
        ))}
      </View>

      <TDivider style={styles.divider} />

      {/* Contact */}
      <View style={styles.section}>
        <TText variant="caption" color="secondary" style={styles.sectionTitle}>CONTACTER LE SUPPORT</TText>

        {!showForm ? (
          <TouchableOpacity style={styles.contactBtn} onPress={() => setShowForm(true)}>
            <Ionicons name="mail-outline" size={22} color={Colors.accent} />
            <View style={{ marginLeft: Spacing.sm }}>
              <TText variant="bodySmall" weight="semibold">Envoyer un message</TText>
              <TText variant="caption" color="tertiary">Réponse sous 24-48h</TText>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>
        ) : (
          <View style={styles.form}>
            <TInput label="Sujet" value={subject} onChangeText={setSubject} placeholder="Décris brièvement ton problème" />
            <TInput
              label="Description"
              value={description}
              onChangeText={setDescription}
              placeholder="Explique le problème en détail..."
              multiline
              numberOfLines={5}
              inputStyle={{ height: 120, textAlignVertical: 'top', paddingTop: 8 }}
            />
            <TButton
              title="Envoyer"
              onPress={() => setShowForm(false)}
              disabled={!subject.trim() || !description.trim()}
            />
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSubtle,
  },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  section: { padding: Spacing.sm },
  sectionTitle: { marginBottom: Spacing['2xs'] },
  faqItem: {
    paddingVertical: Spacing['2xs'],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSubtle,
  },
  faqRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  faqAnswer: { marginTop: Spacing['2xs'], lineHeight: 20, paddingBottom: 4 },
  divider: { marginHorizontal: Spacing.sm },
  contactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  form: { gap: Spacing['2xs'] },
});
