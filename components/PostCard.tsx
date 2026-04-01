import React, { useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withSequence } from 'react-native-reanimated';
import { Colors, Spacing, Radius } from '@/constants/theme';
import { TText } from './ui/TText';
import { TAvatar } from './ui/TAvatar';
import type { Post } from '@/constants/mock-data';

interface PostCardProps {
  post: Post;
  onLike: (id: string) => void;
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const IMAGE_HEIGHT = SCREEN_WIDTH * (5 / 4);

export function PostCard({ post, onLike }: PostCardProps) {
  const router = useRouter();
  const heartScale = useSharedValue(1);

  const heartStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
  }));

  const handleLike = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    heartScale.value = withSequence(
      withSpring(1.4, { damping: 4, stiffness: 300 }),
      withSpring(1, { damping: 6, stiffness: 400 })
    );
    onLike(post.id);
  }, [post.id, onLike]);

  const goToArtist = () => {
    router.push(`/artist/${post.artistId}`);
  };

  return (
    <View style={styles.container}>
      {/* Media */}
      <TouchableOpacity activeOpacity={0.97} onPress={() => router.push(`/post/${post.id}`)}>
        <Image
          source={{ uri: post.mediaUrl }}
          style={styles.image}
          contentFit="cover"
          transition={300}
        />
      </TouchableOpacity>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.artistInfo} onPress={goToArtist} activeOpacity={0.8}>
          <TAvatar
            uri={post.artist.avatarUrl}
            name={post.artist.blaze}
            size="sm"
            isPremium={post.artist.tier === 'premium'}
          />
          <View style={styles.artistText}>
            <TText variant="bodySmall" weight="semibold" numberOfLines={1}>
              {post.artist.blaze}
            </TText>
            <TText variant="caption" color="tertiary">
              {post.artist.city}
            </TText>
          </View>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleLike} style={styles.likeButton} activeOpacity={0.8}>
          <Animated.View style={heartStyle}>
            <Ionicons
              name={post.isLiked ? 'heart' : 'heart-outline'}
              size={22}
              color={post.isLiked ? Colors.error : Colors.textSecondary}
            />
          </Animated.View>
          <TText variant="caption" color="secondary" style={styles.likeCount}>
            {post.likes}
          </TText>
        </TouchableOpacity>
      </View>

      {post.caption ? (
        <View style={styles.captionRow}>
          <TText variant="caption" color="secondary" numberOfLines={2}>
            {post.caption}
          </TText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  image: {
    width: '100%',
    height: IMAGE_HEIGHT,
    backgroundColor: Colors.bgSurface,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing['2xs'],
  },
  artistInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  artistText: {
    marginLeft: Spacing['2xs'],
    flex: 1,
  },
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  likeCount: {
    marginLeft: 4,
    minWidth: 20,
  },
  captionRow: {
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing['2xs'],
  },
});
