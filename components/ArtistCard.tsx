import React, { useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, FadeInUp,
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
const CARD_W = SCREEN_W - Spacing.sm * 2;

const STATUS_CONFIG = {
  open:   { color: Colors.success,  label: 'Disponible', dot: '#34D399' },
  paused: { color: Colors.warning,  label: 'En pause',   dot: '#FBBF24' },
  closed: { color: Colors.error,    label: 'Fermé',      dot: '#F87171' },
};

export function ArtistCard({ artist, isSaved = false, onSave, index = 0, variant = 'default' }: ArtistCardProps) {
  const router = useRouter();
  const artistPosts = POSTS.filter((p) => p.artistId === artist.id).slice(0, 3);
  const coverPost   = artistPosts[0];
  const status      = STATUS_CONFIG[artist.bookingStatus];

  const scale     = useSharedValue(1);
  const saveScale = useSharedValue(1);

  const handlePressIn  = () => scale.value = withSpring(0.97, { damping: 20 });
  const handlePressOut = () => scale.value = withSpring(1,    { damping: 15 });

  const handleSave = useCallback(() => {
    saveScale.value = withSpring(1.4, { damping: 4 }, () => {
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
          {/* Full bleed cover */}
          <Image
            source={{ uri: artist.coverUrl ?? coverPost?.mediaUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
          <LinearGradient
            colors={['transparent', 'rgba(5,5,8,0.5)', 'rgba(5,5,8,0.95)']}
            locations={[0, 0.5, 1]}
            style={StyleSheet.absoluteFill}
          />
          {/* Premium glow accent */}
          {artist.tier === 'premium' && (
            <View style={styles.premiumGlow} />
          )}
          {/* Content */}
          <View style={styles.featuredContent}>
            <View style={styles.featuredTop}>
              <View style={[styles.statusPill, { borderColor: status.dot + '40' }]}>
                <View style={[styles.statusDot, { backgroundColor: status.dot }]} />
                <TText variant="micro" color="secondary" uppercase>{status.label}</TText>
              </View>
              <Animated.View style={saveStyle}>
                <TouchableOpacity onPress={handleSave} style={styles.saveBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons
                    name={isSaved ? 'bookmark' : 'bookmark-outline'}
                    size={20}
                    color={isSaved ? Colors.accentGlow : 'rgba(255,255,255,0.7)'}
                  />
                </TouchableOpacity>
              </Animated.View>
            </View>

            <View style={styles.featuredBottom}>
              <TAvatar uri={artist.avatarUrl} name={artist.blaze} size="lg" isPremium={artist.tier === 'premium'} />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <View style={styles.nameRow}>
                  <TText variant="title1" weight="bold" style={{ color: '#fff' }} numberOfLines={1}>
                    {artist.blaze}
                  </TText>
                  {artist.isVerified && (
                    <Ionicons name="checkmark-circle" size={16} color={Colors.info} style={{ marginLeft: 6 }} />
                  )}
                </View>
                <TText variant="caption" style={{ color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>
                  {artist.city} · {artist.styles.slice(0, 2).join(', ')}
                </TText>
                {artist.minBudget > 0 && (
                  <TText variant="caption" style={{ color: Colors.accentWarm, marginTop: 4 }}>
                    À partir de {artist.minBudget}€
                  </TText>
                )}
              </View>
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
            colors={['transparent', 'rgba(5,5,8,0.90)']}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.compactContent}>
            <View style={[styles.statusDotSmall, { backgroundColor: status.dot }]} />
            <TText variant="bodySmall" weight="semibold" style={{ color: '#fff' }} numberOfLines={1}>
              {artist.blaze}
            </TText>
            <TText variant="caption" style={{ color: 'rgba(255,255,255,0.5)' }} numberOfLines={1}>
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
        {/* Gallery strip — 3 images */}
        <View style={styles.galleryStrip}>
          {artistPosts.length > 0 ? (
            artistPosts.map((post, i) => (
              <View key={post.id} style={[styles.galleryCell, i === 0 && styles.galleryCellFirst]}>
                <Image source={{ uri: post.mediaUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
              </View>
            ))
          ) : (
            [0, 1, 2].map((i) => (
              <View key={i} style={[styles.galleryCell, i === 0 && styles.galleryCellFirst, styles.galleryEmpty]} />
            ))
          )}
        </View>

        {/* Info row */}
        <View style={styles.infoRow}>
          <TAvatar uri={artist.avatarUrl} name={artist.blaze} size="md" isPremium={artist.tier === 'premium'} />
          <View style={styles.infoText}>
            <View style={styles.nameRow}>
              <TText variant="bodySmall" weight="semibold" numberOfLines={1}>{artist.blaze}</TText>
              {artist.isVerified && (
                <Ionicons name="checkmark-circle" size={13} color={Colors.info} style={{ marginLeft: 4 }} />
              )}
            </View>
            <TText variant="caption" color="tertiary">{artist.city}</TText>
          </View>

          <View style={styles.infoRight}>
            <View style={[styles.statusPill, { borderColor: status.dot + '30' }]}>
              <View style={[styles.statusDot, { backgroundColor: status.dot }]} />
              <TText variant="micro" color="secondary" uppercase>{status.label}</TText>
            </View>
            {onSave && (
              <Animated.View style={saveStyle}>
                <TouchableOpacity onPress={handleSave} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons
                    name={isSaved ? 'bookmark' : 'bookmark-outline'}
                    size={18}
                    color={isSaved ? Colors.accentGlow : Colors.textTertiary}
                  />
                </TouchableOpacity>
              </Animated.View>
            )}
          </View>
        </View>

        {/* Style chips */}
        {artist.styles.length > 0 && (
          <View style={styles.stylesRow}>
            {artist.styles.slice(0, 3).map((s) => (
              <View key={s} style={styles.styleChip}>
                <TText variant="micro" color="secondary" uppercase>{s}</TText>
              </View>
            ))}
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // ── Featured ────────────────────────────────────────────
  featuredContainer: {
    height: 280,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
    ...GlowShadow.amber,
    borderWidth: 1,
    borderColor: Colors.borderGlow,
  },
  featuredInner: { flex: 1 },
  premiumGlow: {
    position: 'absolute',
    bottom: -40,
    left: '10%',
    right: '10%',
    height: 120,
    backgroundColor: Colors.accentWarm,
    opacity: 0.08,
    borderRadius: 999,
    filter: [{ blur: 40 }] as any,
  },
  featuredContent: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    padding: Spacing.sm,
  },
  featuredTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  featuredBottom: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  saveBtn: {
    width: 36, height: 36,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },

  // ── Compact ─────────────────────────────────────────────
  compactContainer: {
    width: 130,
    height: 170,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    marginRight: Spacing['2xs'],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderSubtle,
  },
  compactInner: { flex: 1 },
  compactImage: { ...StyleSheet.absoluteFillObject },
  compactContent: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    padding: Spacing['2xs'],
  },
  statusDotSmall: {
    width: 6, height: 6,
    borderRadius: 3,
    marginBottom: 4,
  },

  // ── Default ─────────────────────────────────────────────
  defaultContainer: {
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    marginBottom: Spacing.sm,
  },
  galleryStrip: {
    height: 140,
    flexDirection: 'row',
  },
  galleryCell: {
    flex: 1,
    overflow: 'hidden',
    marginLeft: 1.5,
  },
  galleryCellFirst: { marginLeft: 0 },
  galleryEmpty: { backgroundColor: Colors.bgSubtle },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing['2xs'],
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
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  statusDot: {
    width: 6, height: 6, borderRadius: 3,
  },

  stylesRow: {
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing['2xs'],
  },
  styleChip: {
    backgroundColor: Colors.bgSubtle,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderSubtle,
  },
});
