import React, { useCallback } from 'react';
import { View, StyleSheet, Pressable, Platform } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withSequence, useReducedMotion,
} from 'react-native-reanimated';
import { Colors, Spacing, Radius, SpringConfig } from '@/constants/theme';
import { TText } from './ui/TText';
import { TAvatar } from './ui/TAvatar';
import { BOOKING_STATUS, styleName } from './ArtistCard';

export interface PostCardData {
  id: string;
  artistId: string;
  artistName: string;
  artistCity: string;
  artistAvatarUrl: string | null;
  artistIsPremium: boolean;
  /** Shown as a status line under the full variant when provided. */
  artistBookingStatus?: 'open' | 'paused' | 'closed';
  mediaUrl: string;
  /** When unknown, the URL extension is used to detect videos. */
  mediaType?: 'photo' | 'video';
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
  onQuickBook?: () => void;
  variant?: 'full' | 'half' | 'wide';
  /** Fixed image height, used by multi-column layouts to align rows. Defaults to the variant ratio. */
  imageHeight?: number;
}

const ASPECT: Record<NonNullable<PostCardProps['variant']>, number> = {
  full: 4 / 5,
  half: 4 / 5,
  wide: 16 / 10,
};

const VIDEO_EXT = /\.(mp4|mov|m4v|webm|m3u8)(\?|#|$)/i;

/** True when a media URL cannot be rendered by <Image>. */
export function isVideoMedia(url: string | null | undefined, mediaType?: 'photo' | 'video') {
  return mediaType === 'video' || (!!url && VIDEO_EXT.test(url));
}

/** Quiet stand-in for video posts: the feed only renders still photography. */
export function VideoPlaceholder({ compact = false, note }: { compact?: boolean; note?: string }) {
  const ring = compact ? 40 : 56;
  return (
    <View style={[StyleSheet.absoluteFill, styles.video]} accessibilityLabel="Vidéo">
      <LinearGradient
        colors={['rgba(201,164,106,0.10)', 'rgba(201,164,106,0.01)']}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.videoRing, { width: ring, height: ring, borderRadius: ring / 2 }]}>
        <Ionicons name="play" size={compact ? 15 : 20} color={Colors.accentGlow} style={{ marginLeft: 2 }} />
      </View>
      <TText variant="caption" color="secondary" style={{ marginTop: Spacing['2xs'] }}>Vidéo</TText>
      {!!note && !compact && (
        <TText variant="caption" color="tertiary" style={styles.videoNote}>{note}</TText>
      )}
    </View>
  );
}

function LikeButton({
  liked, count, onPress, onImage, small,
}: { liked: boolean; count?: number; onPress: () => void; onImage?: boolean; small?: boolean }) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const press = useCallback(() => {
    if (!reduced) scale.value = withSequence(withSpring(1.15, SpringConfig.snappy), withSpring(1, SpringConfig.gentle));
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  }, [onPress, reduced, scale]);

  const iconColor = liked ? Colors.accentGlow : onImage ? Colors.textPrimary : Colors.textSecondary;
  const label = liked ? 'Retirer le j’aime' : 'Aimer cette réalisation';

  return (
    <Pressable
      onPress={press}
      accessibilityRole="button"
      accessibilityLabel={count ? `${label}, ${count} j’aime` : label}
      accessibilityState={{ selected: liked }}
      hitSlop={6}
      style={({ pressed }) => [
        onImage ? [styles.likeOnImage, small && styles.likeOnImageSmall] : styles.likeInline,
        pressed && { opacity: 0.7 },
      ]}
    >
      <Animated.View style={anim}>
        <Ionicons name={liked ? 'heart' : 'heart-outline'} size={small ? 16 : 19} color={iconColor} />
      </Animated.View>
      {!onImage && count !== undefined && count > 0 && (
        <TText variant="caption" color="secondary" tabular>{count.toLocaleString('fr-FR')}</TText>
      )}
    </Pressable>
  );
}

export function PostCard({
  post, onLike, onPress, onArtistPress, onQuickBook, variant = 'full', imageHeight,
}: PostCardProps) {
  const reduced = useReducedMotion();
  const lift = useSharedValue(1);
  const liftStyle = useAnimatedStyle(() => ({ transform: [{ scale: lift.value }] }));

  const pressIn = () => { if (!reduced) lift.value = withSpring(0.985, SpringConfig.snappy); };
  const pressOut = () => { if (!reduced) lift.value = withSpring(1, SpringConfig.gentle); };
  const like = useCallback(() => onLike?.(), [onLike]);

  const isHalf = variant === 'half';
  const isVideo = isVideoMedia(post.mediaUrl, post.mediaType);
  const stylesLabel = post.styles.slice(0, 2).map(styleName).join(' · ');
  const meta = [post.artistCity, stylesLabel].filter(Boolean).join(' · ');
  const mediaLabel = `Réalisation de ${post.artistName}${post.caption ? ` : ${post.caption}` : ''}`;
  const status = post.artistBookingStatus ? BOOKING_STATUS[post.artistBookingStatus] : null;
  const mediaSize = imageHeight ? { height: imageHeight } : { aspectRatio: ASPECT[variant] };

  return (
    <View style={styles.card}>
      {/* ── The work ── */}
      <Animated.View style={[styles.media, isHalf ? styles.mediaHalf : styles.mediaLarge, mediaSize, liftStyle]}>
        <Pressable
          onPress={onPress}
          onPressIn={pressIn}
          onPressOut={pressOut}
          accessibilityRole="link"
          accessibilityLabel={mediaLabel}
          style={({ pressed }) => [StyleSheet.absoluteFill, reduced && pressed && { opacity: 0.85 }]}
        >
          {isVideo ? (
            <VideoPlaceholder compact={isHalf} />
          ) : (
            <Image
              source={{ uri: post.mediaUrl }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={reduced ? 0 : 300}
            />
          )}
        </Pressable>
        {isHalf && onLike && (
          <View style={styles.likeCorner}>
            <LikeButton liked={post.isLiked} onPress={like} onImage small />
          </View>
        )}
      </Animated.View>

      {/* ── Wall label ── */}
      {isHalf ? (
        <Pressable
          onPress={onArtistPress}
          accessibilityRole="link"
          accessibilityLabel={`Voir le profil de ${post.artistName}`}
          style={({ pressed }) => [styles.halfLabel, pressed && { opacity: 0.7 }]}
        >
          <TText variant="bodySmall" weight="medium" numberOfLines={1}>{post.artistName}</TText>
          {!!meta && <TText variant="caption" color="tertiary" numberOfLines={1}>{meta}</TText>}
        </Pressable>
      ) : (
        <View style={styles.label}>
          <View style={styles.labelRow}>
            <Pressable
              onPress={onArtistPress}
              accessibilityRole="link"
              accessibilityLabel={`Voir le profil de ${post.artistName}`}
              style={({ pressed }) => [styles.artist, pressed && { opacity: 0.7 }]}
            >
              <TAvatar uri={post.artistAvatarUrl} name={post.artistName} size="sm" />
              <View style={styles.artistText}>
                <TText variant="title2" serif numberOfLines={1} style={styles.artistName}>{post.artistName}</TText>
                {!!meta && <TText variant="caption" color="secondary" numberOfLines={1}>{meta}</TText>}
              </View>
            </Pressable>
            {onLike && <LikeButton liked={post.isLiked} count={post.likesCount} onPress={like} />}
          </View>

          {!!post.caption && (
            <TText
              variant="bodySmall"
              color="secondary"
              numberOfLines={variant === 'wide' ? 1 : 2}
              style={styles.caption}
            >
              {post.caption}
            </TText>
          )}

          {variant === 'full' && (status || onQuickBook) && (
            <View style={styles.actionRow}>
              {status ? (
                <View style={styles.status}>
                  <View style={[styles.statusDot, { backgroundColor: status.color }]} />
                  <TText variant="caption" color="secondary">{status.label}</TText>
                </View>
              ) : <View />}
              {onQuickBook && (
                <Pressable
                  onPress={onQuickBook}
                  accessibilityRole="button"
                  accessibilityLabel={`Demander un projet à ${post.artistName}`}
                  hitSlop={8}
                  style={({ pressed }) => [styles.requestLink, pressed && { opacity: 0.7 }]}
                >
                  <TText variant="bodySmall" weight="medium" color="accentGlow">Demander un projet</TText>
                  <Ionicons name="arrow-forward" size={14} color={Colors.accentGlow} />
                </Pressable>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%' },

  media: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: Colors.bgSurface,
  },
  mediaLarge: { borderRadius: Radius.xl },
  mediaHalf: { borderRadius: Radius.lg },

  video: { backgroundColor: Colors.bgElevated, alignItems: 'center', justifyContent: 'center' },
  videoRing: {
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderGlow,
    backgroundColor: 'rgba(11,10,9,0.4)',
  },
  videoNote: { marginTop: 4, textAlign: 'center', maxWidth: 240 },

  likeCorner: { position: 'absolute', top: Spacing['2xs'], right: Spacing['2xs'] },
  likeOnImage: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(11,10,9,0.55)',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderBright,
  },
  likeOnImageSmall: { width: 36, height: 36, borderRadius: 18 },
  likeInline: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    minWidth: 40, height: 40, paddingHorizontal: 4,
    justifyContent: 'flex-end',
  },

  halfLabel: { paddingTop: 10, gap: 1 },

  label: { paddingTop: 14 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  artist: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 40 },
  artistText: { flex: 1, gap: 1 },
  artistName: { fontSize: 21, lineHeight: 24 },
  caption: { marginTop: Spacing['2xs'], maxWidth: 640 },

  actionRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 12, paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.borderDefault,
  },
  status: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  requestLink: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 32 },
});
