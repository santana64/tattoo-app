import React, { useState } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Spacing } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TInput } from '@/components/ui/TInput';
import { TButton } from '@/components/ui/TButton';
import { Choice, Kicker } from '@/components/v5';
import { OnboardingScreen, OnboardingChip, haptic } from '@/components/OnboardingProgress';
import { useAuthStore } from '@/store/auth-store';
import { Toast } from '@/components/ui/TToast';

const TOTAL = 5;
const STEP = 4;

const BOOKING_STATUSES = [
  {
    value: 'open' as const,
    label: 'Disponible',
    description: 'J’accepte de nouveaux projets',
  },
  {
    value: 'paused' as const,
    label: 'En pause',
    description: 'Temporairement indisponible',
  },
  {
    value: 'closed' as const,
    label: 'Fermé',
    description: 'Je ne prends pas de nouvelles demandes',
  },
];

const EXCLUSION_OPTIONS = [
  'Recouvrement',
  'Couleur seule',
  'Portraits réalistes',
  'Tribal',
  'Old school',
  'Fine line',
  'Aquarelle',
  'Lettering',
  'Biomécanique',
  'Pointillisme',
];

function SectionLabel({ children }: { children: string }) {
  return <Kicker tone="muted" style={styles.sectionLabel}>{children}</Kicker>;
}

export default function ArtistStep4() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const threeUp = width >= 900;
  const { saveArtist } = useAuthStore();
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<'open' | 'paused' | 'closed'>('open');
  const [minBudget, setMinBudget] = useState('');
  const [exclusions, setExclusions] = useState<Set<string>>(new Set());

  const toggleExclusion = (label: string) => {
    const s = new Set(exclusions);
    if (s.has(label)) s.delete(label);
    else s.add(label);
    setExclusions(s);
  };

  const handleContinue = async () => {
    if (saving) return;
    const budget = parseInt(minBudget, 10);
    setSaving(true);
    const { error } = await saveArtist({
      bookingStatus: status,
      minBudget: Number.isFinite(budget) && budget > 0 ? budget : null,
      exclusions: Array.from(exclusions),
    });
    setSaving(false);
    if (error) { Toast.error(error); return; }
    router.push('/(onboarding)/artist/step5');
  };

  return (
    <OnboardingScreen
      audience="artist"
      step={STEP}
      total={TOTAL}
      label="Vos conditions"
      title="Vos conditions"
      accent="de réservation"
      lede="Réglez-les une fois. Vous pourrez les modifier à tout moment."
      onBack={router.canGoBack() ? () => router.back() : undefined}
      keyboard
      footer={<TButton title="Continuer" onPress={() => void handleContinue()} loading={saving} />}
    >
      {/* Booking status */}
      <SectionLabel>01 / Disponibilité</SectionLabel>
      <View accessibilityRole="radiogroup" style={[styles.statusList, threeUp && styles.statusListWide]}>
        {BOOKING_STATUSES.map((opt) => {
          const isSelected = status === opt.value;
          return (
            <Choice
              key={opt.value}
              title={opt.label}
              hint={opt.description}
              selected={isSelected}
              onPress={() => {
                if (!isSelected) haptic();
                setStatus(opt.value);
              }}
              style={threeUp ? styles.statusCellWide : styles.statusCell}
            />
          );
        })}
      </View>

      {/* Minimum budget */}
      <SectionLabel>02 / Budget minimum</SectionLabel>
      <TInput
        label="Montant minimum par projet"
        optional
        value={minBudget}
        onChangeText={(t) => setMinBudget(t.replace(/[^0-9]/g, ''))}
        placeholder="0"
        keyboardType="number-pad"
        maxLength={6}
        inputStyle={styles.budgetInput}
        rightElement={<TText variant="bodySmall" weight="semibold">€</TText>}
        helper="Laissez vide si vous n’avez pas de minimum."
        containerStyle={styles.budget}
      />

      {/* Exclusions */}
      <SectionLabel>03 / Ce que vous ne faites pas</SectionLabel>
      <TText variant="caption" color="tertiary" style={styles.sectionHint}>
        Touchez un type de projet pour l’exclure.
      </TText>
      <View style={styles.chips}>
        {EXCLUSION_OPTIONS.map((label) => (
          <OnboardingChip
            key={label}
            label={label}
            selected={exclusions.has(label)}
            onPress={() => toggleExclusion(label)}
            selectedIcon="close"
            accessibilityLabel={`Je ne fais pas : ${label}`}
          />
        ))}
      </View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  sectionLabel: { marginBottom: Spacing.sm },
  sectionHint: { marginTop: -4, marginBottom: Spacing.sm },

  statusList: { gap: Spacing['2xs'], marginBottom: Spacing.xl },
  statusListWide: { flexDirection: 'row' },
  statusCell: { minHeight: 64 },
  statusCellWide: { flex: 1, minWidth: 0 },

  budget: { marginBottom: Spacing.xl },
  budgetInput: { fontVariant: ['tabular-nums'] },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
