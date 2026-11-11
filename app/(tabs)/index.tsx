import React, { useCallback, useEffect, useMemo } from 'react';
import {
  StyleSheet, View, RefreshControl, ScrollView, useWindowDimensions, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import Animated, {
  useSharedValue, useAnimatedScrollHandler, useAnimatedStyle, interpolate, Extrapolation, useReducedMotion,
} from 'react-native-reanimated';
import { Colors, Spacing, Radius, Layout, Shadow } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { useAutoRetry } from '@/hooks/use-auto-retry';
import { TAvatar } from '@/components/ui/TAvatar';
import { TButton } from '@/components/ui/TButton';
import { TSkeleton } from '@/components/ui/TSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { PostCard, type PostCardData } from '@/components/PostCard';
import { BOOKING_STATUS } from '@/components/ArtistCard';
import { Logo } from '@/components/ui/Logo';
import { GlassSurface, PressableScale, enterUp, fadeIn } from '@/components/motion';
import { useFeedStore, FeedPost } from '@/store/feed-store';
import { useAuthStore } from '@/store/auth-store';
import { useNotificationStore } from '@/store/notification-store';
import { Toast } from '@/components/ui/TToast';

const HEADER_H = 56;
const GAP = Spacing.md;
const ROW_GAP = Spacing['2xl'];

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
  mediaUrl: p.mediaUrl, mediaType: p.mediaType, thumbnailUrl: p.thumbnailUrl, embedProvider: p.embedProvider,
  caption: p.caption, styles: p.styles,
  likesCount: p.likesCount, isLiked: p.isLiked,
});

// ── Pieces ────────────────────────────────────────────────────────────────────
type RailArtist = { id: string; blaze: string; avatarUrl: string | null; isPremium: boolean; bookingStatus: FeedPost['artistBookingStatus'] };

function ArtistChip({ artist, index }: { artist: RailArtist; index: number }) {
  const router = useRouter();
  const status = BOOKING_STATUS[artist.bookingStatus] ?? BOOKING_STATUS.closed;

  return (
    <Animated.View entering={index <= 8 ? enterUp(index, 160) : undefined}>
      <PressableScale
        onPress={() => router.push(`/artist/${artist.id}`)}
        accessibilityRole="link"
        accessibilityLabel={`${artist.blaze}, ${status.label}`}
        style={styles.chip}
      >
        <View style={[styles.chipRing, artist.isPremium && styles.chipRingPremium]}>
          <TAvatar uri={artist.avatarUrl} name={artist.blaze} size="xl" />
        </View>
        <TText variant="caption" weight="medium" numberOfLines={1} style={styles.chipName}>{artist.blaze}</TText>
        <View style={styles.chipStatus}>
          <View style={[styles.dot, { backgroundColor: status.color }]} />
          <TText variant="micro" color="tertiary" numberOfLines={1}>{status.short}</TText>
        </View>
      </PressableScale>
    </Animated.View>
  );
}

function IconButton({ icon, label, onPress, badge }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; badge?: number;
}) {
  return (
    <PressableScale
      onPress={onPress}
      pressedScale={0.92}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      style={styles.iconBtn}
    >
      <Ionicons name={icon} size={19} color={Colors.textPrimary} />
      {!!badge && badge > 0 && (
        <View style={styles.badge} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <TText variant="micro" tabular style={styles.badgeText}>{badge > 9 ? '9+' : badge}</TText>
        </View>
      )}
    </PressableScale>
  );
}

/** First run: the tables are empty — say so plainly and point to the next step. */
function FirstRun({ isArtist, signedIn, onExplore, onPublish, onSignIn }: {
  isArtist: boolean; signedIn: boolean; onExplore: () => void; onPublish: () => void; onSignIn: () => void;
}) {
  return (
    <View style={styles.firstRun}>
      <Animated.View entering={enterUp(0, 80)} style={styles.firstRunRing}>
        <Ionicons name="images-outline" size={22} color={Colors.accentWarm} />
      </Animated.View>
      <Animated.View entering={enterUp(1, 80)}>
        <TText variant="label" color="accentWarm" uppercase style={styles.center}>Le fil</TText>
        <TText variant="displayM" accessibilityRole="header" style={[styles.center, styles.firstRunTitle]}>
          Le fil attend ses <TText variant="displayM" italic color="accentGlow">premières pièces</TText>
        </TText>
      </Animated.View>
      <Animated.View entering={enterUp(2, 80)}>
        <TText variant="body" color="secondary" style={[styles.center, styles.firstRunText]}>
          {isArtist
            ? 'Publiez une première réalisation : elle ouvrira le fil et rendra votre profil visible.'
            : 'Les réalisations des artistes apparaîtront ici dès leur publication. Commencez par découvrir les profils.'}
        </TText>
      </Animated.View>
      <Animated.View entering={enterUp(3, 80)} style={styles.firstRunActions}>
        {isArtist ? (
          <>
            <TButton title="Publier une réalisation" onPress={onPublish} size="md" fullWidth={false} />
            <TButton title="Explorer les artistes" variant="secondary" onPress={onExplore} size="md" fullWidth={false} />
          </>
        ) : (
          <>
            <TButton title="Explorer les artistes" onPress={onExplore} size="md" fullWidth={false} />
            {!signedIn && <TButton title="Se connecter" variant="ghost" onPress={onSignIn} size="md" fullWidth={false} />}
          </>
        )}
      </Animated.View>
    </View>
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

  // ── Scroll-driven chrome: the masthead recedes, the header frosts over the work.
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => { scrollY.set(e.contentOffset.y); });
  const glassStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.get(), [8, 72], [0, 1], Extrapolation.CLAMP),
  }));
  const mastheadStyle = useAnimatedStyle(() => {
    const y = scrollY.get();
    return {
      opacity: interpolate(y, [0, 150], [1, 0], Extrapolation.CLAMP),
      transform: [{ translateY: reduced ? 0 : interpolate(y, [0, 150], [0, 48], Extrapolation.CLAMP) }],
    };
  });

  useEffect(() => { fetchFeed(user?.id); }, [user?.id, fetchFeed]);
  // A failed first load retries on its own (and as soon as the connection is back).
  useAutoRetry(!!error && posts.length === 0, isLoading, () => { void fetchFeed(user?.id); });

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
    // Videos open the full-screen viewer; photos keep their own page.
    onPress: () => router.push(p.mediaType === 'video' ? `/reels/${p.id}` : `/post/${p.id}`),
    onArtistPress: () => router.push(`/artist/${p.artistId}`),
  }), [handleLike, router]);

  // Rows are virtualized and scrolled past constantly: no entrance animation here.
  const renderRow = useCallback(({ item: row }: { item: FeedRow }) => {
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
    return <View style={styles.row}>{content}</View>;
  }, [cardProps, router, cols, cellW, innerW, tileH]);

  const goExplore = useCallback(() => router.push('/(tabs)/explore'), [router]);
  const hasPosts = posts.length > 0;

  const ListHeader = (
    <View>
      <View style={{ height: HEADER_H + insets.top }} />

      {hasPosts && (
        <Animated.View style={mastheadStyle}>
          <View style={styles.masthead}>
            <Animated.View entering={enterUp(0)}>
              <TText variant="label" color="accentWarm" uppercase>Le fil</TText>
            </Animated.View>
            <Animated.View entering={enterUp(1)}>
              <TText variant="displayM" accessibilityRole="header" style={styles.title}>
                Les dernières <TText variant="displayM" italic color="accentGlow">réalisations</TText>
              </TText>
            </Animated.View>
            <Animated.View entering={enterUp(2)}>
              <TText variant="bodySmall" color="tertiary">Les pièces publiées récemment par les artistes INKR.</TText>
            </Animated.View>
          </View>
        </Animated.View>
      )}

      {railArtists.length > 0 && (
        <View style={styles.railSection}>
          <View style={styles.sectionHead}>
            <TText variant="label" color="tertiary" uppercase>Récemment actifs</TText>
            <PressableScale onPress={goExplore} accessibilityRole="link" hitSlop={8} style={styles.textLink}>
              <TText variant="caption" weight="medium" color="secondary">Tous les artistes</TText>
              <Ionicons name="arrow-forward" size={13} color={Colors.textSecondary} />
            </PressableScale>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.railScroller} contentContainerStyle={styles.rail}>
            {railArtists.map((a, i) => <ArtistChip key={a.id} artist={a} index={i} />)}
          </ScrollView>
        </View>
      )}

      {!!error && hasPosts && (
        <Animated.View entering={fadeIn()} style={styles.notice} accessibilityLiveRegion="polite">
          <Ionicons name="cloud-offline-outline" size={16} color={Colors.warning} />
          <TText variant="caption" color="secondary" style={{ flex: 1 }}>Actualisation impossible. Vérifiez votre connexion.</TText>
          <PressableScale onPress={handleRefresh} accessibilityRole="button" hitSlop={8} style={styles.noticeAction}>
            <TText variant="caption" weight="semibold">Réessayer</TText>
          </PressableScale>
        </Animated.View>
      )}

      {hasPosts && <View style={styles.feedHead} />}
    </View>
  );

  const showSkeleton = isLoading && !hasPosts;

  return (
    <View style={styles.container}>
      {/* Floating header — frosts over the work once the feed scrolls */}
      <View style={[styles.floatingHeader, { paddingTop: insets.top }]} pointerEvents="box-none">
        <Animated.View style={[StyleSheet.absoluteFill, glassStyle]} pointerEvents="none">
          <GlassSurface style={StyleSheet.absoluteFill} />
          <View style={styles.headerBorder} />
        </Animated.View>
        <View style={styles.headerInner}>
          <Logo size="sm" variant="full" />
          <View style={styles.headerActions}>
            <IconButton icon="search-outline" label="Rechercher un artiste" onPress={goExplore} />
            <IconButton
              icon="notifications-outline"
              label={unreadCount > 0 ? `Notifications, ${unreadCount} non lue${unreadCount > 1 ? 's' : ''}` : 'Notifications'}
              onPress={() => router.push('/notifications')}
              badge={unreadCount}
            />
          </View>
        </View>
      </View>

      {showSkeleton ? (
        <View style={[styles.frame, { paddingTop: insets.top + HEADER_H }]} accessibilityLabel="Chargement du fil">
          <FeedSkeleton cols={cols} cellW={cellW} />
        </View>
      ) : (
        <Animated.FlatList
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
          onScroll={onScroll}
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
              <FirstRun
                isArtist={user?.role === 'artist'}
                signedIn={!!user}
                onExplore={goExplore}
                onPublish={() => router.push('/create')}
                onSignIn={() => router.push('/(auth)/sign-in')}
              />
            )
          }
          ListFooterComponent={
            !hasPosts ? null : hasMore ? (
              <View style={styles.footer}>
                {isLoading && <ActivityIndicator color={Colors.textTertiary} accessibilityLabel="Chargement des publications suivantes" />}
              </View>
            ) : (
              <Animated.View entering={fadeIn()} style={styles.end}>
                <TText variant="displayS" style={styles.center}>
                  Vous êtes <TText variant="displayS" italic color="accentGlow">à jour</TText>
                </TText>
                <TText variant="bodySmall" color="tertiary" style={[styles.center, styles.endText]}>
                  Découvrez d’autres artistes par style ou par ville.
                </TText>
                <TButton title="Explorer les artistes" variant="secondary" size="md" fullWidth={false} onPress={goExplore} />
              </Animated.View>
            )
          }
        />
      )}

      {/* Artist shortcut: publish a new piece (hidden on first run, where the CTA is inline) */}
      {user?.role === 'artist' && hasPosts && (
        <Animated.View
          entering={fadeIn(500)}
          style={[styles.fab, { bottom: 88 + insets.bottom, right: Math.max(Layout.gutter, (width - Layout.maxContent) / 2 + Layout.gutter) }]}
        >
          <PressableScale
            onPress={() => router.push('/create')}
            accessibilityRole="button"
            accessibilityLabel="Publier une réalisation"
            style={[styles.fabBtn, cols > 1 && styles.fabBtnWide]}
          >
            <Ionicons name="add" size={24} color={Colors.textInverse} />
            {cols > 1 && <TText variant="bodySmall" weight="semibold" color="inverse">Publier</TText>}
          </PressableScale>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  list: { flex: 1 },
  frame: { width: '100%', maxWidth: Layout.maxContent, alignSelf: 'center', paddingHorizontal: Layout.gutter },
  center: { textAlign: 'center' },

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
    backgroundColor: 'rgba(11,10,9,0.35)',
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
  noticeAction: { minHeight: 32, justifyContent: 'center' },

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

  // First run / empty
  empty: { paddingTop: Spacing['2xl'] },
  firstRun: {
    alignItems: 'center', alignSelf: 'center',
    width: '100%', maxWidth: Layout.maxReading,
    paddingTop: Spacing['3xl'], paddingBottom: Spacing['2xl'],
  },
  firstRunRing: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderGlow,
    backgroundColor: Colors.glassAmber,
    marginBottom: Spacing.lg,
  },
  firstRunTitle: { marginTop: Spacing['2xs'] },
  firstRunText: { marginTop: Spacing.sm, maxWidth: 440, alignSelf: 'center' },
  firstRunActions: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: Spacing.xs,
    marginTop: Spacing.xl,
  },

  footer: { height: 80, alignItems: 'center', justifyContent: 'center' },
  end: {
    alignItems: 'center',
    paddingTop: Spacing.xl, paddingBottom: Spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.borderDefault,
  },
  endText: { marginTop: 6, marginBottom: Spacing.md },

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
