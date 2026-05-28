import React, { useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, FadeInUp, withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Radius, GlowShadow } from '@/constants/theme';
import { TText } from './ui/TText';
import { TAvatar } from './ui/TAvatar';
import type { Artist } from '@/constants/mock-data';
import { POSTS } from '@/constants/mock-data';

interface ArtistCardProps {
  artist: Artist;
  isSaved?: boolean;
  onSave?: (id: string) => void;
  index?: number;
  variant?: 'default' | 'featured' | 'compact';
}

const { width: SCREEN_W } = Dimensions.get('window');

const STATUS_CONFIG = {
  open:   { color: Colors.success,  label: 'Disponible', dot: Colors.successLight, glow: 'rgba(16,185,129,0.25)' },
  paused: { color: Colors.warning,  label: 'En pause',   dot: Colors.warningLight, glow: 'rgba(245,158,11,0.20)' },
  closed: { color: Colors.error,    label: 'Fermé',      dot: Colors.errorLight,   glow: 'rgba(239,68,68,0.20)'  },
};

function LiveDot({ color, glow }: { color: string; glow: string }) {
  const pulse = useSharedValue(1);
  React.useEffect(() => {
    pulse.value = withSpring(1.1, { damping: 4, stiffness: 80 });
  }, []);
  const dotStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
  return (
    <View style={{ width: 10, height: 10, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: glow }} />
      <Animated.View style={[{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }, dotStyle]} />
    </View>
  );
}

export function ArtistCard({ artist, isSaved = false, onSave, index = 0, variant = 'default' }: ArtistCardProps) {
  const router = useRouter();
  const artistPosts = POSTS.filter((p) => p.artistId === artist.id).slice(0, 3);
  const coverPost   = artistPosts[0];
  const status      = STATUS_CONFIG[artist.bookingStatus];

  const scale     = useSharedValue(1);
  const saveScale = useSharedValue(1);

  const handlePressIn  = () => { scale.value = withSpring(0.97, { damping: 20 }); };
  const handlePressOut = () => { scale.value = withSpring(1, { damping: 14 }); };

  const handleSave = useCallback(() => {
    saveScale.value = withSpring(1.5, { damping: 4 }, () => {
      saveScale.value = withSpring(1);
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSave?.(artist.id);
  }, [artist.id, onSave]);

  const cardStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const saveStyle = useAnimatedStyle(() => ({ transform: [{ scale: saveScale.value }] }));

  if (variant === 'featured') {
    return (
      <Animated.View entering={FadeInUp.delay(index * 60).springify()} style={[styles.featuredContainer, cardStyle]}>
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => router.push(`/artist/${artist.id}`)}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={styles.featuredInner}
        >
          <Image
            source={{ uri: artist.coverUrl ?? coverPost?.mediaUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
          <LinearGradient
            colors={['transparent', 'rgba(3,3,5,0.40)', 'rgba(3,3,5,0.97)']}
            locations={[0, 0.5, 1]}
            style={StyleSheet.absoluteFill}
          />
          {/* Amber glow at bottom for premium */}
          {artist.tier === 'premium' && (
            <View style={styles.premiumGlow} />
          )}

          <View style={styles.featuredContent}>
            <View style={styles.featuredTop}>
              <View style={[styles.statusPill, { borderColor: status.dot + '50' }]}>
                <LiveDot color={status.dot} glow={status.glow} />
                <TText variant="micro" color="secondary" uppercase style={{ marginLeft: 5 }}>{status.label}</TText>
              </View>
              <Animated.View style={saveStyle}>
                <TouchableOpacity onPress={handleSave} style={styles.saveBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons
                    name={isSaved ? 'bookmark' : 'bookmark-outline'}
                    size={19}
                    color={isSaved ? Colors.accentGlow : 'rgba(255,255,255,0.7)'}
                  />
                </TouchableOpacity>
              </Animated.View>
            </View>

            <View style={styles.featuredBottom}>
              <TAvatar uri={artist.avatarUrl} name={artist.blaze} size="lg" isPremium={artist.tier === 'premium'} />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <View style={styles.nameRow}>
                  <TText variant="title1" weight="bold" style={{ color: '#fff', letterSpacing: -0.5 }} numberOfLines={1}>
                    {artist.blaze}
                  </TText>
                  {artist.isVerified && (
                    <Ionicons name="checkmark-circle" size={16} color={Colors.infoLight} style={{ marginLeft: 6 }} />
                  )}
                </View>
                <TText variant="caption" style={{ color: 'rgba(255,255,255,0.50)', marginTop: 2 }}>
                  {artist.city} · {artist.styles.slice(0, 2).join(', ')}
                </TText>
                {artist.minBudget > 0 && (
                  <TText variant="caption" style={{ color: Colors.accentWarm, marginTop: 4, fontWeight: '600' }}>
                    À partir de {artist.minBudget}€
                  </TText>
                )}
              </View>
              {/* Quick book */}
              {artist.bookingStatus === 'open' && (
                <TouchableOpacity
                  onPress={() => router.push(`/artist/${artist.id}`)}
                  style={styles.quickBookFeatured}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={[Colors.accentGlow, Colors.accentWarm]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <TText variant="micro" style={{ color: Colors.bgPrimary, fontWeight: '700' }} uppercase>Book</TText>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  if (variant === 'compact') {
    return (
      <Animated.View entering={FadeInUp.delay(index * 50).springify()} style={[styles.compactContainer, cardStyle]}>
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => router.push(`/artist/${artist.id}`)}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={styles.compactInner}
        >
          <Image
            source={{ uri: artist.avatarUrl ?? coverPost?.mediaUrl }}
            style={styles.compactImage}
            contentFit="cover"
          />
          <LinearGradient
            colors={['transparent', 'rgba(3,3,5,0.92)']}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.compactContent}>
            <LiveDot color={status.dot} glow={status.glow} />
            <TText variant="bodySmall" weight="semibold" style={{ color: '#fff', marginTop: 4 }} numberOfLines={1}>
              {artist.blaze}
            </TText>
            <TText variant="caption" style={{ color: 'rgba(255,255,255,0.45)' }} numberOfLines={1}>
              {artist.city}
            </TText>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  // Default variant
  return (
    <Animated.View
      entering={FadeInUp.delay(index * 70).springify()}
      style={[styles.defaultContainer, cardStyle]}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPress={() => router.push(`/artist/${artist.id}`)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        {/* Gallery strip */}
        <View style={styles.galleryStrip}>
          {artistPosts.length > 0 ? (
            artistPosts.map((post, i) => (
              <View key={post.id} style={[styles.galleryCell, i === 0 && styles.galleryCellFirst]}>
                <Image source={{ uri: post.mediaUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
                {i === 0 && (
                  <LinearGradient
                    colors={['transparent', 'rgba(3,3,5,0.3)']}
                    style={StyleSheet.absoluteFill}
                  />
                )}
              </View>
            ))
          ) : (
            [0, 1, 2].map((i) => (
              <View key={i} style={[styles.galleryCell, i === 0 && styles.galleryCellFirst, styles.galleryEmpty]} />
            ))
          )}
          {/* Post count overlay */}
          {artistPosts.length > 3 && (
            <View style={styles.moreOverlay}>
              <TText variant="caption" weight="bold" style={{ color: '#fff' }}>+{artistPosts.length - 3}</TText>
            </View>
          )}
        </View>

        {/* Info row */}
        <View style={styles.infoRow}>
          <TAvatar uri={artist.avatarUrl} name={artist.blaze} size="md" isPremium={artist.tier === 'premium'} />
          <View style={styles.infoText}>
            <View style={styles.nameRow}>
              <TText variant="bodySmall" weight="semibold" numberOfLines={1}>{artist.blaze}</TText>
              {artist.isVerified && (
                <Ionicons name="checkmark-circle" size={13} color={Colors.infoLight} style={{ marginLeft: 4 }} />
              )}
            </View>
            <TText variant="caption" color="tertiary">{artist.city}</TText>
          </View>

          <View style={styles.infoRight}>
            <View style={[styles.statusPill, { borderColor: status.dot + '35' }]}>
              <LiveDot color={status.dot} glow={status.glow} />
              <TText variant="micro" color="secondary" uppercase style={{ marginLeft: 4 }}>{status.label}</TText>
            </View>
            {onSave && (
              <Animated.View style={saveStyle}>
                <TouchableOpacity onPress={handleSave} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons
                    name={isSaved ? 'bookmark' : 'bookmark-outline'}
                    size={17}
                    color={isSaved ? Colors.accentGlow : Colors.textTertiary}
                  />
                </TouchableOpacity>
              </Animated.View>
            )}
          </View>
        </View>

        {/* Price + styles row */}
        <View style={styles.bottomRow}>
          {artist.minBudget > 0 && (
            <View style={styles.priceTag}>
              <TText variant="micro" style={{ color: Colors.accentWarm, fontWeight: '600' }}>
                dès {artist.minBudget}€
              </TText>
            </View>
          )}
          {artist.styles.slice(0, 3).map((s) => (
            <View key={s} style={styles.styleChip}>
              <TText variant="micro" color="secondary" uppercase style={{ letterSpacing: 0.5 }}>{s}</TText>
            </View>
          ))}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // ── Featured ─────────────────────────────────────────────────
  featuredContainer: {
    height: 300,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
    ...GlowShadow.amberStrong,
    borderWidth: 1,
    borderColor: Colors.borderGlow,
  },
  featuredInner: { flex: 1 },
  premiumGlow: {
    position: 'absolute',
    bottom: -30,
    left: '5%',
    right: '5%',
    height: 100,
    backgroundColor: Colors.accentWarm,
    opacity: 0.10,
    borderRadius: 999,
  },
  featuredContent: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    padding: Spacing.sm,
  },
  featuredTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  featuredBottom: { flexDirection: 'row', alignItems: 'flex-end' },
  saveBtn: {
    width: 36, height: 36,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  quickBookFeatured: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: Radius.full,
    overflow: 'hidden',
    marginLeft: Spacing.xs,
    alignSelf: 'flex-end',
    marginBottom: 2,
  },

  // ── Compact ───────────────────────────────────────────────────
  compactContainer: {
    width: 130, height: 175,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    marginRight: Spacing['2xs'],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderSubtle,
  },
  compactInner: { flex: 1 },
  compactImage: { ...StyleSheet.absoluteFillObject },
  compactContent: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: Spacing['2xs'] },

  // ── Default ───────────────────────────────────────────────────
  defaultContainer: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    marginBottom: Spacing.sm,
  },
  galleryStrip: { height: 150, flexDirection: 'row' },
  galleryCell: { flex: 1, overflow: 'hidden', marginLeft: 1.5 },
  galleryCellFirst: { marginLeft: 0 },
  galleryEmpty: { backgroundColor: Colors.bgSubtle },
  moreOverlay: {
    position: 'absolute', right: 0, bottom: 0,
    width: '33.3%', height: '100%',
    backgroundColor: 'rgba(3,3,5,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing['2xs'],
    gap: Spacing['2xs'],
  },
  infoText: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  infoRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.025)',
  },

  bottomRow: {
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.xs,
    paddingTop: 6,
    flexWrap: 'wrap',
  },
  priceTag: {
    backgroundColor: Colors.accentMuted,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.borderGlow,
  },
  styleChip: {
    backgroundColor: Colors.bgSubtle,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderDefault,
  },
});
