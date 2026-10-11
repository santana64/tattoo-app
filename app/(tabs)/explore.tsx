import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import {
  FlatList, StyleSheet, View, TextInput, Pressable,
  ScrollView, RefreshControl, useWindowDimensions, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Radius, FontSize, Fonts, Layout } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TButton } from '@/components/ui/TButton';
import { TSkeleton } from '@/components/ui/TSkeleton';
import { ArtistCard } from '@/components/ArtistCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { useSavedArtistsStore } from '@/store/saved-artists-store';
import { useAuthStore } from '@/store/auth-store';
import { Toast } from '@/components/ui/TToast';
import { STYLES } from '@/constants/mock-data';
import type { Artist } from '@/constants/mock-data';
import { supabase } from '@/lib/supabase';
import { mapArtist, PUBLIC_ARTIST_COLUMNS } from '@/lib/catalog';

interface ExploreTrendingPost {
  id: string;
  mediaUrl: string;
  artistName: string;
}

type Availability = 'all' | 'open' | 'paused' | 'closed';
type SortKey = 'relevance' | 'open' | 'budget_asc';

const AVAILABILITY_OPTIONS: Array<{ value: Availability; label: string; dot?: string }> = [
  { value: 'all', label: 'Tous' },
  { value: 'open', label: 'Prend des projets', dot: Colors.success },
  { value: 'paused', label: 'Liste d’attente', dot: Colors.warning },
  { value: 'closed', label: 'Complet', dot: Colors.textTertiary },
];
// Minimum budget an artist accepts — not a quote. Artists without a public budget are excluded when a cap is set.
const BUDGET_OPTIONS: Array<{ label: string; value: number | null }> = [
  { label: 'Tous', value: null },
  { label: 'Jusqu’à 300 €', value: 300 },
  { label: 'Jusqu’à 500 €', value: 500 },
  { label: 'Jusqu’à 800 €', value: 800 },
];
const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: 'relevance', label: 'Pertinence' },
  { value: 'open', label: 'Disponibles d’abord' },
  { value: 'budget_asc', label: 'Budget croissant' },
];
const PREVIEWS_PER_ARTIST = 3;

const normalize = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// Accepts a slug ("fine-line") or a display name ("Fine Line") from deep links.
function resolveStyleSlug(param: string | string[] | undefined): string | null {
  const raw = Array.isArray(param) ? param[0] : param;
  if (!raw) return null;
  const n = normalize(raw);
  return STYLES.find((s) => s.slug === n || normalize(s.name) === n)?.slug ?? null;
}

// ─── Small building blocks ────────────────────────────────────────────────────
function Chip({ label, selected, onPress, dot, onLayout }: {
  label: string; selected: boolean; onPress: () => void; dot?: string; onLayout?: (x: number) => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      onLayout={onLayout ? (e) => onLayout(e.nativeEvent.layout.x) : undefined}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={(state) => {
        const { pressed, hovered } = state as { pressed: boolean; hovered?: boolean };
        return [styles.chip, (pressed || hovered) && !selected && styles.chipHover, selected && styles.chipSelected];
      }}
    >
      {dot && <View style={[styles.chipDot, { backgroundColor: dot }]} />}
      <TText variant="caption" weight="medium" style={{ fontSize: 13, color: selected ? Colors.textInverse : Colors.textSecondary }}>
        {label}
      </TText>
    </Pressable>
  );
}

function SectionLabel({ children, right }: { children: string; right?: React.ReactNode }) {
  return (
    <View style={styles.sectionLabel}>
      <TText variant="label" color="tertiary" uppercase>{children}</TText>
      {right}
    </View>
  );
}

function TrendingTile({ post }: { post: ExploreTrendingPost }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push(`/post/${post.id}`)}
      accessibilityRole="link"
      accessibilityLabel={`Réalisation de ${post.artistName}`}
      style={({ pressed }) => [styles.trendingTile, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.trendingImage}>
        <Image source={{ uri: post.mediaUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
      </View>
      <TText variant="caption" color="secondary" numberOfLines={1} style={{ marginTop: 6 }}>{post.artistName}</TText>
    </Pressable>
  );
}

function ListSkeleton() {
  return (
    <View style={{ gap: Spacing.xl, marginTop: Spacing.sm }}>
      {[0, 1].map((i) => (
        <View key={i}>
          <TSkeleton height={232} radius={Radius.xl} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14 }}>
            <TSkeleton width={40} height={40} radius={20} />
            <View style={{ flex: 1, gap: 8 }}>
              <TSkeleton width="45%" height={16} />
              <TSkeleton width="30%" height={11} />
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
  const { width } = useWindowDimensions();
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
  const [trendingPosts, setTrendingPosts] = useState<ExploreTrendingPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // ── Filters
  const [query, setQuery] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<string | null>(() => resolveStyleSlug(params.style));
  const [availability, setAvailability] = useState<Availability>('all');
  const [budgetMax, setBudgetMax] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>('relevance');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [searchFocused, setSearchFocused] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const chipRail = useRef<ScrollView>(null);
  const chipX = useRef<Record<string, number>>({});

  // Follow deep links that change the style while the tab stays mounted.
  useEffect(() => {
    const slug = resolveStyleSlug(params.style);
    if (slug) setSelectedStyle(slug);
  }, [params.style]);

  const fetchData = useCallback(async () => {
    setFetchError(null);
    try {
      const [artistsRes, postsRes] = await Promise.all([
        supabase
          .from('artists')
          .select(PUBLIC_ARTIST_COLUMNS)
          .order('tier', { ascending: false })
          .order('stat_profile_views', { ascending: false })
          .limit(60),
        supabase
          .from('posts')
          .select('id, media_url, likes_count, artists!inner(blaze)')
          .eq('is_published', true)
          .eq('media_type', 'photo')
          .order('likes_count', { ascending: false })
          .limit(10),
      ]);

      if (artistsRes.error) throw artistsRes.error;
      const mapped = (artistsRes.data ?? []).map(mapArtist);
      setArtists(mapped);

      if (!postsRes.error && postsRes.data) {
        setTrendingPosts(postsRes.data.map((p: any) => ({
          id: p.id,
          mediaUrl: p.media_url,
          artistName: (p.artists as any)?.blaze ?? '',
        })));
      }

      // Portfolio previews for the cards: latest published photos per artist.
      if (mapped.length) {
        const { data: work } = await supabase
          .from('posts')
          .select('artist_id, media_url')
          .in('artist_id', mapped.map((a) => a.id))
          .eq('is_published', true)
          .eq('media_type', 'photo')
          .order('published_at', { ascending: false })
          .limit(mapped.length * 6);
        const grouped: Record<string, string[]> = {};
        for (const row of work ?? []) {
          const list = (grouped[row.artist_id] ??= []);
          if (list.length < PREVIEWS_PER_ARTIST) list.push(row.media_url);
        }
        setPreviews(grouped);
      }
    } catch (e: any) {
      setFetchError(e?.message ? 'Le service ne répond pas. Vérifiez votre connexion.' : 'Erreur de chargement');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Keep the selected style visible in the rail (e.g. after a deep link from the welcome screen).
  const revealChip = useCallback((slug: string | null) => {
    const x = slug ? chipX.current[slug] : 0;
    if (x !== undefined) chipRail.current?.scrollTo({ x: Math.max(0, x - Layout.gutter), animated: true });
  }, []);
  useEffect(() => { revealChip(selectedStyle); }, [selectedStyle, revealChip]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchData();
  }, [fetchData]);

  const resetAll = () => {
    setQuery('');
    setSelectedStyle(null);
    setAvailability('all');
    setBudgetMax(null);
    setSortBy('relevance');
  };

  const sheetFilterCount = Number(availability !== 'all') + Number(budgetMax !== null) + Number(sortBy !== 'relevance');
  const hasFilters = !!query || !!selectedStyle || sheetFilterCount > 0;

  const filtered = useMemo(() => {
    const q = normalize(query);
    let result = artists.filter((a) => {
      const matchQ = !q || normalize(a.blaze).includes(q) || normalize(a.city).includes(q)
        || a.styles.some((s) => normalize(s).includes(q) || normalize(STYLES.find((x) => x.slug === s)?.name ?? '').includes(q));
      const matchStyle = !selectedStyle || a.styles.some((s) => normalize(s).replace(/ /g, '-') === selectedStyle);
      const matchAvail = availability === 'all' || a.bookingStatus === availability;
      const matchBudget = budgetMax === null || (a.minBudget > 0 && a.minBudget <= budgetMax);
      return matchQ && matchStyle && matchAvail && matchBudget;
    });

    if (sortBy === 'open') result = [...result].sort((a, b) => Number(b.bookingStatus === 'open') - Number(a.bookingStatus === 'open'));
    else if (sortBy === 'budget_asc') result = [...result].sort((a, b) => (a.minBudget || Infinity) - (b.minBudget || Infinity));
    return result;
  }, [artists, query, selectedStyle, availability, budgetMax, sortBy]);

  const spotlightArtist = useMemo(
    () => artists.find((a) => a.tier === 'premium' && a.bookingStatus === 'open'),
    [artists],
  );
  const listed = useMemo(
    () => (hasFilters || !spotlightArtist ? filtered : filtered.filter((a) => a.id !== spotlightArtist.id)),
    [filtered, hasFilters, spotlightArtist],
  );

  // Wider screens get more columns; phones keep the editorial single column by default.
  const contentWidth = Math.min(width, Layout.maxContent);
  const columns = viewMode === 'grid' ? (contentWidth >= 1000 ? 4 : contentWidth >= 700 ? 3 : 2) : contentWidth >= 900 ? 2 : 1;

  const renderArtist = useCallback(
    ({ item }: { item: Artist }) => (
      <View style={[styles.cell, columns > 1 && styles.cellMulti]}>
        <ArtistCard
          artist={item}
          isSaved={savedArtistIds.has(item.id)}
          onSave={toggleSaveArtist}
          variant={viewMode === 'grid' ? 'tile' : 'default'}
          previewImages={previews[item.id]}
        />
      </View>
    ),
    [savedArtistIds, toggleSaveArtist, viewMode, previews, columns],
  );

  const openCount = artists.filter((a) => a.bookingStatus === 'open').length;
  const styleName = selectedStyle ? STYLES.find((s) => s.slug === selectedStyle)?.name : null;

  const ListHeader = (
    <View>
      {!hasFilters && !isLoading && !fetchError && (
        <>
          {spotlightArtist && (
            <Animated.View entering={FadeIn.duration(500)} style={styles.spotlight}>
              <ArtistCard
                artist={spotlightArtist}
                variant="featured"
                isSaved={savedArtistIds.has(spotlightArtist.id)}
                onSave={toggleSaveArtist}
                previewImages={previews[spotlightArtist.id]}
              />
            </Animated.View>
          )}

          {trendingPosts.length > 0 && (
            <View style={styles.trendingSection}>
              <SectionLabel>Réalisations populaires</SectionLabel>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trendingRow}>
                {trendingPosts.map((p) => <TrendingTile key={p.id} post={p} />)}
              </ScrollView>
            </View>
          )}
        </>
      )}

      {!fetchError && (
        <View style={styles.countRow}>
          <TText variant="bodySmall" color="secondary" tabular accessibilityLiveRegion="polite">
            {isLoading ? 'Recherche…' : `${filtered.length} artiste${filtered.length > 1 ? 's' : ''}${styleName ? ` · ${styleName}` : ''}`}
          </TText>
          <View style={styles.viewToggle} accessibilityRole="radiogroup">
            {(['list', 'grid'] as const).map((m) => (
              <Pressable
                key={m}
                onPress={() => setViewMode(m)}
                accessibilityRole="radio"
                accessibilityLabel={m === 'grid' ? 'Affichage en grille' : 'Affichage en liste'}
                accessibilityState={{ selected: viewMode === m }}
                style={[styles.viewToggleBtn, viewMode === m && styles.viewToggleBtnActive]}
              >
                <Ionicons name={m === 'grid' ? 'grid-outline' : 'reorder-two-outline'} size={16} color={viewMode === m ? Colors.textPrimary : Colors.textTertiary} />
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.frame}>
        {/* Masthead */}
        <View style={styles.header}>
          <TText variant="displayM" accessibilityRole="header">
            Trouver <TText variant="displayM" italic color="accentGlow">un artiste</TText>
          </TText>
          <TText variant="bodySmall" color="tertiary" tabular style={{ marginTop: 4 }}>
            {isLoading || fetchError ? 'Tatoueurs, studios et guest spots' : `${artists.length} artistes · ${openCount} prennent des projets`}
          </TText>
        </View>

        {/* Search */}
        <View style={styles.searchRow}>
          <Pressable
            onPress={() => inputRef.current?.focus()}
            style={[styles.searchBox, searchFocused && styles.searchBoxFocused]}
          >
            <Ionicons name="search" size={17} color={searchFocused ? Colors.accentWarm : Colors.textTertiary} />
            <TextInput
              ref={inputRef}
              style={styles.searchInput}
              placeholder="Artiste, ville ou style"
              placeholderTextColor={Colors.textTertiary}
              selectionColor={Colors.accentWarm}
              value={query}
              onChangeText={setQuery}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              returnKeyType="search"
              autoCorrect={false}
              accessibilityLabel="Rechercher un artiste, une ville ou un style"
            />
            {!!query && (
              <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Effacer la recherche" style={styles.clearBtn}>
                <Ionicons name="close" size={13} color={Colors.textSecondary} />
              </Pressable>
            )}
          </Pressable>
          <Pressable
            onPress={() => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowFilters(true); }}
            accessibilityRole="button"
            accessibilityLabel={sheetFilterCount ? `Filtres, ${sheetFilterCount} actifs` : 'Filtres'}
            style={({ pressed }) => [styles.filterBtn, sheetFilterCount > 0 && styles.filterBtnActive, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="options-outline" size={19} color={sheetFilterCount ? Colors.textInverse : Colors.textPrimary} />
            {sheetFilterCount > 0 && (
              <TText variant="caption" weight="semibold" tabular style={{ color: Colors.textInverse, marginLeft: 4 }}>{sheetFilterCount}</TText>
            )}
          </Pressable>
        </View>

        {/* Styles */}
        <ScrollView ref={chipRail} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow} style={styles.chipScroller}>
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
      </View>

      {/* Results */}
      <FlatList
        data={isLoading ? [] : listed}
        keyExtractor={(item) => item.id}
        renderItem={renderArtist}
        key={`${viewMode}-${columns}`}
        numColumns={columns}
        columnWrapperStyle={columns > 1 ? styles.columnWrapper : undefined}
        style={styles.list}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 110 }]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={ListHeader}
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={Colors.accentWarm} colors={[Colors.accentWarm]} />
        }
        ListEmptyComponent={
          isLoading ? <ListSkeleton /> : fetchError ? (
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

      {/* ── Filter sheet ── */}
      {showFilters && (
        <>
          <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(160)} style={StyleSheet.absoluteFill}>
            <Pressable style={styles.backdrop} onPress={() => setShowFilters(false)} accessibilityLabel="Fermer les filtres" />
          </Animated.View>

          <Animated.View
            entering={SlideInDown.duration(320)}
            exiting={SlideOutDown.duration(220)}
            style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.md }]}
            accessibilityViewIsModal
          >
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <TText variant="displayS">Filtres</TText>
              <Pressable onPress={() => { setAvailability('all'); setBudgetMax(null); setSortBy('relevance'); }} hitSlop={8} accessibilityRole="button">
                <TText variant="bodySmall" color="secondary" style={{ textDecorationLine: 'underline' }}>Réinitialiser</TText>
              </Pressable>
            </View>

            <SectionLabel>Disponibilité</SectionLabel>
            <View style={styles.wrapRow}>
              {AVAILABILITY_OPTIONS.map((o) => (
                <Chip key={o.value} label={o.label} dot={o.dot} selected={availability === o.value} onPress={() => setAvailability(o.value)} />
              ))}
            </View>

            <SectionLabel>Budget minimum de l’artiste</SectionLabel>
            <View style={styles.wrapRow}>
              {BUDGET_OPTIONS.map((o) => (
                <Chip key={o.label} label={o.label} selected={budgetMax === o.value} onPress={() => setBudgetMax(o.value)} />
              ))}
            </View>
            <TText variant="caption" color="tertiary" style={styles.sheetNote}>
              Indicatif : le prix final dépend du projet et fait l’objet d’un devis par l’artiste.
            </TText>

            <SectionLabel>Trier par</SectionLabel>
            <View style={styles.wrapRow}>
              {SORT_OPTIONS.map((o) => (
                <Chip key={o.value} label={o.label} selected={sortBy === o.value} onPress={() => setSortBy(o.value)} />
              ))}
            </View>

            <TButton
              title={isLoading ? 'Voir les artistes' : `Voir ${filtered.length} artiste${filtered.length > 1 ? 's' : ''}`}
              onPress={() => setShowFilters(false)}
              style={{ marginTop: Spacing.md }}
            />
          </Animated.View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  frame: { width: '100%', maxWidth: Layout.maxContent, alignSelf: 'center' },

  header: { paddingHorizontal: Layout.gutter, paddingTop: Spacing.sm, paddingBottom: Spacing.md },

  searchRow: { flexDirection: 'row', gap: 10, paddingHorizontal: Layout.gutter, marginBottom: Spacing.sm },
  searchBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
    height: 50, paddingHorizontal: 16,
    backgroundColor: Colors.bgElevated, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.borderDefault,
  },
  searchBoxFocused: { borderColor: Colors.borderFocus, backgroundColor: Colors.bgSurface },
  searchInput: {
    flex: 1, height: '100%', color: Colors.textPrimary, fontFamily: Fonts.sans, fontSize: FontSize.body,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as object : null),
  },
  clearBtn: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: Colors.bgSubtle, alignItems: 'center', justifyContent: 'center',
  },
  filterBtn: {
    minWidth: 50, height: 50, paddingHorizontal: 14, borderRadius: Radius.lg,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.borderDefault, backgroundColor: Colors.bgElevated,
  },
  filterBtnActive: { backgroundColor: Colors.accentAction, borderColor: Colors.accentAction },

  chipScroller: { flexGrow: 0, marginBottom: Spacing.xs },
  chipRow: { paddingHorizontal: Layout.gutter, gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    height: 36, paddingHorizontal: 14, borderRadius: 18,
    borderWidth: 1, borderColor: Colors.borderDefault,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } as object : null),
  },
  chipHover: { backgroundColor: Colors.glassBgMid },
  chipSelected: { backgroundColor: Colors.accentAction, borderColor: Colors.accentAction },
  chipDot: { width: 6, height: 6, borderRadius: 3 },

  list: { flex: 1 },
  listContent: { width: '100%', maxWidth: Layout.maxContent, alignSelf: 'center', paddingHorizontal: Layout.gutter, paddingTop: Spacing.xs },
  columnWrapper: { gap: Spacing.md },
  cell: { width: '100%' },
  cellMulti: { flex: 1, width: undefined },

  spotlight: { marginTop: Spacing.xs },

  sectionLabel: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.xs, marginTop: Spacing.xs },

  trendingSection: { marginBottom: Spacing.xl },
  trendingRow: { gap: 10 },
  trendingTile: { width: 116 },
  trendingImage: { width: 116, height: 146, borderRadius: Radius.md, overflow: 'hidden', backgroundColor: Colors.bgSurface },

  countRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingBottom: Spacing.md, marginBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.borderDefault,
  },
  viewToggle: { flexDirection: 'row', gap: 2, padding: 3, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.borderDefault },
  viewToggleBtn: { width: 32, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.sm },
  viewToggleBtnActive: { backgroundColor: Colors.bgSubtle },

  // Sheet
  backdrop: { flex: 1, backgroundColor: 'rgba(5,4,3,0.72)' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    alignSelf: 'center', width: '100%', maxWidth: 560,
    backgroundColor: Colors.bgElevated,
    borderTopLeftRadius: Radius['2xl'], borderTopRightRadius: Radius['2xl'],
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderDefault,
    paddingHorizontal: Layout.gutter, paddingTop: 10,
  },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.borderDefault, alignSelf: 'center', marginBottom: Spacing.md },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: Spacing.md },
  sheetNote: { marginTop: -Spacing.xs, marginBottom: Spacing.md },
});
