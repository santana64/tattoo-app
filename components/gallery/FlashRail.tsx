import React, { useCallback, useRef, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, Spacing, Layout } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TSkeleton } from '@/components/ui/TSkeleton';
import { PressableScale } from '@/components/motion';
import { SectionHead } from '@/components/v5';
import { styleName } from '@/components/ArtistCard';
import { fetchArtistFlashes, fetchAvailableFlashes, flashCopiesLeft, type FlashDesign } from '@/lib/studio';
import { PlateMark, WorkPlate } from './WorkPlate';

interface FlashRailProps {
  /** One artist's flashes; omitted = the latest flashes still available, across artists. */
  artistId?: string;
  title?: string;
  /** Tracked-capitals line above the title. */
  kicker?: string;
  /** The artist's own rail: adds a "new flash" tile and shows unpublished designs. */
  ownerActions?: boolean;
  /** Side padding of the page the rail bleeds out of. */
  gutter?: number;
}

type RailFlash = FlashDesign & { artist?: { id: string; blaze: string; city: string } | null };

const TILE_W = 168;
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
      {/* A drawing on its sheet: contained, never cropped. */}
      <WorkPlate
        uri={flash.image_url}
        contentFit="contain"
        tone="bone"
        style={[styles.print, soldOut && styles.printSoldOut]}
      >
        <PlateMark label={badge} />
        {!flash.is_published && <PlateMark label="Non publié" tone="ink" style={styles.draft} />}
      </WorkPlate>
      <View style={styles.caption}>
        <TText variant="title2" serif numberOfLines={1} style={styles.tileTitle}>{flash.title}</TText>
        <View style={styles.tileMeta}>
          <TText variant="caption" weight="semibold" tabular style={styles.price}>{formatPrice(flash.price)}</TText>
          <TText variant="caption" color="tertiary" numberOfLines={1} style={styles.style}>{styleName(flash.style)}</TText>
        </View>
        {showArtist && !!artistName && (
          <TText variant="micro" weight="bold" uppercase numberOfLines={1} style={styles.artist}>{artistName}</TText>
        )}
      </View>
    </PressableScale>
  );
}

function NewFlashTile({ onPress }: { onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel="Publier un nouveau flash" style={styles.tile}>
      <View style={[styles.print, styles.newPrint]}>
        <View style={styles.newMark}>
          <Ionicons name="add" size={20} color={Colors.flameText} />
        </View>
        <TText variant="label" weight="bold" uppercase style={styles.newLabel}>Nouveau flash</TText>
        <TText variant="caption" color="secondary" style={styles.newLabel}>Un dessin prêt à tatouer</TText>
      </View>
    </PressableScale>
  );
}

function SkeletonTile() {
  return (
    <View style={styles.tile}>
      <TSkeleton width={TILE_W} height={PRINT_H} radius={0} />
      <TSkeleton width="80%" height={14} radius={0} style={{ marginTop: 12 }} />
      <TSkeleton width="45%" height={11} radius={0} style={{ marginTop: 8 }} />
    </View>
  );
}

/** A horizontal rail of ready-to-book flashes, one artist's or across artists. */
export function FlashRail({ artistId, title = 'Flashs disponibles', kicker, ownerActions = false, gutter = Layout.gutter }: FlashRailProps) {
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
  const count = !loading && list.length > 0 ? `${list.length} flash${list.length > 1 ? 's' : ''}` : null;
  const head = [kicker ?? 'Prêts à tatouer', count].filter(Boolean).join(' · ');

  return (
    <View>
      <SectionHead kicker={head} title={title} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -gutter }}
        contentContainerStyle={[styles.rail, { paddingHorizontal: gutter }]}
      >
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
  rail: { gap: Spacing.sm },

  tile: { width: TILE_W },
  // A 3:4 drawing on a white sheet, framed by a hairline.
  print: {
    width: TILE_W, height: PRINT_H,
    backgroundColor: Colors.white,
    borderWidth: 1, borderColor: Colors.line,
  },
  printSoldOut: { opacity: 0.5 },
  draft: { top: 'auto', bottom: 10 },
  caption: { paddingTop: 12 },
  tileTitle: { fontSize: 21, lineHeight: 24, letterSpacing: -0.3 },
  tileMeta: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 4 },
  price: { color: Colors.flameText },
  style: { flexShrink: 1 },
  artist: { marginTop: 6, color: Colors.textSecondary, letterSpacing: 1 },

  newPrint: {
    alignItems: 'center', justifyContent: 'center', gap: 6, padding: Spacing.xs,
    backgroundColor: 'transparent', borderStyle: 'dashed', borderColor: Colors.metal,
  },
  newMark: {
    width: 44, height: 44, marginBottom: 6,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.flame,
  },
  newLabel: { textAlign: 'center' },
});
