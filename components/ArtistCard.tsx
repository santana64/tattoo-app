import React from 'react';
import { View, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Radius } from '@/constants/theme';
import { TText } from './ui/TText';
import { TAvatar } from './ui/TAvatar';
import { TBadge } from './ui/TBadge';
import { TChip } from './ui/TChip';
import type { Artist } from '@/constants/mock-data';
import { POSTS } from '@/constants/mock-data';

interface ArtistCardProps {
  artist: Artist;
  isSaved?: boolean;
  onSave?: (id: string) => void;
}

export function ArtistCard({ artist, isSaved = false, onSave }: ArtistCardProps) {
  const router = useRouter();
  const artistPosts = POSTS.filter((p) => p.artistId === artist.id).slice(0, 3);

  const bookingBadge = {
    open: { variant: 'success' as const, label: 'Ouvert' },
    paused: { variant: 'warning' as const, label: 'En pause' },
    closed: { variant: 'error' as const, label: 'Fermé' },
  }[artist.bookingStatus];

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      style={styles.container}
      onPress={() => router.push(`/artist/${artist.id}`)}
    >
      {/* Gallery strip */}
      <View style={styles.gallery}>
        {artistPosts.length > 0
          ? artistPosts.map((post, i) => (
              <Image
                key={post.id}
                source={{ uri: post.mediaUrl }}
                style={[styles.galleryImage, i === 0 && styles.galleryImageFirst]}
                contentFit="cover"
              />
            ))
          : [0, 1, 2].map((i) => (
              <View key={i} style={[styles.galleryImage, styles.galleryPlaceholder, i === 0 && styles.galleryImageFirst]} />
            ))}
      </View>

      {/* Info */}
      <View style={styles.info}>
        <View style={styles.infoLeft}>
          <TAvatar
            uri={artist.avatarUrl}
            name={artist.blaze}
            size="md"
            isPremium={artist.tier === 'premium'}
          />
          <View style={styles.infoText}>
            <View style={styles.nameRow}>
              <TText variant="bodySmall" weight="semibold" numberOfLines={1}>
                {artist.blaze}
              </TText>
              {artist.isVerified && (
                <Ionicons name="checkmark-circle" size={14} color={Colors.info} style={{ marginLeft: 4 }} />
              )}
              {artist.tier === 'premium' && (
                <TBadge label="PRO" variant="premium" style={{ marginLeft: 6 }} />
              )}
            </View>
            <TText variant="caption" color="tertiary">
              {artist.city}
            </TText>
          </View>
        </View>
        <View style={styles.infoRight}>
          <TBadge label={bookingBadge.label} variant={bookingBadge.variant} dot />
          {onSave && (
            <TouchableOpacity onPress={() => onSave(artist.id)} style={styles.saveButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons
                name={isSaved ? 'bookmark' : 'bookmark-outline'}
                size={18}
                color={isSaved ? Colors.accent : Colors.textTertiary}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Styles */}
      <View style={styles.stylesRow}>
        {artist.styles.map((s) => (
          <TChip key={s} label={s} style={{ marginRight: 6, marginBottom: 0 }} />
        ))}
        <TText variant="caption" color="tertiary">
          · {artist.city}
        </TText>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    marginBottom: Spacing.sm,
  },
  gallery: {
    flexDirection: 'row',
    height: 120,
  },
  galleryImage: {
    flex: 1,
    backgroundColor: Colors.bgSurface,
    marginLeft: 1,
  },
  galleryImageFirst: {
    marginLeft: 0,
  },
  galleryPlaceholder: {
    backgroundColor: Colors.bgSubtle,
  },
  info: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing['2xs'],
  },
  infoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  infoText: {
    marginLeft: Spacing['2xs'],
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  saveButton: {
    padding: 4,
  },
  stylesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing['2xs'],
    flexWrap: 'wrap',
  },
});
