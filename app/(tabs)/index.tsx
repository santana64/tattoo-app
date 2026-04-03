import React, { useCallback, useEffect, useRef, useMemo } from 'react';
import {
  FlatList, StyleSheet, View, TouchableOpacity,
  Animated as RNAnimated, Dimensions, ScrollView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import Animated, { FadeIn, FadeInDown, FadeInUp, useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Radius, GlowShadow, FontSize } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TAvatar } from '@/components/ui/TAvatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { PostCardSkeleton } from '@/components/ui/TSkeleton';
import { PostCard } from '@/components/PostCard';
import { Logo } from '@/components/ui/Logo';
import { useFeedStore, FeedPost } from '@/store/feed-store';
import { useAuthStore } from '@/store/auth-store';
import { useNotificationStore } from '@/store/notification-store';
import { ARTISTS } from '@/constants/mock-data';

const { width: SCREEN_W } = Dimensions.get('window');

// ── Bento grid types
type BentoFull   = { type: 'full';   post: FeedPost; rowIndex: number };
type BentoHalf   = { type: 'half';   posts: [FeedPost, FeedPost]; rowIndex: number };
type BentoSingle = { type: 'single'; post: FeedPost; rowIndex: number };
type BentoRow    = BentoFull | BentoHalf | BentoSingle;

function buildBento(posts: FeedPost[]): BentoRow[] {
  const rows: BentoRow[] = [];
  let i = 0, rowIndex = 0;
  while (i < posts.length) {
    const mod = rowIndex % 3;
    if (mod === 0) { rows.push({ type: 'full', post: posts[i], rowIndex }); i++; }
    else if (mod === 1 && i + 1 < posts.length) { rows.push({ type: 'half', posts: [posts[i], posts[i + 1]], rowIndex }); i += 2; }
    else { rows.push({ type: 'single', post: posts[i], rowIndex }); i++; }
    rowIndex++;
  }
  return rows;
}

// ── Artist story pill — V3
function StoryPill({ artist, index }: { artist: typeof ARTISTS[0]; index: number }) {
  const router = useRouter();
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePress = () => {
    scale.value = withSpring(0.92, { damping: 8 }, () => { scale.value = withSpring(1, { damping: 12 }); });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/artist/${artist.id}`);
  };

  const isPremium = artist.tier === 'premium';

  return (
    <Animated.View entering={FadeInUp.delay(index * 55).springify()} style={animStyle}>
      <TouchableOpacity style={styles.storyPill} onPress={handlePress} activeOpacity={1}>
        {/* Ring */}
        <View style={[styles.storyRing, isPremium && styles.storyRingPremium]}>
          {isPremium && (
            <LinearGradient
              colors={[Colors.accentGlow, Colors.accentWarm, '#C8703A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          )}
          <View style={styles.storyRingInner}>
            <TAvatar
              uri={artist.avatarUrl}
              name={artist.blaze}
              size="lg"
              isPremium={false}
            />
          </View>
        </View>
        {/* Live dot if open */}
        {artist.bookingStatus === 'open' && (
          <View style={styles.storyLiveDot} />
        )}
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
  const headerBg = scrollY.interpolate({
    inputRange: [0, 60],
    outputRange: ['rgba(3,3,5,0)', 'rgba(3,3,5,0.96)'],
    extrapolate: 'clamp',
  });
  const headerBorderOpacity = scrollY.interpolate({ inputRange: [50, 80], outputRange: [0, 1], extrapolate: 'clamp' });

  useEffect(() => { fetchFeed(user?.id); }, [user?.id]);

  const handleRefresh    = useCallback(() => refresh(user?.id), [user?.id]);
  const handleEndReached = useCallback(() => fetchMore(user?.id), [user?.id]);
  const bentoRows        = useMemo(() => buildBento(posts), [posts]);

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
      const delay = Math.min(row.rowIndex * 70, 500);
      const toCard = (p: FeedPost) => ({
        id: p.id, artistId: p.artistId, artistName: p.artistName, artistCity: p.artistCity,
        artistAvatarUrl: p.artistAvatarUrl, artistIsPremium: p.artistIsPremium,
        mediaUrl: p.mediaUrl, caption: p.caption, styles: p.styles,
        likesCount: p.likesCount, isLiked: p.isLiked,
        isTrending: p.likesCount > 80,
      });

      if (row.type === 'full') {
        return (
          <Animated.View entering={FadeInDown.delay(delay).springify()} style={styles.rowFull}>
            <PostCard
              post={toCard(row.post)}
              variant="full"
              onLike={() => user?.id && toggleLike(row.post.id, user.id)}
              onPress={() => router.push(`/post/${row.post.id}`)}
              onArtistPress={() => router.push(`/artist/${row.post.artistId}`)}
              onQuickBook={() => router.push(`/request/new?artistId=${row.post.artistId}`)}
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
                post={toCard(p1)} variant="half"
                onLike={() => user?.id && toggleLike(p1.id, user.id)}
                onPress={() => router.push(`/post/${p1.id}`)}
                onArtistPress={() => router.push(`/artist/${p1.artistId}`)}
              />
            </View>
            <View style={styles.halfCell}>
              <PostCard
                post={toCard(p2)} variant="half"
                onLike={() => user?.id && toggleLike(p2.id, user.id)}
                onPress={() => router.push(`/post/${p2.id}`)}
                onArtistPress={() => router.push(`/artist/${p2.artistId}`)}
              />
            </View>
          </Animated.View>
        );
      }

      return (
        <Animated.View entering={FadeInDown.delay(delay).springify()} style={styles.rowFull}>
          <PostCard
            post={toCard(row.post)}
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
      <View style={{ height: 56 + insets.top }} />
      <Animated.View entering={FadeIn.duration(500)}>
        <View style={styles.sectionHeader}>
          <TText variant="label" color="tertiary" uppercase style={{ letterSpacing: 2 }}>À découvrir</TText>
          <TouchableOpacity onPress={() => router.push('/(tabs)/explore')}>
            <TText variant="caption" style={{ color: Colors.accentWarm }}>Voir tout →</TText>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storiesRow}>
          {featuredArtists.map((a, i) => <StoryPill key={a.id} artist={a} index={i} />)}
        </ScrollView>
      </Animated.View>
      <View style={styles.sectionHeader}>
        <TText variant="label" color="tertiary" uppercase style={{ letterSpacing: 2 }}>Pour toi</TText>
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <TText variant="micro" style={{ color: Colors.accentWarm, fontSize: 9 }}>LIVE</TText>
        </View>
      </View>
    </View>
  ), [insets.top, featuredArtists]);

  return (
    <View style={styles.container}>
      {/* Floating header */}
      <RNAnimated.View
        style={[styles.floatingHeader, { paddingTop: insets.top, backgroundColor: headerBg }]}
        pointerEvents="box-none"
      >
        <RNAnimated.View style={[styles.headerBorder, { opacity: headerBorderOpacity }]} />
        <View style={styles.headerInner}>
          <Logo size="sm" variant="full" />
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={() => router.push('/(tabs)/explore')} style={styles.headerBtn}>
              <Ionicons name="search-outline" size={21} color={Colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/notifications')} style={styles.headerBtn}>
              <Ionicons name="notifications-outline" size={21} color={Colors.textSecondary} />
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
          onScroll={RNAnimated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
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
                  <LinearGradient
                    colors={[Colors.accentMuted, 'transparent']}
                    style={StyleSheet.absoluteFill}
                  />
                  <Ionicons name="compass-outline" size={17} color={Colors.accentWarm} />
                  <TText variant="caption" style={{ color: Colors.accentWarm, marginLeft: 6 }}>
                    Explorer d'autres artistes
                  </TText>
                </TouchableOpacity>
              </Animated.View>
            ) : null
          }
        />
      )}

      {/* Artist FAB */}
      {user?.role === 'artist' && (
        <Animated.View entering={FadeIn.delay(600).duration(500)} style={[styles.fab, { bottom: 88 + insets.bottom }]}>
          <TouchableOpacity onPress={() => router.push('/create')} activeOpacity={0.85} style={styles.fabBtn}>
            <LinearGradient
              colors={[Colors.accentGlow, Colors.accentWarm, '#B0683A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Ionicons name="add" size={26} color="#fff" />
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  floatingHeader: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100,
  },
  headerBorder: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: StyleSheet.hairlineWidth, backgroundColor: Colors.borderSubtle,
  },
  headerInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm, height: 56,
  },
  headerActions: { flexDirection: 'row', gap: 2 },
  headerBtn: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  notifBadge: {
    position: 'absolute', top: 6, right: 6,
    width: 15, height: 15, borderRadius: 8,
    backgroundColor: Colors.error,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: Colors.bgPrimary,
  },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.sm, paddingTop: Spacing.sm, paddingBottom: Spacing['2xs'],
  },
  liveBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.accentMuted, borderRadius: Radius.full,
    paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: Colors.borderGlow,
  },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: Colors.accentGlow },
  storiesRow: { paddingHorizontal: Spacing.sm, paddingBottom: Spacing.sm, gap: Spacing.xs },
  storyPill: { alignItems: 'center', width: 70 },
  storyRing: {
    width: 62, height: 62, borderRadius: 31,
    padding: 2, borderWidth: 1.5,
    borderColor: Colors.borderSubtle,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  storyRingPremium: { borderColor: 'transparent', ...GlowShadow.amber },
  storyRingInner: {
    width: 54, height: 54, borderRadius: 27,
    overflow: 'hidden', backgroundColor: Colors.bgSubtle,
    alignItems: 'center', justifyContent: 'center',
  },
  storyLiveDot: {
    position: 'absolute', bottom: 18, right: 4,
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: Colors.success,
    borderWidth: 1.5, borderColor: Colors.bgPrimary,
  },
  storyName: { marginTop: 5, textAlign: 'center', maxWidth: 64 },
  skeletonWrap: { paddingHorizontal: Spacing.sm },
  list: { paddingHorizontal: Spacing.sm },
  rowFull: { marginBottom: Spacing.sm },
  rowHalf: { flexDirection: 'row', gap: Spacing['2xs'], marginBottom: Spacing.sm },
  halfCell: { flex: 1 },
  footer: { paddingVertical: Spacing.xl, alignItems: 'center' },
  exploreMore: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
    borderRadius: Radius.full, overflow: 'hidden',
    borderWidth: 1, borderColor: Colors.borderGlow,
  },
  fab: { position: 'absolute', right: Spacing.sm, zIndex: 50 },
  fabBtn: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
    ...GlowShadow.amberStrong,
  },
});
