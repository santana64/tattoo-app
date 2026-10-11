import React, { useCallback } from 'react';
import { View, StyleSheet, Pressable, Platform, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withSequence } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Radius, SpringConfig } from '@/constants/theme';
import { TText } from './ui/TText';
import { TAvatar } from './ui/TAvatar';
import type { Artist } from '@/constants/mock-data';
import { STYLES } from '@/constants/mock-data';

interface ArtistCardProps {
  artist: Artist;
  isSaved?: boolean;
  onSave?: (id: string) => void;
  index?: number;
  variant?: 'default' | 'featured' | 'compact' | 'tile';
  /** Latest published work, newest first. Falls back to the cover image. */
  previewImages?: string[];
}

export const BOOKING_STATUS = {
  open:   { label: 'Prend des projets', short: 'Ouvert',     color: Colors.success },
  paused: { label: 'Liste d’attente',   short: 'En attente', color: Colors.warning },
  closed: { label: 'Complet',           short: 'Complet',    color: Colors.textTertiary },
} as const;

const STYLE_NAMES = new Map(STYLES.map((s) => [s.slug, s.name]));
export const styleName = (slug: string) => STYLE_NAMES.get(slug) ?? slug;

const formatPrice = (amount: number) => `dès ${amount.toLocaleString('fr-FR')} €`;

/** Shown when an artist has no published work yet: their monogram, softly lit. */
export function ArtPlaceholder({ name, size = 56 }: { name: string; size?: number }) {
  const initials = name.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  return (
    <View style={[StyleSheet.absoluteFill, styles.placeholder]}>
      <LinearGradient
        colors={['rgba(201,164,106,0.12)', 'rgba(201,164,106,0.02)']}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <TText variant="displayL" italic style={{ fontSize: size, lineHeight: size * 1.1, color: 'rgba(221,187,130,0.55)' }}>
        {initials}
      </TText>
    </View>
  );
}

function StatusLine({ status }: { status: Artist['bookingStatus'] }) {
  const s = BOOKING_STATUS[status];
  return (
    <View style={styles.statusLine}>
      <View style={[styles.statusDot, { backgroundColor: s.color }]} />
      <TText variant="caption" color="secondary">{s.label}</TText>
    </View>
  );
}

function SaveButton({ saved, onPress, onImage }: { saved: boolean; onPress: () => void; onImage?: boolean }) {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={anim}>
      <Pressable
        onPress={() => {
          scale.value = withSequence(withSpring(1.18, SpringConfig.snappy), withSpring(1, SpringConfig.gentle));
          if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
        accessibilityRole="button"
        accessibilityLabel={saved ? 'Retirer des favoris' : 'Ajouter aux favoris'}
        accessibilityState={{ selected: saved }}
        hitSlop={8}
        style={[styles.saveBtn, onImage && styles.saveBtnOnImage]}
      >
        <Ionicons
          name={saved ? 'bookmark' : 'bookmark-outline'}
          size={17}
          color={saved ? Colors.accentGlow : onImage ? Colors.textPrimary : Colors.textSecondary}
        />
      </Pressable>
    </Animated.View>
  );
}

/** Lift-on-press wrapper shared by every variant. */
function useLift() {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return {
    style,
    onPressIn: () => { scale.value = withSpring(0.985, SpringConfig.snappy); },
    onPressOut: () => { scale.value = withSpring(1, SpringConfig.gentle); },
  };
}

export function ArtistCard({ artist, isSaved = false, onSave, variant = 'default', previewImages }: ArtistCardProps) {
  const router = useRouter();
  const lift = useLift();
  const { width: windowWidth } = useWindowDimensions();
  const open = useCallback(() => router.push(`/artist/${artist.id}`), [artist.id, router]);
  const save = useCallback(() => onSave?.(artist.id), [artist.id, onSave]);

  const images = (previewImages?.length ? previewImages : [artist.coverUrl]).filter(Boolean);
  const stylesLabel = artist.styles.slice(0, 2).map(styleName).join(' · ');
  const a11y = `${artist.blaze}, ${artist.city}${stylesLabel ? `, ${stylesLabel}` : ''}`;

  // ── Featured: a single lit artwork, full bleed ─────────────────
  if (variant === 'featured') {
    return (
      <Animated.View style={[styles.featured, windowWidth >= 900 && styles.featuredWide, lift.style]}>
        <Pressable onPress={open} onPressIn={lift.onPressIn} onPressOut={lift.onPressOut} accessibilityRole="link" accessibilityLabel={a11y} style={{ flex: 1 }}>
          {images[0] ? (
            <Image source={{ uri: images[0] }} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} />
          ) : <ArtPlaceholder name={artist.blaze} size={120} />}
          <LinearGradient
            colors={['rgba(11,10,9,0.25)', 'rgba(11,10,9,0)', 'rgba(11,10,9,0.92)']}
            locations={[0, 0.35, 1]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.featuredTop}>
            {artist.tier === 'premium' ? (
              <View style={styles.sponsoredTag}>
                <TText variant="micro" uppercase style={{ color: Colors.accentGlow }}>Mis en avant</TText>
              </View>
            ) : <View />}
            {onSave && <SaveButton saved={isSaved} onPress={save} onImage />}
          </View>
          <View style={styles.featuredBottom}>
            <TText variant="displayM" numberOfLines={1}>{artist.blaze}</TText>
            <TText variant="bodySmall" color="secondary" style={{ marginTop: 2 }} numberOfLines={1}>
              {artist.city}{stylesLabel ? ` — ${stylesLabel}` : ''}
            </TText>
            <View style={styles.featuredMeta}>
              <StatusLine status={artist.bookingStatus} />
              {artist.minBudget > 0 && (
                <TText variant="bodySmall" weight="medium" tabular style={{ color: Colors.accentGlow }}>
                  {formatPrice(artist.minBudget)}
                </TText>
              )}
            </View>
          </View>
        </Pressable>
      </Animated.View>
    );
  }

  // ── Compact: horizontal rails ──────────────────────────────────
  if (variant === 'compact') {
    return (
      <Animated.View style={[styles.compact, lift.style]}>
        <Pressable onPress={open} onPressIn={lift.onPressIn} onPressOut={lift.onPressOut} accessibilityRole="link" accessibilityLabel={a11y}>
          <View style={styles.compactImage}>
            {images[0] || artist.avatarUrl ? (
              <Image source={{ uri: images[0] || artist.avatarUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
            ) : <ArtPlaceholder name={artist.blaze} size={40} />}
          </View>
          <TText variant="bodySmall" weight="semibold" numberOfLines={1} style={{ marginTop: 8 }}>{artist.blaze}</TText>
          <TText variant="caption" color="tertiary" numberOfLines={1}>{artist.city}</TText>
        </Pressable>
      </Animated.View>
    );
  }

  // ── Tile: two-column grid ──────────────────────────────────────
  if (variant === 'tile') {
    return (
      <Animated.View style={[styles.tile, lift.style]}>
        <Pressable onPress={open} onPressIn={lift.onPressIn} onPressOut={lift.onPressOut} accessibilityRole="link" accessibilityLabel={a11y}>
          <View style={styles.tileImage}>
            {images[0] ? (
              <Image source={{ uri: images[0] }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
            ) : <ArtPlaceholder name={artist.blaze} size={48} />}
            {onSave && <View style={styles.tileSave}><SaveButton saved={isSaved} onPress={save} onImage /></View>}
          </View>
          <View style={styles.tileText}>
            <TText variant="title2" serif numberOfLines={1} style={{ fontSize: 20 }}>{artist.blaze}</TText>
            <TText variant="caption" color="tertiary" numberOfLines={1}>{artist.city}</TText>
            {artist.minBudget > 0 && (
              <TText variant="caption" tabular style={{ color: Colors.accentWarm, marginTop: 2 }}>{formatPrice(artist.minBudget)}</TText>
            )}
          </View>
        </Pressable>
      </Animated.View>
    );
  }

  // ── Default: portfolio mosaic + caption, like a wall label ─────
  const [lead, ...rest] = images;
  const side = rest.slice(0, 2);
  return (
    <Animated.View style={[styles.card, lift.style]}>
      <Pressable onPress={open} onPressIn={lift.onPressIn} onPressOut={lift.onPressOut} accessibilityRole="link" accessibilityLabel={a11y}>
        <View style={styles.mosaic}>
          <View style={[styles.mosaicLead, side.length === 0 && { flex: 1 }]}>
            {lead ? (
              <Image source={{ uri: lead }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
            ) : <ArtPlaceholder name={artist.blaze} size={72} />}
          </View>
          {side.length > 0 && (
            <View style={styles.mosaicSide}>
              {side.map((uri) => (
                <View key={uri} style={styles.mosaicCell}>
                  <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.caption}>
          <TAvatar uri={artist.avatarUrl} name={artist.blaze} size="md" />
          <View style={styles.captionText}>
            <View style={styles.nameRow}>
              <TText variant="title1" serif numberOfLines={1} style={styles.name}>{artist.blaze}</TText>
              {artist.isVerified && (
                <Ionicons name="checkmark-circle" size={15} color={Colors.accentWarm} accessibilityLabel="Profil vérifié" />
              )}
            </View>
            <TText variant="caption" color="secondary" numberOfLines={1}>
              {artist.city}{stylesLabel ? ` · ${stylesLabel}` : ''}
            </TText>
          </View>
          {onSave && <SaveButton saved={isSaved} onPress={save} />}
        </View>

        <View style={styles.metaRow}>
          <StatusLine status={artist.bookingStatus} />
          {artist.minBudget > 0 && (
            <TText variant="bodySmall" weight="medium" tabular style={{ color: Colors.accentGlow }}>
              {formatPrice(artist.minBudget)}
            </TText>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  imageEmpty: { backgroundColor: Colors.bgSurface },
  placeholder: { backgroundColor: Colors.bgElevated, alignItems: 'center', justifyContent: 'center' },

  statusLine: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },

  saveBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderDefault,
  },
  saveBtnOnImage: { backgroundColor: 'rgba(11,10,9,0.55)', borderColor: Colors.glassBorderBright },

  // Featured
  featured: {
    aspectRatio: 4 / 5,
    maxHeight: 520,
    borderRadius: Radius['2xl'],
    overflow: 'hidden',
    marginBottom: Spacing.xl,
    backgroundColor: Colors.bgSurface,
  },
  // Wide screens: a cinematic banner instead of a portrait print.
  featuredWide: { aspectRatio: 21 / 9, maxHeight: 460 },
  featuredTop: {
    position: 'absolute', top: Spacing.sm, left: Spacing.sm, right: Spacing.sm,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  sponsoredTag: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.xs,
    backgroundColor: 'rgba(11,10,9,0.6)',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderGlow,
  },
  featuredBottom: { position: 'absolute', left: Spacing.md, right: Spacing.md, bottom: Spacing.md },
  featuredMeta: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: Spacing.sm, paddingTop: Spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.glassBorderBright,
  },

  // Compact
  compact: { width: 132, marginRight: Spacing.xs },
  compactImage: { width: 132, height: 168, borderRadius: Radius.lg, overflow: 'hidden', backgroundColor: Colors.bgSurface },

  // Tile
  tile: { flex: 1, marginBottom: Spacing.lg },
  tileImage: { aspectRatio: 4 / 5, borderRadius: Radius.lg, overflow: 'hidden', backgroundColor: Colors.bgSurface },
  tileSave: { position: 'absolute', top: 8, right: 8 },
  tileText: { marginTop: 10, gap: 1 },

  // Default
  card: { marginBottom: Spacing.xl },
  mosaic: { flexDirection: 'row', height: 232, gap: 3, borderRadius: Radius.xl, overflow: 'hidden' },
  mosaicLead: { flex: 2, backgroundColor: Colors.bgSurface, overflow: 'hidden' },
  mosaicSide: { flex: 1, gap: 3 },
  mosaicCell: { flex: 1, backgroundColor: Colors.bgSurface, overflow: 'hidden' },

  caption: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14 },
  captionText: { flex: 1, gap: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 24, lineHeight: 28, flexShrink: 1 },

  metaRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 12, paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.borderDefault,
  },
});
