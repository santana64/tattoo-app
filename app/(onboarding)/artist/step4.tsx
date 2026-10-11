import React, { useState } from 'react';
import { View, StyleSheet, Pressable, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Radius } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TInput } from '@/components/ui/TInput';
import { TButton } from '@/components/ui/TButton';
import { OnboardingScreen, OnboardingChip, haptic } from '@/components/OnboardingProgress';
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

type InteractionState = { pressed: boolean; hovered?: boolean };

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
    haptic();
    const s = new Set(exclusions);
    if (s.has(label)) s.delete(label);
    else s.add(label);
    setExclusions(s);
  };

  const handleContinue = () => {
    haptic('success');
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
            <Pressable
              key={opt.value}
              onPress={() => {
                haptic();
                setStatus(opt.value);
              }}
              accessibilityRole="radio"
              accessibilityState={{ checked: isSelected }}
              accessibilityLabel={`${opt.label}. ${opt.description}`}
              style={(state) => {
                const { pressed, hovered } = state as InteractionState;
                return [
                  styles.statusRow,
                  i > 0 && styles.statusDivider,
                  (pressed || hovered) && styles.statusRowActive,
                ];
              }}
            >
              <View style={[styles.statusDot, { backgroundColor: opt.color }]} />
              <View style={styles.statusText}>
                <TText variant="bodySmall" weight="medium" color={isSelected ? 'primary' : 'secondary'}>
                  {opt.label}
                </TText>
                <TText variant="caption" color="tertiary">{opt.description}</TText>
              </View>
              <View style={[styles.radio, isSelected && styles.radioOn]}>
                {isSelected ? <View style={styles.radioInner} /> : null}
              </View>
            </Pressable>
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
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } as object : null),
  },
  statusDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.borderDefault },
  statusRowActive: { backgroundColor: Colors.glassBgMid },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { flex: 1, gap: 2 },
  radio: {
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

  budget: { marginBottom: Spacing.lg },
  budgetInput: { fontVariant: ['tabular-nums'] },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
