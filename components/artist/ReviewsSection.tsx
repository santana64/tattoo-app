import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Colors, Spacing } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TAvatar } from '@/components/ui/TAvatar';
import { TSkeleton } from '@/components/ui/TSkeleton';
import { TStarRating } from '@/components/ui/TStarRating';
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

function ReviewRow({ review }: { review: PublicReview }) {
  const date = formatReviewDate(review.createdAt);
  return (
    <View style={styles.review}>
      <View style={styles.reviewHead}>
        <TAvatar uri={review.avatarUrl} name={review.author} size="sm" />
        <View style={styles.reviewMeta}>
          <TText variant="bodySmall" weight="medium" numberOfLines={1}>{review.author}</TText>
          <View style={styles.reviewSub}>
            <TStarRating value={review.rating} readonly size={12} />
            {date && <TText variant="caption" color="tertiary" numberOfLines={1}>{date}</TText>}
          </View>
        </View>
      </View>
      {!!review.comment?.trim() && (
        <TText variant="body" color="secondary" style={styles.comment}>{review.comment.trim()}</TText>
      )}
    </View>
  );
}

function ReviewsSkeleton() {
  return (
    <View accessibilityLabel="Chargement des avis">
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.review}>
          <View style={styles.reviewHead}>
            <TSkeleton width={32} height={32} radius={16} />
            <View style={{ flex: 1, gap: 6 }}>
              <TSkeleton width="35%" height={12} />
              <TSkeleton width="25%" height={10} />
            </View>
          </View>
          <TSkeleton width="90%" height={12} style={{ marginTop: Spacing.xs }} />
          <TSkeleton width="70%" height={12} style={{ marginTop: 6 }} />
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
    <View style={styles.section}>
      <TText variant="label" color="accentWarm" uppercase>Avis</TText>

      <View
        style={styles.summary}
        accessible
        accessibilityRole="summary"
        accessibilityLabel={ratingAvg !== null
          ? `Note moyenne ${formatRating(ratingAvg)} sur 5, ${countLabel}`
          : countLabel}
      >
        {ratingAvg !== null && (
          <TText variant="displayL" tabular style={styles.average}>{formatRating(ratingAvg)}</TText>
        )}
        <View style={styles.summaryText}>
          {ratingAvg !== null && <TStarRating value={ratingAvg} readonly size={16} />}
          <TText variant="bodySmall" color="secondary" tabular>{countLabel}</TText>
        </View>
      </View>
      <TText variant="caption" color="tertiary" style={styles.caption}>
        Chaque avis suit une séance réalisée via Inkr.
      </TText>

      {reviews === null ? (
        <ReviewsSkeleton />
      ) : (
        reviews.map((review) => <ReviewRow key={review.id} review={review} />)
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: Spacing.sm },
  summary: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm, marginTop: Spacing.xs },
  average: { lineHeight: 50 },
  summaryText: { gap: 4, paddingBottom: 6 },
  caption: { marginTop: Spacing['2xs'], marginBottom: Spacing.xs },

  review: {
    paddingVertical: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderDefault,
  },
  reviewHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  reviewMeta: { flex: 1, gap: 2 },
  reviewSub: { flexDirection: 'row', alignItems: 'center', gap: Spacing['2xs'] },
  comment: { marginTop: Spacing.xs },
});
