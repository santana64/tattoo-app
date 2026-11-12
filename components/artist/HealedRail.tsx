import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from 'react-native-reanimated';
import { format } from 'date-fns/format';
import { isValid } from 'date-fns/isValid';
import { parseISO } from 'date-fns/parseISO';
import { fr } from 'date-fns/locale/fr';
import { Colors, Layout, Spacing } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { PressableScale } from '@/components/motion';
import { IconButton, Kicker, SectionHead } from '@/components/v5';
import { WorkPlate } from '@/components/gallery/WorkPlate';
import { fetchArtistHealedPhotos, type HealedPhoto } from '@/lib/care';

interface HealedRailProps {
  artistId: string;
  /** Side padding of the page the rail bleeds out of. */
  gutter?: number;
}

const TILE_W = 148;
const TILE_H = Math.round(TILE_W * 5 / 4);

function monthLabel(iso: string): string {
  const d = parseISO(iso);
  return isValid(d) ? format(d, 'MMMM yyyy', { locale: fr }) : '';
}

/**
 * "Cicatrisés": healed results sent by the artist's clients and made public by
 * them. Nothing is rendered when there is none (or when loading fails).
 */
export function HealedRail({ artistId, gutter = Layout.gutter }: HealedRailProps) {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  // The viewer covers the whole window, rail included.
  const { width, height } = useWindowDimensions();
  const [photos, setPhotos] = useState<HealedPhoto[]>([]);
  const [open, setOpen] = useState<HealedPhoto | null>(null);

  useEffect(() => {
    let active = true;
    fetchArtistHealedPhotos(artistId)
      .then((list) => { if (active) setPhotos(list); })
      .catch(() => { if (active) setPhotos([]); });
    return () => { active = false; };
  }, [artistId]);

  if (photos.length === 0) return null;

  const viewerW = Math.min(width - Spacing.md * 2, 720);
  const viewerH = Math.max(160, Math.min(height - insets.top - insets.bottom - 200, viewerW * 1.4));
  const count = `${photos.length} photo${photos.length > 1 ? 's' : ''}`;

  return (
    <View>
      <SectionHead
        kicker={`Cicatrisés · ${count}`}
        title="Après la"
        emphasis="cicatrisation."
        description="Photos envoyées par des clients après cicatrisation."
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.scroller, { marginHorizontal: -gutter }]}
        contentContainerStyle={[styles.rail, { paddingHorizontal: gutter }]}
      >
        {photos.map((p, i) => (
          <PressableScale
            key={p.id}
            onPress={() => setOpen(p)}
            accessibilityRole="imagebutton"
            accessibilityLabel={`Tatouage cicatrisé ${i + 1} sur ${photos.length}${p.note ? ` : ${p.note}` : ''}`}
            accessibilityHint="Affiche la photo en grand."
          >
            <WorkPlate uri={p.photo_url} mark={`N° ${String(i + 1).padStart(2, '0')}`} style={styles.tile} />
          </PressableScale>
        ))}
      </ScrollView>

      <Modal
        visible={!!open}
        transparent
        animationType={reduced ? 'none' : 'fade'}
        onRequestClose={() => setOpen(null)}
        statusBarTranslucent
      >
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(null)} accessibilityLabel="Fermer" />
          {open && (
            <View style={[styles.viewer, { width: viewerW }]} pointerEvents="box-none">
              <Image
                source={{ uri: open.photo_url }}
                style={{ width: viewerW, height: viewerH }}
                contentFit="contain"
                cachePolicy="memory-disk"
                accessibilityLabel={open.note ? `Tatouage cicatrisé : ${open.note}` : 'Tatouage cicatrisé'}
              />
              <View style={styles.cartel}>
                <Kicker tone="flameOnInk">Cicatrisé</Kicker>
                {!!open.note && (
                  <TText variant="title2" serif italic color="onInk" style={styles.note}>« {open.note} »</TText>
                )}
                <TText variant="caption" color="onInkMuted" style={styles.meta}>
                  Photo d’un client{monthLabel(open.created_at) ? `, ${monthLabel(open.created_at)}` : ''}
                </TText>
              </View>
            </View>
          )}
          <View style={[styles.close, { top: insets.top + Spacing.sm }]}>
            <IconButton icon="close" label="Fermer la photo" onPress={() => setOpen(null)} onInk />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  scroller: { flexGrow: 0 },
  rail: { gap: 2 },
  tile: { width: TILE_W, height: TILE_H },

  backdrop: { flex: 1, backgroundColor: Colors.inkPanel, alignItems: 'center', justifyContent: 'center' },
  viewer: { alignItems: 'stretch' },
  cartel: {
    marginTop: Spacing.sm, alignSelf: 'flex-start', maxWidth: Layout.maxReading,
    borderLeftWidth: 2, borderLeftColor: Colors.flame, paddingLeft: Spacing.sm,
  },
  note: { marginTop: 8, fontSize: 22, lineHeight: 27 },
  meta: { marginTop: 6 },
  close: { position: 'absolute', right: Spacing.sm },
});
