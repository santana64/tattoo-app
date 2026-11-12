import React, { useCallback } from 'react';
import { View, StyleSheet, Pressable, Platform } from 'react-native';
import { useContentDimensions } from '@/hooks/useContentDimensions';
import { RevealImage, Springs, EASE_OUT, MotionDuration } from '@/components/motion';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withSequence, withTiming, useReducedMotion,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Gradients, Spacing } from '@/constants/theme';
import { TText } from './ui/TText';
import { TAvatar } from './ui/TAvatar';
import { ArtCanvas, Kicker, StatusDot, type StatusTone } from './v5';
import { ArtistSignals, describeArtistSignals, hasArtistSignals } from './artist/ArtistSignals';
import type { Artist } from '@/constants/tattoo';
import { STYLES } from '@/constants/tattoo';
import type { ArtistStats } from '@/lib/studio';
import { formatDistance } from '@/lib/care';

interface ArtistCardProps {
  artist: Artist;
  isSaved?: boolean;
  onSave?: (id: string) => void;
  /** Position in a result list (0-based): shown as the cartel number "N° 01". */
  index?: number;
  variant?: 'default' | 'featured' | 'compact' | 'tile';
  /** Latest published work, newest first. Falls back to the cover image. */
  previewImages?: string[];
  /** Public numbers (rating, next slot, flashes). Optional: loaded after the card. */
  stats?: ArtistStats | null;
  /** Distance from the searched place, shown discreetly in "near me" results. */
  distanceKm?: number;
}

export const BOOKING_STATUS = {
  open:   { label: 'Prend des projets', short: 'Ouvert',     color: Colors.moss,        tone: 'open' as StatusTone },
  paused: { label: 'Liste d’attente',   short: 'En attente', color: Colors.warning,     tone: 'wait' as StatusTone },
  closed: { label: 'Complet',           short: 'Complet',    color: Colors.textTertiary, tone: 'closed' as StatusTone },
} as const;

const STYLE_NAMES = new Map(STYLES.map((s) => [s.slug, s.name]));
export const styleName = (slug: string) => STYLE_NAMES.get(slug) ?? slug;

const formatPrice = (amount: number) => `dès ${amount.toLocaleString('fr-FR')} €`;
const cartelNumber = (index: number) => `N° ${String(index + 1).padStart(2, '0')}`;

type Hover = { pressed: boolean; hovered?: boolean };
const webPointer = Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null;

/** Shown when there is no work to show: a skin-tone plate stamped with the artist's monogram. */
export function ArtPlaceholder({ name, size = 56 }: { name: string; size?: number }) {
  const initials = name.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  return (
    <View style={[StyleSheet.absoluteFill, styles.placeholder]} accessible={false}>
      <LinearGradient
        colors={Gradients.plateClay}
        start={{ x: 0.3, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <TText variant="displayL" italic style={[styles.placeholderText, { fontSize: size, lineHeight: size * 1.1 }]}>
        {initials}
      </TText>
    </View>
  );
}

/** Artwork plate: the photograph when there is one, the monogram plate otherwise. */
function Plate({ uri, name, size, aspectRatio, mark, style }: {
  uri?: string | null; name: string; size: number; aspectRatio?: number; mark?: string;
  style?: React.ComponentProps<typeof View>['style'];
}) {
  return (
    <ArtCanvas uri={uri} aspectRatio={aspectRatio} mark={mark} style={style}>
      {!uri && <ArtPlaceholder name={name} size={size} />}
    </ArtCanvas>
  );
}

function StatusLine({ status, distance }: { status: Artist['bookingStatus']; distance?: string | null }) {
  const s = BOOKING_STATUS[status] ?? BOOKING_STATUS.closed;
  return (
    <View style={styles.statusLine}>
      <StatusDot tone={s.tone} label={s.label} />
      {!!distance && <TText variant="caption" color="secondary" tabular numberOfLines={1}>{distance}</TText>}
    </View>
  );
}

function SaveButton({ saved, onPress, onImage }: { saved: boolean; onPress: () => void; onImage?: boolean }) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return (
    <Animated.View style={anim}>
      <Pressable
        onPress={() => {
          if (!saved && !reduced) {
            scale.set(withSequence(withTiming(1.18, { duration: 110, easing: EASE_OUT }), withSpring(1, Springs.pop)));
          }
          if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
        accessibilityRole="button"
        accessibilityLabel={saved ? 'Retirer des favoris' : 'Ajouter aux favoris'}
        accessibilityState={{ selected: saved }}
        hitSlop={4}
        style={(state) => {
          const { hovered, pressed } = state as Hover;
          return [
            styles.saveBtn,
            webPointer,
            onImage && styles.saveBtnOnImage,
            saved && styles.saveBtnSaved,
            (hovered || pressed) && !saved && styles.saveBtnHover,
          ];
        }}
      >
        <Ionicons
          name={saved ? 'bookmark' : 'bookmark-outline'}
          size={16}
          color={saved ? Colors.flameText : Colors.ink}
        />
      </Pressable>
    </Animated.View>
  );
}

/** Lift-on-press wrapper shared by every variant. */
function useLift() {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return {
    style,
    onPressIn: () => { if (!reduced) scale.set(withTiming(0.985, { duration: MotionDuration.press, easing: EASE_OUT })); },
    onPressOut: () => { scale.set(withTiming(1, { duration: MotionDuration.state, easing: EASE_OUT })); },
  };
}

export function ArtistCard({ artist, isSaved = false, onSave, index, variant = 'default', previewImages, stats, distanceKm }: ArtistCardProps) {
  const router = useRouter();
  const lift = useLift();
  const { isWide } = useContentDimensions();
  const open = useCallback(() => router.push(`/artist/${artist.id}`), [artist.id, router]);
  const save = useCallback(() => onSave?.(artist.id), [artist.id, onSave]);

  const images = (previewImages?.length ? previewImages : [artist.coverUrl]).filter(Boolean);
  const stylesLabel = artist.styles.slice(0, 2).map(styleName).join(' · ');
  // The card is one pressable: its label must also carry the signals it shows (none on compact).
  const signalsA11y = variant === 'compact' ? '' : describeArtistSignals(stats, true);
  const distance = distanceKm !== undefined && Number.isFinite(distanceKm) ? formatDistance(distanceKm) : null;
  const a11y = `${artist.blaze}, ${artist.city}${distance ? `, ${distance}` : ''}${stylesLabel ? `, ${stylesLabel}` : ''}${signalsA11y ? `. ${signalsA11y}` : ''}`;
  const number = index !== undefined ? cartelNumber(index) : null;

  // ── Featured: the work beside a white cartel with a vermilion top rule ──
  if (variant === 'featured') {
    return (
      <Animated.View style={[styles.featured, lift.style]}>
        <Pressable
          onPress={open}
          onPressIn={lift.onPressIn}
          onPressOut={lift.onPressOut}
          accessibilityRole="link"
          accessibilityLabel={a11y}
          style={[isWide ? styles.featuredRow : null, webPointer]}
        >
          {(state) => {
            const lit = (state as Hover).hovered;
            return (
              <>
                <View style={isWide ? styles.featuredArt : null}>
                  <Plate
                    uri={images[0]}
                    name={artist.blaze}
                    size={isWide ? 132 : 96}
                    aspectRatio={isWide ? 5 / 4 : 4 / 5}
                  />
                </View>
                <View style={[styles.featuredSheet, isWide && styles.featuredSheetWide]}>
                  <Kicker tone="flame">{artist.tier === 'premium' ? 'Mis en avant' : 'Artiste'}</Kicker>
                  <TText
                    variant="displayL"
                    numberOfLines={2}
                    style={[styles.featuredName, isWide && styles.featuredNameWide, lit && { color: Colors.flameText }]}
                  >
                    {artist.blaze}
                  </TText>
                  <TText variant="bodySmall" color="secondary" numberOfLines={2}>
                    {artist.city}{stylesLabel ? ` · ${stylesLabel}` : ''}
                  </TText>
                  <View style={styles.featuredMeta}>
                    <StatusLine status={artist.bookingStatus} distance={distance} />
                    {artist.minBudget > 0 && (
                      <TText variant="bodySmall" weight="semibold" tabular color="accentWarm">
                        {formatPrice(artist.minBudget)}
                      </TText>
                    )}
                  </View>
                  {hasArtistSignals(stats, true) && <View style={styles.signals}><ArtistSignals stats={stats} compact /></View>}
                  <View style={styles.featuredMore} accessible={false}>
                    <TText variant="label" weight="bold" uppercase style={{ color: lit ? Colors.flameText : Colors.ink, letterSpacing: 1 }}>
                      Voir le portfolio
                    </TText>
                    <Ionicons name="arrow-forward" size={13} color={lit ? Colors.flameText : Colors.ink} />
                  </View>
                </View>
              </>
            );
          }}
        </Pressable>
        {onSave && (
          <View style={styles.featuredSave}>
            <SaveButton saved={isSaved} onPress={save} onImage />
          </View>
        )}
      </Animated.View>
    );
  }

  // ── Compact: horizontal rails ──────────────────────────────────
  if (variant === 'compact') {
    return (
      <Animated.View style={[styles.compact, lift.style]}>
        <Pressable onPress={open} onPressIn={lift.onPressIn} onPressOut={lift.onPressOut} accessibilityRole="link" accessibilityLabel={a11y} style={webPointer}>
          <Plate uri={images[0] || artist.avatarUrl} name={artist.blaze} size={40} aspectRatio={132 / 168} />
          <TText variant="title2" serif numberOfLines={1} style={styles.compactName}>{artist.blaze}</TText>
          <TText variant="caption" color="secondary" numberOfLines={1}>{artist.city}{distance ? ` · ${distance}` : ''}</TText>
        </Pressable>
      </Animated.View>
    );
  }

  // ── Tile: grid view ────────────────────────────────────────────
  if (variant === 'tile') {
    return (
      <Animated.View style={[styles.tile, lift.style]}>
        <Pressable onPress={open} onPressIn={lift.onPressIn} onPressOut={lift.onPressOut} accessibilityRole="link" accessibilityLabel={a11y} style={webPointer}>
          {(state) => (
            <>
              <Plate uri={images[0]} name={artist.blaze} size={48} mark={number ?? undefined} />
              <View style={styles.tileText}>
                <TText
                  variant="title2"
                  serif
                  numberOfLines={1}
                  style={[styles.tileName, (state as Hover).hovered && { color: Colors.flameText }]}
                >
                  {artist.blaze}
                </TText>
                <TText variant="caption" color="secondary" numberOfLines={1}>{artist.city}{distance ? ` · ${distance}` : ''}</TText>
                <View style={styles.tileStatus}>
                  <StatusDot tone={(BOOKING_STATUS[artist.bookingStatus] ?? BOOKING_STATUS.closed).tone} label={(BOOKING_STATUS[artist.bookingStatus] ?? BOOKING_STATUS.closed).short} />
                </View>
                {artist.minBudget > 0 && (
                  <TText variant="caption" weight="semibold" tabular color="accentWarm" style={{ marginTop: 4 }}>{formatPrice(artist.minBudget)}</TText>
                )}
                {hasArtistSignals(stats, true) && <View style={styles.signalsTile}><ArtistSignals stats={stats} compact /></View>}
              </View>
            </>
          )}
        </Pressable>
        {onSave && <View style={styles.tileSave}><SaveButton saved={isSaved} onPress={save} onImage /></View>}
      </Animated.View>
    );
  }

  // ── Default: a numbered cartel — ink rule, portfolio plate, serif name ──
  const [lead, ...rest] = images;
  const side = rest.slice(0, 2);
  return (
    <Animated.View style={[styles.card, lift.style]}>
      <Pressable onPress={open} onPressIn={lift.onPressIn} onPressOut={lift.onPressOut} accessibilityRole="link" accessibilityLabel={a11y} style={webPointer}>
        {(state) => {
          const lit = (state as Hover).hovered;
          return (
            <>
              <View style={[styles.mosaic, isWide && styles.mosaicWide]}>
                <View style={[styles.mosaicLead, side.length === 0 && { flex: 1 }]}>
                  {lead ? (
                    <RevealImage uri={lead} style={StyleSheet.absoluteFill} />
                  ) : <ArtPlaceholder name={artist.blaze} size={72} />}
                </View>
                {side.length > 0 && (
                  <View style={styles.mosaicSide}>
                    {side.map((uri) => (
                      <View key={uri} style={styles.mosaicCell}>
                        <RevealImage uri={uri} style={StyleSheet.absoluteFill} />
                      </View>
                    ))}
                  </View>
                )}
              </View>

              <View style={styles.caption}>
                <TAvatar uri={artist.avatarUrl} name={artist.blaze} size="md" />
                <View style={styles.captionText}>
                  {number && <Kicker tone="muted" style={styles.number}>{number}</Kicker>}
                  <View style={styles.nameRow}>
                    <TText variant="displayS" numberOfLines={1} style={[styles.name, lit && { color: Colors.flameText }]}>
                      {artist.blaze}
                    </TText>
                    {artist.isVerified && (
                      <Ionicons name="checkmark-circle" size={15} color={Colors.flameText} accessibilityLabel="Profil vérifié" />
                    )}
                  </View>
                  <TText variant="caption" color="secondary" numberOfLines={1}>
                    {artist.city}{stylesLabel ? ` · ${stylesLabel}` : ''}
                  </TText>
                </View>
                {onSave && <SaveButton saved={isSaved} onPress={save} />}
              </View>

              <View style={styles.metaRow}>
                <StatusLine status={artist.bookingStatus} distance={distance} />
                {artist.minBudget > 0 && (
                  <TText variant="bodySmall" weight="semibold" tabular color="accentWarm">
                    {formatPrice(artist.minBudget)}
                  </TText>
                )}
              </View>
              {hasArtistSignals(stats, true) && <View style={styles.signals}><ArtistSignals stats={stats} compact /></View>}
            </>
          );
        }}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  placeholder: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  placeholderText: { color: Colors.inkPanel, opacity: 0.42, letterSpacing: -1 },

  statusLine: { flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1, flexWrap: 'wrap' },

  saveBtn: {
    width: 36, height: 36,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.line,
  },
  saveBtnOnImage: { backgroundColor: Colors.paper, borderColor: Colors.paper },
  saveBtnSaved: { borderColor: Colors.flame },
  saveBtnHover: { backgroundColor: Colors.wash },

  // Featured
  featured: {
    marginBottom: Spacing.xl,
    borderTopWidth: 1, borderTopColor: Colors.ink, paddingTop: Spacing.xs,
  },
  featuredRow: { flexDirection: 'row', alignItems: 'stretch' },
  featuredArt: { flex: 7, minWidth: 0 },
  featuredSheet: {
    backgroundColor: Colors.white,
    borderTopWidth: 2, borderTopColor: Colors.flame,
    padding: Spacing.lg,
  },
  featuredSheetWide: { flex: 5, minWidth: 0, padding: Spacing['2xl'], justifyContent: 'flex-end' },
  featuredName: { fontSize: 46, lineHeight: 46, letterSpacing: -1.6, marginTop: 14, marginBottom: 8 },
  featuredNameWide: { fontSize: 64, lineHeight: 62, letterSpacing: -2.4 },
  featuredMeta: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 10,
    marginTop: Spacing.md, paddingTop: Spacing.xs,
    borderTopWidth: 1, borderTopColor: Colors.line,
  },
  featuredMore: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: Spacing.lg },
  featuredSave: { position: 'absolute', top: Spacing.xs + 12, left: 12 },

  // Compact
  compact: { width: 132, marginRight: Spacing.xs },
  compactName: { fontSize: 20, lineHeight: 22, marginTop: 8 },

  // Tile
  tile: { flex: 1, marginBottom: Spacing.xl },
  tileSave: { position: 'absolute', top: 10, right: 10 },
  tileText: { marginTop: 12, gap: 2 },
  tileName: { fontSize: 22, lineHeight: 24 },
  tileStatus: { marginTop: 6 },

  // Default
  card: {
    marginBottom: Spacing['2xl'],
    borderTopWidth: 1, borderTopColor: Colors.ink, paddingTop: Spacing.xs,
  },
  mosaic: { flexDirection: 'row', height: 240, gap: 2, backgroundColor: Colors.clay },
  mosaicWide: { height: 300 },
  mosaicLead: { flex: 2, backgroundColor: Colors.clay, overflow: 'hidden' },
  mosaicSide: { flex: 1, gap: 2 },
  mosaicCell: { flex: 1, backgroundColor: Colors.clay, overflow: 'hidden' },

  caption: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 14 },
  captionText: { flex: 1, minWidth: 0, gap: 2 },
  number: { marginBottom: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 30, lineHeight: 32, letterSpacing: -0.8, flexShrink: 1 },

  metaRow: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8,
    marginTop: 14, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: Colors.line,
  },

  // Public signals sit on their own wrapping line, so no width can squeeze the row above.
  signals: { marginTop: 10 },
  signalsTile: { marginTop: 6 },
});
