import React from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useSharedValue, useAnimatedStyle, withSequence, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TAvatar } from '@/components/ui/TAvatar';
import { TButton } from '@/components/ui/TButton';
import { TChip } from '@/components/ui/TChip';
import { useAppStore } from '@/store/app-store';
import { POSTS, ARTISTS } from '@/constants/mock-data';

const { width } = Dimensions.get('window');

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { toggleLike, savedPostIds, toggleSavePost } = useAppStore();

  const post = useAppStore((s) => s.posts.find((p) => p.id === id)) ?? POSTS[0];
  const artist = ARTISTS.find((a) => a.id === post.artistId);
  const heartScale = useSharedValue(1);

  const heartStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
  }));

  const handleLike = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    heartScale.value = withSequence(
      withSpring(1.4, { damping: 4 }),
      withSpring(1, { damping: 6 })
    );
    toggleLike(post.id);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {}}
          style={styles.headerBtn}
        >
          <Ionicons name="ellipsis-horizontal" size={22} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}>
        {/* Image */}
        <Image
          source={{ uri: post.mediaUrl }}
          style={styles.image}
          contentFit="cover"
        />

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity onPress={handleLike} style={styles.actionBtn}>
            <Animated.View style={heartStyle}>
              <Ionicons
                name={post.isLiked ? 'heart' : 'heart-outline'}
                size={28}
                color={post.isLiked ? Colors.error : Colors.textSecondary}
              />
            </Animated.View>
            <TText variant="bodySmall" color="secondary" style={{ marginLeft: 6 }}>
              {post.likes}
            </TText>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => toggleSavePost(post.id)} style={styles.actionBtn}>
            <Ionicons
              name={savedPostIds.has(post.id) ? 'bookmark' : 'bookmark-outline'}
              size={24}
              color={savedPostIds.has(post.id) ? Colors.accent : Colors.textSecondary}
            />
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn}>
            <Ionicons name="share-outline" size={24} color={Colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn}>
            <Ionicons name="flag-outline" size={22} color={Colors.textTertiary} />
          </TouchableOpacity>
        </View>

        {/* Caption */}
        {post.caption ? (
          <View style={styles.caption}>
            <TText variant="body" color="secondary">
              {post.caption}
            </TText>
          </View>
        ) : null}

        {/* Style tags */}
        {post.styles.length > 0 && (
          <View style={styles.tagsRow}>
            {post.styles.map((s) => <TChip key={s} label={s} />)}
          </View>
        )}

        <View style={styles.divider} />

        {/* Artist */}
        {artist && (
          <TouchableOpacity
            style={styles.artistSection}
            onPress={() => router.push(`/artist/${artist.id}`)}
            activeOpacity={0.85}
          >
            <TAvatar uri={artist.avatarUrl} name={artist.blaze} size="xl" isPremium={artist.tier === 'premium'} />
            <View style={styles.artistInfo}>
              <TText variant="bodySmall" weight="semibold">{artist.blaze}</TText>
              <TText variant="caption" color="secondary">{artist.city}</TText>
              <TText variant="caption" color="secondary" numberOfLines={2} style={{ marginTop: 2 }}>
                {artist.styles.join(' · ')}
              </TText>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.textTertiary} />
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Sticky CTA */}
      {artist && (
        <View style={[styles.stickyBar, { paddingBottom: insets.bottom + 8 }]}>
          <TButton
            title={`Voir le profil de ${artist.blaze}`}
            onPress={() => router.push(`/artist/${artist.id}`)}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  image: { width, height: width * (5 / 4), backgroundColor: Colors.bgSurface },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing['2xs'],
    gap: Spacing['2xs'],
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  caption: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing['2xs'] },
  tagsRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    flexWrap: 'wrap',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.borderSubtle,
    marginHorizontal: Spacing.lg,
  },
  artistSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  artistInfo: { flex: 1 },
  stickyBar: {
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing['2xs'],
    backgroundColor: Colors.bgPrimary,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderSubtle,
  },
});
