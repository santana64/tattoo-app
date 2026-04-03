import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Radius, GlowShadow } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { Logo } from '@/components/ui/Logo';
import { useAuthStore } from '@/store/auth-store';

const TOTAL = 5;
const STEP = 4;

const BOOKING_STATUSES = [
  {
    value: 'open' as const,
    label: 'Disponible',
    description: "J'accepte de nouveaux projets",
    icon: 'checkmark-circle' as const,
    color: Colors.success,
    borderColor: 'rgba(16,185,129,0.4)',
    bgColor: 'rgba(16,185,129,0.06)',
  },
  {
    value: 'paused' as const,
    label: 'En pause',
    description: 'Temporairement indisponible',
    icon: 'pause-circle' as const,
    color: Colors.warning,
    borderColor: 'rgba(245,158,11,0.4)',
    bgColor: 'rgba(245,158,11,0.06)',
  },
  {
    value: 'closed' as const,
    label: 'Fermé',
    description: 'Pas de nouvelles demandes',
    icon: 'close-circle' as const,
    color: Colors.error,
    borderColor: 'rgba(239,68,68,0.4)',
    bgColor: 'rgba(239,68,68,0.06)',
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

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 5 }}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            { height: 4, borderRadius: 2 },
            i === current - 1
              ? { width: 22, backgroundColor: Colors.accentWarm }
              : i < current
              ? { width: 12, backgroundColor: Colors.accentWarm, opacity: 0.4 }
              : { width: 12, backgroundColor: Colors.borderDefault },
          ]}
        />
      ))}
    </View>
  );
}

function ExclusionChip({
  label,
  selected,
  onPress,
  index,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  index: number;
}) {
  return (
    <Animated.View entering={FadeInDown.delay(600 + index * 25).springify()}>
      <TouchableOpacity
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
        activeOpacity={0.8}
        style={[exclusionStyles.chip, selected && exclusionStyles.chipActive]}
      >
        {selected && (
          <LinearGradient
            colors={['rgba(239,68,68,0.15)', 'rgba(239,68,68,0.05)']}
            style={StyleSheet.absoluteFill}
          />
        )}
        <TText
          variant="caption"
          weight={selected ? 'semibold' : 'regular'}
          style={{ color: selected ? Colors.error : Colors.textSecondary }}
        >
          {label}
        </TText>
        {selected && (
          <View style={exclusionStyles.chipX}>
            <TText style={{ fontSize: 8, color: '#fff', lineHeight: 10 }}>✕</TText>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const exclusionStyles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 13,
    paddingVertical: 8,
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    overflow: 'hidden',
  },
  chipActive: { borderColor: 'rgba(239,68,68,0.45)' },
  chipX: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default function ArtistStep4() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { updateProfile } = useAuthStore();
  const [status, setStatus] = useState<'open' | 'paused' | 'closed'>('open');
  const [minBudget, setMinBudget] = useState('');
  const [exclusions, setExclusions] = useState<Set<string>>(new Set());

  const toggleExclusion = (label: string) => {
    const s = new Set(exclusions);
    s.has(label) ? s.delete(label) : s.add(label);
    setExclusions(s);
  };

  const handleContinue = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    updateProfile({
      bookingStatus: status,
      minBudget: minBudget ? parseInt(minBudget, 10) : undefined,
      exclusions: Array.from(exclusions),
    } as any);
    router.push('/(onboarding)/artist/step5');
  };

  return (
    <View style={styles.container}>
      <View style={styles.orb1} pointerEvents="none" />
      <View style={styles.orb2} pointerEvents="none" />
      <LinearGradient
        colors={['rgba(3,3,5,0)', 'rgba(3,3,5,0.5)', Colors.bgPrimary]}
        locations={[0, 0.4, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        <Logo size="sm" variant="full" />
        <StepDots current={STEP} total={TOTAL} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View entering={FadeInDown.delay(200).springify()}>
          <TText variant="displayS" weight="black" style={styles.title}>
            Tes règles{'\n'}de réservation
          </TText>
          <TText variant="body" color="secondary" style={styles.subtitle}>
            Configure une fois, gagne du temps à chaque demande.
          </TText>
        </Animated.View>

        {/* Booking status */}
        <Animated.View entering={FadeInDown.delay(300).springify()} style={styles.section}>
          <TText variant="caption" color="tertiary" style={styles.sectionLabel}>
            DISPONIBILITÉ
          </TText>
          <View style={styles.statusList}>
            {BOOKING_STATUSES.map((opt) => {
              const isSelected = status === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setStatus(opt.value);
                  }}
                  activeOpacity={0.8}
                  style={[
                    styles.statusCard,
                    isSelected && {
                      borderColor: opt.borderColor,
                      backgroundColor: opt.bgColor,
                    },
                  ]}
                >
                  {isSelected && (
                    <View
                      style={[styles.statusLeftBorder, { backgroundColor: opt.color }]}
                    />
                  )}
                  <View style={styles.statusIcon}>
                    <Ionicons
                      name={opt.icon}
                      size={22}
                      color={isSelected ? opt.color : Colors.textTertiary}
                    />
                  </View>
                  <View style={styles.statusTextGroup}>
                    <TText
                      variant="bodySmall"
                      weight={isSelected ? 'semibold' : 'regular'}
                      style={{ color: isSelected ? Colors.textPrimary : Colors.textSecondary }}
                    >
                      {opt.label}
                    </TText>
                    <TText variant="caption" color="tertiary">
                      {opt.description}
                    </TText>
                  </View>
                  {isSelected && (
                    <View style={[styles.statusCheckDot, { backgroundColor: opt.color }]} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>

        {/* Minimum budget */}
        <Animated.View entering={FadeInDown.delay(450).springify()} style={styles.section}>
          <TText variant="caption" color="tertiary" style={styles.sectionLabel}>
            BUDGET MINIMUM
          </TText>
          <View style={styles.budgetInputWrapper}>
            <TextInput
              value={minBudget}
              onChangeText={(t) => setMinBudget(t.replace(/[^0-9]/g, ''))}
              placeholder="0"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="number-pad"
              style={styles.budgetInput}
              maxLength={6}
            />
            <View style={styles.budgetSuffix}>
              <TText variant="title2" weight="semibold" style={{ color: Colors.accentWarm }}>
                €
              </TText>
            </View>
          </View>
          <TText variant="caption" color="tertiary" style={{ marginTop: 6 }}>
            Laisse vide si aucun minimum.
          </TText>
        </Animated.View>

        {/* Style exclusions */}
        <Animated.View entering={FadeInDown.delay(550).springify()} style={styles.section}>
          <TText variant="caption" color="tertiary" style={styles.sectionLabel}>
            CE QUE TU NE FAIS PAS
          </TText>
          <View style={styles.exclusionGrid}>
            {EXCLUSION_OPTIONS.map((label, i) => (
              <ExclusionChip
                key={label}
                label={label}
                selected={exclusions.has(label)}
                onPress={() => toggleExclusion(label)}
                index={i}
              />
            ))}
          </View>
        </Animated.View>

        <View style={{ height: Spacing['2xl'] }} />
      </ScrollView>

      <Animated.View
        entering={FadeInUp.delay(500).springify()}
        style={[styles.footer, { paddingBottom: insets.bottom + Spacing.md }]}
      >
        <TouchableOpacity onPress={handleContinue} activeOpacity={0.85} style={styles.continueBtn}>
          <LinearGradient
            colors={[Colors.accentGlow, Colors.accentWarm, '#A06030']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <TText variant="body" weight="bold" style={{ color: Colors.bgPrimary }}>
            Continuer →
          </TText>
        </TouchableOpacity>
        <TText
          variant="caption"
          color="tertiary"
          style={{ textAlign: 'center' }}
          onPress={() => router.back()}
        >
          Retour
        </TText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  orb1: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: Colors.violet,
    opacity: 0.055,
    top: -70,
    right: -90,
  },
  orb2: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: Colors.accentWarm,
    opacity: 0.055,
    bottom: '20%',
    left: -70,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
  },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.xl },
  title: { letterSpacing: -1.5, lineHeight: 36, marginBottom: Spacing.xs },
  subtitle: { lineHeight: 24 },
  section: { marginTop: Spacing.xl },
  sectionLabel: {
    letterSpacing: 1.5,
    marginBottom: Spacing.sm,
    fontSize: 10,
  },

  // Status cards
  statusList: { gap: 8 },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    overflow: 'hidden',
    gap: Spacing.sm,
  },
  statusLeftBorder: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    borderTopLeftRadius: Radius.lg,
    borderBottomLeftRadius: Radius.lg,
  },
  statusIcon: { width: 28, alignItems: 'center' },
  statusTextGroup: { flex: 1, gap: 2 },
  statusCheckDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // Budget input
  budgetInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    overflow: 'hidden',
    height: 56,
  },
  budgetInput: {
    flex: 1,
    paddingHorizontal: Spacing.sm,
    fontSize: 22,
    fontWeight: '600',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  budgetSuffix: {
    paddingHorizontal: Spacing.sm,
    borderLeftWidth: 1,
    borderLeftColor: Colors.borderDefault,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgSubtle,
    minWidth: 48,
  },

  // Exclusion chips
  exclusionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  // Footer
  footer: { paddingHorizontal: Spacing.lg, gap: Spacing['2xs'] },
  continueBtn: {
    height: 56,
    borderRadius: Radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...GlowShadow.amber,
  },
});
