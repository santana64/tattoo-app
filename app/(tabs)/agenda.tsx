import React, { useState, useEffect, useMemo } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  Pressable,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TAvatar } from '@/components/ui/TAvatar';
import { TButton } from '@/components/ui/TButton';
import { TSkeleton } from '@/components/ui/TSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Toast } from '@/components/ui/TToast';
import {
  DetailRow, IconButton, InkPanel, Kicker, Masthead, PageWrap, Rule, StatusDot, TextLink, type StatusTone,
} from '@/components/v5';
import { Panel } from '@/components/v5/studio';
import { exportCalendar } from '@/components/booking/calendar-export';
import { useAuthStore } from '@/store/auth-store';
import { useContentDimensions, useShell } from '@/hooks/useContentDimensions';
import { supabase } from '@/lib/supabase';
import { absoluteUrl } from '@/lib/site';
import type { CalendarEvent } from '@/lib/ics';

interface RealAppointment {
  id: string;
  startsAt: string;
  endsAt: string;
  status: 'proposed' | 'confirmed' | 'completed' | 'canceled';
  bodyZone: string | null;
  notes: string | null;
  clientName: string;
  clientAvatar: string | null;
  artistBlaze: string;
}

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const DAYS_LONG = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const MONTHS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const DAY_MS = 24 * 60 * 60 * 1000;
const CHIPS_PER_DAY = 3;

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const weekdayIndex = (d: Date) => (d.getDay() + 6) % 7; // Monday = 0
const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const formatTime = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const formatLongDate = (d: Date) => `${DAYS_LONG[weekdayIndex(d)]} ${d.getDate()} ${MONTHS_FR[d.getMonth()]}`;

// Get the Monday of the week containing `baseDate`
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun,1=Mon...6=Sat
  const diff = day === 0 ? -6 : 1 - day; // adjust to Monday
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekDates(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
}

function weekRangeLabel(dates: Date[]) {
  const first = dates[0];
  const last = dates[6];
  return first.getMonth() === last.getMonth()
    ? `Semaine du ${first.getDate()} au ${last.getDate()} ${MONTHS_FR[last.getMonth()]}`
    : `Semaine du ${first.getDate()} ${MONTHS_FR[first.getMonth()]} au ${last.getDate()} ${MONTHS_FR[last.getMonth()]}`;
}

const STATUS_CONFIG: Record<RealAppointment['status'], { label: string; tone: StatusTone }> = {
  proposed:  { label: 'Proposé',  tone: 'wait' },
  confirmed: { label: 'Confirmé', tone: 'open' },
  completed: { label: 'Terminé',  tone: 'closed' },
  canceled:  { label: 'Annulé',   tone: 'alert' },
};

// ─── Pieces ───────────────────────────────────────────────────────────────────
/** Event chip inside a calendar cell: ink when confirmed, clay while proposed. */
function EventChip({ apt, counterpart }: { apt: RealAppointment; counterpart: string }) {
  const start = new Date(apt.startsAt);
  const tone = apt.status === 'confirmed' ? styles.chipInk
    : apt.status === 'proposed' ? styles.chipClay
    : apt.status === 'completed' ? styles.chipDone
    : styles.chipCanceled;
  const color = apt.status === 'confirmed' ? Colors.onInk
    : apt.status === 'proposed' ? Colors.ink
    : Colors.textSecondary;
  return (
    <View style={[styles.chip, tone]}>
      <TText
        variant="micro"
        tabular
        numberOfLines={1}
        style={[{ color, letterSpacing: 0, fontSize: 10.5, lineHeight: 14 }, apt.status === 'canceled' && styles.struck]}
      >
        {`${formatTime(start)} — ${counterpart}`}
      </TText>
    </View>
  );
}

/** Wide calendar cell: white sheet, serif numeral, the day's sessions as chips. */
function CalendarCell({ date, selected, isToday, items, counterpartOf, onPress }: {
  date: Date; selected: boolean; isToday: boolean; items: RealAppointment[];
  counterpartOf: (a: RealAppointment) => string; onPress: () => void;
}) {
  const count = items.length;
  const a11y = `${capitalize(formatLongDate(date))}${isToday ? ', aujourd’hui' : ''}, ${count ? `${count} rendez-vous` : 'aucun rendez-vous'}`;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ selected }}
      style={(state) => [
        styles.cell,
        webPointer,
        ((state as Hover).hovered || selected) && { backgroundColor: Colors.wash },
        selected && styles.cellSelected,
      ]}
    >
      <TText variant="micro" uppercase style={{ color: isToday ? Colors.flameText : Colors.textSecondary }}>
        {isToday ? `${DAYS[weekdayIndex(date)]} · Auj.` : DAYS[weekdayIndex(date)]}
      </TText>
      <TText variant="displayS" tabular style={[styles.cellNum, isToday && { color: Colors.accentGlow }]}>
        {date.getDate()}
      </TText>
      {count === 0 ? (
        <TText variant="micro" color="tertiary" style={{ letterSpacing: 0, marginTop: 14 }}>Aucune séance</TText>
      ) : (
        <View style={{ gap: 4, marginTop: 12 }}>
          {items.slice(0, CHIPS_PER_DAY).map((a) => <EventChip key={a.id} apt={a} counterpart={counterpartOf(a)} />)}
          {count > CHIPS_PER_DAY ? (
            <TText variant="micro" color="secondary" tabular style={{ letterSpacing: 0 }}>{`+ ${count - CHIPS_PER_DAY}`}</TText>
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

/** Phone week strip cell: compact, ink when selected. */
function StripCell({ date, selected, isToday, count, onPress }: {
  date: Date; selected: boolean; isToday: boolean; count: number; onPress: () => void;
}) {
  const a11y = `${capitalize(formatLongDate(date))}${isToday ? ', aujourd’hui' : ''}, ${count ? `${count} rendez-vous` : 'aucun rendez-vous'}`;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ selected }}
      style={[styles.strip, selected && styles.stripSelected]}
    >
      <TText variant="micro" uppercase style={{ color: selected ? Colors.onInkMuted : isToday ? Colors.flameText : Colors.textSecondary, letterSpacing: 0.4 }}>
        {DAYS[weekdayIndex(date)]}
      </TText>
      <TText
        variant="displayS"
        tabular
        style={[styles.stripNum, { color: selected ? Colors.onInk : isToday ? Colors.accentGlow : Colors.ink }]}
      >
        {date.getDate()}
      </TText>
      <View style={[styles.stripMark, count > 0 && { backgroundColor: selected ? Colors.flame : Colors.ink }]} />
    </Pressable>
  );
}

function AppointmentRow({ apt, counterpart, avatar }: {
  apt: RealAppointment; counterpart: string; avatar: string | null;
}) {
  const router = useRouter();
  const status = STATUS_CONFIG[apt.status] ?? STATUS_CONFIG.proposed;
  const start = new Date(apt.startsAt);
  const end = new Date(apt.endsAt);
  const meta = [status.label, apt.bodyZone].filter(Boolean).join(' · ');

  return (
    <Pressable
      onPress={() => router.push(`/appointment/${apt.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${formatTime(start)} à ${formatTime(end)}, ${counterpart}, ${meta}`}
      style={(state) => [
        styles.aptRow,
        webPointer,
        ((state as Hover).hovered || (state as Hover).pressed) && { backgroundColor: Colors.wash },
        apt.status === 'canceled' && { opacity: 0.6 },
      ]}
    >
      <View style={styles.aptTime}>
        <TText variant="bodySmall" weight="semibold" tabular>{formatTime(start)}</TText>
        <TText variant="caption" color="tertiary" tabular>{formatTime(end)}</TText>
      </View>
      <View style={styles.aptBody}>
        <TText variant="displayS" numberOfLines={1} style={styles.aptName}>{counterpart}</TText>
        <View style={styles.aptMeta}>
          <StatusDot tone={status.tone} label={status.label} />
          {!!apt.bodyZone && (
            <TText variant="caption" color="secondary" numberOfLines={1} style={{ flexShrink: 1 }}>{apt.bodyZone}</TText>
          )}
        </View>
        {!!apt.notes && (
          <TText variant="caption" color="tertiary" numberOfLines={1} style={{ marginTop: 4 }}>{apt.notes}</TText>
        )}
      </View>
      <TAvatar uri={avatar} name={counterpart} size="md" />
    </Pressable>
  );
}

function ListSkeleton() {
  return (
    <View style={{ gap: Spacing.md, paddingTop: Spacing.md }}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 52, gap: 6 }}>
            <TSkeleton width={46} height={14} />
            <TSkeleton width={36} height={11} />
          </View>
          <View style={{ flex: 1, gap: 8 }}>
            <TSkeleton width="55%" height={20} />
            <TSkeleton width="40%" height={11} />
          </View>
          <TSkeleton width={40} height={40} />
        </View>
      ))}
    </View>
  );
}

type Hover = { pressed: boolean; hovered?: boolean };
const webPointer = Platform.OS === 'web'
  ? ({ cursor: 'pointer', transitionProperty: 'background-color', transitionDuration: '180ms' } as object)
  : null;

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function AgendaScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isWide } = useContentDimensions();
  const { hasSidebar } = useShell();
  const { user } = useAuthStore();
  const isArtist = user?.role === 'artist';
  const [appointments, setAppointments] = useState<RealAppointment[]>([]);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [selectedDay, setSelectedDay] = useState(() => weekdayIndex(new Date()));
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));

  // Fetch real appointments from Supabase
  useEffect(() => {
    if (!user?.id) return;
    let active = true;

    const fetchAppts = async () => {
      let query;
      if (user.role === 'artist' && user.artistId) {
        query = supabase
          .from('appointments')
          .select(`*, profiles!client_id(display_name, avatar_url)`)
          .eq('artist_id', user.artistId)
          .order('starts_at');
      } else {
        query = supabase
          .from('appointments')
          .select(`*, artists!artist_id(blaze)`)
          .eq('client_id', user.id)
          .order('starts_at');
      }

      const { data, error } = await query;
      if (!active) return;
      if (error || !data) { setLoadState('error'); return; }

      setAppointments(data.map((a: any) => ({
        id: a.id,
        startsAt: a.starts_at,
        endsAt: a.ends_at,
        status: a.status,
        bodyZone: a.body_zone ?? null,
        notes: a.notes ?? null,
        clientName: a.profiles?.display_name ?? 'Client',
        clientAvatar: a.profiles?.avatar_url ?? null,
        artistBlaze: a.artists?.blaze ?? 'Artiste',
      })));
      setLoadState('ready');
    };

    setLoadState((s) => (s === 'ready' ? s : 'loading'));
    fetchAppts().catch(() => { if (active) setLoadState('error'); });
    return () => { active = false; };
  }, [user?.id, user?.artistId, user?.role, attempt]);

  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);
  const today = new Date();
  const selectedDate = weekDates[selectedDay];

  const appointmentsOn = (date: Date) => appointments.filter((a) => sameDay(new Date(a.startsAt), date));
  const dayAppointments = appointmentsOn(selectedDate);
  const counterpartOf = (a: RealAppointment) => (isArtist ? a.clientName : a.artistBlaze);

  const weekEnd = new Date(weekStart.getTime() + 7 * DAY_MS);
  const weekAppts = appointments.filter((a) => {
    const t = new Date(a.startsAt).getTime();
    return t >= weekStart.getTime() && t < weekEnd.getTime() && a.status !== 'canceled';
  });
  const weekStats = {
    total: weekAppts.length,
    confirmed: weekAppts.filter((a) => a.status === 'confirmed').length,
    proposed: weekAppts.filter((a) => a.status === 'proposed').length,
  };

  // Next upcoming appointment after the selected day, to jump straight to it.
  const nextAfterSelected = useMemo(() => {
    const endOfDay = new Date(selectedDate);
    endOfDay.setHours(23, 59, 59, 999);
    return appointments.find((a) => a.status !== 'canceled' && new Date(a.startsAt) > endOfDay) ?? null;
  }, [appointments, selectedDate]);

  const shiftWeek = (delta: number) => {
    setWeekStart((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + delta * 7);
      return d;
    });
  };
  const goToDate = (d: Date) => {
    setWeekStart(getWeekStart(d));
    setSelectedDay(weekdayIndex(d));
  };
  const isOnToday = sameDay(selectedDate, today);

  // One .ics with every session still ahead (proposed ones as tentative).
  const exportUpcoming = async () => {
    if (loadState !== 'ready') return;
    const now = Date.now();
    const events: CalendarEvent[] = appointments
      .filter((a) => (a.status === 'proposed' || a.status === 'confirmed') && new Date(a.startsAt).getTime() > now)
      .map((a) => ({
        id: a.id,
        start: a.startsAt,
        end: a.endsAt,
        title: `Séance tatouage — ${isArtist ? a.clientName : a.artistBlaze}`,
        description: [
          a.bodyZone ? `Zone : ${a.bodyZone}` : null,
          a.notes,
          a.status === 'proposed' ? 'Créneau en attente de confirmation.' : null,
          `Détails : ${absoluteUrl(`/appointment/${a.id}`)}`,
        ].filter(Boolean).join('\n'),
        tentative: a.status === 'proposed',
      }));
    if (events.length === 0) { Toast.info('Aucune séance à venir à exporter.'); return; }
    const ok = await exportCalendar(events, 'inkr-seances.ics');
    if (ok && Platform.OS === 'web') Toast.success(`${events.length} séance${events.length > 1 ? 's' : ''} exportée${events.length > 1 ? 's' : ''}`);
  };

  const monthLabel = capitalize(`${MONTHS_FR[weekDates[3].getMonth()]} ${weekDates[3].getFullYear()}`);

  // Sessions are booked from a request: artists publish their hours, clients find an artist.
  const openNewAppointment = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push(isArtist ? '/availability' : '/(tabs)/explore');
  };
  const newAppointmentLabel = isArtist ? 'Horaires et disponibilités' : 'Trouver un artiste';

  // ── Day panel content
  let dayContent: React.ReactNode;
  if (!user || loadState === 'loading') {
    dayContent = <ListSkeleton />;
  } else if (loadState === 'error') {
    dayContent = (
      <EmptyState
        icon="cloud-offline-outline"
        title="Agenda indisponible"
        description="Le chargement des rendez-vous a échoué. Vérifiez votre connexion."
        ctaLabel="Réessayer"
        onCta={() => { setLoadState('loading'); setAttempt((n) => n + 1); }}
        style={styles.inlineEmpty}
      />
    );
  } else if (appointments.length === 0) {
    dayContent = (
      <EmptyState
        icon="calendar-outline"
        title="Aucun rendez-vous"
        description={isArtist
          ? 'Publiez vos horaires : vos clients choisiront parmi vos créneaux libres, et les séances confirmées apparaîtront ici.'
          : 'Vos séances planifiées avec un artiste apparaîtront ici.'}
        ctaLabel={newAppointmentLabel}
        onCta={openNewAppointment}
        style={styles.inlineEmpty}
      />
    );
  } else if (dayAppointments.length === 0) {
    dayContent = (
      <View style={styles.freeDay}>
        <TText variant="displayS" style={styles.freeTitle}>Journée libre.</TText>
        <TText variant="bodySmall" color="secondary" style={{ marginTop: 6 }}>
          Aucun rendez-vous prévu le {formatLongDate(selectedDate)}.
        </TText>
        {nextAfterSelected && (
          <TButton
            title={`Prochain : ${formatLongDate(new Date(nextAfterSelected.startsAt))} à ${formatTime(new Date(nextAfterSelected.startsAt))}`}
            variant="secondary"
            size="sm"
            fullWidth={false}
            style={{ marginTop: Spacing.md, alignSelf: 'flex-start' }}
            icon={<Ionicons name="arrow-forward" size={14} color={Colors.ink} />}
            iconPosition="right"
            onPress={() => goToDate(new Date(nextAfterSelected.startsAt))}
          />
        )}
      </View>
    );
  } else {
    dayContent = (
      <View>
        {dayAppointments.map((apt) => (
          <AppointmentRow
            key={apt.id}
            apt={apt}
            counterpart={counterpartOf(apt)}
            avatar={isArtist ? apt.clientAvatar : null}
          />
        ))}
        <Rule />
      </View>
    );
  }

  const ready = loadState === 'ready' && appointments.length > 0;

  const dayHead = (
    <View style={styles.dayHead}>
      <Kicker tone={isOnToday ? 'flame' : 'muted'}>{isOnToday ? 'Aujourd’hui' : 'Jour sélectionné'}</Kicker>
      <TText variant="displayS" accessibilityRole="header" style={styles.dayTitle}>
        {`${capitalize(formatLongDate(selectedDate))}.`}
      </TText>
    </View>
  );

  const facts = [
    { label: 'Séances cette semaine', value: weekStats.total },
    { label: 'Confirmées', value: weekStats.confirmed },
    { label: 'À confirmer', value: weekStats.proposed },
  ];

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top, paddingBottom: hasSidebar ? Spacing['3xl'] : insets.bottom + 110 }}
        showsVerticalScrollIndicator={false}
      >
        <PageWrap>
          <Masthead
            kicker={`Le calendrier / ${monthLabel}`}
            title="L’agenda."
            emphasis="Votre temps."
            description={isArtist
              ? 'Une vue de la semaine, l’état de chaque séance et un accès direct à vos horaires.'
              : 'Vos séances planifiées avec les artistes, semaine après semaine.'}
          />

          {/* ── Week toolbar ── */}
          <View style={styles.toolbar}>
            <View style={styles.weekNav}>
              <IconButton icon="chevron-back" label="Semaine précédente" onPress={() => shiftWeek(-1)} />
              <View style={styles.weekLabel}>
                <View accessibilityLiveRegion="polite">
                  <Kicker numberOfLines={2}>{weekRangeLabel(weekDates)}</Kicker>
                </View>
                {!isOnToday && (
                  <TextLink label="Aujourd’hui" icon="return-down-back" onPress={() => goToDate(new Date())} style={{ marginTop: 2 }} />
                )}
              </View>
              <IconButton icon="chevron-forward" label="Semaine suivante" onPress={() => shiftWeek(1)} />
            </View>
            <View style={styles.toolbarActions}>
              {ready && (
                <IconButton
                  icon="download-outline"
                  label={Platform.OS === 'web' ? 'Exporter les séances à venir (.ics)' : 'Partager les séances à venir (.ics)'}
                  onPress={() => { void exportUpcoming(); }}
                />
              )}
              <TButton
                title={isArtist ? 'Mes horaires' : 'Trouver un artiste'}
                variant="secondary"
                size="md"
                fullWidth={false}
                accessibilityLabel={newAppointmentLabel}
                icon={<Ionicons name={isArtist ? 'time-outline' : 'search'} size={15} color={Colors.ink} />}
                onPress={openNewAppointment}
              />
            </View>
          </View>

          {isWide ? (
            <>
              {/* ── Calendar grid ── */}
              <View style={styles.calendar}>
                {weekDates.map((date, i) => (
                  <CalendarCell
                    key={date.toISOString()}
                    date={date}
                    selected={selectedDay === i}
                    isToday={sameDay(date, today)}
                    items={loadState === 'ready' ? appointmentsOn(date) : []}
                    counterpartOf={counterpartOf}
                    onPress={() => setSelectedDay(i)}
                  />
                ))}
              </View>

              <View style={styles.wideRow}>
                <Panel style={{ flex: 1.6 }}>
                  {dayHead}
                  {dayContent}
                </Panel>
                <InkPanel style={{ flex: 1 }}>
                  <Kicker tone="flameOnInk">La semaine</Kicker>
                  <TText variant="displayS" color="onInk" style={styles.inkTitle}>Des créneaux sous contrôle.</TText>
                  <View style={{ marginTop: Spacing.lg }}>
                    {facts.map((f, i) => (
                      <DetailRow
                        key={f.label}
                        label={f.label}
                        value={loadState === 'ready' ? String(f.value) : '—'}
                        onInk
                        last={i === facts.length - 1}
                      />
                    ))}
                  </View>
                  {isArtist ? (
                    <TText variant="caption" color="onInkMuted" style={{ marginTop: Spacing.md }}>
                      Horaires habituels, jours bloqués et séances confirmées déterminent les créneaux que voient vos clients.
                    </TText>
                  ) : null}
                  <TButton
                    title={isArtist ? 'Gérer mes horaires' : 'Trouver un artiste'}
                    variant="glass"
                    size="md"
                    fullWidth={false}
                    accessibilityLabel={newAppointmentLabel}
                    onPress={openNewAppointment}
                    style={{ marginTop: Spacing.lg, alignSelf: 'flex-start' }}
                  />
                </InkPanel>
              </View>
            </>
          ) : (
            <>
              {/* ── Compact week ── */}
              <View style={styles.stripRow}>
                {weekDates.map((date, i) => (
                  <StripCell
                    key={date.toISOString()}
                    date={date}
                    selected={selectedDay === i}
                    isToday={sameDay(date, today)}
                    count={loadState === 'ready' ? appointmentsOn(date).length : 0}
                    onPress={() => setSelectedDay(i)}
                  />
                ))}
              </View>

              {ready && (
                <View style={styles.facts}>
                  {facts.map((f, i) => (
                    <View
                      key={f.label}
                      style={[styles.fact, i > 0 && styles.factDivider]}
                      accessible
                      accessibilityLabel={`${f.label} : ${f.value}`}
                    >
                      <TText variant="micro" uppercase color="secondary" numberOfLines={2} style={{ letterSpacing: 0.6 }}>{f.label}</TText>
                      <TText variant="displayS" tabular style={styles.factValue}>{f.value}</TText>
                    </View>
                  ))}
                </View>
              )}

              {dayHead}
              <Rule tone="ink" />
              {dayContent}
            </>
          )}
        </PageWrap>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },

  toolbar: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between',
    gap: Spacing.sm, marginBottom: Spacing.lg,
  },
  weekNav: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, flexShrink: 1, minWidth: 0 },
  weekLabel: { flexShrink: 1, minWidth: 0, alignItems: 'flex-start' },
  toolbarActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing['2xs'] },

  // Wide calendar
  calendar: { flexDirection: 'row', borderTopWidth: 1, borderLeftWidth: 1, borderColor: Colors.line },
  cell: {
    flex: 1, minWidth: 0, minHeight: 142, padding: 14,
    backgroundColor: Colors.white, borderRightWidth: 1, borderBottomWidth: 1, borderColor: Colors.line,
  },
  cellSelected: { borderBottomWidth: 2, borderBottomColor: Colors.ink },
  cellNum: { fontSize: 31, lineHeight: 34, marginTop: 4 },
  chip: { paddingHorizontal: 6, paddingVertical: 4 },
  chipInk: { backgroundColor: Colors.inkPanel },
  chipClay: { backgroundColor: Colors.clay },
  chipDone: { backgroundColor: Colors.wash },
  chipCanceled: { borderWidth: 1, borderColor: Colors.line },
  struck: { textDecorationLine: 'line-through' },

  wideRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 17, marginTop: Spacing.xl },
  inkTitle: { marginTop: Spacing.sm, fontSize: 32, lineHeight: 34, letterSpacing: -0.6 },

  // Phone strip
  stripRow: { flexDirection: 'row', borderTopWidth: 1, borderLeftWidth: 1, borderColor: Colors.line },
  strip: {
    flex: 1, minWidth: 0, minHeight: 72, alignItems: 'center', justifyContent: 'center', paddingVertical: 8,
    backgroundColor: Colors.white, borderRightWidth: 1, borderBottomWidth: 1, borderColor: Colors.line,
  },
  stripSelected: { backgroundColor: Colors.inkPanel, borderColor: Colors.inkPanel },
  stripNum: { fontSize: 24, lineHeight: 28, marginTop: 2 },
  stripMark: { width: 6, height: 6, marginTop: 4, backgroundColor: 'transparent' },

  facts: {
    flexDirection: 'row', marginTop: Spacing.md,
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: Colors.line,
  },
  fact: { flex: 1, minWidth: 0, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.xs, gap: 6 },
  factDivider: { borderLeftWidth: 1, borderLeftColor: Colors.line },
  factValue: { fontSize: 28, lineHeight: 30 },

  dayHead: { paddingTop: Spacing.lg, paddingBottom: Spacing.sm },
  dayTitle: { marginTop: 8, fontSize: 32, lineHeight: 34, letterSpacing: -0.6 },
  freeDay: { paddingVertical: Spacing.lg },
  freeTitle: { fontSize: 26, lineHeight: 28 },
  inlineEmpty: { flex: 0, paddingVertical: Spacing.xl, paddingHorizontal: 0 },

  aptRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 16, borderTopWidth: 1, borderTopColor: Colors.line,
  },
  aptTime: { width: 52, gap: 2 },
  aptBody: { flex: 1, minWidth: 0 },
  aptName: { fontSize: 24, lineHeight: 27, letterSpacing: -0.4 },
  aptMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginTop: 6 },
});
