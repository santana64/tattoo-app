import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Platform, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, Radius, Layout, Gradients } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TButton } from '@/components/ui/TButton';
import { THeader } from '@/components/ui/THeader';
import { TSkeleton } from '@/components/ui/TSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Toast } from '@/components/ui/TToast';
import { BottomSheet, GlassSurface, PressableScale, RevealImage, enterUp, fadeIn } from '@/components/motion';
import { ArtPlaceholder, styleName } from '@/components/ArtistCard';
import { Seo } from '@/components/Seo';
import { Lightbox, type LightboxItem } from '@/components/gallery/Lightbox';
import { ShareButton } from '@/components/ui/ShareButton';
import { useAuthStore } from '@/store/auth-store';
import { supabase, type Tables } from '@/lib/supabase';
import { isUuid } from '@/lib/catalog';
import { toDescription } from '@/lib/site';
import { deleteFlash, fetchFlash, flashCopiesLeft, type FlashDesign } from '@/lib/studio';

const WIDE = 900;
const SIDE_W = 400;

type FlashArtist = Pick<Tables<'artists'>, 'id' | 'blaze' | 'city' | 'booking_status'>;

/** 150 → "2 h 30", 45 → "45 min". */
function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
}

/** "Pièce unique", "3 exemplaires restants", "Épuisé". */
function flashAvailability(flash: Pick<FlashDesign, 'total_copies' | 'sold_copies'>): string {
  const left = flashCopiesLeft(flash);
  if (left === 0) return 'Épuisé';
  if (flash.total_copies === 1) return 'Pièce unique';
  return left === 1 ? '1 exemplaire restant' : `${left} exemplaires restants`;
}

const formatPrice = (euros: number) => `${euros.toLocaleString('fr-FR')} €`;

/** The work gets the room; on wide screens the label sits beside it. */
function useFrame() {
  const { width, height } = useWindowDimensions();
  const wide = width >= WIDE;
  const frameW = Math.min(width, Layout.maxContent);
  const artW = wide ? frameW - Layout.gutter * 2 - SIDE_W - Spacing['2xl'] : width;
  const artH = wide
    ? Math.round(Math.min(height - 160, (artW * 4) / 3, 860))
    : Math.round(Math.min((width * 4) / 3, height * 0.66));
  return { wide, artH };
}

function FlashSkeleton() {
  const { wide, artH } = useFrame();
  return (
    <View style={styles.container} accessibilityLabel="Chargement du flash">
      <THeader showBack />
      <View style={[styles.frame, wide && styles.frameWide]}>
        <View style={wide ? styles.artColWide : undefined}>
          <TSkeleton height={artH} radius={wide ? Radius.xl : 0} />
        </View>
        <View style={[styles.side, wide && styles.sideWide]}>
          <TSkeleton width={110} height={11} />
          <TSkeleton width="70%" height={28} style={{ marginTop: 10 }} />
          <TSkeleton width="55%" height={13} style={{ marginTop: 10 }} />
          <TSkeleton width={120} height={36} style={{ marginTop: Spacing.lg }} />
        </View>
      </View>
    </View>
  );
}

export default function FlashScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [resource, setResource] = useState<{ flash: FlashDesign; artist: FlashArtist | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setResource(null); setLoading(true); setError(false);
    async function load() {
      try {
        if (!isUuid(id)) return;
        const flash = await fetchFlash(id);
        if (!flash) return;
        const { data: artist, error: artistError } = await supabase
          .from('artists').select('id,blaze,city,booking_status').eq('id', flash.artist_id).maybeSingle();
        if (artistError) throw artistError;
        if (active) setResource({ flash, artist });
      } catch { if (active) setError(true); }
      finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [id, attempt]);

  if (loading) return <FlashSkeleton />;
  if (!resource) {
    return (
      <View style={styles.container}>
        <THeader showBack />
        <EmptyState
          icon={error ? 'cloud-offline-outline' : 'image-outline'}
          title={error ? 'Flash inaccessible' : 'Flash introuvable'}
          description={error
            ? 'Le chargement a échoué. Vérifiez votre connexion puis réessayez.'
            : 'Ce flash a été retiré ou ce lien n’est plus valide.'}
          ctaLabel={error ? 'Réessayer' : 'Explorer les artistes'}
          onCta={() => (error ? setAttempt((n) => n + 1) : router.replace('/(tabs)/explore'))}
        />
      </View>
    );
  }
  return <FlashContent key={resource.flash.id} flash={resource.flash} artist={resource.artist} />;
}

function FlashContent({ flash, artist }: { flash: FlashDesign; artist: FlashArtist | null }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { wide, artH } = useFrame();
  const { user, isAuthenticated } = useAuthStore();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);

  const isOwner = !!user?.artistId && user.artistId === flash.artist_id;
  const left = flashCopiesLeft(flash);
  const soldOut = left === 0;
  const availability = flashAvailability(flash);
  const blaze = artist?.blaze ?? 'un artiste Inkr';
  const style = styleName(flash.style);
  const lines = [
    style,
    flash.is_color ? 'Couleur' : 'Noir et gris',
    flash.body_zone?.trim() ? `Emplacement conseillé : ${flash.body_zone.trim()}` : null,
    flash.estimated_duration ? `Environ ${formatDuration(flash.estimated_duration)} de séance` : null,
  ].filter((l): l is string => !!l);
  const viewerItems = useMemo<LightboxItem[]>(
    () => [{ id: flash.id, uri: flash.image_url, title: flash.title, subtitle: `Flash de ${blaze} · ${style}` }],
    [flash.id, flash.image_url, flash.title, blaze, style],
  );

  const handleBook = () => {
    if (soldOut) return;
    if (!isAuthenticated) {
      router.push({ pathname: '/(auth)/sign-in', params: { next: `/request/new?artistId=${flash.artist_id}&flashId=${flash.id}` } });
      return;
    }
    router.push({ pathname: '/request/new', params: { artistId: flash.artist_id, flashId: flash.id } });
  };

  const openArtist = () => router.push({ pathname: '/artist/[id]', params: { id: flash.artist_id } });

  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    const ok = await deleteFlash(flash.id);
    setDeleting(false);
    if (!ok) { Toast.error('Suppression impossible. Réessayez.'); return; }
    setConfirmOpen(false);
    Toast.success('Flash supprimé');
    if (router.canGoBack()) router.back();
    else router.replace({ pathname: '/artist/[id]', params: { id: flash.artist_id } });
  };

  const action = isOwner ? (
    <TButton
      title="Supprimer le flash"
      variant="destructive"
      onPress={() => setConfirmOpen(true)}
      icon={<Ionicons name="trash-outline" size={17} color={Colors.errorLight} />}
    />
  ) : (
    <TButton
      title={soldOut ? 'Épuisé' : 'Réserver ce flash'}
      onPress={handleBook}
      disabled={soldOut}
      accessibilityLabel={soldOut ? 'Ce flash est épuisé' : `Réserver ce flash, ${formatPrice(flash.price)}`}
    />
  );

  const priceBlock = (
    <View style={styles.priceRow}>
      <TText variant="displayM" tabular accessibilityLabel={`Prix : ${formatPrice(flash.price)}`}>
        {formatPrice(flash.price)}
      </TText>
      <View style={[styles.availability, soldOut && styles.availabilitySoldOut]}>
        <TText variant="label" uppercase style={{ color: soldOut ? Colors.textTertiary : Colors.accentGlow }}>
          {availability}
        </TText>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Seo
        title={`${flash.title} — Flash de ${blaze} | Inkr`}
        description={toDescription(
          `Flash ${style.toLowerCase()} « ${flash.title} » dessiné par ${blaze}${artist?.city ? `, ${artist.city}` : ''} : ${formatPrice(flash.price)}, ${availability.toLowerCase()}. Réservez-le sur Inkr.`,
        )}
        image={flash.image_url}
        type="article"
        indexable={flash.is_published}
      />
      <THeader
        showBack
        rightElement={flash.is_published ? (
          <ShareButton
            title={`${flash.title} — Flash de ${blaze}`}
            text={`Flash « ${flash.title} » de ${blaze} : ${formatPrice(flash.price)}, ${availability.toLowerCase()}.`}
            path={`/flash/${flash.id}`}
          />
        ) : undefined}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: wide ? Spacing['3xl'] : insets.bottom + 120 }}
      >
        <View style={[styles.frame, wide && styles.frameWide]}>
          {/* ── The design, lit on the dark wall ── */}
          <View style={[styles.art, { height: artH }, wide && [styles.artColWide, styles.artWide]]}>
            <LinearGradient colors={Gradients.glowAmber} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.8 }} style={StyleSheet.absoluteFill} />
            <Pressable
              onPress={() => setViewerOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={`Agrandir le flash « ${flash.title} »`}
              accessibilityHint="Ouvre la visionneuse plein écran"
              style={[styles.print, styles.zoomable]}
            >
              <RevealImage
                uri={flash.image_url}
                contentFit="contain"
                style={[StyleSheet.absoluteFill, styles.mat]}
                accessibilityLabel={`Flash « ${flash.title} » de ${blaze}`}
                fallback={<ArtPlaceholder name={artist?.blaze ?? 'Inkr'} size={88} />}
              />
            </Pressable>
          </View>

          {/* ── Wall label ── */}
          <View style={[styles.side, wide && styles.sideWide]}>
            <Animated.View entering={enterUp(0, 120)} style={styles.cartel}>
              {artist ? (
                <PressableScale
                  onPress={openArtist}
                  accessibilityRole="link"
                  accessibilityLabel={`Voir le profil de ${artist.blaze}`}
                  hitSlop={6}
                  style={styles.artistLink}
                >
                  <TText variant="label" color="accentWarm" uppercase numberOfLines={1} style={{ flexShrink: 1 }}>
                    {artist.blaze}{artist.city ? ` · ${artist.city}` : ''}
                  </TText>
                  <Ionicons name="arrow-forward" size={11} color={Colors.accentWarm} />
                </PressableScale>
              ) : (
                <TText variant="label" color="accentWarm" uppercase>Flash</TText>
              )}
              <TText variant="displayS" italic accessibilityRole="header" style={styles.title}>{flash.title}</TText>
              <TText variant="caption" color="secondary" style={styles.lines}>
                {lines.map((line, i) => (
                  <React.Fragment key={line}>
                    {i > 0 && <TText variant="caption" color="tertiary">{'  ·  '}</TText>}
                    {line}
                  </React.Fragment>
                ))}
              </TText>
            </Animated.View>

            <Animated.View entering={enterUp(1, 120)}>{priceBlock}</Animated.View>

            <Animated.View entering={enterUp(2, 120)} style={styles.note}>
              <Ionicons name="information-circle-outline" size={16} color={Colors.textTertiary} />
              <TText variant="caption" color="tertiary" style={{ flex: 1 }}>
                {isOwner
                  ? (flash.is_published ? 'Ce flash est visible sur votre profil.' : 'Ce flash n’est pas publié : vous seul le voyez.')
                  : 'Le dessin est déjà prêt : votre demande indique ce flash à l’artiste, qui vous propose un rendez-vous.'}
              </TText>
            </Animated.View>

            {wide && <Animated.View entering={enterUp(3, 120)} style={{ marginTop: Spacing.lg }}>{action}</Animated.View>}
          </View>
        </View>
      </ScrollView>

      {/* Sticky action on phones and tablets */}
      {!wide && (
        <Animated.View entering={fadeIn(250)} style={styles.stickyBar}>
          <GlassSurface style={[styles.stickyGlass, { paddingBottom: insets.bottom + 12 }]}>
            <View style={styles.stickyInner}>
              <View style={styles.stickyPrice}>
                <TText variant="title1" serif tabular>{formatPrice(flash.price)}</TText>
                <TText variant="caption" color={soldOut ? 'tertiary' : 'accentGlow'} numberOfLines={1}>{availability}</TText>
              </View>
              <View style={styles.stickyAction}>{action}</View>
            </View>
          </GlassSurface>
        </Animated.View>
      )}

      {/* Owner: a deliberate second gesture before deleting */}
      <BottomSheet visible={confirmOpen} onClose={() => setConfirmOpen(false)} accessibilityLabel="Confirmer la suppression du flash">
        <TText variant="displayS">Supprimer ce flash ?</TText>
        <TText variant="bodySmall" color="secondary" style={styles.sheetBody}>
          « {flash.title} » disparaîtra de votre profil. Les demandes déjà reçues pour ce flash restent dans vos projets.
        </TText>
        <View style={styles.sheetActions}>
          <TButton
            title="Supprimer définitivement"
            variant="destructive"
            loading={deleting}
            disabled={deleting}
            onPress={() => { void handleDelete(); }}
          />
          <TButton title="Garder le flash" variant="secondary" onPress={() => setConfirmOpen(false)} />
        </View>
      </BottomSheet>

      <Lightbox visible={viewerOpen} onClose={() => setViewerOpen(false)} items={viewerItems} index={0} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },

  frame: { width: '100%', maxWidth: Layout.maxContent, alignSelf: 'center' },
  frameWide: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing['2xl'],
    paddingHorizontal: Layout.gutter, paddingTop: Spacing.lg,
  },

  art: { width: '100%', backgroundColor: Colors.bgInk, alignItems: 'center', justifyContent: 'center' },
  artColWide: { flex: 1, width: undefined },
  artWide: { borderRadius: Radius.xl, overflow: 'hidden' },
  // The print hangs on the wall with a margin of darkness around it.
  print: { position: 'absolute', top: Spacing.xl, bottom: Spacing.xl, left: Spacing.lg, right: Spacing.lg },
  mat: { backgroundColor: 'transparent' },
  zoomable: Platform.OS === 'web' ? ({ cursor: 'zoom-in' } as object) : {},

  side: { paddingHorizontal: Layout.gutter, paddingTop: Spacing.lg, backgroundColor: Colors.bgPrimary },
  sideWide: { width: SIDE_W, paddingHorizontal: 0, paddingTop: Spacing.xs },

  cartel: {
    borderLeftWidth: 1, borderLeftColor: Colors.accentWarm,
    paddingLeft: Spacing.sm, paddingVertical: 2,
  },
  artistLink: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', minHeight: 24 },
  title: { marginTop: 6 },
  lines: { marginTop: 8, lineHeight: 19 },

  priceRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm,
    marginTop: Spacing.lg, paddingVertical: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderDefault,
  },
  availability: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.xs,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderGlow, backgroundColor: Colors.glassAmber,
  },
  availabilitySoldOut: { borderColor: Colors.borderDefault, backgroundColor: 'transparent' },

  note: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: Spacing.md },

  stickyBar: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  stickyGlass: {
    paddingHorizontal: Layout.gutter, paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.borderDefault,
  },
  stickyInner: {
    width: '100%', maxWidth: Layout.maxReading, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
  },
  stickyPrice: { flexShrink: 1, minWidth: 92 },
  stickyAction: { flex: 1 },

  sheetBody: { marginTop: 6, marginBottom: Spacing.md },
  sheetActions: { gap: Spacing['2xs'] },
});
