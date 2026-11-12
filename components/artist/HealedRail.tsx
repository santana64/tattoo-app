import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useReducedMotion } from 'react-native-reanimated';
import { format } from 'date-fns/format';
import { isValid } from 'date-fns/isValid';
import { parseISO } from 'date-fns/parseISO';
import { fr } from 'date-fns/locale/fr';
import { Colors, Layout, Radius, Spacing } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { PressableScale, RevealImage } from '@/components/motion';
import { fetchArtistHealedPhotos, type HealedPhoto } from '@/lib/care';

interface HealedRailProps {
  artistId: string;
}

const TILE_W = 132;
const TILE_H = Math.round(TILE_W * 5 / 4);

function monthLabel(iso: string): string {
  const d = parseISO(iso);
  return isValid(d) ? format(d, 'MMMM yyyy', { locale: fr }) : '';
}

/**
 * "Cicatrisés": healed results sent by the artist's clients and made public by
 * them. Nothing is rendered when there is none (or when loading fails).
 */
export function HealedRail({ artistId }: HealedRailProps) {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
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
  const viewerH = Math.min(height - insets.top - insets.bottom - 180, viewerW * 1.4);

  return (
    <View style={styles.section}>
      <TText variant="label" color="accentWarm" uppercase accessibilityRole="header">Cicatrisés</TText>
      <TText variant="bodySmall" color="tertiary" style={styles.caption}>
        Photos envoyées par des clients après cicatrisation.
      </TText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroller} contentContainerStyle={styles.rail}>
        {photos.map((p, i) => (
          <PressableScale
            key={p.id}
            onPress={() => setOpen(p)}
            accessibilityRole="imagebutton"
            accessibilityLabel={`Tatouage cicatrisé ${i + 1} sur ${photos.length}${p.note ? ` : ${p.note}` : ''}`}
            accessibilityHint="Affiche la photo en grand."
          >
            <RevealImage uri={p.photo_url} style={styles.tile} />
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
                style={{ width: viewerW, height: viewerH, borderRadius: Radius.md }}
                contentFit="contain"
                cachePolicy="memory-disk"
                accessibilityLabel={open.note ? `Tatouage cicatrisé : ${open.note}` : 'Tatouage cicatrisé'}
              />
              {!!open.note && (
                <TText variant="body" style={styles.note}>« {open.note} »</TText>
              )}
              <TText variant="caption" color="tertiary" style={styles.meta}>
                Photo d’un client{monthLabel(open.created_at) ? `, ${monthLabel(open.created_at)}` : ''}
              </TText>
            </View>
          )}
          <Pressable
            onPress={() => setOpen(null)}
            accessibilityRole="button"
            accessibilityLabel="Fermer la photo"
            hitSlop={8}
            style={({ pressed }) => [styles.close, { top: insets.top + Spacing.sm }, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="close" size={22} color={Colors.textPrimary} />
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingVertical: Spacing.lg },
  caption: { marginTop: 4, marginBottom: Spacing.sm },
  scroller: { marginHorizontal: -Layout.gutter, flexGrow: 0 },
  rail: { gap: Spacing['2xs'], paddingHorizontal: Layout.gutter },
  tile: { width: TILE_W, height: TILE_H, borderRadius: Radius.md },

  backdrop: { flex: 1, backgroundColor: 'rgba(5,4,3,0.94)', alignItems: 'center', justifyContent: 'center' },
  viewer: { alignItems: 'center' },
  note: { marginTop: Spacing.sm, textAlign: 'center', fontStyle: 'italic', maxWidth: Layout.maxReading },
  meta: { marginTop: 6, textAlign: 'center' },
  close: {
    position: 'absolute', right: Spacing.sm,
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderBright,
    backgroundColor: 'rgba(11,10,9,0.55)',
  },
});
