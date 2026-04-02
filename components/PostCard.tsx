import React, { useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withSequence, withTiming,
} from 'react-native-reanimated';
import { Colors, Spacing, Radius } from '@/constants/theme';
import { TText } from './ui/TText';
import { TAvatar } from './ui/TAvatar';

export interface PostCardData {
  id: string;
  artistId: string;
  artistName: string;
  artistCity: string;
  artistAvatarUrl: string | null;
  artistIsPremium: boolean;
  mediaUrl: string;
  caption: string | null;
  styles: string[];
  likesCount: number;
  isLiked: boolean;
}

interface PostCardProps {
  post: PostCardData;
  onLike?: () => void;
  onPress?: () => void;
  onArtistPress?: () => void;
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const IMAGE_HEIGHT = SCREEN_WIDTH * (5 / 4);

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export function PostCard({ post, onLike, onPress, onArtistPress }: PostCardProps) {
  const heartScale = useSharedValue(1);
  const heartOpacity = useSharedValue(post.isLiked ? 1 : 0);
  const cardScale = useSharedValue(1);

  const heartStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
  }));

  const overlayStyle = useAnimatedStyle(() => ({ opacity: heartOpacity.value }));

  const handleLike = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    heartScale.value = withSequence(
      withSpring(1.5, { damping: 3, stiffness: 350 }),
      withSpring(1, { damping: 6, stiffness: 400 })
    );
    heartOpacity.value = withTiming(post.isLiked ? 0 : 1, { duration: 150 });
    onLike?.();
  }, [post.isLiked, onLike]);

  const handlePressIn = () => { cardScale.value = withSpring(0.98); };
  const handlePressOut = () => { cardScale.value = withSpring(1); };
  const cardStyle = useAnimatedStyle(() => ({ transform: [{ scale: cardScale.value }] }));

  return (
    <Animated.View style={[styles.container, cardStyle]}>
      {/* Media with shared element tag */}
      <TouchableOpacity
        activeOpacity={0.97}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <Image
          source={{ uri: post.mediaUrl }}
          style={styles.image}
          contentFit="cover"
          transition={{ duration: 400, effect: 'cross-dissolve' }}
          sharedTransitionTag={`post-image-${post.id}`}
        />
        {/* Double-tap heart overlay */}
        <Animated.View style={[StyleSheet.absoluteFill, styles.heartOverlay, overlayStyle]} pointerEvents="none">
          <Ionicons name="heart" size={80} color="rgba(255,255,255,0.9)" />
        </Animated.View>
      </TouchableOpacity>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.artistInfo} onPress={onArtistPress} activeOpacity={0.8}>
          <TAvatar
            uri={post.artistAvatarUrl}
            name={post.artistName}
            size="sm"
            isPremium={post.artistIsPremium}
          />
          <View style={styles.artistText}>
            <TText variant="bodySmall" weight="semibold" numberOfLines={1}>{post.artistName}</TText>
            <TText variant="caption" color="tertiary">{post.artistCity}</TText>
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
            {post.likesCount}
          </TText>
        </TouchableOpacity>
      </View>

      {/* Style tags */}
      {post.styles.length > 0 && (
        <View style={styles.tagsRow}>
          {post.styles.slice(0, 3).map((s) => (
            <View key={s} style={styles.tag}>
              <TText variant="caption" color="secondary">{s}</TText>
            </View>
          ))}
        </View>
      )}

      {post.caption && (
        <View style={styles.captionRow}>
          <TText variant="caption" color="secondary" numberOfLines={2}>{post.caption}</TText>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderSubtle,
  },
  image: {
    width: '100%',
    height: IMAGE_HEIGHT,
    backgroundColor: Colors.bgSurface,
  },
  heartOverlay: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing['2xs'],
  },
  artistInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  artistText: { marginLeft: Spacing['2xs'], flex: 1 },
  likeButton: { flexDirection: 'row', alignItems: 'center', padding: 8 },
  likeCount: { marginLeft: 4, minWidth: 20 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, paddingHorizontal: Spacing.sm, paddingBottom: 6 },
  tag: {
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderSubtle,
  },
  captionRow: { paddingHorizontal: Spacing.sm, paddingBottom: Spacing['2xs'] },
});
