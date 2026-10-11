import React, { useState, useRef, useEffect } from 'react';
import {
  View, StyleSheet, ScrollView, Pressable, KeyboardAvoidingView, Platform, BackHandler,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing, FadeInDown, useReducedMotion, useSharedValue, useAnimatedStyle, withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Radius, Layout } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TButton } from '@/components/ui/TButton';
import { TInput } from '@/components/ui/TInput';
import { TAvatar } from '@/components/ui/TAvatar';
import { TSkeleton } from '@/components/ui/TSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { BOOKING_STATUS, styleName } from '@/components/ArtistCard';
import { useRequestStore } from '@/store/request-store';
import type { SubmitPayload } from '@/store/request-store';
import { useAuthStore } from '@/store/auth-store';
import { STYLES } from '@/constants/mock-data';
import { useArtist } from '@/hooks/use-artist';

const FORM_MAX = 720;
const EASE = Easing.bezier(0.22, 1, 0.36, 1);
const haptic = (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) => {
  if (Platform.OS !== 'web') Haptics.impactAsync(style);
};

const STEPS = [
  { title: 'Votre projet', lead: 'Décrivez votre ', accent: 'projet', intro: 'Le type de tatouage et son emplacement.' },
  { title: 'Taille et budget', lead: 'Taille et ', accent: 'budget', intro: 'Une fourchette réaliste aide l’artiste à vous répondre précisément.' },
  { title: 'Votre idée', lead: 'Votre ', accent: 'idée', intro: 'Le style, la couleur et ce que vous imaginez.' },
  { title: 'Vérification', lead: 'Vérifiez votre ', accent: 'demande', intro: 'Relisez avant l’envoi. Chaque section reste modifiable.' },
] as const;
const LAST_STEP = STEPS.length - 1;

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

const PROJECT_TYPES: { key: string; label: string; icon: keyof typeof Ionicons.glyphMap; desc: string }[] = [
  { key: 'new',       label: 'Nouveau tatouage', icon: 'add-outline',         desc: 'Une pièce créée pour vous' },
  { key: 'cover_up',  label: 'Recouvrement',     icon: 'color-wand-outline',  desc: 'Recouvrir un ancien tatouage' },
  { key: 'touch_up',  label: 'Retouche',         icon: 'brush-outline',       desc: 'Raviver un tatouage existant' },
  { key: 'extension', label: 'Agrandissement',   icon: 'expand-outline',      desc: 'Prolonger une pièce existante' },
];

const COLORS_OPTIONS = [
  { key: 'black_grey', label: 'Noir et gris' },
  { key: 'full_color', label: 'Couleur' },
  { key: 'mixed',      label: 'Mixte' },
  { key: 'flexible',   label: 'Au choix de l’artiste' },
];

type FieldKey = 'projectType' | 'bodyZone' | 'budgetMin' | 'budgetMax' | 'styles' | 'color' | 'description';
type FieldErrors = Partial<Record<FieldKey, string>>;

const isAmount = (v: string) => !!v.trim() && Number.isFinite(Number(v)) && Number(v) >= 0;

// ─── Building blocks ──────────────────────────────────────────────────────────
function FieldLabel({ children, error }: { children: string; error?: string }) {
  return (
    <View style={styles.fieldLabel}>
      <TText variant="caption" weight="medium" color="secondary">{children}</TText>
      {!!error && (
        <TText variant="caption" color="error" accessibilityLiveRegion="polite" style={{ marginTop: 4 }}>{error}</TText>
      )}
    </View>
  );
}

function Chip({ label, selected, onPress, role = 'radio' }: {
  label: string; selected: boolean; onPress: () => void; role?: 'radio' | 'checkbox';
}) {
  return (
    <Pressable
      onPress={() => { haptic(); onPress(); }}
      accessibilityRole={role}
      accessibilityState={role === 'checkbox' ? { checked: selected } : { selected, checked: selected }}
      style={(state) => {
        const { pressed, hovered } = state as { pressed: boolean; hovered?: boolean };
        return [styles.chip, (pressed || hovered) && !selected && styles.chipHover, selected && styles.chipSelected];
      }}
    >
      <TText variant="caption" weight="medium" style={{ fontSize: 13, color: selected ? Colors.textInverse : Colors.textSecondary }}>
        {label}
      </TText>
    </Pressable>
  );
}

function OptionRow({ label, desc, icon, selected, onPress, last }: {
  label: string; desc: string; icon: keyof typeof Ionicons.glyphMap; selected: boolean; onPress: () => void; last?: boolean;
}) {
  return (
    <Pressable
      onPress={() => { haptic(); onPress(); }}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, selected }}
      accessibilityLabel={`${label}. ${desc}`}
      style={(state) => {
        const { pressed, hovered } = state as { pressed: boolean; hovered?: boolean };
        return [styles.optionRow, !last && styles.optionDivider, (pressed || hovered || selected) && styles.optionActive];
      }}
    >
      <View style={[styles.optionIcon, selected && styles.optionIconSelected]}>
        <Ionicons name={icon} size={18} color={selected ? Colors.accentGlow : Colors.textSecondary} />
      </View>
      <View style={{ flex: 1 }}>
        <TText variant="body" weight="medium">{label}</TText>
        <TText variant="caption" color="tertiary" style={{ marginTop: 1 }}>{desc}</TText>
      </View>
      <View style={[styles.radio, selected && styles.radioOn]}>
        {selected && <View style={styles.radioDot} />}
      </View>
    </Pressable>
  );
}

function ProgressLine({ step, reduced }: { step: number; reduced: boolean }) {
  const [trackW, setTrackW] = useState(0);
  const width = useSharedValue(0);
  const target = trackW * ((step + 1) / STEPS.length);
  useEffect(() => {
    width.value = reduced ? target : withTiming(target, { duration: 600, easing: EASE });
  }, [target, reduced, width]);
  const fill = useAnimatedStyle(() => ({ width: width.value }));
  return (
    <View
      style={styles.progressTrack}
      onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 1, max: STEPS.length, now: step + 1, text: `Étape ${step + 1} sur ${STEPS.length}` }}
    >
      <Animated.View style={[styles.progressFill, fill]} />
    </View>
  );
}

function RecapSection({ title, onEdit, children }: { title: string; onEdit: () => void; children: React.ReactNode }) {
  return (
    <View style={styles.recapSection}>
      <View style={styles.recapHead}>
        <TText variant="label" color="accentWarm" uppercase>{title}</TText>
        <Pressable onPress={onEdit} accessibilityRole="button" accessibilityLabel={`Modifier : ${title}`} hitSlop={10} style={styles.editLink}>
          <TText variant="caption" color="secondary" style={{ textDecorationLine: 'underline' }}>Modifier</TText>
        </Pressable>
      </View>
      {children}
    </View>
  );
}

function RecapRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.recapRow}>
      <TText variant="bodySmall" color="tertiary" style={styles.recapLabel}>{label}</TText>
      <TText variant="bodySmall" weight="medium" tabular style={{ flex: 1 }}>{value}</TText>
    </View>
  );
}

function FormSkeleton({ top }: { top: number }) {
  return (
    <View style={[styles.container, { paddingTop: top + Spacing.sm }]}>
      <View style={[styles.frame, { paddingHorizontal: Layout.gutter, gap: 14 }]}>
        <TSkeleton width={40} height={40} radius={20} />
        <TSkeleton height={2} />
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', marginTop: 8 }}>
          <TSkeleton width={32} height={32} radius={16} />
          <TSkeleton width="45%" height={14} />
        </View>
        <TSkeleton width="70%" height={32} style={{ marginTop: 16 }} />
        <TSkeleton width="55%" height={14} />
        <TSkeleton height={240} radius={Radius.lg} style={{ marginTop: 12 }} />
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function NewRequestScreen() {
  const { artistId } = useLocalSearchParams<{ artistId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const { submitRequest } = useRequestStore();
  const { user } = useAuthStore();

  const { artist, loading, error, retry } = useArtist(artistId);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const [step, setStep] = useState(0);
  const [attempted, setAttempted] = useState<Record<number, boolean>>({});
  const [projectType, setProjectType] = useState('');
  const [bodyZone, setBodyZone] = useState('');
  const [sizeCategory, setSizeCategory] = useState('m');
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [stylePrefs, setStylePrefs] = useState<string[]>([]);
  const [colorPref, setColorPref] = useState('');
  const [isFlexible, setIsFlexible] = useState(false);
  const [description, setDescription] = useState('');

  // Same rules as before the redesign, expressed per field so messages sit next to inputs.
  const validate = (s: number): FieldErrors => {
    const e: FieldErrors = {};
    if (s === 0) {
      if (!projectType) e.projectType = 'Choisissez un type de projet.';
      if (!bodyZone) e.bodyZone = 'Choisissez une zone du corps.';
    }
    if (s === 1) {
      if (!budgetMin.trim()) e.budgetMin = 'Indiquez un minimum.';
      else if (!isAmount(budgetMin)) e.budgetMin = 'Saisissez un nombre, sans symbole.';
      if (!budgetMax.trim()) e.budgetMax = 'Indiquez un maximum.';
      else if (!isAmount(budgetMax)) e.budgetMax = 'Saisissez un nombre, sans symbole.';
      else if (isAmount(budgetMin) && Number(budgetMax) < Number(budgetMin)) e.budgetMax = 'Le maximum doit être au moins égal au minimum.';
    }
    if (s === 2) {
      if (stylePrefs.length === 0) e.styles = 'Choisissez au moins un style.';
      if (!colorPref) e.color = 'Choisissez une option de couleur.';
      if (description.trim().length < 10) e.description = 'Décrivez votre projet en 10 caractères au moins.';
    }
    return e;
  };

  const errors = attempted[step] ? validate(step) : {};
  const canNext = () => !!sizeCategory && Object.keys(validate(step)).length === 0;

  const goToStep = (next: number) => {
    setStep(next);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  const goNext = () => {
    if (!canNext()) {
      setAttempted((a) => ({ ...a, [step]: true }));
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    haptic(Haptics.ImpactFeedbackStyle.Medium);
    if (step < LAST_STEP) goToStep(step + 1);
  };

  const leave = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/explore'));

  const goBack = () => {
    if (step === 0) { leave(); return; }
    haptic();
    goToStep(step - 1);
  };

  // Android back steps through the form instead of discarding it.
  const stepRef = useRef(step);
  useEffect(() => { stepRef.current = step; }, [step]);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stepRef.current === 0) return false;
      setStep((s) => Math.max(0, s - 1));
      return true;
    });
    return () => sub.remove();
  }, []);

  const handleSubmit = async () => {
    if (submittingRef.current || !artist || artist.bookingStatus !== 'open') return;
    if (!user?.id) { setSubmitError('Connectez-vous pour envoyer votre demande.'); return; }
    if (!projectType || !bodyZone || description.trim().length < 10 || !budgetMin.trim() || !budgetMax.trim() || !Number.isFinite(Number(budgetMin)) || !Number.isFinite(Number(budgetMax)) || Number(budgetMin) < 0 || Number(budgetMax) < Number(budgetMin)) {
      setSubmitError('Complétez le projet, une description de 10 caractères et un budget cohérent.'); return;
    }
    submittingRef.current = true; setSubmitting(true); setSubmitError(null);

    const colorMap: Record<string, SubmitPayload['colorPreference']> = {
      black_grey: 'black_grey',
      full_color: 'color',
      mixed: 'color',
      flexible: 'artist_choice',
    };

    const payload: SubmitPayload = {
      artistId: artist.id,
      projectType: projectType as SubmitPayload['projectType'],
      bodyZone,
      sizeCategory: sizeCategory as SubmitPayload['sizeCategory'],
      budgetMin: Number(budgetMin),
      budgetMax: Number(budgetMax),
      colorPreference: colorMap[colorPref] ?? 'artist_choice',
      stylePreference: stylePrefs.join(', ') || undefined,
      description: description.trim(),
      flexibilityLevel: isFlexible ? 'open' : 'precise',
    };

    const { id: requestId, error: sendError } = await submitRequest(payload, user.id);
    submittingRef.current = false; setSubmitting(false);
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(sendError ? Haptics.NotificationFeedbackType.Error : Haptics.NotificationFeedbackType.Success);
    }
    if (sendError || !requestId) { setSubmitError(sendError ?? 'Envoi impossible. Votre formulaire est conservé.'); return; }
    router.replace({ pathname: '/request/[id]', params: { id: requestId } });
  };

  const toggleStylePref = (slug: string) => {
    setStylePrefs((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]));
  };

  // ── Unavailable states ──
  if (!artist && loading) return <FormSkeleton top={insets.top} />;
  if (!artist || artist.bookingStatus !== 'open') {
    const closedCopy = artist?.bookingStatus === 'paused'
      ? `${artist.blaze} est sur liste d’attente et n’accepte pas de nouvelle demande pour le moment.`
      : `${artist?.blaze ?? 'Cet artiste'} ne prend pas de nouveaux projets actuellement.`;
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={[styles.frame, styles.header]}>
          <Pressable onPress={leave} accessibilityRole="button" accessibilityLabel="Fermer" hitSlop={6} style={styles.roundBtn}>
            <Ionicons name="close" size={20} color={Colors.textPrimary} />
          </Pressable>
        </View>
        {error ? (
          <EmptyState icon="cloud-offline-outline" title="Chargement impossible" description={error} ctaLabel="Réessayer" onCta={retry} />
        ) : artist ? (
          <EmptyState icon="pause-outline" title="Demandes fermées" description={closedCopy} ctaLabel="Explorer les artistes" onCta={() => router.replace('/(tabs)/explore')} />
        ) : (
          <EmptyState icon="person-outline" title="Artiste introuvable" description="Ce profil n’existe pas ou n’est plus public." ctaLabel="Explorer les artistes" onCta={() => router.replace('/(tabs)/explore')} />
        )}
      </View>
    );
  }

  const meta = STEPS[step];
  const status = BOOKING_STATUS[artist.bookingStatus];
  const entering = reduced ? undefined : FadeInDown.duration(600).easing(EASE);
  const descLength = description.trim().length;
  const colorLabel = COLORS_OPTIONS.find((c) => c.key === colorPref)?.label ?? '';
  const sizeOpt = SIZE_OPTIONS.find((s) => s.key === sizeCategory);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* ── Header: back, step counter, gold progress line ── */}
      <View style={styles.frame}>
        <View style={styles.header}>
          <Pressable
            onPress={goBack}
            accessibilityRole="button"
            accessibilityLabel={step === 0 ? 'Fermer le formulaire' : 'Étape précédente'}
            hitSlop={6}
            style={({ pressed }) => [styles.roundBtn, pressed && { opacity: 0.6 }]}
          >
            <Ionicons name={step === 0 ? 'close' : 'chevron-back'} size={20} color={Colors.textPrimary} />
          </Pressable>
          <View style={styles.headerCenter}>
            <TText variant="caption" color="tertiary" tabular accessibilityRole="header">
              Étape {step + 1} sur {STEPS.length}
            </TText>
            <TText variant="bodySmall" weight="semibold" numberOfLines={1}>{meta.title}</TText>
          </View>
          <View style={{ width: 40 }} />
        </View>
        <ProgressLine step={step} reduced={reduced} />

        {/* Who you are writing to */}
        <View style={styles.artistContext} accessible accessibilityLabel={`Demande à ${artist.blaze}, ${artist.city}. ${status.label}`}>
          <TAvatar uri={artist.avatarUrl} name={artist.blaze} size="sm" />
          <View style={{ flex: 1 }}>
            <TText variant="caption" color="tertiary">Demande à</TText>
            <TText variant="body" serif numberOfLines={1} style={{ fontSize: 19, lineHeight: 22 }}>
              {artist.blaze}
              <TText variant="caption" color="tertiary">{artist.city ? `  ·  ${artist.city}` : ''}</TText>
            </TText>
          </View>
          <View style={styles.statusLine}>
            <View style={[styles.statusDot, { backgroundColor: status.color }]} />
            <TText variant="caption" color="secondary">{status.short}</TText>
          </View>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: Spacing['2xl'] }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Animated.View key={step} entering={entering}>
          <TText variant="displayS" style={styles.stepTitle}>
            {meta.lead}<TText variant="displayS" italic color="accentGlow">{meta.accent}</TText>
          </TText>
          <TText variant="bodySmall" color="secondary" style={styles.stepIntro}>{meta.intro}</TText>

          {/* ── Step 1: project type + zone ── */}
          {step === 0 && (
            <View style={styles.fields}>
              <View>
                <FieldLabel error={errors.projectType}>Type de projet</FieldLabel>
                <View style={[styles.optionGroup, !!errors.projectType && styles.groupError]} accessibilityRole="radiogroup">
                  {PROJECT_TYPES.map((pt, i) => (
                    <OptionRow
                      key={pt.key}
                      label={pt.label}
                      desc={pt.desc}
                      icon={pt.icon}
                      selected={projectType === pt.key}
                      onPress={() => setProjectType(pt.key)}
                      last={i === PROJECT_TYPES.length - 1}
                    />
                  ))}
                </View>
              </View>
              <View>
                <FieldLabel error={errors.bodyZone}>Zone du corps</FieldLabel>
                <View style={styles.wrap} accessibilityRole="radiogroup">
                  {BODY_ZONES.map((zone) => (
                    <Chip key={zone} label={zone} selected={bodyZone === zone} onPress={() => setBodyZone(zone)} />
                  ))}
                </View>
              </View>
            </View>
          )}

          {/* ── Step 2: size + budget ── */}
          {step === 1 && (
            <View style={styles.fields}>
              <View>
                <FieldLabel>Taille approximative</FieldLabel>
                <View style={styles.sizeRow} accessibilityRole="radiogroup">
                  {SIZE_OPTIONS.map((opt) => {
                    const selected = sizeCategory === opt.key;
                    return (
                      <Pressable
                        key={opt.key}
                        onPress={() => { haptic(); setSizeCategory(opt.key); }}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: selected, selected }}
                        accessibilityLabel={`Taille ${opt.label}, ${opt.sub}`}
                        style={[styles.sizeCell, selected && styles.sizeCellSelected]}
                      >
                        <TText variant="bodySmall" weight="semibold" style={{ color: selected ? Colors.textInverse : Colors.textPrimary }}>{opt.label}</TText>
                        <TText variant="micro" tabular style={{ color: selected ? Colors.textInverse : Colors.textTertiary, opacity: selected ? 0.75 : 1 }}>{opt.sub}</TText>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              <View>
                <FieldLabel>Budget envisagé</FieldLabel>
                <View style={styles.budgetRow}>
                  <TInput
                    label="Minimum"
                    value={budgetMin}
                    onChangeText={setBudgetMin}
                    keyboardType="numeric"
                    inputMode="numeric"
                    placeholder="150"
                    error={errors.budgetMin}
                    rightElement={<TText variant="bodySmall" color="tertiary">€</TText>}
                    containerStyle={{ flex: 1, marginBottom: 0 }}
                    accessibilityLabel="Budget minimum en euros"
                  />
                  <TInput
                    label="Maximum"
                    value={budgetMax}
                    onChangeText={setBudgetMax}
                    keyboardType="numeric"
                    inputMode="numeric"
                    placeholder="300"
                    error={errors.budgetMax}
                    rightElement={<TText variant="bodySmall" color="tertiary">€</TText>}
                    containerStyle={{ flex: 1, marginBottom: 0 }}
                    accessibilityLabel="Budget maximum en euros"
                  />
                </View>
                <TText variant="caption" color="tertiary" style={{ marginTop: Spacing.xs }}>
                  {artist.minBudget > 0
                    ? `Les projets de ${artist.blaze} commencent à ${artist.minBudget.toLocaleString('fr-FR')} €. Le prix final fait l’objet d’un devis.`
                    : 'Indicatif : le prix final fait l’objet d’un devis de l’artiste.'}
                </TText>
              </View>
            </View>
          )}

          {/* ── Step 3: style, colour, description ── */}
          {step === 2 && (
            <View style={styles.fields}>
              <View>
                <FieldLabel error={errors.styles}>Styles qui vous inspirent</FieldLabel>
                <View style={styles.wrap}>
                  {STYLES.map((s) => (
                    <Chip key={s.id} role="checkbox" label={s.name} selected={stylePrefs.includes(s.slug)} onPress={() => toggleStylePref(s.slug)} />
                  ))}
                </View>
              </View>
              <View>
                <FieldLabel error={errors.color}>Couleur</FieldLabel>
                <View style={styles.wrap} accessibilityRole="radiogroup">
                  {COLORS_OPTIONS.map((c) => (
                    <Chip key={c.key} label={c.label} selected={colorPref === c.key} onPress={() => setColorPref(c.key)} />
                  ))}
                </View>
              </View>
              <TInput
                label="Description"
                value={description}
                onChangeText={setDescription}
                placeholder="Votre idée, l’ambiance recherchée, les motifs, les références qui vous inspirent…"
                multiline
                numberOfLines={6}
                textAlignVertical="top"
                error={errors.description}
                helper={descLength < 10 ? `${descLength} caractère${descLength > 1 ? 's' : ''} · 10 minimum` : `${descLength} caractères`}
                inputStyle={{ minHeight: 140, paddingTop: 14 }}
                containerStyle={{ marginBottom: 0 }}
              />

              <Pressable
                onPress={() => { haptic(); setIsFlexible(!isFlexible); }}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isFlexible }}
                style={styles.toggleRow}
              >
                <View style={[styles.checkbox, isFlexible && styles.checkboxOn]}>
                  {isFlexible && <Ionicons name="checkmark" size={14} color={Colors.textInverse} />}
                </View>
                <View style={{ flex: 1 }}>
                  <TText variant="bodySmall" weight="medium">Ouvert aux suggestions</TText>
                  <TText variant="caption" color="tertiary" style={{ marginTop: 1 }}>Vous laissez une marge créative à l’artiste.</TText>
                </View>
              </Pressable>

              {/* Attachments are not wired yet (uploads are disabled server-side): say so plainly. */}
              <View style={styles.notice} accessible accessibilityLabel="Images de référence : pas encore disponibles. Décrivez vos références dans le texte.">
                <Ionicons name="images-outline" size={18} color={Colors.textTertiary} />
                <View style={{ flex: 1 }}>
                  <TText variant="bodySmall" weight="medium" color="secondary">Images de référence</TText>
                  <TText variant="caption" color="tertiary" style={{ marginTop: 1 }}>
                    Pas encore disponible. Décrivez vos références dans le texte.
                  </TText>
                </View>
              </View>
            </View>
          )}

          {/* ── Step 4: summary before sending ── */}
          {step === 3 && (
            <View>
              <RecapSection title="Le projet" onEdit={() => { setSubmitError(null); goToStep(0); }}>
                <RecapRow label="Type" value={PROJECT_TYPES.find((p) => p.key === projectType)?.label ?? '—'} />
                <RecapRow label="Zone" value={bodyZone || '—'} />
              </RecapSection>
              <RecapSection title="Taille et budget" onEdit={() => { setSubmitError(null); goToStep(1); }}>
                <RecapRow label="Taille" value={sizeOpt ? `${sizeOpt.label} · ${sizeOpt.sub}` : '—'} />
                <RecapRow
                  label="Budget"
                  value={`${Number(budgetMin).toLocaleString('fr-FR')} – ${Number(budgetMax).toLocaleString('fr-FR')} €`}
                />
              </RecapSection>
              <RecapSection title="Votre idée" onEdit={() => { setSubmitError(null); goToStep(2); }}>
                <RecapRow label="Styles" value={stylePrefs.map(styleName).join(', ') || '—'} />
                <RecapRow label="Couleur" value={colorLabel || '—'} />
                <RecapRow label="Approche" value={isFlexible ? 'Ouvert aux suggestions' : 'Projet précis'} />
                <TText variant="body" color="secondary" style={styles.recapProse}>{description.trim()}</TText>
              </RecapSection>
              <TText variant="caption" color="tertiary" style={{ marginTop: Spacing.lg }}>
                {artist.blaze} étudiera votre demande et établira un devis. Sa réponse apparaîtra dans vos demandes.
              </TText>
            </View>
          )}
        </Animated.View>
      </ScrollView>

      {/* ── Pinned action ── */}
      <View style={[styles.ctaBar, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.ctaInner}>
          {!!submitError && (
            <View style={styles.errorBanner} accessibilityRole="alert" accessibilityLiveRegion="assertive">
              <Ionicons name="alert-circle-outline" size={18} color={Colors.errorLight} />
              <View style={{ flex: 1 }}>
                <TText variant="bodySmall" weight="medium" style={{ color: Colors.errorLight }}>{submitError}</TText>
                <TText variant="caption" color="tertiary">Vos réponses sont conservées. Vous pouvez réessayer.</TText>
              </View>
            </View>
          )}
          {attempted[step] && Object.keys(errors).length > 0 && (
            <TText variant="caption" color="error" style={{ marginBottom: Spacing['2xs'] }} accessibilityLiveRegion="polite">
              Complétez les champs indiqués pour continuer.
            </TText>
          )}
          <View style={styles.ctaRow}>
            {step > 0 && (
              <TButton title="Retour" variant="secondary" onPress={goBack} fullWidth={false} accessibilityLabel="Étape précédente" />
            )}
            <View style={{ flex: 1 }}>
              {step < LAST_STEP ? (
                <TButton title="Continuer" onPress={goNext} />
              ) : (
                <TButton
                  title={submitError ? 'Réessayer l’envoi' : 'Envoyer la demande'}
                  loading={submitting}
                  onPress={handleSubmit}
                  accessibilityLabel={`Envoyer la demande à ${artist.blaze}`}
                />
              )}
            </View>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  frame: { width: '100%', maxWidth: FORM_MAX + Layout.gutter * 2, alignSelf: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm, height: 56,
  },
  headerCenter: { flex: 1, alignItems: 'center', gap: 1 },
  roundBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderDefault,
  },

  progressTrack: {
    height: 2, marginHorizontal: Layout.gutter,
    backgroundColor: Colors.borderDefault, borderRadius: 1, overflow: 'hidden',
  },
  progressFill: { height: 2, backgroundColor: Colors.accentWarm },

  artistContext: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    paddingHorizontal: Layout.gutter, paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.borderSubtle,
  },
  statusLine: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },

  content: {
    width: '100%', maxWidth: FORM_MAX + Layout.gutter * 2, alignSelf: 'center',
    paddingHorizontal: Layout.gutter, paddingTop: Spacing.lg,
  },
  stepTitle: { marginBottom: 6 },
  stepIntro: { marginBottom: Spacing.xl, maxWidth: Layout.maxReading },
  fields: { gap: Spacing.xl },
  fieldLabel: { marginBottom: Spacing.xs },

  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    height: 36, paddingHorizontal: 14, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.borderDefault,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } as object : null),
  },
  chipHover: { backgroundColor: Colors.glassBgMid },
  chipSelected: { backgroundColor: Colors.accentAction, borderColor: Colors.accentAction },

  optionGroup: {
    borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderDefault,
    overflow: 'hidden',
  },
  groupError: { borderColor: Colors.error },
  optionRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    paddingHorizontal: Spacing.sm, paddingVertical: 14, minHeight: 64,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } as object : null),
  },
  optionDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.borderDefault },
  optionActive: { backgroundColor: Colors.glassBg },
  optionIcon: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderDefault,
  },
  optionIconSelected: { borderColor: Colors.borderGlow, backgroundColor: Colors.glassAmber },
  radio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 1.5, borderColor: Colors.textTertiary,
    alignItems: 'center', justifyContent: 'center',
  },
  radioOn: { borderColor: Colors.accentWarm },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.accentWarm },

  sizeRow: { flexDirection: 'row', gap: 6 },
  sizeCell: {
    flex: 1, minHeight: 60, alignItems: 'center', justifyContent: 'center', gap: 2,
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.borderDefault,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } as object : null),
  },
  sizeCellSelected: { backgroundColor: Colors.accentAction, borderColor: Colors.accentAction },

  budgetRow: { flexDirection: 'row', gap: Spacing.xs, alignItems: 'flex-start' },

  toggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    paddingVertical: Spacing.xs, minHeight: 48,
  },
  checkbox: {
    width: 22, height: 22, borderRadius: Radius.sm,
    borderWidth: 1.5, borderColor: Colors.textTertiary,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: Colors.accentAction, borderColor: Colors.accentAction },

  notice: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.xs,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.borderDefault,
  },

  recapSection: {
    paddingVertical: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.borderDefault,
  },
  recapHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.xs },
  editLink: { minHeight: 32, justifyContent: 'center' },
  recapRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, paddingVertical: 6 },
  recapLabel: { width: 96 },
  recapProse: { marginTop: Spacing.xs, maxWidth: Layout.maxReading },

  ctaBar: {
    paddingTop: 12, paddingHorizontal: Layout.gutter,
    backgroundColor: 'rgba(11,10,9,0.96)',
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.borderDefault,
  },
  ctaInner: { width: '100%', maxWidth: FORM_MAX, alignSelf: 'center' },
  ctaRow: { flexDirection: 'row', gap: Spacing.xs, alignItems: 'center' },
  errorBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing['2xs'],
    padding: Spacing.xs, marginBottom: Spacing.xs,
    borderRadius: Radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(217,105,95,0.45)',
    backgroundColor: 'rgba(217,105,95,0.08)',
  },
});
