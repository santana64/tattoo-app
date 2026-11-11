import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import Animated from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, Spacing, Radius } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TSkeleton } from '@/components/ui/TSkeleton';
import { enterUp } from '@/components/motion';
import { fetchFreeSlots, formatSlotTime, groupSlotsByDay, type FreeSlot } from '@/lib/studio';

interface AvailabilitySectionProps {
  artistId: string;
  /** Opens the full picker (usually the request form). Hidden when absent. */
  onPick?: () => void;
}

const DAYS_SHOWN = 3;
const TIMES_SHOWN = 4;

const shortDate = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
const longDate = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

function SectionSkeleton() {
  return (
    <View style={styles.section}>
      <TSkeleton width={90} height={10} />
      <TSkeleton width="55%" height={26} style={{ marginTop: Spacing['2xs'], marginBottom: Spacing.sm }} />
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.row}>
          <TSkeleton width={84} height={14} />
          <View style={[styles.times, { flex: 1 }]}>
            {[0, 1, 2].map((j) => <TSkeleton key={j} width={56} height={30} radius={Radius.md} />)}
          </View>
        </View>
      ))}
    </View>
  );
}

/** Next free slots on a public profile. Renders nothing when there is nothing to show. */
export function AvailabilitySection({ artistId, onPick }: AvailabilitySectionProps) {
  const [slots, setSlots] = useState<FreeSlot[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setSlots(null); setFailed(false);
    fetchFreeSlots(artistId)
      .then((data) => { if (active) setSlots(data); })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [artistId]);

  const days = useMemo(() => (slots ? groupSlotsByDay(slots).slice(0, DAYS_SHOWN) : []), [slots]);

  if (failed) return null;
  if (slots === null) return <SectionSkeleton />;
  if (days.length === 0) return null;

  return (
    <Animated.View entering={enterUp(0)} style={styles.section}>
      <TText variant="label" color="accentWarm" uppercase>Disponibilités</TText>
      <TText variant="displayS" accessibilityRole="header" style={styles.title}>Prochains créneaux</TText>

      {days.map((d) => {
        const shown = d.slots.slice(0, TIMES_SHOWN);
        const more = d.slots.length - shown.length;
        const times = shown.map((s) => formatSlotTime(s.start));
        const a11y = `${longDate.format(d.date)} : ${times.join(', ')}${more > 0 ? `, et ${more} autre${more > 1 ? 's' : ''}` : ''}`;
        return (
          <View key={d.key} style={styles.row} accessible accessibilityLabel={a11y}>
            <TText variant="bodySmall" weight="medium" tabular style={styles.date}>{shortDate.format(d.date)}</TText>
            <View style={[styles.times, { flex: 1 }]}>
              {times.map((t) => (
                <View key={t} style={styles.chip}>
                  <TText variant="caption" weight="medium" tabular color="secondary">{t}</TText>
                </View>
              ))}
              {more > 0 && (
                <View style={[styles.chip, styles.chipMore]}>
                  <TText variant="caption" weight="medium" tabular color="tertiary">+{more}</TText>
                </View>
              )}
            </View>
          </View>
        );
      })}

      {onPick && (
        <Pressable
          onPress={onPick}
          accessibilityRole="button"
          accessibilityLabel="Voir tous les créneaux"
          hitSlop={8}
          style={({ pressed }) => [styles.link, pressed && { opacity: 0.6 }]}
        >
          <TText variant="bodySmall" weight="medium" style={{ textDecorationLine: 'underline' }}>Voir tous les créneaux</TText>
          <Ionicons name="arrow-forward" size={14} color={Colors.textPrimary} />
        </Pressable>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  section: { paddingVertical: Spacing.lg },
  title: { marginTop: Spacing['3xs'], marginBottom: Spacing.sm },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.borderSubtle,
  },
  date: { width: 96 },
  times: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    minWidth: 56, height: 30, paddingHorizontal: 8,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: Radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderDefault,
  },
  chipMore: { minWidth: 40, borderStyle: 'dashed' },
  link: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    minHeight: 40, marginTop: Spacing['2xs'],
  },
});
