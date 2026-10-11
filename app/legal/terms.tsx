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
    title: 'Objet',
    body: 'INKR est une plateforme de mise en relation entre tatoueurs professionnels et clients. L’application permet la découverte d’artistes, l’envoi de demandes de tatouage et la gestion de rendez-vous.',
  },
  {
    title: 'Inscription et compte',
    body: 'L’accès aux fonctionnalités nécessite la création d’un compte. L’utilisateur s’engage à fournir des informations exactes. Chaque personne ne peut posséder qu’un seul compte.',
  },
  {
    title: 'Utilisation de la plateforme',
    body: 'L’utilisation d’INKR est réservée aux personnes majeures (18 ans ou plus). Il est interdit d’utiliser la plateforme pour publier des contenus illégaux, choquants ou contraires aux bonnes mœurs.',
  },
  {
    title: 'Contenu utilisateur',
    body: 'En publiant du contenu sur INKR, l’utilisateur accorde à INKR une licence non-exclusive d’utilisation. L’utilisateur reste propriétaire de son contenu.',
  },
  {
    title: 'Abonnement Premium',
    body: 'L’abonnement Premium est proposé aux tatoueurs. Il est sans engagement et résiliable à tout moment. Le paiement est effectué via Apple Pay ou carte bancaire.',
  },
  {
    title: 'Responsabilité',
    body: 'INKR agit en qualité d’intermédiaire et ne peut être tenu responsable des actes des tatoueurs ou clients inscrits sur la plateforme.',
  },
  {
    title: 'Résiliation',
    body: 'INKR se réserve le droit de suspendre ou supprimer tout compte en violation des présentes conditions.',
  },
  {
    title: 'Contact',
    body: 'Pour toute question : contact@inkr.app',
  },
];

export default function TermsScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <THeader title="Conditions d’utilisation" showBack />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing['3xl'] }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={enterUp(0)}>
          <TText variant="label" color="accentWarm" uppercase>Informations légales</TText>
          <TText variant="displayL" style={styles.title} accessibilityRole="header">
            Conditions <TText variant="displayL" italic color="accentGlow">d’utilisation</TText>
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
