import React, { useState } from 'react';
import { View, StyleSheet, Pressable, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TButton } from '@/components/ui/TButton';
import { OnboardingScreen, haptic } from '@/components/OnboardingProgress';
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
type InteractionState = { pressed: boolean; hovered?: boolean };

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
    <Pressable
      onPress={onSelect}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={premium ? 'Formule Premium' : 'Formule gratuite'}
      style={(state) => {
        const { pressed, hovered } = state as InteractionState;
        return [
          styles.card,
          selected && (premium ? styles.cardPremiumSelected : styles.cardSelected),
          (pressed || hovered) && !selected && styles.cardHover,
        ];
      }}
    >
      <View style={[styles.radio, selected && styles.radioOn]}>
        {selected ? <View style={styles.radioInner} /> : null}
      </View>
      {children}
    </Pressable>
  );
}

export default function ArtistStep5() {
  const router = useRouter();
  const { completeOnboarding } = useAuthStore();
  const [selected, setSelected] = useState<Plan>('premium');
  const [busy, setBusy] = useState<Plan | null>(null);

  const handleFree = async () => {
    haptic('success');
    await completeOnboarding();
    router.replace('/(tabs)');
  };

  const handlePremium = async () => {
    haptic('success');
    await completeOnboarding();
    router.replace('/settings/subscription');
  };

  // Guard against double taps while the profile is being saved.
  const run = (plan: Plan, action: () => Promise<void>) => async () => {
    if (busy) return;
    setBusy(plan);
    try {
      await action();
    } finally {
      setBusy(null);
    }
  };

  const select = (plan: Plan) => {
    haptic();
    setSelected(plan);
  };

  return (
    <OnboardingScreen
      step={STEP}
      total={TOTAL}
      title="Choisissez"
      accent="votre formule"
      lede="Vous pourrez en changer à tout moment depuis vos réglages."
      onBack={router.canGoBack() ? () => router.back() : undefined}
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
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } as object : null),
  },
  cardHover: { backgroundColor: Colors.bgElevated },
  cardSelected: { borderColor: Colors.accent },
  cardPremiumSelected: { borderColor: Colors.borderGlow, backgroundColor: Colors.bgElevated },

  radio: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.borderGlass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: Colors.accentAction },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.accentAction },

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
