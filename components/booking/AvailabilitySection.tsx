import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Colors, Spacing } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TSkeleton } from '@/components/ui/TSkeleton';
import { Kicker, TextLink } from '@/components/v5';
import { fetchFreeSlots, formatSlotTime, groupSlotsByDay, type FreeSlot } from '@/lib/studio';
import { fetchBookingSettings } from '@/lib/care';
import { DurationSwitch, cleanDurations } from './DurationSwitch';

interface AvailabilitySectionProps {
  artistId: string;
  /** Opens the full picker (usually the request form). Hidden when absent. */
  onPick?: () => void;
  /**
   * Session lengths the artist offers. When omitted they are read from the
   * artist's booking settings. More than one shows a duration switch.
   */
  durations?: number[];
}

const DAYS_SHOWN = 3;
const TIMES_SHOWN = 4;

const shortDate = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
const longDate = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

function SectionSkeleton() {
  return (
    <View style={styles.section}>
      <TSkeleton width={90} height={10} />
      <TSkeleton width="55%" height={28} style={{ marginTop: Spacing.xs, marginBottom: Spacing.md }} />
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.row}>
          <TSkeleton width={84} height={14} />
          <View style={[styles.times, { flex: 1 }]}>
            {[0, 1, 2].map((j) => <TSkeleton key={j} width={56} height={30} />)}
          </View>
        </View>
      ))}
    </View>
  );
}

/** Next free slots on a public profile. Renders nothing when there is nothing to show. */
export function AvailabilitySection({ artistId, onPick, durations }: AvailabilitySectionProps) {
  const [slots, setSlots] = useState<FreeSlot[] | null>(null);
  const [failed, setFailed] = useState(false);

  // Durations: given by the parent, else the artist's own settings (null while unknown).
  const givenKey = durations ? cleanDurations(durations).join(',') : null;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  useEffect(() => {
    if (givenKey !== null) return;
    let active = true;
    setLoadedKey(null);
    fetchBookingSettings(artistId)
      .then((s) => { if (active) setLoadedKey(cleanDurations(s?.sessionDurations).join(',')); })
      // Without settings the slots still load, at the default length.
      .catch(() => { if (active) setLoadedKey(''); });
    return () => { active = false; };
  }, [artistId, givenKey]);
  const optionsKey = givenKey ?? loadedKey;
  const options = useMemo(() => (optionsKey ? optionsKey.split(',').map(Number) : []), [optionsKey]);
  const [picked, setPicked] = useState<number | null>(null);
  const current = picked !== null && options.includes(picked) ? picked : options[0];

  useEffect(() => {
    if (optionsKey === null) return;
    let active = true;
    setSlots(null); setFailed(false);
    fetchFreeSlots(artistId, undefined, current)
      .then((data) => { if (active) setSlots(data); })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [artistId, optionsKey, current]);

  const days = useMemo(() => (slots ? groupSlotsByDay(slots).slice(0, DAYS_SHOWN) : []), [slots]);

  const hasChoice = options.length > 1 && current !== undefined;
  if (failed) return null;
  if (slots === null && !hasChoice) return <SectionSkeleton />;
  // With a single length, an empty agenda shows nothing; with several, the switch stays usable.
  if (slots !== null && days.length === 0 && !hasChoice) return null;

  return (
    <View style={styles.section}>
      <Kicker tone="flame">Disponibilités</Kicker>
      <TText variant="displayS" accessibilityRole="header" style={[styles.titleType, styles.title]}>
        Prochains <TText variant="displayS" italic color="accentGlow" style={styles.titleType}>créneaux.</TText>
      </TText>

      {hasChoice && current !== undefined && (
        <DurationSwitch durations={options} value={current} onChange={setPicked} style={styles.switch} />
      )}

      {slots === null && (
        <View style={{ gap: 6 }}>
          {[0, 1, 2].map((i) => <TSkeleton key={i} height={30} />)}
        </View>
      )}
      {slots !== null && days.length === 0 && (
        <TText variant="bodySmall" color="secondary" style={styles.empty}>
          Aucun créneau libre pour cette durée dans les semaines à venir.
        </TText>
      )}

      {days.map((d, i) => {
        const shown = d.slots.slice(0, TIMES_SHOWN);
        const more = d.slots.length - shown.length;
        const times = shown.map((s) => formatSlotTime(s.start));
        const a11y = `${longDate.format(d.date)} : ${times.join(', ')}${more > 0 ? `, et ${more} autre${more > 1 ? 's' : ''}` : ''}`;
        return (
          <View key={d.key} style={[styles.row, i === days.length - 1 && styles.rowLast]} accessible accessibilityLabel={a11y}>
            <TText variant="bodySmall" weight="medium" tabular style={styles.date}>{shortDate.format(d.date)}</TText>
            <View style={[styles.times, { flex: 1 }]}>
              {times.map((t) => (
                <View key={t} style={styles.chip}>
                  <TText variant="caption" weight="medium" tabular>{t}</TText>
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
        <TextLink label="Voir tous les créneaux" onPress={onPick} style={styles.link} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingVertical: Spacing.lg },
  title: { marginTop: Spacing['2xs'], marginBottom: Spacing.md },
  titleType: { fontSize: 32, lineHeight: 34, letterSpacing: -0.6 },
  switch: { marginBottom: Spacing.sm },
  empty: { paddingVertical: 10 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: Colors.line,
  },
  rowLast: { borderBottomWidth: 1, borderBottomColor: Colors.line },
  date: { width: 96 },
  times: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    minWidth: 56, height: 30, paddingHorizontal: 8,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.line, backgroundColor: Colors.white,
  },
  chipMore: { minWidth: 40, backgroundColor: 'transparent' },
  link: { alignSelf: 'flex-start', minHeight: 44, marginTop: Spacing['2xs'] },
});
