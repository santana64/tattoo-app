import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { View, StyleSheet, Pressable, FlatList, ScrollView, Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Animated from 'react-native-reanimated';
import { Colors, Spacing, Radius, Layout } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TAvatar } from '@/components/ui/TAvatar';
import { THeader } from '@/components/ui/THeader';
import { TSkeleton } from '@/components/ui/TSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ArtPlaceholder, BOOKING_STATUS } from '@/components/ArtistCard';
import { VideoPlaceholder, isVideoMedia } from '@/components/PostCard';
import { PressableScale, RevealImage, enterUp } from '@/components/motion';
import { useFeedStore, type FeedPost } from '@/store/feed-store';
import { useAuthStore } from '@/store/auth-store';
import { useSavedArtistsStore } from '@/store/saved-artists-store';

const GAP = Spacing.xs;

type Tab = 'saved' | 'liked';

const TABS: { value: Tab; label: string }[] = [
  { value: 'saved', label: 'Enregistrées' },
  { value: 'liked', label: 'Aimées' },
];

type SavedArtist = { id: string; blaze: string; avatarUrl: string | null; bookingStatus: FeedPost['artistBookingStatus'] };

// Virtualized grid cell: press feedback and photo reveal only, no entrance animation.
function WorkTile({ post, width }: { post: FeedPost; width: number }) {
  const router = useRouter();
  const isVideo = isVideoMedia(post.mediaUrl);
  return (
    <View style={{ width }}>
      <PressableScale
        onPress={() => router.push(`/post/${post.id}`)}
        accessibilityRole="link"
        accessibilityLabel={`Réalisation de ${post.artistName}${post.caption ? ` : ${post.caption}` : ''}`}
      >
        <View style={[styles.tile, { height: Math.round(width * 1.25) }]}>
          {isVideo ? (
            <VideoPlaceholder compact />
          ) : (
            <RevealImage
              uri={post.mediaUrl}
              style={StyleSheet.absoluteFill}
              fallback={<ArtPlaceholder name={post.artistName} size={40} />}
            />
          )}
        </View>
        <TText variant="caption" weight="medium" numberOfLines={1} style={styles.tileName}>{post.artistName}</TText>
        {!!post.artistCity && <TText variant="caption" color="tertiary" numberOfLines={1}>{post.artistCity}</TText>}
      </PressableScale>
    </View>
  );
}

function GridSkeleton({ cols, cellW }: { cols: number; cellW: number }) {
  return (
    <View style={styles.gridRow}>
      {Array.from({ length: cols * 2 }).map((_, i) => (
        <View key={i} style={{ width: cellW, marginBottom: Spacing.lg }}>
          <TSkeleton height={Math.round(cellW * 1.25)} radius={Radius.md} />
          <TSkeleton width="55%" height={11} style={{ marginTop: 10 }} />
        </View>
      ))}
    </View>
  );
}

export default function SavedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ tab?: string }>();

  const [activeTab, setActiveTab] = useState<Tab>(
    params.tab === 'liked' ? 'liked' : 'saved'
  );

  const { user } = useAuthStore();
  // Feed store — real saved / liked memberships for the loaded publications.
  const { savedPostIds, likedPostIds, posts: feedPosts, isLoading: feedLoading } = useFeedStore();
  // Saved artists — real memberships from Supabase.
  const { savedArtistIds, fetchSaved } = useSavedArtistsStore();
  useEffect(() => { void fetchSaved(user?.id); }, [fetchSaved, user?.id]);

  const savedPosts = useMemo(() => feedPosts.filter((p) => savedPostIds.has(p.id)), [feedPosts, savedPostIds]);
  const likedPosts = useMemo(() => feedPosts.filter((p) => likedPostIds.has(p.id)), [feedPosts, likedPostIds]);

  // Artist details come from the loaded feed; saved artists without a loaded post are not listed here.
  const savedArtists = useMemo<SavedArtist[]>(() => {
    const byId = new Map<string, SavedArtist>();
    for (const p of feedPosts) {
      if (savedArtistIds.has(p.artistId) && !byId.has(p.artistId)) {
        byId.set(p.artistId, { id: p.artistId, blaze: p.artistName, avatarUrl: p.artistAvatarUrl, bookingStatus: p.artistBookingStatus });
      }
    }
    return [...byId.values()];
  }, [feedPosts, savedArtistIds]);

  const activePosts = activeTab === 'saved' ? savedPosts : likedPosts;

  // ── Responsive grid
  const innerW = Math.min(width, Layout.maxContent) - Layout.gutter * 2;
  const cols = innerW >= 1000 ? 5 : innerW >= 760 ? 4 : innerW >= 520 ? 3 : 2;
  const cellW = Math.floor((innerW - GAP * (cols - 1)) / cols);

  const selectTab = useCallback((tab: Tab) => {
    // Tabs are peers switched often: no haptic, no transition (frequency gate).
    if (tab !== activeTab) setActiveTab(tab);
  }, [activeTab]);

  if (!user) {
    return (
      <View style={styles.container}>
        <THeader showBack />
        <EmptyState
          icon="bookmark-outline"
          title="Retrouvez vos favoris"
          description="Connectez-vous pour enregistrer des réalisations et suivre vos artistes."
          ctaLabel="Se connecter"
          onCta={() => router.push('/(auth)/sign-in')}
        />
      </View>
    );
  }

  const header = (
    <View>
      <View style={styles.masthead}>
        <Animated.View entering={enterUp(0)}>
          <TText variant="displayM" accessibilityRole="header">
            Vos <TText variant="displayM" italic color="accentGlow">favoris</TText>
          </TText>
        </Animated.View>
        <Animated.View entering={enterUp(1)}>
          <TText variant="bodySmall" color="tertiary" style={{ marginTop: 4 }}>
            Les pièces et les artistes que vous gardez sous la main.
          </TText>
        </Animated.View>
      </View>

      {/* Tabs */}
      <Animated.View entering={enterUp(2)} style={styles.tabs} accessibilityRole="tablist">
        {TABS.map((t) => {
          const selected = activeTab === t.value;
          const count = t.value === 'saved' ? savedPosts.length : likedPosts.length;
          return (
            <Pressable
              key={t.value}
              onPress={() => selectTab(t.value)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={`${t.label}, ${count}`}
              style={[styles.tab, selected && styles.tabActive]}
            >
              <TText variant="bodySmall" weight={selected ? 'semibold' : 'medium'} color={selected ? 'primary' : 'tertiary'}>
                {t.label}
              </TText>
              <TText variant="caption" tabular color={selected ? 'accentWarm' : 'tertiary'}>{count}</TText>
            </Pressable>
          );
        })}
      </Animated.View>

      {/* Saved artists */}
      {activeTab === 'saved' && savedArtists.length > 0 && (
        <View style={styles.artistsSection}>
          <TText variant="label" color="tertiary" uppercase style={styles.sectionLabel}>Artistes enregistrés</TText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.railScroller} contentContainerStyle={styles.rail}>
            {savedArtists.map((artist, i) => {
              const status = BOOKING_STATUS[artist.bookingStatus] ?? BOOKING_STATUS.closed;
              return (
                <Animated.View key={artist.id} entering={i <= 8 ? enterUp(i, 160) : undefined}>
                <PressableScale
                  onPress={() => router.push(`/artist/${artist.id}`)}
                  accessibilityRole="link"
                  accessibilityLabel={`${artist.blaze}, ${status.label}`}
                  style={styles.artistChip}
                >
                  <View style={styles.avatarRing}>
                    <TAvatar uri={artist.avatarUrl} name={artist.blaze} size="lg" />
                  </View>
                  <TText variant="caption" weight="medium" numberOfLines={1} style={styles.artistName}>{artist.blaze}</TText>
                  <View style={styles.statusRow}>
                    <View style={[styles.dot, { backgroundColor: status.color }]} />
                    <TText variant="micro" color="tertiary" numberOfLines={1}>{status.short}</TText>
                  </View>
                </PressableScale>
                </Animated.View>
              );
            })}
          </ScrollView>
        </View>
      )}

      {activePosts.length > 0 && (
        <TText variant="label" color="tertiary" uppercase style={styles.sectionLabel}>
          {activeTab === 'saved' ? 'Réalisations enregistrées' : 'Réalisations aimées'}
        </TText>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <THeader showBack />
      <FlatList
        key={`${activeTab}-${cols}`}
        data={activePosts}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => <WorkTile post={item} width={cellW} />}
        numColumns={cols}
        columnWrapperStyle={styles.columnWrapper}
        style={styles.list}
        contentContainerStyle={[styles.frame, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={header}
        ListEmptyComponent={
          feedLoading && feedPosts.length === 0 ? (
            <GridSkeleton cols={cols} cellW={cellW} />
          ) : (
            <EmptyState
              icon={activeTab === 'saved' ? 'bookmark-outline' : 'heart-outline'}
              title={activeTab === 'saved' ? 'Rien d’enregistré pour l’instant' : 'Aucune pièce aimée'}
              description={activeTab === 'saved'
                ? 'Enregistrez une réalisation depuis sa page avec le signet : elle vous attendra ici.'
                : 'Touchez le cœur sous une réalisation pour la retrouver ici.'}
              ctaLabel="Explorer les artistes"
              onCta={() => router.push('/(tabs)/explore')}
              style={styles.empty}
            />
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  list: { flex: 1 },
  frame: { width: '100%', maxWidth: Layout.maxContent, alignSelf: 'center', paddingHorizontal: Layout.gutter },

  masthead: { paddingTop: Spacing.md, paddingBottom: Spacing.lg },

  tabs: {
    flexDirection: 'row', gap: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.borderDefault,
    marginBottom: Spacing.lg,
  },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    height: 44, marginBottom: -StyleSheet.hairlineWidth,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } as object : null),
  },
  tabActive: { borderBottomColor: Colors.accentWarm },

  sectionLabel: { marginBottom: Spacing.sm },

  artistsSection: { marginBottom: Spacing.xl },
  railScroller: { marginHorizontal: -Layout.gutter },
  rail: { gap: Spacing.xs, paddingHorizontal: Layout.gutter },
  artistChip: { width: 76, alignItems: 'center' },
  avatarRing: {
    padding: 3, borderRadius: 30,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderDefault,
  },
  artistName: { marginTop: 8, maxWidth: 72, textAlign: 'center' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  dot: { width: 6, height: 6, borderRadius: 3 },

  columnWrapper: { gap: GAP, marginBottom: Spacing.lg },
  gridRow: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  tile: { width: '100%', borderRadius: Radius.md, overflow: 'hidden', backgroundColor: Colors.bgSurface },
  tileName: { marginTop: 10 },

  empty: { paddingTop: Spacing['2xl'] },
});
