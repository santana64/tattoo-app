import React, { useState, useCallback } from 'react';
import { ScrollView, StyleSheet, View, TouchableOpacity, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeIn, FadeInDown, useSharedValue, useAnimatedStyle, withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Radius, GlowShadow } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TAvatar } from '@/components/ui/TAvatar';
import { TBadge } from '@/components/ui/TBadge';
import { TDivider } from '@/components/ui/TDivider';
import { GlassCard } from '@/components/ui/GlassCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAppStore } from '@/store/app-store';

const { width: SCREEN_W } = Dimensions.get('window');
const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const WEEK_DATES = [7, 8, 9, 10, 11, 12, 13];

const STATUS_CONFIG = {
  proposed:  { label: 'Proposé',  variant: 'accent'   as const, color: '#60A5FA' },
  confirmed: { label: 'Confirmé', variant: 'success'  as const, color: '#34D399' },
  completed: { label: 'Terminé',  variant: 'default'  as const, color: Colors.textTertiary },
  canceled:  { label: 'Annulé',   variant: 'error'    as const, color: '#F87171' },
};

function DayPill({ day, date, selected, hasAppt, onPress, index }: {
  day: string; date: number; selected: boolean; hasAppt: boolean; onPress: () => void; index: number;
}) {
  const scale = useSharedValue(1);
  const s = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View entering={FadeIn.delay(index * 30).duration(300)} style={[s, styles.dayPillWrap]}>
      <TouchableOpacity
        onPress={() => {
          scale.value = withSpring(0.9, { damping: 8 }, () => { scale.value = withSpring(1); });
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
        activeOpacity={1}
        style={[styles.dayPill, selected && styles.dayPillSelected]}
      >
        <TText variant="micro" style={{ color: selected ? 'rgba(255,255,255,0.7)' : Colors.textTertiary }} uppercase>
          {day}
        </TText>
        <TText
          variant="bodySmall"
          weight="bold"
          style={{ color: selected ? '#fff' : Colors.textPrimary, marginTop: 2 }}
        >
          {date}
        </TText>
        {hasAppt && !selected && (
          <View style={styles.dayDot} />
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

function AppointmentCard({ apt, index }: { apt: any; index: number }) {
  const router = useRouter();
  const status = STATUS_CONFIG[apt.status as keyof typeof STATUS_CONFIG];
  const start = new Date(apt.startsAt);
  const end = new Date(apt.endsAt);
  const durationH = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60));

  const scale = useSharedValue(1);
  const s = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 80).springify()}
      style={s}
    >
      <TouchableOpacity
        onPress={() => {
          scale.value = withSpring(0.97, { damping: 10 }, () => { scale.value = withSpring(1); });
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push(`/conversation/${apt.requestId}`);
        }}
        activeOpacity={1}
        style={[styles.aptCard, { borderLeftColor: status.color }]}
      >
        {/* Time column */}
        <View style={styles.aptTime}>
          <TText variant="bodySmall" weight="bold">
            {String(start.getHours()).padStart(2, '0')}h{String(start.getMinutes()).padStart(2, '0')}
          </TText>
          <TText variant="micro" color="tertiary">{durationH}h</TText>
        </View>

        {/* Content */}
        <View style={styles.aptBody}>
          <View style={styles.aptHeader}>
            <TText variant="bodySmall" weight="semibold" numberOfLines={1} style={{ flex: 1 }}>
              {apt.clientName}
            </TText>
            <TBadge label={status.label} variant={status.variant} />
          </View>
          <TText variant="caption" color="secondary" style={{ marginTop: 2 }}>{apt.bodyZone}</TText>
          {apt.notes && (
            <TText variant="caption" color="tertiary" numberOfLines={1} style={{ marginTop: 2 }}>
              {apt.notes}
            </TText>
          )}
        </View>

        <TAvatar uri={apt.clientAvatar} name={apt.clientName} size="md" />
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function AgendaScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { appointments } = useAppStore();
  const [selectedDay, setSelectedDay] = useState(1);

  const selectedDate = WEEK_DATES[selectedDay];
  const dayAppointments = appointments.filter((a) => {
    const d = new Date(a.startsAt);
    return d.getDate() === selectedDate && d.getMonth() === 3;
  });

  const weekStats = {
    total: appointments.length,
    confirmed: appointments.filter((a) => a.status === 'confirmed').length,
    revenue: appointments.filter((a) => a.status === 'confirmed').length * 220,
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <Animated.View entering={FadeIn.duration(300)} style={styles.header}>
        <TText variant="displayM" weight="black" style={styles.headerTitle}>Agenda</TText>
        <TouchableOpacity style={styles.addBtn}>
          <Ionicons name="add" size={22} color={Colors.accentWarm} />
        </TouchableOpacity>
      </Animated.View>

      {/* Week summary */}
      <Animated.View entering={FadeInDown.delay(80).springify()} style={styles.weekSummary}>
        <GlassCard variant="elevated" style={styles.summaryCard}>
          <View style={styles.summaryItem}>
            <TText variant="title2" weight="bold">{weekStats.total}</TText>
            <TText variant="micro" color="tertiary" uppercase>Total</TText>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <TText variant="title2" weight="bold" style={{ color: Colors.success }}>{weekStats.confirmed}</TText>
            <TText variant="micro" color="tertiary" uppercase>Confirmés</TText>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <TText variant="title2" weight="bold" style={{ color: Colors.accentWarm }}>
              {weekStats.revenue.toLocaleString('fr')}€
            </TText>
            <TText variant="micro" color="tertiary" uppercase>Estimé</TText>
          </View>
        </GlassCard>
      </Animated.View>

      {/* Month nav */}
      <View style={styles.monthNav}>
        <TouchableOpacity style={styles.monthNavBtn}>
          <Ionicons name="chevron-back" size={18} color={Colors.textSecondary} />
        </TouchableOpacity>
        <TText variant="bodySmall" weight="semibold">Avril 2026</TText>
        <TouchableOpacity style={styles.monthNavBtn}>
          <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Day strip */}
      <View style={styles.dayStrip}>
        {DAYS.map((day, i) => {
          const date = WEEK_DATES[i];
          const hasAppt = appointments.some(
            (a) => new Date(a.startsAt).getDate() === date && new Date(a.startsAt).getMonth() === 3
          );
          return (
            <DayPill
              key={day}
              day={day}
              date={date}
              selected={selectedDay === i}
              hasAppt={hasAppt}
              onPress={() => setSelectedDay(i)}
              index={i}
            />
          );
        })}
      </View>

      <TDivider style={{ marginBottom: Spacing.xs }} />

      {/* Schedule */}
      <ScrollView
        style={styles.schedule}
        contentContainerStyle={{ paddingHorizontal: Spacing.sm, paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        <TText variant="label" color="tertiary" uppercase style={styles.dateLabel}>
          {DAYS[selectedDay]} {selectedDate} Avril 2026
        </TText>

        {dayAppointments.length === 0 ? (
          <View style={styles.emptyDay}>
            <Ionicons name="calendar-outline" size={32} color={Colors.textTertiary} />
            <TText variant="bodySmall" color="tertiary" style={{ marginTop: 10 }}>
              Aucun rendez-vous ce jour
            </TText>
            <TouchableOpacity style={styles.blockSlotBtn}>
              <Ionicons name="add-circle-outline" size={15} color={Colors.textTertiary} />
              <TText variant="caption" color="tertiary" style={{ marginLeft: 5 }}>Bloquer un créneau</TText>
            </TouchableOpacity>
          </View>
        ) : (
          dayAppointments.map((apt, i) => (
            <AppointmentCard key={apt.id} apt={apt} index={i} />
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm, paddingTop: Spacing.xs, paddingBottom: Spacing['2xs'],
  },
  headerTitle: { letterSpacing: -2, fontSize: 34 },
  addBtn: {
    width: 40, height: 40, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.bgSurface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.borderSubtle,
  },

  // Summary
  weekSummary: { paddingHorizontal: Spacing.sm, marginBottom: Spacing.sm },
  summaryCard: { flexDirection: 'row', paddingVertical: Spacing.sm },
  summaryItem: { flex: 1, alignItems: 'center', gap: 3 },
  summaryDivider: { width: 1, backgroundColor: Colors.borderSubtle, marginVertical: 4 },

  // Month nav
  monthNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.md, paddingBottom: Spacing['2xs'],
  },
  monthNavBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },

  // Day strip
  dayStrip: { flexDirection: 'row', paddingHorizontal: Spacing.sm, gap: 4, marginBottom: Spacing.xs },
  dayPillWrap: { flex: 1 },
  dayPill: {
    flex: 1, alignItems: 'center', paddingVertical: 10,
    borderRadius: Radius.lg, gap: 1,
    backgroundColor: 'transparent',
  },
  dayPillSelected: {
    backgroundColor: Colors.accentWarm,
  },
  dayDot: {
    width: 4, height: 4, borderRadius: 2,
    backgroundColor: Colors.accentWarm, marginTop: 2,
  },

  // Schedule
  schedule: { flex: 1 },
  dateLabel: { paddingVertical: Spacing.xs, letterSpacing: 0.5 },
  emptyDay: { alignItems: 'center', paddingTop: Spacing.xl, gap: Spacing['2xs'] },
  blockSlotBtn: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: Spacing.xs, paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.borderSubtle,
  },

  // Appointment card
  aptCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.lg, padding: Spacing.sm,
    borderWidth: 1, borderColor: Colors.borderSubtle,
    borderLeftWidth: 3,
    marginBottom: Spacing['2xs'],
    gap: Spacing.sm,
  },
  aptTime: { width: 44, alignItems: 'center', gap: 2 },
  aptBody: { flex: 1 },
  aptHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
