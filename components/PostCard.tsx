import React, { useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withSequence,
  withTiming, FadeIn,
} from 'react-native-reanimated';
import { Colors, Spacing, Radius, GlowShadow } from '@/constants/theme';
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
  // Bento variants
  variant?: 'full' | 'half' | 'wide';
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_PADDING = 12;

const IMAGE_HEIGHTS = {
  full: SCREEN_WIDTH * (5 / 4),
  half: (SCREEN_WIDTH / 2 - CARD_PADDING * 1.5) * 1.3,
  wide: SCREEN_WIDTH * 0.7,
};

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export function PostCard({ post, onLike, onPress, onArtistPress, variant = 'full' }: PostCardProps) {
  const heartScale   = useSharedValue(1);
  const cardScale    = useSharedValue(1);
  const likeOpacity  = useSharedValue(post.isLiked ? 1 : 0);
  const imageScale   = useSharedValue(1);

  const imageHeight = IMAGE_HEIGHTS[variant];

  const handleLike = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    heartScale.value = withSequence(
      withSpring(1.6, { damping: 3, stiffness: 400 }),
      withSpring(1, { damping: 5, stiffness: 350 }),
    );
    likeOpacity.value = withTiming(post.isLiked ? 0 : 1, { duration: 120 });
    onLike?.();
  }, [post.isLiked, onLike]);

  const handlePressIn  = () => {
    cardScale.value  = withSpring(0.975, { damping: 20, stiffness: 300 });
    imageScale.value = withSpring(1.03,  { damping: 20, stiffness: 200 });
  };
  const handlePressOut = () => {
    cardScale.value  = withSpring(1, { damping: 15 });
    imageScale.value = withSpring(1, { damping: 15 });
  };

  const cardStyle   = useAnimatedStyle(() => ({ transform: [{ scale: cardScale.value }] }));
  const heartStyle  = useAnimatedStyle(() => ({ transform: [{ scale: heartScale.value }] }));
  const imageStyle  = useAnimatedStyle(() => ({ transform: [{ scale: imageScale.value }] }));
  const overlayStyle= useAnimatedStyle(() => ({ opacity: likeOpacity.value }));

  return (
    <Animated.View entering={FadeIn.duration(400)} style={[styles.container, cardStyle]}>
      {/* Image */}
      <TouchableOpacity
        activeOpacity={1}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[styles.imageWrap, { height: imageHeight }]}
      >
        <Animated.View style={[StyleSheet.absoluteFill, imageStyle]}>
          <Image
            source={{ uri: post.mediaUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={{ duration: 500, effect: 'cross-dissolve' }}
            sharedTransitionTag={`post-image-${post.id}`}
          />
        </Animated.View>

        {/* Gradient overlay bottom */}
        <LinearGradient
          colors={['transparent', 'rgba(5,5,8,0.85)']}
          locations={[0.4, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {/* Heart like overlay */}
        <Animated.View style={[StyleSheet.absoluteFill, styles.heartOverlay, overlayStyle]} pointerEvents="none">
          <Ionicons name="heart" size={72} color="rgba(255,255,255,0.95)" />
        </Animated.View>

        {/* Artist info overlay on image */}
        {variant !== 'half' && (
          <TouchableOpacity style={styles.artistOverlay} onPress={onArtistPress} activeOpacity={0.8}>
            <TAvatar
              uri={post.artistAvatarUrl}
              name={post.artistName}
              size="sm"
              isPremium={post.artistIsPremium}
            />
            <View style={{ marginLeft: 8, flex: 1 }}>
              <TText variant="bodySmall" weight="semibold" style={styles.overlayText}>
                {post.artistName}
              </TText>
              <TText variant="caption" style={styles.overlaySubText}>{post.artistCity}</TText>
            </View>
          </TouchableOpacity>
        )}

        {/* Like button — bottom right */}
        <TouchableOpacity onPress={handleLike} style={styles.likeBtn} activeOpacity={0.8}>
          <Animated.View style={heartStyle}>
            <Ionicons
              name={post.isLiked ? 'heart' : 'heart-outline'}
              size={variant === 'half' ? 18 : 22}
              color={post.isLiked ? '#F87171' : 'rgba(255,255,255,0.7)'}
            />
          </Animated.View>
          {variant !== 'half' && (
            <TText variant="caption" style={styles.likeCount}>{post.likesCount}</TText>
          )}
        </TouchableOpacity>
      </TouchableOpacity>

      {/* Style tags — only on full */}
      {variant === 'full' && post.styles.length > 0 && (
        <View style={styles.tagsRow}>
          {post.styles.slice(0, 3).map((s) => (
            <View key={s} style={styles.tag}>
              <TText variant="micro" color="secondary" uppercase>{s}</TText>
            </View>
          ))}
        </View>
      )}

      {/* Half variant artist pill */}
      {variant === 'half' && (
        <TouchableOpacity style={styles.halfArtistRow} onPress={onArtistPress} activeOpacity={0.8}>
          <TText variant="caption" weight="semibold" numberOfLines={1}>{post.artistName}</TText>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.sm,
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderSubtle,
    ...GlowShadow.white,
  },
  imageWrap: {
    overflow: 'hidden',
    borderRadius: Radius.xl,
  },
  heartOverlay: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  artistOverlay: {
    position: 'absolute',
    bottom: Spacing.sm,
    left: Spacing.sm,
    right: 60,
    flexDirection: 'row',
    alignItems: 'center',
  },
  overlayText:    { color: '#FFFFFF' },
  overlaySubText: { color: 'rgba(255,255,255,0.6)' },
  likeBtn: {
    position: 'absolute',
    bottom: Spacing.sm,
    right: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  likeCount: { color: 'rgba(255,255,255,0.8)', marginLeft: 2 },
  tagsRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 10,
  },
  tag: {
    backgroundColor: Colors.bgSubtle,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderSubtle,
  },
  halfArtistRow: {
    paddingHorizontal: Spacing['2xs'],
    paddingVertical: 8,
  },
});
