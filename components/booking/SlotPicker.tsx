import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Platform } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Radius } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TButton } from '@/components/ui/TButton';
import { TSkeleton } from '@/components/ui/TSkeleton';
import { Toast } from '@/components/ui/TToast';
import { Kicker } from '@/components/v5';
import { fetchFreeSlots, formatSlotTime, groupSlotsByDay, type FreeSlot } from '@/lib/studio';
import { durationLabel } from '@/lib/care';
import { DurationSwitch, cleanDurations } from './DurationSwitch';

interface SlotPickerProps {
  artistId: string;
  /**
   * Length of the session the slots must fit, in minutes. Takes precedence
   * (e.g. a flash's own length); otherwise the first of `durations` is used.
   */
  durationMin?: number;
  /** Session lengths the artist offers. More than one shows a duration switch. */
  durations?: number[];
  onDurationChange?: (min: number) => void;
  /** Chosen start instants, ISO strings. */
  value: string[];
  onChange: (next: string[]) => void;
  max?: number;
  days?: number;
  /** Replaces the default copy shown when no slot is free. */
  emptyText?: string;
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
        {[0, 1, 2, 3, 4, 5].map((i) => <TSkeleton key={i} width={58} height={78} />)}
      </View>
      <View style={styles.wrap}>
        {[0, 1, 2, 3, 4].map((i) => <TSkeleton key={i} width={72} height={44} />)}
      </View>
    </View>
  );
}

export function SlotPicker({
  artistId, durationMin, durations, onDurationChange, value, onChange, max = 3, days = 28, emptyText,
}: SlotPickerProps) {
  const [slots, setSlots] = useState<FreeSlot[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [dayKey, setDayKey] = useState<string | null>(null);

  // Session length: the one picked in the switch, else the forced one, else the artist's first.
  const optionsKey = cleanDurations(durations).join(',');
  const options = useMemo(() => (optionsKey ? optionsKey.split(',').map(Number) : []), [optionsKey]);
  const [picked, setPicked] = useState<number | null>(null);
  const current: number | undefined = picked !== null && options.includes(picked)
    ? picked
    : durationMin !== undefined && (options.length === 0 || options.includes(durationMin))
      ? durationMin
      : options[0];
  // Defined only when the artist offers a choice of lengths.
  const switchDuration = options.length > 1 ? current : undefined;

  // Selections that vanish with a new duration are dropped once the new slots are known.
  const pruneAfterLoad = useRef(false);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  useEffect(() => { valueRef.current = value; onChangeRef.current = onChange; }, [value, onChange]);

  useEffect(() => {
    let active = true;
    setStatus('loading');
    // Undefined lets the data layer apply its own default length.
    fetchFreeSlots(artistId, days, current)
      .then((data) => {
        if (!active) return;
        setSlots(data);
        setStatus('ready');
        if (pruneAfterLoad.current) {
          pruneAfterLoad.current = false;
          const free = new Set(data.map((s) => s.start.getTime()));
          const kept = valueRef.current.filter((v) => free.has(instant(v)));
          if (kept.length !== valueRef.current.length) onChangeRef.current(kept);
        }
      })
      .catch(() => { if (active) setStatus('error'); });
    return () => { active = false; };
  }, [artistId, days, current, attempt]);

  const changeDuration = (min: number) => {
    if (min === current) return;
    pruneAfterLoad.current = valueRef.current.length > 0;
    setPicked(min);
    setDayKey(null);
    onDurationChange?.(min);
  };

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

  const durationSwitch = switchDuration !== undefined ? (
    <View style={styles.durationBlock}>
      <Kicker tone="muted">Durée de la séance</Kicker>
      <DurationSwitch durations={options} value={switchDuration} onChange={changeDuration} />
    </View>
  ) : null;

  let body: React.ReactNode;
  if (status === 'loading') {
    body = <PickerSkeleton />;
  } else if (status === 'error') {
    body = (
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
  } else if (groups.length === 0) {
    body = (
      <View style={styles.notice}>
        <Ionicons name="calendar-clear-outline" size={18} color={Colors.textTertiary} />
        <TText variant="bodySmall" color="secondary" style={{ flex: 1 }}>
          {emptyText ?? (switchDuration !== undefined
            ? `Aucun créneau libre de ${durationLabel(switchDuration)} sur les ${days} prochains jours. Essayez une autre durée, ou convenez d’une date avec l’artiste.`
            : 'Cet artiste n’a pas encore publié ses disponibilités. Vous conviendrez d’une date ensemble.')}
        </TText>
      </View>
    );
  } else {
    body = (
      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dayRow}
          accessibilityLabel="Jours disponibles"
        >
          {groups.map((g) => {
            const selected = g.key === activeDay?.key;
            const pickedCount = g.slots.filter((s) => chosen.has(s.start.getTime())).length;
            const label = `${capitalize(longDate.format(g.date))}, ${g.slots.length} créneau${g.slots.length > 1 ? 'x' : ''} libre${g.slots.length > 1 ? 's' : ''}${pickedCount ? `, ${pickedCount} choisi${pickedCount > 1 ? 's' : ''}` : ''}`;
            return (
              <Pressable
                key={g.key}
                onPress={() => setDayKey(g.key)}
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityState={{ selected }}
                style={(state) => {
                  const { pressed, hovered } = state as { pressed: boolean; hovered?: boolean };
                  return [styles.dayCell, (pressed || hovered) && !selected && styles.cellHover, selected && styles.dayCellSelected];
                }}
              >
                <TText variant="micro" uppercase style={{ color: selected ? Colors.onInkMuted : Colors.textTertiary }}>
                  {weekdayShort.format(g.date).replace('.', '')}
                </TText>
                <TText variant="displayS" tabular style={[styles.dayNum, { color: selected ? Colors.onInk : Colors.ink }]}>
                  {g.date.getDate()}
                </TText>
                <TText variant="micro" style={{ color: selected ? Colors.onInkMuted : Colors.textTertiary }}>
                  {monthShort.format(g.date).replace('.', '')}
                </TText>
                {pickedCount > 0 && (
                  <View style={[styles.badge, selected && styles.badgeOnSelected]}>
                    <TText variant="micro" tabular style={{ color: selected ? Colors.ink : '#FFFFFF', lineHeight: 12, letterSpacing: 0 }}>
                      {pickedCount}
                    </TText>
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>

        {activeDay && (
          <View style={styles.times}>
            <Kicker tone="muted" style={{ marginBottom: Spacing['2xs'] }}>
              {capitalize(longDate.format(activeDay.date))}
            </Kicker>
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
                    <TText variant="bodySmall" weight="medium" tabular style={{ color: selected ? Colors.onInk : Colors.ink }}>
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
            <TText variant="label" weight="bold" uppercase tabular color="tertiary" accessibilityLiveRegion="polite">
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
                  style={(state) => {
                    const { pressed, hovered } = state as { pressed: boolean; hovered?: boolean };
                    return [styles.chosenPill, (pressed || hovered) && styles.cellHover];
                  }}
                >
                  <TText variant="caption" tabular weight="medium">{formatChosenSlot(iso)}</TText>
                  <Ionicons name="close" size={13} color={Colors.ink} />
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </View>
    );
  }

  return (
    <View>
      {durationSwitch}
      {body}
    </View>
  );
}

const webPointer = Platform.OS === 'web'
  ? ({ cursor: 'pointer', transitionProperty: 'background-color, border-color', transitionDuration: '180ms' } as object)
  : null;

const styles = StyleSheet.create({
  durationBlock: { gap: Spacing['2xs'], marginBottom: Spacing.md },
  dayRow: { flexDirection: 'row', gap: 6, paddingRight: Spacing.sm },
  dayCell: {
    width: 58, minHeight: 78, paddingVertical: 10, alignItems: 'center', gap: 2,
    borderWidth: 1, borderColor: Colors.line, backgroundColor: Colors.white,
    ...webPointer,
  },
  dayCellSelected: { backgroundColor: Colors.ink, borderColor: Colors.ink },
  dayNum: { fontSize: 26, lineHeight: 28, letterSpacing: -0.4 },
  // A square vermilion tab in the corner: how many starts are chosen that day.
  badge: {
    position: 'absolute', top: 0, right: 0,
    minWidth: 16, height: 16, paddingHorizontal: 4,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.flame,
  },
  badgeOnSelected: { backgroundColor: Colors.paper },
  cellHover: { backgroundColor: Colors.wash, borderColor: Colors.ink },

  times: { marginTop: Spacing.md },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  timeChip: {
    minWidth: 72, minHeight: 44, paddingHorizontal: 12,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.line, backgroundColor: Colors.white,
    ...webPointer,
  },
  timeChipHover: { backgroundColor: Colors.wash, borderColor: Colors.ink },
  timeChipSelected: { backgroundColor: Colors.ink, borderColor: Colors.ink },

  chosen: {
    marginTop: Spacing.md, paddingTop: Spacing.sm, gap: Spacing['2xs'],
    borderTopWidth: 1, borderTopColor: Colors.line,
  },
  // Removable pills: the one rounded shape v5 allows for filters and selections.
  chosenPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    minHeight: 36, paddingHorizontal: 12, borderRadius: Radius.full,
    backgroundColor: 'transparent', borderWidth: 1, borderColor: Colors.ink,
    ...webPointer,
  },

  notice: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.xs,
    padding: Spacing.sm,
    borderWidth: 1, borderColor: Colors.line, backgroundColor: Colors.white,
  },
});
