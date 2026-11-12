import React, { useCallback, useRef, useState } from 'react';
import { View, StyleSheet, ScrollView, Modal } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Colors, Spacing, Layout } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TButton } from '@/components/ui/TButton';
import { TSkeleton } from '@/components/ui/TSkeleton';
import { Toast } from '@/components/ui/TToast';
import { BottomSheet, PressableScale } from '@/components/motion';
import { IconButton, SectionHead, StatusDot } from '@/components/v5';
import { PlateMark, WorkPlate } from './WorkPlate';
import { useAuthStore } from '@/store/auth-store';
import {
  deleteGuestSpot, fetchArtistGuestSpots, fetchUpcomingGuestSpots, formatGuestDates, type GuestSpot,
} from '@/lib/studio';

interface GuestSpotRailProps {
  /** One artist's guest spots; omitted = upcoming guest spots across artists. */
  artistId?: string;
  /** The artist's own rail: adds an "announce" tile and a delete button on each card. */
  ownerActions?: boolean;
  /** Side padding of the page the rail bleeds out of. */
  gutter?: number;
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
      <WorkPlate uri={spot.cover_image_url} tone="slate" style={styles.cover}>
        <PlateMark label={dates} />
      </WorkPlate>
      <View style={styles.body}>
        <TText variant="label" weight="bold" uppercase numberOfLines={1} style={styles.kicker}>
          {showArtist && artistName ? `${artistName} · ${spot.host_city}` : spot.host_city}
        </TText>
        <TText variant="title2" serif numberOfLines={1} style={styles.where}>{spot.host_studio}</TText>
        <View style={styles.metaRow}>
          <TText variant="caption" weight="semibold" tabular style={styles.price}>
            dès {spot.price_from.toLocaleString('fr-FR')} €
          </TText>
          <StatusDot tone={full ? 'closed' : 'open'} label={places} />
        </View>
      </View>
    </PressableScale>
  );
}

function AnnounceTile({ onPress }: { onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel="Annoncer un guest" style={[styles.card, styles.announce]}>
      <View style={styles.announceMark}>
        <Ionicons name="add" size={20} color={Colors.flameText} />
      </View>
      <TText variant="label" weight="bold" uppercase>Annoncer un guest</TText>
      <TText variant="caption" color="secondary" style={{ textAlign: 'center' }}>
        Quelques jours dans un autre studio, une autre ville.
      </TText>
    </PressableScale>
  );
}

function SkeletonCard() {
  return (
    <View style={styles.card}>
      <TSkeleton width={CARD_W - 2} height={COVER_H} radius={0} />
      <View style={styles.body}>
        <TSkeleton width="40%" height={10} radius={0} />
        <TSkeleton width="70%" height={18} radius={0} style={{ marginTop: 8 }} />
        <TSkeleton width="45%" height={12} radius={0} style={{ marginTop: 10 }} />
      </View>
    </View>
  );
}

/** Guest spots: an artist working away for a few days. */
export function GuestSpotRail({ artistId, ownerActions = false, gutter = Layout.gutter }: GuestSpotRailProps) {
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
  const count = !loading && list.length > 0 ? `${list.length} date${list.length > 1 ? 's' : ''}` : null;

  return (
    <View>
      <SectionHead
        kicker={[artistId ? 'Hors les murs' : 'Agenda des guests', count].filter(Boolean).join(' · ')}
        title={title}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -gutter }}
        contentContainerStyle={[styles.rail, { paddingHorizontal: gutter }]}
      >
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
                    <IconButton
                      icon="trash-outline"
                      label={`Supprimer le guest à ${spot.host_city}`}
                      onPress={() => askDelete(spot)}
                      plate
                      size={36}
                    />
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
  rail: { gap: Spacing.sm },

  cardSlot: { width: CARD_W },
  card: {
    width: CARD_W, overflow: 'hidden',
    backgroundColor: Colors.white,
    borderWidth: 1, borderColor: Colors.line,
  },
  cover: { width: '100%', height: COVER_H },
  body: { paddingHorizontal: Spacing.sm, paddingTop: Spacing.xs, paddingBottom: Spacing.sm },
  kicker: { color: Colors.flameText },
  where: { marginTop: 4, fontSize: 22, lineHeight: 26, letterSpacing: -0.3 },
  metaRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    marginTop: Spacing.xs, paddingTop: Spacing.xs, borderTopWidth: 1, borderTopColor: Colors.line,
  },
  price: { color: Colors.ink },

  deleteSlot: { position: 'absolute', top: 8, right: 8 },

  announce: {
    minHeight: COVER_H + 104, alignItems: 'center', justifyContent: 'center', gap: 6,
    padding: Spacing.sm, backgroundColor: 'transparent',
    borderStyle: 'dashed', borderColor: Colors.metal,
  },
  announceMark: {
    width: 44, height: 44, marginBottom: 6,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.flame,
  },

  modalRoot: { flex: 1 },
  sheetBody: { marginTop: 6, marginBottom: Spacing.md },
  sheetActions: { gap: Spacing['2xs'] },
});
