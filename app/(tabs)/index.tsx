import React, { useCallback, useEffect, useRef, useMemo } from 'react';
import {
  FlatList, StyleSheet, View, TouchableOpacity,
  Animated as RNAnimated, Dimensions, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Colors, Spacing, Radius, GlowShadow, FontSize } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TAvatar } from '@/components/ui/TAvatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { PostCardSkeleton } from '@/components/ui/TSkeleton';
import { PostCard } from '@/components/PostCard';
import { useFeedStore, FeedPost } from '@/store/feed-store';
import { useAuthStore } from '@/store/auth-store';
import { useNotificationStore } from '@/store/notification-store';
import { ARTISTS } from '@/constants/mock-data';

const { width: SCREEN_W } = Dimensions.get('window');

// ─── Bento grid: every 3 posts → full, half+half, full, half+half ...
type BentoFull = { type: 'full'; post: FeedPost; rowIndex: number };
type BentoHalf = { type: 'half'; posts: [FeedPost, FeedPost]; rowIndex: number };
type BentoSingle = { type: 'single'; post: FeedPost; rowIndex: number };
type BentoRow = BentoFull | BentoHalf | BentoSingle;

function buildBento(posts: FeedPost[]): BentoRow[] {
  const rows: BentoRow[] = [];
  let i = 0;
  let rowIndex = 0;
  while (i < posts.length) {
    const mod = rowIndex % 3;
    if (mod === 0) {
      rows.push({ type: 'full', post: posts[i], rowIndex });
      i++;
    } else if (mod === 1 && i + 1 < posts.length) {
      rows.push({ type: 'half', posts: [posts[i], posts[i + 1]], rowIndex });
      i += 2;
    } else {
      rows.push({ type: 'single', post: posts[i], rowIndex });
      i++;
    }
    rowIndex++;
  }
  return rows;
}

// ─── Featured artist story pill
function ArtistStoryPill({ artist, index }: { artist: typeof ARTISTS[0]; index: number }) {
  const router = useRouter();
  return (
    <Animated.View entering={FadeInUp.delay(index * 60).springify()}>
      <TouchableOpacity
        style={styles.storyPill}
        onPress={() => router.push(`/artist/${artist.id}`)}
        activeOpacity={0.85}
      >
        <View style={[styles.storyRing, artist.tier === 'premium' && styles.storyRingPremium]}>
          <TAvatar
            uri={artist.avatarUrl}
            name={artist.blaze}
            size="lg"
            isPremium={false}
          />
        </View>
        <TText variant="micro" color="secondary" numberOfLines={1} style={styles.storyName}>
          {artist.blaze.split(' ')[0]}
        </TText>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuthStore();
  const { posts, isLoading, isRefreshing, hasMore, fetchFeed, fetchMore, refresh, toggleLike } = useFeedStore();
  const { unreadCount } = useNotificationStore();

  const scrollY = useRef(new RNAnimated.Value(0)).current;
  const headerBg = scrollY.interpolate({ inputRange: [0, 80], outputRange: ['rgba(5,5,8,0)', 'rgba(5,5,8,0.97)'], extrapolate: 'clamp' });
  const headerBorderOpacity = scrollY.interpolate({ inputRange: [60, 90], outputRange: [0, 1], extrapolate: 'clamp' });

  useEffect(() => { fetchFeed(user?.id); }, [user?.id]);

  const handleRefresh = useCallback(() => refresh(user?.id), [user?.id]);
  const handleEndReached = useCallback(() => fetchMore(user?.id), [user?.id]);

  const bentoRows = useMemo(() => buildBento(posts), [posts]);

  // Featured artists: open only, premium first
  const featuredArtists = useMemo(
    () => [...ARTISTS].sort((a, b) => {
      if (a.tier === 'premium' && b.tier !== 'premium') return -1;
      if (b.tier === 'premium' && a.tier !== 'premium') return 1;
      return a.bookingStatus === 'open' ? -1 : 1;
    }),
    []
  );

  const renderRow = useCallback(
    ({ item: row }: { item: BentoRow }) => {
      const delay = Math.min(row.rowIndex * 80, 600);

      if (row.type === 'full') {
        return (
          <Animated.View entering={FadeInDown.delay(delay).springify()} style={styles.rowFull}>
            <PostCard
              post={toCardData(row.post)}
              variant="full"
              onLike={() => user?.id && toggleLike(row.post.id, user.id)}
              onPress={() => router.push(`/post/${row.post.id}`)}
              onArtistPress={() => router.push(`/artist/${row.post.artistId}`)}
            />
          </Animated.View>
        );
      }

      if (row.type === 'half') {
        const [p1, p2] = row.posts;
        return (
          <Animated.View entering={FadeInDown.delay(delay).springify()} style={styles.rowHalf}>
            <View style={styles.halfCell}>
              <PostCard
                post={toCardData(p1)}
                variant="half"
                onLike={() => user?.id && toggleLike(p1.id, user.id)}
                onPress={() => router.push(`/post/${p1.id}`)}
                onArtistPress={() => router.push(`/artist/${p1.artistId}`)}
              />
            </View>
            <View style={styles.halfCell}>
              <PostCard
                post={toCardData(p2)}
                variant="half"
                onLike={() => user?.id && toggleLike(p2.id, user.id)}
                onPress={() => router.push(`/post/${p2.id}`)}
                onArtistPress={() => router.push(`/artist/${p2.artistId}`)}
              />
            </View>
          </Animated.View>
        );
      }

      // single
      return (
        <Animated.View entering={FadeInDown.delay(delay).springify()} style={styles.rowFull}>
          <PostCard
            post={toCardData(row.post)}
            variant="wide"
            onLike={() => user?.id && toggleLike(row.post.id, user.id)}
            onPress={() => router.push(`/post/${row.post.id}`)}
            onArtistPress={() => router.push(`/artist/${row.post.artistId}`)}
          />
        </Animated.View>
      );
    },
    [user?.id, toggleLike]
  );

  const ListHeader = useMemo(() => (
    <View>
      {/* Hero spacing for fixed header */}
      <View style={{ height: 56 + insets.top }} />

      {/* Section: Artistes à découvrir */}
      <Animated.View entering={FadeIn.duration(600)}>
        <View style={styles.sectionHeader}>
          <TText variant="label" color="tertiary" uppercase>À découvrir</TText>
          <TouchableOpacity onPress={() => router.push('/(tabs)/explore')}>
            <TText variant="caption" style={{ color: Colors.accentWarm }}>Voir tout →</TText>
          </TouchableOpacity>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.storiesRow}
        >
          {featuredArtists.map((a, i) => (
            <ArtistStoryPill key={a.id} artist={a} index={i} />
          ))}
        </ScrollView>
      </Animated.View>

      {/* Section: Feed */}
      <View style={styles.sectionHeader}>
        <TText variant="label" color="tertiary" uppercase>Pour toi</TText>
      </View>
    </View>
  ), [insets.top, featuredArtists]);

  return (
    <View style={styles.container}>
      {/* Fixed floating header */}
      <RNAnimated.View
        style={[
          styles.floatingHeader,
          { paddingTop: insets.top, backgroundColor: headerBg },
        ]}
        pointerEvents="box-none"
      >
        <RNAnimated.View style={[styles.headerBorder, { opacity: headerBorderOpacity }]} />
        <View style={styles.headerInner}>
          <TText variant="displayM" weight="black" style={styles.logoText}>TATTOO</TText>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={() => router.push('/(tabs)/explore')} style={styles.headerBtn}>
              <Ionicons name="search-outline" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/notifications')} style={styles.headerBtn}>
              <Ionicons name="notifications-outline" size={22} color={Colors.textSecondary} />
              {unreadCount > 0 && (
                <View style={styles.notifBadge}>
                  <TText variant="micro" style={{ color: '#fff', fontSize: 8 }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </TText>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </RNAnimated.View>

      {isLoading && posts.length === 0 ? (
        <View style={[styles.skeletonWrap, { paddingTop: insets.top + 56 }]}>
          {[0, 1, 2].map((i) => <PostCardSkeleton key={i} />)}
        </View>
      ) : (
        <FlatList
          data={bentoRows}
          keyExtractor={(_, i) => String(i)}
          renderItem={renderRow}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 90 }]}
          showsVerticalScrollIndicator={false}
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.4}
          onScroll={RNAnimated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false }
          )}
          scrollEventThrottle={16}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={
            <EmptyState
              icon="images-outline"
              title="Ton feed se construit."
              description="Explore des artistes pour commencer."
              ctaLabel="Explorer"
              onCta={() => router.push('/(tabs)/explore')}
              style={{ marginTop: 80 }}
            />
          }
          ListFooterComponent={
            hasMore && posts.length > 0 ? (
              <View style={styles.footer}>
                <TText variant="caption" color="tertiary">Chargement…</TText>
              </View>
            ) : posts.length > 0 ? (
              <Animated.View entering={FadeIn} style={styles.footer}>
                <TouchableOpacity onPress={() => router.push('/(tabs)/explore')} style={styles.exploreMore}>
                  <Ionicons name="compass-outline" size={18} color={Colors.accentWarm} />
                  <TText variant="caption" style={{ color: Colors.accentWarm, marginLeft: 6 }}>
                    Explorer d'autres artistes
                  </TText>
                </TouchableOpacity>
              </Animated.View>
            ) : null
          }
        />
      )}
    </View>
  );
}

function toCardData(post: FeedPost) {
  return {
    id: post.id,
    artistId: post.artistId,
    artistName: post.artistName,
    artistCity: post.artistCity,
    artistAvatarUrl: post.artistAvatarUrl,
    artistIsPremium: post.artistIsPremium,
    mediaUrl: post.mediaUrl,
    caption: post.caption,
    styles: post.styles,
    likesCount: post.likesCount,
    isLiked: post.isLiked,
  };
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },

  // ── Floating header
  floatingHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  headerBorder: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.borderSubtle,
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
    height: 56,
  },
  logoText: {
    letterSpacing: 6,
    color: Colors.textPrimary,
    fontSize: 22,
  },
  headerActions: { flexDirection: 'row', gap: 4 },
  headerBtn: {
    width: 40, height: 40,
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  notifBadge: {
    position: 'absolute',
    top: 6, right: 6,
    width: 14, height: 14,
    borderRadius: 7,
    backgroundColor: Colors.error,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.bgPrimary,
  },

  // ── Stories
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing['2xs'],
  },
  storiesRow: {
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.sm,
    gap: Spacing.xs,
  },
  storyPill: { alignItems: 'center', width: 68 },
  storyRing: {
    width: 60, height: 60,
    borderRadius: 30,
    padding: 2.5,
    borderWidth: 2,
    borderColor: Colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyRingPremium: {
    borderColor: Colors.accentWarm,
  },
  storyName: {
    marginTop: 6,
    textAlign: 'center',
    maxWidth: 64,
  },

  // ── Bento grid
  skeletonWrap: { paddingHorizontal: Spacing.sm },
  list: { paddingHorizontal: Spacing.sm },
  rowFull: { marginBottom: Spacing.sm },
  rowHalf: {
    flexDirection: 'row',
    gap: Spacing['2xs'],
    marginBottom: Spacing.sm,
  },
  halfCell: { flex: 1 },

  // ── Footer
  footer: { paddingVertical: Spacing.xl, alignItems: 'center' },
  exploreMore: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    backgroundColor: 'rgba(200,168,130,0.08)',
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'rgba(200,168,130,0.20)',
  },
});
