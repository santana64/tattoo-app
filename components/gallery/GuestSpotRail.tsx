import React, { useCallback, useRef, useState } from 'react';
import { View, StyleSheet, ScrollView, Modal } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Colors, Spacing, Radius, Layout } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TButton } from '@/components/ui/TButton';
import { TSkeleton } from '@/components/ui/TSkeleton';
import { Toast } from '@/components/ui/TToast';
import { BottomSheet, PressableScale, RevealImage } from '@/components/motion';
import { ArtPlaceholder } from '@/components/ArtistCard';
import { useAuthStore } from '@/store/auth-store';
import {
  deleteGuestSpot, fetchArtistGuestSpots, fetchUpcomingGuestSpots, formatGuestDates, type GuestSpot,
} from '@/lib/studio';

interface GuestSpotRailProps {
  /** One artist's guest spots; omitted = upcoming guest spots across artists. */
  artistId?: string;
  /** The artist's own rail: adds an "announce" tile and a delete button on each card. */
  ownerActions?: boolean;
}

type RailGuest = GuestSpot & { artist?: { id: string; blaze: string } | null };

const CARD_W = 264;
const COVER_H = 150;
/** Lets the bottom sheet slide out before its Modal unmounts. */
const SHEET_EXIT_MS = 280;

function placesLeft(spot: Pick<GuestSpot, 'slots_total' | 'slots_booked'>): string {
  const left = Math.max(spot.slots_total - spot.slots_booked, 0);
  if (left === 0) return 'Complet';
  return left === 1 ? '1 place' : `${left} places`;
}

function GuestCard({ spot, showArtist, onPress }: { spot: RailGuest; showArtist: boolean; onPress: () => void }) {
  const where = `${spot.host_city} · ${spot.host_studio}`;
  const dates = formatGuestDates(spot.date_from, spot.date_to);
  const places = placesLeft(spot);
  const full = places === 'Complet';
  const artistName = spot.artist?.blaze;
  const label = [
    showArtist && artistName ? `${artistName} en guest` : 'Guest',
    `à ${spot.host_city}, ${spot.host_studio}`,
    dates,
    `dès ${spot.price_from.toLocaleString('fr-FR')} €`,
    places,
  ].join(', ');

  return (
    <PressableScale onPress={onPress} accessibilityRole="link" accessibilityLabel={label} style={styles.card}>
      <View style={styles.cover}>
        <RevealImage
          uri={spot.cover_image_url}
          style={StyleSheet.absoluteFill}
          fallback={<ArtPlaceholder name={artistName ?? spot.host_city} size={40} />}
        />
        <View style={styles.dates}>
          <TText variant="caption" weight="semibold" tabular>{dates}</TText>
        </View>
      </View>
      <View style={styles.body}>
        {showArtist && !!artistName && (
          <TText variant="label" color="accentWarm" uppercase numberOfLines={1}>{artistName}</TText>
        )}
        <TText variant="title2" serif numberOfLines={1} style={styles.where}>{where}</TText>
        <View style={styles.metaRow}>
          <TText variant="bodySmall" tabular style={{ color: Colors.accentGlow }}>
            dès {spot.price_from.toLocaleString('fr-FR')} €
          </TText>
          <View style={styles.places}>
            <View style={[styles.dot, { backgroundColor: full ? Colors.textTertiary : Colors.success }]} />
            <TText variant="caption" color="secondary">{places}</TText>
          </View>
        </View>
      </View>
    </PressableScale>
  );
}

function AnnounceTile({ onPress }: { onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel="Annoncer un guest" style={[styles.card, styles.announce]}>
      <View style={styles.announceRing}>
        <Ionicons name="add" size={20} color={Colors.accentWarm} />
      </View>
      <TText variant="bodySmall" weight="medium">Annoncer un guest</TText>
      <TText variant="caption" color="tertiary" style={{ textAlign: 'center' }}>
        Quelques jours dans un autre studio, une autre ville.
      </TText>
    </PressableScale>
  );
}

function SkeletonCard() {
  return (
    <View style={[styles.card, styles.skeletonCard]}>
      <TSkeleton width={CARD_W} height={COVER_H} radius={0} />
      <View style={styles.body}>
        <TSkeleton width="70%" height={16} />
        <TSkeleton width="45%" height={12} style={{ marginTop: 8 }} />
      </View>
    </View>
  );
}

/** Guest spots: an artist working away for a few days. */
export function GuestSpotRail({ artistId, ownerActions = false }: GuestSpotRailProps) {
  const router = useRouter();
  const { user } = useAuthStore();
  const [items, setItems] = useState<RailGuest[] | null>(null);
  const [pendingDelete, setPendingDelete] = useState<RailGuest | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const request = useRef(0);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reloads on focus, so a guest announced elsewhere shows up on return.
  useFocusEffect(
    useCallback(() => {
      const version = ++request.current;
      const load: Promise<RailGuest[]> = artistId ? fetchArtistGuestSpots(artistId) : fetchUpcomingGuestSpots(10);
      load
        .then((list) => { if (version === request.current) setItems(list); })
        // Silent: a rail that cannot load simply stays out of the way.
        .catch(() => { if (version === request.current) setItems((prev) => prev ?? []); });
      return () => {
        request.current++;
        if (closeTimer.current) clearTimeout(closeTimer.current);
      };
    }, [artistId]),
  );

  const askDelete = (spot: RailGuest) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setPendingDelete(spot);
    setSheetVisible(true);
  };

  const closeSheet = () => {
    setSheetVisible(false);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setPendingDelete(null), SHEET_EXIT_MS);
  };

  const confirmDelete = async () => {
    if (!pendingDelete || deleting) return;
    setDeleting(true);
    const ok = await deleteGuestSpot(pendingDelete.id);
    setDeleting(false);
    if (!ok) { Toast.error('Suppression impossible. Réessayez.'); return; }
    const removed = pendingDelete.id;
    setItems((prev) => (prev ?? []).filter((s) => s.id !== removed));
    closeSheet();
    Toast.success('Guest supprimé');
  };

  const loading = items === null;
  const list = items ?? [];
  if (!loading && list.length === 0 && !ownerActions) return null;

  const showArtist = !artistId;
  const title = artistId ? 'En guest' : 'Guests à venir';

  return (
    <View>
      <View style={styles.head}>
        <TText variant="displayS" accessibilityRole="header">{title}</TText>
        {!loading && list.length > 0 && (
          <TText variant="caption" color="tertiary" tabular>
            {list.length} date{list.length > 1 ? 's' : ''}
          </TText>
        )}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroller} contentContainerStyle={styles.rail}>
        {ownerActions && <AnnounceTile onPress={() => router.push('/guest/new')} />}
        {loading
          ? [0, 1].map((i) => <SkeletonCard key={i} />)
          : list.map((spot) => {
            const canDelete = ownerActions && !!user?.artistId && user.artistId === spot.artist_id;
            return (
              // The delete button sits beside the card link, never inside it.
              <View key={spot.id} style={styles.cardSlot}>
                <GuestCard
                  spot={spot}
                  showArtist={showArtist}
                  onPress={() => router.push({ pathname: '/artist/[id]', params: { id: spot.artist_id } })}
                />
                {canDelete && (
                  <View style={styles.deleteSlot}>
                    <PressableScale
                      onPress={() => askDelete(spot)}
                      pressedScale={0.92}
                      accessibilityRole="button"
                      accessibilityLabel={`Supprimer le guest à ${spot.host_city}`}
                      hitSlop={6}
                      style={styles.deleteBtn}
                    >
                      <Ionicons name="trash-outline" size={15} color={Colors.textPrimary} />
                    </PressableScale>
                  </View>
                )}
              </View>
            );
          })}
      </ScrollView>

      {/* The sheet lives in a transparent Modal so it covers the whole screen, not just the rail. */}
      <Modal visible={!!pendingDelete} transparent animationType="none" statusBarTranslucent onRequestClose={closeSheet}>
        <GestureHandlerRootView style={styles.modalRoot}>
          <BottomSheet visible={sheetVisible} onClose={closeSheet} accessibilityLabel="Confirmer la suppression du guest">
            <TText variant="displayS">Supprimer ce guest ?</TText>
            {pendingDelete && (
              <TText variant="bodySmall" color="secondary" style={styles.sheetBody}>
                {pendingDelete.host_city} · {pendingDelete.host_studio}, {formatGuestDates(pendingDelete.date_from, pendingDelete.date_to)}.
                {' '}L’annonce disparaîtra de votre profil et de l’exploration.
              </TText>
            )}
            <View style={styles.sheetActions}>
              <TButton
                title="Supprimer le guest"
                variant="destructive"
                loading={deleting}
                disabled={deleting}
                onPress={() => { void confirmDelete(); }}
              />
              <TButton title="Garder l’annonce" variant="secondary" onPress={closeSheet} />
            </View>
          </BottomSheet>
        </GestureHandlerRootView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: Spacing.sm },
  // The rail bleeds to the screen edge while its first card stays on the gutter.
  scroller: { marginHorizontal: -Layout.gutter },
  rail: { gap: Spacing.sm, paddingHorizontal: Layout.gutter },

  cardSlot: { width: CARD_W },
  card: {
    width: CARD_W, borderRadius: Radius.lg, overflow: 'hidden',
    backgroundColor: Colors.bgCard,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderSubtle,
  },
  skeletonCard: { backgroundColor: Colors.bgCard },
  cover: { width: '100%', height: COVER_H, backgroundColor: Colors.bgSurface },
  dates: {
    position: 'absolute', left: 10, bottom: 10,
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: Radius.xs,
    backgroundColor: 'rgba(11,10,9,0.72)',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderBright,
  },
  body: { padding: Spacing.xs, gap: 2 },
  where: { marginTop: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  places: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },

  deleteSlot: { position: 'absolute', top: 8, right: 8 },
  deleteBtn: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(11,10,9,0.65)',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderBright,
  },

  announce: {
    minHeight: COVER_H + 76, alignItems: 'center', justifyContent: 'center', gap: 4,
    padding: Spacing.sm, backgroundColor: 'transparent',
    borderStyle: 'dashed', borderWidth: 1, borderColor: Colors.borderDefault,
  },
  announceRing: {
    width: 44, height: 44, borderRadius: 22, marginBottom: 8,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderGlow,
    backgroundColor: Colors.glassAmber,
  },

  modalRoot: { flex: 1 },
  sheetBody: { marginTop: 6, marginBottom: Spacing.md },
  sheetActions: { gap: Spacing['2xs'] },
});
