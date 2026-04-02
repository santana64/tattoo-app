import React, { useState, useMemo, useRef, useCallback } from 'react';
import {
  FlatList, StyleSheet, View, TextInput, TouchableOpacity,
  ScrollView, Dimensions, Animated as RNAnimated, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, FadeInDown, FadeInUp, useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Radius, FontSize, GlowShadow } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { ArtistCard } from '@/components/ArtistCard';
import { TAvatar } from '@/components/ui/TAvatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAppStore } from '@/store/app-store';
import { ARTISTS, STYLES } from '@/constants/mock-data';
import type { Artist } from '@/constants/mock-data';

const { width: SCREEN_W } = Dimensions.get('window');
const AVAILABILITY_OPTIONS = ['Tous', 'Disponible', 'En pause', 'Fermé'];
const SORT_OPTIONS = [
  { label: 'Premium d\'abord', value: 'premium' },
  { label: 'Disponibles', value: 'open' },
  { label: 'Budget croissant', value: 'budget_asc' },
];

// ─── Style category pill
function StylePill({
  style,
  selected,
  onPress,
  index,
}: {
  style: typeof STYLES[0];
  selected: boolean;
  onPress: () => void;
  index: number;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePress = () => {
    scale.value = withSpring(0.9, { damping: 8 }, () => { scale.value = withSpring(1); });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <Animated.View entering={FadeInUp.delay(index * 40).springify()} style={animStyle}>
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={1}
        style={[styles.stylePill, selected && styles.stylePillActive]}
      >
        <TText style={styles.stylePillEmoji}>{style.emoji}</TText>
        <TText
          variant="caption"
          weight={selected ? 'semibold' : 'regular'}
          style={{ color: selected ? Colors.accentWarm : Colors.textSecondary }}
        >
          {style.name}
        </TText>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Top artist spotlight card
function SpotlightCard({ artist }: { artist: Artist }) {
  const router = useRouter();
  return (
    <Animated.View entering={FadeIn.duration(500)} style={styles.spotlightWrap}>
      <TouchableOpacity
        onPress={() => router.push(`/artist/${artist.id}`)}
        activeOpacity={0.92}
        style={styles.spotlightCard}
      >
        <Image
          source={{ uri: artist.coverUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
        <LinearGradient
          colors={['transparent', 'rgba(5,5,8,0.5)', 'rgba(5,5,8,0.97)']}
          locations={[0.2, 0.6, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.spotlightContent}>
          <View style={styles.spotlightBadge}>
            <Ionicons name="star" size={10} color={Colors.accentWarm} />
            <TText variant="micro" style={{ color: Colors.accentWarm, marginLeft: 4 }} uppercase>
              Artiste du moment
            </TText>
          </View>
          <TText variant="title1" weight="bold" style={{ color: '#fff', marginTop: 8 }}>
            {artist.blaze}
          </TText>
          <TText variant="caption" style={{ color: 'rgba(255,255,255,0.55)' }}>
            {artist.city} · {artist.styles.slice(0, 2).join(', ')}
          </TText>
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
  const [selectedAvailability, setSelectedAvailability] = useState<string>('Tous');
  const [sortBy, setSortBy] = useState<string>('premium');
  const [searchFocused, setSearchFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const searchScale = useSharedValue(1);
  const searchFocusStyle = useAnimatedStyle(() => ({
    transform: [{ scale: searchScale.value }],
  }));

  const handleSearchFocus = () => {
    searchScale.value = withSpring(1.02, { damping: 15 });
    setSearchFocused(true);
  };
  const handleSearchBlur = () => {
    searchScale.value = withSpring(1, { damping: 12 });
    setSearchFocused(false);
  };

  const filtered = useMemo(() => {
    let result = ARTISTS.filter((a) => {
      const q = query.toLowerCase();
      const matchQuery =
        !query ||
        a.blaze.toLowerCase().includes(q) ||
        a.city.toLowerCase().includes(q) ||
        a.styles.some((s) => s.toLowerCase().includes(q));
      const matchStyle = !selectedStyle || a.styles.some((s) => s.toLowerCase().replace(/ /g, '-') === selectedStyle);
      const matchAvail =
        selectedAvailability === 'Tous' ||
        (selectedAvailability === 'Disponible' && a.bookingStatus === 'open') ||
        (selectedAvailability === 'En pause' && a.bookingStatus === 'paused') ||
        (selectedAvailability === 'Fermé' && a.bookingStatus === 'closed');
      return matchQuery && matchStyle && matchAvail;
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

  const renderArtist = useCallback(
    ({ item, index }: { item: Artist; index: number }) => (
      <Animated.View entering={FadeInDown.delay(index * 60).springify()}>
        <ArtistCard
          artist={item}
          isSaved={savedArtistIds.has(item.id)}
          onSave={toggleSaveArtist}
          index={index}
          variant={index === 0 && !query ? 'featured' : 'default'}
        />
      </Animated.View>
    ),
    [savedArtistIds, toggleSaveArtist, query]
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ─── Header ─── */}
      <Animated.View entering={FadeIn.duration(400)} style={styles.header}>
        <TText variant="displayM" weight="black" style={styles.headerTitle}>Explorer</TText>
        <TouchableOpacity style={styles.filterIconBtn} activeOpacity={0.7}>
          <Ionicons name="options-outline" size={20} color={Colors.textSecondary} />
        </TouchableOpacity>
      </Animated.View>

      {/* ─── Search ─── */}
      <Animated.View style={[styles.searchWrap, searchFocusStyle]}>
        <View style={[styles.searchBox, searchFocused && styles.searchBoxFocused]}>
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
              <Ionicons name="close-circle" size={18} color={Colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>

      {/* ─── Style pills ─── */}
      <Animated.View entering={FadeInDown.delay(100).springify()}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.stylePills}
        >
          {STYLES.map((s, i) => (
            <StylePill
              key={s.id}
              style={s}
              selected={selectedStyle === s.slug}
              onPress={() => setSelectedStyle(selectedStyle === s.slug ? null : s.slug)}
              index={i}
            />
          ))}
        </ScrollView>
      </Animated.View>

      {/* ─── Availability chips ─── */}
      <Animated.View entering={FadeInDown.delay(150).springify()}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.availChips}
        >
          {AVAILABILITY_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt}
              onPress={() => setSelectedAvailability(opt)}
              style={[styles.availChip, selectedAvailability === opt && styles.availChipActive]}
            >
              {opt === 'Disponible' && (
                <View style={[styles.availDot, { backgroundColor: '#34D399' }]} />
              )}
              {opt === 'En pause' && (
                <View style={[styles.availDot, { backgroundColor: '#FBBF24' }]} />
              )}
              {opt === 'Fermé' && (
                <View style={[styles.availDot, { backgroundColor: '#F87171' }]} />
              )}
              <TText
                variant="caption"
                weight={selectedAvailability === opt ? 'semibold' : 'regular'}
                style={{ color: selectedAvailability === opt ? Colors.textPrimary : Colors.textTertiary }}
              >
                {opt}
              </TText>
            </TouchableOpacity>
          ))}
          <View style={styles.sortDivider} />
          {SORT_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              onPress={() => setSortBy(opt.value)}
              style={[styles.availChip, sortBy === opt.value && styles.sortChipActive]}
            >
              <Ionicons
                name={sortBy === opt.value ? 'funnel' : 'funnel-outline'}
                size={11}
                color={sortBy === opt.value ? Colors.accentWarm : Colors.textTertiary}
                style={{ marginRight: 4 }}
              />
              <TText
                variant="caption"
                style={{ color: sortBy === opt.value ? Colors.accentWarm : Colors.textTertiary }}
              >
                {opt.label}
              </TText>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </Animated.View>

      {/* ─── Results count ─── */}
      <View style={styles.countRow}>
        <TText variant="caption" color="tertiary">
          {filtered.length} artiste{filtered.length > 1 ? 's' : ''}
          {selectedStyle ? ` · ${STYLES.find((s) => s.slug === selectedStyle)?.name}` : ''}
        </TText>
      </View>

      {/* ─── Artist list ─── */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderArtist}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 90 }]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          !query && !selectedStyle && selectedAvailability === 'Tous'
            ? <SpotlightCard artist={spotlightArtist} />
            : null
        }
        ListEmptyComponent={
          <EmptyState
            icon="search-outline"
            title="Aucun résultat."
            description="Essaie d'autres filtres ou une autre ville."
            ctaLabel="Réinitialiser"
            onCta={() => {
              setQuery('');
              setSelectedStyle(null);
              setSelectedAvailability('Tous');
            }}
            style={{ marginTop: 40 }}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing['2xs'],
  },
  headerTitle: {
    letterSpacing: -2,
    fontSize: 34,
  },
  filterIconBtn: {
    width: 40, height: 40,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },

  // Search
  searchWrap: { paddingHorizontal: Spacing.sm, marginBottom: Spacing['2xs'] },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    paddingHorizontal: Spacing.sm,
    height: 52,
    gap: 10,
  },
  searchBoxFocused: {
    borderColor: Colors.accentWarm,
    backgroundColor: Colors.bgElevated,
  },
  searchInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: FontSize.body,
  },

  // Style pills
  stylePills: {
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing['2xs'],
    gap: 8,
  },
  stylePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    gap: 6,
  },
  stylePillActive: {
    backgroundColor: 'rgba(200,168,130,0.10)',
    borderColor: Colors.accentWarm,
  },
  stylePillEmoji: { fontSize: 14 },

  // Availability chips
  availChips: {
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing['2xs'],
    gap: 6,
    alignItems: 'center',
  },
  availChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'transparent',
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    gap: 5,
  },
  availChipActive: {
    backgroundColor: Colors.bgSurface,
    borderColor: Colors.textSecondary,
  },
  sortChipActive: {
    backgroundColor: 'rgba(200,168,130,0.08)',
    borderColor: Colors.accentWarm,
  },
  availDot: { width: 6, height: 6, borderRadius: 3 },
  sortDivider: {
    width: 1,
    height: 20,
    backgroundColor: Colors.borderSubtle,
    marginHorizontal: 4,
  },

  // Count
  countRow: {
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing['2xs'],
  },

  // Spotlight
  spotlightWrap: { marginBottom: Spacing.sm },
  spotlightCard: {
    height: 200,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    ...GlowShadow.amber,
    borderWidth: 1,
    borderColor: Colors.borderGlow,
  },
  spotlightContent: {
    position: 'absolute',
    bottom: Spacing.sm,
    left: Spacing.sm,
    right: Spacing.sm,
  },
  spotlightBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(200,168,130,0.15)',
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(200,168,130,0.30)',
  },

  // List
  list: { paddingHorizontal: Spacing.sm, paddingTop: Spacing['2xs'] },
});
