import React, { useState } from 'react';
import { ScrollView, StyleSheet, View, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TAvatar } from '@/components/ui/TAvatar';
import { TBadge } from '@/components/ui/TBadge';
import { TDivider } from '@/components/ui/TDivider';
import { useAppStore } from '@/store/app-store';

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const WEEK_DATES = [7, 8, 9, 10, 11, 12, 13]; // April 2026

export default function AgendaScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { appointments } = useAppStore();
  const [selectedDay, setSelectedDay] = useState(1); // Tuesday (index 1 = Apr 8)

  const selectedDate = WEEK_DATES[selectedDay];
  const dayAppointments = appointments.filter((a) => {
    const d = new Date(a.startsAt);
    return d.getDate() === selectedDate && d.getMonth() === 3; // April
  });

  const statusInfo = {
    proposed: { label: 'Proposé', variant: 'accent' as const },
    confirmed: { label: 'Confirmé', variant: 'success' as const },
    completed: { label: 'Terminé', variant: 'default' as const },
    canceled: { label: 'Annulé', variant: 'error' as const },
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TText variant="title1" weight="bold">Agenda</TText>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerBtn}>
            <Ionicons name="add" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Month label */}
      <View style={styles.monthRow}>
        <TouchableOpacity>
          <Ionicons name="chevron-back" size={20} color={Colors.textSecondary} />
        </TouchableOpacity>
        <TText variant="bodySmall" weight="semibold">Avril 2026</TText>
        <TouchableOpacity>
          <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Week strip */}
      <View style={styles.weekStrip}>
        {DAYS.map((day, i) => {
          const date = WEEK_DATES[i];
          const hasAppt = appointments.some((a) => new Date(a.startsAt).getDate() === date && new Date(a.startsAt).getMonth() === 3);
          const isSelected = selectedDay === i;
          return (
            <TouchableOpacity
              key={day}
              style={[styles.dayCol, isSelected && styles.dayColSelected]}
              onPress={() => setSelectedDay(i)}
              activeOpacity={0.8}
            >
              <TText
                variant="caption"
                style={{ color: isSelected ? Colors.textInverse : Colors.textTertiary }}
              >
                {day}
              </TText>
              <TText
                variant="bodySmall"
                weight="semibold"
                style={{ color: isSelected ? Colors.textInverse : Colors.textPrimary }}
              >
                {date}
              </TText>
              {hasAppt && !isSelected && <View style={styles.dot} />}
            </TouchableOpacity>
          );
        })}
      </View>

      <TDivider />

      {/* Day schedule */}
      <ScrollView
        style={styles.schedule}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        <TText variant="caption" color="tertiary" style={styles.dateLabel}>
          {DAYS[selectedDay]} {WEEK_DATES[selectedDay]} Avril 2026
        </TText>

        {dayAppointments.length === 0 ? (
          <View style={styles.emptyDay}>
            <TText variant="bodySmall" color="tertiary">
              Aucun rendez-vous ce jour.
            </TText>
            <TouchableOpacity style={styles.addSlotBtn}>
              <Ionicons name="add-circle-outline" size={16} color={Colors.textTertiary} />
              <TText variant="caption" color="tertiary" style={{ marginLeft: 4 }}>
                Bloquer un créneau
              </TText>
            </TouchableOpacity>
          </View>
        ) : (
          dayAppointments.map((apt) => {
            const start = new Date(apt.startsAt);
            const end = new Date(apt.endsAt);
            const status = statusInfo[apt.status];
            const duration = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60));

            return (
              <TouchableOpacity
                key={apt.id}
                style={styles.aptCard}
                activeOpacity={0.85}
                onPress={() => router.push(`/conversation/${apt.requestId}`)}
              >
                <View style={styles.aptTime}>
                  <TText variant="bodySmall" weight="semibold">
                    {start.getHours()}h{String(start.getMinutes()).padStart(2, '0')}
                  </TText>
                  <TText variant="caption" color="tertiary">
                    {duration}h
                  </TText>
                </View>

                <View style={[styles.aptLine, { backgroundColor: apt.status === 'confirmed' ? Colors.success : Colors.accentWarm }]} />

                <View style={styles.aptBody}>
                  <View style={styles.aptHeader}>
                    <TText variant="bodySmall" weight="semibold" numberOfLines={1} style={{ flex: 1 }}>
                      {apt.clientName}
                    </TText>
                    <TBadge label={status.label} variant={status.variant} />
                  </View>
                  <TText variant="caption" color="secondary">
                    {apt.bodyZone}
                  </TText>
                  {apt.notes && (
                    <TText variant="caption" color="tertiary" numberOfLines={1} style={{ marginTop: 2 }}>
                      {apt.notes}
                    </TText>
                  )}
                </View>

                <TAvatar uri={apt.clientAvatar} name={apt.clientName} size="md" />
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing['2xs'],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSubtle,
  },
  headerRight: { flexDirection: 'row' },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing['2xs'],
    gap: Spacing.sm,
  },
  weekStrip: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing['2xs'],
    gap: 4,
  },
  dayCol: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing['2xs'],
    borderRadius: Radius.md,
    gap: 2,
  },
  dayColSelected: {
    backgroundColor: Colors.accentAction,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.accentWarm,
    marginTop: 1,
  },
  schedule: {
    flex: 1,
  },
  dateLabel: {
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing['2xs'],
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  emptyDay: {
    alignItems: 'center',
    paddingTop: Spacing.xl,
    gap: Spacing['2xs'],
  },
  addSlotBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing['2xs'],
  },
  aptCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.sm,
    marginBottom: Spacing['2xs'],
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    gap: Spacing['2xs'],
  },
  aptTime: {
    width: 40,
    alignItems: 'center',
  },
  aptLine: {
    width: 3,
    alignSelf: 'stretch',
    borderRadius: 2,
  },
  aptBody: {
    flex: 1,
  },
  aptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
});
