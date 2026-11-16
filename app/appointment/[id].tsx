import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { format } from 'date-fns/format';
import { isValid } from 'date-fns/isValid';
import { parseISO } from 'date-fns/parseISO';
import { fr } from 'date-fns/locale/fr';
import { Colors, Spacing, Layout } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TButton } from '@/components/ui/TButton';
import { TInput } from '@/components/ui/TInput';
import { THeader } from '@/components/ui/THeader';
import { TAvatar } from '@/components/ui/TAvatar';
import { TSkeleton } from '@/components/ui/TSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Toast } from '@/components/ui/TToast';
import { DetailRow, InkPanel, Kicker, PageWrap, StatusDot, TextLink, type StatusTone } from '@/components/v5';
import { StatusTimeline, type TimelineStep } from '@/components/RequestCard';
import { BottomSheet, GlassSurface } from '@/components/motion';
import { SlotPicker } from '@/components/booking/SlotPicker';
import { exportCalendar, openInGoogleCalendar } from '@/components/booking/calendar-export';
import { cancellationNotice, noticeDeadline } from '@/components/booking/booking-copy';
import { useAuthStore } from '@/store/auth-store';
import { HealedPhotoCard } from '@/components/social/HealedPhotoCard';
import { supabase } from '@/lib/supabase';
import { completeAppointment, respondToAppointment } from '@/lib/appointments';
import { normalizePreferredSlots } from '@/lib/studio';
import { absoluteUrl } from '@/lib/site';
import { cancelAppointment, canClientCancel, fetchBookingSettings, type BookingSettings } from '@/lib/care';
import { useContentDimensions } from '@/hooks/useContentDimensions';
import type { CalendarEvent } from '@/lib/ics';

const BAR_MAX = 760;
const REASON_MAX = 300;
const SIDE_W = 360;

// ─── Status vocabulary: 6px dot + small capitals ──────────────────────────────
const STATUS_CONFIG: Record<'proposed' | 'confirmed' | 'completed' | 'canceled', { label: string; tone: StatusTone }> = {
  proposed:  { label: 'En attente de confirmation', tone: 'wait' },
  confirmed: { label: 'Confirmé', tone: 'open' },
  completed: { label: 'Terminé', tone: 'closed' },
  canceled:  { label: 'Annulé', tone: 'alert' },
};

type AppointmentStatus = keyof typeof STATUS_CONFIG;

function buildTimeline(status: AppointmentStatus): TimelineStep[] {
  const proposed: TimelineStep = { key: 'proposed', label: 'Créneau proposé', state: 'done' };
  const confirmed: TimelineStep = { key: 'confirmed', label: 'Rendez-vous confirmé', state: 'upcoming' };
  const session: TimelineStep = { key: 'session', label: 'Séance réalisée', state: 'upcoming' };
  switch (status) {
    case 'proposed':
      return [{ ...proposed, detail: 'En attente de confirmation', state: 'current' }, confirmed, session];
    case 'confirmed':
      return [proposed, { ...confirmed, state: 'current' }, session];
    case 'completed':
      return [proposed, { ...confirmed, state: 'done' }, { ...session, state: 'done' }];
    case 'canceled':
    default:
      return [proposed, { key: 'canceled', label: 'Rendez-vous annulé', state: 'ended' }];
  }
}

// ─── Pieces ───────────────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Kicker tone="flame" style={{ marginBottom: Spacing.md }}>{title}</Kicker>
      {children}
    </View>
  );
}

function AppointmentSkeleton() {
  return (
    <PageWrap style={{ gap: 12, paddingTop: Spacing.xl }}>
      <TSkeleton width="30%" height={11} />
      <TSkeleton width={140} height={110} />
      <TSkeleton width="55%" height={28} />
      <TSkeleton width="40%" height={14} />
      <TSkeleton height={200} style={{ marginTop: Spacing.lg }} />
    </PageWrap>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
interface AppointmentData {
  id: string;
  requestId: string | null;
  status: AppointmentStatus;
  startsAt: string;
  endsAt: string;
  bodyZone: string | null;
  notes: string | null;
  clientName: string;
  clientAvatarUrl: string | null;
  artistBlaze: string;
  artistCity: string;
  artistAvatarUrl: string | null;
  artistId: string | null;
  artistTier: 'normal' | 'premium';
}

type Sheet = 'cancel' | 'move' | null;
type Busy = 'confirm' | 'accept' | 'decline' | 'complete' | 'cancel' | 'move' | null;
interface CancelInfo { by: 'client' | 'artist' | null; reason: string | null }

export default function AppointmentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isWide, width, gutter } = useContentDimensions();
  const { user } = useAuthStore();

  const [appointment, setAppointment] = useState<AppointmentData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Busy>(null);

  // Booking rules of the artist (notice, lengths). Optional: the server decides anyway.
  const [settings, setSettings] = useState<BookingSettings | null>(null);
  const [cancelInfo, setCancelInfo] = useState<CancelInfo | null>(null);
  const [outcome, setOutcome] = useState<'canceled' | 'moved' | null>(null);

  // Sheets
  const [sheet, setSheet] = useState<Sheet>(null);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [moveSlots, setMoveSlots] = useState<string[]>([]);

  useEffect(() => {
    if (!id) return;
    let active = true;
    const load = async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          id, status, starts_at, ends_at, body_zone, notes,
          request_id,
          profiles!client_id(display_name, avatar_url),
          artists!artist_id(id, blaze, city, avatar_url, tier)
        `)
        .eq('id', id)
        .single();

      if (!active) return;
      if (error || !data) { setNotFound(true); setIsLoading(false); return; }

      const artistId: string | null = (data.artists as any)?.id ?? null;
      setAppointment({
        id: data.id,
        requestId: data.request_id ?? null,
        status: (data.status as AppointmentStatus) ?? 'proposed',
        startsAt: data.starts_at,
        endsAt: data.ends_at,
        bodyZone: data.body_zone ?? null,
        notes: data.notes ?? null,
        clientName: (data.profiles as any)?.display_name ?? 'Client',
        clientAvatarUrl: (data.profiles as any)?.avatar_url ?? null,
        artistBlaze: (data.artists as any)?.blaze ?? 'Artiste',
        artistCity: (data.artists as any)?.city ?? '',
        artistAvatarUrl: (data.artists as any)?.avatar_url ?? null,
        artistId,
        artistTier: (data.artists as any)?.tier ?? 'normal',
      });
      setIsLoading(false);

      if (artistId) {
        fetchBookingSettings(artistId)
          .then((s) => { if (active) setSettings(s); })
          .catch(() => { /* Without settings the server still enforces every rule. */ });
      }
      if (data.status === 'canceled') {
        const { data: info } = await supabase.from('appointments').select('canceled_by,cancel_reason').eq('id', id).maybeSingle();
        if (active && info) setCancelInfo({ by: info.canceled_by, reason: info.cancel_reason });
      }
    };
    void load();
    return () => { active = false; };
  }, [id]);

  const closeSheet = () => { if (!busy) { setSheet(null); setSheetError(null); } };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <THeader showBack title="Rendez-vous" />
        <AppointmentSkeleton />
      </View>
    );
  }

  if (notFound || !appointment) {
    return (
      <View style={styles.container}>
        <THeader showBack title="Rendez-vous" />
        <EmptyState
          icon="calendar-outline"
          title="Rendez-vous introuvable"
          description="Ce rendez-vous n’existe pas ou vous n’y avez pas accès."
        />
      </View>
    );
  }

  const status = STATUS_CONFIG[appointment.status] ?? STATUS_CONFIG.proposed;
  // The artist of this session, not any artist account (an artist can also be someone's client).
  const isArtist = appointment.artistId ? user?.artistId === appointment.artistId : user?.role === 'artist';
  const isOpen = appointment.status === 'proposed' || appointment.status === 'confirmed';
  const counterpart = isArtist ? appointment.clientName : appointment.artistBlaze;

  const start = parseISO(appointment.startsAt);
  const end = parseISO(appointment.endsAt);
  const validDates = isValid(start) && isValid(end);
  const upcoming = validDates && start.getTime() > Date.now();
  const started = validDates && start.getTime() <= Date.now();
  const dayTitle = validDates ? format(start, 'EEEE d MMMM', { locale: fr }) : appointment.startsAt;
  const timeRange = validDates ? `${format(start, 'HH:mm')} – ${format(end, 'HH:mm')}` : '';
  const sessionMin = validDates ? Math.round((end.getTime() - start.getTime()) / 60_000) : NaN;
  const hours = sessionMin / 60;
  const duration = Number.isFinite(hours) && hours > 0
    ? `${hours.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} h`
    : null;

  // Cancel / move: both parties on an upcoming open session; a client must respect the notice once confirmed.
  const canManage = isOpen && upcoming;
  const notice = settings?.cancelNoticeHours ?? null;
  const clientLocked = !isArtist && appointment.status === 'confirmed' && notice !== null
    && !canClientCancel(appointment.startsAt, notice);

  const openChat = () => router.push(`/conversation/${appointment.requestId ?? id}` as any);
  const openRequest = () => { if (appointment.requestId) router.push(`/request/${appointment.requestId}` as any); };
  const hasBar = isOpen || (appointment.status === 'completed' && !isArtist);

  const haptic = (type: Haptics.NotificationFeedbackType) => { if (Platform.OS !== 'web') Haptics.notificationAsync(type); };

  // ── Existing transitions ──
  const handleRespond = async (accept: boolean) => {
    if (busy) return;
    setBusy(accept ? 'accept' : 'decline'); setActionError(null);
    const { data, error } = await respondToAppointment(appointment.id, accept);
    setBusy(null);
    haptic(error ? Haptics.NotificationFeedbackType.Error : Haptics.NotificationFeedbackType.Success);
    if (error) { setActionError(error); return; }
    const next = (data?.status as AppointmentStatus | undefined) ?? (accept ? 'confirmed' : 'canceled');
    setAppointment((prev) => (prev ? { ...prev, status: next } : prev));
    Toast.success(accept ? 'Rendez-vous confirmé' : 'Créneau refusé');
  };

  const handleComplete = async () => {
    if (busy) return;
    setBusy('complete'); setActionError(null);
    const { error } = await completeAppointment(appointment.id);
    setBusy(null);
    haptic(error ? Haptics.NotificationFeedbackType.Error : Haptics.NotificationFeedbackType.Success);
    if (error) { setActionError(error); return; }
    setAppointment((prev) => (prev ? { ...prev, status: 'completed' } : prev));
    Toast.success('Séance enregistrée comme réalisée');
  };

  // ── Cancel / move ──
  const openCancel = () => { setReason(''); setSheetError(null); setSheet('cancel'); };
  const openMove = () => { setReason(''); setMoveSlots([]); setSheetError(null); setSheet('move'); };

  const submitCancel = async (slots: string[] = []) => {
    if (busy) return;
    const moving = slots.length > 0;
    setBusy(moving ? 'move' : 'cancel'); setSheetError(null);
    const error = await cancelAppointment(appointment.id, reason, normalizePreferredSlots(slots));
    setBusy(null);
    if (error) {
      haptic(Haptics.NotificationFeedbackType.Error);
      setSheetError(error);
      return;
    }
    haptic(Haptics.NotificationFeedbackType.Warning);
    setAppointment((prev) => (prev ? { ...prev, status: 'canceled' } : prev));
    setCancelInfo({ by: isArtist ? 'artist' : 'client', reason: reason.trim().slice(0, REASON_MAX) || null });
    setOutcome(moving ? 'moved' : 'canceled');
    setSheet(null);
    Toast.success(moving ? 'Demande de report envoyée' : 'Rendez-vous annulé');
  };

  // ── Calendar ──
  const calendarEvent: CalendarEvent = {
    id: appointment.id,
    start: appointment.startsAt,
    end: appointment.endsAt,
    title: `Séance tatouage — ${counterpart}`,
    description: [
      appointment.bodyZone ? `Zone : ${appointment.bodyZone}` : null,
      appointment.notes,
      appointment.status === 'proposed' ? 'Créneau en attente de confirmation.' : null,
      `Détails : ${absoluteUrl(`/appointment/${appointment.id}`)}`,
    ].filter(Boolean).join('\n'),
    location: appointment.artistCity || null,
    tentative: appointment.status === 'proposed',
  };
  const addToGoogle = async () => {
    if (!(await openInGoogleCalendar(calendarEvent))) Toast.error('Google Agenda n’a pas pu s’ouvrir.');
  };
  const downloadIcs = async () => {
    const ok = await exportCalendar([calendarEvent], 'inkr-seance.ics');
    if (ok && Platform.OS === 'web') Toast.success('Fichier .ics téléchargé');
  };

  const canceledByLabel = cancelInfo?.by
    ? (cancelInfo.by === 'artist' ? (isArtist ? 'Vous' : 'L’artiste') : (isArtist ? 'Le client' : 'Vous'))
    : null;

  // Serif numerals scale with the page; the ticket never overflows a 360px phone.
  const dayNumeralSize = isWide ? Math.min(180, Math.max(120, width * 0.11)) : 112;

  // ── The ticket: the date, on paper ──
  const dateCard = (
    <View style={[styles.dateCard, isWide && styles.dateCardWide]}>
      <StatusDot tone={status.tone} label={status.label} />
      {validDates ? (
        <View
          accessible
          accessibilityRole="header"
          accessibilityLabel={`${dayTitle} ${format(start, 'yyyy')}, ${timeRange}`}
          style={{ marginTop: Spacing.lg }}
        >
          <Kicker tone="muted">{format(start, 'EEEE', { locale: fr })}</Kicker>
          <TText
            variant="displayXL"
            tabular
            style={{ fontSize: dayNumeralSize, lineHeight: Math.round(dayNumeralSize * 0.92), letterSpacing: -dayNumeralSize * 0.04, color: Colors.flame, marginTop: 6 }}
          >
            {format(start, 'd')}
          </TText>
          <TText variant="displayM" italic style={styles.monthLine}>{format(start, 'MMMM yyyy', { locale: fr })}</TText>
          <TText variant="body" color="secondary" tabular style={{ marginTop: Spacing.sm }}>
            {timeRange}{duration ? ` · ${duration}` : ''}
          </TText>
        </View>
      ) : (
        <TText variant="displayS" accessibilityRole="header" style={{ marginTop: Spacing.lg }}>{dayTitle}</TText>
      )}
      {!!appointment.bodyZone && (
        <TText variant="displayS" italic color="accentGlow" style={styles.zone}>{appointment.bodyZone}</TText>
      )}
    </View>
  );

  // ── The cartel: who, and the facts, on ink ──
  const cartel = (
    <InkPanel style={isWide ? styles.cartelWide : undefined}>
      <Kicker tone="flameOnInk">{isArtist ? 'Séance · client' : 'Séance · artiste'}</Kicker>
      <View style={styles.person}>
        <TAvatar
          uri={isArtist ? appointment.clientAvatarUrl : appointment.artistAvatarUrl}
          name={counterpart}
          size="xl"
          isPremium={!isArtist && appointment.artistTier === 'premium'}
          showBadge={!isArtist && appointment.artistTier === 'premium'}
        />
        <View style={{ flex: 1, minWidth: 0 }}>
          <TText variant="displayS" numberOfLines={2} style={styles.personName}>{counterpart}</TText>
          {!isArtist && !!appointment.artistCity && <TText variant="caption" color="onInkMuted">{appointment.artistCity}</TText>}
        </View>
      </View>
      <View style={styles.personLinks}>
        <TextLink onInk label="Écrire" icon="chatbubble-outline" onPress={openChat} accessibilityLabel={`Écrire à ${counterpart}`} />
        {!isArtist && !!appointment.artistId && (
          <TextLink
            onInk
            label="Voir le profil"
            onPress={() => router.push(`/artist/${appointment.artistId}` as any)}
            accessibilityLabel={`Voir le profil de ${appointment.artistBlaze}`}
          />
        )}
      </View>

      <View style={{ marginTop: Spacing.lg }}>
        <DetailRow onInk label="Zone" value={appointment.bodyZone ?? '—'} />
        {validDates && <DetailRow onInk label="Horaire" value={timeRange} />}
        {!!duration && <DetailRow onInk label="Durée estimée" value={duration} />}
        {appointment.status === 'canceled' && !!canceledByLabel && <DetailRow onInk label="Annulé par" value={canceledByLabel} />}
        {appointment.status === 'canceled' && !!cancelInfo?.reason && <DetailRow onInk label="Motif" value={cancelInfo.reason} />}
        <View style={{ borderTopWidth: 1, borderTopColor: Colors.onInkLine }} />
      </View>
      {appointment.status === 'canceled' && !outcome && !!appointment.requestId && (
        <TextLink onInk label="Voir le projet" icon="folder-open-outline" onPress={openRequest} style={{ marginTop: Spacing.sm }} />
      )}
    </InkPanel>
  );

  const calendarSection = canManage && validDates ? (
    <Section title="Ajouter à mon agenda">
      <View style={styles.calendarRow}>
        <TButton
          title="Google Agenda"
          variant="secondary"
          size="md"
          fullWidth={false}
          onPress={addToGoogle}
          icon={<Ionicons name="logo-google" size={14} color={Colors.ink} />}
        />
        <TButton
          title="Fichier .ics"
          variant="secondary"
          size="md"
          fullWidth={false}
          onPress={downloadIcs}
          accessibilityLabel={Platform.OS === 'web' ? 'Télécharger le fichier .ics' : 'Partager le fichier .ics'}
          icon={<Ionicons name="download-outline" size={15} color={Colors.ink} />}
        />
      </View>
      <TText variant="caption" color="tertiary" style={{ marginTop: Spacing.xs }}>
        {appointment.status === 'proposed'
          ? 'Ajouté comme provisoire tant que le créneau n’est pas confirmé.'
          : 'Apple Calendrier, Outlook et la plupart des agendas ouvrent le fichier .ics.'}
      </TText>
    </Section>
  ) : null;

  const manageSection = canManage ? (
    <Section title="Modifier le rendez-vous">
      {!isArtist && notice !== null && (
        <TText variant="bodySmall" color={clientLocked ? 'warning' : 'secondary'} style={{ marginBottom: Spacing.sm }}>
          {clientLocked
            ? `Le délai d’annulation (${noticeDeadline(notice)}) est dépassé : écrivez à ${appointment.artistBlaze} pour trouver une solution.`
            : appointment.status === 'confirmed'
              ? cancellationNotice(notice)
              : 'Vous pouvez annuler ou demander un autre créneau tant que celui-ci n’est pas confirmé.'}
        </TText>
      )}
      <View style={styles.manageRow}>
        {!isArtist && (
          <TButton
            title="Demander un autre créneau"
            variant="secondary"
            size="md"
            fullWidth={false}
            onPress={openMove}
            disabled={clientLocked}
            icon={<Ionicons name="swap-horizontal-outline" size={15} color={Colors.ink} />}
          />
        )}
        <TButton
          title="Annuler le rendez-vous"
          variant="destructive"
          size="md"
          fullWidth={false}
          onPress={openCancel}
          disabled={clientLocked}
          icon={<Ionicons name="close-outline" size={16} color={Colors.error} />}
        />
      </View>
    </Section>
  ) : null;

  const outcomeNote = outcome ? (
    <View style={styles.outcome} accessibilityLiveRegion="polite">
      <Kicker tone="flame">{outcome === 'moved' ? 'Report demandé' : 'Annulation'}</Kicker>
      <TText variant="displayS" style={styles.outcomeTitle}>
        {outcome === 'moved' ? 'Demande de report envoyée' : 'Rendez-vous annulé'}
      </TText>
      <TText variant="bodySmall" color="secondary" style={{ maxWidth: Layout.maxReading }}>
        {outcome === 'moved'
          ? `${appointment.artistBlaze} est prévenu et vous proposera un nouveau créneau parmi vos choix. La suite se passe dans votre projet.`
          : isArtist
            ? `${appointment.clientName} est prévenu. Vous pourrez proposer un autre créneau depuis le projet.`
            : `${appointment.artistBlaze} est prévenu. Le projet reste ouvert si vous souhaitez convenir d’une autre date.`}
      </TText>
      {!!appointment.requestId && (
        <TButton title="Voir le projet" variant="secondary" size="md" fullWidth={false} onPress={openRequest} style={{ alignSelf: 'flex-start', marginTop: Spacing.sm }} />
      )}
    </View>
  ) : null;

  const timelineSection = (
    <Section title="Suivi">
      <StatusTimeline steps={buildTimeline(appointment.status)} />
    </Section>
  );

  const notesSection = appointment.notes ? (
    <Section title="Notes">
      <TText variant="body" color="secondary" style={{ maxWidth: Layout.maxReading }}>{appointment.notes}</TText>
    </Section>
  ) : null;

  const healed = (
    <View style={styles.healed}>
      <HealedPhotoCard
        appointmentId={appointment.id}
        role={isArtist ? 'artist' : 'client'}
        completed={appointment.status === 'completed'}
      />
    </View>
  );

  return (
    <View style={styles.container}>
      <THeader showBack title="Rendez-vous" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + (hasBar ? 140 : Spacing['2xl']) }}
        keyboardShouldPersistTaps="handled"
      >
        <PageWrap style={{ paddingTop: isWide ? Spacing['2xl'] : Spacing.lg }}>
          {/* ── The ticket ── */}
          <View style={[styles.ticket, isWide && styles.ticketWide]}>
            {dateCard}
            {cartel}
          </View>

          {outcomeNote}

          {isWide ? (
            <View style={styles.columns}>
              <View style={{ flex: 1, minWidth: 0 }}>
                {timelineSection}
                {notesSection}
                {healed}
              </View>
              <View style={{ width: SIDE_W }}>
                {calendarSection}
                {manageSection}
              </View>
            </View>
          ) : (
            <>
              {timelineSection}
              {notesSection}
              {healed}
              {calendarSection}
              {manageSection}
            </>
          )}
        </PageWrap>
      </ScrollView>

      {/* ── Pinned actions ── */}
      {hasBar && !sheet && (
        <GlassSurface style={[styles.bar, { paddingBottom: insets.bottom + 12, paddingHorizontal: gutter }]}>
          <View style={styles.barInner}>
            {!!actionError && (
              <View style={styles.errorRow} accessibilityRole="alert" accessibilityLiveRegion="assertive">
                <Ionicons name="alert-circle-outline" size={16} color={Colors.error} />
                <TText variant="caption" style={{ color: Colors.error, flex: 1 }}>{actionError}</TText>
              </View>
            )}
            {isOpen ? (
              isArtist && appointment.status === 'proposed' ? (
                <View style={styles.barRow}>
                  <TButton title="Message" variant="secondary" onPress={openChat} fullWidth={false} accessibilityLabel={`Écrire à ${counterpart}`} />
                  <TText variant="caption" color="secondary" style={{ flex: 1 }}>
                    En attente de l’acceptation du client.
                  </TText>
                </View>
              ) : !isArtist && appointment.status === 'proposed' && upcoming ? (
                <View style={styles.barRow}>
                  <TButton title="Refuser" variant="secondary" onPress={() => { void handleRespond(false); }} loading={busy === 'decline'} disabled={!!busy} fullWidth={false} />
                  <View style={{ flex: 1 }}>
                    <TButton title="Accepter ce créneau" onPress={() => { void handleRespond(true); }} loading={busy === 'accept'} disabled={!!busy} />
                  </View>
                </View>
              ) : isArtist && appointment.status === 'confirmed' && started ? (
                <View style={styles.barRow}>
                  <TButton title="Message" variant="secondary" onPress={openChat} fullWidth={false} accessibilityLabel={`Écrire à ${counterpart}`} />
                  <View style={{ flex: 1 }}>
                    <TButton title="Séance réalisée" onPress={handleComplete} loading={busy === 'complete'} disabled={!!busy} accessibilityLabel="Marquer la séance comme réalisée" />
                  </View>
                </View>
              ) : (
                <TButton
                  title={`Écrire à ${counterpart}`}
                  onPress={openChat}
                  icon={<Ionicons name="chatbubble-outline" size={16} color={Colors.paper} />}
                />
              )
            ) : (
              <TButton
                title="Laisser un avis"
                onPress={() => router.push(`/review/new?appointmentId=${id}&artistId=${appointment.artistId ?? ''}` as any)}
                icon={<Ionicons name="star-outline" size={16} color={Colors.paper} />}
              />
            )}
          </View>
        </GlassSurface>
      )}

      {/* ── Cancel (web-safe confirmation: Alert.alert is a no-op on web) ── */}
      <BottomSheet visible={sheet === 'cancel'} onClose={closeSheet} accessibilityLabel="Annuler le rendez-vous">
        <Kicker tone="flame">Annulation</Kicker>
        <TText variant="displayS" style={{ marginTop: 8 }}>Annuler ce rendez-vous{' '}?</TText>
        <TText variant="bodySmall" color="secondary" style={{ marginTop: 4, marginBottom: Spacing.md }}>
          {validDates ? `${dayTitle}, ${timeRange}. ` : ''}{counterpart} sera prévenu. Cette action est irréversible.
        </TText>
        <TInput
          label="Motif"
          optional
          value={reason}
          onChangeText={setReason}
          placeholder={isArtist ? 'Un empêchement, un imprévu…' : 'Un imprévu, un changement de projet…'}
          maxLength={REASON_MAX}
          multiline
          containerStyle={{ marginBottom: 0 }}
        />
        {!!sheetError && (
          <TText variant="caption" style={{ color: Colors.error, marginTop: Spacing.xs }} accessibilityRole="alert">{sheetError}</TText>
        )}
        <View style={styles.sheetActions}>
          <TButton title="Annuler le rendez-vous" variant="destructive" onPress={() => { void submitCancel(); }} loading={busy === 'cancel'} disabled={!!busy} />
          <TButton title="Garder le rendez-vous" variant="ghost" size="md" onPress={closeSheet} />
        </View>
      </BottomSheet>

      {/* ── Move (client) ── */}
      <BottomSheet visible={sheet === 'move'} onClose={closeSheet} accessibilityLabel="Demander un autre créneau">
        <ScrollView style={{ maxHeight: 600 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Kicker tone="flame">Report</Kicker>
          <TText variant="displayS" style={{ marginTop: 8 }}>
            Un autre <TText variant="displayS" italic color="accentGlow">créneau.</TText>
          </TText>
          <TText variant="bodySmall" color="secondary" style={{ marginTop: 4, marginBottom: Spacing.md }}>
            Choisissez jusqu’à trois créneaux libres. Ce rendez-vous sera annulé et {appointment.artistBlaze} vous en proposera un nouveau.
          </TText>
          {appointment.artistId ? (
            <SlotPicker
              artistId={appointment.artistId}
              durationMin={Number.isFinite(sessionMin) && sessionMin > 0 ? sessionMin : undefined}
              durations={settings?.sessionDurations}
              value={moveSlots}
              onChange={setMoveSlots}
              max={3}
              emptyText={`${appointment.artistBlaze} n’a pas de créneau libre publié pour le moment. Écrivez-lui pour convenir d’une autre date.`}
            />
          ) : null}
          <TInput
            label="Message à l’artiste"
            optional
            value={reason}
            onChangeText={setReason}
            placeholder="Pourquoi déplacer la séance…"
            maxLength={REASON_MAX}
            multiline
            containerStyle={{ marginTop: Spacing.md, marginBottom: 0 }}
          />
          {!!sheetError && (
            <TText variant="caption" style={{ color: Colors.error, marginTop: Spacing.xs }} accessibilityRole="alert">{sheetError}</TText>
          )}
          <View style={styles.sheetActions}>
            <TButton
              title={moveSlots.length > 0 ? 'Envoyer la demande de report' : 'Choisissez au moins un créneau'}
              onPress={() => { void submitCancel(moveSlots); }}
              loading={busy === 'move'}
              disabled={!!busy || moveSlots.length === 0}
            />
            <TButton title="Garder ce rendez-vous" variant="ghost" size="md" onPress={closeSheet} />
          </View>
        </ScrollView>
      </BottomSheet>

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },

  ticket: { marginBottom: Spacing.xl },
  ticketWide: { flexDirection: 'row', alignItems: 'stretch' },
  dateCard: {
    padding: Spacing.lg,
    backgroundColor: Colors.white,
    borderWidth: 1, borderColor: Colors.line,
  },
  dateCardWide: { flex: 1, padding: Spacing['2xl'], borderRightWidth: 0 },
  monthLine: { marginTop: 2, textTransform: 'capitalize' },
  zone: { marginTop: Spacing.md, fontSize: 26, lineHeight: 28 },
  cartelWide: { width: 420 },

  person: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.md },
  personName: { color: Colors.onInk, fontSize: 32, lineHeight: 32, letterSpacing: -0.6 },
  personLinks: { flexDirection: 'row', flexWrap: 'wrap', columnGap: Spacing.lg, rowGap: Spacing['3xs'], marginTop: Spacing.sm },

  outcome: {
    padding: Spacing.lg, marginBottom: Spacing.xl, gap: 6,
    backgroundColor: Colors.white,
    borderWidth: 1, borderColor: Colors.line, borderTopWidth: 2, borderTopColor: Colors.flame,
  },
  outcomeTitle: { fontSize: 26, lineHeight: 28 },

  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing['2xl'] },
  section: {
    paddingTop: Spacing.lg, paddingBottom: Spacing.xl,
    borderTopWidth: 1, borderTopColor: Colors.line,
  },
  healed: { paddingBottom: Spacing.xl },

  calendarRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing['2xs'] },
  manageRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing['2xs'] },

  bar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingTop: 12,
    borderTopWidth: 1, borderTopColor: Colors.line,
  },
  barInner: { width: '100%', maxWidth: BAR_MAX, alignSelf: 'center', gap: Spacing['2xs'] },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing['2xs'] },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sheetActions: { marginTop: Spacing.md, gap: Spacing['2xs'] },
});
