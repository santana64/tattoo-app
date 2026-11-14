import React, { useState } from 'react';
import { View, StyleSheet, Pressable, Platform, useWindowDimensions, StyleProp, ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, Spacing } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TButton } from '@/components/ui/TButton';
import { Kicker } from '@/components/v5';
import { OnboardingScreen, haptic, useOnboardingFinale } from '@/components/OnboardingProgress';
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

type Hover = { pressed: boolean; hovered?: boolean };
const webPointer = Platform.OS === 'web'
  ? ({ cursor: 'pointer', transitionProperty: 'background-color, border-color', transitionDuration: '180ms' } as object)
  : null;

function FeatureRow({ text, premium }: { text: string; premium?: boolean }) {
  return (
    <View style={styles.featureRow}>
      <Ionicons name="checkmark" size={14} color={premium ? Colors.flameText : Colors.textSecondary} />
      <TText variant="bodySmall" color={premium ? 'primary' : 'secondary'} style={styles.featureText}>
        {text}
      </TText>
    </View>
  );
}

/** Plan cell: white sheet, hairline; selected = vermilion border, soft vermilion ground, corner mark. */
function PlanCard({
  plan,
  selected,
  onSelect,
  style,
  children,
}: {
  plan: Plan;
  selected: boolean;
  onSelect: () => void;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const premium = plan === 'premium';
  return (
    <Pressable
      onPress={() => {
        if (!selected) haptic();
        onSelect();
      }}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      aria-checked={Platform.OS === 'web' ? selected : undefined}
      accessibilityLabel={premium ? 'Formule Premium' : 'Formule gratuite'}
      style={(state) => [
        styles.card,
        webPointer,
        ((state as Hover).hovered || selected) && styles.cardSelected,
        style,
      ]}
    >
      {selected ? <View style={styles.cardMark} /> : null}
      {children}
    </Pressable>
  );
}

export default function ArtistStep5() {
  const router = useRouter();
  const { completeOnboarding } = useAuthStore();
  const [selected, setSelected] = useState<Plan>('premium');
  const [busy, setBusy] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const finale = useOnboardingFinale();

  const run = (plan: Plan) => async () => {
    if (busy) return;
    setBusy(plan);
    setError(null);
    try {
      const completed = await completeOnboarding();
      if (completed.error) { setError(completed.error); return; }
      finale.celebrate(
        { title: 'Bienvenue', accent: 'dans l’atelier.', lede: 'Votre profil d’artiste est prêt.' },
        () => router.replace(plan === 'premium' ? '/settings/subscription' : '/(tabs)'),
      );
    } catch {
      setError('Enregistrement impossible. Vérifiez votre connexion.');
    } finally {
      setBusy(null);
    }
  };

  const select = (plan: Plan) => setSelected(plan);
  const { width } = useWindowDimensions();
  const twoUp = width >= 900;

  return (
    <OnboardingScreen
      audience="artist"
      step={STEP}
      total={TOTAL}
      label="Votre formule"
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
              disabled={!!busy || finale.active}
              onPress={() => { void run('premium')(); }}
            />
            <TButton
              title="Commencer gratuitement"
              variant="ghost"
              size="md"
              loading={busy === 'free'}
              disabled={!!busy || finale.active}
              onPress={() => { void run('free')(); }}
            />
          </>
        ) : (
          <TButton
            title="Commencer gratuitement"
            loading={busy === 'free'}
            disabled={!!busy || finale.active}
            onPress={() => { void run('free')(); }}
          />
        )
      }
    >
      {!!error && <TText variant="bodySmall" color="error" accessibilityRole="alert">{error}</TText>}
      <View accessibilityRole="radiogroup" style={[styles.cards, twoUp && styles.cardsWide]}>
        <PlanCard plan="free" selected={selected === 'free'} onSelect={() => select('free')} style={twoUp ? styles.cardWide : undefined}>
          <Kicker tone="muted" style={styles.kicker}>01 / Gratuit</Kicker>
          <TText variant="displayS" style={styles.planName}>Gratuit</TText>
          <View style={styles.priceRow}>
            <TText variant="displayM" tabular style={styles.price}>{'0 €'}</TText>
            <TText variant="caption" color="secondary">sans engagement</TText>
          </View>
          <View style={styles.divider} />
          {FREE_FEATURES.map((f) => <FeatureRow key={f} text={f} />)}
        </PlanCard>

        <PlanCard plan="premium" selected={selected === 'premium'} onSelect={() => select('premium')} style={twoUp ? styles.cardWide : undefined}>
          <Kicker tone="flame" style={styles.kicker}>02 / Recommandé</Kicker>
          <TText variant="displayS" style={styles.planName}>Premium</TText>
          <View style={styles.priceRow}>
            <TText variant="displayM" tabular style={[styles.price, { color: Colors.accentGlow }]}>{`${MONTHLY_PRICE} €`}</TText>
            <TText variant="caption" color="secondary">par mois</TText>
          </View>
          <TText variant="caption" color="secondary" tabular>{`ou ${YEARLY_PRICE} € par an`}</TText>
          <View style={styles.divider} />
          {PREMIUM_FEATURES.map((f) => <FeatureRow key={f} text={f} premium />)}
        </PlanCard>
      </View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  cards: { gap: Spacing.xs },
  cardsWide: { flexDirection: 'row', alignItems: 'stretch' },
  card: {
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.line,
    backgroundColor: Colors.white,
  },
  cardWide: { flex: 1, minWidth: 0 },
  cardSelected: { borderColor: Colors.flame, backgroundColor: Colors.flameSoft },
  cardMark: { position: 'absolute', top: 0, right: 0, width: 10, height: 10, backgroundColor: Colors.flame },

  kicker: { marginBottom: Spacing.sm },
  planName: { marginBottom: 6 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 },
  price: { fontSize: 40, lineHeight: 42 },
  divider: { height: 1, backgroundColor: Colors.line, marginVertical: Spacing.sm },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 28 },
  featureText: { flex: 1 },
});
