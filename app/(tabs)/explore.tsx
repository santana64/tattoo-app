import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import {
  StyleSheet,
  View,
  TextInput,
  Pressable,
  ScrollView,
  RefreshControl,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useContentDimensions } from '@/hooks/useContentDimensions';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { BottomSheet } from '@/components/motion';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Radius, FontSize, Fonts, Layout } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TButton } from '@/components/ui/TButton';
import { TInput } from '@/components/ui/TInput';
import { TSkeleton } from '@/components/ui/TSkeleton';
import { ArtistCard } from '@/components/ArtistCard';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  ArtCanvas, IconButton, Kicker, Masthead, SectionHead, StatusDot, TextLink, type StatusTone,
} from '@/components/v5';
import { useSavedArtistsStore } from '@/store/saved-artists-store';
import { useAuthStore } from '@/store/auth-store';
import { Toast } from '@/components/ui/TToast';
import { STYLES } from '@/constants/tattoo';
import { useAutoRetry } from '@/hooks/use-auto-retry';
import type { Artist } from '@/constants/tattoo';
import { supabase } from '@/lib/supabase';
import { PUBLIC_ARTIST_COLUMNS, mapArtist } from '@/lib/catalog';
import { fetchArtistStats, type ArtistStats } from '@/lib/studio';
import { fetchNearbyArtistIds, geocodeCity, type Coordinates } from '@/lib/care';
import { FlashRail } from '@/components/gallery/FlashRail';
import { GuestSpotRail } from '@/components/gallery/GuestSpotRail';

interface ExploreTrendingPost {
  id: string;
  mediaUrl: string;
  artistName: string;
}

type Availability = 'all' | 'open' | 'paused' | 'closed';
type SortKey = 'relevance' | 'open' | 'budget_asc';

const AVAILABILITY_OPTIONS: { value: Availability; label: string; tone?: StatusTone }[] = [
  { value: 'all', label: 'Tous' },
  { value: 'open', label: 'Prend des projets', tone: 'open' },
  { value: 'paused', label: 'Liste d’attente', tone: 'wait' },
  { value: 'closed', label: 'Complet', tone: 'closed' },
];
// Minimum budget an artist accepts — not a quote. Artists without a public budget are excluded when a cap is set.
const BUDGET_OPTIONS: { label: string; value: number | null }[] = [
  { label: 'Tous', value: null },
  { label: 'Jusqu’à 300 €', value: 300 },
  { label: 'Jusqu’à 500 €', value: 500 },
  { label: 'Jusqu’à 800 €', value: 800 },
];
const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'relevance', label: 'Pertinence' },
  { value: 'open', label: 'Disponibles d’abord' },
  { value: 'budget_asc', label: 'Budget croissant' },
];
// "Near me": search radius in kilometres.
const RADIUS_OPTIONS = [10, 25, 50, 100] as const;
const DEFAULT_RADIUS = 25;
type NearState = 'idle' | 'locating' | 'loading' | 'ready' | 'error';
interface NearResult { artist: Artist; distanceKm: number }

/** Two decimals (about a kilometre): enough to rank artists, and all the precision we ever send. */
const roundCoords = (c: Coordinates): Coordinates => ({
  latitude: Math.round(c.latitude * 100) / 100,
  longitude: Math.round(c.longitude * 100) / 100,
});

const geolocationAvailable = () =>
  Platform.OS === 'web' && typeof navigator !== 'undefined' && !!navigator.geolocation;

const PREVIEWS_PER_ARTIST = 3;
const PAGE_SIZE = 24;
const SEARCH_DEBOUNCE_MS = 300;

const normalize = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// Accepts a slug ("fine-line") or a display name ("Fine Line") from deep links.
function resolveStyleSlug(param: string | string[] | undefined): string | null {
  const raw = Array.isArray(param) ? param[0] : param;
  if (!raw) return null;
  const n = normalize(raw);
  return STYLES.find((s) => s.slug === n || normalize(s.name) === n)?.slug ?? null;
}

/** The same rules as search_artists, applied to the nearby results on the device. */
function matchesFilters(a: Artist, f: { term: string; style: string | null; availability: Availability; budgetMax: number | null }): boolean {
  if (f.term) {
    const term = normalize(f.term).replace(/-/g, ' ');
    const inName = normalize(`${a.blaze} ${a.city}`).replace(/-/g, ' ').includes(term);
    const inStyles = a.styles.some((st) => normalize(st).replace(/-/g, ' ').includes(term));
    if (!inName && !inStyles) return false;
  }
  if (f.style && !a.styles.some((st) => normalize(st).replace(/ /g, '-') === f.style)) return false;
  if (f.availability !== 'all' && a.bookingStatus !== f.availability) return false;
  if (f.budgetMax !== null && !(a.minBudget > 0 && a.minBudget <= f.budgetMax)) return false;
  return true;
}

// ─── Small building blocks ────────────────────────────────────────────────────
type Hover = { pressed: boolean; hovered?: boolean; focused?: boolean };
const webPointer = Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null;
const STATUS_DOT: Record<StatusTone, string> = {
  open: Colors.moss, wait: '#C08A49', closed: '#A29B90', alert: Colors.flame,
};

/** Filter pill (v5: the only rounded control). Carries a status dot or an icon; reports its x for the rail. */
function Chip({ label, selected, onPress, tone, icon, onLayout }: {
  label: string; selected: boolean; onPress: () => void; tone?: StatusTone;
  icon?: keyof typeof Ionicons.glyphMap; onLayout?: (x: number) => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      onLayout={onLayout ? (e) => onLayout(e.nativeEvent.layout.x) : undefined}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={(state) => {
        const { pressed, hovered, focused } = state as Hover;
        return [
          styles.chip,
          (pressed || hovered) && !selected && styles.chipHover,
          selected && styles.chipSelected,
          focused && styles.chipFocused,
        ];
      }}
    >
      {tone && <View style={[styles.chipDot, { backgroundColor: STATUS_DOT[tone] }]} />}
      {icon && <Ionicons name={icon} size={14} color={selected ? Colors.paper : Colors.ink} />}
      <TText variant="caption" weight="semibold" style={{ fontSize: 12.5, lineHeight: 16, color: selected ? Colors.paper : Colors.ink }}>
        {label}
      </TText>
    </Pressable>
  );
}

/** A labelled group of pills: "Statut", "Budget", "Trier par". */
function FilterGroup({ label, children, note }: { label: string; children: React.ReactNode; note?: string }) {
  return (
    <View style={styles.filterGroup}>
      <Kicker tone="muted" style={styles.filterLabel}>{label}</Kicker>
      <View style={styles.wrapRow} accessibilityLabel={label}>{children}</View>
      {!!note && <TText variant="caption" color="tertiary" style={styles.filterNote}>{note}</TText>}
    </View>
  );
}

function TrendingTile({ post, index }: { post: ExploreTrendingPost; index: number }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push(`/post/${post.id}`)}
      accessibilityRole="link"
      accessibilityLabel={`Réalisation de ${post.artistName}`}
      style={(state) => [styles.trendingTile, (state as Hover).pressed && { opacity: 0.85 }, webPointer]}
    >
      {(state) => (
        <>
          <ArtCanvas uri={post.mediaUrl} aspectRatio={4 / 5} mark={`N° ${String(index + 1).padStart(2, '0')}`} />
          <TText
            variant="title2"
            serif
            numberOfLines={1}
            style={[styles.trendingName, (state as Hover).hovered && { color: Colors.flameText }]}
          >
            {post.artistName}
          </TText>
        </>
      )}
    </Pressable>
  );
}

function ListSkeleton() {
  return (
    <View style={{ gap: Spacing['2xl'], marginTop: Spacing.sm }}>
      {[0, 1].map((i) => (
        <View key={i} style={styles.skeletonCard}>
          <TSkeleton height={240} radius={0} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14 }}>
            <TSkeleton width={40} height={40} radius={0} />
            <View style={{ flex: 1, gap: 8 }}>
              <TSkeleton width="45%" height={20} radius={0} />
              <TSkeleton width="30%" height={11} radius={0} />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ style?: string }>();
  const { width, isWide, gutter } = useContentDimensions();
  const reduced = useReducedMotion();
  const { user } = useAuthStore();
  const { savedArtistIds, fetchSaved, toggle } = useSavedArtistsStore();
  useEffect(() => { void fetchSaved(user?.id); }, [fetchSaved, user?.id]);
  const toggleSaveArtist = useCallback(async (id: string) => {
    if (!user?.id) { router.push('/(auth)/sign-in'); return; }
    if (!await toggle(user.id, id)) Toast.error('Favori non enregistré. Réessayez.');
  }, [router, toggle, user?.id]);

  // ── Data
  const [artists, setArtists] = useState<Artist[]>([]);
  const [previews, setPreviews] = useState<Record<string, string[]>>({});
  // Public numbers per artist (rating, next slot, flashes): a bonus, never awaited.
  const [stats, setStats] = useState<Record<string, ArtistStats>>({});
  const [trendingPosts, setTrendingPosts] = useState<ExploreTrendingPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [openTotal, setOpenTotal] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  // Only the latest search may write its results (filters change while a request is in flight).
  const searchSeq = useRef(0);

  // ── Filters
  const [query, setQuery] = useState('');
  // The search runs in the database: wait for a pause in typing before asking.
  const [searchTerm, setSearchTerm] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);
  const [selectedStyle, setSelectedStyle] = useState<string | null>(() => resolveStyleSlug(params.style));
  const [availability, setAvailability] = useState<Availability>('all');
  const [budgetMax, setBudgetMax] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>('relevance');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [searchFocused, setSearchFocused] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const chipRail = useRef<ScrollView>(null);

  // ── Near me: the position stays on the device; only the nearby RPC receives it, rounded.
  const [nearMode, setNearMode] = useState(false);
  const [nearCoords, setNearCoords] = useState<Coordinates | null>(null);
  const [nearPlace, setNearPlace] = useState('');
  const [radius, setRadius] = useState<number>(DEFAULT_RADIUS);
  const [nearState, setNearState] = useState<NearState>('idle');
  const [nearMessage, setNearMessage] = useState<string | null>(null);
  const [nearResults, setNearResults] = useState<NearResult[]>([]);
  const [nearPreviews, setNearPreviews] = useState<Record<string, string[]>>({});
  const [cityMode, setCityMode] = useState(false);
  const [cityQuery, setCityQuery] = useState(() => user?.city ?? '');
  const [showPrivacy, setShowPrivacy] = useState(false);
  const privacyShown = useRef(false);
  const nearSeq = useRef(0);
  const chipX = useRef<Record<string, number>>({});

  // Follow deep links that change the style while the tab stays mounted.
  useEffect(() => {
    const slug = resolveStyleSlug(params.style);
    if (slug) setSelectedStyle(slug);
  }, [params.style]);

  /** Portfolio previews for the cards: latest published photos of the given artists. */
  const fetchPreviews = useCallback(async (artistIds: string[]) => {
    if (!artistIds.length) return {};
    const { data: work, error } = await supabase.rpc('artist_portfolio_previews', {
      p_artist_ids: artistIds,
      p_per_artist: PREVIEWS_PER_ARTIST,
    });
    // Artist cards still render from their own cover when the optional preview
    // query is unavailable during a staged database/client rollout.
    if (error) return {};
    const grouped: Record<string, string[]> = {};
    for (const row of work ?? []) {
      const list = (grouped[row.artist_id] ??= []);
      if (list.length < PREVIEWS_PER_ARTIST) list.push(row.media_url);
    }
    return grouped;
  }, []);

  /** Merges the public numbers of a page of artists; cards render without them meanwhile. */
  const loadStats = useCallback((artistIds: string[]) => {
    if (!artistIds.length) return;
    fetchArtistStats(artistIds)
      .then((page) => setStats((current) => ({ ...current, ...page })))
      .catch(() => { /* Optional decoration: the cards stay complete without it. */ });
  }, []);

  /** Artists around a point, nearest first, with the same public columns as the search. */
  const loadNearby = useCallback(async (coords: Coordinates, radiusKm: number) => {
    const seq = ++nearSeq.current;
    setNearState('loading');
    setNearMessage(null);
    try {
      const rows = await fetchNearbyArtistIds(roundCoords(coords), radiusKm);
      if (seq !== nearSeq.current) return;
      let results: NearResult[] = [];
      if (rows.length) {
        const { data, error } = await supabase.from('artists').select(PUBLIC_ARTIST_COLUMNS).in('id', rows.map((r) => r.artistId));
        if (error) throw error;
        if (seq !== nearSeq.current) return;
        const byId = new Map((data ?? []).map((row) => [row.id, mapArtist(row)]));
        results = rows.flatMap((r) => {
          const artist = byId.get(r.artistId);
          return artist ? [{ artist, distanceKm: r.distanceKm }] : [];
        });
      }
      setNearResults(results);
      setNearState('ready');
      const ids = results.map((r) => r.artist.id);
      loadStats(ids);
      const grouped = await fetchPreviews(ids);
      if (seq === nearSeq.current) setNearPreviews(grouped);
    } catch {
      if (seq === nearSeq.current) setNearState('error');
    }
  }, [fetchPreviews, loadStats]);

  /** One page of artists matching the current filters, searched and sorted by the database. */
  const fetchPage = useCallback(async (offset: number) => {
    const { data, error } = await supabase.rpc('search_artists', {
      p_query: searchTerm || null,
      p_style: selectedStyle,
      p_availability: availability === 'all' ? null : availability,
      p_budget_max: budgetMax,
      p_sort: sortBy,
      p_limit: PAGE_SIZE,
      p_offset: offset,
    });
    if (error) throw error;
    const rows = data ?? [];
    return {
      artists: rows.map(mapArtist),
      total: rows.length ? Number(rows[0].total_count) : offset,
      openTotal: rows.length ? Number(rows[0].open_count) : 0,
    };
  }, [searchTerm, selectedStyle, availability, budgetMax, sortBy]);

  const fetchData = useCallback(async () => {
    const seq = ++searchSeq.current;
    setFetchError(null);
    try {
      const page = await fetchPage(0);
      if (seq !== searchSeq.current) return;
      setArtists(page.artists);
      setTotal(page.total);
      setOpenTotal(page.openTotal);
      loadStats(page.artists.map((a) => a.id));
      const grouped = await fetchPreviews(page.artists.map((a) => a.id));
      if (seq === searchSeq.current) setPreviews(grouped);
    } catch (e: any) {
      if (seq !== searchSeq.current) return;
      setFetchError(e?.message ? 'Le service ne répond pas. Vérifiez votre connexion.' : 'Erreur de chargement');
    } finally {
      if (seq === searchSeq.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [fetchPage, fetchPreviews, loadStats]);

  // A new search (first load, or any filter change) restarts from the first page.
  useEffect(() => {
    setIsLoading(true);
    void fetchData();
  }, [fetchData]);

  const hasMore = artists.length < total;
  const fetchMore = useCallback(async () => {
    if (isLoading || isLoadingMore || !hasMore || fetchError) return;
    const seq = searchSeq.current;
    setIsLoadingMore(true);
    try {
      const page = await fetchPage(artists.length);
      if (seq !== searchSeq.current) return;
      setArtists((current) => {
        const known = new Set(current.map((a) => a.id));
        return [...current, ...page.artists.filter((a) => !known.has(a.id))];
      });
      // An empty page means the list shrank meanwhile: stop asking for more.
      setTotal(page.artists.length ? page.total : artists.length);
      loadStats(page.artists.map((a) => a.id));
      const grouped = await fetchPreviews(page.artists.map((a) => a.id));
      if (seq === searchSeq.current) setPreviews((current) => ({ ...current, ...grouped }));
    } catch {
      Toast.error('Impossible de charger la suite. Réessayez.');
    } finally {
      setIsLoadingMore(false);
    }
  }, [artists.length, fetchError, fetchPage, fetchPreviews, hasMore, isLoading, isLoadingMore, loadStats]);

  // Trending work is independent from the artist filters: loaded once, and on refresh.
  const fetchTrending = useCallback(async () => {
    const { data, error } = await supabase
      .from('posts')
      .select('id, media_url, likes_count, artists!posts_artist_id_fkey!inner(blaze)')
      .eq('is_published', true)
      .eq('media_type', 'photo')
      .order('likes_count', { ascending: false })
      .limit(10);
    if (error || !data) return;
    setTrendingPosts(data.map((p: any) => ({
      id: p.id,
      mediaUrl: p.media_url,
      artistName: (p.artists as any)?.blaze ?? '',
    })));
  }, []);
  useEffect(() => { void fetchTrending(); }, [fetchTrending]);
  // A failed load retries on its own (and as soon as the connection is back).
  useAutoRetry(!!fetchError, isLoading, () => { setIsLoading(true); void fetchData(); });

  // Keep the selected style visible in the rail (e.g. after a deep link from the welcome screen).
  const revealChip = useCallback((slug: string | null) => {
    const x = slug ? chipX.current[slug] : 0;
    if (x !== undefined) chipRail.current?.scrollTo({ x: Math.max(0, x - gutter), animated: true });
  }, [gutter]);
  useEffect(() => { revealChip(selectedStyle); }, [selectedStyle, revealChip]);

  const handleRefresh = useCallback(() => {
    if (nearMode) {
      if (nearCoords) void loadNearby(nearCoords, radius);
      return;
    }
    setIsRefreshing(true);
    void fetchTrending();
    void fetchData();
  }, [fetchData, fetchTrending, nearMode, nearCoords, radius, loadNearby]);

  const resetAll = () => {
    setQuery('');
    setSelectedStyle(null);
    setAvailability('all');
    setBudgetMax(null);
    setSortBy('relevance');
  };

  const askForCity = (message: string | null) => {
    setCityMode(true);
    setNearState('idle');
    setNearMessage(message);
  };

  const locateMe = () => {
    if (!geolocationAvailable()) {
      askForCity('Votre navigateur ne permet pas la localisation : indiquez une ville.');
      return;
    }
    const seq = ++nearSeq.current;
    setCityMode(false);
    setNearMessage(null);
    setNearState('locating');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (seq !== nearSeq.current) return;
        const coords = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        setNearCoords(coords);
        setNearPlace('votre position');
        void loadNearby(coords, radius);
      },
      (error) => {
        if (seq !== nearSeq.current) return;
        askForCity(error.code === 1
          ? 'Localisation refusée : cherchez plutôt autour d’une ville.'
          : 'Votre position est introuvable pour le moment : cherchez plutôt autour d’une ville.');
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  };

  const searchCity = async () => {
    const city = cityQuery.trim();
    if (city.length < 2) { setNearMessage('Indiquez une ville.'); return; }
    const seq = ++nearSeq.current;
    setNearMessage(null);
    setNearState('locating');
    try {
      const place = await geocodeCity(city);
      if (seq !== nearSeq.current) return;
      if (!place) {
        setNearState(nearCoords ? 'ready' : 'idle');
        setNearMessage(`« ${city} » est introuvable. Vérifiez l’orthographe.`);
        return;
      }
      const coords = { latitude: place.latitude, longitude: place.longitude };
      setNearCoords(coords);
      setNearPlace(place.label || city);
      setCityMode(false);
      void loadNearby(coords, radius);
    } catch {
      if (seq !== nearSeq.current) return;
      setNearState(nearCoords ? 'ready' : 'idle');
      setNearMessage('La recherche de ville ne répond pas. Réessayez.');
    }
  };

  const startNear = () => {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    setNearMode(true);
    if (!privacyShown.current) { privacyShown.current = true; setShowPrivacy(true); }
    if (nearCoords) { void loadNearby(nearCoords, radius); return; }
    if (geolocationAvailable()) locateMe();
    else askForCity(Platform.OS === 'web'
      ? 'Votre navigateur ne permet pas la localisation : indiquez une ville.'
      : 'La localisation de l’appareil n’est pas disponible dans l’app : indiquez une ville.');
  };

  const leaveNear = () => {
    nearSeq.current += 1;
    setNearMode(false);
    setNearState('idle');
    setNearMessage(null);
    setShowPrivacy(false);
  };

  const changeRadius = (next: number) => {
    setRadius(next);
    if (nearCoords) void loadNearby(nearCoords, next);
  };

  const sheetFilterCount = Number(availability !== 'all') + Number(budgetMax !== null) + Number(sortBy !== 'relevance');
  const hasFilters = !!query || !!selectedStyle || sheetFilterCount > 0;

  // Filtering and sorting happen in the database (search_artists): `artists` is already the result.
  const filtered = artists;

  const spotlightArtist = useMemo(
    () => artists.find((a) => a.tier === 'premium' && a.bookingStatus === 'open'),
    [artists],
  );
  const listed = useMemo(
    () => (hasFilters || !spotlightArtist ? filtered : filtered.filter((a) => a.id !== spotlightArtist.id)),
    [filtered, hasFilters, spotlightArtist],
  );

  // Near mode keeps the distance order and applies the visible filters on the device.
  const nearListed = useMemo(
    () => nearResults.filter((r) => matchesFilters(r.artist, { term: searchTerm, style: selectedStyle, availability, budgetMax })),
    [nearResults, searchTerm, selectedStyle, availability, budgetMax],
  );
  const nearDistances = useMemo(
    () => Object.fromEntries(nearResults.map((r) => [r.artist.id, r.distanceKm])) as Record<string, number>,
    [nearResults],
  );
  const nearBusy = nearState === 'locating' || nearState === 'loading';
  const listData = nearMode
    ? (nearState === 'ready' ? nearListed.map((r) => r.artist) : [])
    : (isLoading ? [] : listed);
  // List: one cartel per row on phones, two on wide screens. Grid: two plates, four on wide screens.
  const contentWidth = Math.min(width, Layout.maxContent);
  const columns = viewMode === 'grid' ? (contentWidth >= 1000 ? 4 : 2) : isWide ? 2 : 1;

  const renderArtist = useCallback(
    ({ item, index }: { item: Artist; index: number }) => (
      <View style={[styles.cell, columns > 1 && styles.cellMulti]}>
        <ArtistCard
          artist={item}
          index={index}
          isSaved={savedArtistIds.has(item.id)}
          onSave={toggleSaveArtist}
          variant={viewMode === 'grid' ? 'tile' : 'default'}
          previewImages={nearMode ? nearPreviews[item.id] ?? previews[item.id] : previews[item.id]}
          stats={stats[item.id]}
          distanceKm={nearMode ? nearDistances[item.id] : undefined}
        />
      </View>
    ),
    [savedArtistIds, toggleSaveArtist, viewMode, previews, stats, columns, nearMode, nearPreviews, nearDistances],
  );

  const openCount = openTotal;
  const styleName = selectedStyle ? STYLES.find((s) => s.slug === selectedStyle)?.name : null;

  const nextRadius = RADIUS_OPTIONS.find((r) => r > radius);
  const nearCount = nearListed.length;

  const availabilityLabel = AVAILABILITY_OPTIONS.find((o) => o.value === availability)?.label;
  const budgetLabel = BUDGET_OPTIONS.find((o) => o.value === budgetMax)?.label;
  const sortLabel = SORT_OPTIONS.find((o) => o.value === sortBy)?.label;
  // Phones keep the sheet; this line keeps the active choices readable without opening it.
  const activeSummary = [
    availability !== 'all' ? `Statut : ${availabilityLabel}` : null,
    budgetMax !== null ? `Budget : ${budgetLabel?.toLowerCase()}` : null,
    sortBy !== 'relevance' ? `Tri : ${sortLabel?.toLowerCase()}` : null,
  ].filter(Boolean).join(' · ');

  const statusFilters = (
    <FilterGroup label="Statut">
      {AVAILABILITY_OPTIONS.map((o) => (
        <Chip key={o.value} label={o.label} tone={o.tone} selected={availability === o.value} onPress={() => setAvailability(o.value)} />
      ))}
    </FilterGroup>
  );
  const budgetFilters = (
    <FilterGroup label="Budget minimum de l’artiste" note="Indicatif : le prix final dépend du projet et fait l’objet d’un devis par l’artiste.">
      {BUDGET_OPTIONS.map((o) => (
        <Chip key={o.label} label={o.label} selected={budgetMax === o.value} onPress={() => setBudgetMax(o.value)} />
      ))}
    </FilterGroup>
  );
  const sortFilters = (
    <FilterGroup label="Trier par">
      {SORT_OPTIONS.map((o) => (
        <Chip key={o.value} label={o.label} selected={sortBy === o.value} onPress={() => setSortBy(o.value)} />
      ))}
    </FilterGroup>
  );

  const nearPanel = nearMode ? (
    <View style={styles.nearPanel}>
      <View style={styles.nearHead}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Kicker tone="flame">Autour de moi</Kicker>
          <TText variant="displayS" numberOfLines={1} accessibilityLiveRegion="polite" style={styles.nearTitle}>
            {nearState === 'locating'
              ? 'Localisation…'
              : nearCoords && !cityMode ? `Autour de ${nearPlace}` : 'Autour d’une ville'}
          </TText>
        </View>
        {!cityMode && (
          <TextLink label="Changer de ville" icon="business-outline" onPress={() => { setCityMode(true); setNearMessage(null); }} />
        )}
        {cityMode && geolocationAvailable() && (
          <TextLink label="Ma position" icon="navigate-outline" accessibilityLabel="Utiliser ma position" onPress={locateMe} />
        )}
      </View>

      {showPrivacy && (
        <View style={styles.nearPrivacy}>
          <Ionicons name="lock-closed-outline" size={13} color={Colors.textTertiary} />
          <TText variant="caption" color="tertiary" style={{ flex: 1 }}>
            Votre position sert seulement à ce calcul : elle n’est ni enregistrée ni transmise ailleurs.
          </TText>
        </View>
      )}

      {cityMode && (
        <View>
          <View style={styles.cityRow}>
            <TInput
              value={cityQuery}
              onChangeText={setCityQuery}
              placeholder="Ville, par exemple Lyon"
              returnKeyType="search"
              onSubmitEditing={() => { void searchCity(); }}
              autoCorrect={false}
              maxLength={80}
              accessibilityLabel="Chercher autour d’une ville"
              containerStyle={styles.cityInput}
            />
            <TButton
              title="Chercher"
              size="md"
              fullWidth={false}
              loading={nearState === 'locating'}
              onPress={() => { void searchCity(); }}
            />
          </View>
          <TText variant="micro" color="tertiary" style={{ marginTop: 6, letterSpacing: 0 }}>
            Seul le nom de la ville est envoyé au service de cartes OpenStreetMap.
          </TText>
        </View>
      )}

      {!!nearMessage && (
        <TText variant="caption" color="warning" accessibilityRole="alert" accessibilityLiveRegion="polite">{nearMessage}</TText>
      )}

      <View style={styles.radiusRow} accessibilityRole="radiogroup" accessibilityLabel="Rayon de recherche">
        <Kicker tone="muted">Rayon</Kicker>
        {RADIUS_OPTIONS.map((r) => (
          <Chip key={r} label={`${r} km`} selected={radius === r} onPress={() => changeRadius(r)} />
        ))}
      </View>
    </View>
  ) : null;

  const ListHeader = (
    <View>
      <Masthead
        kicker="02 / Découvrir"
        title="La bonne"
        emphasis="rencontre."
        description="Trouvez un univers, puis une personne. Laissez les portfolios parler en premier : par style, par ville, par disponibilité."
        style={styles.masthead}
      />

      {/* Search */}
      <View style={[styles.searchRow, isWide && styles.searchRowWide]}>
        <View style={styles.searchField}>
          <Kicker tone="muted" style={styles.fieldLabel}>Artiste, ville ou style</Kicker>
          <Pressable
            onPress={() => inputRef.current?.focus()}
            style={[styles.searchBox, searchFocused && styles.searchBoxFocused]}
            accessible={false}
          >
            <Ionicons name="search" size={17} color={searchFocused ? Colors.flameText : Colors.textTertiary} />
            <TextInput
              ref={inputRef}
              style={styles.searchInput}
              placeholder="Un nom, une ville, un univers"
              placeholderTextColor={Colors.textTertiary}
              selectionColor={Colors.flame}
              value={query}
              onChangeText={setQuery}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              returnKeyType="search"
              autoCorrect={false}
              accessibilityLabel="Rechercher un artiste, une ville ou un style"
            />
            {!!query && (
              <IconButton icon="close" label="Effacer la recherche" size={30} onPress={() => setQuery('')} style={styles.clearBtn} />
            )}
          </Pressable>
        </View>
        {!isWide && (
          <Pressable
            onPress={() => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowFilters(true); }}
            accessibilityRole="button"
            accessibilityLabel={sheetFilterCount ? `Filtres, ${sheetFilterCount} actifs` : 'Filtres'}
            style={(state) => [
              styles.filterBtn,
              sheetFilterCount > 0 && styles.filterBtnActive,
              (state as Hover).pressed && { opacity: 0.8 },
              webPointer,
            ]}
          >
            <Ionicons name="options-outline" size={19} color={sheetFilterCount ? Colors.paper : Colors.ink} />
            {sheetFilterCount > 0 && (
              <TText variant="caption" weight="semibold" tabular style={{ color: Colors.paper, marginLeft: 4 }}>{sheetFilterCount}</TText>
            )}
          </Pressable>
        )}
        {isWide && hasFilters && (
          <TButton title="Effacer les filtres" variant="secondary" size="md" fullWidth={false} onPress={resetAll} />
        )}
      </View>

      {/* Styles, and the way into "near me" */}
      <Kicker tone="muted" style={styles.fieldLabel}>Style</Kicker>
      <ScrollView
        ref={chipRail}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.chipScroller, { marginHorizontal: -gutter }]}
        contentContainerStyle={[styles.chipRow, { paddingHorizontal: gutter }]}
      >
        <Chip
          label="Autour de moi"
          icon="navigate-outline"
          selected={nearMode}
          onPress={() => (nearMode ? leaveNear() : startNear())}
        />
        <View style={styles.chipSeparator} />
        <Chip label="Tous les styles" selected={!selectedStyle} onPress={() => setSelectedStyle(null)} />
        {STYLES.map((s) => (
          <Chip
            key={s.id}
            label={s.name}
            selected={selectedStyle === s.slug}
            onPress={() => setSelectedStyle(selectedStyle === s.slug ? null : s.slug)}
            onLayout={(x) => {
              chipX.current[s.slug] = x;
              if (s.slug === selectedStyle) revealChip(s.slug);
            }}
          />
        ))}
      </ScrollView>

      {/* Wide: every filter stays on the page, read as one line of groups. Phones: the sheet. */}
      {isWide ? (
        <View style={styles.inlineFilters}>
          {statusFilters}
          {budgetFilters}
          {sortFilters}
        </View>
      ) : !!activeSummary && (
        <View style={styles.summaryRow}>
          <TText variant="caption" color="secondary" style={{ flex: 1 }} numberOfLines={2}>{activeSummary}</TText>
          <TextLink label="Modifier" icon="options-outline" onPress={() => setShowFilters(true)} />
        </View>
      )}

      {nearPanel}

      {!nearMode && !hasFilters && !isLoading && !fetchError && (
        <>
          {spotlightArtist && (
            <Animated.View entering={reduced ? undefined : FadeIn.duration(500)} style={styles.spotlight}>
              <ArtistCard
                artist={spotlightArtist}
                variant="featured"
                isSaved={savedArtistIds.has(spotlightArtist.id)}
                onSave={toggleSaveArtist}
                previewImages={previews[spotlightArtist.id]}
                stats={stats[spotlightArtist.id]}
              />
            </Animated.View>
          )}

        </>
      )}

      {(nearMode ? nearState === 'ready' : !fetchError) && (
        <View style={styles.countRow}>
          <View style={{ flex: 1, minWidth: 0, gap: 6 }} accessibilityLiveRegion="polite">
            <Kicker>
              {nearMode
                ? `${nearCount} artiste${nearCount > 1 ? 's' : ''} à moins de ${radius} km${styleName ? ` · ${styleName}` : ''}`
                : isLoading ? 'Recherche…' : `${total} artiste${total > 1 ? 's' : ''}${styleName ? ` · ${styleName}` : ''}`}
            </Kicker>
            {!nearMode && !isLoading && openCount > 0 && (
              <StatusDot tone="open" label={`${openCount} ${openCount > 1 ? 'prennent' : 'prend'} des projets`} />
            )}
          </View>
          <View style={styles.viewToggle}>
            {(['list', 'grid'] as const).map((m) => (
              <IconButton
                key={m}
                icon={m === 'grid' ? 'grid-outline' : 'reorder-two-outline'}
                label={m === 'grid' ? 'Affichage en grille' : 'Affichage en liste'}
                active={viewMode === m}
                onPress={() => setViewMode(m)}
              />
            ))}
          </View>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <Animated.FlatList
        data={listData}
        keyExtractor={(item) => item.id}
        renderItem={renderArtist}
        key={`${viewMode}-${columns}`}
        numColumns={columns}
        columnWrapperStyle={columns > 1 ? styles.columnWrapper : undefined}
        style={styles.list}
        contentContainerStyle={[
          styles.listContent,
          { paddingHorizontal: gutter, paddingTop: insets.top, paddingBottom: insets.bottom + 110 },
        ]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={ListHeader}
        onEndReached={() => { if (!nearMode) void fetchMore(); }}
        onEndReachedThreshold={0.6}
        ListFooterComponent={
          <>
            {!nearMode && isLoadingMore && (
              <ActivityIndicator color={Colors.textTertiary} style={{ marginVertical: Spacing.md }} accessibilityLabel="Chargement des artistes suivants" />
            )}
            {!nearMode && !hasFilters && !isLoading && !fetchError && (
              <View>
                {/* Discovery follows the people returned by the search. */}
                <View style={styles.discoveryRail}><FlashRail title="Flashs à réserver" /></View>
                <View style={styles.discoveryRail}><GuestSpotRail /></View>
                {trendingPosts.length > 0 && (
                  <View style={styles.trendingSection}>
                    <SectionHead kicker="Réalisations les plus aimées" />
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={{ marginHorizontal: -gutter }}
                      contentContainerStyle={[styles.trendingRow, { paddingHorizontal: gutter }]}
                    >
                      {trendingPosts.map((p, i) => <TrendingTile key={p.id} post={p} index={i} />)}
                    </ScrollView>
                  </View>
                )}
              </View>
            )}
          </>
        }
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={nearMode ? nearState === 'loading' : isRefreshing} onRefresh={handleRefresh} tintColor={Colors.flame} colors={[Colors.flame]} progressViewOffset={insets.top} />
        }
        ListEmptyComponent={
          nearMode ? (
            nearBusy ? <ListSkeleton /> : nearState === 'error' ? (
              <EmptyState
                icon="cloud-offline-outline"
                title="Recherche impossible"
                description="Les artistes à proximité n’ont pas pu être chargés. Vérifiez votre connexion."
                ctaLabel="Réessayer"
                onCta={() => { if (nearCoords) void loadNearby(nearCoords, radius); }}
              />
            ) : nearState === 'idle' ? (
              <EmptyState
                icon="location-outline"
                title="Où cherchez-vous ?"
                description="Indiquez une ville pour voir les artistes installés autour."
              />
            ) : nearResults.length === 0 ? (
              <EmptyState
                icon="navigate-outline"
                title="Aucun artiste localisé dans ce rayon"
                description={nextRadius
                  ? `Personne à moins de ${radius} km pour l’instant. Élargissez la zone de recherche.`
                  : 'Peu d’artistes ont encore indiqué leur ville. Revenez bientôt, ou lancez une recherche classique.'}
                ctaLabel={nextRadius ? `Élargir à ${nextRadius} km` : 'Recherche classique'}
                onCta={() => (nextRadius ? changeRadius(nextRadius) : leaveNear())}
              />
            ) : (
              <EmptyState
                icon="search-outline"
                title="Aucun artiste ne correspond"
                description="Des artistes sont proches, mais aucun ne correspond à vos filtres."
                ctaLabel="Effacer les filtres"
                onCta={resetAll}
              />
            )
          ) : isLoading ? <ListSkeleton /> : fetchError ? (
            <EmptyState
              icon="cloud-offline-outline"
              title="Chargement impossible"
              description={fetchError}
              ctaLabel="Réessayer"
              onCta={() => { setIsLoading(true); fetchData(); }}
            />
          ) : (
            <EmptyState
              icon="search-outline"
              title="Aucun artiste ne correspond"
              description="Élargissez la recherche : une autre ville, un autre style ou moins de filtres."
              ctaLabel="Effacer les filtres"
              onCta={resetAll}
            />
          )
        }
      />

      {/* ── Filter sheet (phones; wide screens show the same groups inline) ── */}
      <BottomSheet visible={showFilters} onClose={() => setShowFilters(false)} accessibilityLabel="Filtres">
        <View style={styles.sheetHeader}>
          <TText variant="displayS">Filtres</TText>
          <TextLink
            label="Réinitialiser"
            icon="refresh-outline"
            onPress={() => { setAvailability('all'); setBudgetMax(null); setSortBy('relevance'); }}
          />
        </View>

        {statusFilters}
        {budgetFilters}
        {sortFilters}

        <TButton
          title={isLoading ? 'Voir les artistes' : `Voir ${total} artiste${total > 1 ? 's' : ''}`}
          onPress={() => setShowFilters(false)}
          style={{ marginTop: Spacing.md }}
        />
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.paper },

  masthead: { marginBottom: Spacing.lg },

  fieldLabel: { marginBottom: 8 },
  searchRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginBottom: Spacing.md },
  searchRowWide: { gap: Spacing.sm },
  searchField: { flex: 1, minWidth: 0 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    height: 50, paddingLeft: 16, paddingRight: 8,
    backgroundColor: Colors.white,
    borderWidth: 1, borderColor: Colors.line,
  },
  searchBoxFocused: { borderColor: Colors.flame },
  searchInput: {
    flex: 1, height: '100%', color: Colors.ink, fontFamily: Fonts.sans, fontSize: FontSize.body,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as object : null),
  },
  clearBtn: { borderColor: 'transparent' },
  filterBtn: {
    minWidth: 50, height: 50, paddingHorizontal: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.ink, backgroundColor: 'transparent',
  },
  filterBtnActive: { backgroundColor: Colors.ink },

  chipScroller: { flexGrow: 0, marginBottom: Spacing.sm },
  chipRow: { gap: 8, paddingBottom: 4 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    minHeight: 38, paddingHorizontal: 14,
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.line,
    ...(Platform.OS === 'web'
      ? ({ cursor: 'pointer', transitionProperty: 'background-color, border-color', transitionDuration: '180ms' } as object)
      : null),
  },
  chipHover: { backgroundColor: Colors.wash, borderColor: Colors.ink },
  chipSelected: { backgroundColor: Colors.ink, borderColor: Colors.ink },
  chipFocused: { borderColor: Colors.flame },
  chipDot: { width: 6, height: 6, borderRadius: Radius.full },
  chipSeparator: { width: 1, alignSelf: 'stretch', marginVertical: 6, backgroundColor: Colors.line },

  inlineFilters: {
    flexDirection: 'row', flexWrap: 'wrap', columnGap: Spacing['2xl'], rowGap: Spacing.sm,
    paddingTop: Spacing.sm, marginBottom: Spacing.md,
    borderTopWidth: 1, borderTopColor: Colors.line,
  },
  filterGroup: { marginBottom: Spacing.sm, flexShrink: 1, maxWidth: '100%' },
  filterLabel: { marginBottom: 10 },
  filterNote: { maxWidth: 360, marginTop: 2 },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  summaryRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: Spacing['2xs'], marginBottom: Spacing.sm,
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: Colors.line,
  },

  nearPanel: {
    gap: Spacing.sm, padding: Spacing.md, marginTop: Spacing.xs, marginBottom: Spacing.lg,
    backgroundColor: Colors.white,
    borderTopWidth: 2, borderTopColor: Colors.ink,
  },
  nearHead: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: Spacing.sm },
  nearTitle: { marginTop: 6 },
  nearPrivacy: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cityRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing['2xs'] },
  cityInput: { flex: 1, minWidth: 0, marginBottom: 0 },
  radiusRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },

  list: { flex: 1 },
  listContent: { width: '100%', maxWidth: Layout.maxContent, alignSelf: 'center' },
  columnWrapper: { gap: Spacing.lg },
  cell: { width: '100%' },
  cellMulti: { flex: 1, width: undefined, minWidth: 0 },

  spotlight: { marginTop: Spacing.sm },

  trendingSection: { marginTop: Spacing.lg, marginBottom: Spacing.xl },
  discoveryRail: { marginTop: Spacing.md },
  trendingRow: { gap: Spacing.sm },
  trendingTile: { width: 148 },
  trendingName: { fontSize: 19, lineHeight: 21, marginTop: 8 },

  skeletonCard: { borderTopWidth: 1, borderTopColor: Colors.line, paddingTop: Spacing.xs },

  countRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.sm,
    paddingBottom: Spacing.sm, marginBottom: Spacing.md, marginTop: Spacing.xs,
    borderBottomWidth: 1, borderBottomColor: Colors.ink,
  },
  viewToggle: { flexDirection: 'row', gap: 6 },

  // Sheet
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
});
