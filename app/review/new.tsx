import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Radius } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TButton } from '@/components/ui/TButton';
import { TInput } from '@/components/ui/TInput';
import { TStarRating } from '@/components/ui/TStarRating';
import { useAuthStore } from '@/store/auth-store';
import { supabase } from '@/lib/supabase';
import { Toast } from '@/components/ui/TToast';
import { Ionicons } from '@expo/vector-icons';

export default function NewReviewScreen() {
  const { appointmentId, artistId, artistName } = useLocalSearchParams<{
    appointmentId: string;
    artistId: string;
    artistName: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleRating = (r: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRating(r);
  };

  const handleSubmit = async () => {
    if (!rating || !user?.id) return;
    setLoading(true);
    const { error } = await supabase.from('reviews').insert({
      appointment_id: appointmentId,
      artist_id: artistId,
      client_id: user.id,
      rating,
      comment: comment.trim() || null,
      is_public: isPublic,
    });
    setLoading(false);
    if (error) {
      Toast.error('Impossible d\'envoyer l\'avis.');
    } else {
      Toast.success('Avis envoyé — merci !');
      router.back();
    }
  };

  const STARS_TEXT = ['', 'Décevant', 'Passable', 'Bien', 'Très bien', 'Exceptionnel'];

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <TText variant="title2">Laisser un avis</TText>
        <View style={{ width: 44 }} />
      </View>

      <Animated.View entering={FadeIn.delay(100)} style={styles.artistSection}>
        <TText variant="title2" weight="bold" style={styles.artistName}>{artistName}</TText>
        <TText variant="bodySmall" color="secondary">Comment s'est passée votre séance ?</TText>
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(200).springify()} style={styles.ratingSection}>
        <TStarRating value={rating} onChange={handleRating} size={40} />
        {rating > 0 && (
          <Animated.View entering={FadeIn.duration(200)}>
            <TText variant="bodySmall" color="secondary" style={styles.ratingLabel}>
              {STARS_TEXT[rating]}
            </TText>
          </Animated.View>
        )}
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(300).springify()} style={styles.commentSection}>
        <TInput
          label="Commentaire (optionnel)"
          value={comment}
          onChangeText={setComment}
          placeholder="Décris ton expérience…"
          multiline
          numberOfLines={4}
          style={styles.commentInput}
        />
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(400).springify()} style={styles.visibilitySection}>
        <TouchableOpacity
          style={styles.visibilityRow}
          onPress={() => setIsPublic(!isPublic)}
          activeOpacity={0.8}
        >
          <Ionicons
            name={isPublic ? 'eye-outline' : 'eye-off-outline'}
            size={18}
            color={Colors.textSecondary}
          />
          <TText variant="bodySmall" color="secondary" style={{ flex: 1, marginLeft: 10 }}>
            {isPublic ? 'Avis public (visible sur le profil)' : 'Avis privé (visible uniquement par l\'artiste)'}
          </TText>
          <View style={[styles.toggle, isPublic && styles.toggleActive]}>
            <View style={[styles.toggleThumb, isPublic && styles.toggleThumbActive]} />
          </View>
        </TouchableOpacity>
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(500).springify()} style={{ paddingHorizontal: Spacing.sm }}>
        <TButton
          title="Envoyer mon avis"
          onPress={handleSubmit}
          loading={loading}
          disabled={rating === 0}
        />
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing['2xs'],
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSubtle,
  },
  closeBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  artistSection: { padding: Spacing.sm, paddingTop: Spacing.xl, alignItems: 'center' },
  artistName: { marginBottom: 4 },
  ratingSection: { alignItems: 'center', paddingVertical: Spacing.xl },
  ratingLabel: { marginTop: Spacing.sm, letterSpacing: 0.3 },
  commentSection: { paddingHorizontal: Spacing.sm, marginBottom: Spacing.sm },
  commentInput: { minHeight: 100 },
  visibilitySection: { paddingHorizontal: Spacing.sm, marginBottom: Spacing.lg },
  visibilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.bgSubtle,
    padding: 2,
  },
  toggleActive: { backgroundColor: Colors.accent },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.textTertiary,
  },
  toggleThumbActive: {
    backgroundColor: Colors.bgPrimary,
    transform: [{ translateX: 20 }],
  },
});
