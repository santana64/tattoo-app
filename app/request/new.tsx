import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Radius } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TButton } from '@/components/ui/TButton';
import { TInput } from '@/components/ui/TInput';
import { TChip } from '@/components/ui/TChip';
import { OnboardingProgress } from '@/components/OnboardingProgress';
import { useAppStore } from '@/store/app-store';
import { ARTISTS, STYLES } from '@/constants/mock-data';
import type { TattooRequest } from '@/constants/mock-data';

const SIZE_OPTIONS = [
  { key: 'xs', label: 'XS', sub: '< 3cm' },
  { key: 's', label: 'S', sub: '3–7cm' },
  { key: 'm', label: 'M', sub: '7–15cm' },
  { key: 'l', label: 'L', sub: '15–25cm' },
  { key: 'xl', label: 'XL', sub: '> 25cm' },
];

const BODY_ZONES = [
  'Avant-bras', 'Bras entier', 'Épaule', 'Omoplate', 'Poitrine', 'Côte',
  'Abdomen', 'Dos', 'Cuisse', 'Mollet', 'Cheville', 'Pied', 'Nuque', 'Cou',
];

const PROJECT_TYPES = [
  { key: 'new', label: 'Nouveau tatouage' },
  { key: 'cover_up', label: 'Recouvrement' },
  { key: 'touch_up', label: 'Retouche' },
  { key: 'extension', label: 'Agrandissement' },
];

export default function NewRequestScreen() {
  const { artistId } = useLocalSearchParams<{ artistId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { submitRequest } = useAppStore();

  const artist = ARTISTS.find((a) => a.id === artistId) ?? ARTISTS[0];

  const [step, setStep] = useState(1);
  const [projectType, setProjectType] = useState<string>('new');
  const [bodyZone, setBodyZone] = useState<string>('');
  const [size, setSize] = useState<string>('m');
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [colorPref, setColorPref] = useState<string>('black_grey');
  const [stylePref, setStylePref] = useState<string>('');
  const [description, setDescription] = useState('');
  const [flexibility, setFlexibility] = useState<string>('open');
  const [isFirst, setIsFirst] = useState<boolean | null>(null);

  const canNext = () => {
    if (step === 1) return !!projectType;
    if (step === 2) return !!bodyZone;
    if (step === 3) return !!size;
    if (step === 4) return true;
    if (step === 5) return description.length > 0;
    return true;
  };

  const handleNext = () => {
    if (step < 6) setStep((s) => s + 1);
    else handleSubmit();
  };

  const handleSubmit = () => {
    const request: TattooRequest = {
      id: `r_${Date.now()}`,
      clientName: 'Moi',
      clientAvatar: '',
      artistId: artist.id,
      projectType: projectType as any,
      bodyZone,
      sizeCategory: size as any,
      budgetMin: parseInt(budgetMin) || 0,
      budgetMax: parseInt(budgetMax) || 0,
      budgetUnknown: !budgetMin,
      colorPreference: colorPref as any,
      stylePreference: stylePref,
      description,
      flexibilityLevel: flexibility as any,
      isFirstTattoo: isFirst ?? false,
      status: 'submitted',
      submittedAt: new Date().toISOString(),
      references: [],
    } as any;
    submitRequest(request);
    router.replace('/(tabs)/inbox');
  };

  const OptionBtn = ({
    label,
    value,
    selected,
    onPress,
    sub,
  }: {
    label: string;
    value: string;
    selected: boolean;
    onPress: () => void;
    sub?: string;
  }) => (
    <TouchableOpacity
      style={[styles.optionBtn, selected && styles.optionSelected]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <TText
        variant="bodySmall"
        weight={selected ? 'semibold' : 'regular'}
        style={{ color: selected ? Colors.textInverse : Colors.textSecondary }}
      >
        {label}
      </TText>
      {sub && (
        <TText
          variant="caption"
          style={{ color: selected ? Colors.textInverse : Colors.textTertiary, marginTop: 1 }}
        >
          {sub}
        </TText>
      )}
    </TouchableOpacity>
  );

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => (step > 1 ? setStep((s) => s - 1) : router.back())}
          style={styles.headerBtn}
        >
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <TText variant="bodySmall" color="secondary">
          Demande à {artist.blaze}
        </TText>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="close" size={24} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <OnboardingProgress total={6} current={step} />

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        {/* Step 1: Project type */}
        {step === 1 && (
          <View style={styles.stepContent}>
            <TText variant="title1" weight="bold" style={styles.stepTitle}>
              Type de projet
            </TText>
            <TText variant="body" color="secondary" style={styles.stepSub}>
              Un dossier clair, c'est une réponse rapide.
            </TText>
            <View style={styles.optionGrid}>
              {PROJECT_TYPES.map((pt) => (
                <OptionBtn
                  key={pt.key}
                  label={pt.label}
                  value={pt.key}
                  selected={projectType === pt.key}
                  onPress={() => setProjectType(pt.key)}
                />
              ))}
            </View>
          </View>
        )}

        {/* Step 2: Body zone */}
        {step === 2 && (
          <View style={styles.stepContent}>
            <TText variant="title1" weight="bold" style={styles.stepTitle}>
              Zone du corps
            </TText>
            <TText variant="body" color="secondary" style={styles.stepSub}>
              Sois précis, ça aide vraiment.
            </TText>
            <View style={styles.bodyZoneGrid}>
              {BODY_ZONES.map((z) => (
                <TChip
                  key={z}
                  label={z}
                  selected={bodyZone === z}
                  onPress={() => setBodyZone(z)}
                />
              ))}
            </View>
            <TInput
              label="Précision"
              value={bodyZone && !BODY_ZONES.includes(bodyZone) ? bodyZone : ''}
              onChangeText={(t) => setBodyZone(t)}
              placeholder="ex: face interne, côté gauche..."
              optional
              containerStyle={{ marginTop: Spacing.sm }}
            />
          </View>
        )}

        {/* Step 3: Size & budget */}
        {step === 3 && (
          <View style={styles.stepContent}>
            <TText variant="title1" weight="bold" style={styles.stepTitle}>
              Taille et budget
            </TText>
            <TText variant="caption" color="secondary" style={styles.sectionLabel}>
              TAILLE
            </TText>
            <View style={styles.sizeRow}>
              {SIZE_OPTIONS.map((s) => (
                <OptionBtn
                  key={s.key}
                  label={s.label}
                  value={s.key}
                  selected={size === s.key}
                  onPress={() => setSize(s.key)}
                  sub={s.sub}
                />
              ))}
            </View>

            <TText variant="caption" color="secondary" style={[styles.sectionLabel, { marginTop: Spacing.md }]}>
              BUDGET ESTIMÉ (€)
            </TText>
            <View style={styles.budgetRow}>
              <TInput
                label="Min"
                value={budgetMin}
                onChangeText={setBudgetMin}
                placeholder="200"
                keyboardType="numeric"
                containerStyle={{ flex: 1, marginBottom: 0 }}
                optional
              />
              <TText variant="body" color="tertiary" style={{ marginTop: 20, marginHorizontal: 8 }}>–</TText>
              <TInput
                label="Max"
                value={budgetMax}
                onChangeText={setBudgetMax}
                placeholder="400"
                keyboardType="numeric"
                containerStyle={{ flex: 1, marginBottom: 0 }}
                optional
              />
            </View>
            {artist.minBudget > 0 && (
              <TText variant="caption" color="tertiary" style={{ marginTop: 4 }}>
                Budget minimum de {artist.blaze} : {artist.minBudget}€
              </TText>
            )}
          </View>
        )}

        {/* Step 4: Style & color */}
        {step === 4 && (
          <View style={styles.stepContent}>
            <TText variant="title1" weight="bold" style={styles.stepTitle}>
              Style et inspiration
            </TText>
            <TText variant="caption" color="secondary" style={styles.sectionLabel}>STYLE SOUHAITÉ</TText>
            <View style={styles.bodyZoneGrid}>
              {STYLES.map((s) => (
                <TChip
                  key={s.id}
                  label={s.name}
                  selected={stylePref === s.slug}
                  onPress={() => setStylePref(s.slug === stylePref ? '' : s.slug)}
                />
              ))}
            </View>

            <TText variant="caption" color="secondary" style={[styles.sectionLabel, { marginTop: Spacing.md }]}>COULEUR</TText>
            <View style={styles.optionGrid}>
              <OptionBtn label="Noir & gris" value="black_grey" selected={colorPref === 'black_grey'} onPress={() => setColorPref('black_grey')} />
              <OptionBtn label="Couleur" value="color" selected={colorPref === 'color'} onPress={() => setColorPref('color')} />
              <OptionBtn label="Au choix de l'artiste" value="artist_choice" selected={colorPref === 'artist_choice'} onPress={() => setColorPref('artist_choice')} />
            </View>
          </View>
        )}

        {/* Step 5: Description */}
        {step === 5 && (
          <View style={styles.stepContent}>
            <TText variant="title1" weight="bold" style={styles.stepTitle}>
              Ton projet en détail
            </TText>
            <TInput
              label="Description"
              value={description}
              onChangeText={setDescription}
              placeholder="Décris ton projet : thème, symboles, éléments importants, histoire derrière ce tatouage..."
              multiline
              numberOfLines={6}
              helper="Il n'y a pas de mauvaise réponse. Plus c'est clair, mieux c'est."
              inputStyle={{ height: 140, textAlignVertical: 'top', paddingTop: 10 }}
            />

            <TText variant="caption" color="secondary" style={[styles.sectionLabel, { marginTop: Spacing.md }]}>
              PREMIER TATOUAGE ?
            </TText>
            <View style={styles.yesNoRow}>
              <OptionBtn label="Oui" value="yes" selected={isFirst === true} onPress={() => setIsFirst(true)} />
              <OptionBtn label="Non" value="no" selected={isFirst === false} onPress={() => setIsFirst(false)} />
            </View>

            <TText variant="caption" color="secondary" style={[styles.sectionLabel, { marginTop: Spacing.md }]}>
              FLEXIBILITÉ SUR LE PROJET
            </TText>
            <View style={styles.optionGrid}>
              <OptionBtn label="Projet précis" value="precise" selected={flexibility === 'precise'} onPress={() => setFlexibility('precise')} />
              <OptionBtn label="Ouvert aux suggestions" value="open" selected={flexibility === 'open'} onPress={() => setFlexibility('open')} />
              <OptionBtn label="Je fais confiance" value="full_trust" selected={flexibility === 'full_trust'} onPress={() => setFlexibility('full_trust')} />
            </View>
          </View>
        )}

        {/* Step 6: Summary */}
        {step === 6 && (
          <View style={styles.stepContent}>
            <TText variant="title1" weight="bold" style={styles.stepTitle}>
              Voilà ce que tu envoies
            </TText>
            <TText variant="body" color="secondary" style={styles.stepSub}>
              Vérifie avant d'envoyer.
            </TText>

            <View style={styles.summaryCard}>
              <SummaryRow label="Type" value={PROJECT_TYPES.find((p) => p.key === projectType)?.label ?? ''} />
              <SummaryRow label="Zone" value={bodyZone} />
              <SummaryRow label="Taille" value={SIZE_OPTIONS.find((s) => s.key === size)?.label ?? ''} />
              <SummaryRow label="Budget" value={budgetMin ? `${budgetMin}–${budgetMax}€` : 'Non renseigné'} />
              <SummaryRow label="Style" value={STYLES.find((s) => s.slug === stylePref)?.name ?? 'Non renseigné'} />
              <SummaryRow label="Couleur" value={{ black_grey: 'Noir & gris', color: 'Couleur', artist_choice: 'Au choix' }[colorPref] ?? ''} />
              <SummaryRow label="Description" value={description} last />
            </View>

            <View style={styles.artistReminder}>
              <TText variant="caption" color="tertiary">
                Envoi à {artist.blaze} · {artist.city}
              </TText>
            </View>
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 8 }]}>
        <TButton
          title={step < 6 ? 'Continuer' : 'Envoyer la demande'}
          onPress={handleNext}
          disabled={!canNext()}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

function SummaryRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[summaryStyles.row, !last && summaryStyles.rowBorder]}>
      <TText variant="caption" color="tertiary" style={summaryStyles.label}>{label}</TText>
      <TText variant="bodySmall" style={{ flex: 2 }}>{value || '—'}</TText>
    </View>
  );
}

const summaryStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: Spacing['2xs'] },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.borderSubtle },
  label: { flex: 1 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary, paddingHorizontal: Spacing.lg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: Spacing['2xs'],
  },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  stepContent: { paddingTop: Spacing.lg },
  stepTitle: { marginBottom: Spacing['2xs'] },
  stepSub: { marginBottom: Spacing.lg, lineHeight: 24 },
  sectionLabel: { marginBottom: Spacing['2xs'], letterSpacing: 0.5 },
  optionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 10,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgSurface,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    alignItems: 'center',
    minWidth: '45%',
    flex: 1,
  },
  optionSelected: {
    backgroundColor: Colors.accentAction,
    borderColor: Colors.accentAction,
  },
  bodyZoneGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  sizeRow: { flexDirection: 'row', gap: 6 },
  budgetRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 0 },
  yesNoRow: { flexDirection: 'row', gap: 8 },
  summaryCard: {
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    marginBottom: Spacing.sm,
  },
  artistReminder: {
    padding: Spacing['2xs'],
    alignItems: 'center',
  },
  footer: {
    paddingTop: Spacing['2xs'],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderSubtle,
    backgroundColor: Colors.bgPrimary,
  },
});
