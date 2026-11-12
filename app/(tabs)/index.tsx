import React, { useCallback, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  View,
  RefreshControl,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useContentDimensions, useShell } from '@/hooks/useContentDimensions';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter } from 'expo-router';
import Animated, {
  useSharedValue, useAnimatedScrollHandler, useAnimatedStyle, interpolate, Extrapolation,
} from 'react-native-reanimated';
import { Colors, Spacing, Layout } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { useAutoRetry } from '@/hooks/use-auto-retry';
import { TAvatar } from '@/components/ui/TAvatar';
import { TButton } from '@/components/ui/TButton';
import { TSkeleton } from '@/components/ui/TSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { PostCard, type PostCardData } from '@/components/PostCard';
import { BOOKING_STATUS } from '@/components/ArtistCard';
import { Logo } from '@/components/ui/Logo';
import { PressableScale, enterUp, fadeIn } from '@/components/motion';
import {
  ArtCanvas, EditorialTitle, IconButton, InkPanel, Kicker, Masthead, SectionHead, StatusDot,
} from '@/components/v5';
import { SectionTabs } from '@/components/v5/SectionTabs';
import { useFeedStore, FeedPost, type FeedScope, followingKeyOf } from '@/store/feed-store';
import { useFollowStore } from '@/store/follow-store';
import { useAuthStore } from '@/store/auth-store';
import { useNotificationStore } from '@/store/notification-store';
import { Toast } from '@/components/ui/TToast';
import { StoriesRail } from '@/components/social/StoriesRail';
import { useReactionStore } from '@/components/social/reaction-store';

const HEADER_H = 60;
const GAP = Spacing.md;
const ROW_GAP = Spacing['2xl'];
/** Below this, a "selection" is just a couple of posts: the rail stays hidden. */
const SELECTION_MIN = 3;

const SCOPES: { value: FeedScope; label: string }[] = [
  { value: 'all', label: 'Pour vous' },
  { value: 'following', label: 'Abonnements' },
];

// ── Editorial rhythm ──────────────────────────────────────────────────────────
// Phones: one large piece, a pair, a wide piece, repeat.
// Tablets/desktop: never a row of equal cards — a lead spanning two columns
// beside a single piece, the same mirrored, then a pair of halves.
type FeedRow =
  | { key: string; kind: 'lead'; post: FeedPost }
  | { key: string; kind: 'pair'; posts: FeedPost[] }
  | { key: string; kind: 'wide'; post: FeedPost }
  | { key: string; kind: 'feature'; lead: FeedPost; rest: FeedPost[]; mirror: boolean }
  | { key: string; kind: 'duo'; posts: FeedPost[] };

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
    } else if (beat === 2 || (beat === 1 && cols === 2)) {
      const group = posts.slice(i, i + 2);
      rows.push({ key: group.map((p) => p.id).join('|'), kind: 'duo', posts: group });
      i += group.length;
    } else {
      const rest = posts.slice(i + 1, i + 1 + (cols - 2));
      rows.push({
        key: [posts[i], ...rest].map((p) => p.id).join('|'), kind: 'feature', lead: posts[i], rest, mirror: beat === 1,
      });
      i += 1 + rest.length;
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
        <View style={[styles.chipFrame, artist.isPremium && styles.chipFramePremium]}>
          <TAvatar uri={artist.avatarUrl} name={artist.blaze} size="xl" />
        </View>
        <TText variant="title2" serif numberOfLines={1} style={styles.chipName}>{artist.blaze}</TText>
        <StatusDot tone={status.tone} label={status.short} />
      </PressableScale>
    </Animated.View>
  );
}

/** Header control with an optional count: the kit's square icon button plus a vermilion tab. */
function HeaderButton({ icon, label, onPress, badge }: {
  icon: React.ComponentProps<typeof IconButton>['icon']; label: string; onPress: () => void; badge?: number;
}) {
  return (
    <View>
      <IconButton icon={icon} label={label} onPress={onPress} />
      {!!badge && badge > 0 && (
        <View style={styles.badge} pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <TText variant="micro" tabular style={styles.badgeText}>{badge > 9 ? '9+' : badge}</TText>
        </View>
      )}
    </View>
  );
}

/** First run: the tables are empty — say so plainly and point to the next step. */
function FirstRun({ isArtist, signedIn, onExplore, onPublish, onSignIn }: {
  isArtist: boolean; signedIn: boolean; onExplore: () => void; onPublish: () => void; onSignIn: () => void;
}) {
  return (
    <Animated.View entering={enterUp(0, 80)} style={styles.firstRun}>
      <InkPanel>
        <Kicker tone="flameOnInk">La communauté commence</Kicker>
        <EditorialTitle size="section" onInk emphasis="premières pièces." style={styles.firstRunTitle}>
          Le fil attend ses
        </EditorialTitle>
        <TText variant="body" color="onInkMuted" style={styles.firstRunText}>
          {isArtist
            ? 'Publiez une première réalisation : elle ouvrira le fil et rendra votre profil visible.'
            : 'Les réalisations des artistes apparaîtront ici dès leur publication. Commencez par découvrir les profils.'}
        </TText>
        <View style={styles.firstRunActions}>
          {isArtist ? (
            <>
              <TButton title="Publier une réalisation" variant="glass" onPress={onPublish} size="md" fullWidth={false} />
              <TButton title="Explorer les artistes" variant="inverse" onPress={onExplore} size="md" fullWidth={false} />
            </>
          ) : (
            <>
              <TButton title="Explorer les artistes" variant="glass" onPress={onExplore} size="md" fullWidth={false} />
              {!signedIn && <TButton title="Se connecter" variant="inverse" onPress={onSignIn} size="md" fullWidth={false} />}
            </>
          )}
        </View>
      </InkPanel>
    </Animated.View>
  );
}

/** One print of the weekly selection: a numbered plate, the artist's name as its cartel. */
function SelectionTile({ post, index, width, onPress }: {
  post: FeedPost; index: number; width: number; onPress: () => void;
}) {
  return (
    <Animated.View entering={index <= 8 ? enterUp(index, 120) : undefined}>
      <PressableScale
        onPress={onPress}
        accessibilityRole="link"
        accessibilityLabel={`Pièce de ${post.artistName}`}
        style={{ width }}
      >
        <ArtCanvas uri={post.mediaUrl} aspectRatio={5 / 7} mark={`N° ${String(index + 1).padStart(2, '0')}`} />
        <TText variant="title2" serif numberOfLines={1} style={styles.printName}>{post.artistName}</TText>
        {!!post.artistCity && <TText variant="caption" color="secondary" numberOfLines={1}>{post.artistCity}</TText>}
      </PressableScale>
    </Animated.View>
  );
}

/** "Abonnements" with nothing to show: say why, and offer the one useful next step. */
function FollowingEmpty({ signedIn, followsNobody, onExplore, onSignIn }: {
  signedIn: boolean; followsNobody: boolean; onExplore: () => void; onSignIn: () => void;
}) {
  if (!signedIn) {
    return (
      <EmptyState
        icon="people-outline"
        title="Connectez-vous pour suivre des artistes"
        description="Les nouvelles pièces des artistes que vous suivez composeront ce fil."
        ctaLabel="Se connecter"
        onCta={onSignIn}
        style={styles.empty}
      />
    );
  }
  if (followsNobody) {
    return (
      <EmptyState
        icon="person-add-outline"
        title="Suivez des artistes pour composer votre fil"
        description="Leurs nouvelles pièces apparaîtront ici, des plus récentes aux plus anciennes."
        ctaLabel="Explorer les artistes"
        onCta={onExplore}
        style={styles.empty}
      />
    );
  }
  return (
    <EmptyState
      icon="images-outline"
      title="Rien de publié pour l’instant"
      description="Les artistes que vous suivez n’ont encore rien publié. Leurs pièces apparaîtront ici dès leur publication."
      ctaLabel="Explorer les artistes"
      onCta={onExplore}
      style={styles.empty}
    />
  );
}

function FeedSkeleton({ cols, cellW, innerW }: { cols: number; cellW: number; innerW: number }) {
  const tileH = Math.round(cellW * 1.25);
  return (
    <View>
      <View style={styles.skeletonRail}>
        {[0, 1, 2, 3, 4].map((i) => (
          <View key={i} style={{ alignItems: 'center', gap: 8 }}>
            <TSkeleton width={72} height={72} radius={0} />
            <TSkeleton width={52} height={10} radius={0} />
          </View>
        ))}
      </View>
      <View style={[styles.rowLine, { marginTop: Spacing.xl }]}>
        {cols === 1 ? (
          <View style={{ flex: 1 }}>
            <TSkeleton height={tileH} radius={0} />
            <View style={styles.skeletonLabel}>
              <TSkeleton width={32} height={32} radius={0} />
              <View style={{ flex: 1, gap: 8 }}>
                <TSkeleton width="45%" height={18} radius={0} />
                <TSkeleton width="30%" height={11} radius={0} />
              </View>
            </View>
          </View>
        ) : (
          [0, 1].slice(0, cols === 2 ? 1 : 2).map((i) => (
            <View key={i} style={{ width: cols === 2 ? innerW : i === 0 ? cellW * 2 + GAP : cellW }}>
              <TSkeleton height={tileH} radius={0} />
              <TSkeleton width="40%" height={18} radius={0} style={{ marginTop: 14 }} />
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
  const { width, gutter } = useContentDimensions();
  const { hasSidebar } = useShell();
  const { user } = useAuthStore();
  const {
    posts, error, isLoading, isRefreshing, hasMore, scope, followingKey, selection,
    fetchFeed, fetchMore, refresh, fetchSelection, toggleLike,
  } = useFeedStore();
  const followedIds = useFollowStore((s) => s.followedIds);
  const followsLoaded = useFollowStore((s) => s.isLoaded);
  const fetchFollowed = useFollowStore((s) => s.fetchFollowed);
  const { unreadCount } = useNotificationStore();
  const reactionCounts = useReactionStore((s) => s.counts);
  const myReactions = useReactionStore((s) => s.mine);
  const reactionsOwner = useReactionStore((s) => s.mineOwner);
  const loadReactions = useReactionStore((s) => s.load);

  // ── The header takes a paper ground and a hairline once the feed scrolls under it.
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => { scrollY.set(e.contentOffset.y); });
  const groundStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.get(), [8, 48], [0, 1], Extrapolation.CLAMP),
  }));

  useEffect(() => { fetchFeed(user?.id); }, [user?.id, fetchFeed]);
  useEffect(() => { void fetchFollowed(user?.id); }, [user?.id, fetchFollowed]);
  useEffect(() => { void fetchSelection(); }, [fetchSelection]);
  // Reactions for every loaded page in one request (the store skips posts already asked for).
  useEffect(() => {
    if (posts.length > 0) void loadReactions(posts.map((p) => p.id), user?.id);
  }, [posts, user?.id, loadReactions]);
  // A failed first load retries on its own (and as soon as the connection is back).
  useAutoRetry(!!error && posts.length === 0, isLoading, () => { void fetchFeed(user?.id); });

  // Follows changed elsewhere (an artist page, Explore): rebuild "Abonnements" on return,
  // never under the reader's eyes.
  const followKey = useMemo(() => followingKeyOf(followedIds), [followedIds]);
  useFocusEffect(useCallback(() => {
    if (scope !== 'following' || !user?.id || !followsLoaded || isLoading || error) return;
    if (followingKey !== null && followingKey !== followKey) void fetchFeed(user.id);
  }, [scope, user?.id, followsLoaded, isLoading, error, followingKey, followKey, fetchFeed]));

  const selectScope = useCallback((next: FeedScope) => {
    if (next === scope) return;
    scrollY.set(0);
    void fetchFeed(user?.id, next);
  }, [scope, scrollY, fetchFeed, user?.id]);

  const handleRefresh = useCallback(async () => {
    await refresh(user?.id);
    const ids = useFeedStore.getState().posts.map((p) => p.id);
    if (ids.length > 0) void loadReactions(ids, user?.id, true);
  }, [user?.id, refresh, loadReactions]);
  const handleEndReached = useCallback(() => fetchMore(user?.id), [user?.id, fetchMore]);
  const handleLike = useCallback(async (id: string) => {
    if (!user?.id) { router.push('/(auth)/sign-in'); return; }
    if (!await toggleLike(id, user.id)) Toast.error('Le j’aime n’a pas été enregistré. Réessayez.');
  }, [router, toggleLike, user?.id]);

  // ── Responsive grid
  const frameW = Math.min(width, Layout.maxContent);
  const innerW = frameW - gutter * 2;
  const cols = innerW >= 960 ? 3 : innerW >= 640 ? 2 : 1;
  const cellW = (innerW - GAP * (cols - 1)) / cols;
  const tileH = Math.round(cellW * 1.25);
  const duoW = (innerW - GAP) / 2;
  const rows = useMemo(() => buildRows(posts, cols), [posts, cols]);

  const railArtists = useMemo<RailArtist[]>(
    () => [...new Map(posts.map((post) => [post.artistId, {
      id: post.artistId, blaze: post.artistName, avatarUrl: post.artistAvatarUrl,
      isPremium: post.artistIsPremium, bookingStatus: post.artistBookingStatus,
    }])).values()],
    [posts],
  );

  const followedList = useMemo(() => [...followedIds], [followedIds]);
  const mineLoaded = !!user?.id && reactionsOwner === user.id;

  const cardProps = useCallback((p: FeedPost) => ({
    post: toCard(p),
    initialReactionCounts: reactionCounts[p.id],
    initialMyReaction: mineLoaded ? myReactions[p.id] : undefined,
    onLike: () => handleLike(p.id),
    // Videos open the full-screen viewer; photos keep their own page.
    onPress: () => router.push(p.mediaType === 'video' ? `/reels/${p.id}` : `/post/${p.id}`),
    onArtistPress: () => router.push(`/artist/${p.artistId}`),
  }), [handleLike, router, reactionCounts, myReactions, mineLoaded]);

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
      case 'feature': {
        const lead = (
          <View key={row.lead.id} style={{ width: cols === 2 ? innerW : cellW * 2 + GAP }}>
            <PostCard {...cardProps(row.lead)} variant="wide" imageHeight={tileH} />
          </View>
        );
        const rest = row.rest.map((p) => (
          <View key={p.id} style={{ width: cellW }}><PostCard {...cardProps(p)} variant="half" imageHeight={tileH} /></View>
        ));
        content = <View style={styles.rowLine}>{row.mirror ? [...rest, lead] : [lead, ...rest]}</View>;
        break;
      }
      case 'duo':
        content = (
          <View style={styles.rowLine}>
            {row.posts.map((p) => (
              <View key={p.id} style={{ width: duoW }}><PostCard {...cardProps(p)} variant="half" imageHeight={tileH} /></View>
            ))}
          </View>
        );
        break;
    }
    return <View style={styles.row}>{content}</View>;
  }, [cardProps, router, cols, cellW, innerW, tileH, duoW]);

  const goExplore = useCallback(() => router.push('/(tabs)/explore'), [router]);
  const goSignIn = useCallback(() => router.push('/(auth)/sign-in'), [router]);
  const goPublish = useCallback(() => router.push('/create'), [router]);
  const hasPosts = posts.length > 0;
  const following = scope === 'following';
  const isArtist = user?.role === 'artist';
  const showSelection = !following && selection.length >= SELECTION_MIN;
  const printW = cols === 1 ? 150 : 196;
  // Rails bleed to the page edge while their first item stays on the gutter.
  const bleed = { scroller: { marginHorizontal: -gutter }, content: { paddingHorizontal: gutter } };

  const top = (
    <View>
      <View style={{ height: HEADER_H + insets.top }} />
      <Masthead
        key={following ? 'following' : 'all'}
        kicker={following ? '01 / Abonnements' : '01 / Le fil'}
        title={following ? 'Les artistes que' : 'Les dernières'}
        emphasis={following ? 'vous suivez.' : 'réalisations.'}
        description={following
          ? 'Leurs dernières pièces, des plus récentes aux plus anciennes.'
          : 'Les pièces publiées par les artistes Inkr, des plus récentes aux plus anciennes.'}
        action={isArtist && hasPosts && cols > 1 ? (
          <TButton title="Publier une réalisation" variant="secondary" size="sm" fullWidth={false} onPress={goPublish} />
        ) : undefined}
        style={styles.masthead}
      />
      <SectionTabs tabs={SCOPES} value={scope} onChange={selectScope} style={styles.tabs} />
    </View>
  );

  const ListHeader = (
    <View>
      {top}

      {/* Stories: everyone's on "Pour vous" (artists can add theirs), followed artists' on "Abonnements". */}
      {following
        ? <StoriesRail key="following" artistIds={followedList} />
        : <StoriesRail key="all" showAdd />}

      {showSelection && (
        <View style={styles.railSection}>
          <SectionHead
            kicker="Sélection de la semaine"
            description="Les pièces les plus aimées ces sept derniers jours."
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={bleed.scroller} contentContainerStyle={[styles.printRail, bleed.content]}>
            {selection.map((p, i) => (
              <SelectionTile key={p.id} post={p} index={i} width={printW} onPress={() => router.push(`/post/${p.id}`)} />
            ))}
          </ScrollView>
        </View>
      )}

      {railArtists.length > 0 && (
        <View style={styles.railSection}>
          <SectionHead kicker="Récemment actifs" action={{ label: 'Tous les artistes', onPress: goExplore }} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={bleed.scroller} contentContainerStyle={[styles.rail, bleed.content]}>
            {railArtists.map((a, i) => <ArtistChip key={a.id} artist={a} index={i} />)}
          </ScrollView>
        </View>
      )}

      {!!error && hasPosts && (
        <Animated.View entering={fadeIn()} style={styles.notice} accessibilityLiveRegion="polite">
          <StatusDot tone="alert" label="Hors ligne" />
          <TText variant="caption" color="secondary" style={{ flex: 1 }}>Actualisation impossible. Vérifiez votre connexion.</TText>
          <TButton title="Réessayer" variant="ghost" size="sm" fullWidth={false} onPress={() => { void handleRefresh(); }} />
        </Animated.View>
      )}

      {hasPosts && (
        <View style={styles.feedHead}>
          <Kicker tone="muted">{following ? 'Dernières pièces suivies' : 'Dernières pièces'}</Kicker>
        </View>
      )}
    </View>
  );

  const showSkeleton = isLoading && !hasPosts;

  return (
    <View style={styles.container}>
      {/* Header: paper ground under it once the feed scrolls. The rail carries the brand on wide web. */}
      <View style={[styles.floatingHeader, { paddingTop: insets.top }]} pointerEvents="box-none">
        <Animated.View style={[StyleSheet.absoluteFill, styles.headerGround, groundStyle]} pointerEvents="none" />
        <View style={[styles.headerInner, { paddingHorizontal: gutter }, hasSidebar && styles.headerInnerRail]}>
          {!hasSidebar && <Logo size="sm" variant="full" />}
          <View style={styles.headerActions}>
            <HeaderButton icon="search-outline" label="Rechercher un artiste" onPress={goExplore} />
            <HeaderButton
              icon="notifications-outline"
              label={unreadCount > 0 ? `Notifications, ${unreadCount} non lue${unreadCount > 1 ? 's' : ''}` : 'Notifications'}
              onPress={() => router.push('/notifications')}
              badge={unreadCount}
            />
          </View>
        </View>
      </View>

      {showSkeleton ? (
        <ScrollView style={styles.list} contentContainerStyle={[styles.frame, { paddingHorizontal: gutter }]} scrollEnabled={false}>
          {top}
          <View accessibilityLabel="Chargement du fil">
            <FeedSkeleton cols={cols} cellW={cellW} innerW={innerW} />
          </View>
        </ScrollView>
      ) : (
        <Animated.FlatList
          data={rows}
          keyExtractor={(row) => `${cols}:${row.key}`}
          renderItem={renderRow}
          style={styles.list}
          contentContainerStyle={[styles.frame, { paddingHorizontal: gutter, paddingBottom: insets.bottom + 110 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.flame}
              colors={[Colors.flame]}
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
            ) : following ? (
              <FollowingEmpty
                signedIn={!!user}
                followsNobody={followsLoaded && followedIds.size === 0}
                onExplore={goExplore}
                onSignIn={goSignIn}
              />
            ) : (
              <FirstRun
                isArtist={isArtist}
                signedIn={!!user}
                onExplore={goExplore}
                onPublish={goPublish}
                onSignIn={goSignIn}
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
                <Kicker tone="muted">Fin du fil</Kicker>
                <EditorialTitle size="section" emphasis="à jour." style={styles.endTitle}>Vous êtes</EditorialTitle>
                <TText variant="bodySmall" color="secondary" style={styles.endText}>
                  Découvrez d’autres artistes par style ou par ville.
                </TText>
                <TButton title="Explorer les artistes" variant="secondary" size="md" fullWidth={false} onPress={goExplore} />
              </Animated.View>
            )
          }
        />
      )}

      {/* Artist shortcut on phones and tablets: publish a new piece (the masthead carries it on wide screens). */}
      {isArtist && hasPosts && cols === 1 && (
        <Animated.View
          entering={fadeIn(500)}
          style={[styles.fab, { bottom: 88 + insets.bottom, right: gutter }]}
        >
          <PressableScale
            onPress={goPublish}
            accessibilityRole="button"
            accessibilityLabel="Publier une réalisation"
            style={styles.fabBtn}
          >
            <Ionicons name="add" size={24} color={Colors.paper} />
          </PressableScale>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.paper },
  list: { flex: 1 },
  frame: { width: '100%', maxWidth: Layout.maxContent, alignSelf: 'center' },

  // Header
  floatingHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100 },
  headerGround: { backgroundColor: Colors.paper, borderBottomWidth: 1, borderBottomColor: Colors.line },
  headerInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    height: HEADER_H,
    width: '100%', maxWidth: Layout.maxContent, alignSelf: 'center',
  },
  headerInnerRail: { justifyContent: 'flex-end' },
  headerActions: { flexDirection: 'row', gap: Spacing['2xs'] },
  badge: {
    position: 'absolute', top: -4, right: -4,
    minWidth: 18, height: 18, paddingHorizontal: 4,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.flame,
    borderWidth: 2, borderColor: Colors.paper,
  },
  badgeText: { color: '#FFFFFF', fontSize: 9, lineHeight: 11, letterSpacing: 0 },

  masthead: { marginBottom: 0 },
  tabs: { marginBottom: Spacing.lg },

  // Rails
  railSection: { marginTop: Spacing.lg, marginBottom: Spacing.lg },
  rail: { gap: Spacing.sm },
  chip: { width: 96, alignItems: 'flex-start', gap: 6 },
  chipFrame: { padding: 3, borderWidth: 1, borderColor: Colors.line },
  chipFramePremium: { borderColor: Colors.flame },
  chipName: { fontSize: 18, lineHeight: 20, maxWidth: 94 },

  // Weekly selection
  printRail: { gap: Spacing.md },
  printName: { fontSize: 20, lineHeight: 22, marginTop: 10 },

  notice: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12,
    paddingVertical: Spacing['2xs'], marginBottom: Spacing.md,
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: Colors.line,
  },

  feedHead: {
    marginTop: Spacing.xs, marginBottom: Spacing.lg, paddingTop: Spacing.xs,
    borderTopWidth: 1, borderTopColor: Colors.ink,
  },

  // Rows
  row: { marginBottom: ROW_GAP },
  rowLine: { flexDirection: 'row', gap: GAP, alignItems: 'flex-start' },
  flexCell: { flex: 1, minWidth: 0 },

  skeletonRail: { flexDirection: 'row', gap: Spacing.sm, overflow: 'hidden', marginTop: Spacing.xs },
  skeletonLabel: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },

  // First run / empty
  empty: { paddingTop: Spacing['2xl'] },
  firstRun: { marginTop: Spacing.md, marginBottom: Spacing['2xl'] },
  firstRunTitle: { marginTop: Spacing.sm },
  firstRunText: { marginTop: Spacing.md, maxWidth: 480 },
  firstRunActions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginTop: Spacing.xl },

  footer: { height: 80, alignItems: 'center', justifyContent: 'center' },
  end: {
    paddingTop: Spacing.md, paddingBottom: Spacing.lg,
    borderTopWidth: 1, borderTopColor: Colors.ink,
  },
  endTitle: { marginTop: Spacing.xs },
  endText: { marginTop: Spacing['2xs'], marginBottom: Spacing.md },

  // FAB: a square ink plate
  fab: { position: 'absolute', zIndex: 50 },
  fabBtn: {
    width: 56, height: 56,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.ink,
    borderWidth: 1, borderColor: Colors.paper,
  },
});
