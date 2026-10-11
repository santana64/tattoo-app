import React, { useCallback, useEffect, useRef, useMemo } from 'react';
import {
  FlatList, StyleSheet, View, Pressable, RefreshControl,
  Animated as RNAnimated, ScrollView, Platform, useWindowDimensions, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, { Easing, FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Radius, Layout, Shadow } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TAvatar } from '@/components/ui/TAvatar';
import { TButton } from '@/components/ui/TButton';
import { TSkeleton } from '@/components/ui/TSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { PostCard, type PostCardData } from '@/components/PostCard';
import { BOOKING_STATUS } from '@/components/ArtistCard';
import { Logo } from '@/components/ui/Logo';
import { useFeedStore, FeedPost } from '@/store/feed-store';
import { useAuthStore } from '@/store/auth-store';
import { useNotificationStore } from '@/store/notification-store';
import { Toast } from '@/components/ui/TToast';

const EASE = Easing.bezier(0.22, 1, 0.36, 1);
const HEADER_H = 56;
const GAP = Spacing.md;
const ROW_GAP = Spacing['2xl'];
/** Only the first rows animate in; recycled rows further down appear instantly. */
const ANIMATED_ROWS = 4;

// ── Editorial rhythm ──────────────────────────────────────────────────────────
// Phones: one large piece, a pair, a wide piece, repeat.
// Tablets/desktop: a feature row (lead spanning two columns) then regular rows.
type FeedRow =
  | { key: string; kind: 'lead'; post: FeedPost }
  | { key: string; kind: 'pair'; posts: FeedPost[] }
  | { key: string; kind: 'wide'; post: FeedPost }
  | { key: string; kind: 'feature'; lead: FeedPost; rest: FeedPost[] }
  | { key: string; kind: 'grid'; posts: FeedPost[] };

function buildRows(posts: FeedPost[], cols: number): FeedRow[] {
  const rows: FeedRow[] = [];
  let i = 0;
  let r = 0;
  while (i < posts.length) {
    const beat = r % 3;
    if (cols === 1) {
      if (beat === 0) { rows.push({ key: posts[i].id, kind: 'lead', post: posts[i] }); i += 1; }
      else if (beat === 1 && i + 1 < posts.length) {
        const pair = posts.slice(i, i + 2);
        rows.push({ key: pair.map((p) => p.id).join('|'), kind: 'pair', posts: pair }); i += 2;
      } else { rows.push({ key: posts[i].id, kind: 'wide', post: posts[i] }); i += 1; }
    } else if (beat === 0) {
      const rest = posts.slice(i + 1, i + 1 + (cols - 2));
      rows.push({ key: [posts[i], ...rest].map((p) => p.id).join('|'), kind: 'feature', lead: posts[i], rest });
      i += 1 + rest.length;
    } else {
      const group = posts.slice(i, i + cols);
      rows.push({ key: group.map((p) => p.id).join('|'), kind: 'grid', posts: group });
      i += group.length;
    }
    r += 1;
  }
  return rows;
}

const toCard = (p: FeedPost): PostCardData => ({
  id: p.id, artistId: p.artistId, artistName: p.artistName, artistCity: p.artistCity,
  artistAvatarUrl: p.artistAvatarUrl, artistIsPremium: p.artistIsPremium,
  artistBookingStatus: p.artistBookingStatus,
  mediaUrl: p.mediaUrl, caption: p.caption, styles: p.styles,
  likesCount: p.likesCount, isLiked: p.isLiked,
});

// ── Pieces ────────────────────────────────────────────────────────────────────
type RailArtist = { id: string; blaze: string; avatarUrl: string | null; isPremium: boolean; bookingStatus: FeedPost['artistBookingStatus'] };

function ArtistChip({ artist, index }: { artist: RailArtist; index: number }) {
  const router = useRouter();
  const reduced = useReducedMotion();
  const status = BOOKING_STATUS[artist.bookingStatus] ?? BOOKING_STATUS.closed;

  return (
    <Animated.View entering={reduced || index > 7 ? undefined : FadeInDown.delay(120 + index * 40).duration(600).easing(EASE)}>
      <Pressable
        onPress={() => {
          if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push(`/artist/${artist.id}`);
        }}
        accessibilityRole="link"
        accessibilityLabel={`${artist.blaze}, ${status.label}`}
        style={({ pressed }) => [styles.chip, pressed && { opacity: 0.7 }]}
      >
        <View style={[styles.chipRing, artist.isPremium && styles.chipRingPremium]}>
          <TAvatar uri={artist.avatarUrl} name={artist.blaze} size="xl" />
        </View>
        <TText variant="caption" weight="medium" numberOfLines={1} style={styles.chipName}>{artist.blaze}</TText>
        <View style={styles.chipStatus}>
          <View style={[styles.dot, { backgroundColor: status.color }]} />
          <TText variant="micro" color="tertiary" numberOfLines={1}>{status.short}</TText>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function IconButton({ icon, label, onPress, badge }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; badge?: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
    >
      <Ionicons name={icon} size={19} color={Colors.textPrimary} />
      {!!badge && badge > 0 && (
        <View style={styles.badge} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <TText variant="micro" tabular style={styles.badgeText}>{badge > 9 ? '9+' : badge}</TText>
        </View>
      )}
    </Pressable>
  );
}

function FeedSkeleton({ cols, cellW }: { cols: number; cellW: number }) {
  const tileH = Math.round(cellW * 1.25);
  return (
    <View>
      <View style={styles.masthead}>
        <TSkeleton width={90} height={11} />
        <TSkeleton width="70%" height={36} style={{ marginTop: 12 }} />
        <TSkeleton width="50%" height={14} style={{ marginTop: 10 }} />
      </View>
      <View style={styles.skeletonRail}>
        {[0, 1, 2, 3, 4].map((i) => (
          <View key={i} style={{ alignItems: 'center', gap: 8 }}>
            <TSkeleton width={70} height={70} radius={35} />
            <TSkeleton width={52} height={10} />
          </View>
        ))}
      </View>
      <View style={[styles.rowLine, { marginTop: Spacing.xl }]}>
        {cols === 1 ? (
          <View style={{ flex: 1 }}>
            <TSkeleton height={tileH} radius={Radius.xl} />
            <View style={styles.skeletonLabel}>
              <TSkeleton width={32} height={32} radius={16} />
              <View style={{ flex: 1, gap: 8 }}>
                <TSkeleton width="45%" height={16} />
                <TSkeleton width="30%" height={11} />
              </View>
            </View>
          </View>
        ) : (
          Array.from({ length: cols - 1 }).map((_, i) => (
            <View key={i} style={{ width: i === 0 ? cellW * 2 + GAP : cellW }}>
              <TSkeleton height={tileH} radius={Radius.xl} />
              <TSkeleton width="40%" height={14} style={{ marginTop: 14 }} />
            </View>
          ))
        )}
      </View>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const reduced = useReducedMotion();
  const { width } = useWindowDimensions();
  const { user } = useAuthStore();
  const { posts, error, isLoading, isRefreshing, hasMore, fetchFeed, fetchMore, refresh, toggleLike } = useFeedStore();
  const { unreadCount } = useNotificationStore();

  const scrollY = useRef(new RNAnimated.Value(0)).current;
  const headerBg = scrollY.interpolate({
    inputRange: [0, 60],
    outputRange: ['rgba(11,10,9,0)', 'rgba(11,10,9,0.96)'],
    extrapolate: 'clamp',
  });
  const headerBorderOpacity = scrollY.interpolate({ inputRange: [50, 80], outputRange: [0, 1], extrapolate: 'clamp' });

  useEffect(() => { fetchFeed(user?.id); }, [user?.id, fetchFeed]);

  const handleRefresh    = useCallback(() => refresh(user?.id), [user?.id, refresh]);
  const handleEndReached = useCallback(() => fetchMore(user?.id), [user?.id, fetchMore]);
  const handleLike = useCallback(async (id: string) => {
    if (!user?.id) { router.push('/(auth)/sign-in'); return; }
    if (!await toggleLike(id, user.id)) Toast.error('Le j’aime n’a pas été enregistré. Réessayez.');
  }, [router, toggleLike, user?.id]);

  // ── Responsive grid
  const frameW = Math.min(width, Layout.maxContent);
  const innerW = frameW - Layout.gutter * 2;
  const cols = innerW >= 960 ? 3 : innerW >= 640 ? 2 : 1;
  const cellW = (innerW - GAP * (cols - 1)) / cols;
  const tileH = Math.round(cellW * 1.25);
  const rows = useMemo(() => buildRows(posts, cols), [posts, cols]);

  const railArtists = useMemo<RailArtist[]>(
    () => [...new Map(posts.map((post) => [post.artistId, {
      id: post.artistId, blaze: post.artistName, avatarUrl: post.artistAvatarUrl,
      isPremium: post.artistIsPremium, bookingStatus: post.artistBookingStatus,
    }])).values()],
    [posts],
  );

  const cardProps = useCallback((p: FeedPost) => ({
    post: toCard(p),
    onLike: () => handleLike(p.id),
    onPress: () => router.push(`/post/${p.id}`),
    onArtistPress: () => router.push(`/artist/${p.artistId}`),
  }), [handleLike, router]);

  const renderRow = useCallback(({ item: row, index }: { item: FeedRow; index: number }) => {
    const entering = reduced || index >= ANIMATED_ROWS
      ? undefined
      : FadeInDown.delay(80 + index * 70).duration(600).easing(EASE);

    let content: React.ReactNode;
    switch (row.kind) {
      case 'lead':
        content = (
          <PostCard
            {...cardProps(row.post)}
            variant="full"
            onQuickBook={row.post.artistBookingStatus === 'open'
              ? () => router.push(`/request/new?artistId=${row.post.artistId}`)
              : undefined}
          />
        );
        break;
      case 'wide':
        content = <PostCard {...cardProps(row.post)} variant="wide" />;
        break;
      case 'pair':
        content = (
          <View style={styles.rowLine}>
            {row.posts.map((p) => (
              <View key={p.id} style={styles.flexCell}><PostCard {...cardProps(p)} variant="half" /></View>
            ))}
          </View>
        );
        break;
      case 'feature':
        content = (
          <View style={styles.rowLine}>
            <View style={{ width: cols === 2 ? innerW : cellW * 2 + GAP }}>
              <PostCard {...cardProps(row.lead)} variant="wide" imageHeight={tileH} />
            </View>
            {row.rest.map((p) => (
              <View key={p.id} style={{ width: cellW }}><PostCard {...cardProps(p)} variant="half" imageHeight={tileH} /></View>
            ))}
          </View>
        );
        break;
      case 'grid':
        content = (
          <View style={styles.rowLine}>
            {row.posts.map((p) => (
              <View key={p.id} style={{ width: cellW }}><PostCard {...cardProps(p)} variant="half" imageHeight={tileH} /></View>
            ))}
          </View>
        );
        break;
    }

    return <Animated.View entering={entering} style={styles.row}>{content}</Animated.View>;
  }, [cardProps, router, reduced, cols, cellW, innerW, tileH]);

  const ListHeader = (
    <View>
      <View style={{ height: HEADER_H + insets.top }} />

      <Animated.View entering={reduced ? undefined : FadeInDown.duration(600).easing(EASE)} style={styles.masthead}>
        <TText variant="label" color="accentWarm" uppercase>Le fil</TText>
        <TText variant="displayM" accessibilityRole="header" style={styles.title}>
          Les dernières <TText variant="displayM" italic color="accentGlow">réalisations</TText>
        </TText>
        <TText variant="bodySmall" color="tertiary">Les pièces publiées récemment par les artistes INKR.</TText>
      </Animated.View>

      {railArtists.length > 0 && (
        <View style={styles.railSection}>
          <View style={styles.sectionHead}>
            <TText variant="label" color="tertiary" uppercase>Récemment actifs</TText>
            <Pressable
              onPress={() => router.push('/(tabs)/explore')}
              accessibilityRole="link"
              hitSlop={8}
              style={({ pressed }) => [styles.textLink, pressed && { opacity: 0.6 }]}
            >
              <TText variant="caption" weight="medium" color="secondary">Tous les artistes</TText>
              <Ionicons name="arrow-forward" size={13} color={Colors.textSecondary} />
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.railScroller} contentContainerStyle={styles.rail}>
            {railArtists.map((a, i) => <ArtistChip key={a.id} artist={a} index={i} />)}
          </ScrollView>
        </View>
      )}

      {!!error && posts.length > 0 && (
        <View style={styles.notice} accessibilityLiveRegion="polite">
          <Ionicons name="cloud-offline-outline" size={16} color={Colors.warning} />
          <TText variant="caption" color="secondary" style={{ flex: 1 }}>Actualisation impossible. Vérifiez votre connexion.</TText>
          <Pressable onPress={handleRefresh} accessibilityRole="button" hitSlop={8}>
            <TText variant="caption" weight="semibold">Réessayer</TText>
          </Pressable>
        </View>
      )}

      {posts.length > 0 && <View style={styles.feedHead} />}
    </View>
  );

  const showSkeleton = isLoading && posts.length === 0;

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
            <IconButton icon="search-outline" label="Rechercher un artiste" onPress={() => router.push('/(tabs)/explore')} />
            <IconButton
              icon="notifications-outline"
              label={unreadCount > 0 ? `Notifications, ${unreadCount} non lue${unreadCount > 1 ? 's' : ''}` : 'Notifications'}
              onPress={() => router.push('/notifications')}
              badge={unreadCount}
            />
          </View>
        </View>
      </RNAnimated.View>

      {showSkeleton ? (
        <View style={[styles.frame, { paddingTop: insets.top + HEADER_H }]} accessibilityLabel="Chargement du fil">
          <FeedSkeleton cols={cols} cellW={cellW} />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(row) => `${cols}:${row.key}`}
          renderItem={renderRow}
          style={styles.list}
          contentContainerStyle={[styles.frame, { paddingBottom: insets.bottom + 110 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.accentWarm}
              colors={[Colors.accentWarm]}
              progressViewOffset={insets.top + HEADER_H}
            />
          }
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.4}
          onScroll={RNAnimated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
          scrollEventThrottle={16}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={
            error ? (
              <EmptyState
                icon="cloud-offline-outline"
                title="Le fil est indisponible"
                description="Le chargement a échoué. Vérifiez votre connexion puis réessayez."
                ctaLabel="Réessayer"
                onCta={() => void handleRefresh()}
                style={styles.empty}
              />
            ) : (
              <EmptyState
                icon="images-outline"
                title="Le fil est encore vide"
                description="Les nouvelles réalisations des artistes apparaîtront ici. En attendant, parcourez les profils."
                ctaLabel="Explorer les artistes"
                onCta={() => router.push('/(tabs)/explore')}
                style={styles.empty}
              />
            )
          }
          ListFooterComponent={
            posts.length === 0 ? null : hasMore ? (
              <View style={styles.footer}>
                {isLoading && <ActivityIndicator color={Colors.textTertiary} accessibilityLabel="Chargement des publications suivantes" />}
              </View>
            ) : (
              <Animated.View entering={reduced ? undefined : FadeIn.duration(400)} style={styles.end}>
                <TText variant="displayS" style={styles.endTitle}>
                  Vous êtes <TText variant="displayS" italic color="accentGlow">à jour</TText>
                </TText>
                <TText variant="bodySmall" color="tertiary" style={styles.endText}>
                  Découvrez d’autres artistes par style ou par ville.
                </TText>
                <TButton
                  title="Explorer les artistes"
                  variant="secondary"
                  size="md"
                  fullWidth={false}
                  onPress={() => router.push('/(tabs)/explore')}
                />
              </Animated.View>
            )
          }
        />
      )}

      {/* Artist shortcut: publish a new piece */}
      {user?.role === 'artist' && (
        <Animated.View
          entering={reduced ? undefined : FadeIn.delay(600).duration(500)}
          style={[styles.fab, { bottom: 88 + insets.bottom, right: Math.max(Layout.gutter, (width - Layout.maxContent) / 2 + Layout.gutter) }]}
        >
          <Pressable
            onPress={() => router.push('/create')}
            accessibilityRole="button"
            accessibilityLabel="Publier une réalisation"
            style={({ pressed }) => [styles.fabBtn, cols > 1 && styles.fabBtnWide, pressed && { opacity: 0.88 }]}
          >
            <Ionicons name="add" size={24} color={Colors.textInverse} />
            {cols > 1 && <TText variant="bodySmall" weight="semibold" color="inverse">Publier</TText>}
          </Pressable>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  list: { flex: 1 },
  frame: { width: '100%', maxWidth: Layout.maxContent, alignSelf: 'center', paddingHorizontal: Layout.gutter },

  // Header
  floatingHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100 },
  headerBorder: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: StyleSheet.hairlineWidth, backgroundColor: Colors.borderDefault,
  },
  headerInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    height: HEADER_H, paddingHorizontal: Layout.gutter,
    width: '100%', maxWidth: Layout.maxContent, alignSelf: 'center',
  },
  headerActions: { flexDirection: 'row', gap: Spacing['2xs'] },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderDefault,
  },
  badge: {
    position: 'absolute', top: -3, right: -3,
    minWidth: 17, height: 17, borderRadius: 9, paddingHorizontal: 4,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.accentWarm,
    borderWidth: 2, borderColor: Colors.bgPrimary,
  },
  badgeText: { color: Colors.textInverse, fontSize: 9, lineHeight: 11, letterSpacing: 0 },

  // Masthead
  masthead: { paddingTop: Spacing.sm, paddingBottom: Spacing.lg },
  title: { marginTop: 6, marginBottom: 6 },

  // Rail
  railSection: { marginBottom: Spacing.lg },
  sectionHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: Spacing.sm, marginBottom: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.borderDefault,
  },
  textLink: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32 },
  // The rail bleeds to the screen edge while its first item stays on the gutter.
  railScroller: { marginHorizontal: -Layout.gutter },
  rail: { gap: Spacing.xs, paddingHorizontal: Layout.gutter },
  chip: { width: 80, alignItems: 'center' },
  chipRing: {
    padding: 3, borderRadius: 37,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderDefault,
  },
  chipRingPremium: { borderColor: Colors.borderGlow },
  chipName: { marginTop: 8, maxWidth: 76, textAlign: 'center' },
  chipStatus: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  dot: { width: 6, height: 6, borderRadius: 3 },

  notice: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: Spacing.xs, marginBottom: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderDefault,
  },

  feedHead: {
    marginBottom: Spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.borderDefault,
  },

  // Rows
  row: { marginBottom: ROW_GAP },
  rowLine: { flexDirection: 'row', gap: GAP, alignItems: 'flex-start' },
  flexCell: { flex: 1 },

  skeletonRail: { flexDirection: 'row', gap: Spacing.sm, overflow: 'hidden' },
  skeletonLabel: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },

  empty: { paddingTop: Spacing['2xl'] },

  footer: { height: 80, alignItems: 'center', justifyContent: 'center' },
  end: {
    alignItems: 'center',
    paddingTop: Spacing.xl, paddingBottom: Spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.borderDefault,
  },
  endTitle: { textAlign: 'center' },
  endText: { textAlign: 'center', marginTop: 6, marginBottom: Spacing.md },

  // FAB
  fab: { position: 'absolute', zIndex: 50 },
  fabBtn: {
    height: 56, minWidth: 56, borderRadius: 28,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: Colors.accentAction,
    ...Shadow.md,
  },
  fabBtnWide: { paddingHorizontal: Spacing.md + 2 },
});
