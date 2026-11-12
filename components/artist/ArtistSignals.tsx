import React from 'react';
import { StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, Radius } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { formatCount, formatNextSlot, formatRating, type ArtistStats } from '@/lib/studio';

interface ArtistSignalsProps {
  stats?: ArtistStats | null;
  /** Cards: rating, next slot and flashes only, at caption size. */
  compact?: boolean;
}

const plural = (n: number, one: string, many: string) => (n > 1 ? many : one);

/** Which signals are worth showing; nothing is invented for an artist without numbers. */
function readSignals(stats: ArtistStats, compact: boolean) {
  return {
    rating: stats.ratingCount > 0 && stats.ratingAvg !== null ? formatRating(stats.ratingAvg) : null,
    nextSlot: formatNextSlot(stats.nextSlot),
    hasFlashes: stats.flashCount > 0,
    hasFollowers: !compact && stats.followers > 0,
  };
}

/** True when <ArtistSignals> would render something: lets a parent skip its spacing. */
export function hasArtistSignals(stats: ArtistStats | null | undefined, compact = false): stats is ArtistStats {
  if (!stats) return false;
  const s = readSignals(stats, compact);
  return !!s.rating || !!s.nextSlot || s.hasFlashes || s.hasFollowers;
}

/** One sentence for screen readers, e.g. "Note 4,8 sur 5, 12 avis. Disponible demain." */
export function describeArtistSignals(stats: ArtistStats | null | undefined, compact = false): string {
  if (!hasArtistSignals(stats, compact)) return '';
  const s = readSignals(stats, compact);
  const spoken: string[] = [];
  if (s.rating) spoken.push(`Note ${s.rating} sur 5, ${stats.ratingCount} avis`);
  if (s.nextSlot) spoken.push(`Disponible ${s.nextSlot}`);
  if (s.hasFlashes) {
    spoken.push(`${stats.flashCount} ${plural(stats.flashCount, 'flash disponible', 'flashs disponibles')}`);
  }
  if (s.hasFollowers) {
    spoken.push(`${formatCount(stats.followers)} ${plural(stats.followers, 'abonné', 'abonnés')}`);
  }
  return `${spoken.join('. ')}.`;
}

/** Public numbers in one quiet line: rating, next free slot, flashes, followers. */
export function ArtistSignals({ stats, compact = false }: ArtistSignalsProps) {
  if (!hasArtistSignals(stats, compact)) return null;

  const { rating, nextSlot, hasFlashes, hasFollowers } = readSignals(stats, compact);
  const variant = compact ? 'caption' : 'bodySmall';
  const iconSize = compact ? 12 : 14;

  return (
    <View
      style={[styles.row, compact && styles.rowCompact]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={describeArtistSignals(stats, compact)}
    >
      {rating && (
        <View style={styles.item}>
          <Ionicons name="star" size={iconSize} color={Colors.accentWarm} />
          <TText variant={variant} weight="medium" tabular>{rating}</TText>
          <TText variant={variant} color="tertiary" tabular>({stats.ratingCount})</TText>
        </View>
      )}
      {nextSlot && (
        <View style={styles.item}>
          <View style={styles.dot} />
          <TText variant={variant} color="secondary" numberOfLines={1}>Dispo {nextSlot}</TText>
        </View>
      )}
      {hasFlashes && (
        <TText variant={variant} color="secondary" tabular numberOfLines={1}>
          {stats.flashCount} {plural(stats.flashCount, 'flash', 'flashs')}
        </TText>
      )}
      {hasFollowers && (
        <TText variant={variant} color="secondary" tabular numberOfLines={1}>
          {formatCount(stats.followers)} {plural(stats.followers, 'abonné', 'abonnés')}
        </TText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Wraps rather than truncates: a narrow card gets a second line, never an overflow.
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 16, rowGap: 4 },
  rowCompact: { columnGap: 12, rowGap: 2 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 },
  dot: { width: 6, height: 6, borderRadius: Radius.full, backgroundColor: Colors.moss },
});
