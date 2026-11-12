import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { View, StyleSheet, FlatList, ScrollView } from 'react-native';
import { useContentDimensions } from '@/hooks/useContentDimensions';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Animated from 'react-native-reanimated';
import { Colors, Spacing, Layout } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TAvatar } from '@/components/ui/TAvatar';
import { THeader } from '@/components/ui/THeader';
import { TSkeleton } from '@/components/ui/TSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ArtPlaceholder, BOOKING_STATUS } from '@/components/ArtistCard';
import { VideoPlaceholder, isVideoMedia } from '@/components/PostCard';
import { PressableScale, RevealImage, enterUp } from '@/components/motion';
import { Kicker, Masthead, SectionHead, StatusDot } from '@/components/v5';
import { SectionTabs } from '@/components/v5/SectionTabs';
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
function WorkTile({ post, width, index }: { post: FeedPost; width: number; index: number }) {
  const router = useRouter();
  const isVideo = isVideoMedia(post.mediaUrl, post.mediaType);
  return (
    <View style={{ width }}>
      <PressableScale
        onPress={() => router.push(isVideo ? `/reels/${post.id}` : `/post/${post.id}`)}
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
        <Kicker tone="muted" style={styles.tileNumber}>{`N° ${String(index + 1).padStart(2, '0')}`}</Kicker>
        <TText variant="title2" serif numberOfLines={1} style={styles.tileName}>{post.artistName}</TText>
        {!!post.artistCity && <TText variant="caption" color="secondary" numberOfLines={1}>{post.artistCity}</TText>}
      </PressableScale>
    </View>
  );
}

function GridSkeleton({ cols, cellW }: { cols: number; cellW: number }) {
  return (
    <View style={styles.gridRow}>
      {Array.from({ length: cols * 2 }).map((_, i) => (
        <View key={i} style={{ width: cellW, marginBottom: Spacing.lg }}>
          <TSkeleton height={Math.round(cellW * 1.25)} radius={0} />
          <TSkeleton width="55%" height={14} radius={0} style={{ marginTop: 12 }} />
        </View>
      ))}
    </View>
  );
}

export default function SavedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, gutter } = useContentDimensions();
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

  // ── Responsive grid: two large plates on phones, a denser wall on wide screens.
  const innerW = Math.min(width, Layout.maxContent) - gutter * 2;
  const cols = innerW >= 1000 ? 5 : innerW >= 720 ? 4 : 2;
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
      <Masthead
        kicker="Collection privée"
        title="Votre carnet"
        emphasis="d’inspirations."
        description="Les pièces et les artistes que vous gardez sous la main."
        style={styles.masthead}
      />

      <SectionTabs
        tabs={TABS.map((t) => ({ ...t, count: t.value === 'saved' ? savedPosts.length : likedPosts.length }))}
        value={activeTab}
        onChange={selectTab}
        style={styles.tabs}
      />

      {/* Saved artists */}
      {activeTab === 'saved' && savedArtists.length > 0 && (
        <View style={styles.artistsSection}>
          <SectionHead kicker="Artistes enregistrés" />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginHorizontal: -gutter }}
            contentContainerStyle={[styles.rail, { paddingHorizontal: gutter }]}
          >
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
                    <View style={styles.avatarFrame}>
                      <TAvatar uri={artist.avatarUrl} name={artist.blaze} size="lg" />
                    </View>
                    <TText variant="title2" serif numberOfLines={1} style={styles.artistName}>{artist.blaze}</TText>
                    <StatusDot tone={status.tone} label={status.short} />
                  </PressableScale>
                </Animated.View>
              );
            })}
          </ScrollView>
        </View>
      )}

      {activePosts.length > 0 && (
        <SectionHead kicker={activeTab === 'saved' ? 'Réalisations enregistrées' : 'Réalisations aimées'} style={styles.gridHead} />
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
        renderItem={({ item, index }) => <WorkTile post={item} width={cellW} index={index} />}
        numColumns={cols}
        columnWrapperStyle={styles.columnWrapper}
        style={styles.list}
        contentContainerStyle={[styles.frame, { paddingHorizontal: gutter, paddingBottom: insets.bottom + 40 }]}
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
  container: { flex: 1, backgroundColor: Colors.paper },
  list: { flex: 1 },
  frame: { width: '100%', maxWidth: Layout.maxContent, alignSelf: 'center' },

  masthead: { marginBottom: 0 },
  tabs: { marginBottom: Spacing.xl },

  artistsSection: { marginBottom: Spacing.xl },
  rail: { gap: Spacing.sm },
  artistChip: { width: 84, alignItems: 'flex-start', gap: 6 },
  avatarFrame: { padding: 3, borderWidth: 1, borderColor: Colors.line },
  artistName: { fontSize: 17, lineHeight: 19, maxWidth: 82 },

  gridHead: { marginBottom: Spacing.md },
  columnWrapper: { gap: GAP, marginBottom: Spacing.xl },
  gridRow: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  tile: { width: '100%', overflow: 'hidden', backgroundColor: Colors.clay },
  tileNumber: { marginTop: 10 },
  tileName: { fontSize: 19, lineHeight: 21, marginTop: 4 },

  empty: { paddingTop: Spacing['2xl'] },
});
