import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Platform, Modal, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TButton } from '@/components/ui/TButton';
import { TInput } from '@/components/ui/TInput';
import { TSkeleton } from '@/components/ui/TSkeleton';
import { Toast } from '@/components/ui/TToast';
import { Kicker, StatusDot, type StatusTone } from '@/components/v5';
import { BottomSheet } from '@/components/motion';
import {
  type Appointment, DURATIONS_MIN, buildSlot, completeAppointment, dayTimes, fetchRequestAppointments,
  formatDuration, formatSlot, proposeAppointment, respondToAppointment, upcomingDays,
} from '@/lib/appointments';
import { supabase } from '@/lib/supabase';
import { fetchBookingSettings } from '@/lib/care';
import { useAuthStore } from '@/store/auth-store';

interface AppointmentPanelProps {
  requestId: string;
  requestStatus: string;
  viewAs: 'artist' | 'client';
  counterpart: string;
  /** Called after any transition so the parent can refresh the request status. */
  onChanged?: () => void;
  compact?: boolean;
  /** Start instants (ISO) the client picked in the request; past ones are ignored. */
  preferredSlots?: string[];
}

const STATUS: Record<'proposed' | 'confirmed' | 'completed' | 'canceled', { label: string; tone: StatusTone }> = {
  proposed:  { label: 'Créneau proposé', tone: 'wait' },
  confirmed: { label: 'Rendez-vous confirmé', tone: 'open' },
  completed: { label: 'Séance réalisée', tone: 'closed' },
  canceled:  { label: 'Annulé', tone: 'closed' },
};

const dayLabel = new Intl.DateTimeFormat('fr-FR', { weekday: 'short' });
const monthLabel = new Intl.DateTimeFormat('fr-FR', { month: 'short' });
const startDateLabel = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
const startTimeLabel = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });
const DEFAULT_DURATION_MIN = 180;

type Hover = { pressed: boolean; hovered?: boolean };

/** "samedi 18 octobre · 14:00" — a wished start, before any duration is agreed. */
export function formatPreferredSlot(iso: string): string {
  const d = new Date(iso);
  return `${startDateLabel.format(d)} · ${startTimeLabel.format(d)}`;
}

/** The client's wished starts still ahead, soonest first. */
export function upcomingPreferredSlots(slots: string[] | null | undefined, now = Date.now()): string[] {
  return (slots ?? [])
    .filter((s) => {
      const t = new Date(s).getTime();
      return !Number.isNaN(t) && t > now;
    })
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
}

function notify(ok: boolean) {
  if (Platform.OS !== 'web') {
    Haptics.notificationAsync(ok ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error);
  }
}

// ─── Client's wished slots ────────────────────────────────────────────────────
/** Artist: one tap proposes that start with the chosen duration. Client: read-only reminder. */
function PreferredSlots({ slots, duration, interactive, pending, disabled, onPick }: {
  slots: string[]; duration: number; interactive: boolean; pending: string | null; disabled: boolean;
  onPick?: (start: Date, end: Date) => void;
}) {
  if (slots.length === 0) return null;
  return (
    <View style={styles.preferred}>
      <Kicker tone="muted">{interactive ? 'Créneaux souhaités par le client' : 'Vos créneaux souhaités'}</Kicker>
      {interactive && (
        <TText variant="caption" color="tertiary">
          Un geste pour le proposer · séance de {formatDuration(duration)}
        </TText>
      )}
      <View style={styles.preferredList}>
        {slots.map((iso) => {
          const start = new Date(iso);
          const end = new Date(start.getTime() + duration * 60_000);
          if (!interactive) {
            return (
              <View key={iso} style={styles.preferredRow}>
                <Ionicons name="time-outline" size={15} color={Colors.textTertiary} />
                <TText variant="bodySmall" tabular style={{ flex: 1 }}>{formatPreferredSlot(iso)}</TText>
              </View>
            );
          }
          const label = formatSlot(start, end);
          // Postgres returns "+00:00" offsets; compare on the normalised instant.
          const loading = pending === start.toISOString();
          return (
            <Pressable
              key={iso}
              onPress={() => onPick?.(start, end)}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={`Proposer ce créneau : ${label}`}
              accessibilityState={{ disabled, busy: loading }}
              style={(state) => {
                const { pressed, hovered } = state as Hover;
                return [styles.preferredChip, (pressed || hovered) && styles.preferredChipActive, disabled && !loading && { opacity: 0.5 }];
              }}
            >
              <TText variant="bodySmall" weight="medium" tabular style={{ flex: 1 }}>{label}</TText>
              {loading
                ? <ActivityIndicator size="small" color={Colors.flameText} />
                : <Ionicons name="paper-plane-outline" size={15} color={Colors.flameText} />}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ─── Slot picker (artist) ─────────────────────────────────────────────────────
function SlotPicker({ onSubmit, busy, duration, durations, setDuration, preferred, pendingPreferred }: {
  onSubmit: (start: Date, end: Date, notes: string, preferredIso?: string) => void;
  busy: boolean;
  duration: number;
  /** The session lengths the artist offers. */
  durations: readonly number[];
  setDuration: (min: number) => void;
  preferred: string[];
  pendingPreferred: string | null;
}) {
  const days = useMemo(() => upcomingDays(28), []);
  const times = useMemo(() => dayTimes(9, 20, 30), []);
  const [day, setDay] = useState<Date | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  const slot = day && time ? buildSlot(day, time, duration) : null;
  const pastTime = !!day && !!time && !slot;

  return (
    <View>
      <Kicker tone="flame">Rendez-vous</Kicker>
      <TText variant="displayS" style={styles.sheetTitle}>
        Proposer un <TText variant="displayS" italic color="accentGlow">créneau.</TText>
      </TText>

      <PreferredSlots
        slots={preferred}
        duration={duration}
        interactive
        pending={pendingPreferred}
        disabled={busy || !!pendingPreferred}
        onPick={(start, end) => onSubmit(start, end, notes, start.toISOString())}
      />

      <Kicker tone="muted" style={styles.pickLabel}>Jour</Kicker>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayRow}>
        {days.map((d) => {
          const selected = day?.getTime() === d.getTime();
          return (
            <Pressable
              key={d.toISOString()}
              onPress={() => setDay(d)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
              style={(state) => [styles.dayCell, ((state as Hover).hovered || state.pressed) && !selected && styles.cellHover, selected && styles.cellSelected]}
            >
              <TText variant="micro" uppercase style={{ color: selected ? Colors.onInkMuted : Colors.textTertiary }}>
                {dayLabel.format(d).replace('.', '')}
              </TText>
              <TText variant="displayS" tabular style={[styles.dayNum, { color: selected ? Colors.onInk : Colors.ink }]}>{d.getDate()}</TText>
              <TText variant="micro" style={{ color: selected ? Colors.onInkMuted : Colors.textTertiary }}>
                {monthLabel.format(d).replace('.', '')}
              </TText>
            </Pressable>
          );
        })}
      </ScrollView>

      <Kicker tone="muted" style={styles.pickLabel}>Heure de début</Kicker>
      <View style={styles.wrap}>
        {times.map((t) => {
          const selected = time === t;
          return (
            <Pressable
              key={t}
              onPress={() => setTime(t)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={(state) => [styles.timeCell, ((state as Hover).hovered || state.pressed) && !selected && styles.cellHover, selected && styles.cellSelected]}
            >
              <TText variant="caption" tabular weight="medium" style={{ color: selected ? Colors.onInk : Colors.ink }}>{t}</TText>
            </Pressable>
          );
        })}
      </View>

      <Kicker tone="muted" style={styles.pickLabel}>Durée estimée</Kicker>
      <View style={styles.wrap}>
        {durations.map((m) => {
          const selected = duration === m;
          return (
            <Pressable
              key={m}
              onPress={() => setDuration(m)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={(state) => [styles.timeCell, ((state as Hover).hovered || state.pressed) && !selected && styles.cellHover, selected && styles.cellSelected]}
            >
              <TText variant="caption" tabular weight="medium" style={{ color: selected ? Colors.onInk : Colors.ink }}>
                {formatDuration(m)}
              </TText>
            </Pressable>
          );
        })}
      </View>

      <TInput
        label="Message (optionnel)"
        value={notes}
        onChangeText={setNotes}
        placeholder="Ex. prévoir 30 min pour valider le dessin sur place"
        multiline
        containerStyle={{ marginTop: Spacing.md }}
      />

      <View style={styles.summary}>
        <Ionicons name="calendar-outline" size={16} color={slot ? Colors.flameText : Colors.textTertiary} />
        <TText variant="bodySmall" weight={slot ? 'medium' : 'regular'} color={slot ? 'primary' : 'tertiary'} tabular style={{ flex: 1 }}>
          {slot ? formatSlot(slot.start, slot.end) : pastTime ? 'Cet horaire est déjà passé.' : 'Choisissez un jour et une heure.'}
        </TText>
      </View>

      <TButton
        title="Envoyer la proposition"
        onPress={() => slot && onSubmit(slot.start, slot.end, notes)}
        disabled={!slot || !!pendingPreferred}
        loading={busy && !pendingPreferred}
      />
    </View>
  );
}

// ─── Panel ────────────────────────────────────────────────────────────────────
export function AppointmentPanel({ requestId, requestStatus, viewAs, counterpart, onChanged, compact, preferredSlots }: AppointmentPanelProps) {
  const router = useRouter();
  const [items, setItems] = useState<Appointment[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [duration, setDuration] = useState<number>(DEFAULT_DURATION_MIN);
  const [durations, setDurations] = useState<readonly number[]>(DURATIONS_MIN);
  const durationTouched = React.useRef(false);
  const preferred = useMemo(() => upcomingPreferredSlots(preferredSlots), [preferredSlots]);

  // The artist proposes among their own session lengths, the first one by default.
  const ownArtistId = useAuthStore((s) => s.user?.artistId);
  useEffect(() => {
    if (viewAs !== 'artist' || !ownArtistId) return;
    let active = true;
    fetchBookingSettings(ownArtistId)
      .then((settings) => {
        const list = (settings?.sessionDurations ?? []).filter((m) => Number.isInteger(m) && m > 0);
        if (!active || list.length === 0) return;
        setDurations(list);
        if (!durationTouched.current) setDuration(list[0]);
      })
      // Without settings the standard list stays in place.
      .catch(() => {});
    return () => { active = false; };
  }, [viewAs, ownArtistId]);
  const chooseDuration = useCallback((min: number) => { durationTouched.current = true; setDuration(min); }, []);

  const load = useCallback(async () => {
    const { data, error } = await fetchRequestAppointments(requestId);
    setLoadError(error);
    setItems(data);
  }, [requestId]);

  const onChangedRef = React.useRef(onChanged);
  onChangedRef.current = onChanged;

  // Reload when the request moves on (e.g. the other party confirmed) …
  useEffect(() => { void load(); }, [load, requestStatus]);

  // … and live, whenever an appointment of this request changes on the other side.
  // Two panels for the same request can be mounted at once (request page + conversation
  // in the stack): channel names must be unique per instance.
  const instance = useId();
  useEffect(() => {
    const channel = supabase
      .channel(`appointments:${requestId}:${instance}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments', filter: `request_id=eq.${requestId}` }, () => {
        // The other party moved the booking on: refresh the panel and let the
        // screen refresh the request status shown in its header.
        void load().then(() => onChangedRef.current?.());
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [requestId, load, instance]);

  const run = async (key: string, action: () => Promise<{ error: string | null }>, success: string) => {
    if (busy) return;
    setBusy(key);
    const { error } = await action();
    setBusy(null);
    notify(!error);
    if (error) { Toast.error(error); return; }
    Toast.success(success);
    setPicking(false);
    await load();
    onChanged?.();
  };

  const proposeKey = (iso?: string) => (iso ? `propose:${iso}` : 'propose');
  const pendingPreferred = busy?.startsWith('propose:') ? busy.slice('propose:'.length) : null;
  const propose = (start: Date, end: Date, notes = '', preferredIso?: string) =>
    run(proposeKey(preferredIso), () => proposeAppointment(requestId, start, end, notes), 'Proposition envoyée');

  const bookable = requestStatus === 'accepted' || requestStatus === 'confirmed';
  if (!bookable && requestStatus !== 'completed') return null;

  if (items === null) {
    return <TSkeleton height={compact ? 56 : 96} />;
  }

  const current = items.find((a) => a.status === 'proposed' || a.status === 'confirmed') ?? items.find((a) => a.status === 'completed');
  const started = current ? new Date(current.starts_at) <= new Date() : false;
  const isArtist = viewAs === 'artist';

  return (
    <View style={[styles.card, compact && styles.cardCompact]}>
      {loadError ? (
        <TText variant="bodySmall" color="secondary">{loadError}</TText>
      ) : current ? (
        <>
          <StatusDot tone={STATUS[current.status].tone} label={STATUS[current.status].label} />
          <TText
            variant={compact ? 'bodySmall' : 'displayS'}
            weight={compact ? 'semibold' : undefined}
            tabular
            style={[styles.slotText, !compact && styles.slotTextLarge]}
          >
            {formatSlot(current.starts_at, current.ends_at)}
          </TText>
          {!!current.notes && !compact && (
            <TText variant="bodySmall" color="secondary" style={{ marginTop: 6 }}>{current.notes}</TText>
          )}
          {current.status === 'proposed' && (
            <TText variant="caption" color="tertiary" style={{ marginTop: 6 }}>
              {isArtist ? `En attente de la réponse de ${counterpart}.` : `${counterpart} vous propose ce créneau.`}
            </TText>
          )}
        </>
      ) : (
        <>
          <StatusDot tone="closed" label="Rendez-vous" />
          <TText variant="bodySmall" color="secondary" style={{ marginTop: 8 }}>
            {isArtist
              ? 'Proposez un créneau : le client pourra l’accepter en un geste.'
              : `${counterpart} vous proposera un créneau ici.`}
          </TText>
          {bookable && (
            <PreferredSlots
              slots={preferred}
              duration={duration}
              interactive={isArtist}
              pending={pendingPreferred}
              disabled={!!busy}
              onPick={(start, end) => { void propose(start, end, '', start.toISOString()); }}
            />
          )}
        </>
      )}

      {/* ── Actions ── */}
      <View style={styles.actions}>
        {isArtist && bookable && (!current || current.status === 'proposed') && (
          <TButton
            title={current ? 'Proposer un autre créneau' : 'Proposer un créneau'}
            variant={current ? 'secondary' : 'primary'}
            size="md"
            fullWidth={compact}
            onPress={() => setPicking(true)}
            icon={<Ionicons name="calendar-outline" size={16} color={current ? Colors.ink : Colors.paper} />}
          />
        )}
        {!isArtist && current?.status === 'proposed' && (
          <>
            <TButton
              title="Accepter ce créneau"
              size="md"
              fullWidth={false}
              loading={busy === 'accept'}
              disabled={!!busy}
              onPress={() => run('accept', () => respondToAppointment(current.id, true), 'Rendez-vous confirmé')}
            />
            <TButton
              title="Refuser"
              variant="ghost"
              size="md"
              fullWidth={false}
              loading={busy === 'decline'}
              disabled={!!busy}
              onPress={() => run('decline', () => respondToAppointment(current.id, false), 'Créneau refusé')}
            />
          </>
        )}
        {isArtist && current?.status === 'confirmed' && (
          started ? (
            <TButton
              title="Marquer la séance comme réalisée"
              size="md"
              fullWidth={compact}
              loading={busy === 'complete'}
              disabled={!!busy}
              onPress={() => run('complete', () => completeAppointment(current.id), 'Séance enregistrée comme réalisée')}
              icon={<Ionicons name="checkmark-done-outline" size={16} color={Colors.paper} />}
            />
          ) : (
            <TText variant="caption" color="tertiary">Vous pourrez marquer la séance comme réalisée une fois commencée.</TText>
          )
        )}
        {!isArtist && current?.status === 'completed' && (
          <TButton
            title="Laisser un avis"
            variant="secondary"
            size="md"
            fullWidth={compact}
            onPress={() => router.push({ pathname: '/review/new', params: { appointmentId: current.id } })}
            icon={<Ionicons name="star-outline" size={16} color={Colors.ink} />}
          />
        )}
      </View>

      {/* The sheet must cover the whole screen, not this card: host it in a transparent modal. */}
      <Modal visible={picking} transparent animationType="none" onRequestClose={() => setPicking(false)} statusBarTranslucent>
        <BottomSheet visible={picking} onClose={() => setPicking(false)} accessibilityLabel="Proposer un créneau">
          <ScrollView style={{ maxHeight: 620 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <SlotPicker
              busy={!!busy?.startsWith('propose')}
              duration={duration}
              durations={durations}
              setDuration={chooseDuration}
              preferred={preferred}
              pendingPreferred={pendingPreferred}
              onSubmit={(start, end, notes, preferredIso) => { void propose(start, end, notes, preferredIso); }}
            />
          </ScrollView>
        </BottomSheet>
      </Modal>
    </View>
  );
}

const webPointer = Platform.OS === 'web'
  ? ({ cursor: 'pointer', transitionProperty: 'background-color, border-color', transitionDuration: '180ms' } as object)
  : null;

const styles = StyleSheet.create({
  card: {
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.line,
    borderTopWidth: 2,
    borderTopColor: Colors.ink,
    backgroundColor: Colors.white,
  },
  cardCompact: { padding: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.line },
  slotText: { marginTop: 8 },
  slotTextLarge: { fontSize: 26, lineHeight: 29, letterSpacing: -0.4 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: Spacing.sm },

  sheetTitle: { marginTop: 8, marginBottom: Spacing.sm },
  preferred: { marginTop: Spacing.sm, gap: 6 },
  preferredList: { gap: 6, marginTop: 2 },
  preferredRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 28 },
  preferredChip: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    minHeight: 46, paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: Colors.line,
    backgroundColor: Colors.white,
    ...webPointer,
  },
  preferredChipActive: { backgroundColor: Colors.flameSoft, borderColor: Colors.flame },
  pickLabel: { marginTop: Spacing.md, marginBottom: Spacing['2xs'] },
  dayRow: { gap: 6, paddingRight: Spacing.sm },
  dayCell: {
    width: 58, paddingVertical: 10, alignItems: 'center', gap: 2,
    borderWidth: 1, borderColor: Colors.line,
    ...webPointer,
  },
  dayNum: { fontSize: 26, lineHeight: 28, letterSpacing: -0.4 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  timeCell: {
    minWidth: 64, minHeight: 44, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.line,
    ...webPointer,
  },
  cellHover: { backgroundColor: Colors.wash, borderColor: Colors.ink },
  cellSelected: { backgroundColor: Colors.ink, borderColor: Colors.ink },
  summary: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: Spacing.sm, marginBottom: Spacing.sm,
    borderTopWidth: 1, borderTopColor: Colors.line,
  },
});
