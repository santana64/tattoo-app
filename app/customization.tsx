import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View, Pressable, Platform, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Radius, Layout } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TBadge } from '@/components/ui/TBadge';
import { TButton } from '@/components/ui/TButton';
import { TDivider } from '@/components/ui/TDivider';
import { THeader } from '@/components/ui/THeader';
import { EASE_OUT, MotionDuration, PressableScale } from '@/components/motion';
import { useAuthStore } from '@/store/auth-store';
import { supabase } from '@/lib/supabase';

const PRESETS = [
  { id: 'minimal', label: 'Minimal', description: 'Épuré, centré sur le travail', accent: '#E8E0D0' },
  { id: 'dark', label: 'Sombre', description: 'Contrasté et intense', accent: '#A0A0A0' },
  { id: 'warm', label: 'Chaud', description: 'Tons dorés', accent: '#C8A882' },
  { id: 'contrast', label: 'Contraste', description: 'Fort contraste, graphique', accent: '#FFFFFF' },
];

const SECTIONS = [
  { id: 'gallery', label: 'Galerie', icon: 'images-outline' as const, locked: false },
  { id: 'bio', label: 'Bio', icon: 'person-outline' as const, locked: false },
  { id: 'styles', label: 'Styles', icon: 'brush-outline' as const, locked: false },
  { id: 'rules', label: 'Conditions et exclusions', icon: 'shield-outline' as const, locked: false },
  { id: 'process', label: 'Ma méthode', icon: 'list-outline' as const, locked: true },
  { id: 'faq', label: 'Questions fréquentes', icon: 'help-circle-outline' as const, locked: true },
];

// ─── Toggle: 180ms state transition, visual only (the row owns the press) ─────
function Toggle({ value }: { value: boolean }) {
  const p = useSharedValue(value ? 1 : 0);
  useEffect(() => {
    p.set(withTiming(value ? 1 : 0, { duration: MotionDuration.state, easing: EASE_OUT }));
  }, [value, p]);
  const onStyle = useAnimatedStyle(() => ({ opacity: p.get() }));
  const knobStyle = useAnimatedStyle(() => ({ transform: [{ translateX: p.get() * 18 }] }));
  return (
    <View style={toggleStyles.track} importantForAccessibility="no-hide-descendants">
      <Animated.View style={[StyleSheet.absoluteFill, toggleStyles.on, onStyle]} />
      <Animated.View style={[toggleStyles.knob, knobStyle]} />
    </View>
  );
}

const toggleStyles = StyleSheet.create({
  track: {
    width: 46, height: 28, borderRadius: 14,
    backgroundColor: Colors.bgSubtle,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderDefault,
    overflow: 'hidden',
  },
  on: { backgroundColor: Colors.accentWarm, borderRadius: 14 },
  knob: {
    position: 'absolute', top: 2.5, left: 2.5,
    width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.textPrimary,
  },
});

function ToggleRow({ icon, label, value, onToggle, locked }: {
  icon?: keyof typeof Ionicons.glyphMap; label: string; value: boolean; onToggle: () => void; locked?: boolean;
}) {
  return (
    <Pressable
      onPress={() => {
        if (locked) return;
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onToggle();
      }}
      disabled={locked}
      accessibilityRole="switch"
      accessibilityLabel={locked ? `${label}, réservé à Premium` : label}
      accessibilityState={{ checked: value, disabled: locked }}
      style={styles.row}
    >
      {icon && <Ionicons name={icon} size={19} color={Colors.textSecondary} style={styles.rowIcon} />}
      <TText variant="body" weight="medium" style={{ flex: 1 }}>{label}</TText>
      {locked ? (
        <View style={styles.lockedRow}>
          <TBadge label="Premium" variant="premium" />
          <Ionicons name="lock-closed" size={13} color={Colors.accentWarm} />
        </View>
      ) : (
        <Toggle value={value} />
      )}
    </Pressable>
  );
}

function Group({ title, children, inset }: { title: string; children: React.ReactNode; inset?: number }) {
  const items = React.Children.toArray(children);
  return (
    <View style={styles.group}>
      <TText variant="label" color="tertiary" uppercase style={styles.groupTitle}>{title}</TText>
      <View style={styles.groupBody}>
        {items.map((child, i) => (
          <React.Fragment key={i}>
            {i > 0 && <TDivider inset={inset} />}
            {child}
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

export default function CustomizationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user } = useAuthStore();
  const isPremium = user?.artistTier === 'premium';
  const artistId = user?.artistId;
  const [selectedPreset, setSelectedPreset] = useState('minimal');
  const [sections, setSections] = useState(() =>
    SECTIONS.map((s) => ({ ...s, locked: s.locked && !isPremium, enabled: true })),
  );
  const [showAvailability, setShowAvailability] = useState(true);
  const [showStats, setShowStats] = useState(true);
  const [showMinBudget, setShowMinBudget] = useState(true);

  // Start from what is actually stored on the artist record (read-only).
  useEffect(() => {
    if (!artistId) return;
    let active = true;
    supabase
      .from('artists')
      .select('visual_preset, show_availability, show_stats, show_min_budget, sections_config')
      .eq('id', artistId)
      .maybeSingle()
      .then(({ data }) => {
        if (!active || !data) return;
        if (data.visual_preset) setSelectedPreset(data.visual_preset);
        if (data.show_availability != null) setShowAvailability(data.show_availability);
        if (data.show_stats != null) setShowStats(data.show_stats);
        if (data.show_min_budget != null) setShowMinBudget(data.show_min_budget);
        const config = (data.sections_config ?? {}) as Record<string, boolean>;
        setSections((prev) => prev.map((s) => (typeof config[s.id] === 'boolean' ? { ...s, enabled: config[s.id] } : s)));
      });
    return () => { active = false; };
  }, [artistId]);

  const toggleSection = (id: string) => {
    setSections((prev) =>
      prev.map((s) => (s.id === id && !s.locked ? { ...s, enabled: !s.enabled } : s))
    );
  };

  const presetCols = width >= 720 ? 4 : 2;

  return (
    <View style={styles.container}>
      <THeader title="Personnalisation" showBack />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing['2xl'] }]}
      >
        <View style={styles.hero}>
          <TText variant="label" color="accentWarm" uppercase>Profil public</TText>
          <TText variant="displayM" style={{ marginTop: 4 }} accessibilityRole="header">
            Votre <TText variant="displayM" italic color="accentGlow">accrochage</TText>
          </TText>
          <TText variant="body" color="secondary" style={{ marginTop: Spacing.xs }}>
            Choisissez ce que les visiteurs voient en premier sur votre profil.
          </TText>
        </View>

        <View style={styles.notice}>
          <Ionicons name="information-circle-outline" size={17} color={Colors.warning} />
          <TText variant="caption" color="secondary" style={{ flex: 1 }}>
            L’enregistrement de ces réglages n’est pas encore disponible : votre profil public n’est pas modifié pour l’instant.
          </TText>
        </View>

        {/* Visual preset */}
        <View style={styles.group}>
          <TText variant="label" color="tertiary" uppercase style={styles.groupTitle}>Ambiance visuelle</TText>
          <View style={styles.presetGrid} accessibilityRole="radiogroup">
            {PRESETS.map((preset) => {
              const isSelected = selectedPreset === preset.id;
              return (
                <PressableScale
                  key={preset.id}
                  onPress={() => setSelectedPreset(preset.id)}
                  accessibilityRole="radio"
                  accessibilityLabel={`${preset.label}, ${preset.description}`}
                  accessibilityState={{ selected: isSelected }}
                  style={[
                    styles.presetCard,
                    { width: `${100 / presetCols - 2}%` as `${number}%` },
                    isSelected && styles.presetCardSelected,
                  ]}
                >
                  <View style={[styles.presetSwatch, { backgroundColor: preset.accent }]} />
                  <TText variant="bodySmall" weight="semibold" style={{ marginTop: Spacing.xs }}>{preset.label}</TText>
                  <TText variant="caption" color="tertiary">{preset.description}</TText>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={18} color={Colors.textPrimary} style={styles.presetCheck} />
                  )}
                </PressableScale>
              );
            })}
          </View>
        </View>

        <Group title="Sections du profil" inset={34}>
          {sections.map((section) => (
            <ToggleRow
              key={section.id}
              icon={section.icon}
              label={section.label}
              value={section.enabled}
              locked={section.locked}
              onToggle={() => toggleSection(section.id)}
            />
          ))}
        </Group>

        <Group title="Informations affichées">
          {[
            { label: 'Disponibilité', value: showAvailability, setter: setShowAvailability },
            { label: 'Statistiques (vues, demandes)', value: showStats, setter: setShowStats },
            { label: 'Budget minimum', value: showMinBudget, setter: setShowMinBudget },
          ].map((row) => (
            <ToggleRow key={row.label} label={row.label} value={row.value} onToggle={() => row.setter(!row.value)} />
          ))}
        </Group>

        <View style={styles.cta}>
          <TButton
            title="Voir mon profil public"
            variant="secondary"
            disabled={!artistId}
            icon={<Ionicons name="eye-outline" size={17} color={Colors.textPrimary} />}
            onPress={() => router.push(`/artist/${artistId}`)}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  content: {
    width: '100%', maxWidth: Layout.maxReading + Layout.gutter * 2, alignSelf: 'center',
    paddingHorizontal: Layout.gutter, paddingTop: Spacing.xl,
  },
  hero: { marginBottom: Spacing.lg },
  notice: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    paddingVertical: Spacing.xs, paddingHorizontal: Spacing.sm,
    borderRadius: Radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(217,165,91,0.35)',
    backgroundColor: 'rgba(217,165,91,0.06)',
  },
  group: { marginTop: Spacing.xl },
  groupTitle: { marginBottom: Spacing['2xs'] },
  groupBody: {
    borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderDefault,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 10,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } as object : null),
  },
  rowIcon: { width: 22 },
  lockedRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  presetCard: {
    borderRadius: Radius.md, padding: Spacing.sm, minHeight: 120,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderDefault,
  },
  presetCardSelected: { borderColor: Colors.textPrimary, borderWidth: 1, backgroundColor: Colors.glassBg },
  presetSwatch: { width: 32, height: 32, borderRadius: 16 },
  presetCheck: { position: 'absolute', top: 10, right: 10 },

  cta: { marginTop: Spacing['2xl'] },
});
