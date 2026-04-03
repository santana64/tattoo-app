import React, { useState, useRef } from 'react';
import {
  View, StyleSheet, ScrollView, TouchableOpacity,
  KeyboardAvoidingView, Platform, Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeIn, FadeInDown, FadeInUp, FadeOutLeft, FadeOutRight,
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Radius, GlowShadow } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TButton } from '@/components/ui/TButton';
import { TInput } from '@/components/ui/TInput';
import { GlassCard } from '@/components/ui/GlassCard';
import { useAppStore } from '@/store/app-store';
import { useAuthStore } from '@/store/auth-store';
import { ARTISTS, STYLES } from '@/constants/mock-data';
import type { TattooRequest } from '@/constants/mock-data';

const { width: SCREEN_W } = Dimensions.get('window');

const STEPS = ['Type', 'Zone', 'Taille & Budget', 'Style', 'Description', 'Récap'];

const SIZE_OPTIONS = [
  { key: 'xs', label: 'XS', sub: '< 3 cm' },
  { key: 's',  label: 'S',  sub: '3–7 cm' },
  { key: 'm',  label: 'M',  sub: '7–15 cm' },
  { key: 'l',  label: 'L',  sub: '15–25 cm' },
  { key: 'xl', label: 'XL', sub: '> 25 cm' },
];

const BODY_ZONES = [
  'Avant-bras', 'Bras entier', 'Épaule', 'Omoplate',
  'Poitrine', 'Côte', 'Abdomen', 'Dos complet',
  'Cuisse', 'Mollet', 'Cheville', 'Pied',
  'Nuque', 'Cou', 'Main', 'Doigt',
];

const PROJECT_TYPES = [
  { key: 'new',       label: 'Nouveau tatouage', icon: 'add-circle-outline',  desc: 'Créer quelque chose de neuf' },
  { key: 'cover_up',  label: 'Recouvrement',     icon: 'color-wand-outline',   desc: 'Recouvrir un ancien tatouage' },
  { key: 'touch_up',  label: 'Retouche',          icon: 'brush-outline',        desc: 'Rafraîchir un existant' },
  { key: 'extension', label: 'Agrandissement',    icon: 'expand-outline',       desc: 'Étendre une pièce existante' },
];

const COLORS_OPTIONS = [
  { key: 'black_grey', label: 'Noir & gris' },
  { key: 'full_color', label: 'Couleurs' },
  { key: 'mixed',      label: 'Mixte' },
  { key: 'flexible',   label: 'Au choix de l\'artiste' },
];

// ─── Step progress bar
function StepBar({ current, total }: { current: number; total: number }) {
  return (
    <View style={stepStyles.row}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            stepStyles.seg,
            i < current && stepStyles.segDone,
            i === current && stepStyles.segActive,
          ]}
        />
      ))}
    </View>
  );
}
const stepStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 4, paddingHorizontal: Spacing.sm, marginBottom: Spacing.sm },
  seg: { flex: 1, height: 3, borderRadius: 2, backgroundColor: Colors.borderSubtle },
  segDone: { backgroundColor: Colors.accentWarm },
  segActive: { backgroundColor: Colors.accentWarm, opacity: 0.5 },
});

// ─── Option card
function OptionCard({ label, icon, desc, selected, onPress }: {
  label: string; icon?: string; desc?: string; selected: boolean; onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const s = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={s}>
      <TouchableOpacity
        onPress={() => {
          scale.value = withSpring(0.96, { damping: 10 }, () => { scale.value = withSpring(1); });
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
        activeOpacity={1}
        style={[optStyles.card, selected && optStyles.cardSelected]}
      >
        {icon && (
          <View style={[optStyles.iconWrap, selected && optStyles.iconWrapSelected]}>
            <Ionicons name={icon as any} size={22} color={selected ? Colors.accentWarm : Colors.textSecondary} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <TText variant="bodySmall" weight={selected ? 'semibold' : 'regular'} style={{ color: selected ? Colors.textPrimary : Colors.textSecondary }}>
            {label}
          </TText>
          {desc && <TText variant="caption" color="tertiary" style={{ marginTop: 2 }}>{desc}</TText>}
        </View>
        {selected && <Ionicons name="checkmark-circle" size={20} color={Colors.accentWarm} />}
      </TouchableOpacity>
    </Animated.View>
  );
}
const optStyles = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center',
    padding: Spacing.sm, borderRadius: Radius.lg,
    backgroundColor: Colors.bgSurface,
    borderWidth: 1, borderColor: Colors.borderSubtle,
    gap: Spacing.sm, marginBottom: Spacing['2xs'],
  },
  cardSelected: {
    borderColor: Colors.accentWarm,
    backgroundColor: 'rgba(200,168,130,0.06)',
  },
  iconWrap: {
    width: 40, height: 40, borderRadius: Radius.md,
    backgroundColor: Colors.bgElevated,
    alignItems: 'center', justifyContent: 'center',
  },
  iconWrapSelected: { backgroundColor: 'rgba(200,168,130,0.12)' },
});

// ─── Size selector
function SizeSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <View style={sizeStyles.row}>
      {SIZE_OPTIONS.map((opt) => (
        <TouchableOpacity
          key={opt.key}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onChange(opt.key); }}
          style={[sizeStyles.cell, value === opt.key && sizeStyles.cellSelected]}
          activeOpacity={0.8}
        >
          <TText variant="bodySmall" weight="bold" style={{ color: value === opt.key ? Colors.accentWarm : Colors.textSecondary }}>
            {opt.label}
          </TText>
          <TText variant="micro" color="tertiary">{opt.sub}</TText>
        </TouchableOpacity>
      ))}
    </View>
  );
}
const sizeStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6 },
  cell: {
    flex: 1, alignItems: 'center', paddingVertical: 12,
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.borderSubtle, gap: 3,
  },
  cellSelected: { borderColor: Colors.accentWarm, backgroundColor: 'rgba(200,168,130,0.08)' },
});

export default function NewRequestScreen() {
  const { artistId } = useLocalSearchParams<{ artistId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { submitRequest } = useAppStore();
  const { user } = useAuthStore();

  const artist = ARTISTS.find((a) => a.id === artistId) ?? ARTISTS[0];

  const [step, setStep] = useState(0);
  const [projectType, setProjectType] = useState('');
  const [bodyZone, setBodyZone] = useState('');
  const [sizeCategory, setSizeCategory] = useState('m');
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [stylePrefs, setStylePrefs] = useState<string[]>([]);
  const [colorPref, setColorPref] = useState('');
  const [isFlexible, setIsFlexible] = useState(false);
  const [description, setDescription] = useState('');

  const canNext = () => {
    if (step === 0) return !!projectType;
    if (step === 1) return !!bodyZone;
    if (step === 2) return !!sizeCategory && !!budgetMin && !!budgetMax;
    if (step === 3) return stylePrefs.length > 0 && !!colorPref;
    return true;
  };

  const goNext = () => {
    if (!canNext()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (step < STEPS.length - 1) setStep((s) => s + 1);
  };

  const goBack = () => {
    if (step === 0) { router.back(); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep((s) => s - 1);
  };

  const handleSubmit = () => {
    const newReq: TattooRequest = {
      id: `r-${Date.now()}`,
      artistId: artist.id,
      clientName: user?.displayName ?? 'Moi',
      clientAvatar: null,
      projectType: projectType as any,
      bodyZone,
      sizeCategory: sizeCategory as any,
      budgetMin: parseInt(budgetMin) || 0,
      budgetMax: parseInt(budgetMax) || 0,
      stylePrefs,
      colorPref: colorPref as any,
      isFlexible,
      description,
      references: [],
      status: 'submitted',
      submittedAt: new Date().toISOString(),
    };
    submitRequest(newReq);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace('/(tabs)/inbox');
  };

  const toggleStylePref = (slug: string) => {
    setStylePrefs((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.headerBtn}>
          <Ionicons name={step === 0 ? 'close' : 'chevron-back'} size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <TText variant="caption" color="tertiary" uppercase>{STEPS[step]}</TText>
          <TText variant="micro" color="tertiary">{step + 1}/{STEPS.length}</TText>
        </View>
        <View style={{ width: 44 }} />
      </View>

      {/* Step bar */}
      <StepBar current={step} total={STEPS.length} />

      {/* Artist context */}
      <Animated.View entering={FadeIn.duration(400)} style={styles.artistContext}>
        <TText variant="caption" color="tertiary">Demande à </TText>
        <TText variant="caption" weight="semibold" style={{ color: Colors.accentWarm }}>{artist.blaze}</TText>
        <TText variant="caption" color="tertiary"> · {artist.city}</TText>
      </Animated.View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── STEP 0: Project type ── */}
        {step === 0 && (
          <Animated.View entering={FadeInDown.duration(300)}>
            <TText variant="title1" weight="bold" style={styles.stepTitle}>Quel type de projet ?</TText>
            {PROJECT_TYPES.map((pt) => (
              <OptionCard
                key={pt.key}
                label={pt.label}
                icon={pt.icon}
                desc={pt.desc}
                selected={projectType === pt.key}
                onPress={() => setProjectType(pt.key)}
              />
            ))}
          </Animated.View>
        )}

        {/* ── STEP 1: Body zone ── */}
        {step === 1 && (
          <Animated.View entering={FadeInDown.duration(300)}>
            <TText variant="title1" weight="bold" style={styles.stepTitle}>Où souhaitez-vous le tatouage ?</TText>
            <View style={styles.zonesGrid}>
              {BODY_ZONES.map((zone) => (
                <TouchableOpacity
                  key={zone}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setBodyZone(zone); }}
                  style={[styles.zoneChip, bodyZone === zone && styles.zoneChipSelected]}
                  activeOpacity={0.8}
                >
                  <TText
                    variant="caption"
                    style={{ color: bodyZone === zone ? Colors.accentWarm : Colors.textSecondary }}
                    weight={bodyZone === zone ? 'semibold' : 'regular'}
                  >
                    {zone}
                  </TText>
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>
        )}

        {/* ── STEP 2: Size & Budget ── */}
        {step === 2 && (
          <Animated.View entering={FadeInDown.duration(300)} style={{ gap: Spacing.md }}>
            <TText variant="title1" weight="bold" style={styles.stepTitle}>Taille & budget</TText>
            <View>
              <TText variant="label" color="tertiary" uppercase style={{ marginBottom: Spacing.xs }}>Taille</TText>
              <SizeSelector value={sizeCategory} onChange={setSizeCategory} />
            </View>
            <View>
              <TText variant="label" color="tertiary" uppercase style={{ marginBottom: Spacing.xs }}>Budget</TText>
              <View style={styles.budgetRow}>
                <TInput
                  label="Min (€)"
                  value={budgetMin}
                  onChangeText={setBudgetMin}
                  keyboardType="numeric"
                  placeholder="150"
                  style={{ flex: 1 }}
                />
                <TText variant="body" color="tertiary" style={{ marginTop: 28 }}>–</TText>
                <TInput
                  label="Max (€)"
                  value={budgetMax}
                  onChangeText={setBudgetMax}
                  keyboardType="numeric"
                  placeholder="300"
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          </Animated.View>
        )}

        {/* ── STEP 3: Style ── */}
        {step === 3 && (
          <Animated.View entering={FadeInDown.duration(300)} style={{ gap: Spacing.md }}>
            <TText variant="title1" weight="bold" style={styles.stepTitle}>Style & couleur</TText>
            <View>
              <TText variant="label" color="tertiary" uppercase style={{ marginBottom: Spacing.xs }}>
                Styles inspirants
              </TText>
              <View style={styles.zonesGrid}>
                {STYLES.map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); toggleStylePref(s.slug); }}
                    style={[styles.zoneChip, stylePrefs.includes(s.slug) && styles.zoneChipSelected]}
                    activeOpacity={0.8}
                  >
                    <TText style={{ fontSize: 13 }}>{s.emoji}</TText>
                    <TText
                      variant="caption"
                      style={{ color: stylePrefs.includes(s.slug) ? Colors.accentWarm : Colors.textSecondary, marginLeft: 4 }}
                    >
                      {s.name}
                    </TText>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View>
              <TText variant="label" color="tertiary" uppercase style={{ marginBottom: Spacing.xs }}>Couleur</TText>
              {COLORS_OPTIONS.map((c) => (
                <OptionCard key={c.key} label={c.label} selected={colorPref === c.key} onPress={() => setColorPref(c.key)} />
              ))}
            </View>
          </Animated.View>
        )}

        {/* ── STEP 4: Description ── */}
        {step === 4 && (
          <Animated.View entering={FadeInDown.duration(300)} style={{ gap: Spacing.sm }}>
            <TText variant="title1" weight="bold" style={styles.stepTitle}>Décris ton projet</TText>
            <TInput
              label="Description"
              value={description}
              onChangeText={setDescription}
              placeholder="Décris ton idée, l'ambiance souhaitée, les références visuelles qui t'inspirent…"
              multiline
              numberOfLines={5}
              style={{ minHeight: 130 }}
            />
            <TouchableOpacity
              onPress={() => setIsFlexible(!isFlexible)}
              style={[styles.flexToggle, isFlexible && styles.flexToggleActive]}
            >
              <Ionicons
                name={isFlexible ? 'checkmark-circle' : 'ellipse-outline'}
                size={20}
                color={isFlexible ? Colors.accentWarm : Colors.textTertiary}
              />
              <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                <TText variant="bodySmall" weight="semibold">Ouvert aux suggestions</TText>
                <TText variant="caption" color="secondary" style={{ marginTop: 1 }}>
                  Je laisse une marge créative à l'artiste
                </TText>
              </View>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* ── STEP 5: Recap ── */}
        {step === 5 && (
          <Animated.View entering={FadeInDown.duration(300)} style={{ gap: Spacing.sm }}>
            <TText variant="title1" weight="bold" style={styles.stepTitle}>Récapitulatif</TText>
            <GlassCard variant="elevated" style={styles.recapCard}>
              {[
                { label: 'Artiste', value: artist.blaze },
                { label: 'Type', value: PROJECT_TYPES.find((p) => p.key === projectType)?.label ?? '' },
                { label: 'Zone', value: bodyZone },
                { label: 'Taille', value: SIZE_OPTIONS.find((s) => s.key === sizeCategory)?.label ?? '' },
                { label: 'Budget', value: `${budgetMin}–${budgetMax}€` },
                { label: 'Couleur', value: COLORS_OPTIONS.find((c) => c.key === colorPref)?.label ?? '' },
                { label: 'Styles', value: stylePrefs.join(', ') },
              ].map(({ label, value }) => value ? (
                <View key={label} style={styles.recapRow}>
                  <TText variant="caption" color="tertiary" style={{ width: 80 }}>{label}</TText>
                  <TText variant="bodySmall" style={{ flex: 1 }}>{value}</TText>
                </View>
              ) : null)}
            </GlassCard>
            {description ? (
              <GlassCard variant="default" style={{ padding: Spacing.sm }}>
                <TText variant="caption" color="tertiary" style={{ marginBottom: 4 }}>Description</TText>
                <TText variant="bodySmall" color="secondary">{description}</TText>
              </GlassCard>
            ) : null}
          </Animated.View>
        )}
      </ScrollView>

      {/* CTA bar */}
      <View style={[styles.ctaBar, { paddingBottom: insets.bottom + 8 }]}>
        {step < STEPS.length - 1 ? (
          <TButton
            title="Continuer"
            onPress={goNext}
            disabled={!canNext()}
            variant="primary"
          />
        ) : (
          <TButton
            title="Envoyer la demande →"
            onPress={handleSubmit}
            variant="primary"
          />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing['2xs'], height: 52,
  },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { alignItems: 'center', gap: 2 },
  artistContext: {
    flexDirection: 'row', paddingHorizontal: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  content: { paddingHorizontal: Spacing.sm, paddingTop: Spacing['2xs'] },
  stepTitle: { marginBottom: Spacing.md, letterSpacing: -0.8 },

  // Zones grid
  zonesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  zoneChip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.borderSubtle,
  },
  zoneChipSelected: {
    borderColor: Colors.accentWarm,
    backgroundColor: 'rgba(200,168,130,0.08)',
  },

  // Budget
  budgetRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },

  // Flexible toggle
  flexToggle: {
    flexDirection: 'row', alignItems: 'center',
    padding: Spacing.sm, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.borderSubtle,
    backgroundColor: Colors.bgSurface,
  },
  flexToggleActive: {
    borderColor: Colors.accentWarm,
    backgroundColor: 'rgba(200,168,130,0.06)',
  },

  // Recap
  recapCard: { padding: Spacing.sm, gap: Spacing['2xs'] },
  recapRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSubtle,
  },

  // CTA
  ctaBar: {
    paddingHorizontal: Spacing.sm, paddingTop: Spacing.sm,
    backgroundColor: 'rgba(5,5,8,0.97)',
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.borderSubtle,
  },
});
