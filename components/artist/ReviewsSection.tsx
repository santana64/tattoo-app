import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Colors, Spacing } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TAvatar } from '@/components/ui/TAvatar';
import { TSkeleton } from '@/components/ui/TSkeleton';
import { TStarRating } from '@/components/ui/TStarRating';
import { Kicker, SectionHead } from '@/components/v5';
import { fetchArtistReviews, formatRating, type PublicReview } from '@/lib/studio';

interface ReviewsSectionProps {
  artistId: string;
  ratingAvg: number | null;
  ratingCount: number;
}

const DAY_MS = 86_400_000;
const sameYearFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
const otherYearFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

/** "aujourd’hui", "il y a 3 jours", "12 oct.", "12 oct. 2024". */
function formatReviewDate(value: string | null, now = new Date()): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const that = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const days = Math.round((today - that) / DAY_MS);
  if (days <= 0) return 'aujourd’hui';
  if (days === 1) return 'hier';
  if (days < 7) return `il y a ${days} jours`;
  return (date.getFullYear() === now.getFullYear() ? sameYearFmt : otherYearFmt).format(date);
}

function ReviewRow({ review, index }: { review: PublicReview; index: number }) {
  const date = formatReviewDate(review.createdAt);
  return (
    <View style={styles.review}>
      <TText variant="label" weight="bold" tabular style={styles.number}>{String(index + 1).padStart(2, '0')}</TText>
      <View style={styles.reviewMain}>
        <View style={styles.reviewHead}>
          <TAvatar uri={review.avatarUrl} name={review.author} size="sm" />
          <View style={styles.reviewMeta}>
            <TText variant="bodySmall" weight="semibold" numberOfLines={1}>{review.author}</TText>
            <View style={styles.reviewSub}>
              <TStarRating value={review.rating} readonly size={12} />
              {date && <TText variant="caption" color="tertiary" numberOfLines={1}>{date}</TText>}
            </View>
          </View>
        </View>
        {!!review.comment?.trim() && (
          <TText variant="title2" serif style={styles.comment}>« {review.comment.trim()} »</TText>
        )}
      </View>
    </View>
  );
}

function ReviewsSkeleton() {
  return (
    <View accessibilityLabel="Chargement des avis">
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.review}>
          <TSkeleton width={20} height={10} radius={0} />
          <View style={styles.reviewMain}>
            <View style={styles.reviewHead}>
              <TSkeleton width={32} height={32} radius={0} />
              <View style={{ flex: 1, gap: 6 }}>
                <TSkeleton width="35%" height={12} radius={0} />
                <TSkeleton width="25%" height={10} radius={0} />
              </View>
            </View>
            <TSkeleton width="90%" height={14} radius={0} style={{ marginTop: Spacing.xs }} />
            <TSkeleton width="70%" height={14} radius={0} style={{ marginTop: 6 }} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Public reviews of an artist, laid out like a page of press notices. */
export function ReviewsSection({ artistId, ratingAvg, ratingCount }: ReviewsSectionProps) {
  const [reviews, setReviews] = useState<PublicReview[] | null>(null);

  useEffect(() => {
    if (ratingCount === 0) return;
    let active = true;
    setReviews(null);
    fetchArtistReviews(artistId, 6)
      .then((rows) => { if (active) setReviews(rows); })
      // Silent: the header already carries the rating, the list is a bonus.
      .catch(() => { if (active) setReviews([]); });
    return () => { active = false; };
  }, [artistId, ratingCount]);

  if (ratingCount === 0) return null;

  const countLabel = `${ratingCount} avis ${ratingCount > 1 ? 'vérifiés' : 'vérifié'}`;
  return (
    <View>
      <SectionHead kicker="Avis" title="Ce qu’en disent" emphasis="les clients." />

      <View
        style={styles.summary}
        accessible
        accessibilityRole="summary"
        accessibilityLabel={ratingAvg !== null
          ? `Note moyenne ${formatRating(ratingAvg)} sur 5, ${countLabel}`
          : countLabel}
      >
        {ratingAvg !== null && (
          <TText variant="displayXL" tabular style={styles.average}>{formatRating(ratingAvg)}</TText>
        )}
        <View style={styles.summaryText}>
          {ratingAvg !== null && <TStarRating value={ratingAvg} readonly size={16} />}
          <Kicker tone="ink">{countLabel}</Kicker>
          <TText variant="caption" color="secondary">Chaque avis suit une séance réalisée via Inkr.</TText>
        </View>
      </View>

      {reviews === null ? (
        <ReviewsSkeleton />
      ) : (
        <View style={styles.list}>
          {reviews.map((review, i) => <ReviewRow key={review.id} review={review} index={i} />)}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  summary: {
    flexDirection: 'row', alignItems: 'flex-end', flexWrap: 'wrap', gap: Spacing.md,
    paddingBottom: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.ink,
  },
  average: { fontSize: 88, lineHeight: 84, letterSpacing: -3, color: Colors.ink },
  summaryText: { gap: 6, paddingBottom: 8, flexShrink: 1, minWidth: 180 },
  list: { maxWidth: 820 },

  review: {
    flexDirection: 'row', gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.line,
  },
  number: { width: 28, color: Colors.textTertiary, paddingTop: 2 },
  reviewMain: { flex: 1, minWidth: 0 },
  reviewHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  reviewMeta: { flex: 1, gap: 4, minWidth: 0 },
  reviewSub: { flexDirection: 'row', alignItems: 'center', gap: Spacing['2xs'] },
  comment: { marginTop: Spacing.xs, maxWidth: 640 },
});
