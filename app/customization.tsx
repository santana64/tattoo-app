import React, { useState } from 'react';
import { ScrollView, StyleSheet, View, TouchableOpacity, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Radius } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TBadge } from '@/components/ui/TBadge';
import { TButton } from '@/components/ui/TButton';
import { TDivider } from '@/components/ui/TDivider';

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
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <TText variant="title2">Personnalisation</TText>
        <View style={{ width: 44 }} />
      </View>

      {/* Presets */}
      <View style={styles.section}>
        <TText variant="caption" color="secondary" style={styles.sectionTitle}>PRESET VISUEL</TText>
        <View style={styles.presetGrid}>
          {PRESETS.map((preset) => {
            const isSelected = selectedPreset === preset.id;
            return (
              <TouchableOpacity
                key={preset.id}
                style={[styles.presetCard, isSelected && styles.presetCardActive]}
                onPress={() => setSelectedPreset(preset.id)}
                activeOpacity={0.8}
              >
                <View style={[styles.presetSwatch, { backgroundColor: preset.accent }]} />
                <TText variant="bodySmall" weight={isSelected ? 'semibold' : 'regular'} style={{ marginTop: 6 }}>
                  {preset.label}
                </TText>
                <TText variant="caption" color="tertiary" style={{ marginTop: 2, textAlign: 'center' }}>
                  {preset.description}
                </TText>
                {isSelected && (
                  <View style={styles.presetCheck}>
                    <Ionicons name="checkmark-circle" size={18} color={Colors.accent} />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <TDivider style={styles.divider} />

      {/* Sections visibility */}
      <View style={styles.section}>
        <TText variant="caption" color="secondary" style={styles.sectionTitle}>SECTIONS DU PROFIL</TText>
        {sections.map((section) => (
          <View key={section.id} style={styles.sectionRow}>
            <Ionicons name={section.icon} size={20} color={Colors.textSecondary} style={{ marginRight: Spacing.sm }} />
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
                trackColor={{ false: Colors.bgSubtle, true: Colors.accent }}
                thumbColor={Colors.accentAction}
              />
            )}
          </View>
        ))}
      </View>

      <TDivider style={styles.divider} />

      {/* Profile info display */}
      <View style={styles.section}>
        <TText variant="caption" color="secondary" style={styles.sectionTitle}>INFOS AFFICHÉES</TText>
        <View style={styles.sectionRow}>
          <TText variant="bodySmall" style={{ flex: 1 }}>Disponibilité</TText>
          <Switch
            value={showAvailability}
            onValueChange={setShowAvailability}
            trackColor={{ false: Colors.bgSubtle, true: Colors.accent }}
            thumbColor={Colors.accentAction}
          />
        </View>
        <View style={styles.sectionRow}>
          <TText variant="bodySmall" style={{ flex: 1 }}>Statistiques (vues, demandes)</TText>
          <Switch
            value={showStats}
            onValueChange={setShowStats}
            trackColor={{ false: Colors.bgSubtle, true: Colors.accent }}
            thumbColor={Colors.accentAction}
          />
        </View>
        <View style={styles.sectionRow}>
          <TText variant="bodySmall" style={{ flex: 1 }}>Budget minimum</TText>
          <Switch
            value={showMinBudget}
            onValueChange={setShowMinBudget}
            trackColor={{ false: Colors.bgSubtle, true: Colors.accent }}
            thumbColor={Colors.accentAction}
          />
        </View>
      </View>

      <TDivider style={styles.divider} />

      {/* Preview CTA */}
      <View style={styles.section}>
        <TButton
          title="Voir l'aperçu de mon profil"
          variant="secondary"
          onPress={() => {}}
        />
        <TText variant="caption" color="tertiary" style={styles.previewHint}>
          Les modifications sont appliquées en temps réel sur ton profil public.
        </TText>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSubtle,
  },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  section: { padding: Spacing.sm },
  sectionTitle: { marginBottom: Spacing['2xs'] },
  divider: { marginHorizontal: Spacing.sm },
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
  presetCardActive: {
    borderColor: Colors.accent,
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
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing['2xs'],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSubtle,
  },
  lockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  previewHint: {
    marginTop: Spacing['2xs'],
    textAlign: 'center',
    lineHeight: 18,
  },
});
