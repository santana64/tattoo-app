import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View, StyleSheet, ScrollView, Pressable, KeyboardAvoidingView, Platform, BackHandler,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Radius, Layout } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TButton } from '@/components/ui/TButton';
import { TInput } from '@/components/ui/TInput';
import { TAvatar } from '@/components/ui/TAvatar';
import { TSkeleton } from '@/components/ui/TSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  Choice, DetailRow, EditorialTitle, IconButton, Kicker, StatusDot, StepProgress, TextLink,
} from '@/components/v5';
import { BOOKING_STATUS, styleName } from '@/components/ArtistCard';
import { useRequestStore } from '@/store/request-store';
import type { SubmitPayload } from '@/store/request-store';
import { useAuthStore } from '@/store/auth-store';
import { STYLES } from '@/constants/tattoo';
import { useArtist } from '@/hooks/use-artist';
import { useContentDimensions } from '@/hooks/useContentDimensions';
import { enterUp, RevealImage } from '@/components/motion';
import { SlotPicker, formatChosenSlot } from '@/components/booking/SlotPicker';
import { fetchFlash, flashCopiesLeft, type FlashDesign } from '@/lib/studio';
import { durationLabel, fetchBookingSettings, type BookingSettings } from '@/lib/care';
import { cancellationNotice } from '@/components/booking/booking-copy';
import { attachReference, pickImage } from '@/lib/storage';
import { randomUUID } from 'expo-crypto';
import { clearPendingRequest, loadPendingRequest, savePendingRequest } from '@/lib/pending-request';

const FORM_MAX = 640;
const haptic = (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) => {
  if (Platform.OS !== 'web') Haptics.impactAsync(style);
};

const STEPS = [
  { title: 'Votre projet', lead: 'Décrivez votre ', accent: 'projet.', intro: 'Le type de tatouage et son emplacement.' },
  { title: 'Taille et budget', lead: 'Taille et ', accent: 'budget.', intro: 'Une fourchette réaliste aide l’artiste à vous répondre précisément.' },
  { title: 'Votre idée', lead: 'Votre ', accent: 'idée.', intro: 'Le style, la couleur et ce que vous imaginez.' },
  { title: 'Vérification', lead: 'Vérifiez votre ', accent: 'demande.', intro: 'Relisez avant l’envoi. Chaque section reste modifiable.' },
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

const PROJECT_TYPES: { key: string; label: string; desc: string }[] = [
  { key: 'new',       label: 'Nouveau tatouage', desc: 'Une pièce créée pour vous' },
  { key: 'cover_up',  label: 'Recouvrement',     desc: 'Recouvrir un ancien tatouage' },
  { key: 'touch_up',  label: 'Retouche',         desc: 'Raviver un tatouage existant' },
  { key: 'extension', label: 'Agrandissement',   desc: 'Prolonger une pièce existante' },
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

const FLASH_UNAVAILABLE = 'Ce flash n’est plus disponible.';
const DEFAULT_SESSION_MIN = 120;

/** One of our zone chips when the flash placement matches it, else the flash's own wording. */
function matchZone(zone: string | null | undefined): string | null {
  const clean = zone?.trim();
  if (!clean) return null;
  return BODY_ZONES.find((z) => z.toLowerCase() === clean.toLowerCase()) ?? clean;
}

type FlashState = 'none' | 'loading' | 'ready' | 'unavailable';
type Hover = { pressed: boolean; hovered?: boolean };

const webPointer = Platform.OS === 'web'
  ? ({ cursor: 'pointer', transitionProperty: 'background-color, border-color', transitionDuration: '180ms' } as object)
  : null;

// ─── Building blocks ──────────────────────────────────────────────────────────
function FieldLabel({ children, error }: { children: string; error?: string }) {
  return (
    <View style={styles.fieldLabel}>
      <Kicker>{children}</Kicker>
      {!!error && (
        <TText variant="caption" color="error" accessibilityLiveRegion="polite" style={{ marginTop: 6 }}>{error}</TText>
      )}
    </View>
  );
}

/** Pill (same drawing as TChip) carrying a radio or checkbox role. */
function Chip({ label, selected, onPress, role = 'radio' }: {
  label: string; selected: boolean; onPress: () => void; role?: 'radio' | 'checkbox';
}) {
  return (
    <Pressable
      onPress={() => { haptic(); onPress(); }}
      accessibilityRole={role}
      accessibilityState={role === 'checkbox' ? { checked: selected } : { selected, checked: selected }}
      hitSlop={4}
      style={(state) => {
        const { pressed, hovered } = state as Hover;
        return [styles.chip, (pressed || hovered) && !selected && styles.chipHover, selected && styles.chipSelected];
      }}
    >
      <TText variant="caption" weight="semibold" style={{ fontSize: 12.5, lineHeight: 16, color: selected ? Colors.paper : Colors.ink }}>
        {label}
      </TText>
    </Pressable>
  );
}

/** The phone intro title: same signature as EditorialTitle, sized for a compact ink band. */
function CompactTitle() {
  return (
    <TText variant="displayL" accessibilityRole="header" style={[styles.compactTitle, { color: Colors.onInk }]}>
      Votre <TText variant="displayL" italic style={[styles.compactTitle, { color: Colors.flameOnInk }]}>projet.</TText>
    </TText>
  );
}

/** Rare moment, composed: a vermilion kicker, the artist's name, a rule that signs underneath. */
function RequestSent({ artistName, summary, top, bottom, onOpen, onExplore }: {
  artistName: string; summary: string; top: number; bottom: number; onOpen: () => void; onExplore: () => void;
}) {
  return (
    <View style={[styles.container, { paddingTop: top, paddingBottom: bottom + Spacing.lg }]}>
      <View style={styles.sentBody}>
        <Animated.View entering={enterUp(0, 120)} style={{ alignItems: 'center' }}>
          <Kicker tone="flame" style={{ marginBottom: Spacing.sm }}>Demande envoyée</Kicker>
          <View accessibilityLiveRegion="polite">
            <EditorialTitle emphasis={`${artistName}.`} breakEmphasis style={{ textAlign: 'center' }}>Envoyée à</EditorialTitle>
          </View>
        </Animated.View>
        <View style={styles.sentLine} />
        <Animated.View entering={enterUp(1, 120)} style={{ alignItems: 'center' }}>
          <TText variant="body" color="secondary" style={{ textAlign: 'center', maxWidth: 420 }}>
            {artistName} étudiera votre projet et établira un devis. Sa réponse apparaîtra dans vos demandes.
          </TText>
          <TText variant="caption" color="tertiary" tabular style={{ textAlign: 'center', marginTop: Spacing.sm }}>{summary}</TText>
        </Animated.View>
      </View>
      <View style={styles.sentActions}>
        <TButton title="Suivre ma demande" onPress={onOpen} />
        <TButton title="Explorer d’autres artistes" variant="ghost" onPress={onExplore} />
      </View>
    </View>
  );
}

function FlashBanner({ state, flash }: { state: FlashState; flash: FlashDesign | null }) {
  if (state === 'none') return null;
  if (state === 'loading') {
    return (
      <View style={styles.flashBanner}>
        <TSkeleton width={52} height={64} />
        <View style={{ flex: 1, gap: 6 }}>
          <TSkeleton width="30%" height={10} />
          <TSkeleton width="60%" height={16} />
        </View>
      </View>
    );
  }
  if (state === 'unavailable' || !flash) {
    return (
      <View style={styles.flashBanner} accessibilityRole="alert">
        <Ionicons name="flash-off-outline" size={18} color={Colors.textTertiary} />
        <TText variant="bodySmall" color="secondary" style={{ flex: 1 }}>
          {FLASH_UNAVAILABLE} Vous pouvez tout de même décrire votre projet.
        </TText>
      </View>
    );
  }
  const price = `${flash.price.toLocaleString('fr-FR')} €`;
  return (
    <View style={styles.flashBanner} accessible accessibilityLabel={`Flash « ${flash.title} », ${price}`}>
      <RevealImage uri={flash.image_url} style={styles.flashThumb} />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Kicker tone="flame">Flash</Kicker>
        <TText variant="displayS" numberOfLines={1} style={{ fontSize: 22, lineHeight: 25, letterSpacing: -0.3 }}>{flash.title}</TText>
      </View>
      <TText variant="bodySmall" weight="semibold" tabular>{price}</TText>
    </View>
  );
}

function RecapSection({ index, title, onEdit, children }: {
  index: number; title: string; onEdit: () => void; children: React.ReactNode;
}) {
  return (
    <View style={styles.recapSection}>
      <View style={styles.recapHead}>
        <Kicker tone="flame">{`${String(index).padStart(2, '0')} · ${title}`}</Kicker>
        <TextLink label="Modifier" icon="create-outline" onPress={onEdit} accessibilityLabel={`Modifier : ${title}`} />
      </View>
      {children}
    </View>
  );
}

function FormSkeleton({ top }: { top: number }) {
  return (
    <View style={[styles.container, { paddingTop: top + Spacing.sm }]}>
      <View style={{ width: '100%', maxWidth: FORM_MAX + Layout.gutter * 2, alignSelf: 'center', paddingHorizontal: Layout.gutter, gap: 14 }}>
        <TSkeleton width={44} height={44} />
        <TSkeleton width="40%" height={10} style={{ marginTop: 16 }} />
        <TSkeleton width="70%" height={44} />
        <TSkeleton height={3} style={{ marginTop: 8 }} />
        <TSkeleton width="55%" height={14} style={{ marginTop: 16 }} />
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
          <TSkeleton width="48%" height={86} />
          <TSkeleton width="48%" height={86} />
        </View>
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function NewRequestScreen() {
  const { artistId, flashId } = useLocalSearchParams<{ artistId: string; flashId?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isWide, width, gutter } = useContentDimensions();
  const { submitRequest, fetchRequest } = useRequestStore();
  const { user } = useAuthStore();

  const { artist, loading, error, retry } = useArtist(artistId);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [sentId, setSentId] = useState<string | null>(null);
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
  const [stableRequestId, setStableRequestId] = useState<string | null>(null);
  const [restoringPending, setRestoringPending] = useState(true);
  const [restoreError, setRestoreError] = useState(false);
  const [restoreAttempt, setRestoreAttempt] = useState(0);
  const [recoveredRequest, setRecoveredRequest] = useState(false);
  const [referenceUris, setReferenceUris] = useState<string[]>([]);
  const [pickingReferences, setPickingReferences] = useState(false);
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
  const [preferredSlots, setPreferredSlots] = useState<string[]>([]);
  const [flash, setFlash] = useState<FlashDesign | null>(null);
  const [flashState, setFlashState] = useState<FlashState>(flashId ? 'loading' : 'none');
  // The artist's session lengths and cancellation notice; the form works without them.
  const [booking, setBooking] = useState<BookingSettings | null>(null);
  const [bookingLoaded, setBookingLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    if (!artist?.id || !user?.id) { setRestoringPending(false); return; }
    const scope = { userId: user.id, artistId: artist.id, flashId };
    setStableRequestId(null);
    setPendingRequestId(null);
    setRecoveredRequest(false);
    setRestoreError(false);
    setRestoringPending(true);
    loadPendingRequest(scope)
      .then(async (id) => {
        if (!active || !id) return;
        setStableRequestId(id);
        const existing = await fetchRequest(id, user.id);
        if (active && existing) { setPendingRequestId(id); setRecoveredRequest(true); }
      })
      .catch(() => {
        if (active) setRestoreError(true);
      })
      .finally(() => { if (active) setRestoringPending(false); });
    return () => { active = false; };
  }, [artist?.id, user?.id, flashId, fetchRequest, restoreAttempt]);

  useEffect(() => {
    if (!artistId) { setBookingLoaded(true); return; }
    let active = true;
    setBookingLoaded(false);
    fetchBookingSettings(artistId)
      .then((settings) => { if (active) setBooking(settings); })
      .catch(() => { if (active) setBooking(null); })
      .finally(() => { if (active) setBookingLoaded(true); });
    return () => { active = false; };
  }, [artistId]);

  // A flash opens the form prefilled; every field stays editable and nothing typed is overwritten.
  useEffect(() => {
    if (!flashId) { setFlash(null); setFlashState('none'); return; }
    let active = true;
    setFlashState('loading');
    fetchFlash(flashId)
      .then((f) => {
        if (!active) return;
        if (!f || f.artist_id !== artistId || !f.is_published || flashCopiesLeft(f) === 0) {
          setFlash(null); setFlashState('unavailable'); return;
        }
        setFlash(f); setFlashState('ready');
        const zone = matchZone(f.body_zone);
        setProjectType((v) => v || 'new');
        if (zone) setBodyZone((v) => v || zone);
        setBudgetMin((v) => v || String(f.price));
        setBudgetMax((v) => v || String(f.price));
        if (STYLES.some((st) => st.slug === f.style)) setStylePrefs((v) => (v.length ? v : [f.style]));
        setColorPref((v) => v || (f.is_color ? 'full_color' : 'black_grey'));
        setDescription((v) => (v.trim() ? v : `Flash « ${f.title} ». `));
      })
      .catch(() => { if (active) { setFlash(null); setFlashState('unavailable'); } });
    return () => { active = false; };
  }, [flashId, artistId]);

  const attachedFlash = flashState === 'ready' ? flash : null;
  const zones = useMemo(() => {
    const zone = matchZone(attachedFlash?.body_zone);
    return zone && !BODY_ZONES.includes(zone) ? [zone, ...BODY_ZONES] : BODY_ZONES;
  }, [attachedFlash]);

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

  const openRequest = (requestId: string) => router.replace({ pathname: '/request/[id]', params: { id: requestId } });

  // Android back steps through the form instead of discarding it.
  const stepRef = useRef(step);
  const sentRef = useRef<string | null>(null);
  useEffect(() => { stepRef.current = step; sentRef.current = sentId; }, [step, sentId]);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (sentRef.current) { router.replace({ pathname: '/request/[id]', params: { id: sentRef.current } }); return true; }
      if (stepRef.current === 0) return false;
      setStep((s) => Math.max(0, s - 1));
      return true;
    });
    return () => sub.remove();
  }, [router]);

  const handleSubmit = async () => {
    if (submittingRef.current || !artist || (!pendingRequestId && artist.bookingStatus !== 'open')) return;
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
      preferredSlots,
      flashDesignId: attachedFlash?.id ?? null,
    };

    let requestId = pendingRequestId;
    try {
      if (!requestId) {
        const stableId = stableRequestId ?? randomUUID();
        await savePendingRequest({ userId: user.id, artistId: artist.id, flashId }, stableId);
        setStableRequestId(stableId);
        const result = await submitRequest(payload, user.id, stableId);
        if (result.error === FLASH_UNAVAILABLE) {
          setFlash(null); setFlashState('unavailable');
        }
        if (result.error || !result.id) throw new Error(result.error ?? 'Envoi impossible. Votre formulaire est conservé.');
        requestId = result.id;
        // Remember the committed request before uploading, so retries never create a second one.
        setPendingRequestId(requestId);
      }
      for (let i = 0; i < referenceUris.length; i++) {
        await attachReference(referenceUris[i], requestId, i);
      }
      setSentId(requestId);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      setSubmitError(requestId
        ? 'La demande est créée, mais certaines images n’ont pas été ajoutées. Réessayez ou ouvrez le dossier.'
        : error instanceof Error ? error.message : 'Envoi impossible. Votre formulaire est conservé.');
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      submittingRef.current = false; setSubmitting(false);
    }
  };

  const chooseReferences = async () => {
    if (pickingReferences || referenceUris.length >= 3) return;
    setPickingReferences(true);
    try {
      const chosen = await pickImage({ multiple: true });
      if (chosen?.length) setReferenceUris((previous) => [...previous, ...chosen].slice(0, 3));
    } catch {
      setSubmitError('Impossible d’ouvrir vos images. Réessayez.');
    } finally {
      setPickingReferences(false);
    }
  };

  const toggleStylePref = (slug: string) => {
    setStylePrefs((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]));
  };

  // ── Unavailable states ──
  if ((!artist && loading) || (artist && user && restoringPending)) return <FormSkeleton top={insets.top} />;
  if (restoreError) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <EmptyState
          icon="cloud-offline-outline"
          title="Envoi à vérifier"
          description="Impossible de savoir si votre dernière demande est déjà arrivée. Reconnectez-vous, puis vérifiez avant de recommencer."
          ctaLabel="Réessayer la vérification"
          onCta={() => setRestoreAttempt((value) => value + 1)}
        />
      </View>
    );
  }
  if (sentId && artist) {
    const sizeSent = SIZE_OPTIONS.find((o) => o.key === sizeCategory)?.label;
    const typeSent = PROJECT_TYPES.find((p) => p.key === projectType)?.label;
    const budgetSent = `${Number(budgetMin).toLocaleString('fr-FR')} – ${Number(budgetMax).toLocaleString('fr-FR')} €`;
    return (
      <RequestSent
        artistName={artist.blaze}
        summary={[typeSent, bodyZone, sizeSent, budgetSent].filter(Boolean).join(' · ')}
        top={insets.top}
        bottom={insets.bottom}
        onOpen={() => openRequest(sentId)}
        onExplore={() => router.replace('/(tabs)/explore')}
      />
    );
  }
  if (pendingRequestId && artist) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + Spacing.xl, paddingHorizontal: gutter, gap: Spacing.md }]}>
        <Kicker tone="flame">Demande enregistrée</Kicker>
        <EditorialTitle>{recoveredRequest ? 'Votre projet est là.' : 'Images en attente.'}</EditorialTitle>
        <TText variant="body" color="secondary">{recoveredRequest
          ? 'Votre demande a déjà été envoyée. Ouvrez le dossier pour consulter ou compléter ses images privées.'
          : 'Votre demande existe déjà. Certaines images restent à ajouter ; réessayez sans créer de nouvelle demande.'}</TText>
        {!!submitError && <TText variant="bodySmall" color="error" accessibilityRole="alert">{submitError}</TText>}
        {!recoveredRequest && referenceUris.length > 0 && <TButton title="Réessayer les images" loading={submitting} onPress={handleSubmit} />}
        <TButton title="Ouvrir le dossier" variant="secondary" onPress={() => openRequest(pendingRequestId)} />
        <TButton title="Commencer un autre projet" variant="secondary" onPress={async () => {
          if (user) await clearPendingRequest({ userId: user.id, artistId: artist.id, flashId });
          router.replace('/(tabs)/explore');
        }} />
      </View>
    );
  }
  if (!artist || artist.bookingStatus !== 'open') {
    const closedCopy = artist?.bookingStatus === 'paused'
      ? `${artist.blaze} est sur liste d’attente et n’accepte pas de nouvelle demande pour le moment.`
      : `${artist?.blaze ?? 'Cet artiste'} ne prend pas de nouveaux projets actuellement.`;
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={[styles.closedHeader, { paddingHorizontal: gutter }]}>
          <IconButton icon="close" label="Fermer" onPress={leave} />
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
  const descLength = description.trim().length;
  const colorLabel = COLORS_OPTIONS.find((c) => c.key === colorPref)?.label ?? '';
  const sizeOpt = SIZE_OPTIONS.find((s) => s.key === sizeCategory);
  const formPad = isWide ? Spacing['3xl'] : gutter;

  const backButton = (
    <IconButton
      icon={step === 0 ? 'close' : 'arrow-back'}
      label={step === 0 ? 'Fermer le formulaire' : 'Étape précédente'}
      onPress={goBack}
      onInk
    />
  );

  // Who you are writing to, on the ink ground.
  const artistLine = (
    <View style={styles.artistLine} accessible accessibilityLabel={`Demande à ${artist.blaze}, ${artist.city}. ${status.label}`}>
      <TAvatar uri={artist.avatarUrl} name={artist.blaze} size={isWide ? 'md' : 'sm'} />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Kicker tone="onInkMuted">Demande à</Kicker>
        <TText variant="displayS" numberOfLines={1} style={styles.artistName}>
          {artist.blaze}
          {!!artist.city && <TText variant="caption" color="onInkMuted">{`  ·  ${artist.city}`}</TText>}
        </TText>
      </View>
      <StatusDot tone="open" label={status.short} onInk />
    </View>
  );

  const progress = (
    <StepProgress current={step + 1} total={STEPS.length} label={meta.title} onInk />
  );

  // ── The form column ──
  const form = (
    <View style={[styles.form, { paddingHorizontal: formPad, paddingTop: isWide ? Spacing['3xl'] : Spacing.xl }]}>
      <FlashBanner state={flashState} flash={flash} />
      <View key={step}>
        <TText variant="displayM" accessibilityRole="header" style={styles.stepTitle}>
          {meta.lead}<TText variant="displayM" italic color="accentGlow" style={styles.stepTitle}>{meta.accent}</TText>
        </TText>
        <TText variant="bodySmall" color="secondary" style={styles.stepIntro}>{meta.intro}</TText>

        {/* ── Step 1: project type + zone ── */}
        {step === 0 && (
          <View style={styles.fields}>
            <View>
              <FieldLabel error={errors.projectType}>Type de projet</FieldLabel>
              <View style={styles.choiceGrid} accessibilityRole="radiogroup">
                {PROJECT_TYPES.map((pt) => (
                  <Choice
                    key={pt.key}
                    title={pt.label}
                    hint={pt.desc}
                    selected={projectType === pt.key}
                    onPress={() => { haptic(); setProjectType(pt.key); }}
                    style={[styles.choiceCell, !!errors.projectType && styles.choiceError]}
                  />
                ))}
              </View>
            </View>
            <View>
              <FieldLabel error={errors.bodyZone}>Zone du corps</FieldLabel>
              <View style={styles.wrap} accessibilityRole="radiogroup">
                {zones.map((zone) => (
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
                      style={(state) => [styles.sizeCell, ((state as Hover).hovered || selected) && styles.sizeCellActive]}
                    >
                      <TText variant="displayS" style={styles.sizeLabel}>{opt.label}</TText>
                      <TText variant="micro" tabular color="secondary" style={{ letterSpacing: 0 }}>{opt.sub}</TText>
                      {selected && <View style={styles.cellMark} />}
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
                  ? `Les projets ${/^[aeiouyhâàéèêëîïôûü]/i.test(artist.blaze) ? 'd’' : 'de '}${artist.blaze} commencent à ${artist.minBudget.toLocaleString('fr-FR')} €. Le prix final fait l’objet d’un devis.`
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
              style={(state) => [styles.toggleRow, (state as Hover).hovered && { backgroundColor: Colors.wash }]}
            >
              <View style={[styles.checkbox, isFlexible && styles.checkboxOn]}>
                {isFlexible && <Ionicons name="checkmark" size={14} color={Colors.paper} />}
              </View>
              <View style={{ flex: 1 }}>
                <TText variant="bodySmall" weight="semibold">Ouvert aux suggestions</TText>
                <TText variant="caption" color="tertiary" style={{ marginTop: 1 }}>Vous laissez une marge créative à l’artiste.</TText>
              </View>
            </Pressable>

            {/* Preferred slots: optional, never blocks sending. */}
            <View style={styles.slotsBlock}>
              <TText variant="displayS" accessibilityRole="header" style={styles.blockTitle}>Vos créneaux préférés</TText>
              <TText variant="caption" color="tertiary" style={{ marginTop: 4 }}>
                Jusqu’à trois. L’artiste confirmera l’un d’eux ou vous en proposera un autre.
              </TText>
              {!!booking && (
                <View style={styles.noticeLine}>
                  <Ionicons name="refresh-outline" size={14} color={Colors.textTertiary} />
                  <TText variant="caption" color="secondary" style={{ flex: 1 }}>{cancellationNotice(booking.cancelNoticeHours)}</TText>
                </View>
              )}
              {!!attachedFlash?.estimated_duration && (
                <TText variant="caption" color="tertiary" style={{ marginTop: 4 }}>
                  Séance de {durationLabel(attachedFlash.estimated_duration)}, la durée prévue pour ce flash.
                </TText>
              )}
              <View style={{ marginTop: Spacing.md }}>
                {!bookingLoaded || flashState === 'loading' ? (
                  <TSkeleton height={120} />
                ) : (
                  // A flash's own length wins; otherwise the client picks among the artist's lengths.
                  <SlotPicker
                    artistId={artist.id}
                    durationMin={attachedFlash?.estimated_duration ?? (booking ? undefined : DEFAULT_SESSION_MIN)}
                    durations={attachedFlash?.estimated_duration ? undefined : booking?.sessionDurations}
                    value={preferredSlots}
                    onChange={setPreferredSlots}
                  />
                )}
              </View>
            </View>

            <View style={styles.notice}>
              <Ionicons name="images-outline" size={18} color={Colors.textTertiary} />
              <View style={{ flex: 1 }}>
                <TText variant="bodySmall" weight="medium" color="secondary">Images de référence</TText>
                <TText variant="caption" color="tertiary" style={{ marginTop: 1 }}>
                  Jusqu’à trois images. Seuls vous et l’artiste pourrez les consulter.
                </TText>
                <Pressable onPress={chooseReferences} disabled={pickingReferences || referenceUris.length >= 3} accessibilityRole="button" accessibilityLabel="Ajouter des images de référence" style={{ marginTop: Spacing.sm }}>
                  <TText variant="bodySmall" style={{ color: Colors.flame }}>{pickingReferences ? 'Ouverture…' : 'Ajouter des images +'}</TText>
                </Pressable>
                {referenceUris.length > 0 && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.md }}>
                    {referenceUris.map((uri, index) => (
                      <View key={`${uri}-${index}`} style={{ gap: 4 }}>
                        <RevealImage uri={uri} style={{ width: 88, height: 88 }} accessibilityLabel={`Référence ${index + 1}`} />
                        <Pressable onPress={() => setReferenceUris((previous) => previous.filter((_, i) => i !== index))} accessibilityRole="button" accessibilityLabel={`Retirer la référence ${index + 1}`}>
                          <TText variant="caption" color="error">Retirer</TText>
                        </Pressable>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>
          </View>
        )}

        {/* ── Step 4: summary before sending ── */}
        {step === 3 && (
          <View>
            <RecapSection index={1} title="Le projet" onEdit={() => { setSubmitError(null); goToStep(0); }}>
              {!!attachedFlash && <DetailRow label="Flash" value={`« ${attachedFlash.title} » · ${attachedFlash.price.toLocaleString('fr-FR')} €`} />}
              <DetailRow label="Type" value={PROJECT_TYPES.find((p) => p.key === projectType)?.label ?? '—'} />
              <DetailRow label="Zone" value={bodyZone || '—'} last />
            </RecapSection>
            <RecapSection index={2} title="Taille et budget" onEdit={() => { setSubmitError(null); goToStep(1); }}>
              <DetailRow label="Taille" value={sizeOpt ? `${sizeOpt.label} · ${sizeOpt.sub}` : '—'} />
              <DetailRow
                label="Budget"
                value={`${Number(budgetMin).toLocaleString('fr-FR')} – ${Number(budgetMax).toLocaleString('fr-FR')} €`}
                last
              />
            </RecapSection>
            <RecapSection index={3} title="Votre idée" onEdit={() => { setSubmitError(null); goToStep(2); }}>
              <DetailRow label="Styles" value={stylePrefs.map(styleName).join(', ') || '—'} />
              <DetailRow label="Couleur" value={colorLabel || '—'} />
              <DetailRow label="Approche" value={isFlexible ? 'Ouvert aux suggestions' : 'Projet précis'} last />
              <TText variant="body" color="secondary" style={styles.recapProse}>{description.trim()}</TText>
              {referenceUris.length > 0 && <DetailRow label="Images" value={`${referenceUris.length} référence${referenceUris.length > 1 ? 's' : ''}`} />}
            </RecapSection>
            <RecapSection index={4} title="Vos créneaux" onEdit={() => { setSubmitError(null); goToStep(2); }}>
              {preferredSlots.length > 0 ? (
                preferredSlots.map((iso, i) => (
                  <DetailRow key={iso} label={i === 0 ? 'Préférés' : ''} value={formatChosenSlot(iso)} last={i === preferredSlots.length - 1} />
                ))
              ) : (
                <TText variant="bodySmall" color="tertiary">Aucun créneau choisi : vous conviendrez d’une date avec l’artiste.</TText>
              )}
            </RecapSection>
            <TText variant="caption" color="tertiary" style={{ marginTop: Spacing.lg }}>
              {artist.blaze} étudiera votre demande et établira un devis. Sa réponse apparaîtra dans vos demandes.
            </TText>
          </View>
        )}
      </View>
    </View>
  );

  // ── Pinned actions ──
  const actionBar = (
    <View style={[styles.ctaBar, { paddingBottom: insets.bottom + 12, paddingHorizontal: formPad }]}>
      <View style={styles.ctaInner}>
        {!!submitError && (
          <View style={styles.errorBanner} accessibilityRole="alert" accessibilityLiveRegion="assertive">
            <Ionicons name="alert-circle-outline" size={18} color={Colors.error} />
            <View style={{ flex: 1 }}>
              <TText variant="bodySmall" weight="medium" style={{ color: Colors.error }}>{submitError}</TText>
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
                variant="glow"
                loading={submitting}
                onPress={handleSubmit}
                accessibilityLabel={`Envoyer la demande à ${artist.blaze}`}
              />
            )}
          </View>
        </View>
      </View>
    </View>
  );

  // ── Wide: ink intro column beside the paper form ──
  if (isWide) {
    const introW = Math.min(520, Math.max(340, width * 0.38));
    return (
      <KeyboardAvoidingView style={[styles.container, styles.wideRoot]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={[styles.introWide, { width: introW, paddingTop: insets.top + Spacing.xl }]}>
          <View style={styles.introTop}>
            {backButton}
            <Kicker tone="flameOnInk">Demande de projet</Kicker>
          </View>
          <View style={{ marginTop: Spacing['3xl'] }}>
            <EditorialTitle onInk emphasis="projet." breakEmphasis>Votre</EditorialTitle>
            <TText variant="body" color="onInkMuted" style={styles.introCopy}>
              Quatre temps pour passer de l’idée au dialogue. L’artiste lit votre brief et vous répond avec un devis.
            </TText>
          </View>
          <View style={styles.introBottom}>
            {artistLine}
            {progress}
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: Spacing['2xl'] }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {form}
          </ScrollView>
          {actionBar}
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ── Phone: a compact ink band, then the form ──
  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top, backgroundColor: Colors.inkPanel }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.topBar, { paddingHorizontal: gutter }]}>
        {backButton}
        <Kicker tone="onInkMuted" numberOfLines={1} style={{ flex: 1, textAlign: 'center' }}>Demande de projet</Kicker>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView
        ref={scrollRef}
        style={styles.phoneScroll}
        contentContainerStyle={{ paddingBottom: Spacing['2xl'] }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={[styles.introPhone, { paddingHorizontal: gutter }]}>
          <CompactTitle />
          {artistLine}
          {progress}
        </View>
        {form}
      </ScrollView>
      {actionBar}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  closedHeader: { height: 60, flexDirection: 'row', alignItems: 'center' },

  // Wide composition
  wideRoot: { flexDirection: 'row' },
  introWide: {
    backgroundColor: Colors.inkPanel,
    paddingHorizontal: Spacing['2xl'],
    paddingBottom: Spacing['2xl'],
  },
  introTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  introCopy: { marginTop: Spacing.lg, maxWidth: 340, lineHeight: 26 },
  introBottom: { marginTop: 'auto', paddingTop: Spacing['2xl'], gap: Spacing.xl },

  // Phone composition
  topBar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, height: 56, backgroundColor: Colors.inkPanel },
  phoneScroll: { flex: 1, backgroundColor: Colors.bgPrimary },
  introPhone: { backgroundColor: Colors.inkPanel, paddingTop: Spacing.xs, paddingBottom: Spacing.lg, gap: Spacing.md },
  compactTitle: { fontSize: 44, lineHeight: 44, letterSpacing: -1.6 },

  artistLine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  artistName: { color: Colors.onInk, fontSize: 22, lineHeight: 25, letterSpacing: -0.3 },

  // Form
  form: { width: '100%', maxWidth: FORM_MAX + Spacing['3xl'] * 2, alignSelf: 'center' },
  stepTitle: { fontSize: 38, lineHeight: 39, letterSpacing: -1.2 },
  stepIntro: { marginTop: Spacing.xs, marginBottom: Spacing.xl, maxWidth: Layout.maxReading },
  fields: { gap: Spacing.xl },
  fieldLabel: { marginBottom: Spacing.sm },

  choiceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  choiceCell: { width: '48%', flexGrow: 1 },
  choiceError: { borderColor: Colors.error },

  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 36, paddingHorizontal: 14, borderRadius: Radius.full,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.line,
    ...webPointer,
  },
  chipHover: { backgroundColor: Colors.wash, borderColor: Colors.ink },
  chipSelected: { backgroundColor: Colors.ink, borderColor: Colors.ink },

  sizeRow: { flexDirection: 'row', gap: 6 },
  sizeCell: {
    flex: 1, minWidth: 0, minHeight: 72, alignItems: 'center', justifyContent: 'center', gap: 2,
    borderWidth: 1, borderColor: Colors.line,
    ...webPointer,
  },
  sizeCellActive: { borderColor: Colors.flame, backgroundColor: Colors.flameSoft },
  sizeLabel: { fontSize: 26, lineHeight: 28, letterSpacing: -0.3 },
  cellMark: { position: 'absolute', top: 0, right: 0, width: 8, height: 8, backgroundColor: Colors.flame },

  budgetRow: { flexDirection: 'row', gap: Spacing.xs, alignItems: 'flex-start' },

  toggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    paddingVertical: Spacing.xs, minHeight: 56,
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: Colors.line,
    ...webPointer,
  },
  checkbox: {
    width: 22, height: 22,
    borderWidth: 1.5, borderColor: Colors.ink,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: Colors.ink },

  slotsBlock: {},
  blockTitle: { fontSize: 28, lineHeight: 30, letterSpacing: -0.5 },
  noticeLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing['2xs'] },
  notice: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.xs,
    paddingTop: Spacing.sm,
    borderTopWidth: 1, borderTopColor: Colors.line,
  },

  flashBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    padding: Spacing.xs, marginBottom: Spacing.xl,
    borderWidth: 1, borderColor: Colors.line, borderLeftWidth: 2, borderLeftColor: Colors.flame,
    backgroundColor: Colors.white,
  },
  flashThumb: { width: 52, height: 64 },

  recapSection: { paddingTop: Spacing.lg, paddingBottom: Spacing.md },
  recapHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm, marginBottom: Spacing.xs, minHeight: 44 },
  recapProse: { marginTop: Spacing.sm, maxWidth: Layout.maxReading },

  sentBody: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Layout.gutter },
  sentLine: { width: 120, height: 1, backgroundColor: Colors.flame, marginVertical: Spacing.lg },
  sentActions: { width: '100%', maxWidth: 420, alignSelf: 'center', paddingHorizontal: Layout.gutter, gap: Spacing['2xs'] },

  ctaBar: {
    paddingTop: 12,
    backgroundColor: Colors.paper,
    borderTopWidth: 1, borderTopColor: Colors.ink,
  },
  ctaInner: { width: '100%', maxWidth: FORM_MAX, alignSelf: 'center' },
  ctaRow: { flexDirection: 'row', gap: Spacing.xs, alignItems: 'center' },
  errorBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing['2xs'],
    padding: Spacing.xs, marginBottom: Spacing.xs,
    borderWidth: 1, borderColor: Colors.error, borderLeftWidth: 3,
    backgroundColor: Colors.white,
  },
});
