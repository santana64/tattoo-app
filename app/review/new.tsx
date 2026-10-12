import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Layout } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TInput } from '@/components/ui/TInput';
import { TButton } from '@/components/ui/TButton';
import { THeader } from '@/components/ui/THeader';
import { TAvatar } from '@/components/ui/TAvatar';
import { PressableScale, GlassSurface, enterUp, EASE_OUT } from '@/components/motion';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth-store';
import { useArtist } from '@/hooks/use-artist';

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

// ─── Stars ────────────────────────────────────────────────────────────────────
function StarRating({ rating, onChange }: { rating: number; onChange: (r: number) => void }) {
  return (
    <View style={styles.stars} accessibilityRole="radiogroup" accessibilityLabel="Note">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= rating;
        return (
          <PressableScale
            key={star}
            pressedScale={0.92}
            onPress={() => onChange(star)}
            accessibilityRole="radio"
            accessibilityState={{ checked: rating === star, selected: rating === star }}
            accessibilityLabel={`${star} étoile${star > 1 ? 's' : ''} sur 5, ${RATING_LABELS[star].toLowerCase()}`}
            hitSlop={4}
            style={styles.star}
          >
            <Ionicons name={filled ? 'star' : 'star-outline'} size={32} color={filled ? Colors.accentGlow : Colors.textTertiary} />
          </PressableScale>
        );
      })}
    </View>
  );
}

// ─── Success (rare moment) ────────────────────────────────────────────────────
function SuccessView() {
  const reduced = useReducedMotion();
  const ring = useSharedValue(0);
  useEffect(() => {
    ring.set(withDelay(reduced ? 0 : 80, withTiming(1, { duration: reduced ? 200 : 700, easing: EASE_OUT })));
  }, [reduced, ring]);
  const ringStyle = useAnimatedStyle(() => ({
    opacity: ring.get(),
    transform: [{ scale: reduced ? 1 : 0.86 + ring.get() * 0.14 }],
  }));
  return (
    <View style={[styles.container, styles.success]}>
      <Animated.View style={[styles.successRing, ringStyle]}>
        <Ionicons name="star" size={26} color={Colors.accentGlow} />
      </Animated.View>
      <Animated.View entering={enterUp(0, 220)} style={{ alignItems: 'center' }}>
        <TText variant="displayM" style={{ textAlign: 'center' }} accessibilityRole="header" accessibilityLiveRegion="polite">
          Merci pour <TText variant="displayM" italic color="accentGlow">votre avis</TText>
        </TText>
        <TText variant="body" color="secondary" style={{ textAlign: 'center', marginTop: Spacing.xs, maxWidth: 360 }}>
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
        contentContainerStyle={[styles.body, { paddingBottom: Spacing['2xl'] }]}
      >
        <Animated.View entering={enterUp(0)} style={styles.hero}>
          {artist && (
            <View style={styles.artistRow}>
              <TAvatar uri={artist.avatarUrl} name={artist.blaze} size="sm" />
              <TText variant="caption" color="secondary">Votre séance avec {artist.blaze}</TText>
            </View>
          )}
          <TText variant="displayS" accessibilityRole="header">
            Comment s’est passée <TText variant="displayS" italic color="accentGlow">votre séance</TText>{' '}?
          </TText>
        </Animated.View>

        <Animated.View entering={enterUp(1)} style={styles.section}>
          <StarRating rating={rating} onChange={setRating} />
          <TText variant="bodySmall" weight="medium" color={rating ? 'accentGlow' : 'tertiary'} style={styles.ratingLabel} accessibilityLiveRegion="polite">
            {rating ? RATING_LABELS[rating] : 'Touchez une étoile pour noter'}
          </TText>
        </Animated.View>

        <Animated.View entering={enterUp(2)} style={styles.section}>
          <TText variant="caption" weight="medium" color="secondary" style={{ marginBottom: Spacing.xs }}>
            Ce que vous avez apprécié <TText variant="caption" color="tertiary">· optionnel</TText>
          </TText>
          <View style={styles.tags}>
            {REVIEW_TAGS.map((tag) => {
              const active = selectedTags.has(tag);
              return (
                <Pressable
                  key={tag}
                  onPress={() => toggleTag(tag)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: active }}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <TText variant="caption" weight="medium" style={{ fontSize: 13, color: active ? Colors.textInverse : Colors.textSecondary }}>
                    {tag}
                  </TText>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>

        <Animated.View entering={enterUp(3)} style={styles.section}>
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
        </Animated.View>
      </ScrollView>

      <GlassSurface style={[styles.bar, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.barInner}>
          {!!submitError && (
            <View style={styles.errorRow} accessibilityRole="alert" accessibilityLiveRegion="assertive">
              <Ionicons name="alert-circle-outline" size={16} color={Colors.errorLight} />
              <TText variant="caption" style={{ color: Colors.errorLight, flex: 1 }}>{submitError}</TText>
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
  body: {
    width: '100%', maxWidth: FORM_MAX + Layout.gutter * 2, alignSelf: 'center',
    paddingHorizontal: Layout.gutter,
  },

  hero: { paddingTop: Spacing.lg, paddingBottom: Spacing.md, gap: Spacing.sm },
  artistRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing['2xs'] },

  section: {
    paddingVertical: Spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.borderDefault,
  },
  stars: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  star: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  ratingLabel: { textAlign: 'center', marginTop: Spacing.xs },

  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    height: 36, paddingHorizontal: 14, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.borderDefault,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } as object : null),
  },
  chipActive: { backgroundColor: Colors.accentAction, borderColor: Colors.accentAction },

  bar: {
    paddingTop: 12, paddingHorizontal: Layout.gutter,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.borderDefault,
  },
  barInner: { width: '100%', maxWidth: FORM_MAX, alignSelf: 'center', gap: Spacing['2xs'] },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  success: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: Layout.gutter },
  successRing: {
    width: 76, height: 76, borderRadius: 38, marginBottom: Spacing.lg,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderGlow, backgroundColor: Colors.glassAmber,
  },
});

