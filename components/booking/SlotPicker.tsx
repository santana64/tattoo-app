import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Platform } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Radius } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TButton } from '@/components/ui/TButton';
import { TSkeleton } from '@/components/ui/TSkeleton';
import { Toast } from '@/components/ui/TToast';
import { PressableScale } from '@/components/motion';
import { fetchFreeSlots, formatSlotTime, groupSlotsByDay, type FreeSlot } from '@/lib/studio';

interface SlotPickerProps {
  artistId: string;
  /** Length of the session the slots must fit, in minutes. */
  durationMin?: number;
  /** Chosen start instants, ISO strings. */
  value: string[];
  onChange: (next: string[]) => void;
  max?: number;
  days?: number;
}

const weekdayShort = new Intl.DateTimeFormat('fr-FR', { weekday: 'short' });
const monthShort = new Intl.DateTimeFormat('fr-FR', { month: 'short' });
const longDate = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
const shortDate = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const instant = (iso: string) => new Date(iso).getTime();

export type SlotToggleResult = { next: string[]; limited: boolean };

/**
 * Pure selection rule: tapping a chosen slot removes it; tapping a new one adds it
 * (soonest first) unless `max` is reached — then a single-choice picker swaps,
 * a multi-choice one refuses and reports `limited`.
 */
export function toggleSlotSelection(value: string[], startIso: string, max: number): SlotToggleResult {
  const t = instant(startIso);
  if (value.some((v) => instant(v) === t)) {
    return { next: value.filter((v) => instant(v) !== t), limited: false };
  }
  if (value.length >= max) {
    return max === 1 ? { next: [startIso], limited: false } : { next: value, limited: true };
  }
  return { next: [...value, startIso].sort((a, b) => instant(a) - instant(b)), limited: false };
}

/** "jeu. 14 nov. · 10:00" */
export const formatChosenSlot = (iso: string) => {
  const d = new Date(iso);
  return `${shortDate.format(d)} · ${formatSlotTime(d)}`;
};

function PickerSkeleton() {
  return (
    <View style={{ gap: Spacing.sm }}>
      <View style={styles.dayRow}>
        {[0, 1, 2, 3, 4, 5].map((i) => <TSkeleton key={i} width={58} height={74} radius={Radius.lg} />)}
      </View>
      <View style={styles.wrap}>
        {[0, 1, 2, 3, 4].map((i) => <TSkeleton key={i} width={72} height={40} radius={Radius.md} />)}
      </View>
    </View>
  );
}

export function SlotPicker({ artistId, durationMin = 120, value, onChange, max = 3, days = 28 }: SlotPickerProps) {
  const [slots, setSlots] = useState<FreeSlot[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [dayKey, setDayKey] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setStatus('loading');
    fetchFreeSlots(artistId, days, durationMin)
      .then((data) => { if (active) { setSlots(data); setStatus('ready'); } })
      .catch(() => { if (active) setStatus('error'); });
    return () => { active = false; };
  }, [artistId, days, durationMin, attempt]);

  const groups = useMemo(() => groupSlotsByDay(slots), [slots]);
  const chosen = useMemo(() => new Set(value.map(instant)), [value]);

  // Keep the open day valid: the first day carrying a chosen slot, else the first day.
  const activeDay = groups.find((g) => g.key === dayKey)
    ?? groups.find((g) => g.slots.some((s) => chosen.has(s.start.getTime())))
    ?? groups[0];

  const toggle = (slot: FreeSlot) => {
    const { next, limited } = toggleSlotSelection(value, slot.start.toISOString(), max);
    if (limited) {
      Toast.info(`${max} créneaux au maximum : retirez-en un pour en choisir un autre.`);
      return;
    }
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    onChange(next);
  };

  if (status === 'loading') return <PickerSkeleton />;

  if (status === 'error') {
    return (
      <View style={styles.notice} accessibilityRole="alert">
        <Ionicons name="cloud-offline-outline" size={18} color={Colors.textTertiary} />
        <View style={{ flex: 1, gap: Spacing['2xs'] }}>
          <TText variant="bodySmall" color="secondary">Les créneaux n’ont pas pu être chargés.</TText>
          <TButton
            title="Réessayer"
            variant="secondary"
            size="sm"
            fullWidth={false}
            style={{ alignSelf: 'flex-start' }}
            onPress={() => setAttempt((n) => n + 1)}
          />
        </View>
      </View>
    );
  }

  if (groups.length === 0) {
    return (
      <View style={styles.notice}>
        <Ionicons name="calendar-clear-outline" size={18} color={Colors.textTertiary} />
        <TText variant="bodySmall" color="secondary" style={{ flex: 1 }}>
          Cet artiste n’a pas encore publié ses disponibilités. Vous conviendrez d’une date ensemble.
        </TText>
      </View>
    );
  }

  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.dayRow}
        accessibilityLabel="Jours disponibles"
      >
        {groups.map((g) => {
          const selected = g.key === activeDay?.key;
          const picked = g.slots.filter((s) => chosen.has(s.start.getTime())).length;
          const label = `${capitalize(longDate.format(g.date))}, ${g.slots.length} créneau${g.slots.length > 1 ? 'x' : ''} libre${g.slots.length > 1 ? 's' : ''}${picked ? `, ${picked} choisi${picked > 1 ? 's' : ''}` : ''}`;
          return (
            <PressableScale
              key={g.key}
              onPress={() => setDayKey(g.key)}
              pressedScale={0.94}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{ selected }}
              style={[styles.dayCell, selected && styles.dayCellSelected]}
            >
              <TText variant="micro" uppercase style={{ color: selected ? Colors.textInverse : Colors.textTertiary }}>
                {weekdayShort.format(g.date).replace('.', '')}
              </TText>
              <TText variant="title2" tabular style={{ color: selected ? Colors.textInverse : Colors.textPrimary }}>
                {g.date.getDate()}
              </TText>
              <TText variant="micro" style={{ color: selected ? Colors.textInverse : Colors.textTertiary }}>
                {monthShort.format(g.date).replace('.', '')}
              </TText>
              {picked > 0 && (
                <View style={[styles.badge, selected && styles.badgeOnSelected]}>
                  <TText variant="micro" tabular style={{ color: selected ? Colors.accentAction : Colors.textInverse, lineHeight: 12 }}>
                    {picked}
                  </TText>
                </View>
              )}
            </PressableScale>
          );
        })}
      </ScrollView>

      {activeDay && (
        <View style={styles.times}>
          <TText variant="caption" color="tertiary" style={{ marginBottom: Spacing['2xs'] }}>
            {capitalize(longDate.format(activeDay.date))}
          </TText>
          <View style={styles.wrap} accessibilityRole={max === 1 ? 'radiogroup' : undefined}>
            {activeDay.slots.map((s) => {
              const selected = chosen.has(s.start.getTime());
              const time = formatSlotTime(s.start);
              return (
                <Pressable
                  key={s.start.toISOString()}
                  onPress={() => toggle(s)}
                  accessibilityRole={max === 1 ? 'radio' : 'checkbox'}
                  accessibilityLabel={`${capitalize(longDate.format(s.start))} à ${time}`}
                  accessibilityState={{ selected, checked: selected }}
                  style={(state) => {
                    const { pressed, hovered } = state as { pressed: boolean; hovered?: boolean };
                    return [styles.timeChip, (pressed || hovered) && !selected && styles.timeChipHover, selected && styles.timeChipSelected];
                  }}
                >
                  <TText variant="bodySmall" weight="medium" tabular style={{ color: selected ? Colors.textInverse : Colors.textSecondary }}>
                    {time}
                  </TText>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {value.length > 0 && (
        <View style={styles.chosen}>
          <TText variant="caption" color="tertiary" accessibilityLiveRegion="polite">
            {value.length} sur {max} choisi{value.length > 1 ? 's' : ''}
          </TText>
          <View style={styles.wrap}>
            {value.map((iso) => (
              <Pressable
                key={iso}
                onPress={() => onChange(value.filter((v) => instant(v) !== instant(iso)))}
                accessibilityRole="button"
                accessibilityLabel={`Retirer ${capitalize(longDate.format(new Date(iso)))} à ${formatSlotTime(new Date(iso))}`}
                hitSlop={4}
                style={({ pressed }) => [styles.chosenPill, pressed && { opacity: 0.6 }]}
              >
                <TText variant="caption" tabular weight="medium">{formatChosenSlot(iso)}</TText>
                <Ionicons name="close" size={13} color={Colors.textTertiary} />
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  dayRow: { flexDirection: 'row', gap: 8, paddingRight: Spacing.sm },
  dayCell: {
    width: 58, minHeight: 74, paddingVertical: 10, alignItems: 'center', gap: 2,
    borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderDefault,
  },
  dayCellSelected: { backgroundColor: Colors.accentAction, borderColor: Colors.accentAction },
  badge: {
    position: 'absolute', top: 4, right: 4,
    minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 4,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.accentWarm,
  },
  badgeOnSelected: { backgroundColor: Colors.textInverse },

  times: { marginTop: Spacing.md },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timeChip: {
    minWidth: 72, height: 40, paddingHorizontal: 12,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.borderDefault,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } as object : null),
  },
  timeChipHover: { backgroundColor: Colors.glassBgMid },
  timeChipSelected: { backgroundColor: Colors.accentAction, borderColor: Colors.accentAction },

  chosen: {
    marginTop: Spacing.md, paddingTop: Spacing.sm, gap: Spacing['2xs'],
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.borderSubtle,
  },
  chosenPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    height: 30, paddingHorizontal: 10, borderRadius: Radius.full,
    backgroundColor: Colors.glassBgMid, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderGlass,
  },

  notice: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.xs,
    padding: Spacing.sm, borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderDefault, backgroundColor: Colors.bgElevated,
  },
});
