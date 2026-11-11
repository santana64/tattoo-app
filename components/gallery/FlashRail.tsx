import React, { useCallback, useRef, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, Spacing, Radius, Layout } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TSkeleton } from '@/components/ui/TSkeleton';
import { PressableScale, RevealImage } from '@/components/motion';
import { ArtPlaceholder, styleName } from '@/components/ArtistCard';
import { fetchArtistFlashes, fetchAvailableFlashes, flashCopiesLeft, type FlashDesign } from '@/lib/studio';

interface FlashRailProps {
  /** One artist's flashes; omitted = the latest flashes still available, across artists. */
  artistId?: string;
  title?: string;
  /** The artist's own rail: adds a "new flash" tile and shows unpublished designs. */
  ownerActions?: boolean;
}

type RailFlash = FlashDesign & { artist?: { id: string; blaze: string; city: string } | null };

const TILE_W = 152;
const PRINT_H = Math.round((TILE_W * 4) / 3);

/** "Unique", "3 restants", "Épuisé". */
function copiesBadge(flash: Pick<FlashDesign, 'total_copies' | 'sold_copies'>): string {
  const left = flashCopiesLeft(flash);
  if (left === 0) return 'Épuisé';
  if (flash.total_copies === 1) return 'Unique';
  return left === 1 ? '1 restant' : `${left} restants`;
}

const formatPrice = (euros: number) => `${euros.toLocaleString('fr-FR')} €`;

function FlashTile({ flash, showArtist, onPress }: { flash: RailFlash; showArtist: boolean; onPress: () => void }) {
  const badge = copiesBadge(flash);
  const soldOut = flashCopiesLeft(flash) === 0;
  const artistName = flash.artist?.blaze;
  const label = [
    `Flash « ${flash.title} »`,
    showArtist && artistName ? `de ${artistName}` : null,
    formatPrice(flash.price),
    badge,
    flash.is_published ? null : 'non publié',
  ].filter(Boolean).join(', ');

  return (
    <PressableScale onPress={onPress} accessibilityRole="link" accessibilityLabel={label} style={styles.tile}>
      <View style={[styles.print, soldOut && styles.printSoldOut]}>
        <RevealImage
          uri={flash.image_url}
          style={StyleSheet.absoluteFill}
          fallback={<ArtPlaceholder name={artistName ?? flash.title} size={36} />}
        />
        <View style={[styles.badge, soldOut && styles.badgeSoldOut]}>
          <TText variant="micro" uppercase style={{ color: soldOut ? Colors.textSecondary : Colors.accentGlow }}>{badge}</TText>
        </View>
        {!flash.is_published && (
          <View style={styles.draft}>
            <TText variant="micro" uppercase color="secondary">Non publié</TText>
          </View>
        )}
      </View>
      <TText variant="bodySmall" weight="medium" numberOfLines={1} style={styles.tileTitle}>{flash.title}</TText>
      <View style={styles.tileMeta}>
        <TText variant="title2" serif tabular style={styles.price}>{formatPrice(flash.price)}</TText>
        <TText variant="caption" color="tertiary" numberOfLines={1} style={{ flexShrink: 1 }}>{styleName(flash.style)}</TText>
      </View>
      {showArtist && !!artistName && (
        <TText variant="caption" color="secondary" numberOfLines={1}>{artistName}</TText>
      )}
    </PressableScale>
  );
}

function NewFlashTile({ onPress }: { onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel="Publier un nouveau flash" style={styles.tile}>
      <View style={[styles.print, styles.newPrint]}>
        <View style={styles.newRing}>
          <Ionicons name="add" size={20} color={Colors.accentWarm} />
        </View>
        <TText variant="bodySmall" weight="medium" style={styles.newLabel}>Nouveau flash</TText>
        <TText variant="caption" color="tertiary" style={styles.newLabel}>Un dessin prêt à tatouer</TText>
      </View>
    </PressableScale>
  );
}

function SkeletonTile() {
  return (
    <View style={styles.tile}>
      <TSkeleton width={TILE_W} height={PRINT_H} radius={Radius.md} />
      <TSkeleton width="80%" height={12} style={{ marginTop: 10 }} />
      <TSkeleton width="45%" height={16} style={{ marginTop: 6 }} />
    </View>
  );
}

/** A horizontal rail of ready-to-book flashes, one artist's or across artists. */
export function FlashRail({ artistId, title = 'Flashs disponibles', ownerActions = false }: FlashRailProps) {
  const router = useRouter();
  const [items, setItems] = useState<RailFlash[] | null>(null);
  const request = useRef(0);

  // Reloads on focus, so a flash created or deleted elsewhere shows up on return.
  useFocusEffect(
    useCallback(() => {
      const version = ++request.current;
      const load: Promise<RailFlash[]> = artistId
        ? fetchArtistFlashes(artistId, ownerActions)
        : fetchAvailableFlashes(12);
      load
        .then((list) => { if (version === request.current) setItems(list); })
        // Silent: a rail that cannot load simply stays out of the way.
        .catch(() => { if (version === request.current) setItems((prev) => prev ?? []); });
      return () => { request.current++; };
    }, [artistId, ownerActions]),
  );

  const loading = items === null;
  const list = items ?? [];
  if (!loading && list.length === 0 && !ownerActions) return null;

  const showArtist = !artistId;

  return (
    <View>
      <View style={styles.head}>
        <TText variant="displayS" accessibilityRole="header">{title}</TText>
        {!loading && list.length > 0 && (
          <TText variant="caption" color="tertiary" tabular>
            {list.length} flash{list.length > 1 ? 's' : ''}
          </TText>
        )}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroller} contentContainerStyle={styles.rail}>
        {ownerActions && <NewFlashTile onPress={() => router.push('/flash/new')} />}
        {loading
          ? [0, 1, 2].map((i) => <SkeletonTile key={i} />)
          : list.map((flash) => (
            <FlashTile
              key={flash.id}
              flash={flash}
              showArtist={showArtist}
              onPress={() => router.push({ pathname: '/flash/[id]', params: { id: flash.id } })}
            />
          ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: Spacing.sm },
  // The rail bleeds to the screen edge while its first tile stays on the gutter.
  scroller: { marginHorizontal: -Layout.gutter },
  rail: { gap: Spacing.sm, paddingHorizontal: Layout.gutter },

  tile: { width: TILE_W },
  // A 3:4 print on a raised plinth.
  print: {
    width: TILE_W, height: PRINT_H, borderRadius: Radius.md, overflow: 'hidden',
    backgroundColor: Colors.bgElevated,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderSubtle,
  },
  printSoldOut: { opacity: 0.55 },
  badge: {
    position: 'absolute', left: 8, top: 8,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: Radius.xs,
    backgroundColor: 'rgba(11,10,9,0.72)',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderGlow,
  },
  badgeSoldOut: { borderColor: Colors.borderDefault },
  draft: {
    position: 'absolute', left: 8, bottom: 8,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: Radius.xs,
    backgroundColor: 'rgba(11,10,9,0.72)',
  },
  tileTitle: { marginTop: 10 },
  tileMeta: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 2 },
  price: { color: Colors.textPrimary },

  newPrint: {
    alignItems: 'center', justifyContent: 'center', gap: 4, padding: Spacing.xs,
    borderStyle: 'dashed', borderWidth: 1, borderColor: Colors.borderDefault,
  },
  newRing: {
    width: 44, height: 44, borderRadius: 22, marginBottom: 8,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderGlow,
    backgroundColor: Colors.glassAmber,
  },
  newLabel: { textAlign: 'center' },
});
