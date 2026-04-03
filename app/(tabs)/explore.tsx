import React, { useState, useMemo, useRef, useCallback } from 'react';
import {
  FlatList, StyleSheet, View, TextInput, TouchableOpacity,
  ScrollView, Dimensions, Animated as RNAnimated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import Animated, {
  FadeIn, FadeInDown, FadeInUp, FadeInRight,
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Radius, FontSize, GlowShadow, Gradients } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { ArtistCard } from '@/components/ArtistCard';
import { TAvatar } from '@/components/ui/TAvatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { GlassCard } from '@/components/ui/GlassCard';
import { useAppStore } from '@/store/app-store';
import { ARTISTS, STYLES, POSTS } from '@/constants/mock-data';
import type { Artist } from '@/constants/mock-data';

const { width: SCREEN_W } = Dimensions.get('window');
const AVAILABILITY_OPTIONS = ['Tous', 'Disponible', 'En pause', 'Fermé'];

// ─── Style Category Pill V3
function StylePill({ style, selected, onPress, index }: {
  style: typeof STYLES[0]; selected: boolean; onPress: () => void; index: number;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePress = () => {
    scale.value = withSpring(0.88, { damping: 8 }, () => { scale.value = withSpring(1, { damping: 12 }); });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <Animated.View entering={FadeInRight.delay(index * 35).springify()} style={animStyle}>
      <TouchableOpacity onPress={handlePress} activeOpacity={1} style={[styles.stylePill, selected && styles.stylePillActive]}>
        {selected && (
          <LinearGradient
            colors={['rgba(212,168,100,0.12)', 'rgba(212,168,100,0.05)']}
            style={StyleSheet.absoluteFill}
          />
        )}
        <TText style={styles.stylePillEmoji}>{style.emoji}</TText>
        <TText
          variant="caption"
          weight={selected ? 'semibold' : 'regular'}
          style={{ color: selected ? Colors.accentWarm : Colors.textSecondary }}
        >
          {style.name}
        </TText>
        {selected && <View style={styles.stylePillCheck}><TText style={{ fontSize: 9 }}>✓</TText></View>}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Grid/List Toggle
function ViewToggle({ mode, onChange }: { mode: 'grid' | 'list'; onChange: (m: 'grid' | 'list') => void }) {
  return (
    <View style={styles.viewToggle}>
      {(['grid', 'list'] as const).map((m) => (
        <TouchableOpacity
          key={m}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onChange(m); }}
          style={[styles.viewToggleBtn, mode === m && styles.viewToggleBtnActive]}
        >
          <Ionicons
            name={m === 'grid' ? 'grid-outline' : 'list-outline'}
            size={16}
            color={mode === m ? Colors.accentWarm : Colors.textTertiary}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Spotlight Hero Card V3
function SpotlightCard({ artist }: { artist: Artist }) {
  const router = useRouter();
  const scale = useSharedValue(1);
  const cardStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View entering={FadeIn.duration(600)} style={[cardStyle, styles.spotlightWrap]}>
      <TouchableOpacity
        onPress={() => router.push(`/artist/${artist.id}`)}
        onPressIn={() => { scale.value = withSpring(0.97, { damping: 18 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 14 }); }}
        activeOpacity={1}
        style={styles.spotlightCard}
      >
        <Image source={{ uri: artist.coverUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
        <LinearGradient
          colors={[...Gradients.heroOverlay]}
          locations={[0.15, 0.55, 1]}
          style={StyleSheet.absoluteFill}
        />
        {/* Violet glow accent */}
        <LinearGradient
          colors={[...Gradients.glowViolet]}
          locations={[0, 1]}
          style={[StyleSheet.absoluteFill, { opacity: 0.6 }]}
        />
        <View style={styles.spotlightContent}>
          <Animated.View entering={FadeInUp.delay(200).springify()} style={styles.spotlightBadge}>
            <LinearGradient
              colors={['rgba(212,168,100,0.25)', 'rgba(212,168,100,0.10)']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
            <Ionicons name="star" size={11} color={Colors.accentGlow} />
            <TText variant="micro" style={{ color: Colors.accentGlow, marginLeft: 5, letterSpacing: 1.5 }} uppercase>
              Artiste du moment
            </TText>
          </Animated.View>
          <Animated.View entering={FadeInUp.delay(300).springify()} style={{ marginTop: 8 }}>
            <TText variant="title1" weight="bold" style={{ color: '#fff', letterSpacing: -0.5 }}>
              {artist.blaze}
            </TText>
            <TText variant="caption" style={{ color: 'rgba(255,255,255,0.50)', marginTop: 2 }}>
              {artist.city} · {artist.styles.slice(0, 2).join(', ')}
            </TText>
          </Animated.View>
          {artist.bookingStatus === 'open' && (
            <Animated.View entering={FadeInUp.delay(400).springify()} style={styles.spotlightCTA}>
              <LinearGradient
                colors={[Colors.accentGlow, Colors.accentWarm]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <TText variant="caption" weight="bold" style={{ color: Colors.bgPrimary }}>
                Voir le profil →
              </TText>
            </Animated.View>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Trending Post Mini card
function TrendingPostCard({ post, index }: { post: typeof POSTS[0]; index: number }) {
  const router = useRouter();
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View entering={FadeInRight.delay(index * 60).springify()} style={animStyle}>
      <TouchableOpacity
        onPress={() => router.push(`/post/${post.id}`)}
        onPressIn={() => { scale.value = withSpring(0.95, { damping: 16 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 12 }); }}
        activeOpacity={1}
        style={styles.trendingCard}
      >
        <Image source={{ uri: post.mediaUrl }} style={styles.trendingImg} contentFit="cover" />
        <LinearGradient colors={['transparent', 'rgba(3,3,5,0.85)']} style={StyleSheet.absoluteFill} />
        <View style={styles.trendingBottom}>
          <TText variant="micro" color="secondary" numberOfLines={1}>{post.artistName}</TText>
          <View style={styles.trendingLikes}>
            <Ionicons name="heart" size={10} color="#F87171" />
            <TText variant="micro" style={{ color: 'rgba(255,255,255,0.6)', marginLeft: 3 }}>{post.likesCount}</TText>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { savedArtistIds, toggleSaveArtist } = useAppStore();
  const [query, setQuery] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [selectedAvailability, setSelectedAvailability] = useState('Tous');
  const [sortBy, setSortBy] = useState('premium');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [searchFocused, setSearchFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const searchScale = useSharedValue(1);

  const searchFocusStyle = useAnimatedStyle(() => ({
    transform: [{ scale: searchScale.value }],
  }));

  const handleSearchFocus = () => {
    searchScale.value = withSpring(1.01, { damping: 18 });
    setSearchFocused(true);
  };
  const handleSearchBlur = () => {
    searchScale.value = withSpring(1, { damping: 14 });
    setSearchFocused(false);
  };

  const filtered = useMemo(() => {
    let result = ARTISTS.filter((a) => {
      const q = query.toLowerCase();
      const matchQ = !query || a.blaze.toLowerCase().includes(q) || a.city.toLowerCase().includes(q) || a.styles.some((s) => s.toLowerCase().includes(q));
      const matchStyle = !selectedStyle || a.styles.some((s) => s.toLowerCase().replace(/ /g, '-') === selectedStyle);
      const matchAvail =
        selectedAvailability === 'Tous' ||
        (selectedAvailability === 'Disponible' && a.bookingStatus === 'open') ||
        (selectedAvailability === 'En pause'  && a.bookingStatus === 'paused') ||
        (selectedAvailability === 'Fermé'     && a.bookingStatus === 'closed');
      return matchQ && matchStyle && matchAvail;
    });
    if (sortBy === 'premium') result = [...result].sort((a, b) => (a.tier === 'premium' ? -1 : 1));
    else if (sortBy === 'open') result = [...result].sort((a, b) => (a.bookingStatus === 'open' ? -1 : 1));
    else if (sortBy === 'budget_asc') result = [...result].sort((a, b) => a.minBudget - b.minBudget);
    return result;
  }, [query, selectedStyle, selectedAvailability, sortBy]);

  const spotlightArtist = useMemo(
    () => ARTISTS.find((a) => a.tier === 'premium' && a.bookingStatus === 'open') ?? ARTISTS[0],
    []
  );

  const trendingPosts = useMemo(
    () => [...POSTS].sort((a, b) => b.likesCount - a.likesCount).slice(0, 8),
    []
  );

  const hasFilters = !!query || !!selectedStyle || selectedAvailability !== 'Tous';

  const renderArtist = useCallback(
    ({ item, index }: { item: Artist; index: number }) => (
      <Animated.View entering={FadeInDown.delay(Math.min(index * 50, 400)).springify()}>
        <ArtistCard
          artist={item}
          isSaved={savedArtistIds.has(item.id)}
          onSave={toggleSaveArtist}
          index={index}
          variant={index === 0 && !hasFilters ? 'featured' : 'default'}
        />
      </Animated.View>
    ),
    [savedArtistIds, toggleSaveArtist, hasFilters]
  );

  const ListHeader = (
    <View>
      {!hasFilters && (
        <>
          {/* Spotlight */}
          <SpotlightCard artist={spotlightArtist} />

          {/* Trending posts strip */}
          <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.trendingSection}>
            <View style={styles.trendingSectionHeader}>
              <TText variant="label" color="tertiary" uppercase style={{ letterSpacing: 2 }}>Tendances</TText>
              <View style={styles.fireBadge}>
                <TText style={{ fontSize: 11 }}>🔥</TText>
              </View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trendingRow}>
              {trendingPosts.map((p, i) => (
                <TrendingPostCard key={p.id} post={p} index={i} />
              ))}
            </ScrollView>
          </Animated.View>
        </>
      )}

      {/* Results count + view toggle */}
      <View style={styles.countRow}>
        <TText variant="caption" color="tertiary">
          {filtered.length} artiste{filtered.length > 1 ? 's' : ''}
          {selectedStyle ? ` · ${STYLES.find((s) => s.slug === selectedStyle)?.name}` : ''}
        </TText>
        <ViewToggle mode={viewMode} onChange={setViewMode} />
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <Animated.View entering={FadeIn.duration(400)} style={styles.header}>
        <View>
          <TText variant="displayM" weight="black" style={styles.headerTitle}>Explorer</TText>
          <TText variant="caption" color="tertiary" style={{ letterSpacing: 0.3, marginTop: 2 }}>
            {ARTISTS.length} artistes · {ARTISTS.filter(a => a.bookingStatus === 'open').length} disponibles
          </TText>
        </View>
        <TouchableOpacity
          style={styles.filterIconBtn}
          activeOpacity={0.8}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
        >
          <Ionicons name="options-outline" size={20} color={Colors.textSecondary} />
        </TouchableOpacity>
      </Animated.View>

      {/* Search */}
      <Animated.View style={[styles.searchWrap, searchFocusStyle]}>
        <View style={[styles.searchBox, searchFocused && styles.searchBoxFocused]}>
          {searchFocused
            ? <LinearGradient colors={['rgba(212,168,100,0.06)', 'transparent']} style={StyleSheet.absoluteFill} />
            : null}
          <Ionicons name="search" size={18} color={searchFocused ? Colors.accentWarm : Colors.textTertiary} />
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            placeholder="Artiste, ville, style…"
            placeholderTextColor={Colors.textTertiary}
            value={query}
            onChangeText={setQuery}
            onFocus={handleSearchFocus}
            onBlur={handleSearchBlur}
            returnKeyType="search"
            autoCorrect={false}
          />
          {!!query && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <View style={styles.clearBtn}>
                <Ionicons name="close" size={12} color={Colors.textTertiary} />
              </View>
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>

      {/* Style pills */}
      <Animated.View entering={FadeInDown.delay(100).springify()}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stylePills}>
          {STYLES.map((s, i) => (
            <StylePill
              key={s.id} style={s}
              selected={selectedStyle === s.slug}
              onPress={() => setSelectedStyle(selectedStyle === s.slug ? null : s.slug)}
              index={i}
            />
          ))}
        </ScrollView>
      </Animated.View>

      {/* Availability + Sort chips */}
      <Animated.View entering={FadeInDown.delay(140).springify()}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChips}>
          {AVAILABILITY_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt}
              onPress={() => { setSelectedAvailability(opt); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              style={[styles.filterChip, selectedAvailability === opt && styles.filterChipActive]}
            >
              {opt === 'Disponible' && <View style={[styles.filterDot, { backgroundColor: Colors.successLight }]} />}
              {opt === 'En pause'   && <View style={[styles.filterDot, { backgroundColor: Colors.warningLight }]} />}
              {opt === 'Fermé'      && <View style={[styles.filterDot, { backgroundColor: Colors.errorLight }]} />}
              <TText
                variant="caption"
                weight={selectedAvailability === opt ? 'semibold' : 'regular'}
                style={{ color: selectedAvailability === opt ? Colors.textPrimary : Colors.textTertiary }}
              >
                {opt}
              </TText>
            </TouchableOpacity>
          ))}
          <View style={styles.chipDivider} />
          {[
            { label: 'Premium', value: 'premium', icon: 'star-outline' },
            { label: 'Disponibles', value: 'open', icon: 'flash-outline' },
            { label: 'Budget ↑', value: 'budget_asc', icon: 'trending-up-outline' },
          ].map((opt) => (
            <TouchableOpacity
              key={opt.value}
              onPress={() => { setSortBy(opt.value); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              style={[styles.filterChip, sortBy === opt.value && styles.sortChipActive]}
            >
              <Ionicons
                name={opt.icon as any}
                size={11}
                color={sortBy === opt.value ? Colors.accentWarm : Colors.textTertiary}
              />
              <TText
                variant="caption"
                style={{ color: sortBy === opt.value ? Colors.accentWarm : Colors.textTertiary, marginLeft: 4 }}
              >
                {opt.label}
              </TText>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </Animated.View>

      {/* Artist list */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderArtist}
        key={viewMode}
        numColumns={viewMode === 'grid' ? 2 : 1}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 90 }]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          <EmptyState
            icon="search-outline"
            title="Aucun résultat."
            description="Essaie d'autres filtres ou une autre ville."
            ctaLabel="Réinitialiser"
            onCta={() => { setQuery(''); setSelectedStyle(null); setSelectedAvailability('Tous'); }}
            style={{ marginTop: 40 }}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },

  header: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm, paddingTop: Spacing.xs, paddingBottom: Spacing['2xs'],
  },
  headerTitle: { letterSpacing: -2, fontSize: 34 },
  filterIconBtn: {
    width: 42, height: 42, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.bgSurface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.borderDefault,
  },

  searchWrap: { paddingHorizontal: Spacing.sm, marginBottom: Spacing['2xs'] },
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.bgSurface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.borderDefault,
    paddingHorizontal: Spacing.sm, height: 50, gap: 10,
    overflow: 'hidden',
  },
  searchBoxFocused: { borderColor: Colors.accentWarm },
  searchInput: { flex: 1, color: Colors.textPrimary, fontSize: FontSize.body },
  clearBtn: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: Colors.bgSubtle, alignItems: 'center', justifyContent: 'center',
  },

  stylePills: { paddingHorizontal: Spacing.sm, paddingBottom: Spacing['2xs'], gap: 7 },
  stylePill: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: Colors.bgSurface, borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.borderDefault, gap: 6, overflow: 'hidden',
  },
  stylePillActive: { borderColor: Colors.accentWarm },
  stylePillEmoji: { fontSize: 14 },
  stylePillCheck: {
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: Colors.accentWarm,
    alignItems: 'center', justifyContent: 'center',
  },

  filterChips: { paddingHorizontal: Spacing.sm, paddingBottom: Spacing['2xs'], gap: 6, alignItems: 'center' },
  filterChip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 11, paddingVertical: 6,
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.borderSubtle,
    gap: 4,
  },
  filterChipActive: { backgroundColor: Colors.bgSurface, borderColor: Colors.textSecondary },
  sortChipActive: { backgroundColor: Colors.glassAmber, borderColor: Colors.accentWarm },
  filterDot: { width: 6, height: 6, borderRadius: 3 },
  chipDivider: { width: 1, height: 20, backgroundColor: Colors.borderSubtle, marginHorizontal: 3 },

  countRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.sm, paddingBottom: Spacing['2xs'],
  },
  viewToggle: {
    flexDirection: 'row', gap: 4,
    backgroundColor: Colors.bgSurface, borderRadius: Radius.sm, padding: 3,
    borderWidth: 1, borderColor: Colors.borderSubtle,
  },
  viewToggleBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.xs },
  viewToggleBtnActive: { backgroundColor: Colors.bgSubtle },

  spotlightWrap: { marginBottom: Spacing.sm },
  spotlightCard: {
    height: 220, borderRadius: Radius.xl, overflow: 'hidden',
    ...GlowShadow.amberStrong, borderWidth: 1, borderColor: Colors.borderGlow,
  },
  spotlightContent: { position: 'absolute', bottom: Spacing.sm, left: Spacing.sm, right: Spacing.sm },
  spotlightBadge: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(212,168,100,0.30)', overflow: 'hidden',
  },
  spotlightCTA: {
    alignSelf: 'flex-start', marginTop: Spacing.xs,
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: Radius.full, overflow: 'hidden',
  },

  trendingSection: { marginBottom: Spacing.sm },
  trendingSectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: Spacing.sm, marginBottom: Spacing['2xs'],
  },
  fireBadge: {
    backgroundColor: 'rgba(239,68,68,0.12)', borderRadius: Radius.full,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  trendingRow: { paddingHorizontal: Spacing.sm, gap: Spacing['2xs'] },
  trendingCard: {
    width: 120, height: 160, borderRadius: Radius.lg, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderSubtle,
  },
  trendingImg: { width: 120, height: 160 },
  trendingBottom: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: Spacing['2xs'],
  },
  trendingLikes: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },

  list: { paddingHorizontal: Spacing.sm, paddingTop: Spacing['2xs'] },
});
