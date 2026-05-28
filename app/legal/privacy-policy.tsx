import React from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { TText } from '@/components/ui/TText';
import { Colors, Spacing } from '@/constants/theme';

interface Section {
  title: string;
  body: string;
}

const SECTIONS: Section[] = [
  {
    title: 'Responsable du traitement',
    body: "INKR SAS, contact@inkr.app. Hébergement : Supabase (données stockées en Europe).",
  },
  {
    title: 'Données collectées',
    body: "Adresse email (authentification), nom d'affichage, ville, préférences stylistiques, photos de profil et posts, historique des demandes et rendez-vous, données d'utilisation anonymisées.",
  },
  {
    title: 'Finalité du traitement',
    body: "Fonctionnement du service, mise en relation artiste-client, envoi de notifications, amélioration de l'application, prévention de la fraude.",
  },
  {
    title: 'Base légale',
    body: "Exécution du contrat (art. 6.1.b RGPD) pour les fonctionnalités essentielles. Consentement (art. 6.1.a RGPD) pour les notifications et communications marketing.",
  },
  {
    title: 'Durée de conservation',
    body: "Données de compte : durée de l'inscription + 3 ans. Données de transaction : 10 ans (obligation légale). Données anonymisées : durée indéterminée.",
  },
  {
    title: 'Vos droits',
    body: "Conformément au RGPD, vous disposez d'un droit d'accès, de rectification, de suppression, d'opposition et de portabilité. Exercez vos droits via l'application (Réglages > Confidentialité) ou par email : privacy@inkr.app.",
  },
  {
    title: 'Cookies et traceurs',
    body: "L'application n'utilise pas de cookies. Des données d'utilisation anonymisées sont collectées pour améliorer l'expérience.",
  },
  {
    title: 'Partage de données',
    body: "Vos données ne sont jamais vendues. Partage uniquement avec les prestataires nécessaires (Supabase, Stripe pour les paiements).",
  },
  {
    title: 'Modifications',
    body: "INKR se réserve le droit de modifier cette politique. Vous serez notifié des changements importants.",
  },
  {
    title: 'Contact DPO',
    body: "privacy@inkr.app — CNIL : www.cnil.fr",
  },
];

export default function PrivacyPolicyScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <TText variant="title2" color="primary" weight="semibold" style={styles.headerTitle}>
          Politique de confidentialité
        </TText>
        {/* Spacer to balance the back button */}
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + Spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Last updated */}
        <TText variant="caption" color="secondary" style={styles.lastUpdated}>
          Dernière mise à jour : 1er avril 2026
        </TText>

        {/* Sections */}
        {SECTIONS.map((section, index) => (
          <View key={section.title}>
            {index > 0 && <View style={styles.divider} />}
            <View style={styles.section}>
              <TText variant="bodySmall" color="primary" weight="semibold" style={styles.sectionTitle}>
                {section.title}
              </TText>
              <TText variant="bodySmall" color="secondary" style={styles.sectionBody}>
                {section.body}
              </TText>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
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
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 36,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.lg,
  },
  lastUpdated: {
    marginBottom: Spacing.lg,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderSubtle,
    marginVertical: Spacing.md,
  },
  section: {
    gap: Spacing['2xs'],
  },
  sectionTitle: {
    marginBottom: Spacing['3xs'],
  },
  sectionBody: {
    lineHeight: 22,
  },
});
