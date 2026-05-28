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
    title: 'Objet',
    body: "INKR est une plateforme de mise en relation entre tatoueurs professionnels et clients. L'application permet la découverte d'artistes, l'envoi de demandes de tatouage et la gestion de rendez-vous.",
  },
  {
    title: 'Inscription et compte',
    body: "L'accès aux fonctionnalités nécessite la création d'un compte. L'utilisateur s'engage à fournir des informations exactes. Chaque personne ne peut posséder qu'un seul compte.",
  },
  {
    title: 'Utilisation de la plateforme',
    body: "L'utilisation d'INKR est réservée aux personnes majeures (18 ans ou plus). Il est interdit d'utiliser la plateforme pour publier des contenus illégaux, choquants ou contraires aux bonnes mœurs.",
  },
  {
    title: 'Contenu utilisateur',
    body: "En publiant du contenu sur INKR, l'utilisateur accorde à INKR une licence non-exclusive d'utilisation. L'utilisateur reste propriétaire de son contenu.",
  },
  {
    title: 'Abonnement Premium',
    body: "L'abonnement Premium est proposé aux tatoueurs. Il est sans engagement et résiliable à tout moment. Le paiement est effectué via Apple Pay ou carte bancaire.",
  },
  {
    title: 'Responsabilité',
    body: "INKR agit en qualité d'intermédiaire et ne peut être tenu responsable des actes des tatoueurs ou clients inscrits sur la plateforme.",
  },
  {
    title: 'Résiliation',
    body: "INKR se réserve le droit de suspendre ou supprimer tout compte en violation des présentes conditions.",
  },
  {
    title: 'Contact',
    body: 'Pour toute question : contact@inkr.app',
  },
];

export default function TermsScreen() {
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
          Conditions d'utilisation
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
