import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { TText } from '@/components/ui/TText';
import { THeader } from '@/components/ui/THeader';
import { enterUp } from '@/components/motion';
import { Colors, Spacing, Layout } from '@/constants/theme';

interface Section {
  title: string;
  body: string;
}

const SECTIONS: Section[] = [
  {
    title: 'Responsable du traitement',
    body: 'INKR SAS, contact@inkr.app. Hébergement : Supabase (données stockées en Europe).',
  },
  {
    title: 'Données collectées',
    body: 'Adresse email (authentification), nom d’affichage, ville, préférences stylistiques, photos de profil et posts, historique des demandes et rendez-vous, données d’utilisation anonymisées.',
  },
  {
    title: 'Finalité du traitement',
    body: 'Fonctionnement du service, mise en relation artiste-client, envoi de notifications, amélioration de l’application, prévention de la fraude.',
  },
  {
    title: 'Base légale',
    body: 'Exécution du contrat (art. 6.1.b RGPD) pour les fonctionnalités essentielles. Consentement (art. 6.1.a RGPD) pour les notifications et communications marketing.',
  },
  {
    title: 'Durée de conservation',
    body: 'Données de compte : durée de l’inscription + 3 ans. Données de transaction : 10 ans (obligation légale). Données anonymisées : durée indéterminée.',
  },
  {
    title: 'Vos droits',
    body: 'Conformément au RGPD, vous disposez d’un droit d’accès, de rectification, de suppression, d’opposition et de portabilité. Exercez vos droits via l’application (Paramètres > Confidentialité) ou par email : privacy@inkr.app.',
  },
  {
    title: 'Cookies et traceurs',
    body: 'L’application n’utilise pas de cookies. Des données d’utilisation anonymisées sont collectées pour améliorer l’expérience.',
  },
  {
    title: 'Partage de données',
    body: 'Vos données ne sont jamais vendues. Partage uniquement avec les prestataires nécessaires (Supabase, Stripe pour les paiements).',
  },
  {
    title: 'Modifications',
    body: 'INKR se réserve le droit de modifier cette politique. Vous serez notifié des changements importants.',
  },
  {
    title: 'Contact DPO',
    body: 'privacy@inkr.app — CNIL : www.cnil.fr',
  },
];

export default function PrivacyPolicyScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <THeader title="Confidentialité" showBack />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing['3xl'] }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={enterUp(0)}>
          <TText variant="label" color="accentWarm" uppercase>Informations légales</TText>
          <TText variant="displayL" style={styles.title} accessibilityRole="header">
            Politique de <TText variant="displayL" italic color="accentGlow">confidentialité</TText>
          </TText>
          <TText variant="caption" color="tertiary" tabular style={styles.lastUpdated}>
            Dernière mise à jour : 1er avril 2026
          </TText>
        </Animated.View>

        {SECTIONS.map((section, index) => (
          <View key={section.title} style={styles.section}>
            <TText variant="label" color="accentWarm" tabular style={styles.sectionNum}>
              {String(index + 1).padStart(2, '0')}
            </TText>
            <TText variant="displayS" style={styles.sectionTitle} accessibilityRole="header">
              {section.title}
            </TText>
            <TText variant="body" color="secondary" selectable style={styles.sectionBody}>
              {section.body}
            </TText>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  content: {
    width: '100%', maxWidth: Layout.maxReading + Layout.gutter * 2, alignSelf: 'center',
    paddingHorizontal: Layout.gutter, paddingTop: Spacing.xl,
  },
  title: { marginTop: Spacing['2xs'] },
  lastUpdated: { marginTop: Spacing.xs, marginBottom: Spacing.lg },
  section: {
    paddingTop: Spacing.lg, marginTop: Spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.borderDefault,
  },
  sectionNum: { marginBottom: 6 },
  sectionTitle: { fontSize: 26, lineHeight: 30, marginBottom: Spacing.xs },
  sectionBody: { lineHeight: 27 },
});
