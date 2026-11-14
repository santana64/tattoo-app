import React, { useEffect, useState } from 'react';
import { AppState, ScrollView, StyleSheet, View, Linking, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Layout } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TButton } from '@/components/ui/TButton';
import { THeader } from '@/components/ui/THeader';
import { Toast } from '@/components/ui/TToast';
import { Kicker, PageWrap, Rule, SectionHead, StatusDot } from '@/components/v5';
import { Panel, Segmented } from '@/components/v5/studio';
import { BenefitRow, PremiumHero } from '@/components/v5/premium';
import { useAuthStore } from '@/store/auth-store';
import { useContentDimensions } from '@/hooks/useContentDimensions';
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

interface SubscriptionInfo {
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  status: string | null;
}

export default function SubscriptionScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { checkout } = useLocalSearchParams<{ checkout?: string }>();
  const { width } = useContentDimensions();
  const wide = width >= 820;
  const { user, refreshProfile } = useAuthStore();
  const isPremium = user?.artistTier === 'premium';
  const [period, setPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);

  useEffect(() => {
    if (checkout === 'success') void refreshProfile();
  }, [checkout, refreshProfile]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshProfile();
    });
    return () => listener.remove();
  }, [refreshProfile]);

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
        Toast.error('Impossible de démarrer le paiement. Vérifiez votre connexion puis réessayez.');
        return;
      }
      await Linking.openURL(data.url);
    } catch {
      Toast.error('Le paiement n’a pas pu s’ouvrir. Réessayez.');
    } finally {
      setIsCheckingOut(false);
    }
  };

  const monthlyPrice = 19;
  const yearlyTotal = 149;
  const effectiveMonthly = period === 'yearly' ? Math.round(yearlyTotal / 12) : monthlyPrice;
  const yearlySaving = monthlyPrice * 12 - yearlyTotal;
  const yearlyDiscount = Math.round((yearlySaving / (monthlyPrice * 12)) * 100);

  const statusLine = subscription?.current_period_end
    ? subscription.cancel_at_period_end
      ? `Actif jusqu’au ${formatDate(subscription.current_period_end)}, sans renouvellement`
      : `Actif · renouvellement le ${formatDate(subscription.current_period_end)}`
    : 'Actif';

  return (
    <View style={styles.container}>
      <THeader title="Abonnement" showBack />
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + Spacing['3xl'] }}
        showsVerticalScrollIndicator={false}
      >
        <PageWrap style={{ paddingTop: Spacing.lg }}>
          {checkout === 'success' && (
            <View accessibilityLiveRegion="polite" style={styles.checkoutNotice}>
              <TText variant="bodySmall">{isPremium
                ? 'Votre abonnement Premium est actif.'
                : 'Retour du paiement détecté. L’activation sera visible ici après confirmation par Stripe.'}</TText>
              {!isPremium && <TButton title="Vérifier mon abonnement" variant="secondary" size="md" fullWidth={false} onPress={() => { void refreshProfile(); }} />}
            </View>
          )}
          {(checkout === 'cancel' || checkout === 'cancelled') && (
            <View accessibilityLiveRegion="polite" style={styles.checkoutNotice}>
              <TText variant="bodySmall">Le parcours de paiement a été quitté. Votre statut d’abonnement reste indiqué ci-dessous.</TText>
            </View>
          )}
          {isPremium ? (
            <PremiumHero kicker="Votre abonnement" title="INKR" emphasis="Premium.">
              <View style={styles.statusLine}>
                <StatusDot onInk tone={subscription?.cancel_at_period_end ? 'wait' : 'open'} label="Premium" />
                <TText variant="bodySmall" color="onInkMuted" tabular>{statusLine}</TText>
              </View>
            </PremiumHero>
          ) : (
            <PremiumHero
              kicker="INKR Premium / Édition atelier"
              title="Passez à"
              emphasis="Premium."
              body="Mettez votre profil en avant, suivez vos statistiques et présentez votre travail sans limite."
            />
          )}

          {/* Period toggle */}
          {!isPremium && (
            <View style={styles.period}>
              <Kicker tone="muted">Facturation</Kicker>
              <Segmented
                accessibilityLabel="Période de facturation"
                value={period}
                onChange={setPeriod}
                options={[
                  { value: 'monthly', label: 'Mensuel' },
                  { value: 'yearly', label: 'Annuel', note: `−${yearlyDiscount} %` },
                ]}
              />
            </View>
          )}

          {/* Plans */}
          <View style={[styles.plans, wide && styles.plansWide]}>
            <Panel style={wide ? { flex: 1 } : undefined}>
              <Kicker tone="muted">Offre 01</Kicker>
              <TText variant="displayS" style={styles.planName}>Gratuit</TText>
              <View style={styles.priceRow}>
                <TText variant="displayL" tabular style={styles.price}>0 €</TText>
                <TText variant="caption" color="secondary" style={styles.priceUnit}>sans limite de durée</TText>
              </View>
              <Rule tone="ink" style={{ marginTop: Spacing.md }} />
              {FREE_FEATURES.map((f, i) => <BenefitRow key={f.label} index={i + 1} label={f.label} included={f.on} />)}
              {!isPremium && (
                <View style={styles.currentPlanTag}>
                  <StatusDot tone="closed" label="Votre offre actuelle" />
                </View>
              )}
            </Panel>

            <Panel style={[styles.planPremium, wide && { flex: 1 }]}>
              <View style={styles.planHead}>
                <Kicker tone="flame">Offre 02</Kicker>
                <Kicker tone="flame">Recommandé</Kicker>
              </View>
              <TText variant="displayS" style={styles.planName}>Premium</TText>
              <View style={styles.priceRow}>
                <TText variant="displayL" tabular style={[styles.price, { color: Colors.accentGlow }]}>{effectiveMonthly} €</TText>
                <TText variant="caption" color="secondary" style={styles.priceUnit}>par mois</TText>
              </View>
              {period === 'yearly' && !isPremium && (
                <TText variant="caption" color="secondary" tabular style={{ marginTop: 4 }}>
                  Facturé {yearlyTotal} € par an, soit {yearlySaving} € d’économie
                </TText>
              )}
              <Rule tone="ink" style={{ marginTop: Spacing.md }} />
              {PRO_FEATURES.map((f, i) => <BenefitRow key={f.label} index={i + 1} label={f.label} included={f.on} />)}
              {!isPremium && (
                <TButton
                  title={period === 'yearly' ? `Passer à Premium · ${yearlyTotal} € par an` : `Passer à Premium · ${monthlyPrice} € par mois`}
                  variant="glow"
                  onPress={handleSubscribe}
                  loading={isCheckingOut}
                  disabled={isCheckingOut}
                  style={{ marginTop: Spacing.lg }}
                />
              )}
            </Panel>
          </View>

          {/* Manage — no fake card or billing data: route to a human */}
          {isPremium && (
            <View style={styles.manage}>
              <SectionHead kicker="Gérer l’abonnement" title="Une question" emphasis="de facturation." />
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
                <Ionicons name={t.icon} size={14} color={Colors.textSecondary} />
                <TText variant="caption" color="secondary">{t.label}</TText>
              </View>
            ))}
          </View>
        </PageWrap>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  checkoutNotice: { padding: Spacing.md, borderWidth: 1, borderColor: Colors.line, gap: Spacing.sm },
  statusLine: { gap: 10 },

  period: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between',
    gap: Spacing.sm, marginTop: Spacing.xl,
  },

  plans: { gap: Spacing.md, marginTop: Spacing.xl },
  plansWide: { flexDirection: 'row', alignItems: 'stretch', gap: 17 },
  planPremium: { borderTopWidth: 3, borderTopColor: Colors.flame },
  planHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  planName: { fontSize: 32, lineHeight: 34, letterSpacing: -0.6, marginTop: 10 },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end', flexWrap: 'wrap', gap: 10, marginTop: Spacing.sm },
  price: { fontSize: 64, lineHeight: 62, letterSpacing: -2 },
  priceUnit: { marginBottom: 8 },
  currentPlanTag: {
    marginTop: Spacing.lg, minHeight: 44, justifyContent: 'center', paddingHorizontal: Spacing.sm,
    borderWidth: 1, borderColor: Colors.line,
  },

  manage: {
    marginTop: Spacing['3xl'],
    maxWidth: Layout.maxReading,
  },
  trustRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.lg, marginTop: Spacing['2xl'], paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.line },
  trustItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
