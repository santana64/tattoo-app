import React, { useState, useEffect } from 'react';
import {
  View, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeIn, FadeInDown, FadeInUp,
  useSharedValue, useAnimatedStyle, withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Colors, Spacing, Radius, GlowShadow } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TBadge } from '@/components/ui/TBadge';
import { GlassCard } from '@/components/ui/GlassCard';
import { TAvatar } from '@/components/ui/TAvatar';
import { useAuthStore } from '@/store/auth-store';
import { supabase } from '@/lib/supabase';

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  proposed: {
    label: 'Proposé',
    variant: 'accent' as const,
    color: Colors.infoLight,
    icon: 'time-outline',
    bg: Colors.glassViolet,
  },
  confirmed: {
    label: 'Confirmé',
    variant: 'success' as const,
    color: Colors.successLight,
    icon: 'checkmark-circle-outline',
    bg: 'rgba(16,185,129,0.08)',
  },
  completed: {
    label: 'Terminé',
    variant: 'default' as const,
    color: Colors.textSecondary,
    icon: 'ribbon-outline',
    bg: Colors.bgSurface,
  },
  canceled: {
    label: 'Annulé',
    variant: 'error' as const,
    color: Colors.errorLight,
    icon: 'close-circle-outline',
    bg: 'rgba(239,68,68,0.08)',
  },
};

// ─── InfoRow ──────────────────────────────────────────────────────────────────

function InfoRow({
  icon, label, value, accent,
}: {
  icon: string;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <Ionicons
          name={icon as any}
          size={16}
          color={accent ? Colors.accentWarm : Colors.textTertiary}
        />
      </View>
      <TText variant="caption" color="tertiary" style={{ width: 90 }}>
        {label}
      </TText>
      <TText
        variant="bodySmall"
        style={{
          flex: 1,
          color: accent ? Colors.accentWarm : Colors.textPrimary,
          fontWeight: accent ? '600' : '400',
        }}
      >
        {value}
      </TText>
    </View>
  );
}

// ─── ActionButton ─────────────────────────────────────────────────────────────

function ActionButton({
  label, icon, color, bg, onPress, disabled,
}: {
  label: string;
  icon: string;
  color: string;
  bg: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[animStyle, { flex: 1 }]}>
      <TouchableOpacity
        onPress={() => {
          if (disabled) return;
          scale.value = withSpring(0.95, { damping: 12 }, () => {
            scale.value = withSpring(1);
          });
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onPress();
        }}
        activeOpacity={1}
        style={[
          styles.actionBtn,
          { backgroundColor: bg, opacity: disabled ? 0.4 : 1 },
        ]}
      >
        <Ionicons name={icon as any} size={18} color={color} />
        <TText
          variant="caption"
          style={{ color, marginTop: 4, fontWeight: '600' }}
        >
          {label}
        </TText>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

interface AppointmentData {
  id: string;
  requestId: string | null;
  status: keyof typeof STATUS_CONFIG;
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

  useEffect(() => {
    if (!id) return;
    const fetch = async () => {
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
        status: (data.status as keyof typeof STATUS_CONFIG) ?? 'proposed',
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
    fetch();
  }, [id]);

  const handleConfirm = async () => {
    if (!appointment) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const { error } = await supabase
      .from('appointments')
      .update({ status: 'confirmed' })
      .eq('id', appointment.id);
    if (!error) setAppointment((prev) => prev ? { ...prev, status: 'confirmed' } : prev);
  };

  const handleCancel = () => {
    Alert.alert('Annuler ce rendez-vous ?', 'Cette action est irréversible.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Confirmer',
        style: 'destructive',
        onPress: async () => {
          if (!appointment) return;
          await supabase.from('appointments').update({ status: 'canceled' }).eq('id', appointment.id);
          setAppointment((prev) => prev ? { ...prev, status: 'canceled' } : prev);
        },
      },
    ]);
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.accentWarm} />
      </View>
    );
  }

  if (notFound || !appointment) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={[styles.header]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <TText variant="title2" weight="bold">Rendez-vous</TText>
          <View style={{ width: 44 }} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg }}>
          <Ionicons name="calendar-outline" size={48} color={Colors.textTertiary} />
          <TText variant="title2" weight="semibold" style={{ marginTop: Spacing.md, textAlign: 'center' }}>
            Rendez-vous introuvable
          </TText>
          <TText variant="body" color="tertiary" style={{ marginTop: Spacing.xs, textAlign: 'center' }}>
            Ce rendez-vous n'existe pas ou tu n'y as pas accès.
          </TText>
        </View>
      </View>
    );
  }

  const statusConf = STATUS_CONFIG[appointment.status] ?? STATUS_CONFIG.proposed;
  const isArtist = user?.role === 'artist';

  // Format date range from startsAt / endsAt
  const formattedDate = (() => {
    try {
      const start = parseISO(appointment.startsAt);
      const end = parseISO(appointment.endsAt);
      const dateStr = format(start, "EEEE d MMMM yyyy 'à' HH'h'mm", {
        locale: fr,
      });
      const endTime = format(end, "HH'h'mm");
      return `${dateStr} → ${endTime}`;
    } catch {
      return appointment.startsAt;
    }
  })();

  // Estimate session duration in hours
  const durationHours = (() => {
    try {
      const ms =
        new Date(appointment.endsAt).getTime() -
        new Date(appointment.startsAt).getTime();
      return (ms / 3_600_000).toFixed(1);
    } catch {
      return null;
    }
  })();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ── Header ── */}
      <Animated.View entering={FadeIn.duration(300)} style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <TText variant="title2" weight="bold">
          Rendez-vous
        </TText>
        <View style={{ width: 44 }} />
      </Animated.View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
      >
        {/* ── Status hero ── */}
        <Animated.View
          entering={FadeInDown.delay(100).springify()}
          style={styles.statusHero}
        >
          <View style={[styles.statusIconWrap, { backgroundColor: statusConf.bg }]}>
            <Ionicons
              name={statusConf.icon as any}
              size={28}
              color={statusConf.color}
            />
          </View>
          <TBadge
            label={statusConf.label}
            variant={statusConf.variant}
            style={{ marginTop: Spacing.sm }}
          />
          <TText
            variant="title1"
            weight="bold"
            style={{
              marginTop: Spacing.xs,
              letterSpacing: -0.5,
              textAlign: 'center',
            }}
          >
            {appointment.bodyZone ?? 'Tatouage'}
          </TText>
          <TText variant="caption" color="tertiary" style={{ marginTop: 4 }}>
            {formattedDate}
          </TText>
        </Animated.View>

        {/* ── Artist card ── */}
        <Animated.View
          entering={FadeInDown.delay(160).springify()}
          style={styles.section}
        >
          <GlassCard variant="elevated" style={styles.artistCard}>
            <TAvatar
              uri={appointment.artistAvatarUrl}
              name={appointment.artistBlaze}
              size="lg"
              isPremium={appointment.artistTier === 'premium'}
            />
            <View style={{ flex: 1, marginLeft: Spacing.sm }}>
              <TText variant="title2" weight="bold">
                {appointment.artistBlaze}
              </TText>
              <TText variant="caption" color="tertiary">
                {appointment.artistCity}
              </TText>
            </View>
            {appointment.artistId && (
              <TouchableOpacity
                onPress={() => router.push(`/artist/${appointment.artistId}` as any)}
                style={styles.viewProfileBtn}
              >
                <TText variant="micro" style={{ color: Colors.accentWarm }}>
                  Voir →
                </TText>
              </TouchableOpacity>
            )}
          </GlassCard>
        </Animated.View>

        {/* ── Details ── */}
        <Animated.View
          entering={FadeInDown.delay(220).springify()}
          style={styles.section}
        >
          <TText
            variant="label"
            color="tertiary"
            uppercase
            style={styles.sectionLabel}
          >
            Détails
          </TText>
          <GlassCard variant="default" style={{ padding: Spacing.sm }}>
            <InfoRow
              icon="body-outline"
              label="Zone"
              value={appointment.bodyZone ?? '—'}
            />
            {durationHours && (
              <>
                <View style={styles.rowDivider} />
                <InfoRow
                  icon="time-outline"
                  label="Durée estimée"
                  value={`${durationHours}h`}
                />
              </>
            )}
            <View style={styles.rowDivider} />
            {isArtist && (
              <><View style={styles.rowDivider} /><InfoRow
                icon="person-outline"
                label="Client"
                value={appointment.clientName}
              /></>
            )}
          </GlassCard>
        </Animated.View>

        {/* ── Notes ── */}
        {appointment.notes && (
          <Animated.View
            entering={FadeInDown.delay(280).springify()}
            style={styles.section}
          >
            <TText
              variant="label"
              color="tertiary"
              uppercase
              style={styles.sectionLabel}
            >
              Notes
            </TText>
            <GlassCard variant="default" style={{ padding: Spacing.sm }}>
              <TText
                variant="body"
                color="secondary"
                style={{ lineHeight: 22 }}
              >
                {appointment.notes}
              </TText>
            </GlassCard>
          </Animated.View>
        )}

        {/* ── Actions ── */}
        {appointment.status !== 'completed' &&
          appointment.status !== 'canceled' && (
            <Animated.View
              entering={FadeInDown.delay(340).springify()}
              style={styles.section}
            >
              <TText
                variant="label"
                color="tertiary"
                uppercase
                style={styles.sectionLabel}
              >
                Actions
              </TText>
              <View style={styles.actionsRow}>
                <ActionButton
                  label="Message"
                  icon="chatbubble-outline"
                  color={Colors.accentWarm}
                  bg={Colors.glassAmber}
                  onPress={() =>
                    router.push(
                      `/conversation/${appointment.requestId ?? id}` as any,
                    )
                  }
                />
                {isArtist && appointment.status === 'proposed' && (
                  <ActionButton
                    label="Confirmer"
                    icon="checkmark-circle-outline"
                    color={Colors.successLight}
                    bg="rgba(16,185,129,0.10)"
                    onPress={handleConfirm}
                  />
                )}
                <ActionButton
                  label="Annuler"
                  icon="close-circle-outline"
                  color={Colors.errorLight}
                  bg="rgba(239,68,68,0.10)"
                  onPress={handleCancel}
                />
              </View>
            </Animated.View>
          )}

        {/* ── Review CTA (completed clients only) ── */}
        {appointment.status === 'completed' && !isArtist && (
          <Animated.View
            entering={FadeInUp.delay(400).springify()}
            style={styles.section}
          >
            <TouchableOpacity
              onPress={() =>
                router.push(`/review/new?appointmentId=${id}&artistId=${appointment.artistId ?? ''}` as any)
              }
              style={styles.reviewCTA}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={[Colors.accentGlow, Colors.accentWarm, '#A06030']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <Ionicons name="star-outline" size={18} color={Colors.bgPrimary} />
              <TText
                variant="body"
                weight="bold"
                style={{ color: Colors.bgPrimary, marginLeft: 8 }}
              >
                Laisser un avis
              </TText>
            </TouchableOpacity>
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing['2xs'],
    paddingBottom: Spacing.sm,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  statusHero: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  statusIconWrap: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
  },

  section: {
    paddingHorizontal: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  sectionLabel: {
    letterSpacing: 2,
    marginBottom: Spacing['2xs'],
    paddingHorizontal: Spacing['2xs'],
  },

  artistCard: { flexDirection: 'row', alignItems: 'center' },
  availPill: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  availDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.successLight,
  },
  viewProfileBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: Colors.glassAmber,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.borderGlow,
  },

  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  infoIcon: { width: 28, alignItems: 'center' },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.borderSubtle,
  },

  actionsRow: { flexDirection: 'row', gap: Spacing['2xs'] },
  actionBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
  },

  reviewCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    ...GlowShadow.amber,
  },
});
