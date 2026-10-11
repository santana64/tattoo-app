import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { format, isValid, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Colors, Spacing, Radius, Layout } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TButton } from '@/components/ui/TButton';
import { THeader } from '@/components/ui/THeader';
import { TAvatar } from '@/components/ui/TAvatar';
import { TSkeleton } from '@/components/ui/TSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusTimeline, type TimelineStep } from '@/components/RequestCard';
import { BottomSheet, GlassSurface, PressableScale, enterUp } from '@/components/motion';
import { useAuthStore } from '@/store/auth-store';
import { supabase } from '@/lib/supabase';

const DOSSIER_MAX = 720;

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

export default function AppointmentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();

  const [appointment, setAppointment] = useState<AppointmentData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'confirm' | 'cancel' | null>(null);
  const [showCancel, setShowCancel] = useState(false);

  useEffect(() => {
    if (!id) return;
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

      if (error || !data) { setNotFound(true); setIsLoading(false); return; }

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
        artistId: (data.artists as any)?.id ?? null,
        artistTier: (data.artists as any)?.tier ?? 'normal',
      });
      setIsLoading(false);
    };
    load();
  }, [id]);

  const handleConfirm = async () => {
    if (!appointment || busy) return;
    setBusy('confirm'); setActionError(null);
    const { error } = await supabase
      .from('appointments')
      .update({ status: 'confirmed' })
      .eq('id', appointment.id);
    setBusy(null);
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(error ? Haptics.NotificationFeedbackType.Error : Haptics.NotificationFeedbackType.Success);
    }
    if (!error) setAppointment((prev) => prev ? { ...prev, status: 'confirmed' } : prev);
    else setActionError('La confirmation n’a pas été enregistrée. Réessayez.');
  };

  // Confirmation lives in a sheet (Alert.alert is a no-op on web).
  const handleCancel = () => { setActionError(null); setShowCancel(true); };
  const confirmCancel = async () => {
    if (!appointment || busy) return;
    setBusy('cancel'); setActionError(null);
    const { error } = await supabase.from('appointments').update({ status: 'canceled' }).eq('id', appointment.id);
    setBusy(null);
    if (error) {
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setActionError('L’annulation n’a pas été enregistrée. Le rendez-vous est inchangé.');
      return;
    }
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setAppointment((prev) => prev ? { ...prev, status: 'canceled' } : prev);
    setShowCancel(false);
  };

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
  const isArtist = user?.role === 'artist';
  const isOpen = appointment.status !== 'completed' && appointment.status !== 'canceled';
  const counterpart = isArtist ? appointment.clientName : appointment.artistBlaze;

  const start = parseISO(appointment.startsAt);
  const end = parseISO(appointment.endsAt);
  const validDates = isValid(start) && isValid(end);
  const dayTitle = validDates ? format(start, 'EEEE d MMMM', { locale: fr }) : appointment.startsAt;
  const year = validDates ? format(start, 'yyyy') : '';
  const timeRange = validDates ? `${format(start, 'HH:mm')} – ${format(end, 'HH:mm')}` : '';
  const hours = validDates ? (end.getTime() - start.getTime()) / 3_600_000 : NaN;
  const duration = Number.isFinite(hours) && hours > 0
    ? `${hours.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} h`
    : null;

  const openChat = () => router.push(`/conversation/${appointment.requestId ?? id}` as any);
  const hasBar = isOpen || (appointment.status === 'completed' && !isArtist);

  return (
    <View style={styles.container}>
      <THeader showBack title="Rendez-vous" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + (hasBar ? 140 : Spacing['2xl']) }]}
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

        <Section title="Suivi" index={1}>
          <StatusTimeline steps={buildTimeline(appointment.status)} />
        </Section>

        <Section title={isArtist ? 'Client' : 'Artiste'} index={2}>
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
        </Section>

        <Section title="Détails" index={3}>
          <Fact label="Zone" value={appointment.bodyZone ?? '—'} />
          {validDates && <Fact label="Horaire" value={timeRange} />}
          {!!duration && <Fact label="Durée estimée" value={duration} />}
        </Section>

        {!!appointment.notes && (
          <Section title="Notes" index={4}>
            <TText variant="body" color="secondary" style={{ maxWidth: Layout.maxReading }}>{appointment.notes}</TText>
          </Section>
        )}

        {isOpen && (
          <Animated.View entering={enterUp(5, 80)} style={styles.dangerZone}>
            <Pressable
              onPress={handleCancel}
              accessibilityRole="button"
              accessibilityLabel="Annuler le rendez-vous"
              hitSlop={8}
              style={({ pressed }) => [styles.cancelLink, pressed && { opacity: 0.6 }]}
            >
              <Ionicons name="close-circle-outline" size={16} color={Colors.errorLight} />
              <TText variant="bodySmall" weight="medium" style={{ color: Colors.errorLight }}>Annuler le rendez-vous</TText>
            </Pressable>
          </Animated.View>
        )}
      </ScrollView>

      {/* ── Pinned actions ── */}
      {hasBar && !showCancel && (
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

      {/* ── Cancel confirmation ── */}
      <BottomSheet visible={showCancel} onClose={() => setShowCancel(false)} accessibilityLabel="Annuler le rendez-vous">
        <TText variant="displayS">Annuler ce rendez-vous{' '}?</TText>
        <TText variant="bodySmall" color="secondary" style={{ marginTop: 4 }}>
          {validDates ? `${dayTitle}, ${timeRange}. ` : ''}Cette action est irréversible.
        </TText>
        {!!actionError && (
          <TText variant="caption" style={{ color: Colors.errorLight, marginTop: Spacing.xs }} accessibilityRole="alert">{actionError}</TText>
        )}
        <View style={styles.sheetActions}>
          <TButton title="Annuler le rendez-vous" variant="destructive" onPress={confirmCancel} loading={busy === 'cancel'} disabled={!!busy} />
          <TButton title="Garder le rendez-vous" variant="ghost" size="md" onPress={() => setShowCancel(false)} />
        </View>
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

  section: {
    paddingVertical: Spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.borderDefault,
  },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, minHeight: 56 },
  fact: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.borderSubtle,
  },

  dangerZone: {
    paddingTop: Spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.borderDefault,
  },
  cancelLink: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, alignSelf: 'flex-start' },

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
