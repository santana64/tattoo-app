import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  StyleSheet,
  View,
  Pressable,
  ScrollView,
  Platform,
  type ViewStyle,
} from 'react-native';
import { useContentDimensions } from '@/hooks/useContentDimensions';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn, Extrapolation, interpolate, useAnimatedReaction, useAnimatedRef, useAnimatedScrollHandler,
  useAnimatedStyle, useSharedValue, useReducedMotion,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { PressableScale, RevealImage, enterUp } from '@/components/motion';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Layout } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TButton } from '@/components/ui/TButton';
import { TSkeleton } from '@/components/ui/TSkeleton';
import { THeader } from '@/components/ui/THeader';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  DetailRow, IconButton, InkPanel, Kicker, SectionHead, StatusDot, TextLink, type StatusTone,
} from '@/components/v5';
import { BOOKING_STATUS, styleName } from '@/components/ArtistCard';
import { useSavedArtistsStore } from '@/store/saved-artists-store';
import { Toast } from '@/components/ui/TToast';
import { useAuthStore } from '@/store/auth-store';
import { fetchArtistPortfolio } from '@/lib/catalog';
import { useArtist } from '@/hooks/use-artist';
import { Seo } from '@/components/Seo';
import { PlayBadge, VideoPlaceholder } from '@/components/PostCard';
import { toDescription } from '@/lib/site';
import type { Tables } from '@/lib/supabase';
import {
  artworkLabel, fetchArtistSeries, fetchArtistStats, formatCount, formatNextSlot, formatRating,
  type ArtistSeries, type ArtistStats,
} from '@/lib/studio';
import { hasArtistSignals } from '@/components/artist/ArtistSignals';
import { ReviewsSection } from '@/components/artist/ReviewsSection';
import { FollowButton } from '@/components/social/FollowButton';
import { WaitlistButton } from '@/components/social/WaitlistButton';
import { AvailabilitySection } from '@/components/booking/AvailabilitySection';
import { FlashRail } from '@/components/gallery/FlashRail';
import { GuestSpotRail } from '@/components/gallery/GuestSpotRail';
import { PlateFill, WorkPlate } from '@/components/gallery/WorkPlate';
import { StoriesRail } from '@/components/social/StoriesRail';
import { ContactArtistButton } from '@/components/social/ContactArtistButton';
import { HealedRail } from '@/components/artist/HealedRail';
import { ShareButton } from '@/components/ui/ShareButton';

/** Seam between the works of the hero gallery. */
const SEAM = 2;
const STATUS_TONE: Record<keyof typeof BOOKING_STATUS, StatusTone> = { open: 'open', paused: 'wait', closed: 'closed' };

type SectionId = 'portfolio' | 'availability' | 'flashes' | 'guests' | 'videos' | 'healed' | 'reviews' | 'method' | 'faq';
const SUBNAV: { id: SectionId; label: string }[] = [
  { id: 'availability', label: 'Créneaux' },
  { id: 'flashes', label: 'Flashs' },
  { id: 'guests', label: 'Guests' },
  { id: 'videos', label: 'Vidéos' },
  { id: 'portfolio', label: 'Portfolio' },
  { id: 'healed', label: 'Cicatrisés' },
  { id: 'reviews', label: 'Avis' },
  { id: 'method', label: 'Démarche' },
  { id: 'faq', label: 'Questions' },
];

const pad2 = (n: number) => String(n).padStart(2, '0');
const webSticky = Platform.OS === 'web' ? ({ position: 'sticky', top: 0 } as unknown as ViewStyle) : null;

/** Largest serif size at which the longest word of a name still fits the measure. */
function nameSize(name: string, measure: number, preferred: number, min: number): number {
  const longest = Math.max(...name.split(/\s+/).map((w) => w.length), 1);
  // Instrument Serif averages ~0.5 em per glyph, capitals included.
  return Math.round(Math.max(min, Math.min(preferred, measure / (longest * 0.5))));
}

// ─── Pieces ───────────────────────────────────────────────────────────────────
/**
 * A section of the profile. It collapses (no rule, no spacing) when its rail
 * renders nothing, and reports its presence and position for the sub-navigation.
 */
function Block({ id, onPresence, onOffset, gutter, children }: {
  id?: SectionId;
  onPresence?: (id: SectionId, filled: boolean) => void;
  onOffset?: (id: SectionId, y: number) => void;
  gutter: number;
  children: React.ReactNode;
}) {
  const [filled, setFilled] = useState(false);
  return (
    <View
      style={[styles.page, { paddingHorizontal: gutter }]}
      onLayout={(e) => { if (id) onOffset?.(id, e.nativeEvent.layout.y); }}
    >
      <View style={filled ? styles.block : undefined}>
        <View
          onLayout={(e) => {
            const next = e.nativeEvent.layout.height > 0;
            setFilled(next);
            if (id) onPresence?.(id, next);
          }}
        >
          {children}
        </View>
      </View>
    </View>
  );
}

/** Editorial chapter: title at the left on wide screens, the text at the right. */
function Chapter({ kicker, title, emphasis, wide, children }: {
  kicker: string; title: string; emphasis?: string; wide: boolean; children: React.ReactNode;
}) {
  return (
    <View style={[styles.chapter, wide && styles.chapterWide]}>
      <View style={wide ? styles.chapterAside : styles.chapterHead}>
        <SectionHead kicker={kicker} title={title} emphasis={emphasis} style={{ marginBottom: 0 }} />
      </View>
      <View style={wide ? styles.chapterBody : undefined}>{children}</View>
    </View>
  );
}

function FaqItem({ question, answer, index }: { question: string; answer: string; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <Pressable
      onPress={() => setOpen((o) => !o)}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      style={[styles.faqItem, Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null]}
    >
      <View style={styles.faqRow}>
        <TText variant="label" weight="bold" tabular style={styles.faqNumber}>{pad2(index + 1)}</TText>
        <TText variant="body" weight="medium" style={{ flex: 1 }}>{question}</TText>
        <Ionicons name={open ? 'remove' : 'add'} size={18} color={open ? Colors.flameText : Colors.ink} />
      </View>
      {open && (
        <Animated.View entering={FadeIn.duration(200)}>
          <TText variant="bodySmall" color="secondary" style={styles.faqAnswer}>{answer}</TText>
        </Animated.View>
      )}
    </Pressable>
  );
}

/** Bars of an ink panel while the profile loads. */
function InkBar({ width, height = 12, style }: { width: number | `${number}%`; height?: number; style?: ViewStyle }) {
  return <View style={[{ width, height, backgroundColor: Colors.inkRaised }, style]} />;
}

function ProfileSkeleton() {
  const insets = useSafeAreaInsets();
  const { width, height, isWide, gutter } = useContentDimensions();
  const heroH = Math.round(Math.min(Math.max(height - 40, 560), 820));
  const panel = (
    <View style={{ gap: 14 }}>
      <InkBar width={120} height={10} />
      <InkBar width="80%" height={isWide ? 84 : 56} style={{ marginTop: 18 }} />
      <InkBar width="45%" height={isWide ? 84 : 56} />
      <InkBar width={140} height={10} style={{ marginTop: 10 }} />
      <InkBar width="100%" height={52} style={{ marginTop: 22 }} />
    </View>
  );
  return (
    <View style={styles.container} accessibilityLabel="Chargement du profil">
      {isWide ? (
        <View style={[styles.heroWide, { height: heroH }]}>
          <View style={[styles.heroGallery, { flexDirection: 'row', gap: SEAM }]}>
            <View style={{ flex: 1 }}><PlateFill /></View>
            <View style={{ flex: 1, gap: SEAM }}>
              <View style={{ flex: 1 }}><PlateFill tone="bone" /></View>
              <View style={{ flex: 1 }}><PlateFill tone="slate" /></View>
            </View>
          </View>
          <InkPanel style={[styles.heroPanel, { justifyContent: 'center' }]}>{panel}</InkPanel>
        </View>
      ) : (
        <>
          <InkPanel padded={false} style={{ paddingTop: insets.top + 72, paddingHorizontal: gutter, paddingBottom: 32 }}>
            {panel}
          </InkPanel>
          <View style={{ flexDirection: 'row', gap: SEAM, marginTop: SEAM }}>
            {(['clay', 'bone', 'slate'] as const).map((tone) => (
              <View key={tone} style={{ width: (width - SEAM * 2) / 3, height: ((width - SEAM * 2) / 3) * 1.25 }}>
                <PlateFill tone={tone} />
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function ArtistProfileScreen() {
  const { id, series: seriesParam } = useLocalSearchParams<{ id: string; series?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height, isWide, gutter } = useContentDimensions();
  const { savedArtistIds, pendingIds, fetchSaved, toggle } = useSavedArtistsStore();
  const { isAuthenticated, user } = useAuthStore();
  useEffect(() => { void fetchSaved(user?.id); }, [user?.id, fetchSaved]);

  const { artist: loadedArtist, loading, error, retry } = useArtist(id);
  const [artistPosts, setArtistPosts] = useState<Tables<'posts'>[]>([]);
  const [faq, setFaq] = useState<{ question: string; answer: string }[]>([]);
  const [portfolioState, setPortfolioState] = useState<'loading' | 'ready' | 'error'>('loading');
  useEffect(() => {
    let active = true;
    setArtistPosts([]); setFaq([]); setPortfolioState('loading');
    if (loadedArtist) fetchArtistPortfolio(loadedArtist.id).then((data) => {
      if (active) { setArtistPosts(data.posts); setFaq(data.faq); setPortfolioState('ready'); }
    }).catch(() => { if (active) setPortfolioState('error'); });
    return () => { active = false; };
  }, [loadedArtist]);

  // Public numbers and series load on their own: the page never waits for them.
  const [stats, setStats] = useState<ArtistStats | null>(null);
  const [seriesList, setSeriesList] = useState<ArtistSeries[]>([]);
  const [activeSeries, setActiveSeries] = useState<string | null>(null);
  const loadedArtistId = loadedArtist?.id;
  useEffect(() => {
    let active = true;
    setStats(null); setSeriesList([]);
    if (!loadedArtistId) return;
    fetchArtistStats([loadedArtistId]).then((s) => { if (active) setStats(s[loadedArtistId] ?? null); }).catch(() => {});
    fetchArtistSeries(loadedArtistId).then((s) => { if (active) setSeriesList(s); }).catch(() => {});
    return () => { active = false; };
  }, [loadedArtistId]);
  useEffect(() => { setActiveSeries(typeof seriesParam === 'string' && seriesParam ? seriesParam : null); }, [seriesParam, loadedArtistId]);

  const artist = useMemo(() => (loadedArtist ? { ...loadedArtist, faq } : null), [loadedArtist, faq]);
  const isSaved = artist ? savedArtistIds.has(artist.id) : false;
  const photos = useMemo(() => artistPosts.filter((p) => p.media_type === 'photo'), [artistPosts]);
  const videos = useMemo(() => artistPosts.filter((p) => p.media_type === 'video'), [artistPosts]);
  // Only series that hold at least one photo are offered as filters.
  const usedSeries = useMemo(
    () => seriesList.filter((s) => photos.some((p) => p.series_id === s.id)),
    [seriesList, photos],
  );
  const currentSeries = usedSeries.find((s) => s.id === activeSeries) ?? null;
  const shownPhotos = useMemo(
    () => (currentSeries ? photos.filter((p) => p.series_id === currentSeries.id) : photos),
    [photos, currentSeries],
  );

  // ── Layout ──
  const pageW = Math.min(width, Layout.maxContent);
  const innerW = pageW - gutter * 2;
  const heroH = Math.round(Math.min(Math.max(height - 40, 560), 820));
  const cols = isWide ? (innerW >= 1000 ? 4 : 3) : (innerW >= 560 ? 3 : 2);
  const colGap = isWide ? 16 : 10;
  const cell = (innerW - colGap * (cols - 1)) / cols;
  const stripW = (width - SEAM * 2) / 3;

  // ── Sub-navigation: which sections exist, and where they sit ──
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const sectionsY = useRef(0);
  const offsets = useRef<Partial<Record<SectionId, number>>>({});
  const [present, setPresent] = useState<Partial<Record<SectionId, boolean>>>({});
  const [activeAnchor, setActiveAnchor] = useState<SectionId | null>(null);
  const onPresence = useCallback((sid: SectionId, filled: boolean) => {
    setPresent((p) => (p[sid] === filled ? p : { ...p, [sid]: filled }));
  }, []);
  const onOffset = useCallback((sid: SectionId, y: number) => { offsets.current[sid] = y; }, []);

  // ── Scroll: the compact bar and the sticky action appear once the ink panel has passed ──
  const reduced = useReducedMotion();
  const [panelH, setPanelH] = useState(0);
  const [pastPanel, setPastPanel] = useState(false);
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => { scrollY.set(e.contentOffset.y); });
  const threshold = Math.max(panelH - 72, 120);
  useAnimatedReaction(
    () => scrollY.get() > threshold,
    (now, before) => { if (now !== before) scheduleOnRN(setPastPanel, now); },
    [threshold],
  );
  const barStyle = useAnimatedStyle(() => {
    if (reduced) return { opacity: scrollY.get() > threshold ? 1 : 0 };
    return { opacity: interpolate(scrollY.get(), [threshold - 40, threshold], [0, 1], Extrapolation.CLAMP) };
  });

  const goTo = (sid: SectionId) => {
    const y = offsets.current[sid];
    if (y === undefined) return;
    setActiveAnchor(sid);
    const top = isWide ? Spacing.sm : insets.top + 64;
    scrollRef.current?.scrollTo({ y: Math.max(0, sectionsY.current + y - top), animated: !reduced });
  };

  const handleSave = useCallback(async () => {
    if (!artist) return;
    if (!user) { router.push({ pathname: '/(auth)/sign-in', params: { next: `/artist/${artist.id}` } }); return; }
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!await toggle(user.id, artist.id)) Toast.error('Impossible d’enregistrer cet artiste. Réessayez.');
  }, [artist, toggle, user, router]);

  const handleRequest = () => {
    if (!artist) return;
    if (!isAuthenticated) { router.push({ pathname: '/(auth)/sign-in', params: { next: `/request/new?artistId=${artist.id}` } }); return; }
    router.push({ pathname: '/request/new', params: { artistId: artist.id } });
  };

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/explore'));

  if (!artist && loading) return <ProfileSkeleton />;
  if (!artist) {
    return (
      <View style={styles.container}>
        <THeader showBack onBack={goBack} />
        <EmptyState
          icon="person-outline"
          title={error ? 'Profil indisponible' : 'Artiste introuvable'}
          description={error ? 'Le chargement a échoué. Vérifiez votre connexion puis réessayez.' : 'Ce profil n’existe pas ou n’est plus public.'}
          ctaLabel={error ? 'Réessayer' : 'Explorer les artistes'}
          onCta={error ? retry : () => router.replace('/(tabs)/explore')}
        />
      </View>
    );
  }

  const status = BOOKING_STATUS[artist.bookingStatus];
  const statusTone = STATUS_TONE[artist.bookingStatus];
  const canRequest = artist.bookingStatus === 'open';
  const isOwnPage = user?.artistId === artist.id;
  const stylesLabel = artist.styles.map(styleName);
  const coverUri = artist.coverUrl || photos[0]?.media_url;
  const seoStyles = stylesLabel.slice(0, 3).join(', ');
  const seoSummary = `${artist.blaze}, artiste tatoueur à ${artist.city}${seoStyles ? ` (${seoStyles})` : ''}.`;
  const statusNote = canRequest
    ? 'Devis établi par l’artiste'
    : artist.bookingStatus === 'paused' ? 'Soyez prévenu dès la réouverture' : 'Ne prend pas de nouveaux projets';
  const universe = [...new Set([...stylesLabel, ...artist.specialties])];
  const placeLine = [stylesLabel.slice(0, 2).join(' · '), artist.city].filter(Boolean).join(' / ');

  // ── Name: upright, last word in vermilion italic on its own line ──
  const words = artist.blaze.trim().split(/\s+/);
  const upright = words.length > 1 ? words.slice(0, -1).join(' ') : artist.blaze;
  const emphasis = words.length > 1 ? words[words.length - 1] : null;
  const panelInnerW = isWide ? Math.max(width * 0.375, 340) - 80 : width - gutter * 2;
  const nameFont = isWide
    ? nameSize(artist.blaze, panelInnerW, Math.min(112, Math.max(64, width * 0.07)), 40)
    : nameSize(artist.blaze, panelInnerW, Math.min(84, Math.max(52, width * 0.17)), 34);
  const nameType = { fontSize: nameFont, lineHeight: Math.round(nameFont * 0.92), letterSpacing: -nameFont * 0.045 };

  // ── The facts the data really holds ──
  const nextSlot = formatNextSlot(stats?.nextSlot);
  const rating = stats && stats.ratingCount > 0 && stats.ratingAvg !== null ? formatRating(stats.ratingAvg) : null;
  const facts: { label: string; value: string }[] = [
    { label: 'Budget', value: artist.minBudget > 0 ? `dès ${artist.minBudget.toLocaleString('fr-FR')} €` : 'Sur devis' },
  ];
  if (portfolioState === 'ready') {
    facts.push({ label: 'Œuvres publiées', value: photos.length > 0 ? String(photos.length) : 'Aucune pour l’instant' });
  }
  if (nextSlot) facts.push({ label: 'Prochain créneau', value: nextSlot });
  if (rating && stats) facts.push({ label: 'Note', value: `${rating} / 5 · ${stats.ratingCount} avis` });
  if (stats && stats.flashCount > 0) {
    facts.push({ label: 'Flashs', value: `${stats.flashCount} ${stats.flashCount > 1 ? 'disponibles' : 'disponible'}` });
  }
  if (stats && stats.followers > 0) facts.push({ label: 'Abonnés', value: formatCount(stats.followers) });
  if (universe.length > 0) facts.push({ label: 'Univers', value: universe.join(' · ') });

  const saveButton = (
    <IconButton
      icon={isSaved ? 'bookmark' : 'bookmark-outline'}
      label={isSaved ? 'Retirer des favoris' : 'Ajouter aux favoris'}
      onPress={() => { if (!pendingIds.has(artist.id)) void handleSave(); }}
      active={isSaved}
      onInk
    />
  );
  const shareButton = (
    <ShareButton
      title={`${artist.blaze} — Tatoueur à ${artist.city}`}
      text={`Découvrez le travail de ${artist.blaze} sur Inkr.`}
      path={`/artist/${artist.id}`}
      onInk
    />
  );

  const mainAction = (compact: boolean) => (canRequest ? (
    <TButton title="Demander un projet" variant="glass" onPress={handleRequest} fullWidth={!compact} />
  ) : !isOwnPage ? (
    <WaitlistButton artistId={artist.id} onInk />
  ) : (
    <TButton
      title={isSaved ? 'Enregistré' : 'Enregistrer'}
      variant="inverse"
      onPress={handleSave}
      fullWidth={!compact}
      icon={<Ionicons name={isSaved ? 'bookmark' : 'bookmark-outline'} size={16} color={Colors.onInk} />}
    />
  ));

  const secondaryActions = !isOwnPage ? (
    <View style={styles.secondary}>
      <FollowButton
        artistId={artist.id}
        artistName={artist.blaze}
        onInk
        style={styles.flexButton}
        onChange={(following) => setStats((s) => (s ? { ...s, followers: Math.max(s.followers + (following ? 1 : -1), 0) } : s))}
      />
      <ContactArtistButton artistId={artist.id} artistName={artist.blaze} onInk style={styles.flexButton} />
    </View>
  ) : null;

  const followHint = !isOwnPage && !hasArtistSignals(stats) ? (
    <TText variant="caption" color="onInkMuted" style={styles.followHint}>
      Suivez cet artiste pour voir ses nouvelles pièces dans votre fil.
    </TText>
  ) : null;

  const topRow = (
    <View style={styles.panelTop}>
      <IconButton icon="arrow-back" label="Retour" onPress={goBack} onInk />
      <View style={styles.panelTopRight}>
        {shareButton}
        {saveButton}
      </View>
    </View>
  );

  const identity = (
    <Animated.View entering={enterUp(0, 60)}>
      <Kicker tone="onInkMuted" style={styles.panelKicker}>
        {artist.isVerified ? 'Profil d’artiste · Vérifié' : 'Profil d’artiste'}
      </Kicker>
      <TText
        variant="displayXL"
        accessibilityRole="header"
        accessibilityLabel={artist.isVerified ? `${artist.blaze}, profil vérifié` : artist.blaze}
        style={[nameType, { color: Colors.onInk }]}
      >
        {upright}
        {emphasis ? (
          <TText variant="displayXL" italic style={[nameType, { color: Colors.flameOnInk }]}>{`\n${emphasis}`}</TText>
        ) : null}
      </TText>
      {!!placeLine && <Kicker tone="flameOnInk" style={styles.placeLine}>{placeLine}</Kicker>}
    </Animated.View>
  );

  const bio = artist.bio ? (
    <TText variant={isWide ? 'body' : 'bodySmall'} color="onInkMuted" style={isWide ? styles.bioWide : styles.bio}>
      {artist.bio}
    </TText>
  ) : null;

  // ── Hero: wide = works at the left, ink panel at the right ──
  const heroWorks = photos.slice(0, 5);
  const topH = Math.max(heroH, panelH);
  const rowH = Math.round(heroH * 0.5);
  const openPost = (postId: string) => router.push(`/post/${postId}`);
  const heroTile = (post: Tables<'posts'>, index: number, h: number) => (
    <PressableScale
      key={post.id}
      onPress={() => openPost(post.id)}
      pressedScale={0.99}
      accessibilityRole="link"
      accessibilityLabel={post.title ?? post.caption ?? `Réalisation ${index + 1}`}
      style={{ height: h }}
    >
      <WorkPlate uri={post.media_url} mark={`N° ${pad2(index + 1)}`} tone={index % 2 ? 'bone' : 'clay'} style={StyleSheet.absoluteFill} />
    </PressableScale>
  );

  const wideGallery = (() => {
    if (portfolioState === 'loading') {
      return (
        <View style={[styles.galleryRow, { height: topH }]}>
          <View style={{ flex: 1 }}><PlateFill /></View>
          <View style={{ flex: 1, gap: SEAM }}>
            <View style={{ flex: 1 }}><PlateFill tone="bone" /></View>
            <View style={{ flex: 1 }}><PlateFill tone="slate" /></View>
          </View>
        </View>
      );
    }
    if (heroWorks.length === 0) {
      return (
        <WorkPlate
          uri={artist.coverUrl || null}
          accessibilityLabel={artist.coverUrl ? `Travail de ${artist.blaze}` : undefined}
          style={{ height: topH }}
        />
      );
    }
    const [a, b, c, d, e] = heroWorks;
    const half = (topH - SEAM) / 2;
    return (
      <View style={{ gap: SEAM }}>
        <View style={[styles.galleryRow, { height: topH }]}>
          <View style={{ flex: 1 }}>{heroTile(a, 0, topH)}</View>
          {b && (
            <View style={{ flex: 1, gap: SEAM }}>
              {heroTile(b, 1, c ? half : topH)}
              {c && heroTile(c, 2, half)}
            </View>
          )}
        </View>
        {d && (
          <View style={[styles.galleryRow, { height: rowH }]}>
            <View style={{ flex: e ? 1.4 : 1 }}>{heroTile(d, 3, rowH)}</View>
            {e && <View style={{ flex: 1 }}>{heroTile(e, 4, rowH)}</View>}
          </View>
        )}
      </View>
    );
  })();

  const widePanel = (
    <InkPanel
      style={[styles.heroPanel, { minHeight: heroH }]}
    >
      <View onLayout={(ev) => setPanelH(Math.round(ev.nativeEvent.layout.height) + 80)}>
        {topRow}
        <View style={{ marginTop: Spacing.xl }}>{identity}</View>
        {bio}
        <View style={styles.panelFacts}>
          <DetailRow label="Statut" onInk>
            <StatusDot tone={statusTone} label={status.label} onInk />
          </DetailRow>
          {facts.map((f, i) => (
            <DetailRow key={f.label} label={f.label} value={f.value} onInk last={i === facts.length - 1} />
          ))}
        </View>
        <View style={styles.panelActions}>
          {mainAction(false)}
          {secondaryActions}
          {followHint}
        </View>
      </View>
    </InkPanel>
  );

  const phonePanel = (
    <InkPanel
      padded={false}
      style={{ paddingTop: insets.top + Spacing['2xs'], paddingHorizontal: gutter, paddingBottom: Spacing.xl }}
    >
      <View onLayout={(ev) => setPanelH(Math.round(ev.nativeEvent.layout.height) + insets.top + Spacing['2xs'] + Spacing.xl)}>
        {topRow}
        <View style={{ marginTop: Spacing.lg }}>{identity}</View>
        <View style={styles.statusLine}>
          <StatusDot tone={statusTone} label={status.label} onInk />
          <TText variant="caption" color="onInkMuted" numberOfLines={1} style={{ flexShrink: 1 }}>{statusNote}</TText>
        </View>
        <View style={styles.panelActions}>
          {mainAction(false)}
          {secondaryActions}
        </View>
        {bio}
        <View style={styles.panelFacts}>
          {facts.map((f, i) => (
            <DetailRow key={f.label} label={f.label} value={f.value} onInk last={i === facts.length - 1} />
          ))}
        </View>
        {followHint}
      </View>
    </InkPanel>
  );

  const phoneStrip = (() => {
    if (portfolioState === 'loading') {
      return (
        <View style={styles.strip}>
          {(['clay', 'bone', 'slate'] as const).map((tone) => (
            <View key={tone} style={{ width: stripW, height: stripW * 1.25 }}><PlateFill tone={tone} /></View>
          ))}
        </View>
      );
    }
    if (photos.length === 0) {
      return artist.coverUrl ? (
        <WorkPlate uri={artist.coverUrl} accessibilityLabel={`Travail de ${artist.blaze}`} style={{ height: Math.round(width * 0.62) }} />
      ) : null;
    }
    return (
      <View style={styles.strip}>
        {photos.slice(0, 3).map((post, i) => (
          <PressableScale
            key={post.id}
            onPress={() => openPost(post.id)}
            pressedScale={0.98}
            accessibilityRole="link"
            accessibilityLabel={post.title ?? post.caption ?? `Réalisation ${i + 1}`}
            style={{ width: stripW, height: stripW * 1.25 }}
          >
            <WorkPlate uri={post.media_url} tone={i % 2 ? 'bone' : 'clay'} style={StyleSheet.absoluteFill} />
          </PressableScale>
        ))}
      </View>
    );
  })();

  const anchors = SUBNAV.filter((s) => present[s.id]);

  return (
    <View style={styles.container}>
      <Seo
        title={`${artist.blaze} — Tatoueur à ${artist.city} | Inkr`}
        description={toDescription(`${seoSummary} ${artist.bio || 'Découvrez son portfolio et envoyez-lui votre projet sur Inkr.'}`)}
        image={coverUri || artist.avatarUrl || null}
        type="profile"
      />

      <Animated.ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: isWide ? Spacing['5xl'] : insets.bottom + 120 }}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {/* ─── Hero ─── */}
        {isWide ? (
          <View style={styles.heroWide}>
            <View style={styles.heroGallery}>{wideGallery}</View>
            <View style={[styles.heroPanelCol, webSticky]}>{widePanel}</View>
          </View>
        ) : (
          <>
            {phonePanel}
            {phoneStrip}
          </>
        )}

        {/* ─── Sub-navigation ─── */}
        {anchors.length > 1 && (
          <View style={[styles.page, { paddingHorizontal: gutter }]}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={[styles.subnav, { marginHorizontal: -gutter }]}
              contentContainerStyle={[styles.subnavRow, { paddingHorizontal: gutter }]}
              accessibilityLabel="Sections du profil"
            >
              {anchors.map((a) => {
                const on = activeAnchor === a.id;
                return (
                  <Pressable
                    key={a.id}
                    onPress={() => goTo(a.id)}
                    accessibilityRole="link"
                    accessibilityLabel={`Aller à la section ${a.label}`}
                    style={(state) => [
                      styles.subnavItem,
                      on && styles.subnavItemOn,
                      Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null,
                      (state as { hovered?: boolean }).hovered && styles.subnavItemHover,
                    ]}
                  >
                    <TText variant="label" weight="bold" uppercase style={{ color: on ? Colors.ink : Colors.textSecondary, letterSpacing: 1.2 }}>
                      {a.label}
                    </TText>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}

        <View onLayout={(e) => { sectionsY.current = e.nativeEvent.layout.y; }}>
          {/* ─── Stories, availability, flashes, guest spots ─── */}
          <Block gutter={gutter}><StoriesRail artistIds={[artist.id]} /></Block>
          {canRequest && (
            <Block id="availability" gutter={gutter} onPresence={onPresence} onOffset={onOffset}>
              <AvailabilitySection artistId={artist.id} onPick={handleRequest} />
            </Block>
          )}
          <Block id="flashes" gutter={gutter} onPresence={onPresence} onOffset={onOffset}>
            <FlashRail artistId={artist.id} kicker="Flashs" title="Des dessins à adopter" gutter={gutter} />
          </Block>
          <Block id="guests" gutter={gutter} onPresence={onPresence} onOffset={onOffset}>
            <GuestSpotRail artistId={artist.id} ownerActions={isOwnPage} gutter={gutter} />
          </Block>

          {/* ─── Videos ─── */}
          {portfolioState === 'ready' && videos.length > 0 && (
            <Block id="videos" gutter={gutter} onPresence={onPresence} onOffset={onOffset}>
              <SectionHead
                kicker={`Vidéos · ${videos.length} vidéo${videos.length > 1 ? 's' : ''}`}
                title="En"
                emphasis="mouvement."
              />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginHorizontal: -gutter }}
                contentContainerStyle={[styles.videoRail, { paddingHorizontal: gutter }]}
              >
                {videos.map((post, i) => (
                  <PressableScale
                    key={post.id}
                    onPress={() => router.push({ pathname: '/reels/[id]', params: { id: post.id, artist: artist.id } })}
                    accessibilityRole="link"
                    accessibilityLabel={post.caption ?? `Vidéo ${i + 1}`}
                    style={styles.videoTile}
                  >
                    {post.thumbnail_url ? (
                      <>
                        <RevealImage uri={post.thumbnail_url} style={StyleSheet.absoluteFill} />
                        <PlayBadge compact />
                      </>
                    ) : (
                      <VideoPlaceholder compact />
                    )}
                  </PressableScale>
                ))}
              </ScrollView>
            </Block>
          )}

          {/* ─── Portfolio ─── */}
          <Block id="portfolio" gutter={gutter} onPresence={onPresence} onOffset={onOffset}>
            <SectionHead
              kicker={portfolioState === 'ready' && photos.length > 0
                ? `Portfolio · ${photos.length} œuvre${photos.length > 1 ? 's' : ''}`
                : 'Portfolio'}
              title="Les"
              emphasis="œuvres."
            />

            {portfolioState === 'ready' && usedSeries.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={[styles.seriesTabs, { marginHorizontal: -gutter }]}
                contentContainerStyle={[styles.seriesRail, { paddingHorizontal: gutter }]}
                accessibilityRole="tablist"
              >
                {[{ id: null as string | null, title: 'Tout' }, ...usedSeries].map((s) => {
                  const selected = (currentSeries?.id ?? null) === s.id;
                  return (
                    <Pressable
                      key={s.id ?? 'all'}
                      onPress={() => setActiveSeries(s.id)}
                      accessibilityRole="tab"
                      accessibilityState={{ selected }}
                      style={[
                        styles.seriesTab,
                        selected && styles.seriesTabActive,
                        Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null,
                      ]}
                    >
                      <TText
                        variant="label"
                        weight="bold"
                        uppercase
                        numberOfLines={1}
                        style={{ color: selected ? Colors.ink : Colors.textSecondary, letterSpacing: 1.1 }}
                      >
                        {s.title}
                      </TText>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
            {currentSeries && (
              <View style={[styles.seriesNote, isWide && styles.seriesNoteWide]}>
                <View style={{ flex: isWide ? 1 : undefined, minWidth: 0 }}>
                  <Kicker tone="flame">Série</Kicker>
                  <TText variant="displayS" italic style={styles.seriesTitle}>{currentSeries.title}</TText>
                  {!!currentSeries.description && (
                    <TText variant="bodySmall" color="secondary" numberOfLines={3} style={styles.seriesText}>
                      {currentSeries.description}
                    </TText>
                  )}
                </View>
                <TextLink
                  label="Voir l’exposition"
                  onPress={() => router.push({ pathname: '/series/[id]', params: { id: currentSeries.id } })}
                  style={styles.seriesLink}
                />
              </View>
            )}

            {portfolioState === 'loading' && (
              <View style={[styles.grid, { columnGap: colGap }]}>
                {Array.from({ length: cols * 2 }).map((_, i) => (
                  <View key={i} style={{ width: cell }}>
                    <TSkeleton width={cell} height={cell * 1.25} radius={0} />
                    <TSkeleton width="60%" height={14} radius={0} style={{ marginTop: 12 }} />
                  </View>
                ))}
              </View>
            )}
            {portfolioState === 'error' && (
              <EmptyState icon="images-outline" title="Portfolio indisponible" description="Le chargement a échoué." ctaLabel="Réessayer" onCta={retry} style={styles.inlineEmpty} />
            )}
            {portfolioState === 'ready' && photos.length === 0 && (
              <EmptyState icon="images-outline" title="Pas encore de réalisations" description="Cet artiste n’a rien publié pour le moment." style={styles.inlineEmpty} />
            )}
            {portfolioState === 'ready' && photos.length > 0 && (
              <View style={[styles.grid, { columnGap: colGap }]}>
                {shownPhotos.map((post, i) => {
                  // Every 5th piece spans two columns, like a featured print on the wall.
                  const feature = cols > 1 && i % 5 === 0 && i + 1 < shownPhotos.length;
                  const w = feature ? cell * 2 + colGap : cell;
                  const label = artworkLabel(post, styleName);
                  return (
                    <Animated.View key={post.id} entering={i < 8 ? enterUp(i, 100) : undefined} style={{ width: w }}>
                      <PressableScale
                        onPress={() => openPost(post.id)}
                        accessibilityRole="link"
                        accessibilityLabel={post.title ?? post.caption ?? `Réalisation ${i + 1}`}
                        style={{ width: w }}
                      >
                        <WorkPlate
                          uri={post.media_url}
                          mark={`N° ${pad2(i + 1)}`}
                          tone={i % 3 === 1 ? 'bone' : 'clay'}
                          style={{ width: w, height: cell * 1.25 }}
                        />
                        <View style={styles.caption}>
                          <TText variant="title2" serif numberOfLines={1} style={styles.captionTitle}>{label.title}</TText>
                          {!!label.lines[0] && (
                            <TText variant="caption" color="secondary" numberOfLines={1}>{label.lines[0]}</TText>
                          )}
                        </View>
                      </PressableScale>
                    </Animated.View>
                  );
                })}
              </View>
            )}
          </Block>

          <Block id="healed" gutter={gutter} onPresence={onPresence} onOffset={onOffset}>
            <HealedRail artistId={artist.id} gutter={gutter} />
          </Block>

          {stats && stats.ratingCount > 0 && (
            <Block id="reviews" gutter={gutter} onPresence={onPresence} onOffset={onOffset}>
              <ReviewsSection artistId={artist.id} ratingAvg={stats.ratingAvg} ratingCount={stats.ratingCount} />
            </Block>
          )}

          {(!!artist.process || !!artist.rules || artist.exclusions.length > 0) && (
            <Block id="method" gutter={gutter} onPresence={onPresence} onOffset={onOffset}>
              {!!artist.process && (
                <Chapter kicker="Méthode" title="Comment je" emphasis="travaille." wide={isWide}>
                  <TText variant="body" color="secondary" style={styles.prose}>{artist.process}</TText>
                </Chapter>
              )}
              {!!artist.rules && (
                <Chapter kicker="Avant de demander" title="Les" emphasis="conditions." wide={isWide}>
                  <TText variant="body" color="secondary" style={styles.prose}>{artist.rules}</TText>
                </Chapter>
              )}
              {artist.exclusions.length > 0 && (
                <Chapter kicker="Limites" title="Je ne réalise" emphasis="pas." wide={isWide}>
                  {artist.exclusions.map((e) => (
                    <View key={e} style={styles.listRow}>
                      <View style={styles.listDash} />
                      <TText variant="body" color="secondary" style={{ flex: 1 }}>{e}</TText>
                    </View>
                  ))}
                </Chapter>
              )}
            </Block>
          )}

          {artist.faq.length > 0 && (
            <Block id="faq" gutter={gutter} onPresence={onPresence} onOffset={onOffset}>
              <Chapter kicker="Questions" title="Questions" emphasis="fréquentes." wide={isWide}>
                <View style={styles.faqList}>
                  {artist.faq.map((item, i) => (
                    <FaqItem key={item.question} question={item.question} answer={item.answer} index={i} />
                  ))}
                </View>
              </Chapter>
            </Block>
          )}
        </View>
      </Animated.ScrollView>

      {/* ─── Phones: a compact bar and the main action once the ink panel has scrolled away ─── */}
      {!isWide && (
        <>
          <Animated.View
            style={[styles.compactBar, { paddingTop: insets.top + 6 }, barStyle]}
            pointerEvents={pastPanel ? 'box-none' : 'none'}
            accessibilityElementsHidden={!pastPanel}
            importantForAccessibility={pastPanel ? 'auto' : 'no-hide-descendants'}
          >
            <View style={styles.compactInner}>
              <IconButton icon="arrow-back" label="Retour" onPress={goBack} />
              <TText variant="title2" serif numberOfLines={1} style={styles.compactName}>{artist.blaze}</TText>
              <IconButton
                icon={isSaved ? 'bookmark' : 'bookmark-outline'}
                label={isSaved ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                onPress={() => { if (!pendingIds.has(artist.id)) void handleSave(); }}
                active={isSaved}
              />
            </View>
          </Animated.View>

          <Animated.View
            style={[styles.stickyBar, { paddingBottom: insets.bottom + 12 }, barStyle]}
            pointerEvents={pastPanel ? 'box-none' : 'none'}
            accessibilityElementsHidden={!pastPanel}
            importantForAccessibility={pastPanel ? 'auto' : 'no-hide-descendants'}
          >
            {canRequest ? (
              <View style={styles.stickyInner}>
                <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                  <StatusDot tone={statusTone} label={status.short} onInk />
                  <TText variant="caption" color="onInkMuted" numberOfLines={1}>{statusNote}</TText>
                </View>
                {mainAction(true)}
              </View>
            ) : (
              <View style={styles.stickyInner}>
                <View style={{ flex: 1, minWidth: 0 }}>{mainAction(false)}</View>
              </View>
            )}
          </Animated.View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  page: { width: '100%', maxWidth: Layout.maxContent, alignSelf: 'center' },

  // Hero (wide)
  heroWide: { flexDirection: 'row', alignItems: 'flex-start', width: '100%', maxWidth: 1600, alignSelf: 'center' },
  heroGallery: { flex: 1.25, minWidth: 0 },
  heroPanelCol: { flex: 0.75, minWidth: 340, maxWidth: 560 },
  heroPanel: { flex: 1 },
  galleryRow: { flexDirection: 'row', gap: SEAM },

  // Ink panel
  panelTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  panelTopRight: { flexDirection: 'row', gap: 8 },
  panelKicker: { marginBottom: Spacing.md },
  placeLine: { marginTop: Spacing.md },
  bio: { marginTop: Spacing.lg, lineHeight: 22 },
  bioWide: { marginTop: Spacing.xl, lineHeight: 28, maxWidth: 460 },
  statusLine: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: Spacing.md, flexWrap: 'wrap' },
  panelFacts: { marginTop: Spacing.xl },
  panelActions: { marginTop: Spacing.lg, gap: Spacing['2xs'] },
  secondary: { flexDirection: 'row', gap: Spacing['2xs'] },
  flexButton: { flex: 1, minWidth: 0 },
  followHint: { marginTop: Spacing.xs },

  // Phone strip
  strip: { flexDirection: 'row', gap: SEAM, marginTop: SEAM },

  // Sub-navigation
  subnav: { flexGrow: 0, borderBottomWidth: 1, borderBottomColor: Colors.line, marginTop: Spacing.md },
  subnavRow: { gap: Spacing.lg },
  subnavItem: { minHeight: 48, justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  subnavItemOn: { borderBottomColor: Colors.flame },
  subnavItemHover: { borderBottomColor: Colors.line },

  // Sections
  block: { marginTop: Spacing['2xl'], paddingTop: Spacing.xl, borderTopWidth: 1, borderTopColor: Colors.line },

  videoRail: { gap: SEAM },
  videoTile: { width: 132, height: 234, overflow: 'hidden', backgroundColor: Colors.inkPanel },

  seriesTabs: { flexGrow: 0, borderBottomWidth: 1, borderBottomColor: Colors.line, marginBottom: Spacing.md },
  seriesRail: { gap: Spacing.md },
  seriesTab: { minHeight: 44, justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  seriesTabActive: { borderBottomColor: Colors.flame },
  seriesNote: {
    marginBottom: Spacing.lg, paddingLeft: Spacing.sm,
    borderLeftWidth: 2, borderLeftColor: Colors.flame, gap: Spacing.xs,
  },
  seriesNoteWide: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.xl, maxWidth: 900 },
  seriesTitle: { marginTop: 6 },
  seriesText: { marginTop: 6, maxWidth: Layout.maxReading },
  seriesLink: { alignSelf: 'flex-start', minHeight: 44 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: Spacing.lg },
  caption: { paddingTop: 10, gap: 2 },
  captionTitle: { fontSize: 20, lineHeight: 24, letterSpacing: -0.3 },
  inlineEmpty: { flex: 0, paddingVertical: Spacing.xl },

  chapter: { paddingVertical: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.line },
  chapterWide: { flexDirection: 'row', gap: Spacing['2xl'], paddingVertical: Spacing.xl },
  chapterAside: { width: '36%', maxWidth: 420 },
  chapterHead: { marginBottom: Spacing.md },
  chapterBody: { flex: 1, minWidth: 0, paddingTop: 4 },
  prose: { maxWidth: Layout.maxReading, lineHeight: 27 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  listDash: { width: 14, height: 1, backgroundColor: Colors.flame },

  faqList: { borderTopWidth: 1, borderTopColor: Colors.ink },
  faqItem: { paddingVertical: Spacing.sm, minHeight: 56, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: Colors.line },
  faqRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  faqNumber: { width: 22, color: Colors.textTertiary },
  faqAnswer: { marginTop: Spacing['2xs'], marginLeft: 36, maxWidth: Layout.maxReading, lineHeight: 22 },

  // Phone bars
  compactBar: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100,
    paddingBottom: 8, paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.paper, borderBottomWidth: 1, borderBottomColor: Colors.ink,
  },
  compactInner: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  compactName: { flex: 1, textAlign: 'center', fontSize: 22, lineHeight: 26 },
  stickyBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingTop: 12, paddingHorizontal: Layout.gutter,
    backgroundColor: Colors.inkPanel,
  },
  stickyInner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    width: '100%', maxWidth: Layout.maxContent, alignSelf: 'center',
  },
});
