import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Platform } from 'react-native';
import { useContentDimensions } from '@/hooks/useContentDimensions';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { Colors, Spacing, Layout } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TButton } from '@/components/ui/TButton';
import { THeader } from '@/components/ui/THeader';
import { TSkeleton } from '@/components/ui/TSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Toast } from '@/components/ui/TToast';
import { BottomSheet, enterUp, fadeIn } from '@/components/motion';
import { DetailRow, InkPanel, Kicker, StatusDot, TextLink } from '@/components/v5';
import { PlateMark, WorkPlate } from '@/components/gallery/WorkPlate';
import { styleName } from '@/components/ArtistCard';
import { Seo } from '@/components/Seo';
import { Lightbox, type LightboxItem } from '@/components/gallery/Lightbox';
import { ShareButton } from '@/components/ui/ShareButton';
import { useAuthStore } from '@/store/auth-store';
import { supabase, type Tables } from '@/lib/supabase';
import { isUuid } from '@/lib/catalog';
import { toDescription } from '@/lib/site';
import { archiveFlash, fetchFlash, flashCopiesLeft, type FlashDesign } from '@/lib/studio';

const SIDE_W = 440;

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

/** The drawing gets the room; on wide screens the ink cartel sits beside it. */
function useFrame() {
  const { width, height, isWide, gutter } = useContentDimensions();
  const frameW = Math.min(width, Layout.maxContent);
  const artW = isWide ? frameW - gutter * 2 - SIDE_W : width;
  const artH = isWide
    ? Math.round(Math.max(Math.min(height - 140, (artW * 4) / 3, 860), 560))
    : Math.round(Math.min(width * 1.1, height * 0.55));
  return { wide: isWide, artH, gutter };
}

function FlashSkeleton() {
  const { wide, artH, gutter } = useFrame();
  return (
    <View style={styles.container} accessibilityLabel="Chargement du flash">
      <THeader showBack title="Flash" />
      <View style={[styles.frame, wide && [styles.frameWide, { paddingHorizontal: gutter }]]}>
        <View style={wide ? styles.artColWide : undefined}>
          <TSkeleton height={artH} radius={0} />
        </View>
        <InkPanel style={wide ? [styles.panelWide, { minHeight: artH }] : undefined}>
          <View style={{ width: 120, height: 10, backgroundColor: Colors.inkRaised }} />
          <View style={{ width: '70%', height: 44, marginTop: 16, backgroundColor: Colors.inkRaised }} />
          <View style={{ width: '100%', height: 52, marginTop: Spacing.xl, backgroundColor: Colors.inkRaised }} />
        </InkPanel>
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
        <THeader showBack title="Flash" />
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
  const { wide, artH, gutter } = useFrame();
  const { user, isAuthenticated } = useAuthStore();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);

  const isOwner = !!user?.artistId && user.artistId === flash.artist_id;
  const left = flashCopiesLeft(flash);
  const soldOut = left === 0;
  const availability = flash.is_published ? flashAvailability(flash) : 'Retiré';
  const blaze = artist?.blaze ?? 'un artiste Inkr';
  const style = styleName(flash.style);
  const facts: { label: string; value: string }[] = [
    { label: 'Style', value: style },
    { label: 'Rendu', value: flash.is_color ? 'Couleur' : 'Noir et gris' },
  ];
  if (flash.body_zone?.trim()) facts.push({ label: 'Emplacement conseillé', value: flash.body_zone.trim() });
  if (flash.estimated_duration) facts.push({ label: 'Séance', value: `Environ ${formatDuration(flash.estimated_duration)}` });
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
    const ok = await archiveFlash(flash.id);
    setDeleting(false);
    if (!ok) { Toast.error('Retrait impossible. Réessayez.'); return; }
    setConfirmOpen(false);
    Toast.success('Flash retiré de la galerie');
    router.replace({ pathname: '/artist/[id]', params: { id: flash.artist_id } });
  };

  /** The one action of the screen, drawn for the ground it sits on. */
  const action = (onInk: boolean) => (isOwner ? (
    <TButton
      title={flash.is_published ? 'Retirer le flash' : 'Flash retiré'}
      variant={onInk ? 'inverse' : 'destructive'}
      onPress={() => setConfirmOpen(true)}
      disabled={!flash.is_published}
      icon={<Ionicons name="trash-outline" size={16} color={onInk ? Colors.onInk : Colors.error} />}
    />
  ) : (
    <TButton
      title={soldOut ? 'Épuisé' : 'Réserver ce flash'}
      variant={onInk ? 'glass' : 'primary'}
      onPress={handleBook}
      disabled={soldOut}
      accessibilityLabel={soldOut ? 'Ce flash est épuisé' : `Réserver ce flash, ${formatPrice(flash.price)}`}
    />
  ));

  const titleSize = wide ? 64 : 46;

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
        title="Flash"
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
        contentContainerStyle={{ paddingBottom: wide ? Spacing['4xl'] : insets.bottom + 120 }}
      >
        <View style={[styles.frame, wide && [styles.frameWide, { paddingHorizontal: gutter }]]}>
          {/* ── The drawing on its sheet ── */}
          <View style={[styles.art, { height: artH }, wide && styles.artColWide]}>
            <Pressable
              onPress={() => setViewerOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={`Agrandir le flash « ${flash.title} »`}
              accessibilityHint="Ouvre la visionneuse plein écran"
              style={[styles.print, styles.zoomable]}
            >
              <WorkPlate
                uri={flash.image_url}
                contentFit="contain"
                tone="bone"
                accessibilityLabel={`Flash « ${flash.title} » de ${blaze}`}
                style={[StyleSheet.absoluteFill, styles.sheet]}
              />
            </Pressable>
            <PlateMark label={flash.is_published ? 'Flash' : 'Flash · Non publié'} />
          </View>

          {/* ── Ink cartel ── */}
          <InkPanel style={wide ? [styles.panelWide, { minHeight: artH }] : undefined}>
            <Animated.View entering={enterUp(0, 120)}>
              {artist ? (
                <TextLink
                  label={`${artist.blaze}${artist.city ? ` · ${artist.city}` : ''}`}
                  onPress={openArtist}
                  onInk
                  accessibilityLabel={`Voir le profil de ${artist.blaze}`}
                  style={styles.artistLink}
                />
              ) : (
                <Kicker tone="flameOnInk">Flash</Kicker>
              )}
              <TText
                variant="displayL"
                italic
                accessibilityRole="header"
                style={[styles.title, { fontSize: titleSize, lineHeight: Math.round(titleSize * 0.96), letterSpacing: -titleSize * 0.035 }]}
              >
                {flash.title}
              </TText>
            </Animated.View>

            <Animated.View entering={enterUp(1, 120)} style={styles.priceBlock}>
              <Kicker tone="onInkMuted">Prix du flash</Kicker>
              <TText
                variant="displayL"
                tabular
                accessibilityLabel={`Prix : ${formatPrice(flash.price)}`}
                style={styles.price}
              >
                {formatPrice(flash.price)}
              </TText>
              <StatusDot tone={soldOut ? 'closed' : 'open'} label={availability} onInk />
            </Animated.View>

            <Animated.View entering={enterUp(2, 120)} style={styles.facts}>
              {facts.map((f, i) => (
                <DetailRow key={f.label} label={f.label} value={f.value} onInk last={i === facts.length - 1} />
              ))}
            </Animated.View>

            <Animated.View entering={enterUp(3, 120)} style={styles.note}>
              <Ionicons name="information-circle-outline" size={16} color={Colors.onInkMuted} />
              <TText variant="caption" color="onInkMuted" style={{ flex: 1 }}>
                {isOwner
                  ? (flash.is_published ? 'Ce flash est visible sur votre profil.' : 'Ce flash n’est pas publié : vous seul le voyez.')
                  : 'Le dessin est déjà prêt : votre demande indique ce flash à l’artiste, qui vous propose un rendez-vous.'}
              </TText>
            </Animated.View>

            {wide && <Animated.View entering={enterUp(4, 120)} style={{ marginTop: Spacing.xl }}>{action(true)}</Animated.View>}
          </InkPanel>
        </View>
      </ScrollView>

      {/* Sticky action on phones and tablets */}
      {!wide && (
        <Animated.View entering={fadeIn(250)} style={[styles.stickyBar, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.stickyInner}>
            <View style={styles.stickyPrice}>
              <TText variant="title1" serif tabular style={styles.stickyAmount}>{formatPrice(flash.price)}</TText>
              <TText variant="micro" weight="bold" uppercase numberOfLines={1} style={{ color: soldOut ? Colors.textTertiary : Colors.flameText }}>
                {availability}
              </TText>
            </View>
            <View style={styles.stickyAction}>{action(false)}</View>
          </View>
        </Animated.View>
      )}

      {/* Owner: a deliberate second gesture before withdrawing a published flash. */}
      <BottomSheet visible={confirmOpen} onClose={() => setConfirmOpen(false)} accessibilityLabel="Confirmer le retrait du flash">
        <TText variant="displayS">Retirer ce flash ?</TText>
        <TText variant="bodySmall" color="secondary" style={styles.sheetBody}>
          « {flash.title} » disparaîtra de votre profil. Les demandes déjà reçues restent liées à ce flash dans vos projets.
        </TText>
        <View style={styles.sheetActions}>
          <TButton
            title="Retirer de la galerie"
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
  frameWide: { flexDirection: 'row', alignItems: 'flex-start', paddingTop: Spacing.xl },

  // The drawing hangs on a white sheet with a margin of paper around it.
  art: { width: '100%', backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.line },
  artColWide: { flex: 1, width: undefined, borderWidth: 1, borderColor: Colors.line, borderRightWidth: 0 },
  print: { position: 'absolute', top: Spacing.xl, bottom: Spacing.xl, left: Spacing.lg, right: Spacing.lg },
  sheet: { backgroundColor: Colors.white },
  zoomable: Platform.OS === 'web' ? ({ cursor: 'zoom-in' } as object) : {},

  panelWide: { width: SIDE_W },
  artistLink: { alignSelf: 'flex-start' },
  title: { marginTop: Spacing.md, color: Colors.onInk },

  priceBlock: { marginTop: Spacing.xl, gap: Spacing['2xs'] },
  price: { color: Colors.onInk, fontSize: 52, lineHeight: 54, letterSpacing: -1.5 },
  facts: { marginTop: Spacing.lg },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: Spacing.md },

  stickyBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: Layout.gutter, paddingTop: 12,
    backgroundColor: Colors.paper, borderTopWidth: 1, borderTopColor: Colors.ink,
  },
  stickyInner: {
    width: '100%', maxWidth: Layout.maxReading, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
  },
  stickyPrice: { flexShrink: 1, minWidth: 92 },
  stickyAmount: { fontSize: 26, lineHeight: 28 },
  stickyAction: { flex: 1 },

  sheetBody: { marginTop: 6, marginBottom: Spacing.md },
  sheetActions: { gap: Spacing['2xs'] },
});
