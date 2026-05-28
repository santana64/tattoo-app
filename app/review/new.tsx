import React, { useState } from 'react';
import {
  View, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeIn, FadeInDown, FadeInUp,
  useSharedValue, useAnimatedStyle, withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Radius, GlowShadow, FontSize } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { GlassCard } from '@/components/ui/GlassCard';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth-store';

// ─── Constants ────────────────────────────────────────────────────────────────

const REVIEW_TAGS = [
  '✨ Résultat parfait',
  "👂 Super à l'écoute",
  '🧼 Très propre',
  '💸 Prix correct',
  '🔁 Je recommande',
  '⚡ Rapide',
];

const RATING_LABELS = [
  '',
  'Mauvais 😕',
  'Pas terrible 😐',
  'Correct 🙂',
  'Très bien 😊',
  'Excellent ! 🔥',
];

// ─── StarRating ───────────────────────────────────────────────────────────────

function StarButton({
  star,
  filled,
  onPress,
}: {
  star: number;
  filled: boolean;
  onPress: (star: number) => void;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animStyle}>
      <TouchableOpacity
        onPress={() => {
          scale.value = withSpring(1.45, { damping: 4, stiffness: 400 }, () => {
            scale.value = withSpring(1, { damping: 8 });
          });
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress(star);
        }}
        activeOpacity={1}
        hitSlop={6}
      >
        <Ionicons
          name={filled ? 'star' : 'star-outline'}
          size={38}
          color={filled ? Colors.accentGlow : Colors.textTertiary}
        />
      </TouchableOpacity>
    </Animated.View>
  );
}

function StarRating({
  rating,
  onChange,
}: {
  rating: number;
  onChange: (r: number) => void;
}) {
  return (
    <View style={starStyles.row}>
      {[1, 2, 3, 4, 5].map((star) => (
        <StarButton
          key={star}
          star={star}
          filled={star <= rating}
          onPress={onChange}
        />
      ))}
    </View>
  );
}

const starStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
});

// ─── SuccessView ──────────────────────────────────────────────────────────────

function SuccessView() {
  return (
    <View style={[styles.container, styles.successContainer]}>
      <Animated.View
        entering={FadeIn.duration(400)}
        style={{ alignItems: 'center' }}
      >
        <View style={styles.successIcon}>
          <LinearGradient
            colors={[Colors.accentGlow, Colors.accentWarm]}
            style={StyleSheet.absoluteFill}
          />
          <Ionicons name="checkmark" size={40} color={Colors.bgPrimary} />
        </View>
        <TText
          variant="title1"
          weight="bold"
          style={{ marginTop: Spacing.md, letterSpacing: -0.5 }}
        >
          Merci ! 🙏
        </TText>
        <TText
          variant="body"
          color="secondary"
          style={{ marginTop: Spacing.xs, textAlign: 'center', maxWidth: 260 }}
        >
          Ton avis aide la communauté INKR.
        </TText>
      </Animated.View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ReviewScreen() {
  const { appointmentId, artistId } = useLocalSearchParams<{ appointmentId: string; artistId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();

  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleTag = (tag: string) => {
    const next = new Set(selectedTags);
    next.has(tag) ? next.delete(tag) : next.add(tag);
    setSelectedTags(next);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSubmit = async () => {
    if (rating === 0 || isSubmitting) return;
    setIsSubmitting(true);

    // Persist to Supabase if we have real IDs
    if (appointmentId && artistId && user?.id && appointmentId.length > 20) {
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
        Alert.alert('Erreur', error.message);
        return;
      }
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSubmitted(true);
    setTimeout(() => router.back(), 1500);
  };

  if (submitted) return <SuccessView />;

  const canSubmit = rating > 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ── Header ── */}
      <Animated.View entering={FadeIn.duration(300)} style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <TText variant="title2" weight="bold">
          Laisser un avis
        </TText>
        <View style={{ width: 44 }} />
      </Animated.View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
      >
        {/* ── Star rating ── */}
        <Animated.View
          entering={FadeInDown.delay(100).springify()}
          style={styles.section}
        >
          <TText
            variant="title2"
            weight="bold"
            style={styles.sectionTitle}
          >
            Ton expérience
          </TText>
          <StarRating rating={rating} onChange={setRating} />
          {rating > 0 && (
            <Animated.View entering={FadeIn.duration(200)}>
              <TText
                variant="body"
                style={{
                  textAlign: 'center',
                  marginTop: Spacing.sm,
                  color: Colors.accentWarm,
                  fontWeight: '600',
                }}
              >
                {RATING_LABELS[rating]}
              </TText>
            </Animated.View>
          )}
        </Animated.View>

        {/* ── Tags ── */}
        <Animated.View
          entering={FadeInDown.delay(180).springify()}
          style={styles.section}
        >
          <TText
            variant="label"
            color="tertiary"
            uppercase
            style={styles.label}
          >
            Mots-clés
          </TText>
          <View style={styles.tagsGrid}>
            {REVIEW_TAGS.map((tag) => {
              const active = selectedTags.has(tag);
              return (
                <TouchableOpacity
                  key={tag}
                  onPress={() => toggleTag(tag)}
                  style={[styles.tag, active && styles.tagActive]}
                  activeOpacity={0.8}
                >
                  {active && (
                    <LinearGradient
                      colors={[
                        'rgba(212,168,100,0.15)',
                        'rgba(212,168,100,0.05)',
                      ]}
                      style={StyleSheet.absoluteFill}
                    />
                  )}
                  <TText
                    variant="caption"
                    style={{
                      color: active
                        ? Colors.accentWarm
                        : Colors.textSecondary,
                    }}
                  >
                    {tag}
                  </TText>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>

        {/* ── Written review ── */}
        <Animated.View
          entering={FadeInDown.delay(240).springify()}
          style={styles.section}
        >
          <TText
            variant="label"
            color="tertiary"
            uppercase
            style={styles.label}
          >
            Commentaire (optionnel)
          </TText>
          <GlassCard variant="default" style={{ padding: 0 }}>
            <TextInput
              style={styles.reviewInput}
              value={review}
              onChangeText={setReview}
              placeholder="Décris ton expérience avec cet artiste…"
              placeholderTextColor={Colors.textTertiary}
              multiline
              numberOfLines={4}
              maxLength={500}
              textAlignVertical="top"
            />
            <TText
              variant="micro"
              color="tertiary"
              style={styles.charCount}
            >
              {review.length}/500
            </TText>
          </GlassCard>
        </Animated.View>
      </ScrollView>

      {/* ── Submit footer ── */}
      <Animated.View
        entering={FadeInUp.delay(400).springify()}
        style={[
          styles.footer,
          { paddingBottom: insets.bottom + Spacing.md },
        ]}
      >
        <TouchableOpacity
          onPress={handleSubmit}
          activeOpacity={0.85}
          style={[styles.submitBtn, !canSubmit && { opacity: 0.45 }]}
          disabled={!canSubmit}
        >
          <LinearGradient
            colors={
              canSubmit
                ? [Colors.accentGlow, Colors.accentWarm, '#A06030']
                : [Colors.bgSubtle, Colors.bgSubtle]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <TText
            variant="body"
            weight="bold"
            style={{
              color: canSubmit ? Colors.bgPrimary : Colors.textTertiary,
            }}
          >
            Publier mon avis →
          </TText>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },

  successContainer: { alignItems: 'center', justifyContent: 'center' },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...GlowShadow.amberStrong,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing['2xs'],
    paddingBottom: Spacing.sm,
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },

  section: { paddingHorizontal: Spacing.sm, marginBottom: Spacing.md },
  sectionTitle: {
    textAlign: 'center',
    marginBottom: Spacing.lg,
    letterSpacing: -0.5,
  },
  label: {
    letterSpacing: 2,
    marginBottom: Spacing.xs,
    paddingHorizontal: Spacing['2xs'],
  },

  tagsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    overflow: 'hidden',
  },
  tagActive: { borderColor: Colors.accentWarm },

  reviewInput: {
    color: Colors.textPrimary,
    fontSize: FontSize.body,
    lineHeight: 24,
    padding: Spacing.sm,
    minHeight: 100,
  },
  charCount: {
    textAlign: 'right',
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing['2xs'],
  },

  footer: {
    paddingHorizontal: Spacing.sm,
    paddingTop: 8,
    backgroundColor: Colors.bgPrimary,
  },
  submitBtn: {
    height: 56,
    borderRadius: Radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...GlowShadow.amber,
  },
});
