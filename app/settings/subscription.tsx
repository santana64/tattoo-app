import React from 'react';
import { ScrollView, StyleSheet, View, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Radius } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TBadge } from '@/components/ui/TBadge';
import { TButton } from '@/components/ui/TButton';
import { TDivider } from '@/components/ui/TDivider';
import { useAuthStore } from '@/store/auth-store';

const BILLING_HISTORY = [
  { date: '01/04/2026', amount: '24,99€', plan: 'Premium Mensuel', status: 'Payé' },
  { date: '01/03/2026', amount: '24,99€', plan: 'Premium Mensuel', status: 'Payé' },
  { date: '01/02/2026', amount: '24,99€', plan: 'Premium Mensuel', status: 'Payé' },
];

export default function SubscriptionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const isPremium = user?.artistTier === 'premium';

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <TText variant="title2">Abonnement</TText>
        <View style={{ width: 44 }} />
      </View>

      {/* Current plan */}
      <View style={styles.currentPlan}>
        <View style={styles.planHeader}>
          <TText variant="title1" weight="bold">
            {isPremium ? 'Premium' : 'Normal'}
          </TText>
          <TBadge label="Actif" variant="success" dot />
        </View>
        <View style={styles.planPrice}>
          <TText variant="displayL" weight="bold">
            {isPremium ? '24,99€' : '12,99€'}
          </TText>
          <TText variant="bodySmall" color="secondary">/mois</TText>
        </View>
        <TText variant="caption" color="secondary">
          Prochain renouvellement : 1er mai 2026
        </TText>
      </View>

      <View style={styles.actions}>
        {!isPremium && (
          <TButton
            title="Passer au Premium"
            onPress={() => {}}
            style={{ marginBottom: Spacing['2xs'] }}
          />
        )}
        <TButton
          title="Restaurer les achats"
          variant="secondary"
          onPress={() => {}}
          style={{ marginBottom: Spacing['2xs'] }}
        />
        <TouchableOpacity style={styles.cancelLink}>
          <TText variant="bodySmall" color="tertiary">Annuler l'abonnement</TText>
        </TouchableOpacity>
      </View>

      <TDivider style={styles.divider} />

      {/* Billing history */}
      <View style={styles.section}>
        <TText variant="caption" color="secondary" style={styles.sectionTitle}>
          HISTORIQUE DE PAIEMENTS
        </TText>
        {BILLING_HISTORY.map((item, i) => (
          <View key={i} style={styles.billingRow}>
            <View style={{ flex: 1 }}>
              <TText variant="bodySmall">{item.plan}</TText>
              <TText variant="caption" color="tertiary">{item.date}</TText>
            </View>
            <TText variant="bodySmall" weight="semibold">{item.amount}</TText>
            <TBadge label={item.status} variant="success" style={{ marginLeft: 8 }} />
          </View>
        ))}
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
  currentPlan: {
    padding: Spacing.lg,
    backgroundColor: Colors.bgElevated,
    margin: Spacing.sm,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  planHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing['2xs'] },
  planPrice: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginBottom: Spacing['3xs'] },
  actions: { paddingHorizontal: Spacing.sm },
  cancelLink: { alignItems: 'center', paddingVertical: Spacing['2xs'] },
  divider: { marginHorizontal: Spacing.sm, marginTop: Spacing.sm },
  section: { padding: Spacing.sm },
  sectionTitle: { marginBottom: Spacing['2xs'] },
  billingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing['2xs'],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSubtle,
  },
});
