import React, { useState } from 'react';
import { ScrollView, StyleSheet, View, TouchableOpacity, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, Radius, GlowShadow } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TBadge } from '@/components/ui/TBadge';
import { GlassCard } from '@/components/ui/GlassCard';

const PRESETS = [
  { id: 'minimal', label: 'Minimal', description: 'Épuré, focalisé sur le travail', accent: '#E8E0D0' },
  { id: 'dark', label: 'Dark', description: 'Sombre et intense', accent: '#A0A0A0' },
  { id: 'warm', label: 'Warm', description: 'Tons chauds dorés', accent: '#C8A882' },
  { id: 'contrast', label: 'Contrast', description: 'Fort contraste, impactant', accent: '#FFFFFF' },
];

const SECTIONS = [
  { id: 'gallery', label: 'Galerie', icon: 'images-outline' as const, locked: false },
  { id: 'bio', label: 'Bio', icon: 'person-outline' as const, locked: false },
  { id: 'styles', label: 'Styles', icon: 'brush-outline' as const, locked: false },
  { id: 'rules', label: 'Règles & exclusions', icon: 'shield-outline' as const, locked: false },
  { id: 'process', label: 'Mon process', icon: 'list-outline' as const, locked: true },
  { id: 'faq', label: 'FAQ personnalisée', icon: 'help-circle-outline' as const, locked: true },
];

export default function CustomizationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selectedPreset, setSelectedPreset] = useState('minimal');
  const [sections, setSections] = useState(SECTIONS.map((s) => ({ ...s, enabled: true })));
  const [showAvailability, setShowAvailability] = useState(true);
  const [showStats, setShowStats] = useState(true);
  const [showMinBudget, setShowMinBudget] = useState(true);

  const toggleSection = (id: string) => {
    setSections((prev) =>
      prev.map((s) => (s.id === id && !s.locked ? { ...s, enabled: !s.enabled } : s))
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Aurora orb — violet top-right */}
      <View style={styles.auroraOrb} pointerEvents="none" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <TText variant="title2" weight="semibold">Personnalisation</TText>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
      >
        {/* ── Preset visuel ─────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(60).springify()}>
          <TText variant="caption" weight="semibold" style={[styles.sectionLabel, { color: Colors.textTertiary }]}>
            PRESET VISUEL
          </TText>
          <GlassCard variant="default" style={styles.card}>
            <View style={styles.presetGrid}>
              {PRESETS.map((preset) => {
                const isSelected = selectedPreset === preset.id;
                return (
                  <TouchableOpacity
                    key={preset.id}
                    style={[
                      styles.presetCard,
                      isSelected && { borderColor: Colors.accentWarm, borderWidth: 1.5 },
                    ]}
                    onPress={() => setSelectedPreset(preset.id)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.presetSwatch, { backgroundColor: preset.accent }]} />
                    <TText
                      variant="bodySmall"
                      weight={isSelected ? 'semibold' : 'regular'}
                      style={{ marginTop: 6 }}
                    >
                      {preset.label}
                    </TText>
                    <TText variant="caption" style={{ marginTop: 2, textAlign: 'center', color: Colors.textTertiary }}>
                      {preset.description}
                    </TText>
                    {isSelected && (
                      <View style={styles.presetCheck}>
                        <Ionicons name="checkmark-circle" size={18} color={Colors.accentWarm} />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </GlassCard>
        </Animated.View>

        {/* ── Sections du profil ────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(140).springify()}>
          <TText variant="caption" weight="semibold" style={[styles.sectionLabel, { color: Colors.textTertiary }]}>
            SECTIONS DU PROFIL
          </TText>
          <GlassCard variant="default" style={styles.card} padding={0}>
            {sections.map((section, idx) => (
              <View
                key={section.id}
                style={[
                  styles.toggleRow,
                  idx < sections.length - 1 && styles.toggleRowBorder,
                ]}
              >
                <View style={styles.toggleIconWrap}>
                  <Ionicons name={section.icon} size={18} color={Colors.accentWarm} />
                </View>
                <TText variant="bodySmall" style={{ flex: 1 }}>{section.label}</TText>
                {section.locked ? (
                  <View style={styles.lockedRow}>
                    <TBadge label="Premium" variant="premium" />
                    <Ionicons name="lock-closed" size={14} color={Colors.accentWarm} style={{ marginLeft: 6 }} />
                  </View>
                ) : (
                  <Switch
                    value={section.enabled}
                    onValueChange={() => toggleSection(section.id)}
                    trackColor={{ false: Colors.borderDefault, true: Colors.accentWarm }}
                    thumbColor={Colors.accentAction}
                  />
                )}
              </View>
            ))}
          </GlassCard>
        </Animated.View>

        {/* ── Infos affichées ───────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(220).springify()}>
          <TText variant="caption" weight="semibold" style={[styles.sectionLabel, { color: Colors.textTertiary }]}>
            INFOS AFFICHÉES
          </TText>
          <GlassCard variant="default" style={styles.card} padding={0}>
            {[
              { label: 'Disponibilité', value: showAvailability, setter: setShowAvailability },
              { label: 'Statistiques (vues, demandes)', value: showStats, setter: setShowStats },
              { label: 'Budget minimum', value: showMinBudget, setter: setShowMinBudget },
            ].map((row, idx, arr) => (
              <View
                key={row.label}
                style={[styles.toggleRow, idx < arr.length - 1 && styles.toggleRowBorder]}
              >
                <TText variant="bodySmall" style={{ flex: 1 }}>{row.label}</TText>
                <Switch
                  value={row.value}
                  onValueChange={row.setter}
                  trackColor={{ false: Colors.borderDefault, true: Colors.accentWarm }}
                  thumbColor={Colors.accentAction}
                />
              </View>
            ))}
          </GlassCard>
        </Animated.View>

        {/* ── CTA — Aperçu profil ───────────────────────── */}
        <Animated.View entering={FadeInDown.delay(300).springify()} style={styles.ctaWrap}>
          <TouchableOpacity activeOpacity={0.85} onPress={() => {}} style={styles.ctaBtn}>
            <LinearGradient
              colors={[Colors.accentGlow, Colors.accentWarm, '#A06030']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]}
            />
            <TText variant="bodySmall" weight="semibold" style={{ color: Colors.textInverse, letterSpacing: 0.5 }}>
              Voir l'aperçu de mon profil
            </TText>
          </TouchableOpacity>
          <TText variant="caption" style={styles.ctaHint}>
            Les modifications sont appliquées en temps réel sur ton profil public.
          </TText>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  auroraOrb: {
    position: 'absolute',
    top: -60,
    right: -60,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: Colors.violet,
    opacity: 0.055,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSubtle,
  },
  headerBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.md,
    gap: 4,
  },
  sectionLabel: {
    marginBottom: Spacing.sm,
    marginLeft: 4,
    letterSpacing: 1.2,
  },
  card: {
    marginBottom: Spacing.lg,
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetCard: {
    width: '47%',
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    padding: Spacing.sm,
    alignItems: 'center',
  },
  presetSwatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  presetCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 14,
    gap: Spacing['2xs'],
  },
  toggleRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSubtle,
  },
  toggleIconWrap: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    backgroundColor: Colors.glassAmber,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  lockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ctaWrap: {
    marginTop: Spacing.xs,
  },
  ctaBtn: {
    height: 52,
    borderRadius: Radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...GlowShadow.amberStrong,
  },
  ctaHint: {
    marginTop: Spacing['2xs'],
    textAlign: 'center',
    color: Colors.textTertiary,
    lineHeight: 18,
  },
});
