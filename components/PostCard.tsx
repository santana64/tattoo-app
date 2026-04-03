import React, { useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withSequence,
  withTiming, FadeIn, interpolate, Extrapolation,
} from 'react-native-reanimated';
import { Colors, Spacing, Radius, GlowShadow, FontSize } from '@/constants/theme';
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
  isTrending?: boolean;
}

interface PostCardProps {
  post: PostCardData;
  onLike?: () => void;
  onPress?: () => void;
  onArtistPress?: () => void;
  onQuickBook?: () => void;
  variant?: 'full' | 'half' | 'wide';
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_PADDING = 12;

const IMAGE_HEIGHTS = {
  full: SCREEN_WIDTH * (5 / 4),
  half: (SCREEN_WIDTH / 2 - CARD_PADDING * 1.5) * 1.3,
  wide: SCREEN_WIDTH * 0.65,
};

export function PostCard({ post, onLike, onPress, onArtistPress, onQuickBook, variant = 'full' }: PostCardProps) {
  const heartScale   = useSharedValue(1);
  const cardScale    = useSharedValue(1);
  const likeOpacity  = useSharedValue(post.isLiked ? 1 : 0);
  const imageScale   = useSharedValue(1);
  const glowOpacity  = useSharedValue(0);
  const tiltX        = useSharedValue(0);
  const tiltY        = useSharedValue(0);

  const imageHeight = IMAGE_HEIGHTS[variant];

  const handleLike = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    heartScale.value = withSequence(
      withSpring(1.7, { damping: 3, stiffness: 400 }),
      withSpring(1,   { damping: 5, stiffness: 350 }),
    );
    likeOpacity.value = withTiming(post.isLiked ? 0 : 1, { duration: 100 });
    if (!post.isLiked) {
      glowOpacity.value = withSequence(
        withTiming(1, { duration: 80 }),
        withTiming(0, { duration: 600 }),
      );
    }
    onLike?.();
  }, [post.isLiked, onLike]);

  const handlePressIn = () => {
    cardScale.value  = withSpring(0.972, { damping: 20, stiffness: 300 });
    imageScale.value = withSpring(1.04,  { damping: 20, stiffness: 200 });
  };
  const handlePressOut = () => {
    cardScale.value  = withSpring(1, { damping: 14 });
    imageScale.value = withSpring(1, { damping: 14 });
  };

  const cardStyle    = useAnimatedStyle(() => ({ transform: [{ scale: cardScale.value }] }));
  const heartStyle   = useAnimatedStyle(() => ({ transform: [{ scale: heartScale.value }] }));
  const imageStyle   = useAnimatedStyle(() => ({ transform: [{ scale: imageScale.value }] }));
  const overlayStyle = useAnimatedStyle(() => ({ opacity: likeOpacity.value }));
  const glowStyle    = useAnimatedStyle(() => ({ opacity: glowOpacity.value }));

  const isHalf = variant === 'half';

  return (
    <Animated.View entering={FadeIn.duration(400)} style={[styles.container, cardStyle, variant === 'full' && GlowShadow.white]}>

      {/* Trending badge */}
      {post.isTrending && !isHalf && (
        <Animated.View entering={FadeIn.delay(200)} style={styles.trendingBadge}>
          <TText variant="micro" style={styles.trendingText} uppercase>🔥 Trending</TText>
        </Animated.View>
      )}

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
            transition={{ duration: 400, effect: 'cross-dissolve' }}
            sharedTransitionTag={`post-image-${post.id}`}
          />
        </Animated.View>

        {/* Gradient overlay */}
        <LinearGradient
          colors={['transparent', 'rgba(3,3,5,0.5)', 'rgba(3,3,5,0.92)']}
          locations={[0.35, 0.65, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {/* Like flash glow */}
        <Animated.View
          style={[StyleSheet.absoluteFill, styles.likeGlow, glowStyle]}
          pointerEvents="none"
        />

        {/* Heart overlay */}
        <Animated.View style={[StyleSheet.absoluteFill, styles.heartOverlay, overlayStyle]} pointerEvents="none">
          <Ionicons name="heart" size={80} color="rgba(255,255,255,0.95)" />
        </Animated.View>

        {/* Artist info overlay — full/wide only */}
        {!isHalf && (
          <TouchableOpacity style={styles.artistOverlay} onPress={onArtistPress} activeOpacity={0.8}>
            <TAvatar
              uri={post.artistAvatarUrl}
              name={post.artistName}
              size="sm"
              isPremium={post.artistIsPremium}
            />
            <View style={{ marginLeft: 8, flex: 1 }}>
              <TText variant="bodySmall" weight="semibold" style={styles.overlayText}>{post.artistName}</TText>
              <TText variant="caption" style={styles.overlaySubText}>{post.artistCity}</TText>
            </View>
          </TouchableOpacity>
        )}

        {/* Like button */}
        <TouchableOpacity onPress={handleLike} style={[styles.likeBtn, isHalf && styles.likeBtnHalf]} activeOpacity={0.8}>
          <Animated.View style={heartStyle}>
            <Ionicons
              name={post.isLiked ? 'heart' : 'heart-outline'}
              size={isHalf ? 16 : 20}
              color={post.isLiked ? '#F87171' : 'rgba(255,255,255,0.75)'}
            />
          </Animated.View>
          {!isHalf && (
            <TText variant="caption" style={styles.likeCount}>{post.likesCount}</TText>
          )}
        </TouchableOpacity>

        {/* Quick book pill — full/wide only */}
        {!isHalf && onQuickBook && (
          <TouchableOpacity onPress={onQuickBook} style={styles.quickBookBtn} activeOpacity={0.85}>
            <LinearGradient
              colors={['rgba(212,168,100,0.9)', 'rgba(192,128,58,0.9)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Ionicons name="calendar-outline" size={12} color={Colors.bgPrimary} />
            <TText variant="micro" style={{ color: Colors.bgPrimary, fontWeight: '700', marginLeft: 4 }} uppercase>
              Réserver
            </TText>
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      {/* Style tags — full only */}
      {variant === 'full' && post.styles.length > 0 && (
        <View style={styles.tagsRow}>
          {post.styles.slice(0, 3).map((s) => (
            <View key={s} style={styles.tag}>
              <TText variant="micro" color="secondary" uppercase style={{ letterSpacing: 0.8 }}>{s}</TText>
            </View>
          ))}
        </View>
      )}

      {/* Half artist pill */}
      {isHalf && (
        <TouchableOpacity style={styles.halfArtistRow} onPress={onArtistPress} activeOpacity={0.8}>
          <TText variant="caption" weight="semibold" numberOfLines={1} style={{ color: Colors.textSecondary }}>{post.artistName}</TText>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.sm,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderSubtle,
  },
  imageWrap: {
    overflow: 'hidden',
    borderRadius: Radius.xl,
  },
  likeGlow: {
    backgroundColor: 'rgba(240,90,90,0.12)',
  },
  heartOverlay: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  artistOverlay: {
    position: 'absolute',
    bottom: Spacing.sm,
    left: Spacing.sm,
    right: 90,
    flexDirection: 'row',
    alignItems: 'center',
  },
  overlayText: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  overlaySubText: { color: 'rgba(255,255,255,0.55)' },
  likeBtn: {
    position: 'absolute',
    bottom: Spacing.sm,
    right: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.40)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  likeBtnHalf: {
    paddingHorizontal: 7,
    paddingVertical: 5,
  },
  likeCount: { color: 'rgba(255,255,255,0.85)' },
  quickBookBtn: {
    position: 'absolute',
    bottom: Spacing.sm,
    right: 76,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  trendingBadge: {
    position: 'absolute',
    top: Spacing['2xs'],
    left: Spacing['2xs'],
    zIndex: 10,
    backgroundColor: 'rgba(240,90,60,0.85)',
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  trendingText: { color: '#FFFFFF', fontSize: 9 },
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
    borderColor: Colors.borderDefault,
  },
  halfArtistRow: {
    paddingHorizontal: Spacing['2xs'],
    paddingVertical: 8,
  },
});
