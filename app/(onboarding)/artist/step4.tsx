import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Radius } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TButton } from '@/components/ui/TButton';
import { TInput } from '@/components/ui/TInput';
import { TChip } from '@/components/ui/TChip';
import { OnboardingProgress } from '@/components/OnboardingProgress';

const EXCLUSION_OPTIONS = [
  'Recouvrement', 'Couleur seule', 'Portraits réalistes', 'Tribal',
  'Old school', 'Fine line', 'Aquarelle', 'Lettering',
];

export default function ArtistStep4() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<'open' | 'paused' | 'closed'>('open');
  const [minBudget, setMinBudget] = useState('');
  const [exclusions, setExclusions] = useState<string[]>([]);

  const toggleExclusion = (e: string) =>
    setExclusions((prev) => prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]);

  const StatusOption = ({ value, label, icon }: { value: 'open' | 'paused' | 'closed'; label: string; icon: string }) => (
    <TouchableOpacity
      style={[styles.statusOption, status === value && styles.statusSelected]}
      activeOpacity={0.85}
      onPress={() => setStatus(value)}
    >
      <TText variant="bodySmall" style={{ color: status === value ? Colors.textInverse : Colors.textSecondary }}>
        {label}
      </TText>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top + Spacing.md, paddingBottom: insets.bottom + Spacing.lg }]}>
      <OnboardingProgress total={5} current={4} />

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <TText variant="displayL" weight="bold" style={styles.title}>
          Tes règles de base
        </TText>
        <TText variant="body" color="secondary" style={styles.subtitle}>
          Inutile de les répéter à chaque demande. Affiche-les une bonne fois pour toutes.
        </TText>

        <TText variant="caption" color="secondary" style={styles.sectionLabel}>
          ACCEPTES-TU LES NOUVEAUX PROJETS ?
        </TText>
        <View style={styles.statusRow}>
          <StatusOption value="open" label="Ouvert" icon="checkmark" />
          <StatusOption value="paused" label="En pause" icon="pause" />
          <StatusOption value="closed" label="Fermé" icon="close" />
        </View>

        <TInput
          label="Budget minimum"
          value={minBudget}
          onChangeText={setMinBudget}
          placeholder="ex: 300"
          keyboardType="numeric"
          helper="En euros. Laisse vide si pas de minimum."
          optional
          containerStyle={{ marginTop: Spacing.md }}
        />

        <TText variant="caption" color="secondary" style={styles.sectionLabel}>
          CE QUE TU NE FAIS PAS
        </TText>
        <View style={styles.exclusionGrid}>
          {EXCLUSION_OPTIONS.map((e) => (
            <TChip
              key={e}
              label={e}
              selected={exclusions.includes(e)}
              onPress={() => toggleExclusion(e)}
            />
          ))}
        </View>
      </ScrollView>

      <TButton
        title="Continuer"
        onPress={() => router.push('/(onboarding)/artist/step5')}
        style={styles.cta}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
    paddingHorizontal: Spacing.lg,
  },
  scroll: { flex: 1, paddingTop: Spacing['2xl'] },
  title: { marginBottom: Spacing['2xs'] },
  subtitle: { marginBottom: Spacing.xl, lineHeight: 24 },
  sectionLabel: { marginBottom: Spacing['2xs'], letterSpacing: 0.5 },
  statusRow: { flexDirection: 'row', gap: 8, marginBottom: Spacing.lg },
  statusOption: {
    flex: 1,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgSurface,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusSelected: {
    backgroundColor: Colors.accentAction,
    borderColor: Colors.accentAction,
  },
  exclusionGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: Spacing.xl },
  cta: { marginTop: Spacing.md },
});
