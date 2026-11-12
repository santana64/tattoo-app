import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TBadge } from '@/components/ui/TBadge';
import { TButton } from '@/components/ui/TButton';
import { THeader } from '@/components/ui/THeader';
import { Choice, PageWrap, Rule, SectionHead, SettingRow, StatusDot, Toggle } from '@/components/v5';
import { PremiumHero } from '@/components/v5/premium';
import { useAuthStore } from '@/store/auth-store';
import { useContentDimensions } from '@/hooks/useContentDimensions';
import { supabase } from '@/lib/supabase';

const PRESETS = [
  { id: 'minimal', label: 'Minimal', description: 'Épuré, centré sur le travail' },
  { id: 'dark', label: 'Sombre', description: 'Contrasté et intense' },
  { id: 'warm', label: 'Chaud', description: 'Tons dorés' },
  { id: 'contrast', label: 'Contraste', description: 'Fort contraste, graphique' },
];

const SECTIONS = [
  { id: 'gallery', label: 'Galerie', locked: false },
  { id: 'bio', label: 'Bio', locked: false },
  { id: 'styles', label: 'Styles', locked: false },
  { id: 'rules', label: 'Conditions et exclusions', locked: false },
  { id: 'process', label: 'Ma méthode', locked: true },
  { id: 'faq', label: 'Questions fréquentes', locked: true },
];

const tap = () => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); };

function ToggleRow({ label, value, onToggle, locked }: {
  label: string; value: boolean; onToggle: () => void; locked?: boolean;
}) {
  return (
    <SettingRow
      title={label}
      right={locked ? (
        <View style={styles.lockedRow} accessible accessibilityLabel={`${label}, réservé à Premium`}>
          <TBadge label="Premium" variant="premium" />
          <Ionicons name="lock-closed" size={13} color={Colors.flameText} />
        </View>
      ) : (
        <Toggle value={value} label={label} onChange={() => { tap(); onToggle(); }} />
      )}
    />
  );
}

export default function CustomizationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isWide } = useContentDimensions();
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

  return (
    <View style={styles.container}>
      <THeader title="Personnalisation" showBack />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + Spacing['3xl'] }}
      >
        <PageWrap style={{ paddingTop: Spacing.lg }}>
          <PremiumHero
            size="page"
            kicker="Profil public / Accrochage"
            title="Votre espace."
            emphasis="Votre signature."
            body="Choisissez ce que les visiteurs voient en premier sur votre profil."
          />

          <View style={styles.notice} accessibilityRole="text">
            <StatusDot tone="wait" label="Aperçu" />
            <TText variant="caption" color="secondary" style={{ flex: 1, minWidth: 200 }}>
              L’enregistrement de ces réglages n’est pas encore disponible : votre profil public n’est pas modifié pour l’instant.
            </TText>
          </View>

          <View style={[styles.columns, isWide && styles.columnsWide]}>
            {/* Visual preset */}
            <View style={isWide ? { flex: 1 } : undefined}>
              <SectionHead kicker="01 / Ambiance visuelle" title="Le ton." />
              <View style={styles.presetGrid} accessibilityRole="radiogroup">
                {PRESETS.map((preset) => (
                  <Choice
                    key={preset.id}
                    title={preset.label}
                    hint={preset.description}
                    selected={selectedPreset === preset.id}
                    onPress={() => setSelectedPreset(preset.id)}
                    style={styles.preset}
                  />
                ))}
              </View>
            </View>

            <View style={isWide ? { flex: 1.2 } : undefined}>
              <SectionHead kicker="02 / Sections du profil" title="L’accrochage." />
              <Rule tone="ink" />
              {sections.map((section) => (
                <ToggleRow
                  key={section.id}
                  label={section.label}
                  value={section.enabled}
                  locked={section.locked}
                  onToggle={() => toggleSection(section.id)}
                />
              ))}

              <SectionHead kicker="03 / Informations affichées" title="Le cartel." style={{ marginTop: Spacing['2xl'] }} />
              <Rule tone="ink" />
              {[
                { label: 'Disponibilité', value: showAvailability, setter: setShowAvailability },
                { label: 'Statistiques (vues, demandes)', value: showStats, setter: setShowStats },
                { label: 'Budget minimum', value: showMinBudget, setter: setShowMinBudget },
              ].map((row) => (
                <ToggleRow key={row.label} label={row.label} value={row.value} onToggle={() => row.setter(!row.value)} />
              ))}

              <View style={styles.cta}>
                <TButton
                  title="Voir mon profil public"
                  variant="secondary"
                  fullWidth={false}
                  disabled={!artistId}
                  icon={<Ionicons name="eye-outline" size={17} color={Colors.ink} />}
                  onPress={() => router.push(`/artist/${artistId}`)}
                />
              </View>
            </View>
          </View>
        </PageWrap>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  notice: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: Spacing.sm, marginTop: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.line,
  },
  columns: { marginTop: Spacing['2xl'], gap: Spacing['2xl'] },
  columnsWide: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing['3xl'] },
  lockedRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  preset: { flexGrow: 1, flexBasis: '45%', minWidth: 140 },

  cta: { marginTop: Spacing['2xl'] },
});
