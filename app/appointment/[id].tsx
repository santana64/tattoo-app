import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { format } from 'date-fns/format';
import { isValid } from 'date-fns/isValid';
import { parseISO } from 'date-fns/parseISO';
import { fr } from 'date-fns/locale/fr';
import { Colors, Spacing, Radius, Layout } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TButton } from '@/components/ui/TButton';
import { TInput } from '@/components/ui/TInput';
import { THeader } from '@/components/ui/THeader';
import { TAvatar } from '@/components/ui/TAvatar';
import { TSkeleton } from '@/components/ui/TSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Toast } from '@/components/ui/TToast';
import { StatusTimeline, type TimelineStep } from '@/components/RequestCard';
import { BottomSheet, GlassSurface, PressableScale, enterUp } from '@/components/motion';
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
import type { CalendarEvent } from '@/lib/ics';

const DOSSIER_MAX = 720;
const REASON_MAX = 300;

// ─── Status vocabulary: 6px dot + label ───────────────────────────────────────
const STATUS_CONFIG = {
  proposed:  { label: 'En attente de confirmation', color: Colors.warning },
  confirmed: { label: 'Confirmé', color: Colors.success },
  completed: { label: 'Terminé', color: Colors.textSecondary },
  canceled:  { label: 'Annulé', color: Colors.error },
};

type AppointmentStatus = keyof typeof STATUS_CONFIG;

function buildTimeline(status: AppointmentStatus): TimelineStep[] {
  const proposed: TimelineStep = { key: 'proposed', label: 'Créneau proposé', state: 'done' };
  const confirmed: TimelineStep = { key: 'confirmed', label: 'Rendez-vous confirmé', state: 'upcoming' };
  const session: TimelineStep = { key: 'session', label: 'Séance réalisée', state: 'upcoming' };
  switch (status) {
    case 'proposed':
      return [{ ...proposed, detail: 'En attente de confirmation', state: 'current', color: Colors.warning }, confirmed, session];
    case 'confirmed':
      return [proposed, { ...confirmed, state: 'current', color: Colors.success }, session];
    case 'completed':
      return [proposed, { ...confirmed, state: 'done' }, { ...session, state: 'done' }];
    case 'canceled':
    default:
      return [proposed, { key: 'canceled', label: 'Rendez-vous annulé', state: 'ended', color: Colors.error }];
  }
}

// ─── Pieces ───────────────────────────────────────────────────────────────────
function Section({ title, index, children }: { title: string; index: number; children: React.ReactNode }) {
  return (
    <Animated.View entering={enterUp(index, 80)} style={styles.section}>
      <TText variant="label" color="accentWarm" uppercase style={{ marginBottom: Spacing.sm }}>{title}</TText>
      {children}
    </Animated.View>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <TText variant="bodySmall" color="tertiary" style={{ width: 112 }}>{label}</TText>
      <TText variant="bodySmall" weight="medium" tabular style={{ flex: 1 }}>{value}</TText>
    </View>
  );
}

function AppointmentSkeleton() {
  return (
    <View style={[styles.body, { gap: 12, paddingTop: Spacing.lg }]}>
      <TSkeleton width="30%" height={11} />
      <TSkeleton width="70%" height={36} />
      <TSkeleton width="45%" height={14} />
      <TSkeleton height={120} radius={Radius.md} style={{ marginTop: Spacing.lg }} />
      <TSkeleton height={72} radius={Radius.md} style={{ marginTop: Spacing.sm }} />
    </View>
  );
}

function ActionLink({ icon, label, onPress, disabled, tone = 'default' }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; disabled?: boolean; tone?: 'default' | 'danger';
}) {
  const color = tone === 'danger' ? Colors.errorLight : Colors.textPrimary;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      hitSlop={8}
      style={({ pressed }) => [styles.actionLink, pressed && { opacity: 0.6 }, disabled && { opacity: 0.4 }]}
    >
      <Ionicons name={icon} size={16} color={color} />
      <TText variant="bodySmall" weight="medium" style={{ color }}>{label}</TText>
    </Pressable>
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
  const year = validDates ? format(start, 'yyyy') : '';
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
  const handleConfirm = async () => {
    if (busy) return;
    setBusy('confirm'); setActionError(null);
    const { error } = await supabase.from('appointments').update({ status: 'confirmed' }).eq('id', appointment.id);
    setBusy(null);
    haptic(error ? Haptics.NotificationFeedbackType.Error : Haptics.NotificationFeedbackType.Success);
    if (!error) setAppointment((prev) => (prev ? { ...prev, status: 'confirmed' } : prev));
    else setActionError('La confirmation n’a pas été enregistrée. Réessayez.');
  };

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

  return (
    <View style={styles.container}>
      <THeader showBack title="Rendez-vous" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + (hasBar ? 140 : Spacing['2xl']) }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Date, the hero of this dossier ── */}
        <Animated.View entering={enterUp(0)} style={styles.hero}>
          <View style={styles.statusLine}>
            <View style={[styles.statusDot, { backgroundColor: status.color }]} />
            <TText variant="caption" weight="medium">{status.label}</TText>
          </View>
          <TText variant="displayM" accessibilityRole="header" style={{ textTransform: 'capitalize' }}>{dayTitle}</TText>
          {validDates && (
            <TText variant="body" color="secondary" tabular>
              {timeRange}{duration ? ` · ${duration}` : ''}<TText variant="body" color="tertiary">{` · ${year}`}</TText>
            </TText>
          )}
          {!!appointment.bodyZone && (
            <TText variant="bodySmall" color="accentGlow" serif italic style={{ fontSize: 20, lineHeight: 26 }}>{appointment.bodyZone}</TText>
          )}
        </Animated.View>

        {/* ── What just happened, and where to go next ── */}
        {outcome && (
          <Animated.View entering={enterUp(0)} style={styles.outcome} accessibilityLiveRegion="polite">
            <Ionicons name={outcome === 'moved' ? 'swap-horizontal-outline' : 'close-circle-outline'} size={20} color={Colors.accentWarm} />
            <View style={{ flex: 1, gap: 4 }}>
              <TText variant="body" weight="semibold">{outcome === 'moved' ? 'Demande de report envoyée' : 'Rendez-vous annulé'}</TText>
              <TText variant="bodySmall" color="secondary">
                {outcome === 'moved'
                  ? `${appointment.artistBlaze} est prévenu et vous proposera un nouveau créneau parmi vos choix. La suite se passe dans votre projet.`
                  : isArtist
                    ? `${appointment.clientName} est prévenu. Vous pourrez proposer un autre créneau depuis le projet.`
                    : `${appointment.artistBlaze} est prévenu. Le projet reste ouvert si vous souhaitez convenir d’une autre date.`}
              </TText>
              {!!appointment.requestId && (
                <TButton title="Voir le projet" variant="secondary" size="sm" fullWidth={false} onPress={openRequest} style={{ alignSelf: 'flex-start', marginTop: 4 }} />
              )}
            </View>
          </Animated.View>
        )}

        <Section title="Suivi" index={1}>
          <StatusTimeline steps={buildTimeline(appointment.status)} />
        </Section>

        <Section title={isArtist ? 'Client' : 'Artiste'} index={2}>
          <View style={styles.personLine}>
            {!isArtist && appointment.artistId ? (
              <PressableScale
                onPress={() => router.push(`/artist/${appointment.artistId}` as any)}
                accessibilityRole="link"
                accessibilityLabel={`Voir le profil de ${appointment.artistBlaze}`}
                pressedScale={0.98}
                style={styles.personRow}
              >
                <TAvatar uri={appointment.artistAvatarUrl} name={appointment.artistBlaze} size="lg" isPremium={appointment.artistTier === 'premium'} />
                <View style={{ flex: 1 }}>
                  <TText variant="title2" serif style={{ fontSize: 22, lineHeight: 26 }}>{appointment.artistBlaze}</TText>
                  {!!appointment.artistCity && <TText variant="caption" color="tertiary">{appointment.artistCity}</TText>}
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
              </PressableScale>
            ) : (
              <View style={styles.personRow}>
                <TAvatar
                  uri={isArtist ? appointment.clientAvatarUrl : appointment.artistAvatarUrl}
                  name={counterpart}
                  size="lg"
                />
                <View style={{ flex: 1 }}>
                  <TText variant="title2" serif style={{ fontSize: 22, lineHeight: 26 }}>{counterpart}</TText>
                  {!isArtist && !!appointment.artistCity && <TText variant="caption" color="tertiary">{appointment.artistCity}</TText>}
                </View>
              </View>
            )}
            <Pressable
              onPress={openChat}
              accessibilityRole="button"
              accessibilityLabel={`Écrire à ${counterpart}`}
              hitSlop={6}
              style={({ pressed }) => [styles.roundBtn, pressed && { opacity: 0.6 }]}
            >
              <Ionicons name="chatbubble-outline" size={17} color={Colors.textPrimary} />
            </Pressable>
          </View>
        </Section>

        <Section title="Détails" index={3}>
          <Fact label="Zone" value={appointment.bodyZone ?? '—'} />
          {validDates && <Fact label="Horaire" value={timeRange} />}
          {!!duration && <Fact label="Durée estimée" value={duration} />}
          {appointment.status === 'canceled' && !!canceledByLabel && <Fact label="Annulé par" value={canceledByLabel} />}
          {appointment.status === 'canceled' && !!cancelInfo?.reason && <Fact label="Motif" value={cancelInfo.reason} />}
          {appointment.status === 'canceled' && !outcome && !!appointment.requestId && (
            <ActionLink icon="folder-open-outline" label="Voir le projet" onPress={openRequest} />
          )}
        </Section>

        {!!appointment.notes && (
          <Section title="Notes" index={4}>
            <TText variant="body" color="secondary" style={{ maxWidth: Layout.maxReading }}>{appointment.notes}</TText>
          </Section>
        )}

        {/* ── Healed photo ── */}
        <HealedPhotoCard
          appointmentId={appointment.id}
          role={isArtist ? 'artist' : 'client'}
          completed={appointment.status === 'completed'}
        />

        {/* ── Calendar ── */}
        {canManage && validDates && (
          <Section title="Ajouter à mon agenda" index={6}>
            <View style={styles.calendarRow}>
              <TButton
                title="Google Agenda"
                variant="secondary"
                size="sm"
                fullWidth={false}
                onPress={addToGoogle}
                icon={<Ionicons name="logo-google" size={14} color={Colors.textPrimary} />}
              />
              <TButton
                title="Fichier .ics"
                variant="secondary"
                size="sm"
                fullWidth={false}
                onPress={downloadIcs}
                accessibilityLabel={Platform.OS === 'web' ? 'Télécharger le fichier .ics' : 'Partager le fichier .ics'}
                icon={<Ionicons name="download-outline" size={15} color={Colors.textPrimary} />}
              />
            </View>
            <TText variant="caption" color="tertiary" style={{ marginTop: Spacing['2xs'] }}>
              {appointment.status === 'proposed'
                ? 'Ajouté comme provisoire tant que le créneau n’est pas confirmé.'
                : 'Apple Calendrier, Outlook et la plupart des agendas ouvrent le fichier .ics.'}
            </TText>
          </Section>
        )}

        {/* ── Cancel or move ── */}
        {canManage && (
          <Section title="Modifier le rendez-vous" index={7}>
            {!isArtist && notice !== null && (
              <TText variant="bodySmall" color={clientLocked ? 'warning' : 'secondary'} style={{ marginBottom: Spacing.xs }}>
                {clientLocked
                  ? `Le délai d’annulation (${noticeDeadline(notice)}) est dépassé : écrivez à ${appointment.artistBlaze} pour trouver une solution.`
                  : appointment.status === 'confirmed'
                    ? cancellationNotice(notice)
                    : 'Vous pouvez annuler ou demander un autre créneau tant que celui-ci n’est pas confirmé.'}
              </TText>
            )}
            <View style={styles.manageRow}>
              {!isArtist && (
                <ActionLink icon="swap-horizontal-outline" label="Demander un autre créneau" onPress={openMove} disabled={clientLocked} />
              )}
              <ActionLink icon="close-circle-outline" label="Annuler le rendez-vous" onPress={openCancel} disabled={clientLocked} tone="danger" />
            </View>
          </Section>
        )}
      </ScrollView>

      {/* ── Pinned actions ── */}
      {hasBar && !sheet && (
        <GlassSurface style={[styles.bar, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.barInner}>
            {!!actionError && (
              <View style={styles.errorRow} accessibilityRole="alert" accessibilityLiveRegion="assertive">
                <Ionicons name="alert-circle-outline" size={16} color={Colors.errorLight} />
                <TText variant="caption" style={{ color: Colors.errorLight, flex: 1 }}>{actionError}</TText>
              </View>
            )}
            {isOpen ? (
              isArtist && appointment.status === 'proposed' ? (
                <View style={styles.barRow}>
                  <TButton title="Message" variant="secondary" onPress={openChat} fullWidth={false} accessibilityLabel={`Écrire à ${counterpart}`} />
                  <View style={{ flex: 1 }}>
                    <TButton title="Confirmer le rendez-vous" onPress={handleConfirm} loading={busy === 'confirm'} disabled={!!busy} />
                  </View>
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
                  icon={<Ionicons name="chatbubble-outline" size={16} color={Colors.textInverse} />}
                />
              )
            ) : (
              <TButton
                title="Laisser un avis"
                onPress={() => router.push(`/review/new?appointmentId=${id}&artistId=${appointment.artistId ?? ''}` as any)}
                icon={<Ionicons name="star-outline" size={16} color={Colors.textInverse} />}
              />
            )}
          </View>
        </GlassSurface>
      )}

      {/* ── Cancel (web-safe confirmation: Alert.alert is a no-op on web) ── */}
      <BottomSheet visible={sheet === 'cancel'} onClose={closeSheet} accessibilityLabel="Annuler le rendez-vous">
        <TText variant="displayS">Annuler ce rendez-vous{' '}?</TText>
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
          <TText variant="caption" style={{ color: Colors.errorLight, marginTop: Spacing.xs }} accessibilityRole="alert">{sheetError}</TText>
        )}
        <View style={styles.sheetActions}>
          <TButton title="Annuler le rendez-vous" variant="destructive" onPress={() => { void submitCancel(); }} loading={busy === 'cancel'} disabled={!!busy} />
          <TButton title="Garder le rendez-vous" variant="ghost" size="md" onPress={closeSheet} />
        </View>
      </BottomSheet>

      {/* ── Move (client) ── */}
      <BottomSheet visible={sheet === 'move'} onClose={closeSheet} accessibilityLabel="Demander un autre créneau">
        <ScrollView style={{ maxHeight: 600 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <TText variant="displayS">
            Un autre <TText variant="displayS" italic color="accentGlow">créneau</TText>
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
            <TText variant="caption" style={{ color: Colors.errorLight, marginTop: Spacing.xs }} accessibilityRole="alert">{sheetError}</TText>
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
  body: {
    width: '100%', maxWidth: DOSSIER_MAX + Layout.gutter * 2, alignSelf: 'center',
    paddingHorizontal: Layout.gutter,
  },

  hero: { paddingTop: Spacing.lg, paddingBottom: Spacing.lg, gap: Spacing['2xs'] },
  statusLine: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 4 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },

  outcome: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.xs,
    padding: Spacing.sm, marginBottom: Spacing.lg, borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderGlow, backgroundColor: Colors.glassAmber,
  },

  section: {
    paddingVertical: Spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.borderDefault,
  },
  personLine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  personRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, minHeight: 56 },
  roundBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderDefault,
  },
  fact: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.borderSubtle,
  },

  calendarRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing['2xs'] },
  manageRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: Spacing.lg, rowGap: Spacing['3xs'] },
  actionLink: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, alignSelf: 'flex-start' },

  bar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingTop: 12, paddingHorizontal: Layout.gutter,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.borderDefault,
  },
  barInner: { width: '100%', maxWidth: DOSSIER_MAX, alignSelf: 'center', gap: Spacing['2xs'] },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing['2xs'] },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sheetActions: { marginTop: Spacing.md, gap: Spacing['2xs'] },
});
