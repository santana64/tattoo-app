import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Layout } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TButton } from '@/components/ui/TButton';
import { TInput } from '@/components/ui/TInput';
import { THeader } from '@/components/ui/THeader';
import { TSkeleton } from '@/components/ui/TSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Toast } from '@/components/ui/TToast';
import { BottomSheet } from '@/components/motion';
import {
  IconButton, InkPanel, Kicker, Masthead, PageWrap, Rule, SectionHead, TextLink, Toggle,
} from '@/components/v5';
import { Panel, StepControl } from '@/components/v5/studio';
import { useAuthStore } from '@/store/auth-store';
import { useContentDimensions } from '@/hooks/useContentDimensions';
import { supabase } from '@/lib/supabase';
import { durationLabel, type BookingSettings } from '@/lib/care';
import { BookingSettingsSection } from '@/components/booking/BookingSettingsSection';
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
const DEFAULT_PREVIEW_MIN = 120; // used until the artist's own session lengths are known
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
/** − value + ; also an "adjustable" element for screen readers (swipe up / down). */
function Stepper({ label, display, spoken, canDec, canInc, onDec, onInc, decLabel, incLabel, wide, onInk = false }: {
  label: string; display: string; spoken: string; canDec: boolean; canInc: boolean;
  onDec: () => void; onInc: () => void; decLabel: string; incLabel: string; wide?: boolean; onInk?: boolean;
}) {
  return (
    <View style={styles.stepper}>
      <TText variant="micro" uppercase style={{ color: onInk ? Colors.onInkMuted : Colors.textSecondary }}>{label}</TText>
      <View style={styles.stepperRow}>
        <StepControl icon="remove" label={decLabel} disabled={!canDec} onPress={onDec} />
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
          <TText variant="bodySmall" weight="semibold" tabular numberOfLines={1} style={{ color: onInk ? Colors.onInk : Colors.ink }}>
            {display}
          </TText>
        </View>
        <StepControl icon="add" label={incLabel} disabled={!canInc} onPress={onInc} />
      </View>
    </View>
  );
}

function DayRow({ day, draft, onChange }: { day: number; draft: DayDraft; onChange: (next: DayDraft) => void }) {
  const name = DAY_NAMES[day];
  const invalid = draft.open ? scheduleError([{ day, opens: draft.opens, closes: draft.closes }]) : null;
  return (
    <View style={styles.dayRow}>
      <View style={styles.dayHead}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <TText variant="displayS" style={styles.dayName}>{name}</TText>
          <TText variant="caption" color="secondary" tabular style={{ marginTop: 2 }}>
            {draft.open ? `${draft.opens} — ${draft.closes}` : 'Fermé'}
          </TText>
        </View>
        <Toggle
          value={draft.open}
          onChange={(open) => { haptic(); onChange({ ...draft, open }); }}
          label={`${name} : ${draft.open ? 'ouvert' : 'fermé'}`}
        />
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
    <View>
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <View key={i} style={[styles.dayRow, styles.dayHead]}>
          <View style={{ flex: 1, gap: 6 }}>
            <TSkeleton width="35%" height={20} />
            <TSkeleton width="25%" height={11} />
          </View>
          <TSkeleton width={58} height={30} />
        </View>
      ))}
    </View>
  );
}

function InlineError({ message, onRetry, onInk = false }: { message: string; onRetry: () => void; onInk?: boolean }) {
  return (
    <View style={[styles.inlineError, onInk && { borderColor: Colors.onInkLine }]} accessibilityRole="alert">
      <TText variant="bodySmall" style={{ flex: 1, color: onInk ? Colors.onInkMuted : Colors.textSecondary }}>{message}</TText>
      <TextLink label="Réessayer" icon="refresh" onPress={onRetry} onInk={onInk} />
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function AvailabilityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isWide } = useContentDimensions();
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
  // The preview uses the artist's shortest session, the one clients see first.
  const previewDurationRef = useRef(DEFAULT_PREVIEW_MIN);
  const [previewDuration, setPreviewDuration] = useState(DEFAULT_PREVIEW_MIN);
  const [durationCount, setDurationCount] = useState(1);

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
    const duration = previewDurationRef.current;
    try {
      const [slots, artist] = await Promise.all([
        fetchFreeSlots(artistId, PREVIEW_DAYS, duration),
        supabase.from('artists').select('booking_status').eq('id', artistId).maybeSingle(),
      ]);
      setPreviewDuration(duration);
      setFreeCount(slots.length);
      setBookingStatus(artist.data?.booking_status ?? null);
    } catch {
      setPreviewError(true);
    }
  }, [artistId]);

  useEffect(() => { void loadBlocked(); }, [loadBlocked]);

  // The preview waits for the booking settings (it needs the session length), then follows each save.
  const handleSettings = useCallback((settings: BookingSettings | null) => {
    const durations = settings?.sessionDurations.filter((m) => Number.isInteger(m) && m > 0) ?? [];
    previewDurationRef.current = durations.length ? Math.min(...durations) : DEFAULT_PREVIEW_MIN;
    setDurationCount(Math.max(durations.length, 1));
    void loadPreview();
  }, [loadPreview]);

  // ── Not an artist ──
  if (!artistId) {
    return (
      <View style={styles.container}>
        <THeader showBack title="Horaires et disponibilités" />
        {authLoading && !user ? (
          <PageWrap style={{ paddingTop: Spacing.xl }}><WeekSkeleton /></PageWrap>
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
    <Panel style={styles.section}>
      <SectionHead
        kicker="01 / Horaires habituels"
        title="Votre semaine."
        description="Les clients choisissent parmi les créneaux libres de ces plages, hors séances déjà prévues et jours bloqués."
        style={styles.sectionHead}
      />
      <Rule tone="ink" />
      {weekState === 'loading' || !draft ? (
        weekState === 'error' ? (
          <InlineError message="Vos horaires n’ont pas pu être chargés." onRetry={() => setWeekAttempt((n) => n + 1)} />
        ) : <WeekSkeleton />
      ) : (
        <View>
          {WEEK_ORDER.map((d) => (
            <DayRow key={d} day={d} draft={draft[d]} onChange={(next) => updateDay(d, next)} />
          ))}
        </View>
      )}
    </Panel>
  );

  // ── Section B ──
  const blockedSection = (
    <InkPanel style={styles.section}>
      <SectionHead
        onInk
        kicker="03 / Jours bloqués"
        title="Quand l’atelier ferme."
        description="Congés, conventions, déplacements : aucun créneau n’est proposé pendant ces jours."
        style={styles.sectionHead}
      />

      {blocked === null && !blockedError ? (
        <View style={{ gap: Spacing['2xs'], marginBottom: Spacing.md }}>
          <TSkeleton height={48} />
          <TSkeleton height={48} />
        </View>
      ) : blockedError ? (
        <View style={{ marginBottom: Spacing.md }}>
          <InlineError onInk message="Les jours bloqués n’ont pas pu être chargés." onRetry={() => { void loadBlocked(); }} />
        </View>
      ) : blocked && blocked.length > 0 ? (
        <View style={styles.blockedList}>
          {blocked.map((p) => {
            const range = formatBlockedRange(p);
            return (
              <View key={p.id} style={styles.blockedRow}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <TText variant="bodySmall" weight="semibold" tabular color="onInk">{range}</TText>
                  {!!p.label && <TText variant="caption" color="onInkMuted" numberOfLines={1}>{p.label}</TText>}
                </View>
                <IconButton
                  icon="trash-outline"
                  onInk
                  label={`Supprimer le blocage : ${range}${p.label ? `, ${p.label}` : ''}`}
                  onPress={() => { setRemoveError(null); setToRemove(p); }}
                />
              </View>
            );
          })}
        </View>
      ) : (
        <TText variant="bodySmall" color="onInkMuted" style={{ marginBottom: Spacing.md }}>Aucun jour bloqué à venir.</TText>
      )}

      <View style={styles.blockForm}>
        <Kicker tone="onInk">Bloquer une période</Kicker>
        <View style={styles.dayTimes}>
          <Stepper
            wide
            onInk
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
            onInk
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
        <View>
          <View style={styles.inkLabelRow}>
            <TText variant="caption" weight="semibold" color="onInk" style={{ fontSize: 12 }}>Motif</TText>
            <TText variant="caption" color="onInkMuted">Optionnel</TText>
          </View>
          <TInput
            accessibilityLabel="Motif"
            value={blockLabel}
            onChangeText={setBlockLabel}
            placeholder="Convention, congés…"
            maxLength={80}
            containerStyle={{ marginBottom: 0 }}
          />
        </View>
        <TButton
          title="Bloquer ces jours"
          variant="glass"
          size="md"
          loading={blocking}
          onPress={block}
          accessibilityLabel={`Bloquer ${blockDayCount} jour${blockDayCount > 1 ? 's' : ''}, ${longDateFmt.format(blockFrom)}${blockDayCount > 1 ? ` au ${longDateFmt.format(blockTo)}` : ''}`}
        />
      </View>
    </InkPanel>
  );

  // ── Section C ──
  const sessionLength = `${durationLabel(previewDuration)}${durationCount > 1 ? ' (votre séance la plus courte)' : ''}`;
  const countLabel = freeCount === null || freeCount === 0 ? null
    : freeCount >= SLOTS_CAP ? `au moins ${SLOTS_CAP} créneaux libres`
    : `${freeCount} créneau${freeCount > 1 ? 'x' : ''} libre${freeCount > 1 ? 's' : ''}`;
  const pausedCopy = bookingStatus === 'paused'
    ? 'Vous êtes en liste d’attente : vos créneaux restent masqués aux clients tant que les demandes sont en pause.'
    : bookingStatus === 'closed'
      ? 'Votre carnet est complet : vos créneaux restent masqués aux clients tant que vous ne rouvrez pas les demandes.'
      : null;

  const previewSection = (
    <Panel style={styles.section}>
      <SectionHead kicker="04 / Aperçu" title="Ce que voient les clients." style={styles.sectionHead} />
      <View style={styles.preview} accessibilityLiveRegion="polite">
        {previewError ? (
          <>
            <TText variant="bodySmall" color="secondary">L’aperçu n’a pas pu être calculé.</TText>
            <TextLink label="Réessayer" icon="refresh" onPress={() => { void loadPreview(); }} style={{ alignSelf: 'flex-start' }} />
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
    </Panel>
  );

  const settingsSection = <BookingSettingsSection artistId={artistId} onSettings={handleSettings} index={1} />;

  const showBar = weekState === 'ready' && !!draft;
  const barMessage = saveError ?? (dirty ? validation : null);

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <THeader showBack title="Horaires et disponibilités" />

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + (showBar ? 150 : Spacing['2xl']) }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <PageWrap>
          <Masthead
            kicker="Réservation / Maîtrise du temps"
            title="Ouvrir du temps."
            emphasis="Garder de l’air."
            breakEmphasis
            description="Publiez vos horaires : vos clients choisissent jusqu’à trois créneaux libres dans leur demande, et vous confirmez l’un d’eux en un geste."
          />

          {isWide ? (
            <View style={styles.columns}>
              <View style={styles.column}>
                {weekSection}
                {previewSection}
              </View>
              <View style={styles.column}>
                {settingsSection}
                {blockedSection}
              </View>
            </View>
          ) : (
            <View style={styles.stack}>
              {weekSection}
              {settingsSection}
              {blockedSection}
              {previewSection}
            </View>
          )}
        </PageWrap>
      </ScrollView>

      {showBar && (
        <View style={[styles.bar, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.barInner}>
            {!!barMessage && (
              <View style={styles.errorRow} accessibilityRole="alert" accessibilityLiveRegion="assertive">
                <Ionicons name="alert-circle-outline" size={16} color={Colors.error} />
                <TText variant="caption" color="error" style={{ flex: 1 }}>{barMessage}</TText>
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
          <TText variant="caption" color="error" style={{ marginTop: Spacing.xs }} accessibilityRole="alert">{removeError}</TText>
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
  columns: { flexDirection: 'row', gap: 17, alignItems: 'flex-start' },
  column: { flex: 1, minWidth: 0, gap: 17 },
  stack: { gap: Spacing.md },

  section: {},
  sectionHead: { marginBottom: Spacing.md },

  dayRow: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.line },
  dayHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  dayName: { fontSize: 25, lineHeight: 28, letterSpacing: -0.4 },
  dayTimes: { flexDirection: 'row', flexWrap: 'wrap', columnGap: Spacing.lg, rowGap: Spacing.sm, marginTop: Spacing.sm },

  stepper: { gap: 6 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepValue: { minWidth: 60, alignItems: 'center' },
  stepValueWide: { minWidth: 112 },

  blockedList: { marginBottom: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.onInkLine },
  blockedRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing.xs,
    borderTopWidth: 1, borderTopColor: Colors.onInkLine,
  },
  blockForm: { gap: Spacing.md },
  inkLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },

  preview: { gap: 8, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.ink },
  inlineError: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.xs,
    paddingVertical: Spacing.sm, borderBottomWidth: 1, borderColor: Colors.line,
  },

  bar: {
    paddingTop: 12, paddingHorizontal: Layout.gutter,
    backgroundColor: Colors.paper,
    borderTopWidth: 1, borderTopColor: Colors.ink,
  },
  barInner: { width: '100%', maxWidth: Layout.maxReading, alignSelf: 'center', gap: Spacing['2xs'] },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sheetActions: { marginTop: Spacing.md, gap: Spacing['2xs'] },
});
