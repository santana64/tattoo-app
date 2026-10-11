import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Radius } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TInput } from '@/components/ui/TInput';
import { TButton } from '@/components/ui/TButton';
import { OnboardingScreen, OnboardingChip, RadioMark } from '@/components/OnboardingProgress';
import { PressableScale } from '@/components/motion/PressableScale';
import { useAuthStore } from '@/store/auth-store';

const TOTAL = 5;
const STEP = 4;

// Status colors follow the design system: sage = open, amber = waiting, tertiary = closed.
const BOOKING_STATUSES = [
  {
    value: 'open' as const,
    label: 'Disponible',
    description: 'J’accepte de nouveaux projets',
    color: Colors.success,
  },
  {
    value: 'paused' as const,
    label: 'En pause',
    description: 'Temporairement indisponible',
    color: Colors.warning,
  },
  {
    value: 'closed' as const,
    label: 'Fermé',
    description: 'Je ne prends pas de nouvelles demandes',
    color: Colors.textTertiary,
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
  return (
    <TText variant="label" color="tertiary" uppercase style={styles.sectionLabel}>
      {children}
    </TText>
  );
}

export default function ArtistStep4() {
  const router = useRouter();
  const { updateProfile } = useAuthStore();
  const [status, setStatus] = useState<'open' | 'paused' | 'closed'>('open');
  const [minBudget, setMinBudget] = useState('');
  const [exclusions, setExclusions] = useState<Set<string>>(new Set());

  const toggleExclusion = (label: string) => {
    const s = new Set(exclusions);
    if (s.has(label)) s.delete(label);
    else s.add(label);
    setExclusions(s);
  };

  const handleContinue = () => {
    updateProfile({
      bookingStatus: status,
      minBudget: minBudget ? parseInt(minBudget, 10) : undefined,
      exclusions: Array.from(exclusions),
    } as any);
    router.push('/(onboarding)/artist/step5');
  };

  return (
    <OnboardingScreen
      step={STEP}
      total={TOTAL}
      title="Vos conditions"
      accent="de réservation"
      lede="Réglez-les une fois. Vous pourrez les modifier à tout moment."
      onBack={router.canGoBack() ? () => router.back() : undefined}
      keyboard
      footer={<TButton title="Continuer" onPress={handleContinue} />}
    >
      {/* Booking status */}
      <SectionLabel>Disponibilité</SectionLabel>
      <View accessibilityRole="radiogroup" style={styles.statusList}>
        {BOOKING_STATUSES.map((opt, i) => {
          const isSelected = status === opt.value;
          return (
            <PressableScale
              key={opt.value}
              onPress={() => setStatus(opt.value)}
              haptic={!isSelected}
              pressedScale={0.985}
              accessibilityRole="radio"
              accessibilityState={{ checked: isSelected }}
              accessibilityLabel={`${opt.label}. ${opt.description}`}
              style={[styles.statusRow, i > 0 && styles.statusDivider, isSelected && styles.statusRowSelected]}
            >
              <View style={[styles.statusDot, { backgroundColor: opt.color }]} />
              <View style={styles.statusText}>
                <TText variant="bodySmall" weight="medium" color={isSelected ? 'primary' : 'secondary'}>
                  {opt.label}
                </TText>
                <TText variant="caption" color="tertiary">{opt.description}</TText>
              </View>
              <RadioMark selected={isSelected} />
            </PressableScale>
          );
        })}
      </View>

      {/* Minimum budget */}
      <SectionLabel>Budget minimum</SectionLabel>
      <TInput
        label="Montant minimum par projet"
        optional
        value={minBudget}
        onChangeText={(t) => setMinBudget(t.replace(/[^0-9]/g, ''))}
        placeholder="0"
        keyboardType="number-pad"
        maxLength={6}
        inputStyle={styles.budgetInput}
        rightElement={<TText variant="bodySmall" color="accentWarm" weight="medium">€</TText>}
        helper="Laissez vide si vous n’avez pas de minimum."
        containerStyle={styles.budget}
      />

      {/* Exclusions */}
      <SectionLabel>Ce que vous ne faites pas</SectionLabel>
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
  sectionLabel: { marginBottom: Spacing.xs },
  sectionHint: { marginTop: -4, marginBottom: Spacing.xs },

  statusList: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderDefault,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    marginBottom: Spacing.xl,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    minHeight: 60,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  statusDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.borderDefault },
  statusRowSelected: { backgroundColor: Colors.glassBg },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { flex: 1, gap: 2 },

  budget: { marginBottom: Spacing.lg },
  budgetInput: { fontVariant: ['tabular-nums'] },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
