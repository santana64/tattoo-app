import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Radius } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TInput } from '@/components/ui/TInput';
import { TButton } from '@/components/ui/TButton';
import { THeader } from '@/components/ui/THeader';
import { TAvatar } from '@/components/ui/TAvatar';
import { EditorialTitle, Kicker } from '@/components/v5';
import { GlassSurface, enterUp } from '@/components/motion';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth-store';
import { useArtist } from '@/hooks/use-artist';
import { useContentDimensions } from '@/hooks/useContentDimensions';

const FORM_MAX = 720;
const MAX_LENGTH = 500;

const REVIEW_TAGS = [
  'Résultat parfait',
  'Très à l’écoute',
  'Très propre',
  'Prix juste',
  'Je recommande',
  'Rapide',
];

const RATING_LABELS = ['', 'Décevant', 'Moyen', 'Correct', 'Très bien', 'Excellent'];

type Hover = { pressed: boolean; hovered?: boolean };
const webPointer = Platform.OS === 'web'
  ? ({ cursor: 'pointer', transitionProperty: 'background-color, border-color', transitionDuration: '180ms' } as object)
  : null;

// ─── Stars ────────────────────────────────────────────────────────────────────
function StarRating({ rating, onChange }: { rating: number; onChange: (r: number) => void }) {
  return (
    <View style={styles.stars} accessibilityRole="radiogroup" accessibilityLabel="Note">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= rating;
        return (
          <Pressable
            key={star}
            onPress={() => onChange(star)}
            accessibilityRole="radio"
            accessibilityState={{ checked: rating === star, selected: rating === star }}
            aria-checked={Platform.OS === 'web' ? rating === star : undefined}
            accessibilityLabel={`${star} étoile${star > 1 ? 's' : ''} sur 5, ${RATING_LABELS[star].toLowerCase()}`}
            hitSlop={4}
            style={(state) => [styles.star, ((state as Hover).hovered || state.pressed) && styles.starHover]}
          >
            <Ionicons name={filled ? 'star' : 'star-outline'} size={30} color={filled ? Colors.flame : Colors.metal} />
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Success (rare moment) ────────────────────────────────────────────────────
function SuccessView() {
  return (
    <View style={[styles.container, styles.success]}>
      <Animated.View entering={enterUp(0, 120)} style={{ alignItems: 'center', gap: Spacing.sm }}>
        <Kicker tone="flame">Avis publié</Kicker>
        <View accessibilityLiveRegion="polite">
          <EditorialTitle emphasis="votre avis." breakEmphasis style={{ textAlign: 'center' }}>Merci pour</EditorialTitle>
        </View>
        <View style={styles.successRule} />
        <TText variant="body" color="secondary" style={{ textAlign: 'center', maxWidth: 360 }}>
          Il aide d’autres clients à choisir leur artiste.
        </TText>
      </Animated.View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function ReviewScreen() {
  const { appointmentId, artistId: artistParam } = useLocalSearchParams<{ appointmentId: string; artistId: string }>();
  // Callers may pass only the appointment: resolve its artist (readable by the client via RLS).
  const [artistId, setArtistId] = useState<string | undefined>(artistParam);
  useEffect(() => {
    if (artistParam || !appointmentId) return;
    let active = true;
    void supabase.from('appointments').select('artist_id').eq('id', appointmentId).maybeSingle()
      .then(({ data }) => { if (active && data?.artist_id) setArtistId(data.artist_id); });
    return () => { active = false; };
  }, [appointmentId, artistParam]);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { gutter, isWide } = useContentDimensions();
  const { user } = useAuthStore();
  const { artist } = useArtist(artistId ?? '');

  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const toggleTag = (tag: string) => {
    const next = new Set(selectedTags);
    if (next.has(tag)) next.delete(tag); else next.add(tag);
    setSelectedTags(next);
  };

  const handleSubmit = async () => {
    if (rating === 0 || isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError(null);

    // Never report success without a stored review.
    if (!appointmentId || !artistId || !user?.id) {
      setIsSubmitting(false);
      setSubmitError('Ce rendez-vous est introuvable : votre avis ne peut pas être publié.');
      return;
    }
    {
      const comment = [review, ...(selectedTags.size > 0 ? [`Tags: ${[...selectedTags].join(', ')}`] : [])].filter(Boolean).join('\n');
      const { error } = await supabase.from('reviews').insert({
        appointment_id: appointmentId,
        artist_id: artistId,
        client_id: user.id,
        rating,
        comment: comment || null,
        is_public: true,
      });
      if (error) {
        setIsSubmitting(false);
        if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setSubmitError('Votre avis n’a pas été publié. Vérifiez votre connexion puis réessayez.');
        return;
      }
    }

    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSubmitted(true);
    setTimeout(() => router.back(), 1500);
  };

  if (submitted) return <SuccessView />;

  const canSubmit = rating > 0;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <THeader showBack title="Laisser un avis" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.body, { paddingHorizontal: gutter, paddingBottom: Spacing['2xl'] }]}
      >
        <View style={[styles.hero, isWide && { paddingTop: Spacing['2xl'] }]}>
          {artist ? (
            <View style={styles.artistRow}>
              <TAvatar uri={artist.avatarUrl} name={artist.blaze} size="sm" />
              <Kicker>{`Votre séance avec ${artist.blaze}`}</Kicker>
            </View>
          ) : (
            <Kicker>Après la séance</Kicker>
          )}
          <EditorialTitle emphasis={'votre séance ?'}>Comment s’est passée</EditorialTitle>
        </View>

        <View style={styles.section}>
          <Kicker tone="flame" style={styles.sectionKicker}>01 · Votre note</Kicker>
          <StarRating rating={rating} onChange={setRating} />
          <TText
            variant="label"
            weight="bold"
            uppercase
            color={rating ? 'accentWarm' : 'tertiary'}
            style={styles.ratingLabel}
            accessibilityLiveRegion="polite"
          >
            {rating ? RATING_LABELS[rating] : 'Touchez une étoile pour noter'}
          </TText>
        </View>

        <View style={styles.section}>
          <Kicker tone="flame" style={styles.sectionKicker}>02 · Ce que vous avez apprécié</Kicker>
          <TText variant="caption" color="tertiary" style={{ marginBottom: Spacing.xs }}>Optionnel</TText>
          <View style={styles.tags}>
            {REVIEW_TAGS.map((tag) => {
              const active = selectedTags.has(tag);
              return (
                <Pressable
                  key={tag}
                  onPress={() => toggleTag(tag)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: active }}
                  aria-checked={Platform.OS === 'web' ? active : undefined}
                  hitSlop={4}
                  style={(state) => [styles.chip, ((state as Hover).hovered || state.pressed) && !active && styles.chipHover, active && styles.chipActive]}
                >
                  <TText variant="caption" weight="semibold" style={{ fontSize: 12.5, lineHeight: 16, color: active ? Colors.paper : Colors.ink }}>
                    {tag}
                  </TText>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Kicker tone="flame" style={styles.sectionKicker}>03 · Votre retour</Kicker>
          <TInput
            label="Commentaire"
            optional
            value={review}
            onChangeText={setReview}
            placeholder="Accueil, déroulé de la séance, cicatrisation…"
            multiline
            numberOfLines={4}
            maxLength={MAX_LENGTH}
            textAlignVertical="top"
            helper={`${review.length} / ${MAX_LENGTH}`}
            inputStyle={{ minHeight: 120, paddingTop: 14 }}
            containerStyle={{ marginBottom: 0 }}
          />
        </View>
      </ScrollView>

      <GlassSurface style={[styles.bar, { paddingBottom: insets.bottom + 12, paddingHorizontal: gutter }]}>
        <View style={styles.barInner}>
          {!!submitError && (
            <View style={styles.errorRow} accessibilityRole="alert" accessibilityLiveRegion="assertive">
              <Ionicons name="alert-circle-outline" size={16} color={Colors.error} />
              <TText variant="caption" style={{ color: Colors.error, flex: 1 }}>{submitError}</TText>
            </View>
          )}
          {!canSubmit && !submitError && (
            <TText variant="caption" color="tertiary" style={{ textAlign: 'center' }}>Choisissez une note pour publier.</TText>
          )}
          <TButton
            title={submitError ? 'Réessayer' : 'Publier l’avis'}
            onPress={handleSubmit}
            loading={isSubmitting}
            disabled={!canSubmit}
          />
        </View>
      </GlassSurface>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  body: { width: '100%', maxWidth: FORM_MAX + 112, alignSelf: 'center' },

  hero: { paddingTop: Spacing.lg, paddingBottom: Spacing.xl, gap: Spacing.sm },
  artistRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing['2xs'] },

  section: {
    paddingTop: Spacing.lg, paddingBottom: Spacing.xl,
    borderTopWidth: 1, borderTopColor: Colors.line,
  },
  sectionKicker: { marginBottom: Spacing.md },
  stars: { flexDirection: 'row', gap: 6 },
  star: {
    width: 52, height: 52, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.line,
    ...webPointer,
  },
  starHover: { backgroundColor: Colors.wash, borderColor: Colors.ink },
  ratingLabel: { marginTop: Spacing.sm },

  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 36, paddingHorizontal: 14, borderRadius: Radius.full,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.line,
    ...webPointer,
  },
  chipHover: { backgroundColor: Colors.wash, borderColor: Colors.ink },
  chipActive: { backgroundColor: Colors.ink, borderColor: Colors.ink },

  bar: {
    paddingTop: 12,
    borderTopWidth: 1, borderTopColor: Colors.line,
  },
  barInner: { width: '100%', maxWidth: FORM_MAX, alignSelf: 'center', gap: Spacing['2xs'] },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  success: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  successRule: { width: 96, height: 1, backgroundColor: Colors.flame, marginVertical: Spacing.xs },
});
