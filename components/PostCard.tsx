import React, { useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withSequence, withTiming, useReducedMotion,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { Colors, Spacing, Radius } from '@/constants/theme';
import { PressableScale, RevealImage, Springs, EASE_OUT } from '@/components/motion';
import { TText } from './ui/TText';
import { TAvatar } from './ui/TAvatar';
import { ArtPlaceholder, BOOKING_STATUS, styleName } from './ArtistCard';
import { parseReelUrl, REEL_PROVIDER_LABEL, type ReelProvider } from '@/lib/reels';
import type { ReactionCounts, ReactionKey } from '@/lib/care';
import { ReactionBar } from './social/ReactionBar';

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
  /** Poster of an uploaded video. */
  thumbnailUrl?: string | null;
  /** Set when the video is hosted by TikTok or Instagram. */
  embedProvider?: ReelProvider | null;
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
  /** Reaction counts loaded by the list in one batch; omitted, the card loads its own. */
  initialReactionCounts?: ReactionCounts;
  /** The viewer's reaction, loaded with the counts (null: none). */
  initialMyReaction?: ReactionKey | null;
}

const ASPECT: Record<NonNullable<PostCardProps['variant']>, number> = {
  full: 4 / 5,
  half: 4 / 5,
  wide: 16 / 10,
};

const VIDEO_EXT = /\.(mp4|mov|m4v|webm|m3u8)(\?|#|$)/i;

/** True when a media URL cannot be rendered by <Image>. */
export function isVideoMedia(url: string | null | undefined, mediaType?: 'photo' | 'video') {
  return mediaType === 'video' || (!!url && (VIDEO_EXT.test(url) || parseReelUrl(url) !== null));
}

/** Play mark over a video poster. */
export function PlayBadge({ compact = false }: { compact?: boolean }) {
  const ring = compact ? 36 : 52;
  return (
    <View style={[StyleSheet.absoluteFill, styles.playBadge]} pointerEvents="none">
      <View style={[styles.videoRing, { width: ring, height: ring, borderRadius: ring / 2 }]}>
        <Ionicons name="play" size={compact ? 14 : 19} color={Colors.textPrimary} style={{ marginLeft: 2 }} />
      </View>
    </View>
  );
}

/**
 * Brief "pop" for commits (like, save): a quick lift, then an under-damped settle.
 * Only on the way in — undoing a like stays quiet. Reduced motion: no movement.
 */
export function popScale(value: SharedValue<number>, reduced: boolean) {
  if (reduced) return;
  value.set(withSequence(withTiming(1.22, { duration: 110, easing: EASE_OUT }), withSpring(1, Springs.pop)));
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
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  const press = useCallback(() => {
    if (!liked) popScale(scale, reduced);
    onPress();
  }, [liked, onPress, reduced, scale]);

  const iconColor = liked ? Colors.accentGlow : onImage ? Colors.textPrimary : Colors.textSecondary;
  const label = liked ? 'Retirer le j’aime' : 'Aimer cette réalisation';

  return (
    <PressableScale
      onPress={press}
      haptic
      pressedScale={0.92}
      accessibilityRole="button"
      accessibilityLabel={count ? `${label}, ${count} j’aime` : label}
      accessibilityState={{ selected: liked }}
      hitSlop={6}
      style={onImage ? [styles.likeOnImage, small && styles.likeOnImageSmall] : styles.likeInline}
    >
      <Animated.View style={anim}>
        <Ionicons name={liked ? 'heart' : 'heart-outline'} size={small ? 16 : 19} color={iconColor} />
      </Animated.View>
      {!onImage && count !== undefined && count > 0 && (
        <TText variant="caption" color="secondary" tabular>{count.toLocaleString('fr-FR')}</TText>
      )}
    </PressableScale>
  );
}

export function PostCard({
  post, onLike, onPress, onArtistPress, onQuickBook, variant = 'full', imageHeight,
  initialReactionCounts, initialMyReaction,
}: PostCardProps) {
  const like = useCallback(() => onLike?.(), [onLike]);

  const isHalf = variant === 'half';
  const isVideo = isVideoMedia(post.mediaUrl, post.mediaType);
  const stylesLabel = post.styles.slice(0, 2).map(styleName).join(' · ');
  const meta = [post.artistCity, stylesLabel].filter(Boolean).join(' · ');
  const mediaLabel = `${isVideoMedia(post.mediaUrl, post.mediaType) ? 'Vidéo' : 'Réalisation'} de ${post.artistName}${post.caption ? ` : ${post.caption}` : ''}`;
  const status = post.artistBookingStatus ? BOOKING_STATUS[post.artistBookingStatus] : null;
  const mediaSize = imageHeight ? { height: imageHeight } : { aspectRatio: ASPECT[variant] };
  const reactions = (
    <ReactionBar postId={post.id} compact initialCounts={initialReactionCounts} initialMine={initialMyReaction} />
  );

  return (
    <View style={styles.card}>
      {/* ── The work ── */}
      <View>
        <PressableScale
          onPress={onPress}
          accessibilityRole="link"
          accessibilityLabel={mediaLabel}
          style={[styles.media, isHalf ? styles.mediaHalf : styles.mediaLarge, mediaSize]}
        >
          {isVideo ? (
            post.thumbnailUrl ? (
              <>
                <RevealImage uri={post.thumbnailUrl} style={StyleSheet.absoluteFill} fallback={<VideoPlaceholder compact={isHalf} />} />
                <PlayBadge compact={isHalf} />
              </>
            ) : (
              <VideoPlaceholder
                compact={isHalf}
                note={post.embedProvider ? `Vidéo ${REEL_PROVIDER_LABEL[post.embedProvider]}` : undefined}
              />
            )
          ) : (
            <RevealImage
              uri={post.mediaUrl}
              style={StyleSheet.absoluteFill}
              fallback={<ArtPlaceholder name={post.artistName} size={isHalf ? 40 : 72} />}
            />
          )}
        </PressableScale>
        {isHalf && onLike && (
          <View style={styles.likeCorner}>
            <LikeButton liked={post.isLiked} onPress={like} onImage small />
          </View>
        )}
      </View>

      {/* ── Wall label ── */}
      {isHalf ? (
        <>
          <PressableScale
            onPress={onArtistPress}
            accessibilityRole="link"
            accessibilityLabel={`Voir le profil de ${post.artistName}`}
            style={styles.halfLabel}
          >
            <TText variant="bodySmall" weight="medium" numberOfLines={1}>{post.artistName}</TText>
            {!!meta && <TText variant="caption" color="tertiary" numberOfLines={1}>{meta}</TText>}
          </PressableScale>
          <View style={styles.halfReactions}>{reactions}</View>
        </>
      ) : (
        <View style={styles.label}>
          <View style={styles.labelRow}>
            <View style={styles.artistSlot}>
              <PressableScale
                onPress={onArtistPress}
                accessibilityRole="link"
                accessibilityLabel={`Voir le profil de ${post.artistName}`}
                style={styles.artist}
              >
                <TAvatar uri={post.artistAvatarUrl} name={post.artistName} size="sm" />
                <View style={styles.artistText}>
                  <TText variant="title2" serif numberOfLines={1} style={styles.artistName}>{post.artistName}</TText>
                  {!!meta && <TText variant="caption" color="secondary" numberOfLines={1}>{meta}</TText>}
                </View>
              </PressableScale>
            </View>
            {/* Reactions sit beside the like; on narrow cards the pair wraps under the artist. */}
            <View style={styles.engagement}>
              {reactions}
              {onLike && <LikeButton liked={post.isLiked} count={post.likesCount} onPress={like} />}
            </View>
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
                <PressableScale
                  onPress={onQuickBook}
                  accessibilityRole="button"
                  accessibilityLabel={`Demander un projet à ${post.artistName}`}
                  hitSlop={8}
                  style={styles.requestLink}
                >
                  <TText variant="bodySmall" weight="medium" color="accentGlow">Demander un projet</TText>
                  <Ionicons name="arrow-forward" size={14} color={Colors.accentGlow} />
                </PressableScale>
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
  playBadge: { alignItems: 'center', justifyContent: 'center' },
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
  halfReactions: { flexDirection: 'row', marginTop: 6 },

  label: { paddingTop: 14 },
  labelRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: Spacing.xs, rowGap: 4 },
  // Grows to fill the row; below ~180 px the engagement cluster moves to its own line.
  artistSlot: { flexGrow: 1, flexShrink: 1, flexBasis: 180, minWidth: 0 },
  engagement: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto', flexShrink: 1, maxWidth: '100%' },
  artist: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 40 },
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
