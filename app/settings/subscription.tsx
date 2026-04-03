import React, { useState } from 'react';
import { ScrollView, StyleSheet, View, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Radius, GlowShadow } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { GlassCard } from '@/components/ui/GlassCard';
import { TDivider } from '@/components/ui/TDivider';
import { useAuthStore } from '@/store/auth-store';
import { ARTISTS } from '@/constants/mock-data';

const FREE_FEATURES = [
  { label: 'Profil de base', on: true },
  { label: "Jusqu'à 10 posts", on: true },
  { label: 'Réception de demandes', on: true },
  { label: 'Messagerie intégrée', on: true },
  { label: 'Analytics avancés', on: false },
  { label: 'Profil mis en avant', on: false },
  { label: 'Posts illimités', on: false },
  { label: 'Badge Premium ✦', on: false },
];

const PRO_FEATURES = [
  { label: 'Tout le plan gratuit', on: true },
  { label: 'Posts illimités', on: true },
  { label: 'Analytics avancés', on: true },
  { label: 'Profil mis en avant', on: true },
  { label: 'Badge Premium ✦', on: true },
  { label: 'Stats de conversion', on: true },
  { label: 'Personnalisation profil', on: true },
  { label: 'Support prioritaire', on: true },
];

function Feature({ label, on }: { label: string; on: boolean }) {
  return (
    <View style={styles.feature}>
      <View style={[styles.featureDot, on ? styles.featureDotOn : styles.featureDotOff]}>
        <Ionicons name={on ? 'checkmark' : 'close'} size={11} color={on ? Colors.successLight : Colors.textTertiary} />
      </View>
      <TText variant="caption" style={{ color: on ? Colors.textPrimary : Colors.textTertiary }}>{label}</TText>
    </View>
  );
}

export default function SubscriptionScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuthStore();
  const artist = ARTISTS[0];
  const isPremium = artist?.tier === 'premium';
  const [period, setPeriod] = useState<'monthly' | 'yearly'>('monthly');

  const monthlyPrice = 19;
  const yearlyTotal = 149;
  const effectiveMonthly = period === 'yearly' ? Math.round(yearlyTotal / 12) : monthlyPrice;

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <Animated.View entering={FadeIn.duration(400)} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <TText variant="title1" weight="bold" style={{ letterSpacing: -0.5 }}>Abonnement</TText>
        <View style={{ width: 44 }} />
      </Animated.View>

      {isPremium ? (
        /* Active premium state */
        <Animated.View entering={FadeInDown.delay(80).springify()} style={styles.activeBanner}>
          <LinearGradient colors={['rgba(212,168,100,0.15)', 'rgba(212,168,100,0.04)']} style={StyleSheet.absoluteFill} />
          <View style={styles.activeBannerLeft}>
            <View style={styles.activeIcon}>
              <LinearGradient colors={[Colors.accentGlow, Colors.accentWarm]} style={StyleSheet.absoluteFill} />
              <Ionicons name="star" size={18} color={Colors.bgPrimary} />
            </View>
            <View style={{ marginLeft: 12 }}>
              <TText variant="bodySmall" weight="semibold" style={{ color: Colors.accentWarm }}>Premium actif ✦</TText>
              <TText variant="caption" color="tertiary">Renouvellement le 15 mai 2026</TText>
            </View>
          </View>
          <View style={styles.activeLive} />
        </Animated.View>
      ) : (
        /* Hero upsell */
        <Animated.View entering={FadeInDown.delay(80).springify()} style={styles.hero}>
          <View style={styles.heroIcon}>
            <LinearGradient colors={[Colors.accentGlow, Colors.accentWarm, '#A86030']} style={StyleSheet.absoluteFill} />
            <Ionicons name="star" size={30} color={Colors.bgPrimary} />
          </View>
          <TText variant="displayS" weight="black" style={styles.heroTitle}>Passe à Premium</TText>
          <TText variant="body" color="secondary" style={styles.heroSub}>
            Booste ton profil, analyse tes perfs,{'\n'}attire plus de clients.
          </TText>
        </Animated.View>
      )}

      {/* Period toggle */}
      {!isPremium && (
        <Animated.View entering={FadeInDown.delay(140).springify()} style={styles.periodWrap}>
          <View style={styles.periodToggle}>
            {(['monthly', 'yearly'] as const).map((p) => (
              <TouchableOpacity
                key={p}
                onPress={() => { setPeriod(p); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                style={[styles.periodBtn, period === p && styles.periodBtnActive]}
              >
                <TText variant="caption" weight={period === p ? 'semibold' : 'regular'}
                  style={{ color: period === p ? Colors.textPrimary : Colors.textTertiary }}>
                  {p === 'monthly' ? 'Mensuel' : 'Annuel'}
                </TText>
                {p === 'yearly' && (
                  <View style={styles.saveBadge}>
                    <TText variant="micro" style={{ color: '#fff', fontWeight: '700' }}>-35%</TText>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>
      )}

      {/* Plan cards */}
      <View style={styles.plans}>
        {/* Free plan */}
        <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.planFree}>
          <TText variant="title2" weight="bold">Gratuit</TText>
          <View style={styles.priceRow}>
            <TText variant="displayS" weight="black" style={{ letterSpacing: -1.5 }}>0€</TText>
            <TText variant="caption" color="tertiary" style={styles.priceUnit}>pour toujours</TText>
          </View>
          <TDivider style={{ marginVertical: Spacing.sm }} />
          {FREE_FEATURES.map((f) => <Feature key={f.label} label={f.label} on={f.on} />)}
          {!isPremium && (
            <View style={styles.currentPlanTag}>
              <TText variant="caption" color="tertiary">Plan actuel</TText>
            </View>
          )}
        </Animated.View>

        {/* Premium plan */}
        <Animated.View entering={FadeInDown.delay(270).springify()} style={styles.planPremium}>
          <LinearGradient
            colors={['rgba(212,168,100,0.10)', 'rgba(212,168,100,0.02)']}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.planBadge}>
            <LinearGradient colors={[Colors.accentGlow, Colors.accentWarm]} style={StyleSheet.absoluteFill} />
            <TText variant="micro" style={{ color: Colors.bgPrimary, fontWeight: '700', letterSpacing: 1 }}>RECOMMANDÉ</TText>
          </View>
          <TText variant="title2" weight="bold" style={{ marginTop: Spacing.md }}>Premium</TText>
          <View style={styles.priceRow}>
            <TText variant="displayS" weight="black" style={{ letterSpacing: -1.5, color: Colors.accentWarm }}>
              {effectiveMonthly}€
            </TText>
            <TText variant="caption" color="tertiary" style={styles.priceUnit}>/mois</TText>
          </View>
          {period === 'yearly' && (
            <TText variant="caption" style={{ color: Colors.successLight, marginBottom: Spacing.xs }}>
              Facturé {yearlyTotal}€/an · économise 79€
            </TText>
          )}
          <TDivider style={{ marginVertical: Spacing.sm }} />
          {PRO_FEATURES.map((f) => <Feature key={f.label} label={f.label} on={f.on} />)}
          {!isPremium && (
            <TouchableOpacity
              style={styles.premiumCTA}
              onPress={() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={[Colors.accentGlow, Colors.accentWarm, '#A06030']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <TText variant="bodySmall" weight="bold" style={{ color: Colors.bgPrimary }}>
                {period === 'yearly' ? `Commencer · ${yearlyTotal}€/an` : `Commencer · ${monthlyPrice}€/mois`}
              </TText>
            </TouchableOpacity>
          )}
        </Animated.View>
      </View>

      {/* Manage section for active premium */}
      {isPremium && (
        <Animated.View entering={FadeInDown.delay(320).springify()} style={{ paddingHorizontal: Spacing.sm }}>
          <GlassCard variant="elevated" style={{ padding: Spacing.sm }}>
            <TText variant="label" color="tertiary" uppercase style={{ letterSpacing: 2, marginBottom: Spacing.sm }}>
              Gérer l'abonnement
            </TText>
            {[
              { icon: 'card-outline', label: 'Mode de paiement', right: '••• 4242' },
              { icon: 'receipt-outline', label: 'Historique de facturation', right: '' },
              { icon: 'close-circle-outline', label: "Annuler l'abonnement", right: '', destructive: true },
            ].map((item, i) => (
              <React.Fragment key={item.label}>
                {i > 0 && <TDivider style={{ marginVertical: 2 }} />}
                <TouchableOpacity style={styles.manageRow} onPress={() => {}}>
                  <Ionicons name={item.icon as any} size={18} color={item.destructive ? Colors.errorLight : Colors.textSecondary} />
                  <TText variant="body" style={{ flex: 1, marginLeft: Spacing.sm, color: item.destructive ? Colors.errorLight : Colors.textPrimary }}>
                    {item.label}
                  </TText>
                  {item.right ? <TText variant="caption" color="tertiary">{item.right}</TText> : null}
                  <Ionicons name="chevron-forward" size={13} color={Colors.textTertiary} style={{ marginLeft: 6 }} />
                </TouchableOpacity>
              </React.Fragment>
            ))}
          </GlassCard>
        </Animated.View>
      )}

      {/* Trust signals */}
      <Animated.View entering={FadeIn.delay(500)} style={styles.trustRow}>
        {['🔒 Paiement sécurisé', '↩️ Annulable à tout moment', '🌟 2 400+ artistes'].map((t) => (
          <TText key={t} variant="micro" color="tertiary" style={{ textAlign: 'center' }}>{t}</TText>
        ))}
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing['2xs'], paddingBottom: Spacing.sm,
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },

  activeBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: Spacing.sm, marginBottom: Spacing.md,
    padding: Spacing.sm, borderRadius: Radius.lg, overflow: 'hidden',
    borderWidth: 1, borderColor: Colors.borderGlow,
  },
  activeBannerLeft: { flexDirection: 'row', alignItems: 'center' },
  activeIcon: {
    width: 40, height: 40, borderRadius: 20,
    overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
  },
  activeLive: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.successLight },

  hero: { alignItems: 'center', paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg },
  heroIcon: {
    width: 76, height: 76, borderRadius: 38,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', marginBottom: Spacing.sm,
    ...GlowShadow.amberStrong,
  },
  heroTitle: { letterSpacing: -1.5, textAlign: 'center', marginBottom: Spacing.xs },
  heroSub: { textAlign: 'center', lineHeight: 24 },

  periodWrap: { paddingHorizontal: Spacing.sm, marginBottom: Spacing.md },
  periodToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.bgSurface, borderRadius: Radius.lg,
    padding: 4, borderWidth: 1, borderColor: Colors.borderDefault,
  },
  periodBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 10, gap: 6, borderRadius: Radius.md,
  },
  periodBtnActive: { backgroundColor: Colors.bgSubtle },
  saveBadge: {
    backgroundColor: Colors.successLight, borderRadius: Radius.full,
    paddingHorizontal: 6, paddingVertical: 2,
  },

  plans: { paddingHorizontal: Spacing.sm, gap: Spacing.sm, marginBottom: Spacing.md },
  planFree: {
    backgroundColor: Colors.bgCard ?? Colors.bgElevated,
    borderRadius: Radius.xl, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.borderDefault,
  },
  planPremium: {
    backgroundColor: Colors.bgCard ?? Colors.bgElevated,
    borderRadius: Radius.xl, padding: Spacing.md,
    borderWidth: 1.5, borderColor: Colors.borderGlow,
    overflow: 'hidden', ...GlowShadow.amber,
  },
  planBadge: {
    position: 'absolute', top: 0, right: Spacing.md,
    paddingHorizontal: 12, paddingVertical: 5,
    borderBottomLeftRadius: Radius.sm, borderBottomRightRadius: Radius.sm,
    overflow: 'hidden',
  },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: Spacing['2xs'] },
  priceUnit: { marginLeft: 4, marginBottom: 6, alignSelf: 'flex-end' },
  feature: { flexDirection: 'row', alignItems: 'center', gap: Spacing['2xs'], marginBottom: 8 },
  featureDot: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  featureDotOn: { backgroundColor: 'rgba(16,185,129,0.15)', borderWidth: 1, borderColor: 'rgba(52,211,153,0.25)' },
  featureDotOff: { backgroundColor: Colors.bgSubtle, borderWidth: 1, borderColor: Colors.borderSubtle },
  currentPlanTag: {
    marginTop: Spacing.sm, height: 44, borderRadius: Radius.lg,
    backgroundColor: Colors.bgSubtle, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.borderDefault,
  },
  premiumCTA: {
    marginTop: Spacing.sm, height: 50, borderRadius: Radius.lg,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    ...GlowShadow.amber,
  },
  manageRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 4 },
  trustRow: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.md, padding: Spacing.lg, flexWrap: 'wrap' },
});
