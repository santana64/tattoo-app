import React from 'react';
import {
  View, StyleSheet, ScrollView, TouchableOpacity,
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
import { useAppStore } from '@/store/app-store';
import { useAuthStore } from '@/store/auth-store';
import { ARTISTS } from '@/constants/mock-data';

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

export default function AppointmentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { appointments } = useAppStore();

  const appointment = appointments.find((a) => a.id === id) ?? appointments[0];
  if (!appointment) return null;

  // Derive artist — fall back to first in list
  const artist = ARTISTS[0];

  const statusConf =
    STATUS_CONFIG[appointment.status as keyof typeof STATUS_CONFIG] ??
    STATUS_CONFIG.proposed;

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
              uri={artist.avatarUrl}
              name={artist.blaze}
              size="lg"
              isPremium={artist.tier === 'premium'}
            />
            <View style={{ flex: 1, marginLeft: Spacing.sm }}>
              <TText variant="title2" weight="bold">
                {artist.blaze}
              </TText>
              <TText variant="caption" color="tertiary">
                {artist.city}
              </TText>
              {artist.bookingStatus === 'open' && (
                <View style={styles.availPill}>
                  <View style={styles.availDot} />
                  <TText variant="micro" style={{ color: Colors.successLight }}>
                    Disponible
                  </TText>
                </View>
              )}
            </View>
            <TouchableOpacity
              onPress={() => router.push(`/artist/${artist.id}` as any)}
              style={styles.viewProfileBtn}
            >
              <TText variant="micro" style={{ color: Colors.accentWarm }}>
                Voir →
              </TText>
            </TouchableOpacity>
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
            <InfoRow
              icon="person-outline"
              label="Client"
              value={appointment.clientName}
            />
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
                    onPress={() =>
                      Haptics.notificationAsync(
                        Haptics.NotificationFeedbackType.Success,
                      )
                    }
                  />
                )}
                <ActionButton
                  label="Annuler"
                  icon="close-circle-outline"
                  color={Colors.errorLight}
                  bg="rgba(239,68,68,0.10)"
                  onPress={() =>
                    Haptics.notificationAsync(
                      Haptics.NotificationFeedbackType.Warning,
                    )
                  }
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
                router.push(`/review/new?appointmentId=${id}` as any)
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
