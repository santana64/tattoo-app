import React, { useCallback, useEffect, useRef } from 'react';
import { FlatList, StyleSheet, View, TouchableOpacity, Animated as RNAnimated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Colors, Spacing } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { EmptyState } from '@/components/ui/EmptyState';
import { PostCardSkeleton } from '@/components/ui/TSkeleton';
import { PostCard } from '@/components/PostCard';
import { useFeedStore, FeedPost } from '@/store/feed-store';
import { useAuthStore } from '@/store/auth-store';
import { useNotificationStore } from '@/store/notification-store';

export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuthStore();
  const { posts, isLoading, isRefreshing, hasMore, fetchFeed, fetchMore, refresh, toggleLike } = useFeedStore();
  const { unreadCount } = useNotificationStore();

  // Animated header visibility on scroll
  const scrollY = useRef(new RNAnimated.Value(0)).current;
  const headerOpacity = scrollY.interpolate({ inputRange: [0, 60], outputRange: [1, 0], extrapolate: 'clamp' });

  useEffect(() => {
    fetchFeed(user?.id);
  }, [user?.id]);

  const handleRefresh = useCallback(() => refresh(user?.id), [user?.id]);
  const handleEndReached = useCallback(() => fetchMore(user?.id), [user?.id]);

  const renderPost = useCallback(
    ({ item, index }: { item: FeedPost; index: number }) => (
      <Animated.View entering={FadeInDown.delay(Math.min(index * 80, 400)).springify()}>
        <PostCard
          post={{
            id: item.id,
            artistId: item.artistId,
            artistName: item.artistName,
            artistCity: item.artistCity,
            artistAvatarUrl: item.artistAvatarUrl,
            artistIsPremium: item.artistIsPremium,
            mediaUrl: item.mediaUrl,
            caption: item.caption,
            styles: item.styles,
            likesCount: item.likesCount,
            isLiked: item.isLiked,
          }}
          onLike={() => user?.id && toggleLike(item.id, user.id)}
          onPress={() => router.push(`/post/${item.id}`)}
          onArtistPress={() => router.push(`/artist/${item.artistId}`)}
        />
      </Animated.View>
    ),
    [user?.id, toggleLike]
  );

  const renderSkeletons = () => (
    <View style={{ paddingHorizontal: Spacing.sm, paddingTop: Spacing.sm }}>
      {[0, 1, 2].map((i) => <PostCardSkeleton key={i} />)}
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <RNAnimated.View style={[styles.header, { opacity: headerOpacity }]}>
        <TText variant="title1" weight="bold" style={styles.logo}>TATTOO</TText>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => router.push('/(tabs)/explore')} style={styles.headerBtn}>
            <Ionicons name="search-outline" size={22} color={Colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/notifications')} style={styles.headerBtn}>
            <View>
              <Ionicons name="notifications-outline" size={22} color={Colors.textSecondary} />
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <TText variant="caption" weight="bold" style={{ fontSize: 10, color: Colors.bgPrimary }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </TText>
                </View>
              )}
            </View>
          </TouchableOpacity>
        </View>
      </RNAnimated.View>

      {isLoading && posts.length === 0 ? (
        renderSkeletons()
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={renderPost}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 90 }]}
          showsVerticalScrollIndicator={false}
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.4}
          onScroll={RNAnimated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
          scrollEventThrottle={16}
          ListEmptyComponent={
            <EmptyState
              icon="images-outline"
              title="Ton feed se construit."
              description="Explore des artistes près de toi pour commencer."
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
              <View style={styles.footer}>
                <TouchableOpacity onPress={() => router.push('/(tabs)/explore')}>
                  <TText variant="caption" color="secondary">Explorer d'autres artistes →</TText>
                </TouchableOpacity>
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing['2xs'],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSubtle,
  },
  logo: { letterSpacing: 4, color: Colors.accent },
  headerActions: { flexDirection: 'row', gap: Spacing['2xs'] },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: Colors.error,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  list: { paddingHorizontal: Spacing.sm, paddingTop: Spacing.sm },
  footer: { paddingVertical: Spacing.xl, alignItems: 'center' },
});
