import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TButton } from '@/components/ui/TButton';
import { OnboardingScreen, RadioMark, useOnboardingFinale } from '@/components/OnboardingProgress';
import { PressableScale } from '@/components/motion/PressableScale';
import { useAuthStore } from '@/store/auth-store';

const TOTAL = 5;
const STEP = 5;

// Same prices and feature set as app/settings/subscription.tsx (the checkout screen).
const MONTHLY_PRICE = 19;
const YEARLY_PRICE = 149;

const FREE_FEATURES = [
  'Profil artiste',
  'Réception de demandes',
  'Messagerie intégrée',
];

const PREMIUM_FEATURES = [
  'Tout le plan gratuit',
  'Posts illimités',
  'Profil mis en avant',
  'Analytics avancés',
  'Personnalisation du profil',
];

type Plan = 'free' | 'premium';

function FeatureRow({ text, premium }: { text: string; premium?: boolean }) {
  return (
    <View style={styles.featureRow}>
      <Ionicons name="checkmark" size={14} color={premium ? Colors.accentWarm : Colors.textTertiary} />
      <TText variant="bodySmall" color={premium ? 'primary' : 'secondary'} style={styles.featureText}>
        {text}
      </TText>
    </View>
  );
}

function PlanCard({
  plan,
  selected,
  onSelect,
  children,
}: {
  plan: Plan;
  selected: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  const premium = plan === 'premium';
  return (
    <PressableScale
      onPress={onSelect}
      haptic={!selected}
      pressedScale={0.985}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={premium ? 'Formule Premium' : 'Formule gratuite'}
      style={[styles.card, selected && (premium ? styles.cardPremiumSelected : styles.cardSelected)]}
    >
      <View style={styles.radioSlot}>
        <RadioMark selected={selected} />
      </View>
      {children}
    </PressableScale>
  );
}

export default function ArtistStep5() {
  const router = useRouter();
  const { completeOnboarding } = useAuthStore();
  const [selected, setSelected] = useState<Plan>('premium');
  const [busy, setBusy] = useState<Plan | null>(null);
  const finale = useOnboardingFinale();

  const handleFree = async () => {
    await completeOnboarding();
    router.replace('/(tabs)');
  };

  const handlePremium = async () => {
    await completeOnboarding();
    router.replace('/settings/subscription');
  };

  // Rare moment: a short welcome, then the original handler. Guards against double taps.
  const run = (plan: Plan, action: () => Promise<void>) => () => {
    if (busy) return;
    setBusy(plan);
    finale.celebrate(
      { title: 'Bienvenue', accent: 'dans l’atelier.', lede: 'Votre profil d’artiste est prêt.' },
      () => { void action().finally(() => setBusy(null)); },
    );
  };

  const select = (plan: Plan) => setSelected(plan);

  return (
    <OnboardingScreen
      step={STEP}
      total={TOTAL}
      title="Choisissez"
      accent="votre formule"
      lede="Vous pourrez en changer à tout moment depuis vos réglages."
      onBack={router.canGoBack() ? () => router.back() : undefined}
      overlay={finale.overlay}
      footer={
        selected === 'premium' ? (
          <>
            <TButton
              title="Continuer avec Premium"
              variant="glow"
              loading={busy === 'premium'}
              disabled={!!busy}
              onPress={run('premium', handlePremium)}
            />
            <TButton
              title="Commencer gratuitement"
              variant="ghost"
              size="md"
              loading={busy === 'free'}
              disabled={!!busy}
              onPress={run('free', handleFree)}
            />
          </>
        ) : (
          <TButton
            title="Commencer gratuitement"
            loading={busy === 'free'}
            disabled={!!busy}
            onPress={run('free', handleFree)}
          />
        )
      }
    >
      <View accessibilityRole="radiogroup" style={styles.cards}>
        <PlanCard plan="free" selected={selected === 'free'} onSelect={() => select('free')}>
          <TText variant="title2" weight="semibold" style={styles.planName}>Gratuit</TText>
          <View style={styles.priceRow}>
            <TText variant="displayS" tabular>{'0 €'}</TText>
            <TText variant="caption" color="tertiary" style={styles.priceUnit}>sans engagement</TText>
          </View>
          <View style={styles.divider} />
          {FREE_FEATURES.map((f) => <FeatureRow key={f} text={f} />)}
        </PlanCard>

        <PlanCard plan="premium" selected={selected === 'premium'} onSelect={() => select('premium')}>
          <TText variant="label" color="accentWarm" uppercase style={styles.kicker}>Recommandé</TText>
          <TText variant="title2" weight="semibold" style={styles.planName}>Premium</TText>
          <View style={styles.priceRow}>
            <TText variant="displayS" color="accentGlow" tabular>{`${MONTHLY_PRICE} €`}</TText>
            <TText variant="caption" color="tertiary" style={styles.priceUnit}>par mois</TText>
          </View>
          <TText variant="caption" color="tertiary" tabular>{`ou ${YEARLY_PRICE} € par an`}</TText>
          <View style={styles.divider} />
          {PREMIUM_FEATURES.map((f) => <FeatureRow key={f} text={f} premium />)}
        </PlanCard>
      </View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  cards: { gap: Spacing.xs },
  card: {
    padding: Spacing.md,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    backgroundColor: Colors.bgCard,
  },
  cardSelected: { borderColor: Colors.accent },
  cardPremiumSelected: { borderColor: Colors.borderGlow, backgroundColor: Colors.bgElevated },

  radioSlot: { position: 'absolute', top: Spacing.md, right: Spacing.md },

  kicker: { marginBottom: 6 },
  planName: { marginBottom: 4, paddingRight: 32 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  priceUnit: { marginBottom: 2 },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.borderDefault,
    marginVertical: Spacing.sm,
  },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 28 },
  featureText: { flex: 1 },
});
