import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TButton } from '@/components/ui/TButton';
import { OnboardingProgress } from '@/components/OnboardingProgress';

export default function ArtistStep5() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + Spacing.md, paddingBottom: insets.bottom + Spacing.lg }]}>
      <OnboardingProgress total={5} current={5} />

      <View style={styles.content}>
        <TText variant="displayL" weight="bold" style={styles.title}>
          Choisis ta formule
        </TText>
        <TText variant="body" color="secondary" style={styles.subtitle}>
          Les deux formules sont payantes. Choisis selon ton niveau d'exigence.
        </TText>

        <View style={styles.plans}>
          <View style={styles.planCard}>
            <View style={styles.planHeader}>
              <TText variant="title1" weight="bold">Normal</TText>
              <View style={styles.priceRow}>
                <TText variant="displayL" weight="bold">12,99€</TText>
                <TText variant="bodySmall" color="secondary">/mois</TText>
              </View>
              <TText variant="caption" color="tertiary">ou 99,99€/an · économise 35%</TText>
            </View>
            <View style={styles.planFeatures}>
              {['Profil artiste complet', 'Galerie + publication', 'Réception de demandes', 'Messagerie contextuelle', 'Agenda', 'Analytics basiques'].map((f) => (
                <View key={f} style={styles.featureRow}>
                  <TText variant="caption" color="secondary">✓  {f}</TText>
                </View>
              ))}
            </View>
            <TButton
              title="Choisir Normal"
              variant="secondary"
              onPress={() => router.replace('/(tabs)')}
              style={{ marginTop: Spacing.sm }}
            />
          </View>

          <View style={[styles.planCard, styles.planPremium]}>
            <View style={styles.premiumBadgeRow}>
              <View style={styles.premiumBadge}>
                <TText variant="label" style={{ color: Colors.accentWarm }}>RECOMMANDÉ</TText>
              </View>
            </View>
            <View style={styles.planHeader}>
              <TText variant="title1" weight="bold">Premium</TText>
              <View style={styles.priceRow}>
                <TText variant="displayL" weight="bold">24,99€</TText>
                <TText variant="bodySmall" color="secondary">/mois</TText>
              </View>
              <TText variant="caption" color="tertiary">ou 189,99€/an · économise 37%</TText>
            </View>
            <View style={styles.planFeatures}>
              {['Tout le Normal +', 'Personnalisation avancée du profil', 'Analytics enrichies', 'Bio et FAQ étendues', 'Manuel de customisation', 'Support prioritaire'].map((f) => (
                <View key={f} style={styles.featureRow}>
                  <TText variant="caption" color="secondary">✓  {f}</TText>
                </View>
              ))}
            </View>
            <TButton
              title="Choisir Premium"
              onPress={() => router.replace('/(tabs)')}
              style={{ marginTop: Spacing.sm }}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
    paddingHorizontal: Spacing.sm,
  },
  content: { flex: 1 },
  title: { marginBottom: Spacing['2xs'], marginHorizontal: Spacing['2xs'] },
  subtitle: { marginBottom: Spacing.lg, lineHeight: 24, marginHorizontal: Spacing['2xs'] },
  plans: { flexDirection: 'row', gap: 8, flex: 1 },
  planCard: {
    flex: 1,
    backgroundColor: Colors.bgElevated,
    borderRadius: 16,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  planPremium: {
    borderColor: 'rgba(200,168,130,0.3)',
  },
  premiumBadgeRow: { marginBottom: Spacing['2xs'] },
  premiumBadge: {
    backgroundColor: 'rgba(200,168,130,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  planHeader: { marginBottom: Spacing.sm },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginTop: 4 },
  planFeatures: { flex: 1 },
  featureRow: { marginBottom: 6 },
});
