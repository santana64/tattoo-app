import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View, Linking, Alert, Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Radius, Layout } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TButton } from '@/components/ui/TButton';
import { TDivider } from '@/components/ui/TDivider';
import { THeader } from '@/components/ui/THeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { PressableScale, enterUp } from '@/components/motion';
import { useAuthStore } from '@/store/auth-store';
import { supabase } from '@/lib/supabase';

const FREE_FEATURES = [
  { label: 'Profil de base', on: true },
  { label: 'Jusqu’à 10 publications', on: true },
  { label: 'Réception de demandes', on: true },
  { label: 'Messagerie intégrée', on: true },
  { label: 'Statistiques avancées', on: false },
  { label: 'Profil mis en avant', on: false },
  { label: 'Publications illimitées', on: false },
  { label: 'Badge Premium', on: false },
];

const PRO_FEATURES = [
  { label: 'Tout le plan gratuit', on: true },
  { label: 'Publications illimitées', on: true },
  { label: 'Statistiques avancées', on: true },
  { label: 'Profil mis en avant', on: true },
  { label: 'Badge Premium', on: true },
  { label: 'Parcours de conversion', on: true },
  { label: 'Personnalisation du profil', on: true },
  { label: 'Support prioritaire', on: true },
];

const MONTHS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const formatDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
};

function Feature({ label, on }: { label: string; on: boolean }) {
  return (
    <View style={styles.feature} accessible accessibilityLabel={`${label}${on ? ', inclus' : ', non inclus'}`}>
      <Ionicons name={on ? 'checkmark' : 'remove'} size={15} color={on ? Colors.accentWarm : Colors.textTertiary} />
      <TText variant="bodySmall" style={{ color: on ? Colors.textPrimary : Colors.textTertiary, flex: 1 }}>{label}</TText>
    </View>
  );
}

interface SubscriptionInfo {
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  status: string | null;
}

export default function SubscriptionScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const wide = width >= 820;
  const { user, refreshProfile } = useAuthStore();
  const isPremium = user?.artistTier === 'premium';
  const [period, setPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);

  // Real renewal details, read-only (RLS: own artist only).
  useEffect(() => {
    if (!isPremium || !user?.artistId) return;
    let active = true;
    supabase
      .from('subscriptions')
      .select('current_period_end, cancel_at_period_end, status')
      .eq('artist_id', user.artistId)
      .maybeSingle()
      .then(({ data }) => { if (active) setSubscription(data ?? null); });
    return () => { active = false; };
  }, [isPremium, user?.artistId]);

  const handleSubscribe = async () => {
    if (isCheckingOut) return;
    setIsCheckingOut(true);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        // On the web Stripe must come back to this page; native keeps the app scheme defaults.
        body: Platform.OS === 'web' && typeof window !== 'undefined'
          ? {
              period,
              successUrl: `${window.location.origin}/settings/subscription?checkout=success`,
              cancelUrl: `${window.location.origin}/settings/subscription?checkout=cancel`,
            }
          : { period },
      });
      if (error || !data?.url) {
        Alert.alert('Erreur', error?.message ?? 'Impossible de démarrer le paiement. Réessayez.');
        return;
      }
      await Linking.openURL(data.url);
      // After returning from checkout, refresh profile to get updated tier
      await refreshProfile();
    } catch (e: any) {
      Alert.alert('Erreur', e.message ?? 'Une erreur est survenue.');
    } finally {
      setIsCheckingOut(false);
    }
  };

  const monthlyPrice = 19;
  const yearlyTotal = 149;
  const effectiveMonthly = period === 'yearly' ? Math.round(yearlyTotal / 12) : monthlyPrice;
  const yearlySaving = monthlyPrice * 12 - yearlyTotal;
  const yearlyDiscount = Math.round((yearlySaving / (monthlyPrice * 12)) * 100);

  return (
    <View style={styles.container}>
      <THeader title="Abonnement" showBack />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing['2xl'] }]}
        showsVerticalScrollIndicator={false}
      >
        {isPremium ? (
          <Animated.View entering={enterUp(0)} style={styles.hero}>
            <TText variant="label" color="accentWarm" uppercase>Votre abonnement</TText>
            <TText variant="displayL" style={styles.heroTitle}>
              INKR <TText variant="displayL" italic color="accentGlow">Premium</TText>
            </TText>
            <View style={styles.statusLine}>
              <View style={[styles.dot, { backgroundColor: subscription?.cancel_at_period_end ? Colors.warning : Colors.success }]} />
              <TText variant="bodySmall" color="secondary" tabular>
                {subscription?.current_period_end
                  ? subscription.cancel_at_period_end
                    ? `Actif jusqu’au ${formatDate(subscription.current_period_end)}, sans renouvellement`
                    : `Actif · renouvellement le ${formatDate(subscription.current_period_end)}`
                  : 'Actif'}
              </TText>
            </View>
          </Animated.View>
        ) : (
          <Animated.View entering={enterUp(0)} style={styles.hero}>
            <TText variant="label" color="accentWarm" uppercase>INKR Premium</TText>
            <TText variant="displayL" style={styles.heroTitle}>
              Passez à <TText variant="displayL" italic color="accentGlow">Premium</TText>
            </TText>
            <TText variant="body" color="secondary" style={styles.heroSub}>
              Mettez votre profil en avant, suivez vos statistiques et présentez votre travail sans limite.
            </TText>
          </Animated.View>
        )}

        {/* Period toggle */}
        {!isPremium && (
          <Animated.View entering={enterUp(1)} style={styles.periodToggle} accessibilityRole="radiogroup">
            {(['monthly', 'yearly'] as const).map((p) => {
              const active = period === p;
              return (
                <PressableScale
                  key={p}
                  onPress={() => setPeriod(p)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  style={[styles.periodBtn, active && styles.periodBtnActive]}
                >
                  <TText variant="bodySmall" weight="medium" style={{ color: active ? Colors.textInverse : Colors.textSecondary }}>
                    {p === 'monthly' ? 'Mensuel' : 'Annuel'}
                  </TText>
                  {p === 'yearly' && (
                    <TText variant="caption" tabular style={{ color: active ? Colors.textInverse : Colors.accentWarm }}>
                      −{yearlyDiscount} %
                    </TText>
                  )}
                </PressableScale>
              );
            })}
          </Animated.View>
        )}

        {/* Plans */}
        <View style={[styles.plans, wide && styles.plansWide]}>
          <Animated.View entering={enterUp(2)} style={[styles.planFree, wide && { flex: 1 }]}>
            <TText variant="title2" serif style={styles.planName}>Gratuit</TText>
            <View style={styles.priceRow}>
              <TText variant="displayM" tabular>0 €</TText>
              <TText variant="caption" color="tertiary" style={styles.priceUnit}>sans limite de durée</TText>
            </View>
            <TDivider tone="default" style={{ marginVertical: Spacing.sm }} />
            {FREE_FEATURES.map((f) => <Feature key={f.label} label={f.label} on={f.on} />)}
            {!isPremium && (
              <View style={styles.currentPlanTag}>
                <TText variant="caption" color="tertiary">Votre offre actuelle</TText>
              </View>
            )}
          </Animated.View>

          <Animated.View entering={enterUp(3)} style={wide ? { flex: 1 } : undefined}>
            <GlassCard variant="premium" radius={Radius.xl} padding={Spacing.md}>
              <View style={styles.planHead}>
                <TText variant="title2" serif style={styles.planName}>Premium</TText>
                <TText variant="label" color="accentWarm" uppercase>Recommandé</TText>
              </View>
              <View style={styles.priceRow}>
                <TText variant="displayM" tabular color="accentGlow">{effectiveMonthly} €</TText>
                <TText variant="caption" color="tertiary" style={styles.priceUnit}>par mois</TText>
              </View>
              {period === 'yearly' && !isPremium && (
                <TText variant="caption" color="secondary" tabular>
                  Facturé {yearlyTotal} € par an, soit {yearlySaving} € d’économie
                </TText>
              )}
              <TDivider tone="default" style={{ marginVertical: Spacing.sm }} />
              {PRO_FEATURES.map((f) => <Feature key={f.label} label={f.label} on={f.on} />)}
              {!isPremium && (
                <TButton
                  title={period === 'yearly' ? `Passer à Premium · ${yearlyTotal} € par an` : `Passer à Premium · ${monthlyPrice} € par mois`}
                  variant="glow"
                  onPress={handleSubscribe}
                  loading={isCheckingOut}
                  disabled={isCheckingOut}
                  style={{ marginTop: Spacing.md }}
                />
              )}
            </GlassCard>
          </Animated.View>
        </View>

        {/* Manage — no fake card or billing data: route to a human */}
        {isPremium && (
          <View style={styles.manage}>
            <TText variant="label" color="tertiary" uppercase style={{ marginBottom: Spacing['2xs'] }}>Gérer l’abonnement</TText>
            <TText variant="bodySmall" color="secondary" style={{ marginBottom: Spacing.md }}>
              Pour changer de moyen de paiement, obtenir une facture ou résilier, contactez le support : la gestion en libre-service arrive bientôt.
            </TText>
            <TButton
              title="Contacter le support"
              variant="secondary"
              size="md"
              fullWidth={false}
              onPress={() => router.push('/settings/support')}
            />
          </View>
        )}

        <View style={styles.trustRow}>
          {[
            { icon: 'lock-closed-outline' as const, label: 'Paiement sécurisé par Stripe' },
            { icon: 'refresh-outline' as const, label: 'Sans engagement' },
          ].map((t) => (
            <View key={t.label} style={styles.trustItem}>
              <Ionicons name={t.icon} size={14} color={Colors.textTertiary} />
              <TText variant="caption" color="tertiary">{t.label}</TText>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  content: {
    width: '100%', maxWidth: 920, alignSelf: 'center',
    paddingHorizontal: Layout.gutter, paddingTop: Spacing.xl,
  },
  hero: { marginBottom: Spacing.lg, maxWidth: Layout.maxReading },
  heroTitle: { marginTop: 6 },
  heroSub: { marginTop: Spacing.xs },
  statusLine: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: Spacing.xs },
  dot: { width: 6, height: 6, borderRadius: 3 },

  periodToggle: {
    flexDirection: 'row', alignSelf: 'flex-start', gap: 4, padding: 3,
    borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderDefault,
    marginBottom: Spacing.lg,
  },
  periodBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    height: 36, paddingHorizontal: 16, borderRadius: Radius.md,
  },
  periodBtnActive: { backgroundColor: Colors.accentAction },

  plans: { gap: Spacing.md },
  plansWide: { flexDirection: 'row', alignItems: 'stretch' },
  planFree: {
    borderRadius: Radius.xl, padding: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderDefault,
  },
  planHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  planName: { fontSize: 24, lineHeight: 28 },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: Spacing['2xs'] },
  priceUnit: { marginBottom: 7 },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 },
  currentPlanTag: {
    marginTop: Spacing.md, height: 44, borderRadius: Radius.lg,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderDefault,
  },

  manage: {
    marginTop: Spacing.xl, paddingTop: Spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.borderDefault,
    maxWidth: Layout.maxReading,
  },
  trustRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: Spacing.lg, marginTop: Spacing.xl },
  trustItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
