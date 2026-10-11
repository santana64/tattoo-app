import React, { useState, useEffect, useMemo } from 'react';
import {
  ScrollView, StyleSheet, View, Pressable, Alert, Platform, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Radius, Layout } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TAvatar } from '@/components/ui/TAvatar';
import { TButton } from '@/components/ui/TButton';
import { TDivider } from '@/components/ui/TDivider';
import { TSkeleton } from '@/components/ui/TSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { PressableScale } from '@/components/motion';
import { useAuthStore } from '@/store/auth-store';
import { supabase } from '@/lib/supabase';

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

const STATUS_CONFIG = {
  proposed:  { label: 'Proposé',  color: Colors.warning },
  confirmed: { label: 'Confirmé', color: Colors.success },
  completed: { label: 'Terminé',  color: Colors.textTertiary },
  canceled:  { label: 'Annulé',   color: Colors.error },
} as const;


// ─── Pieces ───────────────────────────────────────────────────────────────────
function RoundButton({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <PressableScale
      onPress={onPress}
      pressedScale={0.92}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={styles.roundBtn}
    >
      <Ionicons name={icon} size={19} color={Colors.textPrimary} />
    </PressableScale>
  );
}

function DayCell({ date, selected, isToday, count, onPress }: {
  date: Date; selected: boolean; isToday: boolean; count: number; onPress: () => void;
}) {
  const a11y = `${capitalize(formatLongDate(date))}${isToday ? ', aujourd’hui' : ''}, ${count ? `${count} rendez-vous` : 'aucun rendez-vous'}`;
  return (
    <PressableScale
      onPress={onPress}
      pressedScale={0.94}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ selected }}
      style={[styles.dayCell, selected && styles.dayCellSelected]}
    >
      <TText variant="micro" uppercase style={{ color: selected ? Colors.textInverse : Colors.textTertiary }}>
        {DAYS[weekdayIndex(date)]}
      </TText>
      <TText
        variant="body"
        weight="semibold"
        tabular
        style={{ color: selected ? Colors.textInverse : isToday ? Colors.accentGlow : Colors.textPrimary, marginTop: 2 }}
      >
        {date.getDate()}
      </TText>
      <View style={[styles.dayDot, count > 0 && { backgroundColor: selected ? Colors.textInverse : Colors.accentWarm }]} />
    </PressableScale>
  );
}

function Fact({ label, value, dot }: { label: string; value: number; dot?: string }) {
  return (
    <View style={styles.fact} accessible accessibilityLabel={`${label} : ${value}`}>
      <TText variant="label" color="tertiary" uppercase numberOfLines={1}>{label}</TText>
      <View style={styles.factValue}>
        {dot && <View style={[styles.dot, { backgroundColor: dot }]} />}
        <TText variant="title2" serif tabular style={{ fontSize: 24, lineHeight: 28 }}>{value}</TText>
      </View>
    </View>
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
    <PressableScale
      onPress={() => router.push(`/appointment/${apt.id}`)}
      pressedScale={0.985}
      accessibilityRole="button"
      accessibilityLabel={`${formatTime(start)} à ${formatTime(end)}, ${counterpart}, ${meta}`}
      style={[styles.aptRow, apt.status === 'canceled' && { opacity: 0.6 }]}
    >
        <View style={styles.aptTime}>
          <TText variant="body" weight="semibold" tabular>{formatTime(start)}</TText>
          <TText variant="caption" color="tertiary" tabular>{formatTime(end)}</TText>
        </View>
        <View style={[styles.aptRule, { backgroundColor: status.color }]} />
        <View style={styles.aptBody}>
          <TText variant="body" weight="medium" numberOfLines={1}>{counterpart}</TText>
          <View style={styles.aptMeta}>
            <View style={[styles.dot, { backgroundColor: status.color }]} />
            <TText variant="caption" color="secondary" numberOfLines={1} style={{ flexShrink: 1 }}>{meta}</TText>
          </View>
          {!!apt.notes && (
            <TText variant="caption" color="tertiary" numberOfLines={1} style={{ marginTop: 2 }}>{apt.notes}</TText>
          )}
        </View>
        <TAvatar uri={avatar} name={counterpart} size="md" />
    </PressableScale>
  );
}

function ListSkeleton() {
  return (
    <View style={{ gap: Spacing.md, paddingTop: Spacing.sm }}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 52, gap: 6 }}>
            <TSkeleton width={46} height={16} />
            <TSkeleton width={36} height={11} />
          </View>
          <View style={{ flex: 1, gap: 8 }}>
            <TSkeleton width="55%" height={15} />
            <TSkeleton width="40%" height={11} />
          </View>
          <TSkeleton width={40} height={40} radius={20} />
        </View>
      ))}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function AgendaScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const wide = width >= 960;
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

  const countFor = (date: Date) => appointments.filter((a) => sameDay(new Date(a.startsAt), date)).length;
  const dayAppointments = appointments.filter((a) => sameDay(new Date(a.startsAt), selectedDate));

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

  const monthLabel = capitalize(`${MONTHS_FR[weekDates[3].getMonth()]} ${weekDates[3].getFullYear()}`);

  const openNewAppointment = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Nouveau rendez-vous',
      'Fonctionnalité disponible depuis la réception d\'une demande acceptée.',
      [
        { text: 'Voir les demandes', onPress: () => router.push('/(tabs)/inbox') },
        { text: 'Fermer', style: 'cancel' },
      ]
    );
  };

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
          ? 'Les séances apparaissent ici dès qu’une demande acceptée est planifiée.'
          : 'Vos séances planifiées avec un artiste apparaîtront ici.'}
        ctaLabel={isArtist ? 'Voir les demandes' : 'Trouver un artiste'}
        onCta={() => router.push(isArtist ? '/(tabs)/inbox' : '/(tabs)/explore')}
        style={styles.inlineEmpty}
      />
    );
  } else if (dayAppointments.length === 0) {
    dayContent = (
      <View style={styles.freeDay}>
        <TText variant="title2" serif style={{ fontSize: 22 }}>Journée libre</TText>
        <TText variant="bodySmall" color="secondary" style={{ marginTop: 4 }}>
          Aucun rendez-vous prévu le {formatLongDate(selectedDate)}.
        </TText>
        {nextAfterSelected && (
          <TButton
            title={`Prochain : ${formatLongDate(new Date(nextAfterSelected.startsAt))} à ${formatTime(new Date(nextAfterSelected.startsAt))}`}
            variant="secondary"
            size="sm"
            fullWidth={false}
            style={{ marginTop: Spacing.md, alignSelf: 'flex-start' }}
            icon={<Ionicons name="arrow-forward" size={14} color={Colors.textPrimary} />}
            iconPosition="right"
            onPress={() => goToDate(new Date(nextAfterSelected.startsAt))}
          />
        )}
      </View>
    );
  } else {
    dayContent = (
      <View>
        {dayAppointments.map((apt, i) => (
          <React.Fragment key={apt.id}>
            {i > 0 && <TDivider inset={66} />}
            <AppointmentRow
              apt={apt}
              counterpart={isArtist ? apt.clientName : apt.artistBlaze}
              avatar={isArtist ? apt.clientAvatar : null}
            />
          </React.Fragment>
        ))}
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={[styles.frame, wide && styles.frameWide]}>
        {/* ── Week pane ── */}
        <View style={[styles.weekPane, wide && styles.weekPaneWide]}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <TText variant="displayM" accessibilityRole="header">Agenda</TText>
              <TText variant="bodySmall" color="tertiary" tabular style={{ marginTop: 2 }}>
                {weekRangeLabel(weekDates)}
              </TText>
            </View>
            <RoundButton icon="add" label="Nouveau rendez-vous" onPress={openNewAppointment} />
          </View>

          <View style={styles.monthNav}>
            <RoundButton icon="chevron-back" label="Semaine précédente" onPress={() => shiftWeek(-1)} />
            <View style={styles.monthCenter}>
              <TText variant="bodySmall" weight="semibold" accessibilityLiveRegion="polite">{monthLabel}</TText>
              {!isOnToday && (
                <Pressable onPress={() => goToDate(new Date())} accessibilityRole="button" hitSlop={8}>
                  <TText variant="caption" color="accentWarm" style={styles.todayLink}>Aujourd’hui</TText>
                </Pressable>
              )}
            </View>
            <RoundButton icon="chevron-forward" label="Semaine suivante" onPress={() => shiftWeek(1)} />
          </View>

          <View style={styles.dayStrip}>
            {weekDates.map((date, i) => (
              <DayCell
                key={date.toISOString()}
                date={date}
                selected={selectedDay === i}
                isToday={sameDay(date, today)}
                count={countFor(date)}
                onPress={() => setSelectedDay(i)}
              />
            ))}
          </View>

          {loadState === 'ready' && appointments.length > 0 && (
            <View style={styles.facts}>
              <Fact label="Cette semaine" value={weekStats.total} />
              <TDivider vertical tone="default" style={styles.factDivider} />
              <Fact label="Confirmés" value={weekStats.confirmed} dot={Colors.success} />
              <TDivider vertical tone="default" style={styles.factDivider} />
              <Fact label="À confirmer" value={weekStats.proposed} dot={Colors.warning} />
            </View>
          )}
        </View>

        {/* ── Day pane ── */}
        <ScrollView
          style={styles.dayPane}
          contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.dayHead}>
            <TText variant="label" color={isOnToday ? 'accentWarm' : 'tertiary'} uppercase>
              {isOnToday ? 'Aujourd’hui' : DAYS_LONG[selectedDay]}
            </TText>
            <TText variant="displayS" style={{ marginTop: 4 }}>
              {capitalize(formatLongDate(selectedDate))}
            </TText>
          </View>
          {dayContent}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  frame: { flex: 1, width: '100%', maxWidth: Layout.maxContent, alignSelf: 'center', paddingHorizontal: Layout.gutter },
  frameWide: { flexDirection: 'row', gap: Spacing['2xl'] },
  weekPane: {},
  weekPaneWide: { width: 400, paddingTop: Spacing.xs },
  dayPane: { flex: 1 },

  header: { flexDirection: 'row', alignItems: 'flex-start', paddingTop: Spacing.sm, paddingBottom: Spacing.md },
  roundBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderDefault,
  },

  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  monthCenter: { alignItems: 'center', gap: 2 },
  todayLink: { textDecorationLine: 'underline' },

  dayStrip: { flexDirection: 'row', gap: 4, marginBottom: Spacing.md },
  dayCell: {
    flex: 1, alignItems: 'center', paddingVertical: 8, minHeight: 64,
    borderRadius: Radius.md,
  },
  dayCellSelected: { backgroundColor: Colors.accentAction },
  dayDot: { width: 4, height: 4, borderRadius: 2, marginTop: 5, backgroundColor: 'transparent' },

  facts: {
    flexDirection: 'row', alignItems: 'stretch',
    paddingVertical: Spacing.sm, marginBottom: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderDefault,
  },
  fact: { flex: 1, gap: 6, minWidth: 0 },
  factValue: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  factDivider: { marginHorizontal: Spacing.sm },
  dot: { width: 6, height: 6, borderRadius: 3 },

  dayHead: { paddingTop: Spacing.md, paddingBottom: Spacing.sm },
  freeDay: {
    paddingVertical: Spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.borderDefault,
  },
  inlineEmpty: { flex: 0, paddingVertical: Spacing.xl, paddingHorizontal: 0 },

  aptRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14,
  },
  aptTime: { width: 52, gap: 1 },
  aptRule: { width: 2, alignSelf: 'stretch', borderRadius: 1, opacity: 0.8 },
  aptBody: { flex: 1, minWidth: 0 },
  aptMeta: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 3 },
});
