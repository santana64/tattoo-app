import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, StyleSheet, ScrollView, Pressable, Platform, KeyboardAvoidingView, useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Radius, Layout } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TButton } from '@/components/ui/TButton';
import { TInput } from '@/components/ui/TInput';
import { THeader } from '@/components/ui/THeader';
import { TSkeleton } from '@/components/ui/TSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Toast } from '@/components/ui/TToast';
import { BottomSheet, PressableScale, enterUp } from '@/components/motion';
import { useAuthStore } from '@/store/auth-store';
import { supabase } from '@/lib/supabase';
import { formatDuration } from '@/lib/appointments';
import {
  DAY_NAMES, WEEK_ORDER, blockDays, fetchBlockedPeriods, fetchFreeSlots, fetchWeeklySchedule,
  formatSlotTime, saveWeeklySchedule, scheduleError, unblockPeriod, type BlockedPeriod, type DayHours,
} from '@/lib/studio';

// ─── Time and date helpers (presentation only) ────────────────────────────────
const STEP_MIN = 30;
const EARLIEST = 6 * 60;
const LATEST = 23 * 60;
const DEFAULT_HOURS = { opens: '10:00', closes: '19:00' };
const PREVIEW_DAYS = 28;
const PREVIEW_DURATION_MIN = 120; // the default session length clients pick from
const SLOTS_CAP = 400; // artist_free_slots never returns more rows than this.
const BLOCK_HORIZON_DAYS = 365;

const toMinutes = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
};
const toTime = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const stepTime = (t: string, delta: number) => toTime(Math.min(LATEST, Math.max(EARLIEST, toMinutes(t) + delta * STEP_MIN)));

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const isMidnight = (d: Date) => d.getHours() === 0 && d.getMinutes() === 0;

const shortDateFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
const shortDateYearFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const longDateFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

const shortDate = (d: Date) => (d.getFullYear() === new Date().getFullYear() ? shortDateFmt : shortDateYearFmt).format(d);

/** Blocked periods cover whole local days, the end being the next midnight. */
function formatBlockedRange(p: BlockedPeriod): string {
  const start = new Date(p.starts_at);
  const end = new Date(p.ends_at);
  if (isMidnight(start) && isMidnight(end)) {
    const last = addDays(end, -1);
    return last.getTime() <= start.getTime() ? shortDate(start) : `${shortDate(start)} – ${shortDate(last)}`;
  }
  return `${shortDate(start)} ${formatSlotTime(start)} – ${shortDate(end)} ${formatSlotTime(end)}`;
}

// ─── Week draft ───────────────────────────────────────────────────────────────
interface DayDraft { open: boolean; opens: string; closes: string }
type WeekDraft = Record<number, DayDraft>;

function draftFrom(days: DayHours[]): WeekDraft {
  const draft: WeekDraft = {};
  for (const d of WEEK_ORDER) {
    const saved = days.find((x) => x.day === d);
    draft[d] = saved ? { open: true, opens: saved.opens, closes: saved.closes } : { open: false, ...DEFAULT_HOURS };
  }
  return draft;
}

const openDays = (draft: WeekDraft): DayHours[] =>
  WEEK_ORDER.filter((d) => draft[d]?.open).map((d) => ({ day: d, opens: draft[d].opens, closes: draft[d].closes }));

const sameWeek = (a: DayHours[], b: DayHours[]) => JSON.stringify(a) === JSON.stringify(b);

const haptic = () => { if (Platform.OS !== 'web') Haptics.selectionAsync(); };

// ─── Pieces ───────────────────────────────────────────────────────────────────
function SectionHead({ kicker, title, intro }: { kicker: string; title: string; intro?: string }) {
  return (
    <View style={styles.sectionHead}>
      <TText variant="label" color="accentWarm" uppercase>{kicker}</TText>
      <TText variant="title2" serif accessibilityRole="header" style={styles.sectionTitle}>{title}</TText>
      {!!intro && <TText variant="bodySmall" color="secondary" style={{ marginTop: 4 }}>{intro}</TText>}
    </View>
  );
}

function Switch({ value, onChange, label }: { value: boolean; onChange: (next: boolean) => void; label: string }) {
  return (
    <Pressable
      onPress={() => { haptic(); onChange(!value); }}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      hitSlop={8}
      style={[styles.switchTrack, value && styles.switchTrackOn]}
    >
      <View style={[styles.switchThumb, value && styles.switchThumbOn]} />
    </Pressable>
  );
}

function StepButton({ icon, label, disabled, onPress }: {
  icon: 'remove' | 'add'; label: string; disabled: boolean; onPress: () => void;
}) {
  return (
    <PressableScale
      onPress={() => { if (!disabled) { haptic(); onPress(); } }}
      disabled={disabled}
      pressedScale={0.9}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      hitSlop={4}
      style={[styles.stepBtn, disabled && { opacity: 0.35 }]}
    >
      <Ionicons name={icon} size={16} color={Colors.textPrimary} />
    </PressableScale>
  );
}

/** − value + ; also an "adjustable" element for screen readers (swipe up / down). */
function Stepper({ label, display, spoken, canDec, canInc, onDec, onInc, decLabel, incLabel, wide }: {
  label: string; display: string; spoken: string; canDec: boolean; canInc: boolean;
  onDec: () => void; onInc: () => void; decLabel: string; incLabel: string; wide?: boolean;
}) {
  return (
    <View style={styles.stepper}>
      <TText variant="micro" color="tertiary" uppercase>{label}</TText>
      <View style={styles.stepperRow}>
        <StepButton icon="remove" label={decLabel} disabled={!canDec} onPress={onDec} />
        <View
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={label}
          accessibilityValue={{ text: spoken }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(e) => {
            if (e.nativeEvent.actionName === 'increment' && canInc) onInc();
            if (e.nativeEvent.actionName === 'decrement' && canDec) onDec();
          }}
          style={[styles.stepValue, wide && styles.stepValueWide]}
        >
          <TText variant="body" weight="semibold" tabular numberOfLines={1}>{display}</TText>
        </View>
        <StepButton icon="add" label={incLabel} disabled={!canInc} onPress={onInc} />
      </View>
    </View>
  );
}

function DayRow({ day, draft, onChange, last }: { day: number; draft: DayDraft; onChange: (next: DayDraft) => void; last: boolean }) {
  const name = DAY_NAMES[day];
  const invalid = draft.open ? scheduleError([{ day, opens: draft.opens, closes: draft.closes }]) : null;
  return (
    <View style={[styles.dayRow, !last && styles.dayRowDivider]}>
      <View style={styles.dayHead}>
        <TText variant="body" weight="medium" style={{ flex: 1 }}>{name}</TText>
        {!draft.open && <TText variant="caption" color="tertiary">Fermé</TText>}
        <Switch value={draft.open} onChange={(open) => onChange({ ...draft, open })} label={`${name} : ${draft.open ? 'ouvert' : 'fermé'}`} />
      </View>
      {draft.open && (
        <>
          <View style={styles.dayTimes}>
            <Stepper
              label="Ouverture"
              display={draft.opens}
              spoken={draft.opens}
              canDec={toMinutes(draft.opens) > EARLIEST}
              canInc={toMinutes(draft.opens) < LATEST}
              onDec={() => onChange({ ...draft, opens: stepTime(draft.opens, -1) })}
              onInc={() => onChange({ ...draft, opens: stepTime(draft.opens, 1) })}
              decLabel={`${name} : ouvrir 30 minutes plus tôt`}
              incLabel={`${name} : ouvrir 30 minutes plus tard`}
            />
            <Stepper
              label="Fermeture"
              display={draft.closes}
              spoken={draft.closes}
              canDec={toMinutes(draft.closes) > EARLIEST}
              canInc={toMinutes(draft.closes) < LATEST}
              onDec={() => onChange({ ...draft, closes: stepTime(draft.closes, -1) })}
              onInc={() => onChange({ ...draft, closes: stepTime(draft.closes, 1) })}
              decLabel={`${name} : fermer 30 minutes plus tôt`}
              incLabel={`${name} : fermer 30 minutes plus tard`}
            />
          </View>
          {!!invalid && (
            <TText variant="caption" color="error" style={{ marginTop: Spacing['2xs'] }} accessibilityLiveRegion="polite">
              Au moins une heure entre l’ouverture et la fermeture.
            </TText>
          )}
        </>
      )}
    </View>
  );
}

function WeekSkeleton() {
  return (
    <View style={styles.card}>
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <View key={i} style={[styles.dayRow, i < 6 && styles.dayRowDivider, styles.dayHead]}>
          <TSkeleton width="35%" height={15} />
          <View style={{ flex: 1 }} />
          <TSkeleton width={44} height={26} radius={13} />
        </View>
      ))}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function AvailabilityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = width >= 960;
  const { user, isLoading: authLoading } = useAuthStore();
  const artistId = user?.role === 'artist' ? user.artistId : undefined;

  // Section A — weekly hours
  const [draft, setDraft] = useState<WeekDraft | null>(null);
  const [saved, setSaved] = useState<DayHours[]>([]);
  const [weekState, setWeekState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [weekAttempt, setWeekAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Section B — blocked days
  const [blocked, setBlocked] = useState<BlockedPeriod[] | null>(null);
  const [blockedError, setBlockedError] = useState(false);
  const tomorrow = useMemo(() => addDays(startOfDay(new Date()), 1), []);
  const [blockFrom, setBlockFrom] = useState(tomorrow);
  const [blockTo, setBlockTo] = useState(tomorrow);
  const [blockLabel, setBlockLabel] = useState('');
  const [blocking, setBlocking] = useState(false);
  const [toRemove, setToRemove] = useState<BlockedPeriod | null>(null);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  // Section C — what clients see
  const [freeCount, setFreeCount] = useState<number | null>(null);
  const [previewError, setPreviewError] = useState(false);
  const [bookingStatus, setBookingStatus] = useState<'open' | 'paused' | 'closed' | null>(null);

  useEffect(() => {
    if (!artistId) return;
    let active = true;
    setWeekState('loading');
    fetchWeeklySchedule(artistId)
      .then((days) => {
        if (!active) return;
        const normalized = openDays(draftFrom(days));
        setSaved(normalized);
        setDraft(draftFrom(days));
        setWeekState('ready');
      })
      .catch(() => { if (active) setWeekState('error'); });
    return () => { active = false; };
  }, [artistId, weekAttempt]);

  const loadBlocked = useCallback(async () => {
    if (!artistId) return;
    setBlockedError(false);
    try {
      setBlocked(await fetchBlockedPeriods(artistId));
    } catch {
      setBlockedError(true);
    }
  }, [artistId]);

  const loadPreview = useCallback(async () => {
    if (!artistId) return;
    setPreviewError(false);
    try {
      const [slots, artist] = await Promise.all([
        fetchFreeSlots(artistId, PREVIEW_DAYS, PREVIEW_DURATION_MIN),
        supabase.from('artists').select('booking_status').eq('id', artistId).maybeSingle(),
      ]);
      setFreeCount(slots.length);
      setBookingStatus(artist.data?.booking_status ?? null);
    } catch {
      setPreviewError(true);
    }
  }, [artistId]);

  useEffect(() => { void loadBlocked(); }, [loadBlocked]);
  useEffect(() => { void loadPreview(); }, [loadPreview]);

  // ── Not an artist ──
  if (!artistId) {
    return (
      <View style={styles.container}>
        <THeader showBack title="Horaires et disponibilités" />
        {authLoading && !user ? (
          <View style={styles.page}><WeekSkeleton /></View>
        ) : (
          <EmptyState
            icon="lock-closed-outline"
            title="Réservé aux artistes"
            description="Les horaires et les disponibilités se règlent depuis un profil artiste."
            ctaLabel="Retour"
            onCta={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
          />
        )}
      </View>
    );
  }

  const current = draft ? openDays(draft) : [];
  const dirty = !!draft && !sameWeek(current, saved);
  const validation = draft ? scheduleError(current) : null;

  const updateDay = (day: number, next: DayDraft) => {
    setSaveError(null);
    setDraft((prev) => (prev ? { ...prev, [day]: next } : prev));
  };

  const save = async () => {
    if (!dirty || validation || saving) return;
    setSaving(true); setSaveError(null);
    const error = await saveWeeklySchedule(current);
    setSaving(false);
    if (error) {
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setSaveError(error);
      return;
    }
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSaved(current);
    Toast.success('Horaires enregistrés');
    void loadPreview();
  };

  const changeFrom = (delta: number) => {
    const next = addDays(blockFrom, delta);
    setBlockFrom(next);
    if (blockTo < next) setBlockTo(next);
  };

  const block = async () => {
    if (blocking) return;
    setBlocking(true);
    const error = await blockDays(artistId, blockFrom, blockTo, blockLabel);
    setBlocking(false);
    if (error) { Toast.error(error); return; }
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Toast.success(blockFrom.getTime() === blockTo.getTime() ? 'Journée bloquée' : 'Jours bloqués');
    setBlockLabel('');
    await Promise.all([loadBlocked(), loadPreview()]);
  };

  const confirmRemove = async () => {
    if (!toRemove || removing) return;
    setRemoving(true); setRemoveError(null);
    const error = await unblockPeriod(toRemove.id);
    setRemoving(false);
    if (error) { setRemoveError(error); return; }
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setToRemove(null);
    Toast.success('Ces jours sont de nouveau réservables');
    await Promise.all([loadBlocked(), loadPreview()]);
  };

  const maxBlockDate = addDays(tomorrow, BLOCK_HORIZON_DAYS);
  const blockDayCount = Math.round((blockTo.getTime() - blockFrom.getTime()) / 86_400_000) + 1;

  // ── Section A ──
  const weekSection = (
    <Animated.View entering={enterUp(0)} style={styles.section}>
      <SectionHead
        kicker="Semaine type"
        title="Vos horaires d’ouverture"
        intro="Les clients choisissent parmi les créneaux libres de ces plages, hors séances déjà prévues et jours bloqués."
      />
      {weekState === 'loading' || !draft ? (
        weekState === 'error' ? (
          <View style={styles.inlineError} accessibilityRole="alert">
            <TText variant="bodySmall" color="secondary" style={{ flex: 1 }}>Vos horaires n’ont pas pu être chargés.</TText>
            <TButton title="Réessayer" variant="secondary" size="sm" fullWidth={false} onPress={() => setWeekAttempt((n) => n + 1)} />
          </View>
        ) : <WeekSkeleton />
      ) : (
        <View style={styles.card}>
          {WEEK_ORDER.map((d, i) => (
            <DayRow key={d} day={d} draft={draft[d]} onChange={(next) => updateDay(d, next)} last={i === WEEK_ORDER.length - 1} />
          ))}
        </View>
      )}
    </Animated.View>
  );

  // ── Section B ──
  const blockedSection = (
    <Animated.View entering={enterUp(1)} style={styles.section}>
      <SectionHead
        kicker="Jours bloqués"
        title="Congés, conventions"
        intro="Aucun créneau n’est proposé pendant ces jours."
      />

      {blocked === null && !blockedError ? (
        <View style={{ gap: Spacing['2xs'], marginBottom: Spacing.md }}>
          <TSkeleton height={48} radius={Radius.md} />
          <TSkeleton height={48} radius={Radius.md} />
        </View>
      ) : blockedError ? (
        <View style={[styles.inlineError, { marginBottom: Spacing.md }]} accessibilityRole="alert">
          <TText variant="bodySmall" color="secondary" style={{ flex: 1 }}>Les jours bloqués n’ont pas pu être chargés.</TText>
          <TButton title="Réessayer" variant="secondary" size="sm" fullWidth={false} onPress={() => { void loadBlocked(); }} />
        </View>
      ) : blocked && blocked.length > 0 ? (
        <View style={[styles.card, { marginBottom: Spacing.md }]}>
          {blocked.map((p, i) => {
            const range = formatBlockedRange(p);
            return (
              <View key={p.id} style={[styles.blockedRow, i < blocked.length - 1 && styles.dayRowDivider]}>
                <Ionicons name="remove-circle-outline" size={18} color={Colors.textTertiary} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <TText variant="bodySmall" weight="medium" tabular>{range}</TText>
                  {!!p.label && <TText variant="caption" color="tertiary" numberOfLines={1}>{p.label}</TText>}
                </View>
                <Pressable
                  onPress={() => { setRemoveError(null); setToRemove(p); }}
                  accessibilityRole="button"
                  accessibilityLabel={`Supprimer le blocage : ${range}${p.label ? `, ${p.label}` : ''}`}
                  hitSlop={8}
                  style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
                >
                  <Ionicons name="trash-outline" size={17} color={Colors.textSecondary} />
                </Pressable>
              </View>
            );
          })}
        </View>
      ) : (
        <TText variant="bodySmall" color="tertiary" style={{ marginBottom: Spacing.md }}>Aucun jour bloqué à venir.</TText>
      )}

      <View style={styles.card}>
        <View style={styles.blockForm}>
          <TText variant="bodySmall" weight="semibold">Bloquer une période</TText>
          <View style={styles.dayTimes}>
            <Stepper
              wide
              label="Du"
              display={shortDate(blockFrom)}
              spoken={longDateFmt.format(blockFrom)}
              canDec={blockFrom > tomorrow}
              canInc={blockFrom < maxBlockDate}
              onDec={() => changeFrom(-1)}
              onInc={() => changeFrom(1)}
              decLabel="Début : jour précédent"
              incLabel="Début : jour suivant"
            />
            <Stepper
              wide
              label="Au"
              display={shortDate(blockTo)}
              spoken={longDateFmt.format(blockTo)}
              canDec={blockTo > blockFrom}
              canInc={blockTo < maxBlockDate}
              onDec={() => setBlockTo((d) => addDays(d, -1))}
              onInc={() => setBlockTo((d) => addDays(d, 1))}
              decLabel="Fin : jour précédent"
              incLabel="Fin : jour suivant"
            />
          </View>
          <TInput
            label="Motif"
            optional
            value={blockLabel}
            onChangeText={setBlockLabel}
            placeholder="Convention, congés…"
            maxLength={80}
            containerStyle={{ marginBottom: 0 }}
          />
          <TButton
            title="Bloquer ces jours"
            variant="secondary"
            size="md"
            loading={blocking}
            onPress={block}
            accessibilityLabel={`Bloquer ${blockDayCount} jour${blockDayCount > 1 ? 's' : ''}, ${longDateFmt.format(blockFrom)}${blockDayCount > 1 ? ` au ${longDateFmt.format(blockTo)}` : ''}`}
            icon={<Ionicons name="close-circle-outline" size={16} color={Colors.textPrimary} />}
          />
        </View>
      </View>
    </Animated.View>
  );

  // ── Section C ──
  const sessionLength = formatDuration(PREVIEW_DURATION_MIN);
  const countLabel = freeCount === null || freeCount === 0 ? null
    : freeCount >= SLOTS_CAP ? `au moins ${SLOTS_CAP} créneaux libres`
    : `${freeCount} créneau${freeCount > 1 ? 'x' : ''} libre${freeCount > 1 ? 's' : ''}`;
  const pausedCopy = bookingStatus === 'paused'
    ? 'Vous êtes en liste d’attente : vos créneaux restent masqués aux clients tant que les demandes sont en pause.'
    : bookingStatus === 'closed'
      ? 'Votre carnet est complet : vos créneaux restent masqués aux clients tant que vous ne rouvrez pas les demandes.'
      : null;

  const previewSection = (
    <Animated.View entering={enterUp(2)} style={styles.section}>
      <SectionHead kicker="Aperçu" title="Ce que voient les clients" />
      <View style={styles.preview} accessibilityLiveRegion="polite">
        <Ionicons name="eye-outline" size={18} color={Colors.accentWarm} />
        <View style={{ flex: 1, gap: 6 }}>
          {previewError ? (
            <>
              <TText variant="bodySmall" color="secondary">L’aperçu n’a pas pu être calculé.</TText>
              <Pressable onPress={() => { void loadPreview(); }} accessibilityRole="button" hitSlop={8} style={{ alignSelf: 'flex-start' }}>
                <TText variant="caption" color="accentWarm" style={{ textDecorationLine: 'underline' }}>Réessayer</TText>
              </Pressable>
            </>
          ) : freeCount === null ? (
            <TSkeleton width="80%" height={14} />
          ) : countLabel === null ? (
            <TText variant="bodySmall" color="secondary">
              Sur les {PREVIEW_DAYS} prochains jours, aucun créneau libre de {sessionLength} n’est visible pour les clients.
            </TText>
          ) : (
            <TText variant="bodySmall" color="secondary">
              Sur les {PREVIEW_DAYS} prochains jours, les clients voient{' '}
              <TText variant="bodySmall" weight="semibold" tabular>{countLabel}</TText>
              {' '}de {sessionLength}.
            </TText>
          )}
          {!!pausedCopy && (
            <TText variant="caption" color="warning">{pausedCopy}</TText>
          )}
          {dirty && (
            <TText variant="caption" color="tertiary">Enregistrez vos horaires pour mettre l’aperçu à jour.</TText>
          )}
        </View>
      </View>
    </Animated.View>
  );

  const showBar = weekState === 'ready' && !!draft;
  const barMessage = saveError ?? (dirty ? validation : null);

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <THeader showBack title="Horaires et disponibilités" />

      <ScrollView
        contentContainerStyle={[styles.page, { paddingBottom: insets.bottom + (showBar ? 140 : Spacing['2xl']) }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.intro}>
          <TText variant="displayM" accessibilityRole="header">
            Vos créneaux, <TText variant="displayM" italic color="accentGlow">réservables</TText>
          </TText>
          <TText variant="bodySmall" color="secondary" style={{ marginTop: Spacing['2xs'], maxWidth: Layout.maxReading }}>
            Publiez vos horaires : vos clients choisissent jusqu’à trois créneaux libres dans leur demande, et vous confirmez l’un d’eux en un geste.
          </TText>
        </View>

        {wide ? (
          <View style={styles.columns}>
            <View style={styles.column}>{weekSection}</View>
            <View style={styles.column}>
              {blockedSection}
              {previewSection}
            </View>
          </View>
        ) : (
          <>
            {weekSection}
            {blockedSection}
            {previewSection}
          </>
        )}
      </ScrollView>

      {showBar && (
        <View style={[styles.bar, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.barInner}>
            {!!barMessage && (
              <View style={styles.errorRow} accessibilityRole="alert" accessibilityLiveRegion="assertive">
                <Ionicons name="alert-circle-outline" size={16} color={Colors.errorLight} />
                <TText variant="caption" style={{ color: Colors.errorLight, flex: 1 }}>{barMessage}</TText>
              </View>
            )}
            <TButton
              title="Enregistrer les horaires"
              onPress={save}
              loading={saving}
              disabled={!dirty || !!validation}
            />
          </View>
        </View>
      )}

      {/* ── Unblock confirmation (Alert.alert is a no-op on web) ── */}
      <BottomSheet visible={!!toRemove} onClose={() => setToRemove(null)} accessibilityLabel="Supprimer ce blocage">
        <TText variant="displayS">Rouvrir ces jours{' '}?</TText>
        <TText variant="bodySmall" color="secondary" style={{ marginTop: 4 }}>
          {toRemove ? `${formatBlockedRange(toRemove)}${toRemove.label ? ` · ${toRemove.label}` : ''}. ` : ''}
          Vos créneaux libres seront de nouveau proposés aux clients.
        </TText>
        {!!removeError && (
          <TText variant="caption" style={{ color: Colors.errorLight, marginTop: Spacing.xs }} accessibilityRole="alert">{removeError}</TText>
        )}
        <View style={styles.sheetActions}>
          <TButton title="Supprimer le blocage" variant="destructive" onPress={confirmRemove} loading={removing} />
          <TButton title="Garder ces jours bloqués" variant="ghost" size="md" onPress={() => setToRemove(null)} />
        </View>
      </BottomSheet>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  page: {
    width: '100%', maxWidth: Layout.maxContent, alignSelf: 'center',
    paddingHorizontal: Layout.gutter,
  },
  intro: { paddingTop: Spacing.lg, paddingBottom: Spacing.sm },
  columns: { flexDirection: 'row', gap: Spacing['2xl'], alignItems: 'flex-start' },
  column: { flex: 1, minWidth: 0 },

  section: { paddingTop: Spacing.lg },
  sectionHead: { marginBottom: Spacing.sm },
  sectionTitle: { fontSize: 24, lineHeight: 28, marginTop: 4 },

  card: {
    borderRadius: Radius.xl, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderDefault,
    backgroundColor: Colors.bgElevated, paddingHorizontal: Spacing.sm,
  },
  dayRow: { paddingVertical: Spacing.xs },
  dayRowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.borderSubtle },
  dayHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, minHeight: 36 },
  dayTimes: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginTop: Spacing['2xs'] },

  switchTrack: {
    width: 44, height: 26, borderRadius: 13, padding: 3,
    backgroundColor: Colors.bgSubtle, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderDefault,
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } as object : null),
  },
  switchTrackOn: { backgroundColor: Colors.accentAction, borderColor: Colors.accentAction },
  switchThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.textTertiary },
  switchThumbOn: { backgroundColor: Colors.textInverse, transform: [{ translateX: 18 }] },

  stepper: { gap: 6 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderDefault,
  },
  stepValue: { minWidth: 60, alignItems: 'center' },
  stepValueWide: { minWidth: 112 },

  blockedRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing.xs },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  blockForm: { paddingVertical: Spacing.sm, gap: Spacing.sm },

  preview: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.xs,
    padding: Spacing.sm, borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderGlow, backgroundColor: Colors.glassAmber,
  },
  inlineError: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    padding: Spacing.sm, borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderDefault,
  },

  bar: {
    paddingTop: 12, paddingHorizontal: Layout.gutter,
    backgroundColor: 'rgba(11,10,9,0.96)',
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.borderDefault,
  },
  barInner: { width: '100%', maxWidth: Layout.maxReading, alignSelf: 'center', gap: Spacing['2xs'] },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sheetActions: { marginTop: Spacing.md, gap: Spacing['2xs'] },
});
