import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Platform, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Radius } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TButton } from '@/components/ui/TButton';
import { TInput } from '@/components/ui/TInput';
import { TSkeleton } from '@/components/ui/TSkeleton';
import { Toast } from '@/components/ui/TToast';
import { BottomSheet, enterUp } from '@/components/motion';
import {
  type Appointment, DURATIONS_MIN, buildSlot, completeAppointment, dayTimes, fetchRequestAppointments,
  formatDuration, formatSlot, proposeAppointment, respondToAppointment, upcomingDays,
} from '@/lib/appointments';
import { supabase } from '@/lib/supabase';

interface AppointmentPanelProps {
  requestId: string;
  requestStatus: string;
  viewAs: 'artist' | 'client';
  counterpart: string;
  /** Called after any transition so the parent can refresh the request status. */
  onChanged?: () => void;
  compact?: boolean;
}

const STATUS = {
  proposed:  { label: 'Créneau proposé', color: Colors.warning },
  confirmed: { label: 'Rendez-vous confirmé', color: Colors.success },
  completed: { label: 'Séance réalisée', color: Colors.accentWarm },
  canceled:  { label: 'Annulé', color: Colors.textTertiary },
} as const;

const dayLabel = new Intl.DateTimeFormat('fr-FR', { weekday: 'short' });
const monthLabel = new Intl.DateTimeFormat('fr-FR', { month: 'short' });

function notify(ok: boolean) {
  if (Platform.OS !== 'web') {
    Haptics.notificationAsync(ok ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error);
  }
}

// ─── Slot picker (artist) ─────────────────────────────────────────────────────
function SlotPicker({ onSubmit, busy }: { onSubmit: (start: Date, end: Date, notes: string) => void; busy: boolean }) {
  const days = useMemo(() => upcomingDays(28), []);
  const times = useMemo(() => dayTimes(9, 20, 30), []);
  const [day, setDay] = useState<Date | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [duration, setDuration] = useState<number>(180);
  const [notes, setNotes] = useState('');

  const slot = day && time ? buildSlot(day, time, duration) : null;
  const pastTime = !!day && !!time && !slot;

  return (
    <View>
      <TText variant="displayS" style={styles.sheetTitle}>
        Proposer un <TText variant="displayS" italic color="accentGlow">créneau</TText>
      </TText>

      <TText variant="label" color="tertiary" uppercase style={styles.pickLabel}>Jour</TText>
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
              style={[styles.dayCell, selected && styles.cellSelected]}
            >
              <TText variant="micro" uppercase style={{ color: selected ? Colors.textInverse : Colors.textTertiary }}>
                {dayLabel.format(d).replace('.', '')}
              </TText>
              <TText variant="title2" tabular style={{ color: selected ? Colors.textInverse : Colors.textPrimary }}>{d.getDate()}</TText>
              <TText variant="micro" style={{ color: selected ? Colors.textInverse : Colors.textTertiary }}>
                {monthLabel.format(d).replace('.', '')}
              </TText>
            </Pressable>
          );
        })}
      </ScrollView>

      <TText variant="label" color="tertiary" uppercase style={styles.pickLabel}>Heure de début</TText>
      <View style={styles.wrap}>
        {times.map((t) => {
          const selected = time === t;
          return (
            <Pressable
              key={t}
              onPress={() => setTime(t)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={[styles.timeCell, selected && styles.cellSelected]}
            >
              <TText variant="caption" tabular weight="medium" style={{ color: selected ? Colors.textInverse : Colors.textSecondary }}>{t}</TText>
            </Pressable>
          );
        })}
      </View>

      <TText variant="label" color="tertiary" uppercase style={styles.pickLabel}>Durée estimée</TText>
      <View style={styles.wrap}>
        {DURATIONS_MIN.map((m) => {
          const selected = duration === m;
          return (
            <Pressable
              key={m}
              onPress={() => setDuration(m)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={[styles.timeCell, selected && styles.cellSelected]}
            >
              <TText variant="caption" tabular weight="medium" style={{ color: selected ? Colors.textInverse : Colors.textSecondary }}>
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
        <Ionicons name="calendar-outline" size={16} color={slot ? Colors.accentWarm : Colors.textTertiary} />
        <TText variant="bodySmall" color={slot ? 'primary' : 'tertiary'} style={{ flex: 1 }}>
          {slot ? formatSlot(slot.start, slot.end) : pastTime ? 'Cet horaire est déjà passé.' : 'Choisissez un jour et une heure.'}
        </TText>
      </View>

      <TButton
        title="Envoyer la proposition"
        onPress={() => slot && onSubmit(slot.start, slot.end, notes)}
        disabled={!slot}
        loading={busy}
      />
    </View>
  );
}

// ─── Panel ────────────────────────────────────────────────────────────────────
export function AppointmentPanel({ requestId, requestStatus, viewAs, counterpart, onChanged, compact }: AppointmentPanelProps) {
  const router = useRouter();
  const [items, setItems] = useState<Appointment[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

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

  const bookable = requestStatus === 'accepted' || requestStatus === 'confirmed';
  if (!bookable && requestStatus !== 'completed') return null;

  if (items === null) {
    return <TSkeleton height={compact ? 56 : 96} radius={Radius.lg} />;
  }

  const current = items.find((a) => a.status === 'proposed' || a.status === 'confirmed') ?? items.find((a) => a.status === 'completed');
  const started = current ? new Date(current.starts_at) <= new Date() : false;
  const isArtist = viewAs === 'artist';

  return (
    <Animated.View entering={enterUp(0)} style={[styles.card, compact && styles.cardCompact]}>
      {loadError ? (
        <TText variant="bodySmall" color="secondary">{loadError}</TText>
      ) : current ? (
        <>
          <View style={styles.statusRow}>
            <View style={[styles.dot, { backgroundColor: STATUS[current.status].color }]} />
            <TText variant="label" uppercase style={{ color: STATUS[current.status].color }}>{STATUS[current.status].label}</TText>
          </View>
          <TText variant={compact ? 'bodySmall' : 'title2'} serif={!compact} style={styles.slotText}>
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
          <View style={styles.statusRow}>
            <View style={[styles.dot, { backgroundColor: Colors.textTertiary }]} />
            <TText variant="label" color="tertiary" uppercase>Rendez-vous</TText>
          </View>
          <TText variant="bodySmall" color="secondary" style={{ marginTop: 6 }}>
            {isArtist
              ? 'Proposez un créneau : le client pourra l’accepter en un geste.'
              : `${counterpart} vous proposera un créneau ici.`}
          </TText>
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
            icon={<Ionicons name="calendar-outline" size={16} color={current ? Colors.textPrimary : Colors.textInverse} />}
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
              icon={<Ionicons name="checkmark-done-outline" size={16} color={Colors.textInverse} />}
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
            icon={<Ionicons name="star-outline" size={16} color={Colors.textPrimary} />}
          />
        )}
      </View>

      {/* The sheet must cover the whole screen, not this card: host it in a transparent modal. */}
      <Modal visible={picking} transparent animationType="none" onRequestClose={() => setPicking(false)} statusBarTranslucent>
        <BottomSheet visible={picking} onClose={() => setPicking(false)} accessibilityLabel="Proposer un créneau">
          <ScrollView style={{ maxHeight: 620 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <SlotPicker
              busy={busy === 'propose'}
              onSubmit={(start, end, notes) => run('propose', () => proposeAppointment(requestId, start, end, notes), 'Proposition envoyée')}
            />
          </ScrollView>
        </BottomSheet>
      </Modal>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.md,
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderDefault,
    backgroundColor: Colors.bgElevated,
  },
  cardCompact: { padding: Spacing.sm, borderRadius: Radius.lg },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  slotText: { marginTop: 8, textTransform: 'none' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: Spacing.sm },

  sheetTitle: { marginBottom: Spacing.sm },
  pickLabel: { marginTop: Spacing.md, marginBottom: Spacing['2xs'] },
  dayRow: { gap: 8, paddingRight: Spacing.sm },
  dayCell: {
    width: 58, paddingVertical: 10, alignItems: 'center', gap: 2,
    borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderDefault,
  },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  timeCell: {
    minWidth: 64, height: 36, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center',
    borderRadius: Radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderDefault,
  },
  cellSelected: { backgroundColor: Colors.accentAction, borderColor: Colors.accentAction },
  summary: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: Spacing.sm, marginBottom: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.borderDefault,
  },
});
